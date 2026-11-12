# CONNECT-4a: exact-checkout grants and connection acknowledgement

Implements the [approved CONNECT-4 decision](connect-4-repository-setup-proposal.md). PR #366; runtime/test freeze `f80c6887`. CONNECT-4b owns the setup sheet and remembered-checkout Settings list. Their look is left to CONNECT-4b and FINISH-4; this task adds only plain checkboxes to Modern's existing approval controls, using their existing presentation.

## Behaviour and boundaries

- Reading consent remains explicit. Modern's Files approval and composer connection menu offer **Remember for this checkout**, checked by default. API callers that omit `remember` retain temporary consent; no approval elsewhere becomes persistent invisibly.
- Remembered grants live in Drishya's existing SQLite `meta` table, under a versioned namespace. There is no store schema migration, event-schema change, captured body, credential or native policy saved here. Metadata passes redaction before persistence; a redaction mismatch refuses remembering.
- A grant proves the canonical root, filesystem directory identity (device, inode and birth time), the owning checkout, its Git administration directory, and its common repository directory. Missing, replaced, redirected, conflicting or unprovable identities fail closed and remove the saved grant. A normal file edit or Git HEAD change does not change directory identity. Directory-only workspaces can also be remembered exactly; they never generate a same-repository sibling signal.
- Siblings share only a validated Git common-directory identity. An approved sibling produces `siblingApproved: true`, never reading permission. This is CONNECT-4b's pre-fill signal.
- Revoke removes durable and active reading permission for that exact checkout, including other selected sessions using it. Epoch checks invalidate pending approval and reads, including revoke followed immediately by reapproval. Existing exact-image consent remains separate. Captured historical content and existing graph/cross-worktree evidence boundaries remain unchanged.
- The idle-other-clients acknowledgement belongs to the selected-session connection in memory. Successful sends, editing a draft, attachments, model/effort changes and composer collapse preserve it. Reload, leaving that session, SSE disconnect, unavailable/failed controller, revoked reading consent or submission failure clear it. It is never restored from a remembered checkout. Every native submission still carries the existing explicit `exclusive: true` condition; native approvals and questions remain request-specific.

## API for CONNECT-4b

All routes retain the daemon's existing authentication and origin checks. Roots are derived from selected recordings, never accepted as arbitrary request paths.

| Route | Result |
| --- | --- |
| `GET /v1/recordings/:id/workspace` | Validated/restored `approved`, `root`, `scope`, `remembered` |
| `POST /v1/recordings/:id/workspace/approve` | Body `{remember: boolean}`; omitted means temporary; approving again changes the choice |
| `POST /v1/recordings/:id/workspace/revoke` | Clears temporary and remembered consent for that exact checkout |
| `GET /v1/recordings/:id/workspace/setup` | Workspace state, current validated `identity` or a factual `reason`, `siblingApproved`, and native readiness; joined recordings are refused |
| `GET /v1/checkout-grants` | `{items}` with validated grant ID, root, identity and creation time; no journal content |
| `DELETE /v1/checkout-grants/:grantId` | Revokes a remembered checkout and its active reads; grant IDs are opaque SHA-256 keys |

Setup's `native` reports `available`, `signedIn`, `supported`, `state` and an optional `reason`. States are `ready`, `missing`, `signed-out`, `unsupported`, `unavailable`; unknown sign-in/support values are `null`, not invented booleans. Bounded metadata-only CLI help/auth commands use argument arrays, `shell: false`, hidden windows, no stdin and a neutral Drishya data directory. They never resume a session or submit a prompt. Account output is discarded; only allowlisted readiness fields escape. Concurrent checks of one harness share the in-flight check; a later check is fresh so signing in can take effect.

The remembered list is capped at 128 entries, with explicit failure rather than silent eviction. Identity metadata reads are bounded. This is local reading consent, not a native sandbox grant.

## Acceptance: genuine sessions

