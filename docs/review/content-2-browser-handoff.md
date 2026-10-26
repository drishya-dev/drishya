# CONTENT-2 — browser evidence component and Claude integration handoff

26 October 2026 · [draft PR250](https://github.com/drishya-dev/drishya/pull/250) · [claimed CONTENT-2 row](../STATUS.md#claimed)

**This is an unintegrated component/handoff draft. CONTENT-2 remains open.** The builder explicitly assigned `History.tsx` integration to Claude. This PR contains dedicated components/helpers/scoped CSS, focused tests and this report; it does not activate the product feature. The changes below were verified using a temporary, ignored History patch in the isolated worktree, then that file was restored. Root owns TASKS/STATUS coordination, not the shared History implementation. No contracts, adapter, projection, Reader, Workspace or image-owner source was changed.

## Before | After | Why

| Before | After with the temporary integration | Why |
| --- | --- | --- |
| MCP browser calls repeated the generic arguments/result composition. | Recognized browser tools show the captured action, literal URL when supplied, captured tab ID/query, returned/failed/running/unknown state, and selectable result excerpt. | Read what the browser actually did without interpreting script input or implying a current page. |
| Browser batches hid their individual actions inside arguments. | A compact ordered list shows up to 12 literal batch action names/actions/URLs; the full captured input remains available on expansion and in the original Inspector. | Actual Claude browser-heavy recordings contain `browser_batch`, as well as individual calls. This is a display bound, not discarded evidence. |
| Every consecutive browser operation occupied a separate action card. | Same-agent/server consecutive steps within an existing passage share a native keyboard range scrubber; the exact original operation card renders for the chosen step. | Preserve prose/turn/non-browser boundaries, status, operation IDs, images, raw inspection, artifact access and source provenance. Filter-match changes also split a group, keeping matching actions visible. No projection mutation or inferred tab/causal/session relationship. |
| WebFetch metadata appeared only after expansion. | URL and only captured status/bytes/duration appear beside the excerpt in compact and expanded views. Missing facts are omitted. | A fetch can be understood without expanding raw output; a missing status never becomes success. |
| Nested cards inherited a horizontal flex basis as vertical allocation. | A scoped strip-child override restores intrinsic content height; expanded cards get the full passage width. | Synthetic visual QA caught blank space before this correction. No unrelated style overrides. |
| Browser step replacement could leave connector geometry stale. | A step change dispatches the existing material-layout event; only the chosen original card is mounted. | Existing geometry readers observe the real article, with no duplicate action IDs or edges pointing at unmounted steps. |

The ordinary static history begins at the first step. Active live/replay following starts at the newest available step and advances when new steps arrive. Scrubbing detaches follow without pausing replay. Exact selected/expanded action IDs and observation navigation choose the corresponding step once; subsequent manual scrubbing remains possible. Hover reading uses the existing one-card owner; step replacement leaves no placeholder.

No new animation: frequent keyboard scrubbing changes selectable content immediately. Existing original-card motion/hover remains in its owner. Emil composition and the animate skill were applied; nothing is typed, scanned or generated. Safe absolute HTTP(S) URLs open only on explicit clicks with `noopener noreferrer`; credential-bearing/unsupported URLs stay literal. Browser URL text comes only from captured input; no previous-step URL is copied onto a later step. Captured results are excerpts, not generated summaries. Web result list behavior and expanded CapturedOutcomes are retained.

## Local verification

Baseline: existing `web-results.spec.ts` passed against the running untouched app in Edge before edits. The default bundled Chromium executable is absent on this machine, so focused browser runs used the installed Edge channel. No browser download or hosted checks.

With the temporary History integration:

- UI TypeScript and production build passed.
- Six focused helper unit tests passed: recognized tools/envelopes, bounded batch display, order/agent/server/missing-item boundaries, filter visibility, absent URL isolation, safe links.
- Ten focused browser checks passed: seven new integration journeys, the existing search fixture, the existing expanded desktop result-title/raw-output journey, and offline unsafe-link validation. Only supported desktop widths were run: 600, 1024 and 1440 px.
- New journeys exercise mixed browser/non-browser rows, scrubber Home/Arrow/End, full literal input fields, failed outcomes, a synthetic captured PNG thumbnail and image reader, exact restored operation selection, replay arrival of a later browser step followed by detached reading, hover replacement cleanup, no duplicate IDs/ghost connector endpoints, overflow and remote-load/page-error guards.
- Synthetic 1440 px composition screenshot inspected locally. Actual screenshots remain only in ignored `.local/`; no recording content or screenshots are committed here.

Reproducible commands after Claude applies the integration:

```powershell
$env:DRISHYA_BROWSER_CHANNEL='msedge'
pnpm exec playwright test tests/browser/browser-evidence.spec.ts tests/browser/web-results.spec.ts tests/browser/web-result-acceptance.spec.ts --grep-invert '320px|390px' --reporter=line
pnpm exec vitest run apps/ui/test/browser-evidence.test.ts
pnpm --filter @drishya/ui typecheck
pnpm ui:build
```

`browser-evidence.spec.ts` explicitly skips with **Requires Claude CONTENT-2 History integration** while the dedicated component import is absent from History. It automatically enables when Claude applies the import below. Helper units do not skip. A skipped dependency is not product acceptance.

## Real-source matrix

Only ID prefixes, sizes and counts are recorded. Existing redacted Drishya stores were copied privately; native journals were read-only. Original stores/journals were not modified. Browser app observation, any cache rebuild and screenshots used those copies only.

| Recording prefix | Harness | Source bytes | Operations | Actual relevant evidence | Checked at 600 / 1440 px |
| --- | --- | ---: | ---: | --- | --- |
| `061e5f2d` | Claude Code | 7,150,502 | 292 | 17 browser MCP operations, including batches/find/resize; 2 web operations including 1 search result list and 1 fetch with metadata | Five multi-operation strips, ten exact original browser steps traversed per width; actual result list and fetch facts/excerpt expanded at both widths |
| `c8e5c9c8` | Claude Code | 82,859,509 | 2,215 | 9 browser MCP operations, including navigate/computer/read_page/page-text | Two multi-operation strips, five exact original browser steps traversed per width; selected-action navigation also exercises the paged history path |
| `4d842553` | Codex | 57,913,276 | 753 | 14 web operations, 13 with recorded result lists; no fetch facts | Two genuine result lists expanded per width; complete supplied list counts and overflow checked; paged history selected-action route |

All matrix journeys passed without remote loads or page errors. Available actual browser operations in these copies contain no captured screenshot bytes; screenshot rendering was exercised with the synthetic captured PNG, not claimed as genuine-source screenshot acceptance. No genuine Codex browser MCP operation or Codex fetch metadata was found in the copied sessions or the available native-browser candidate scan. Those cases remain unverified on real source; they are not synthesized or claimed. Generic scripts and unrecognized MCP tools retain their original presentation.

## Claude-owned integration

Apply the following changes semantically to the latest History, preserving concurrent DATA-3/READ-4 changes. These hunks are the exact temporary integration used above, based on the CONTENT-2 worktree baseline. No History changes are included in this PR. Keep the original OpCard image rendering, raw Inspector/artifact ownership, operation IDs, evidence note and hooks; the delegates run only after existing hooks. The composer, paged projection and passage height owner remain unchanged. Re-run the focused commands and real-source matrix against the final integrated tree before claiming CONTENT-2 complete.

```diff
diff --git a/apps/ui/src/components/History.tsx b/apps/ui/src/components/History.tsx
index 823ae57..13e5e21 100644
--- a/apps/ui/src/components/History.tsx
+++ b/apps/ui/src/components/History.tsx
@@ -1,3 +1,5 @@
+import { BrowserEvidence, BrowserStrip, WebEvidence } from './BrowserEvidence.tsx';
+import { browserStep, groupBrowserSteps } from '../lib/browser-evidence.ts';
 import { passageArtifacts, passageItems, samePassageContent, type PassageContent } from '../lib/passage-content.ts';
 import { HistoryArtifacts } from '../lib/history-artifacts.ts';
 import { ReadingKeys } from './ReadingKeys.tsx';
@@ -37,8 +39,7 @@ import { VerificationStrip } from './VerificationStrip.tsx';
 import { FixChainPanel, ReadBeforePanel } from './Verification.tsx';
 import { PinnedPlanList, PlanChecklist } from './PlanChecklist.tsx';
 import { DeclinedLine } from './DeclinedLine.tsx';
-import { WebResults } from './WebResults.tsx';
-import { CommandRunNotes, fetchFacts } from './CommandRun.tsx';
+import { CommandRunNotes } from './CommandRun.tsx';
 import { BeforeTurnPanel } from './BeforeTurn.tsx';
 import { NoticeLine } from './NoticeLine.tsx';
 import { OpImages, PathImage, pathOnlyImage } from './OpImages.tsx';
@@ -728,9 +729,13 @@ const PassageView = memo(function PassageView({ ps, artifacts, ops, prose, notic
             {first?.startTime && <CapturedTime iso={first.startTime} />}
           </div>
           <div className="ops-row">
-            {ps.ops.map((o, i) => {
-              const op = ops.get(o.id);
-              return op ? <OpCard key={o.id} so={o} op={op} index={i} /> : null;
+            {groupBrowserSteps(ps.ops, ops).map((group) => {
+              const first = group[0]!;
+              const op = ops.get(first.id);
+              if (!op) return null;
+              if (group.length === 1) return <OpCard key={first.id} so={first} op={op} index={ps.ops.indexOf(first)} />;
+              const grouped = group.map(item => ops.get(item.id)!).filter(Boolean);
+              return <BrowserStrip key={first.id} operations={grouped} renderOperation={(chosen) => <OpCard key={chosen.id} so={group.find(item => item.id === chosen.id)!} op={chosen} index={ps.ops.findIndex(item => item.id === chosen.id)} />} />;
             })}
           </div>
         </>
@@ -877,6 +882,7 @@ function ExpandedMaterial({ op }: { op: Operation }) {
   const d = op.detail;
   const select = useApp((s) => s.select);
   const input = op.artifactIds.find((id) => id.endsWith('_input'));
+  if (browserStep(op)) return <div className="op-expanded mcp-material" onClick={e => e.stopPropagation()}><BrowserEvidence op={op} full/></div>;
   switch (d.kind) {
     case 'read':
       return <div className="op-expanded read-material" onClick={(e) => e.stopPropagation()}>
@@ -926,14 +932,7 @@ function ExpandedMaterial({ op }: { op: Operation }) {
         <StructuredResult text={d.resultPreview || (op.status === 'running' ? 'Waiting for result' : 'No result content captured')} />
       </div>;
     case 'web':
-      return <div className="op-expanded web-material" onClick={(e) => e.stopPropagation()}>
-        <div className="material-context">{d.url ?? d.query ?? 'Web request'}</div>
-        {d.fetch && <div className="material-context">{fetchFacts(d.fetch)}</div>}
-        {d.results?.length ? <><div className="material-context">{d.results.length} recorded result{d.results.length === 1 ? '' : 's'}</div><WebResults results={d.results} snippets/></> : null}
-        <div className="material-context">Captured result preview</div>
-        <CapturedOutcomes output={d.resultPreview}/>
-        <ToolOutput text={d.resultPreview || (op.status === 'running' ? 'Waiting for result' : 'No result content captured')}/>
-      </div>;
+      return <div className="op-expanded web-material" onClick={e => e.stopPropagation()}><WebEvidence op={op} full/></div>;
     case 'plan':
       return <div className="op-expanded plan-material" onClick={(e) => e.stopPropagation()}><PlanChecklist op={op} full/></div>;
     case 'spawn':
@@ -972,6 +971,7 @@ function ResultArea({ state, resolving, children }: { state: Operation['status']
 function OpPreview({ op, resolving, onSource }: { op: Operation; resolving: boolean; onSource?: (text: string) => void }) {
   const d = op.detail;
   const set = useApp((s) => s.set);
+  if (browserStep(op)) return <BrowserEvidence op={op}/>;
   switch (d.kind) {
     case 'read':
       return <>
@@ -1045,14 +1045,7 @@ function OpPreview({ op, resolving, onSource }: { op: Operation; resolving: bool
         </div>
       );
     case 'web':
-      return (
-        <div className="web">
-          <div className="query">{d.url ?? d.query}</div>
-          <ResultArea state={op.status} resolving={resolving}>
-            {d.results?.length ? <WebResults results={d.results} limit={5}/> : d.resultPreview ? <div className="mcp-result"><StructuredResult text={d.resultPreview}/></div> : <span className="muted">{op.status === 'running' ? 'Waiting for result' : 'No result content captured'}</span>}
-          </ResultArea>
-        </div>
-      );
+      return <WebEvidence op={op}/>;
     case 'spawn':
       return (
         <div className="spawn">
```
