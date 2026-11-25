# UI-40 implementation and review

Status: **all four palettes approved by Yash on 25 November 2026**; final candidate-label cleanup and merge verification recorded below. Issue #552. Earlier pending-selection statements are historical; the original full-batch limitations remain recorded.

The four review candidates extend the existing semantic token owner: Neutral and Chalk (neutral dark/off-white pair), Smoked Slate and Aubergine. Jet Black remains the default. Saved dark/light/midnight/system and retired-theme fallbacks stay compatible. Paper has an off-white ground and stronger layered surfaces; Midnight's ground is deepened to meet the same separation gate. No dimensions or capture/schema/privacy behavior change.

## Measured design constraints

- Keep the established primary 13:1, secondary 7:1, muted 4.5:1 and control ink 3:1 floors over all four surfaces. Saturated syntax/meaning/agent/diff inks keep the existing 7:1 and OKLCH chroma .09 floor. The seventh syntax role, comments, uses neutral muted ink at 4.5:1 and is included in pairwise separation checks.
- Preserve the existing .06 OKLab minimum for syntax pairs; assert candidate accent vs each meaning/agent ink, and all meaning pairs, at .06. Pass/fail and diff added/removed each retain .1 under the existing deuteranopia simulation. Diff signs and labels are unchanged.
- Every palette's adjacent surface contrast meets Jet's measured 1.121 / 1.076 / 1.110 ratios. This requires deeper grounds than several suggested seed colours. Light semantic/agent inks were darkened for the deeper off-white surface steps. Candidate control boundaries also reach 3:1 on every surface.
- The earlier saturated terracotta/violet accent seeds are replaced by pale mineral/bone accents to leave the semantic and agent hues distinguishable. The existing product policy excludes wine-red/forest-green grounds; quantity is not the goal.

## Review material

[Open the side-by-side actual-product gallery](ui-40-comparisons/index.html): 28 synthetic frames, four candidates across History, source reading, Changes, populated Git graph, Settings, navigation dialog and Home. Click a frame for full resolution. These are synthetic fixture screenshots only. Genuine-session images remain ignored under `.local/ui-40/` and must never be published.

Regenerate synthetic frames with `DRISHYA_PALETTE_FRAMES=1` and the targeted `palette-contrast.spec.ts` suite. It writes `.local/ui-40/frames/`. The gallery includes explicit candidate labels; selecting a candidate in Settings is not recorded as Yash's approval.

## Verification record

- UI typecheck: passed. Palette contrast/paint/persistence units: 3 files, 5 tests passed.
- Actual painted browser coverage: 12 passed in the expanded palette batch; two newly added geometry checks initially measured the dialog's existing opening animation. After waiting for finite animations, exact geometry, keyboard selection, truthful previews and persisted reload checks passed at 600/1440; the targeted overlays + geometry batch passed 3/3 with one worker. The preceding painted batch passed 10/10 before Home/Git and geometry additions. No tolerance or contrast threshold was loosened.
- Genuine-session surface survey is being completed in scratch homes; only prefixes/sizes/counts may enter this document. Its first run stopped because Changes intentionally hides History; the private verifier now clears scratch reading-state recovery between surfaces. This was a verifier navigation error, not evidence of a product defect.
- Full finished-batch gate is deferred while AG-3/STORE-1 owns the machine's heavy-gate slot. Author review only so far; independent maintainer review remains required.

## Approval

Yash's actual decision: **not received**. Keep the issue acceptance line open and this PR in draft. Next action is review of the four candidates on the actual-product frames and the completed real-session evidence; record his explicit selection before merging.

## 20 November continuation

Author review confirms that candidate CSS remains token-owned, theme IDs are parsed through the existing preference path, and Appearance changes do not alter Settings category/mount ownership. Synthetic review materials contain only the allowlisted fixture frames. Independent review was requested from CODEOWNERS maintainer `yashdoke7` on draft PR #559. Yash's palette decision is still absent.

