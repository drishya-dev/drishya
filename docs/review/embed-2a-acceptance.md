# EMBED-2a — daemon and launcher acceptance

14 November 2026 · PR #497 · `codex/embed-2a`. Contract #496 has merged; latest main and the parallel EMBED-2b claim are included. No UI/example changes or self-merge.

## Delivered

- `drishya embed <recording-id|--latest> [--cwd]`: strict selection, exact canonical checkout filtering, normal sealed import/live following, one private JSON result; fixed, non-echoing error responses. Iframe declarations fail before starting or touching storage.
- Lazy loopback worker on an ephemeral port; one private inherited fd-3 channel per supervisor, bounded framing/queue, serial requests. Reuses only its own worker, never an authority inferred from discovery. Windows overlapped I/O and current-user-only discovery ACLs verified locally; POSIX owner/mode branch implemented but not run on a physical Unix system.
- Random 32-byte launch code, digest-only memory store, recording binding, 60-second lifetime, 32-code cap and atomic one-use exchange. Existing HttpOnly Strict session lifetime/cap/sign-out and all security headers preserved. Normal serve does not enable the new exchange. No public mint endpoint, iframe, CORS, policy or bind relaxation; no new runtime package.
- Bounded stdio MCP `drishya.open_view`; explicit private-host capability, private `_meta` result, cleaned URL in model content, honest unsupported-host result before worker creation. User-installed Claude Code/Codex command/skill and MCP setup/uninstall instructions in [launcher appendix](../guides/embed-launcher.md). No native configuration was edited and no native turn was sent.

## Genuine sessions, scratch home only

All three were discovered/imported through supported adapters into an isolated temporary store, then opened via the new inherited worker/launch exchange and a fresh Strict-cookie browser context at 600 and 1440. Existing session History mounted, authenticated APIs returned 200, zero page errors. Six frames remain only under `.local/embed-2a/real-frames/`. These exercise backend handoff and ordinary session reading, **not** the unmerged EMBED-2b bootstrap/full-screen/narrow UI.

| Harness | Recording prefix | Bytes | Operations | Prose | Frames |
| --- | --- | --- | --- | --- | --- |
| Claude Code | rec_024517cd | 6,292,879 | 426 | 393 | 2 |
| Codex | rec_c777ea7f | 195,035 | 1 | 2 | 2 |
| Antigravity | rec_dd3e2aef | 2,013 | 1 | 2 | 2 |

`pnpm check:real -- questions --pick 1`: Claude 20 matching sessions/68 hits, Codex 3/3; selected cases retain 9/1 native question cards. `antigravity-questions`: 3 matching sessions/3 hits, selected 1 native operation, original provenance retained. No journal content or credentials printed. No imports into the real Drishya home; no use/kill of 7878 or 5180.

## Contract security matrix

| Contract case | Checked here | External coverage |
| --- | --- | --- |
| embed-default-headers | Normal/embedded response headers compared, full literal CSP baseline and DENY asserted | Re-run against any merged SEC-3 cookie/header fix |
| embed-frame-origins | All iframe flag values refused before startup; real Edge rejects same/cross-origin framing at both widths | None for the retained top-level-only policy |
| embed-launch-once | Wrong recording/instance, 60-second expiry, cap/eviction, clear and concurrent consumption | None |
| embed-launch-gate | Host/Origin, JSON type/body limit, malformed data, query/header substitute and invalid credentials refused | SEC-3 integrated suite unmerged |
| embed-discovery-no-secret | Exact metadata keys, owner-only ACL enforcement, no code/token, own-entry orderly cleanup | Physical Linux/macOS mode acceptance not run |
| embed-control-private | No public mint route; strict selectors, bounded/invalid/partial lines; worker reuse and exited-worker cleanup | Reference host integration belongs to 2b |
| embed-cookie-stream | Genuine browser HttpOnly/Strict auth and SSE sync, API reads; idle expiry/sign-out | Combined host refresh/re-entry belongs to 2b |
| embed-controller-boundary | Open is passive; no controller-consent route or native mutation added/called; existing controller behavior unchanged | 2b owns composer eligibility visuals |
| embed-host-secret | MCP model content contains cleaned route, private URL only in negotiated metadata; unsupported clients start nothing | Actual host persistence/console/navigation exclusions belong to 2b |
| embed-refused-modes | Disabled exchange, bad selectors, missing sessions, no matching checkout and every iframe declaration refused | Below-minimum/fullscreen UI belongs to 2b |

Orderly private-channel close removes the discovery entry. An explicit forced Windows parent termination stopped the owned listener but could leave stale **non-secret** metadata, which is never contacted for authentication or used to signal any process. That is not a claim of crash-proof cleanup. The fallback parent watcher never signals another process.

## Validation and merge seams

- Both project typechecks pass; focused daemon/security/MCP units and targeted related units pass (final counts are in the PR).
- Six named Edge browser security cases pass, two workers, zero retries, UI rebuilt. Browser tests assert actual framing refusal via CSP diagnostics and absence of the protected document, rather than assuming Edge's blocked-frame URL.
- `package:verify` passes: isolated offline install, Claude/Codex import, demo, authenticated API and persisted restart. Additional Windows packaged CLI launch from an external directory succeeds, exchanges the code and stops its owned listener. It uses no checkout node_modules.
- `check:affected --dry` selects both types, related units and the whole browser suite because server.ts is wide. The explicit task forbids a full browser gate, so types/related units and the named spec were run separately. No full browser gate or hosted CI dispatched.
- SEC-3 has not merged (`tests/security/` and `test:security` absent on current main). Additive cases live in `apps/daemon/test/embed-security.test.ts`; Fable must run/move them with SEC-3 against the combined embed. This external dependency is not called green.
- Source is Windows-checked only. Physical Linux/macOS, an actual private-capable harness host/MCP UI, 360 px view/fullscreen, the example host and full host persistence guarantee are not claimed; the UI/host portion is EMBED-2b's whole task.
- **SEC-3 merge:** server.ts factors the existing session-issuance block into `issueSession`, without changing its cookie string or expiry/cap logic, and calls it from the additive embed exchange. Preserve SEC-3's cookie-scope/policy fixes inside this shared helper. Security headers and ordinary token exchange semantics were not changed. No edits to tests/security, package.json, harness adapters, schema, palettes or motion.
- **EMBED-2b merge:** bootstrap uses `recording` query plus `#launch`, scrubs immediately, POSTs the code, then normalizes to `?embed=1#/r/<id>`. fd-3 JSON protocol and the MCP private capability are documented in the appendix. The new daemon-owned `tests/browser/embed-security.spec.ts` must be preserved alongside 2b's own embed specs.
