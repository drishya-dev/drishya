import {FileReadingActions} from './FileReadingActions.tsx'; import {plural} from '../lib/plural.ts';
import {SessionDiff} from './SessionDiff.tsx';
import {InterfaceGlyph} from './InterfaceGlyph.tsx';
import {ReviewTools} from './ReviewInsights.tsx';
import { memo, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Projection } from '@drishya/contracts';
import { sinceSnapshot, type SinceFileStat, type SinceSnapshot } from '../../../../packages/scene/src/since.ts';
import { useApp } from '../state.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { FileIcon } from './FileIcon.tsx';
import {fileName, fileFolder} from '../lib/file-identity.ts';
import './review-changes.css';

/** A first-visit review entry. Daemon facts cover the whole recording, not its resident page. */
/** Modern calls this the Session review (GIT-9: Changes is the header window that compares branches and reviews the working tree); the older experiences keep "Review work". */
const reviewName = () => document.documentElement.dataset.uiVersion === 'modern' ? 'Session review' : 'Review work';

/** `trigger={false}`: Modern's header carries Compare (GIT-8) instead; this dialog (failures, recorded checks, gaps, each file's edits) stays one palette step away and opens on the `drishya-session-review` event. */
export function EvidenceReview({ projection, label = reviewName(), after=-1, trigger=true }: { projection: Projection; label?: string;after?:number;trigger?:boolean }) {
  const [open, setOpen] = useState(false);
  const mode = useApp(s => s.mode);
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
  const unavailable = source?.kind === 'daemon' && id?.includes('+');
  const left = useRef<ReviewVisit>({});
  useEffect(() => {
    if (trigger) return;
    const show = () => { if (useApp.getState().mode !== 'replay' && !unavailable) { useApp.setState({ compareOpen: false }); setOpen(true); } };
    window.addEventListener('drishya-session-review', show);
    return () => window.removeEventListener('drishya-session-review', show);
  }, [trigger, unavailable]);
  return <>{trigger && <button className={`btn ghost ${after<0?'review-open':'review-turn-open'}`} disabled={mode === 'replay' || unavailable} title={mode === 'replay' ? 'Return to history to review the complete recording' : unavailable ? 'Choose one native recording to review' : 'Changes, failures and recorded checks'} onClick={() => setOpen(true)}>{label}</button>}
    {open && mode !== 'replay' && <ReviewContent key={after} projection={projection} after={after} left={left} close={() => setOpen(false)} />}</>;
}

const FILES_PER_PAGE = 50, ROWS_PER_PAGE = 20;
type ReviewTrack = 'files' | 'failures' | 'tests' | 'unfinished';
type ReviewGroup = Exclude<ReviewTrack, 'files'>;
type LeaveReview = (row?: string) => void;
interface ReviewVisit { id?: string; row?: string; shown?: Record<ReviewTrack, number> }

/** Asks for more once its place is near or above the end of what is being read, so a list passed quickly still fills. Remounted by key once a page arrives. */
function MoreRows({ load }: { load?: () => void }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const row = ref.current;
    if (!load || !row) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load(); }, { root: row.closest('.evidence-review'), rootMargin: '1000000px 0px 480px' });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);
  return <p className="muted review-more" ref={ref}>Loading…</p>;
}