The resumed private survey corrected two verifier mistakes: it clears scratch reading-state recovery between surfaces, and waits only for running finite animations with a bounded settle (a paused animation's completion promise must not hold the verifier forever). No product behavior was changed for these verifier issues. The first chosen real Claude session has no Git commits; populated genuine Git acceptance remains open until checked on a repository-backed recording.

### Genuine-session survey result

Scratch imports: Claude `rec_50c3031b`, 7,879,647 bytes / 278 operations / 10 captured files; Codex `rec_674a4957`, 4,624,942 bytes / 657 operations / 20 files. At 600 and 1440 px, seven palettes across the available required surfaces yielded **182 painted-screen measurements, zero text-contrast failures**. Home, History, Settings, navigation dialog and Changes were checked in both harness contexts at both widths. Files was checked at 600; both 1440 Files journeys were unavailable and remain open. Git showed 50 commits for Codex at 1440; the other selected Git views were empty. A follow-up repository-backed survey is covering those gaps. Private screenshots and detailed count-only JSON stay in `.local/ui-40/`.

### Final focused corrections (20 November)

A new actual-paint assertion reproduced neutral Git controls borrowing read-evidence blue instead of the palette accent. The shared interactive-chrome selectors now cover candidate palettes, preserving Paper's existing special handling. A five-commit synthetic fork/merge scene replaces the one-commit graph comparison. The gallery was regenerated from the passing journeys.

Exact Paper/Midnight colour expectations in three older specs were updated to their planned new values, without weakening contrast or geometry assertions. Fresh monorepo typecheck, all five palette/paint/preference units, and **23 focused browser tests passed with one worker**, including all palette paint, keyboard/preview/persistence/geometry cases and the three corrected older journeys. The control-accent test was watched fail before the fix.

Frozen combined gate (before the final targeted corrections): typecheck/build/package passed; security 700 passed / 5 skipped; parallel browser 959 passed / 27 skipped / 8 failed at 3 workers; serial 66 passed / 1 skipped at 1 worker. Three parallel failures were the corrected colour expectations; the remaining five and seven full-unit failures still need clean-main controls. This is not a green full gate, and later deltas are verified by targeted checks rather than attributed to the frozen run.

### Closed wide-reader gap and final controls

The private verifier was closing the already-open desktop Files pane, and could select a row before workspace approval enabled it. It now checks pane visibility, waits through normal enabled-row interaction, and requires a file evidence/source reader. On genuine `rec_14f29d5f` (Claude, 28,184,536 bytes / 775 operations / 109 files) and `rec_674a4957` (Codex, 4,624,942 bytes / 657 operations / 20 files), all seven palettes passed the 1440 px source-reader check: **14 painted measurements, zero contrast failures**. This closes the earlier wide Files gap. Earlier genuine surveys remain valid for their stated surfaces/states; Git was populated for Codex at 1440 and otherwise checked in empty/consent states. The synthetic five-commit fork/merge scene provides populated graph contrast at both widths in all palettes. No claim of a populated genuine Claude graph is made.

Frozen gate follow-up: the three intended-colour expectation failures are corrected and pass in the 23-test focused batch. Toolbox focus reproduced on clean main and passed alone. The other selected browser controls passed on clean main; all 10 passed on the final combined branch. Six affected daemon suites passed 94 tests on each clean-main and combined one-worker controls. Their original full-run timeouts/cleanup errors did not reproduce in isolation; causes remain unconfirmed. Final combined typecheck and 35 focused map/palette units passed. The full gate remains recorded as red, not replaced by these targeted results.

Acceptance remaining: **Yash's actual palette selection and independent maintainer review**, including assessment of the non-reproducing full-gate failures. PR #559 remains draft. No merge, tag or publication was performed.

### Final narrow source-reader confirmation

The strengthened verifier also required the actual file evidence/source reader at 600 px, rather than only an open Files pane. The same genuine Claude `rec_14f29d5f` (28,184,536 bytes / 775 operations / 109 files) and Codex `rec_674a4957` (4,624,942 bytes / 657 operations / 20 files) passed all seven palettes: **14 painted measurements, zero contrast failures or unavailable journeys**. Together with the separate 14 wide-reader checks above, source reading is explicitly verified at both supported widths. These repeat part of the earlier survey and are not additional unique sessions. Real images and detailed count-only results remain ignored in `.local/ui-40/`.

Next action: Yash reviews the committed synthetic comparison gallery and explicitly selects palettes; the maintainer reviews the diff and unresolved full-gate evidence before merge. No actual selection has been received, and no populated genuine Claude Git graph is claimed.

## Current-main and selected-marker follow-up, 25 November 2026

Integrated main `4d87d40d`. The earlier Ubuntu shard failed the 600 px wait-card swap three times with the same 0.0136626 layout shift. Main's `3d35036d` branch-facts correction is included. The exact wait-card layout and reduced-motion checks passed at both widths in the rebuilt draft. The earlier hosted failure remains part of the evidence.

Independent Edge review found that a preview's base border overrode the selected border after focus moved away. The new assertions failed at 600 and 1440 px. The preview uses its unselected border only for unselected palettes, so the existing active accent remains visible. The correction preserves preview tokens and geometry. The rebuilt draft passed both typechecks, five palette/preference/paint units (one worker) and 18 focused Edge browser tests (one worker, zero skips or retries), including colour control floors, map paint, the exact wait-card suite, and selected paint with keyboard focus elsewhere.

Fresh genuine scratch verification at both widths added these observations:

- The seven-palette survey recorded 182 checks with no contrast failures. Claude `rec_50c3031b` had 7,879,647 bytes, 278 operations and ten files. Codex `rec_fa23598c` had 1,083,241 bytes, 68 operations and four files.
- A separate source-reader run supplied the wide Files cases and verified actual source at both widths with no contrast failures in 28 checks. Claude `rec_14f29d5f` had 28,184,536 bytes, 775 operations and 109 files. The same Codex recording was checked.
- A separate populated Git graph run used Claude `rec_b4eb42b6` (108,711 bytes, 50 rendered commits at each width) and the same Codex recording (20 at each width). With reduced motion enabled, 28 palette checks had no contrast failures. Real Settings in those same two recording contexts also showed the selected Chalk border with focus elsewhere at both widths.

These are repeated surface measurements in named recording contexts. At this follow-up's recording time, the full local gate remained unresolved and no palette choice from Yash was recorded. The PR remained draft.

## Maintainer approval and merge preparation, 25 November 2026

Yash approved all four palettes (`neutral`, `chalk`, `slate`, `aubergine`) in his GitHub approval on `293b035d`. Jet Black remains default. His review records fresh Windows typecheck/build, 284 passing unit files (1,908 tests passed, one skipped, four workers), 126 focused browser passes (two workers), package verification with security 700 passed/five skipped, and all 14 hosted checks passing. These are maintainer-reported results on that head, not a replacement for the earlier frozen batch or a claim that its failures never happened.

The approval supersedes the historical selection-pending statements above. Settings descriptions now omit the candidate labels, as requested by the review. Palette IDs, token values, preference migration, contrast thresholds and layout are unchanged. The final pre-merge follow-up is checked separately and recorded in the PR; other tasks and physical-platform acceptance remain separate.
