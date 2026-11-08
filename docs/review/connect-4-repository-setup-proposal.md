# CONNECT-4 — repository setup before entering a session

7 November 2026 · **Proposal only, awaiting the builders' decision. Nothing below is implemented.**

## What FILES-13 established

The wrong root entries came from unlocated search output being combined with the repository tree. They were not caused simply by waiting for workspace approval: captured entries stayed in the union even after approval. Genuine Drishya Claude captures contained 50 / 133 such basenames. Recorded worktree labels also lost their distinguishing parent directories. [FILES-13 #364](https://github.com/drishya-dev/drishya/pull/364) fixes those display/evidence problems independently of permissions.

Onboarding therefore does not repair file locations and must never guess them. It can still improve the repeated in-session consent experience that prompted CONNECT-4.

An important existing boundary remains: a recording containing multiple roots has a files-only graph; approval does not turn unrelated worktrees into the primary repository's current files. Existing `workspace-main-root-aliases.test.ts` checks this deliberately. This proposal preserves that behaviour; a new primary-inventory model would require its own decision and task.

## Recommended first-open behaviour

After the user selects a session whose repository has not been set up, show one setup step before entering it. Discovery, ingestion and passive capture continue independently while the user chooses. The setup identifies the exact recorded checkout and the selected native harness; it does not scan a new folder in order to ask permission.

Offer two independent choices using the existing capabilities:

| Choice | What it allows | What it does not grant |
|---|---|---|
| **Read current files in this checkout** | The existing approved-root map/index and supported current-file reads, including their redaction, protected-path, size, link and eligibility checks | Other worktrees, arbitrary folders, protected files, outside generated images or project writes |
| **Use this session's native harness** | Check whether the selected supported CLI is available; inspect supported settings on request; prepare the existing selected-session connection | Sending a prompt, resuming a turn, approving a tool, changing saved native policy or attaching to a terminal |

Continue can enter either a recorded-only view or the explicitly approved capabilities. Declining a permission must leave captured material readable; unavailable roots, offline bundles and joined recordings must not become dead ends. A missing CLI gets the existing actionable local install/sign-in instructions, without an automatic installation or background native turn.

Connection is still session scoped. A saved repository preference cannot silently choose a different native session or harness. An explicit submitted prompt is the point at which the existing controller may resume that selected session.

## Remembering setup safely

Recommended: offer an explicit **Remember for this checkout** choice for repository reading. Remembering should be an informed action, not an implicit consequence of opening a recording. If selected, restore only the previously approved scope after validating the exact physical root and repository identity.

- A repository group in Home is not a permission boundary. Linked checkouts can share a Git common directory and still contain different files. Do not extend a grant to a new worktree automatically.
- Bind the grant to the exact canonical checkout and validated directory/repository identity; a different checkout, redirected link, replacement directory, missing root or conflicting identity invalidates it. A path string or shared repository name alone is insufficient.
- Settings shows the root, granted capabilities and remembered choice, and offers revoke/change. Revocation invalidates pending reads as the current API already does. New roots require their own explicit grant.
- Persist only Drishya-owned grant/preference metadata, after redaction. No credentials, native config, prompt, draft, attachment or source bodies. If redaction or identity checks prevent a trustworthy match, do not restore the grant.
- Without Remember, retain today's session-lifetime grant. Recorded-only viewing remains available after expiry or revocation.

These persistence semantics require approval and implementation review; the existing grants are currently volatile. No storage or API migration is included here.

## Permission moments that cannot be collected once forever

The desired reduction in in-session prompts must not become a promise that every future action is pre-approved.

- The idle-other-clients acknowledgement remains an explicit condition for submitting native work. Repository setup cannot certify indefinitely that other clients are idle. Recommended: keep the existing send-time acknowledgement until a separately agreed, truthful connection-lifetime contract exists.
- Native tool approvals and native questions remain tied to the exact request during a turn, through supported harness protocols. Setup never answers or bypasses them.
- A pasted/picked attachment is an explicit user selection of bytes. It is not permission to browse every sibling file, and its contents are not saved as a preference.
- Reading an outside generated image remains the existing exact-operation/exact-file consent. An unknown future file cannot be included in a blanket checkout grant.
- Workspace drafts still go to the harness only through explicit submission. Drishya does not write project files itself, and unsupported native policy values remain unsupported.

The native sandbox/approval policy, saved settings and credentials are unchanged. The setup describes supported capabilities; it does not introduce a Full access promise that the connected runtime cannot support.

## Decisions needed before code

1. **Entry:** approve the recommended first-open step with a usable Recorded only route, rather than requiring every permission to view a session?
2. **Lifetime:** approve explicit opt-in remembered reading consent for an exact checkout, with identity validation and revocation, rather than remembering only UI preferences?
3. **Native control:** approve preparing/checking the selected harness during setup while keeping actual resume/send, idle-client acknowledgement and request-specific approvals explicit?

These are proposed choices, not settled decisions. If the builders want a strict all-capabilities-required entry or a broader permission lifetime, the scope and failure behaviour need agreement before implementation. Neither option may weaken the existing native policy or silently extend root access.

## Implementation acceptance after approval

The eventual implementation must prove, on genuine local Codex and Claude Code sessions at 600 and 1440 px:

1. First open offers setup; recorded-only remains usable. An approved supported workspace opens with the chosen capabilities and no duplicate generic read grant inside it.
2. Explicit Remember survives an app restart only for the validated exact checkout. A new/replaced/missing root, another worktree, revocation and redaction mismatch do not inherit permission.
3. CLI missing/signed-out/unsupported cases explain the cause without submitting anything. Native prompts still require explicit send and the acknowledgement; actual approvals/questions retain their exact identity and protocol.
4. Offline, joined and mixed-root views retain their documented read-only/current-file boundaries. Captured evidence remains distinct from current bytes, including FILES-13's unplaced paths.
5. Passive capture proceeds during setup and failure. No native configuration/journal/credential writes, arbitrary-terminal control, shell-interpolated prompts, telemetry or persisted source bodies.

Implementation must reserve its files before work: session entry overlaps FINISH-0c; Settings/controls overlap FINISH-0a/0b and the Clarity finishing owners. This document grants no source reservation or schema change.

**Stopping point:** this fulfils the assigned proposal-only step. CONNECT-4 stays unchecked until its approved implementation and acceptance are complete. NATIVE-1 and a new product review are not marked complete by this proposal.

## Decision (Yash with Claude, 7 November)

The proposal is approved with four adjustments toward Yash's ask ("all permissions are taken first, then it proceeds and opens, so no permission inside"):

1. **Entry: one click.** The first open of a repository shows a compact setup sheet: **Allow and open** (primary) and **Open without** (secondary). It never blocks reading what was recorded.
2. **Lifetime: remembered by default.** "Remember for this checkout" is offered **ticked by default**. It is still explicit: the user sees it and presses Allow, and can revoke it in Settings. The grant is bound to the exact canonical checkout and its validated identity, as proposed. A new worktree of a repository that already has a grant does not inherit it: it shows the same sheet **pre-filled**, so approving it is one click, not a new decision.
3. **Native harness: approved as proposed.** Setup checks and prepares the selected CLI (available, signed in, supported). Resume and send, and the tool approvals and native questions a turn asks for, stay explicit at the moment they happen.
4. **Idle-other-clients acknowledgement: once per connection, not per send.** Today it is asked before every send and reset after each submit and on a model or effort change. It is now asked at the first send to a selected session, then held until that connection ends: the app reloads, the user leaves the session, the controller disconnects, or the connection fails. A model or effort change no longer resets it.

**Split** (AGENTS: a claim is a whole item):

- **CONNECT-4a** (logic, Sol): remembered-grant persistence, checkout identity validation, revocation, the setup-state API, the pre-fill signal for sibling worktrees, the once-per-connection acknowledgement, and a "Remember for this checkout" checkbox (ticked by default) in Modern's existing workspace approval, using existing classes only.
- **CONNECT-4b** (presentation, Claude in Clarity): the one-click setup sheet on first open, and the Settings list of remembered checkouts with revoke. After CONNECT-4a, FINISH-0b (overlays) and alongside FINISH-1 (Home and session open).

Everything else in this document stands: no grant crosses checkouts silently, recorded-only viewing always works, no native policy, configuration or credential changes, and no persisted source bodies.
