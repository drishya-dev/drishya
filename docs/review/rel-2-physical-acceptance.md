# REL-2 physical acceptance readiness — 30 October 2026

The task remains unchecked. Physical lower-resource/lower-core, macOS and Linux acceptance are **NOT VERIFIED**. Harsh confirmed on 30 October that only the current Windows host is available; the missing-device cases are externally blocked.

The currently measured Windows host has 14 physical cores, 20 logical processors and 23.71 GiB RAM (read-only CIM inventory). It is the available reference host, not a substitute for a lower-resource device. Available project executors are local to this Windows host. CPU throttling, browser viewport emulation, virtual limits or hosted package CI cannot certify the missing physical environments.

## Execute after the final candidate is selected

For each actual Windows/macOS/Linux and lower-resource/lower-core machine, record OS, CPU/core count, RAM, GPU/fallback, Node and commit. Use an independent frozen install. Run package verification, native scratch imports and the existing real-session checks; retain only prefixes, bytes and counts. Measure the roadmap's actual large-repository and long-session workloads with the existing measurement tools; record each raw numeric run and the machine/resource state.

Use real keyboard/mouse/trackpad input and the existing GPU-off fallback. Check real Claude and Codex sessions at 600 and 1440 px. Browser suites and benchmarks run one at a time under the root lease. Run physical checks on the same finished candidate; earlier reference-machine measurements remain historical evidence, not a new pass.

MAC-1's [run packet](mac-1-acceptance.md) covers the Mac subset. FILES-5 also needs a genuine case-insensitive POSIX volume, permitted file symlinks and physical recovery behavior. Report unavailable devices explicitly instead of emulating a pass.
