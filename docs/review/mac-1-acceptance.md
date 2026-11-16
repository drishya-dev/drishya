# MAC-1 physical macOS handoff — 30 October 2026

MAC-1 remains **NOT VERIFIED** and unchecked. This report prepares a reproducible run; it does not certify macOS. Harsh confirmed on 30 October that only the current Windows host is available.

## Available executor

This chat's execution host reports Windows 11 Home Single Language, version 10.0.26300, 64-bit, 14 physical cores, 20 logical processors and 23.71 GiB RAM. The available project inventory contains eight projects, all on host `local`; no macOS executor is available through that inventory. This says nothing about machines the builders may own outside this chat.

## Run on the actual Mac

Use a dedicated checkout of the final reviewed candidate and its own frozen install. Record candidate commit, macOS version, chip, Node version and volume case sensitivity. Do not copy node_modules from Windows.

```sh
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
pnpm check:real -- workspace-files --max-mb 10
pnpm exec vitest run apps/ui/test/draft-recovery.test.ts apps/ui/test/draft-recovery-filesystem.test.ts
pnpm package:verify
pnpm test:browser
```

These commands and paths are verified against this repository; their macOS outcomes have not been run here. Run browser suites serially and rebuild the UI before acceptance. Keep native data local; report only source/session prefixes, sizes and counts.

On genuine local Claude Code and Codex sessions at 600 and 1440 px, inspect approved Files/current reading, Workspace, native controller consent, notifications, fonts, scrolling and local file links. Exercise an actual case-insensitive POSIX volume, permitted file symlinks and encrypted draft download/reload/unlock/restore with the refusal cases from [FILES-5](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#files-5-whole-acceptance). A hosted macOS package job does not replace physical GUI, native-session or volume acceptance.

Record every failure as its own TASKS item, with command, counts and sanitized evidence. Screenshots stay in ignored local storage. Feed actual recovery outcomes back to FILES-5 and actual hardware outcomes to REL-2. The final candidate commit will be selected only after the local feature/batch gate.
