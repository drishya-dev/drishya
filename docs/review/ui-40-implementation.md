# UI-40 implementation and review

Status: implementation in progress; **awaiting Yash approval**. Issue #552.

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
