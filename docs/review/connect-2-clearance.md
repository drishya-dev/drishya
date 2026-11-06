# CONNECT-2 — measured approval clearance

The composer already reserved its border-box height, but approval requests and queued-input receipts are absolutely positioned above that box. Their height was missing from history's clearance. A ResizeObserver now measures their actual raised extent; child-list changes account for adding and removing a receipt. History adds this extent to its existing end padding. Existing history measurement performs following; this change does not alter follow state, scroll anchoring, the approval protocol or either surface's design.

The raised extent is a separate CSS property so it cannot feed back into the composer's own height limits. Hidden queued-input controls contribute no clearance. Unmount removes both measured properties and disconnects the observers.

**Review fix (6 Nov, Harsh):** the raised extent is measured from layout offsets (`layoutTop`), not bounding rectangles, because `useSurfaceReflow` scales the composer for 200 ms and a scaled rectangle stored a fraction of the real extent with nothing to remeasure afterwards. The mutation observer also watches `style`, `class`, `hidden` and `data-waiting`, so a receipt whose inline `visibility` flips with the Follow switch is remeasured. Two regressions in `approval-clearance.spec.ts` fail on the previous source (99 px short while scaled; 44 px stale after Follow turns off).

## Genuine acceptance, 5 November

A real Claude Code session, `rec_abd88845` (564,237 bytes, 148 imported observations at the final check), was resumed through Drishya's composer in the throwaway repository made for HOME-3. Workspace consent and the idle-other-clients acknowledgement were given through the UI. The harness produced genuine Bash approval requests; the controller was not substituted.

| Width | Decision | Asking card bottom | Waiting line bottom | Approval top | Result |
|---|---|---:|---:|---:|---|
| 1440 | Decline | 455.6 px | 544.2 px | 576.2 px | Both visible; declined; clearance released |
| 1440 | Allow once | 455.3 px | 543.9 px | 576.2 px | Both visible; allowed once; clearance released |
| 600 | Decline | 463.4 px | 544.0 px | 584.2 px | Both visible; declined; clearance released |
| 600 | Allow once | 463.1 px | 543.7 px | 584.2 px | Both visible; allowed once; clearance released |

On unmodified main, the waiting line ended around 710 px behind an approval starting at 576 px. With this change, approval clearance was 166 px and decreased to the remaining 44 px queued-input receipt after answering. A controlled transport regression without queue receipts verifies release all the way to zero, at both widths and for both decisions. Its first version omitted native initialization responses; that test-driver omission was corrected before acceptance. No assertion or timeout was relaxed.

Real screenshots and native content stay in `.local/`. Two focused browser regressions pass. Full finished-batch gate results are recorded in the PR description before marking it ready.

The genuine Codex source `rec_2be6ea63` (229,580 bytes) was also imported into a separate scratch home and opened at 600 and 1440 px. Both normal views had no approval and a raised gap of exactly zero. This is an ordinary-history compatibility check, not a claim to have produced a genuine Codex approval.

## Finished-batch gate

Both tasks' frozen source changes were checked together in an isolated worktree with its own frozen install, rebuilt UI and Edge. Both typechecks, build and package verification passed. Units: **1,201 passed, one skipped, 200 files** with four workers; the initial unrestricted run hit 16 existing five-second timeouts under concurrent work, without assertion changes. Browser suite: **623 parallel + 33 serial passed, 28 skipped, one failed**. The failure, `product-workspace.spec.ts:344`, is the unchanged Pin range timeout: it also failed **3/8** clean-main repetitions; the isolated validation-branch rerun passed **1/1**. This is a recorded TEST-2 baseline flake, not a clean full gate or a fix to TEST-2. Its source and test were left untouched.

`check:affected` ran while the new transport regression was still missing initialization responses, so that run failed its two new cases. The completed regression subsequently passed twice and in the full gate. No production approval failure was substituted with this fixture result: the separate real Claude acceptance above used the genuine native controller.