Four fresh native sessions were made in a throwaway Git repository and its linked worktree, without weakening native policy. Imported through the normal redacting ingest into scratch Drishya homes. No real Drishya home, native configuration, credentials or journals were edited. Journal text and images are not committed; manifests, screenshots and detailed diagnostics remain in `.local/connect4-real/`.

| Harness | Main session | Sibling session | Widths | Main journal bytes after lifetime checks |
| --- | --- | --- | --- | --- |
| Codex | `rec_5070b9af` | `rec_6643a5a6` | 600, 1440 | 422,150 |
| Claude Code | `rec_008a970d` | `rec_ea4a2e7b` | 600, 1440 | 341,584 |

Each of the four harness/width combinations checked:

- [x] Default-checked Remember and explicit approval; a genuine daemon/App restart restores the grant and shows no read prompt.
- [x] The genuine sibling session has no grant and does report pre-fill eligibility.
- [x] Revocation clears the remembered grant and shows approval again.
- [x] Missing root, replacement directory, and replacement Git identity refuse restoration; returning the original does not resurrect the grant. These mutations affect only the throwaway checkout, restored after each case.
- [x] First send asks for acknowledgement; a second genuine native turn after exercising the native model/effort controls does not ask again. Reload asks again. The regression fixture additionally switches to different model and effort values.
- [x] A genuine native turn followed by browser offline/online forces a new acknowledgement, without submitting the test draft.
- [x] Captured history stays readable while current reading is denied. The lifetime run retains 34/36 Codex and 48/52 Claude timeline entries across its two widths, without changing them during identity failures.

Installed native CLIs: Codex `0.167.0-alpha.3.2`, Claude Code `2.1.316`; both genuine setup checks report signed-in and supported. Missing, signed-out, unsupported and timed-out responses are fault cases tested with isolated resolver/CLI subprocess fixtures, not by signing the user's actual accounts out or changing their installations. Metadata-only argv are asserted; no turn is submitted by readiness checks. This distinction is intentional.

`pnpm check:real -- workspace-files --max-mb 20 --pick 1` independently imported real existing recordings into its disposable scratch home: Claude `rec_39af3c94` (14.5 MB, 747 operations, 46 file references) and Codex `rec_7cb1cda1` (15 MB, 1,115 operations, 25 file references). Counts only were printed.

## Verification

- Both project typechecks pass.
- 73 focused daemon units pass: 21 new identity, lifetime, API and native-readiness cases plus 52 existing controller, workspace and multi-root guards.
- 20 Edge browser checks pass across `checkout-connection.spec.ts` and `connected-workspace.spec.ts`, requested with three workers and zero retries (two independent specs). Includes repeat send/model/effort, reload, runtime failure, offline/reconnect, revoke, existing attachment/approval/question and current-file reading behaviour.
- Six additional focused desktop checks pass after the broad gate found a temporary-grant lifetime regression and an outdated per-send confirmation assumption in the typography helper. The new unit keeps two same-checkout temporary readers approved until an explicit revoke; the helper now accepts direct second sends. The failed initial gate was stopped, retained locally and restarted after fixing both causes.
- Final isolated gate at `f80c6887`, own frozen install, Edge, `DRISHYA_WORKERS=3`: **`check:affected`, all units and `package:verify` exit 0**. Both typechecks/build pass; related units **283 passed / one existing skip**; full units **1,253 passed / one existing skip**; browsers **664 parallel + 33 serial = 697 passed / 28 existing skips / zero failures or retries**. Package verification passes the isolated offline install, both harness imports, demo export, authenticated API and persisted restart. `check:affected` selects the complete browser command because server/API are shared; that is this batch's full browser run. Final completion changes only documentation and trailing empty lines in two test files, with no runtime/test-behaviour change.

CONNECT-4a does not close CONNECT-4: CONNECT-4b still supplies the one-click first-open sheet and Settings presentation, after its overlay prerequisite. Other-builder review and squash merge remain separate.
