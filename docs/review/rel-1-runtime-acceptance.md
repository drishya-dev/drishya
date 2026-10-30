# REL-1 runtime acceptance — 30 October 2026

This is a bounded readiness check, not completed runtime-remediation acceptance. The TASKS item remains unchecked.

## Verified here

- `codex --version`: selected CLI 0.165.0-alpha.1.2.
- `codex app-server daemon version`: failed with socket error 10050. The running managed-daemon version is **NOT VERIFIED**; the CLI version is not substituted for it.
- Installed `codex app-server daemon update --help` explicitly warns that updating may interrupt running work.
- The previously named antivirus log was first sharing-locked. A shared, read-only retry returned zero readable bytes and zero parsed records. This does not establish sensor coverage, absence of alerts or remediation.
- No update, restart, bootstrap, process termination, antivirus change, configuration/credential edit or external submission occurred.

Official OpenAI guidance also says a daemon update may exit Codex and interrupt work: [Developer commands, Manage the background server](https://learn.chatgpt.com/docs/developer-commands?surface=cli). CLI and desktop versions may differ: [Troubleshooting](https://learn.chatgpt.com/docs/reference/troubleshooting). Installed help establishes the exact local subcommands; the web pages do not prove this host's managed-daemon state.

## Exact remaining gate

After all native work is idle, use the supported normal updater, record managed version before and after, then observe normal operation over at least two previously observed hourly intervals. Compare fresh detection times and actual process attribution. Preserve protection; do not force a blocked installer through an alternate route or infer a false positive from a signed parent.

The update is deliberately deferred while this work is active. A reachable managed control socket and trustworthy fresh detection evidence are still needed. Earlier attribution and its limits remain in [review 38](38-windows-antivirus-audit.md).