/** One page renders alone, so the list grows without touching what is already on screen. */
const FilesPage = memo(function FilesPage({ data, close }: { data: SinceSnapshot; close: LeaveReview }) {
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  return data.editedFiles.map(path => {
    const leave = () => close(path), stat = data.fileStats && Object.hasOwn(data.fileStats, path) ? data.fileStats[path] : undefined;
    const openFile = () => { useApp.getState().set({ filePanel: path, filePanelFocus: 'change', currentFile: undefined, explore: false }); leave(); };
    const showMap = () => { leave(); useApp.setState({mapVisible:true,explore:true,developerWorkspace:false,selectedOp:undefined,expandedOp:undefined,filePanel:undefined,currentFile:undefined,mapFocusPath:path}); };
    const edits = <FileEdits stat={stat} close={leave}/>, net = <SessionDiff diff={stat?.netDiff} open={operationId=>{useApp.getState().select(operationId);leave();}}/>;
    // UI-8: one line per file, name first. Its edits and net diff open on request, so a long session reads as a list of files.
    if (modern) {
      const count = stat?.fileEdits?.length ? stat.edits : 0, folder = fileFolder(path);
      return <div className="review-file" data-review-row={path} key={path}><div className="review-file-entry"><button title={path} aria-label={`Open ${path}`} onClick={openFile}><FileIcon path={path} /><span className="review-file-name">{fileName(path)}</span>{folder && <span className="review-file-folder">{folder}</span>}</button>{stat&&<small className="review-file-stat" title="Counted from patches; turn is the prompt turn of the last edit"><b className="add">+{stat.added}</b>{!!stat.removed && <> <b className="del">−{stat.removed}</b></>}{stat.turn?` · turn ${stat.turn}`:''}</small>}<FileReadingActions path={path} capturedKnown compact onNavigate={leave}/><button className="review-file-map" aria-label={`Show map connections for ${path}`} title="Show map connections" onClick={showMap}><InterfaceGlyph name="map"/></button></div>
        {(count > 0 || stat?.netDiff) && <details className="review-file-more"><summary>{count ? `${count} ${count === 1 ? 'edit' : 'edits'}` : 'Net diff'}</summary>{edits}{net}</details>}</div>;
    }
    return <div className="review-file" data-review-row={path} key={path}><div className="review-file-entry"><button onClick={openFile}><FileIcon path={path} /><span>{path}</span><span aria-hidden="true">↗</span></button>{stat&&<small className="review-file-stat" title="Counted from patches; turn is the prompt turn of the last edit"><b className="add">+{stat.added}</b>{!!stat.removed && <> <b className="del">−{stat.removed}</b></>}{stat.turn?` · turn ${stat.turn}`:''}</small>}<button className="review-file-map" aria-label={`Show map connections for ${path}`} title="Show map connections" onClick={showMap}><InterfaceGlyph name="map"/></button></div><FileReadingActions path={path} capturedKnown compact onNavigate={leave}/>{edits}{net}</div>;
  });
});

const OutcomesPage = memo(function OutcomesPage({ data, group, close }: { data: SinceSnapshot; group: ReviewGroup; close: LeaveReview }) {
  return data[group].map(item => <div className="review-item" data-review-row={item.operationId} key={`${group}/${item.operationId ?? item.sequence}`}>{item.operationId ? <button onClick={() => { useApp.getState().select(item.operationId!); close(item.operationId); }}>{item.title}<span aria-hidden="true">↗</span></button> : <span>{item.title}</span>}{item.detail && <small>{item.detail}</small>}{item.status === 'unknown' && <small>Outcome not exposed</small>}</div>);
});

