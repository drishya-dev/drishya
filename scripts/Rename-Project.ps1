#Requires -Version 5.1
<#
.SYNOPSIS
    Rename a project folder and carry its Claude Code history across. Native Windows.

.DESCRIPTION
    Claude Code keys sessions to the project's absolute path, encoded by replacing
    / \ : and . with -. Rename the folder alone and the sessions are orphaned:
    still on disk, but Claude Code computes a different slug and never looks there.

    This moves the folder AND everything keyed to its path, together:

      1. ~/.claude/history.jsonl          backed up
      2. ~/.claude.json                   backed up
      3. the project folder               moved
      4. ~/.claude/projects/<slug>/       moved  (transcripts, subagents/,
                                                 tool-results/, memory/)
      5. history.jsonl                    path references rewritten
      6. .claude.json                     per-project key rewritten, JSON-validated

    ~/.claude/file-history/ is keyed by session id, not path, so it needs nothing.

.PARAMETER OldPath
    Current absolute path of the project folder.

.PARAMETER NewPath
    Desired absolute path. Must not already exist.

.PARAMETER DryRun
    Print every action without changing anything.

.PARAMETER Force
    Skip the confirmation prompt. Ignored during -DryRun.

.EXAMPLE
    .\scripts\Rename-Project.ps1 -OldPath "C:\Users\ASUS\Desktop\CS\Projects\vantage" `
                                 -NewPath "C:\Users\ASUS\Desktop\CS\Projects\drishya" -DryRun

.NOTES
    Verified against Claude Code's documented storage layout, Sep 2026.
    See docs/BLUEPRINT.md Appendix A2.

    Quit Claude Code (CLI and desktop app) before running: it holds session lock
    files and may rewrite state on exit.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $OldPath,
    [Parameter(Mandatory = $true)][string] $NewPath,
    [switch] $DryRun,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- helpers ----

function Write-Step { param([string]$Text) Write-Host $Text -ForegroundColor Cyan }
function Write-Info { param([string]$Text) Write-Host "    $Text" -ForegroundColor DarkGray }
function Write-Ok   { param([string]$Text) Write-Host "    $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "    $Text" -ForegroundColor Yellow }

function Get-NormalizedPath {
    # Backslash separators, no trailing slash. Does NOT require the path to exist,
    # so it works for the destination too.
    # Uses .Replace(), not -replace: literal string replacement, no regex, so
    # backslashes cannot be misread on either the pattern or replacement side.
    param([string]$Path)
    $p = $Path.Replace('/', '\')
    if ($p.Length -gt 3) { $p = $p.TrimEnd('\') }
    return $p
}

function Get-ClaudeSlug {
    # Claude Code's encoding: / \ : and . all become -
    # C:\Users\ASUS\Desktop\CS\Projects\vantage
    #   -> C--Users-ASUS-Desktop-CS-Projects-vantage
    param([string]$Path)
    return ($Path -replace '[\\/:.]', '-')
}

function Get-PathVariants {
    <#
      The same path as it may appear inside a JSON file:
        JsonEsc  C:\\Users\\...   (how a Windows path is stored in JSON)
        Raw      C:\Users\...
        Forward  C:/Users/...

      Longest first, so a shorter variant can never partially consume a longer
      one. Duplicates are dropped - on a POSIX path all three are identical.

      .Replace() is deliberate. `-replace '\\','\\\\'` looks right and is not:
      the pattern is regex (one backslash) but the replacement is literal, so it
      emits FOUR backslashes instead of two, and every JSON-escaped path then
      silently fails to match.
    #>
    param([string]$Path)

    $ordered = [ordered]@{}
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'

    $candidates = @(
        @{ Name = 'JsonEsc'; Value = $Path.Replace('\', '\\') }
        @{ Name = 'Raw';     Value = $Path }
        @{ Name = 'Forward'; Value = $Path.Replace('\', '/') }
    )
    foreach ($c in $candidates) {
        if ($seen.Add($c.Value)) { $ordered[$c.Name] = $c.Value }
    }
    return $ordered
}

function Invoke-PathRewrite {
    <#
      Streams a text file line by line, replacing every variant of the old path
      with the matching variant of the new one. Streaming keeps memory flat even
      on a multi-hundred-MB history file.
      Returns the number of replacements made. Writes nothing when -WhatIfOnly.
    #>
    param(
        [string]$FilePath,
        [string]$Old,
        [string]$New,
        [switch]$WhatIfOnly
    )

    $oldV = Get-PathVariants $Old
    $newV = Get-PathVariants $New
    $count = 0

    $tmp = "$FilePath.tmp.$PID"
    # UTF8 WITHOUT BOM - a BOM here can break Claude Code's parser.
    $enc = New-Object System.Text.UTF8Encoding($false)

    $reader = New-Object System.IO.StreamReader($FilePath, $enc)
    $writer = $null
    if (-not $WhatIfOnly) {
        $writer = New-Object System.IO.StreamWriter($tmp, $false, $enc)
    }

    try {
        while ($null -ne ($line = $reader.ReadLine())) {
            foreach ($key in $oldV.Keys) {
                $o = $oldV[$key]
                $n = $newV[$key]
                # Never substitute with null: that would delete the path instead.
                if ([string]::IsNullOrEmpty($n)) { continue }
                if ($o -ne $n -and $line.Contains($o)) {
                    # Count occurrences before replacing.
                    $count += ([regex]::Matches($line, [regex]::Escape($o))).Count
                    $line = $line.Replace($o, $n)
                }
            }
            if ($writer) { $writer.WriteLine($line) }
        }
    }
    finally {
        $reader.Dispose()
        if ($writer) { $writer.Dispose() }
    }

    if ($WhatIfOnly) {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    }
    else {
        Move-Item -LiteralPath $tmp -Destination $FilePath -Force
    }

    return $count
}

# ------------------------------------------------------------------ setup ----

$Old = Get-NormalizedPath $OldPath
$New = Get-NormalizedPath $NewPath

$OldSlug = Get-ClaudeSlug $Old
$NewSlug = Get-ClaudeSlug $New

$ClaudeDir = $env:CLAUDE_CONFIG_DIR
if ([string]::IsNullOrWhiteSpace($ClaudeDir)) {
    $ClaudeDir = Join-Path $env:USERPROFILE '.claude'
}

$OldSessions = Join-Path (Join-Path $ClaudeDir 'projects') $OldSlug
$NewSessions = Join-Path (Join-Path $ClaudeDir 'projects') $NewSlug
$History     = Join-Path $ClaudeDir 'history.jsonl'
$ClaudeJson  = Join-Path $env:USERPROFILE '.claude.json'

Write-Host ''
Write-Host 'Rename project + migrate Claude Code history' -ForegroundColor White
Write-Host ('-' * 52) -ForegroundColor DarkGray
Write-Host "  from : $Old"
Write-Host "  to   : $New"
Write-Host "  slug : $OldSlug"
Write-Host "      -> $NewSlug"
Write-Host "  claude dir : $ClaudeDir"
if ($DryRun) { Write-Host '  (DRY RUN - nothing will change)' -ForegroundColor Yellow }
Write-Host ''

# ----------------------------------------------------------- safety checks ----

if (-not (Test-Path -LiteralPath $Old -PathType Container)) {
    throw "Source folder does not exist: $Old"
}
if (Test-Path -LiteralPath $New) {
    throw "Destination already exists: $New"
}
if (Test-Path -LiteralPath $NewSessions) {
    throw @"
Session directory for the new path already exists:
  $NewSessions
Merge or remove it first - this script will not overwrite sessions.
"@
}

# Claude Code holds session lock files and may rewrite state on exit.
$running = @(Get-Process -Name 'claude', 'Claude' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) {
    Write-Warn "A Claude process is running (PID: $($running.Id -join ', '))."
    Write-Warn 'Quit Claude Code (CLI and desktop app) before migrating.'
    if (-not $DryRun -and -not $Force) {
        $reply = Read-Host '    Continue anyway? [y/N]'
        if ($reply -ne 'y' -and $reply -ne 'Y') { Write-Host 'Aborted.'; return }
    }
    Write-Host ''
}

if (-not $DryRun -and -not $Force) {
    Write-Host 'This will move the folder and rewrite Claude Code state.' -ForegroundColor Yellow
    $reply = Read-Host 'Proceed? [y/N]'
    if ($reply -ne 'y' -and $reply -ne 'Y') { Write-Host 'Aborted.'; return }
    Write-Host ''
}

# If we are running from inside the folder about to move, step out of it first.
$here = (Get-Location).Path
if ($here -eq $Old -or $here.StartsWith($Old + '\', [StringComparison]::OrdinalIgnoreCase)) {
    $parent = Split-Path -Parent $Old
    Write-Info "Current directory is inside the project; moving to $parent"
    if (-not $DryRun) { Set-Location -LiteralPath $parent }
}

$stamp = Get-Date -Format 'yyyyMMddHHmmss'

# ------------------------------------------------------------ 1. backups ----

Write-Step '1. Backing up Claude Code state'

foreach ($f in @($History, $ClaudeJson)) {
    if (Test-Path -LiteralPath $f) {
        $bak = "$f.bak.$stamp"
        if ($DryRun) { Write-Info "would copy $f -> $bak" }
        else {
            Copy-Item -LiteralPath $f -Destination $bak -Force
            Write-Ok "backed up $(Split-Path -Leaf $f) -> $(Split-Path -Leaf $bak)"
        }
    }
    else {
        Write-Info "not found, skipping: $f"
    }
}

# ------------------------------------------------- 2. move project folder ----

Write-Step '2. Moving the project folder'
if ($DryRun) { Write-Info "would move $Old -> $New" }
else {
    Move-Item -LiteralPath $Old -Destination $New
    Write-Ok "moved to $New"
}

# ---------------------------------------------- 3. move session directory ----

Write-Step '3. Moving the session directory (transcripts, subagents, tool-results, memory)'
if (Test-Path -LiteralPath $OldSessions -PathType Container) {
    $n = @(Get-ChildItem -LiteralPath $OldSessions -Filter '*.jsonl' -ErrorAction SilentlyContinue).Count
    $hasMemory = Test-Path -LiteralPath (Join-Path $OldSessions 'memory')
    Write-Info "$n transcript file(s)$(if ($hasMemory) { ', plus auto-memory' })"
    if ($DryRun) { Write-Info "would move $OldSessions -> $NewSessions" }
    else {
        Move-Item -LiteralPath $OldSessions -Destination $NewSessions
        Write-Ok "moved to $NewSessions"
    }
}
else {
    Write-Info "no session directory at $OldSessions - nothing to move"
}

Write-Info 'file-history/ is keyed by session id, not path - nothing to do there'

# ------------------------------------------------- 4. rewrite history.jsonl ----

Write-Step '4. Rewriting path references in history.jsonl'
if (Test-Path -LiteralPath $History) {
    $n = Invoke-PathRewrite -FilePath $History -Old $Old -New $New -WhatIfOnly:$DryRun
    if ($DryRun) { Write-Info "would rewrite $n occurrence(s)" }
    else         { Write-Ok "rewrote $n occurrence(s)" }
}
else {
    Write-Info 'history.jsonl not found - skipping'
}

# --------------------------------------------------- 5. rewrite .claude.json ----
# Holds a per-project config object keyed by absolute path. Rewriting it keeps
# that project's settings attached. This file also carries auth state, so it is
# validated as JSON before being written, and restored from backup if invalid.

Write-Step '5. Rewriting the per-project key in .claude.json'
if (Test-Path -LiteralPath $ClaudeJson) {
    $variants = Get-PathVariants $Old
    $raw = [System.IO.File]::ReadAllText($ClaudeJson)

    $hits = 0
    foreach ($key in $variants.Keys) {
        $hits += ([regex]::Matches($raw, [regex]::Escape($variants[$key]))).Count
    }

    if ($hits -eq 0) {
        Write-Info 'no references to the old path - skipping'
    }
    elseif ($DryRun) {
        Write-Info "would rewrite $hits occurrence(s)"
    }
    else {
        $newV = Get-PathVariants $New
        $out = $raw
        foreach ($key in $variants.Keys) {
            $n = $newV[$key]
            if ([string]::IsNullOrEmpty($n)) { continue }
            if ($variants[$key] -ne $n) {
                $out = $out.Replace($variants[$key], $n)
            }
        }

        $valid = $true
        try { $null = $out | ConvertFrom-Json } catch { $valid = $false }

        if ($valid) {
            $enc = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($ClaudeJson, $out, $enc)
            Write-Ok "rewrote $hits occurrence(s), JSON validated"
        }
        else {
            Write-Warn 'result was not valid JSON - .claude.json left unchanged.'
            Write-Warn "Backup is at $ClaudeJson.bak.$stamp"
        }
    }
}
else {
    Write-Info '.claude.json not found - skipping'
}

# ------------------------------------------------------------------- done ----

Write-Host ''
Write-Host ('-' * 52) -ForegroundColor DarkGray
if ($DryRun) {
    Write-Host 'Dry run complete. Nothing was changed.' -ForegroundColor Yellow
    Write-Host 'Re-run without -DryRun to apply.'
}
else {
    Write-Host 'Done.' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Verify before deleting the backups:' -ForegroundColor White
    Write-Host "  cd `"$New`"" -ForegroundColor DarkGray
    Write-Host '  claude --resume' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host 'Transcript lines still carry a historical ''cwd'' pointing at the old path.'
    Write-Host 'Listing and resume key off the directory, so this should be harmless - but'
    Write-Host "confirm one session resumes before removing the .bak.$stamp files."
    Write-Host ''
    Write-Host 'Note: the desktop app''s session list is account-scoped and separate from the' -ForegroundColor DarkGray
    Write-Host 'CLI''s. If sessions are missing in the app but present via ''claude --resume'',' -ForegroundColor DarkGray
    Write-Host 'that is a known app limitation, not a failure of this migration.' -ForegroundColor DarkGray
}
Write-Host ''
