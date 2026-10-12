# Professional composer increment

12 October 2026. First composer increment from [52](52-composer-interactions-recordings-plan.md), using `emil-design-eng`. Classic remains active; native backend/capture/permissions are unchanged. This is a separate commit from evidence reading navigation and the later whole-product interaction/Home work.

| Before | After | Why |
| --- | --- | --- |
| Composer target was screen-reader-only | Compact visible harness, workspace, short recording reference and state | A developer should know where a prompt is going before sending it |
| Native settings always said Ask permission | Chosen/reported model and reported native policy, with Native policy when unavailable | Do not claim an effective permission policy before the harness reports it |
| Input and attachment/send controls shared a cramped row | Full-width input, separate compact action footer and bounded settings/attachment menus | Separate writing from choosing files/settings without expanding the whole composer |
| Navigating away discards typed text | Eight bounded text drafts, isolated by source identity and recording | Return to unfinished work without putting private prompt text into persistent storage |
| Running turn disables drafting | Next-prompt drafting remains available; Enter cannot submit during an active turn | Let the user prepare without queuing a hidden second native turn |
| Tiny send/stop target | 34 px icon controls and 32 px add control | Better deliberate targeting while keeping the composer compact |

The target/status reflects Drishya's selected recording/controller only. Ready is not proof that another native client is idle: the send-time acknowledgement still requires the user to finish any other client's turn. Exact Allow once/Decline and owned Stop use the existing native protocol. Full access/global policy remains native CLI work and is not simulated. Existing model/effort selection, text/folder/image attachments, screenshot paste, redaction and genuine immediate sending/native phase feedback remain intact.

## Draft bounds

`PromptDrafts` retains at most eight text strings of 65,536 characters per live data-source object, in a WeakMap. Nothing is written to browser storage, disk, exports, telemetry or capture. Text may contain sensitive user input while being composed, so reload/source destruction clears these drafts; this is not durable recovery. Attachments, image data, policy overrides and idle-client acknowledgement are not retained across recording switches. A submitted draft is cleared for its own recording; native completion does not clear a next-prompt draft typed during the run. Source identities and recording keys cannot share drafts.

## Verification

324 unit tests and both TypeScript checks pass; production build passes. All 14 preexisting connected-workspace journeys passed, with the strengthened native approval/next-draft journey and new return-to-recording draft journey passing in focused reruns. Composer-focused regression checks include attachments/screenshot paste/native options/dismissal/compact narrow geometry/phase feedback and the retained Studio backup. These native runs use a synthetic transport behind the real local API, not actual account acceptance. Screenshot `.local/professional-composer.png` is synthetic local proof and is not committed. No hosted CI dispatched.

Visual inspection caught and repaired two inherited CSS conflicts: a hidden harness label and the old grid placing input/footer content on one line. Text and footer must not overlap; the browser regression checks the add control is below the input, and harness identity is actually visible rather than merely present in DOM.

## Next

Shared interaction/menu craft (purposeful arrivals/exits, press/focus/dismissal, clipping, keyboard/touch alternatives), then Home grouping by actual workspace/time, each as its own verified commit. Broader composer account acceptance, effective-policy freshness, native ownership/reconnect/retry, durable opt-in drafts, attachment-byte/privacy acceptance and clearer genuine error/compaction recovery remain explicit in 50/52. This increment does not certify primary-native-client readiness.