function ReviewContent({ projection, close, after, left }: { projection: Projection; close: () => void;after:number;left:MutableRefObject<ReviewVisit> }) {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId)!;
  const revision = useApp(s => s.renderedRevisions[id]);
  const [shown, setShown] = useState(() => (left.current.id === id && left.current.shown) || { files: 1, failures: 1, tests: 1, unfinished: 1 });
  const [pages, setPages] = useState<Record<number, SinceSnapshot>>({});
  const fetched = useRef(new Map<number, string>());
  const facts = pages[0];
  const wanted = Math.max(...Object.values(shown));
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const generation = `${id}/${revision}/${projection.lastSequence}/${retry}`;
    setError(undefined);
    void (async () => {
      for (let page = 0; page < wanted && active; page++) {
        if (fetched.current.get(page) === generation) continue;
        const request = source?.kind === 'daemon' ? source.since?.(id, after, page) : Promise.resolve(sinceSnapshot(projection, after, page));
        if (!request) { setError('Review is unavailable for this recording.'); return; }
        const data = await request;
        if (!active) return;
        fetched.current.set(page, generation);
        setPages(current => ({ ...current, [page]: data }));
      }
    })().catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [source, id, revision, projection.lastSequence, retry, wanted, after]);
  const dialog = useRef<HTMLDivElement>(null);
  const leave = useRef<LeaveReview>(row => { left.current = { ...left.current, row }; close(); }).current;
  useEffect(() => { left.current = { ...left.current, id, shown, row: undefined }; }, [id, shown]);
  const restored = useRef(false), returnTo = useRef(left.current.id === id ? left.current.row : undefined);
  // Back from the row that was opened, at that row; the pages before it are loaded first.
  useLayoutEffect(() => {
    if (restored.current || !Array.from({ length: wanted }, (_, page) => pages[page]).every(Boolean)) return;
    restored.current = true;
    if (returnTo.current) dialog.current?.querySelector(`[data-review-row="${CSS.escape(returnTo.current)}"]`)?.scrollIntoView({ block: 'center' });
  }, [pages, wanted]);
  const groups = [['failures', 'Failures'], ['tests', 'Recorded checks'], ['unfinished', 'In progress'], ['gaps', 'Gaps in the record']] as const;
  const more = (track: ReviewTrack, count: number, size: number) => {
    const page = shown[track];
    if (page * size >= count) return null;
    const ready = !!pages[page - 1];
    return <MoreRows key={`${page}/${ready}`} load={ready ? () => setShown(current => ({ ...current, [track]: current[track] + 1 })) : undefined} />;
  };
  return <ReadingDialog title={reviewName()} close={close} className="evidence-review">
    <div className="review-intro"><ReviewTools close={close}/><span title="In the order they happened. A test running later does not show it covered a change.">{after<0?'Whole session':'Since this turn began'}</span></div>
    {error && <p role="alert">{error} <button className="btn" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
    {!facts ? !error && <p role="status">Opening step…</p> : <div ref={dialog}>
      <div className="review-counts"><span><strong>{facts.editedFileCount.toLocaleString()}</strong> {facts.editedFileCount === 1 ? 'file' : 'files'} changed</span><span><strong>{facts.counts.failures.toLocaleString()}</strong> failed</span><span><strong>{facts.counts.tests.toLocaleString()}</strong> test {facts.counts.tests === 1 ? 'run' : 'runs'}</span></div>
      {!!facts.unplacedCount&&after>=0&&<p className="review-note">{facts.unplacedCount} {facts.unplacedCount===1?'entry has':'entries have'} no position in the session, so {facts.unplacedCount===1?'it only shows':'they only show'} in the whole-session view.</p>}
      <div className="review-layout"><section className="review-files" aria-label="Files with changes"><h3>Changed files</h3>
        {facts.editedFileCount ? Array.from({ length: shown.files }, (_, page) => pages[page] && <FilesPage key={page} data={pages[page]} close={leave} />) : <p className="muted">No change inputs recorded.</p>}
        {more('files', facts.editedFileCount, FILES_PER_PAGE)}
      </section><div className="review-outcomes">{groups.map(([key, title]) => <section key={key} aria-label={title}><h3>{title} <span>{facts.counts[key]}</span></h3>
        {key === 'gaps' ? facts.gapGroups?.length ? facts.gapGroups.map(group => <div className="review-item review-gap-group" key={group.title}><span>{group.title}</span>{group.count > 1 && <small>× {group.count.toLocaleString()}</small>}</div>) : <p className="muted">None recorded.</p> : facts.counts[key] ? Array.from({ length: shown[key] }, (_, page) => pages[page] && <OutcomesPage key={page} data={pages[page]} group={key} close={leave} />) : <p className="muted">None recorded.</p>}
        {key !== 'gaps' && more(key, facts.counts[key], ROWS_PER_PAGE)}
      </section>)}</div></div>
    </div>}
  </ReadingDialog>;
}

const outcomeMark = { passed: '✓', failed: '✗', unknown: '?' } as const;
const outcomeWord = { passed: 'passed', failed: 'failed', unknown: 'outcome not recorded' } as const;

/** READ-5: one line per captured edit. The turn is the edit's own position; a test run is linked only when one was recorded after it in the same turn. */
function FileEdits({ stat, close }: { stat?: SinceFileStat; close: () => void }) {
  if (!stat?.fileEdits?.length) return null;
  const open = (operationId: string) => { useApp.getState().select(operationId); close(); };
  return <ol className="review-file-edits" aria-label="Edits of this file">{stat.fileEdits.map(edit => <li key={edit.operationId}>
    <button className="review-edit" title="Open this edit" onClick={() => open(edit.operationId)}>{edit.turn ? `turn ${edit.turn}` : <span title="No position for this edit, so its turn is not claimed">unattributed</span>} · <b className="add">+{edit.added}</b>{!!edit.removed && <> <b className="del">−{edit.removed}</b></>}</button>
    {edit.nextTest && <button className={`review-edit-test ${edit.nextTest.outcome}`} title="The first test run after this edit in the same turn; order, not a verdict on the edit" aria-label={`Next test run in this turn: ${outcomeWord[edit.nextTest.outcome]}`} onClick={() => open(edit.nextTest!.operationId)}>→ next test run <span aria-hidden="true">{outcomeMark[edit.nextTest.outcome]}</span></button>}
  </li>)}{stat.edits > stat.fileEdits.length && <li className="muted">{stat.edits - stat.fileEdits.length} more captured {stat.edits - stat.fileEdits.length === 1 ? 'edit' : 'edits'}</li>}</ol>;
}
