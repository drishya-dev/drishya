# Windows antivirus attribution audit

## 17 October deeper static assessment — updater is the leading explanation

The builder asked to assess threat rather than assume that an assistant knows the purpose of a separate process. Additional read-only checks establish:

- Windows Authenticode verification of the actual managed0.160.0 `codex.exe` reports **Valid**, signed by **OpenAI OpCo, LLC**. This supports executable origin/integrity; it does not certify every script it downloads or every child command.
- Static inspection of that executable finds the exact observed stdin/`Invoke-Expression` wrapper adjacent to updater-specific error strings, the official `https://chatgpt.com/codex/install.ps1` URL and installer settings including `CODEX_INSTALL_DAEMON_ONLY`, `CODEX_INSTALL_DEFER_SELECTION`, `CODEX_INSTALL_IF_LATEST` and `CODEX_INSTALL_IF_CURRENT`.
- The old runtime includes a separate managed updater process. Its09:16:37 start precedes the09:21:38 wrapper by about five minutes; previous18:17 starts similarly precede18:22 detections. This timing supports the updater hypothesis but is not a fresh process-parent trace for the morning detection.
- The [currently published official installer](https://releases.openai.com/codex/install.ps1), read through the web tool without execution, resolves Codex release assets and verifies downloaded archive SHA-256 digests. This is a reference to what the updater is designed to fetch, **not a recovered byte-for-byte copy of the blocked memory payload**.
- Available PowerShell4104 events did not supply the blocked script body for the morning interval. The McAfee record has no useful payload hash or backing file to compare.

**Assessment:** a legitimate managed-updater/antivirus compatibility conflict is now the leading explanation. There is no evidence from this investigation identifying a Drishya-origin malicious script. However, the exact blocked bytes and McAfee's internal classification rationale remain unavailable, so a confirmed false positive or "safe to allow" verdict would overstate the evidence. A signed parent alone cannot prove a child payload benign. No quarantined content was restored or executed.

Automatic approval review rejected a command that would download an installer reference for static reading; it reported only "blocked by policy". The safer web read succeeded. No installer was executed, no alternate executable download method was used, and no security settings were weakened. The separate supported native updater remains an idle-time remediation candidate, not a proven cure. If its normal update path encounters the same block, retain the error and use the sanitized vendor route rather than forcing execution or adding exclusions.

## 17 October recurrence and separate managed-runtime update

McAfee appended detections on16 October at22:22:21 IST and17 October at09:21:40 IST. Both retain `Real Protect-PSFL!DC98AC2364A0`, a136,350-byte in-memory Windows PowerShell target and no backing file/hash. Windows PowerShell event400 records the same stdin/`Invoke-Expression` wrapper at09:21:38, PID20976, approximately two seconds before the morning detection. That process has exited; its new parent chain was not retained, so this is a matching recurrence, not fresh definitive parent attribution or a verified false positive.

Read-only process inspection now establishes that the global npm CLI launched two managed0.160.0 app-server processes at09:16:37, while newer desktop executables are also present. The managed `current` link and `auto-update-version` both still point to0.160.0. The installed CLI's supported diagnostic confirms:

```json
{"status":"running","managedCodexVersion":"0.160.0","cliVersion":"0.163.0","appServerVersion":"0.160.0"}
```

This explains why updating the desktop app or CLI alone did not establish removal of the older managed runtime. It does not reveal the blocked script contents or prove the latest launch's parent.

The locally installed CLI help exposes a supported, separate package update:

```powershell
codex app-server daemon version
codex app-server daemon update
codex app-server daemon version
```

**Run the update only after active native work has finished.** Its own help explicitly says it may interrupt running work. This audit did not run it, replace cached binaries, change native configuration or terminate sessions. `--from-cli` exists but copies/pins the CLI package; it is not required for the normal updater and is not the recommended default here. Do not turn off protection or add exclusions.

After updating, verify that the reported running app-server version actually changed, use the harness normally across at least two previously observed hourly intervals, and compare new detection timestamps/process attribution. A newer version is a remediation candidate, not evidence of an antivirus fix. If alerts recur, use a sanitized runtime report through the [official feedback route](https://learn.chatgpt.com/docs/reference/troubleshooting#feedback-and-logs), reviewing any logs before sharing. No report/upload was sent. The report should include the managed/CLI version mismatch, detection signature/size/times, prior captured parent attribution and fresh event400 correlation; exclude personal paths, prompts and journals.

Drishya's inspected controller/native executable/capture scripts still contain no matching PowerShell wrapper launch. No product-side patch can honestly be claimed as repairing this separately managed runtime. Keep Windows packaged/native antivirus acceptance in the release matrix.

## 16 October recurrence

Read-only inspection finds four new detections at **18:22:08,19:22:12,20:22:15,21:22:18 IST**. They name `Real Protect-PSFL!DC98AC2364A0`, Windows PowerShell5.1 and a136,350-byte in-memory target, with no backing file/hash. This is a changed payload/signature from the88,248-byte October8 record, not proof that the earlier payload was fixed.

Windows PowerShell event400 records the same stdin/`Invoke-Expression` host wrapper at18:22:06 and21:22:16, approximately two seconds before the matching alerts. The old managed Codex app-server `0.160.0` is running again, started18:17, alongside newer Codex executables. The earlier audit directly attributed that wrapper to the managed app-server; **fresh parent-process attribution was not available from retained Security4688 events**, so this recurrence is a strong match, not a new definitive process-parent trace. Payload contents and false-positive status remain unverified.

The production Drishya daemon/packages/scripts contain no launch of PowerShell, `Invoke-Expression`, `ExecutionPolicy Bypass` or encoded command. The adapter's PowerShell mentions only recognize captured command text. Running Corepack/pnpm in the background does not establish that it caused these detections. No evidence here identifies Drishya's packaged launcher as the origin, and changing its UI/ingestion cannot repair an external runtime's periodic script.

Keep protection enabled. The next actionable diagnosis is a fresh process-parent trace at a recurrence or review by the runtime/security vendor using sanitized metadata, then rerun the packaged/native acceptance matrix. Do not execute the blocked payload, disable protection, add broad exclusions, upload private data or automatically terminate either coding session. No external report or host configuration change was made. The older supported escalation links below remain references, not evidence that an update fixes this recurrence.

8 October 2026. Builder supplied a local McAfee detection log and requested identifying whether development or the shipped product causes recurring script alerts. Host checks are read-only. No antivirus exclusions, policy changes, quarantine restoration or uploads were performed. Raw host logs and script contents are not committed.

## Established evidence

- The supplied file is a detection record, not a script that pushes alerts. Initially it contained 28 records: two April detections of another project's CMake compiler-probe binaries and 26 October detections named `Real Protect-PSFL!A9CD92EAEB70`.
- October records name Windows PowerShell 5.1 (`powershell.exe`), sensor `IAntiMalware`, and an in-memory target of 88,248 bytes with no backing file. They do not supply script text, a useful file hash, a PID or a parent process. The repeated signature/size does not prove that every command has identical contents, nor establish benignness or infection independently of the antivirus verdict.
- The six 8 October records available at the start of the audit occurred 1.61–2.81 seconds after Windows PowerShell event 400 recorded a process executing a standard-input wrapper: `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command try { Invoke-Expression ([Console]::In.ReadToEnd()) } catch { Write-Error $_; exit 1 }`. This is a strong timing correlation, not parent attribution. The alert times were 16:57:32 through 21:57:47 IST, roughly hourly. Source timestamps are UTC; preserve the timezone when parsing. Casting an already parsed UTC DateTime to a string and reparsing drops the offset.
- Available script-block events did not expose the blocked payload; available process-creation audit records did not identify its parent. Unrelated PowerShell WMI polling also exists on this machine and must not be conflated with the detected wrapper.

## Captured parent attribution

A bounded read-only process trace caught the next wrapper launch at 22:57:49 IST. PowerShell PID 7848 had parent PID 44580, `codex.exe`, running from the Codex-managed `app-server-daemon/releases/0.160.0-x86_64-pc-windows-msvc/bin` directory. Windows event 400 independently records PID 7848 launching that same stdin wrapper at 22:57:48.753. McAfee appended the matching signature/size at 22:57:50.552. The builder's 22:57 screenshot matches this observed event. The parent process was an app-server, not the controller's `--stdio` invocation.

This identifies the launch source of that event as the Codex-managed app-server. It does not identify the private script contents, establish a false positive, or retroactively prove parent attribution for all previous alerts. An already-running terminal/Corepack/pnpm server is not the parent of this particular blocked wrapper. No Drishya code change can honestly be presented as fixing an external daemon's script behavior. Preserve this as an upstream diagnostic, with no antivirus weakening or native binary/configuration modification. Connected users may still encounter a native-harness antivirus conflict and need clear diagnostics.

## Product code audit

The controller resolves native executable files and launches them with argument arrays, `shell: false`, hidden windows and stdio pipes. It does not execute captured shell text or wrap submitted prompts in PowerShell. Passive capture reads journals. The Windows browser launcher uses `cmd /c start` to open a local URL, not an in-memory PowerShell wrapper. Source inspection found no matching wrapper or hourly PowerShell/scheduled-task installation in Drishya. Native harnesses may themselves invoke shell tools under their own permissions; that is a separate child boundary.

The actual packaged CLI verification passed during this audit: isolated offline installation, synthetic Claude/Codex imports, demo bundle, authenticated API and persisted restart. The supplied detection log had no new record during that test. This observation is not broad antivirus certification and does not test every agent-generated command or native installer.

## Release handling

Keep a Windows antivirus acceptance check before publication: packaged launch/import/live observation, opted-in native turn and installer/CLI discovery, with actual detected process and parent attribution if an alert occurs. If our own launcher is identified, fix that launch path and rerun. If a native harness/development environment is identified, document the boundary and supported setup; do not change protection policy as a workaround. If a verified clean distributable is misclassified, use [McAfee's detection dispute process](https://www.mcafee.com/en-us/consumer-support/dispute-detection-allowlisting.html) with the user's explicit approval for any external submission. No private journals, credentials, screenshots or prompts should be submitted automatically.

Do not infer a Drishya defect or a false positive from the signature alone. The observed parent attribution establishes Codex-side script launch for the latest event; a supported upstream fix or vendor classification still needs verification. Raw payloads and personal recordings remain private.

## Remediation check — 9 October

Read-only inspection at approximately 20:15 IST finds the installed app at `26.1007.2314.0` (package status `Ok`), with the active native runtime reporting `0.162.0-alpha.17.2`. The previously captured managed `0.160.0` app-server is no longer running. The current app-server started at 20:06:47; the McAfee detection log still ends at 8 October 22:57:50. This is only about nine minutes of the new run, shorter than the observed hourly interval. The newer installation is already present; this audit did not install or update it and does not establish that its version fixes the detection.

The old daemon stderr log also contains repeated model-refresh `401` / `token_revoked` errors. Those are authentication errors on a different cadence; they do not identify the blocked PowerShell payload and must not be presented as its cause. Desktop diagnostics inspected around the old event do not establish the script's purpose. Do not patch cached executables, disable sandbox setup, change execution policy, delete the Codex home, or add antivirus exclusions as a speculative repair.

The next bounded acceptance check is to use the current installation normally across at least two of the previously observed hourly intervals, recording any new alert's timestamp and process chain. If it recurs, compare a period with the desktop app fully exited while the independently started Drishya server stays running; ensure no active native turn is interrupted, and do not indiscriminately kill processes. These are diagnostic comparisons, not a promised permanent fix. No ongoing monitor was installed by this audit.

If the newer runtime still reproduces the alert, the supported escalation is Codex feedback or an upstream issue with a sanitized reproduction. [Official troubleshooting guidance](https://learn.chatgpt.com/docs/reference/troubleshooting#feedback-and-logs) describes feedback/issue reporting and reviewing logs for sensitive information. External submission requires the builder's explicit instruction. McAfee classification review is appropriate only after the actual payload is verified clean; a trusted parent name alone is insufficient.

Sanitized report ready for review:

> Windows 11, Codex desktop package 26.1002.7124.0 and managed app-server 0.160.0: recurring roughly hourly McAfee Real Protect-PSFL!A9CD92EAEB70 detection against an 88,248-byte PowerShell in-memory target. At 2026-10-08 22:57:48.753 IST, Windows event 400 recorded PowerShell PID 7848 executing a stdin/Invoke-Expression wrapper. Live process capture attributed its parent to the Codex-managed app-server PID 44580; McAfee logged the matching detection at 22:57:50.552 IST. This was not Drishya's controller --stdio process or its Corepack/pnpm server. Script contents are unavailable, so false-positive status is unconfirmed. On 9 October the desktop package is 26.1007.2314.0 with runtime 0.162.0-alpha.17.2; recurrence under the newer runtime is not yet established. Please identify the periodic script and supported remediation without disabling antivirus protection.
