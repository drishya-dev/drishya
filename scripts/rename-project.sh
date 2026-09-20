#!/usr/bin/env bash
# Rename a project folder and carry its Claude Code history across.
#
# POSIX ONLY - macOS and Linux. On Windows use scripts/Rename-Project.ps1.
#   Under WSL this script cannot see Windows paths: bash resolves C:/... as a
#   literal relative path that does not exist, so the source check fails before
#   anything runs. WSL would need /mnt/c/... while Claude Code's slug is built
#   from the native C:\... path, so the two cannot agree. The PowerShell script
#   avoids the translation entirely.
#
# Claude Code keys sessions to the project's absolute path, encoded by replacing
# / \ : and . with -. Rename the folder alone and the sessions are orphaned:
# still on disk, but the app computes a different slug and never looks there.
#
# This moves the folder AND the things keyed to its path, together.
#
# Usage:  ./scripts/rename-project.sh <old-abs-path> <new-abs-path>
# Dry run: DRY_RUN=1 ./scripts/rename-project.sh <old> <new>
#
# Verified against Claude Code's documented storage layout, Sep 2026.
# See docs/BLUEPRINT.md Appendix A2.

set -euo pipefail

OLD="${1:?usage: rename-project.sh <old-abs-path> <new-abs-path>}"
NEW="${2:?usage: rename-project.sh <old-abs-path> <new-abs-path>}"
DRY="${DRY_RUN:-0}"

run() {
  if [[ "$DRY" == "1" ]]; then
    printf '  would run: %s\n' "$*"
  else
    "$@"
  fi
}

# Claude Code's path encoding: / \ : . all become -
slug() { printf '%s' "$1" | sed -e 's|[/\\:.]|-|g'; }

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
OLD_SLUG="$(slug "$OLD")"
NEW_SLUG="$(slug "$NEW")"
OLD_SESSIONS="$CLAUDE_DIR/projects/$OLD_SLUG"
NEW_SESSIONS="$CLAUDE_DIR/projects/$NEW_SLUG"
HISTORY="$CLAUDE_DIR/history.jsonl"

echo "Renaming project"
echo "  from : $OLD"
echo "  to   : $NEW"
echo "  slug : $OLD_SLUG"
echo "      -> $NEW_SLUG"
[[ "$DRY" == "1" ]] && echo "  (DRY RUN — nothing will change)"
echo

# ---- checks before touching anything -----------------------------------------

[[ -d "$OLD" ]] || { echo "error: source folder does not exist: $OLD" >&2; exit 1; }
[[ -e "$NEW" ]] && { echo "error: destination already exists: $NEW" >&2; exit 1; }
[[ -e "$NEW_SESSIONS" ]] && {
  echo "error: session dir for the new path already exists:" >&2
  echo "       $NEW_SESSIONS" >&2
  echo "       Merge or remove it first — this script will not overwrite sessions." >&2
  exit 1
}

# Close Claude Code first: it holds session lock files and may rewrite them on exit.
if pgrep -f "claude" >/dev/null 2>&1; then
  echo "warning: a 'claude' process appears to be running."
  echo "         Quit Claude Code (CLI and desktop app) before migrating, then re-run."
  read -r -p "         Continue anyway? [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]] || exit 1
  echo
fi

# ---- 1. back up the history index --------------------------------------------

if [[ -f "$HISTORY" ]]; then
  BACKUP="$HISTORY.bak.$(date +%Y%m%d%H%M%S)"
  echo "1. backing up history index -> $BACKUP"
  run cp "$HISTORY" "$BACKUP"
else
  echo "1. no history.jsonl found, skipping backup"
fi

# ---- 2. move the project folder ----------------------------------------------

echo "2. moving project folder"
run mv "$OLD" "$NEW"

# ---- 3. move the session directory -------------------------------------------
# Carries transcripts, each session's subagents/ and tool-results/, and memory/.
# ~/.claude/file-history/ is keyed by session id, not path — it needs nothing.

if [[ -d "$OLD_SESSIONS" ]]; then
  echo "3. moving session directory (transcripts, subagents, tool-results, memory)"
  run mv "$OLD_SESSIONS" "$NEW_SESSIONS"
else
  echo "3. no session directory at $OLD_SESSIONS — nothing to move"
fi

# ---- 4. rewrite path references in the history index -------------------------

if [[ -f "$HISTORY" ]]; then
  echo "4. rewriting path references in history.jsonl"

  # history.jsonl is JSON, so a Windows path is stored with doubled backslashes.
  # Match both that and the raw form, so this works on Windows, macOS and Linux.
  OLD_J="${OLD//\\/\\\\}"
  NEW_J="${NEW//\\/\\\\}"

  # perl, not python3: Git Bash ships perl and does NOT ship a `python3` alias.
  # Literal (\Q..\E) substitution, so nothing in the path is read as a regex.
  PERL_PROG='
    my ($oj,$nj,$o,$n,$dry) = @ARGV[0..4];
    local $/; my $t = <STDIN>; my $c = 0;
    $c += ($t =~ s/\Q$oj\E/$nj/g);
    $c += ($t =~ s/\Q$o\E/$n/g) if $oj ne $o;
    if ($dry) { print STDERR "   would rewrite $c occurrence(s)\n"; }
    else      { print STDERR "   rewrote $c occurrence(s)\n"; print $t; }
  '
  if [[ "$DRY" == "1" ]]; then
    perl -e "$PERL_PROG" "$OLD_J" "$NEW_J" "$OLD" "$NEW" 1 < "$HISTORY" > /dev/null
  else
    TMP="$HISTORY.tmp.$$"
    perl -e "$PERL_PROG" "$OLD_J" "$NEW_J" "$OLD" "$NEW" 0 < "$HISTORY" > "$TMP"
    mv "$TMP" "$HISTORY"
  fi
fi

echo
echo "Done."
echo
echo "Verify before deleting the backup:"
echo "  cd \"$NEW\" && claude --resume"
echo
echo "Transcript lines still carry a historical 'cwd' pointing at the old path."
echo "Listing and resume key off the directory, so this should be harmless — but"
echo "confirm one session resumes before removing $HISTORY.bak.*"
echo
echo "Note: the desktop app's session list is account-scoped and separate from the"
echo "CLI's. If sessions are missing in the app but present via 'claude --resume',"
echo "that is a known app limitation, not a failure of this migration."
