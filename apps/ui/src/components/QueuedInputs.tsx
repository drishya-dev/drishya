import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {QueueInputChunk, QueuePage, QueueReceipt} from '@drishya/contracts';
import {useApp} from '../state.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {OriginalToggle} from './OriginalToggle.tsx';
import './queued-inputs.css';

const labels = {recorded: 'Queue receipt recorded', unknown: 'Queue changed · item outcome unknown', removed: 'Removed from queue', delivered: 'Delivered · matching prompt in History'};

/** A harness notification is shown by its kind, not as markup; the full recorded text stays one click away. */
function receiptName(item: QueueReceipt): string {
  const tag = item.preview?.match(/^\s*<([a-z][\w-]*)[\s>]/i)?.[1];
  if (tag) return tag.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
  return item.preview || (item.images?.length ? 'Image input' : 'Input with no text');
}
const textless = (item: QueueReceipt) => !item.preview && !item.images?.length;
/** A notification the harness wrapped in one element whose children are named fields reads as those fields; anything else stays as recorded.
 *  Only the loaded text is read, and the fields are shown exactly as written; nothing is inferred. */
function notificationFields(text: string): {name: string; value: string}[] | undefined {
  const body = text.match(/^\s*<([a-z][\w-]*)>([\s\S]*)<\/\1>\s*$/i)?.[2];
  if (body === undefined) return undefined;
  const fields = [...body.matchAll(/<([a-z][\w-]*)>([\s\S]*?)<\/\1>/gi)].map(match => ({name: match[1]!.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase()), value: match[2]!.trim()}));
  return fields.length ? fields : undefined;
}

/** A provisional receipt never becomes a prompt by inference. Reading it does not send anything. */
export function QueuedInputs({standalone = false}: {standalone?: boolean}) {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId), mode = useApp(s => s.mode);
  // Past receipts are for the end of the session; while reading back they would sit on top of the text.
  const projection = useApp(s => s.projection), page = useApp(s => s.historyPage), step = useApp(s => s.step);
  const revision = useApp(s => s.recording?.revision);
  const [loaded, setLoaded] = useState<{key: string; page: QueuePage}>(), [open, setOpen] = useState(false), [history, setHistory] = useState(false);
  const [selected, select] = useState<QueueReceipt>(), [chunk, setChunk] = useState<QueueInputChunk>();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false), [original, setOriginal] = useState(false);
  const fields = chunk && !chunk.hasMore ? notificationFields(chunk.text) : undefined;
  const cursor = useRef<{key: string; before?: number}>({key: ''});
  const request = useRef(0), reading = useRef(0), active = useRef(true);
  useEffect(() => {active.current = true; return () => {active.current = false; request.current++; reading.current++;};}, []);
  const materialBoundary = !page ? projection?.timeline.slice(0, step).findLast(item => item.type === 'queue') : undefined;
  const boundary = mode === 'replay' ? page ? page.queueBoundary : materialBoundary?.type === 'queue' ? {ownerRecordingId: materialBoundary.ownerRecordingId, observationId: materialBoundary.sourceObservationId} : undefined : undefined;
  const owner = mode === 'replay' ? boundary?.ownerRecordingId : id;
  const through = boundary?.observationId;
  const baseKey = `${owner ?? ''}/${mode}/${through ?? ''}`;
  const viewKey = `${baseKey}/${mode === 'replay' ? step : ''}`;
  const key = `${viewKey}/${history ? 'history' : 'pending'}`;
  const totals = loaded?.key.startsWith(`${viewKey}/`) ? loaded.page : undefined;
  const data = loaded?.key === key ? loaded.page : undefined;
  const load = async (before = cursor.current.key === key ? cursor.current.before : undefined) => {
    if (!owner || !source?.queue || owner.includes('+') || mode === 'replay' && !through) return;
    cursor.current = {key, before};
    const token = ++request.current;
    try {
      const next = await source.queue(owner, {before, state:history ? 'history' : 'pending', ...(mode === 'replay' ? {step} : {})});
      if (active.current && token === request.current) {setLoaded({key, page: next}); select(previous=>previous ? next.items.find(item=>item.id===previous.id) : undefined); setError('');}
    } catch {if (active.current && token === request.current) setError('Queue receipts could not be loaded.');}
  };
  useEffect(() => {void load(); return () => {request.current++;};}, [source, key, mode === 'history' ? revision : undefined]);
  useEffect(() => {select(undefined); setChunk(undefined); setBusy(false); reading.current++;}, [key]);
  useEffect(() => {setOpen(false); select(undefined); setChunk(undefined); setError(''); reading.current++; setHistory(false);}, [baseKey]);
  useEffect(() => {
    if (!selected || !source?.queueInput || !owner) return;
    // A receipt with no text has nothing to read; asking would only report a failure.
    if (textless(selected)) {setChunk(undefined); setError(''); return;}
    const token = ++reading.current;
    setChunk(undefined); setBusy(true); setCopied(false); setError('');
    void source.queueInput(owner, selected.id, through).then(next => {
      if (active.current && token === reading.current) setChunk(next);
    }).catch(() => {if (active.current && token === reading.current) setError('The input text is unavailable. Its image references remain below.');})
      .finally(() => {if (active.current && token === reading.current) setBusy(false);});
    return () => {reading.current++;};
  }, [selected?.id, source, owner, through]);
  const more = async (copy = false) => {
    if (!selected || !source?.queueInput || !owner || !chunk || busy) return;
    const token = reading.current; setBusy(true); setError('');
    try {
      let next = chunk;
      do {
        if (!next.hasMore) break;
        const tail = await source.queueInput(owner, selected.id, through, next.next);
        if (!active.current || token !== reading.current) return;
        if (tail.start !== next.next || tail.next <= next.next) throw Error('Incomplete input continuation.');
        next = {...tail, start: 0, text: next.text + tail.text};
        if (!copy) break;
      } while (true);
      if (!active.current || token !== reading.current) return;
      setChunk(next);
      if (copy) {await navigator.clipboard.writeText(next.text); if (active.current && token === reading.current) setCopied(true);}
    } catch {if (active.current && token === reading.current) setError('The complete input could not be read or copied. Retry the reading.');}
    finally {if (active.current && token === reading.current) setBusy(false);}
  };
  const latest = data?.items[0], pending = totals?.pendingTotal ?? totals?.items.filter(item => item.state === 'recorded').length ?? 0, waiting = pending > 0;
  if (!source?.queue || !owner || mode === 'replay' && !through || !waiting && !error && !open) return null;
  // Replay hides the composer, so its receipts sit on the page itself, like an exported bundle's.
  const floating = standalone || mode === 'replay';
  const view = <div className="queued-input-receipts" data-waiting={waiting || undefined} data-floating={floating || undefined}>
    <button type="button" className="queued-input-trigger" aria-label="Read queued inputs" onClick={() => {setOpen(true); const first = data?.items.find(item => !textless(item) && !/^\s*</.test(item.preview ?? '')) ?? data?.items.find(item => !textless(item)) ?? latest; if (first) select(first);}}>
      <span aria-live="polite">{`Queued inputs${pending ? ` · ${pending}` : ''}`}</span>
    </button>
    {open && <ReadingDialog title="Queued inputs" close={() => {setOpen(false); select(undefined); setError('');}} className="queue-input-reader" style={{width: 'min(880px, calc(100vw - 32px))'}}>
      <div className="queue-reader">
        <p className="queue-caveat" title="Receipts show what the harness recorded in its queue. They do not establish delivery or inclusion in context. Delivered prompts appear separately in History.">{history ? 'Earlier queue receipts · history. Delivered prompts appear in History.' : 'Inputs still waiting in the recorded queue.'}</p>
        {source.kind === 'bundle' && data?.completionEvidence === false && <p className="queue-caveat">This replay has no exact completed-turn boundaries. Unmatched receipts may still appear as waiting.</p>}
        <div className="queue-columns">
        <div className="queue-list-column">
        {!data?.items.length && <p className="queue-empty">{!data ? 'Loading queue receipts…' : history ? 'No earlier receipts on this page.' : 'No inputs waiting.'}</p>}
        {!!data?.items.length && <div className="queue-list" aria-label="Queued input receipts">
          {data.items.map(item => <button type="button" key={item.id} className="queue-row" aria-label={`${receiptName(item)} · ${labels[item.state]}`} aria-pressed={selected?.id === item.id} onClick={() => select(item)} title={item.preview}>
            <span className="queue-row-text">{receiptName(item)}</span>
            <small>{item.time && <time dateTime={item.time}>{new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</time>}{item.time && ' · '}{labels[item.state]}</small>
          </button>)}
        </div>}
        <div className="queue-pages">
          {!history && !!data && data.total > pending && <button type="button" className="btn ghost small" onClick={() => {select(undefined); setHistory(true);}}>Earlier receipts · history</button>}
          {history && <button type="button" className="btn ghost small" onClick={() => {select(undefined); setHistory(false);}}>Back to queued inputs</button>}
          {data?.before !== undefined && <button type="button" className="btn ghost small" onClick={() => {select(undefined); void load(data.before);}}>Earlier receipts</button>}
          {!!data && cursor.current.before !== undefined && <button type="button" className="btn ghost small" onClick={() => {cursor.current = {key}; select(undefined); void load();}}>Newest receipts</button>}
          <small className="muted">{pending} waiting · {data?.total ?? 0} recorded enqueue receipts{mode === 'replay' ? ' at this replay point' : ''}</small>
        </div>
        </div>
        {selected && <section className="queue-detail" aria-label="Queued input">
          {chunk && fields && <OriginalToggle original={original} onToggle={() => setOriginal(value => !value)}/>}
          <p className="queue-detail-head"><strong>{labels[(data?.items.find(item => item.id === selected.id) ?? selected).state]}</strong>{selected.time && <> · <time dateTime={selected.time}>{new Date(selected.time).toLocaleString()}</time></>}</p>
          {textless(selected) && <p className="queue-empty">No text recorded with this receipt.</p>}
          {chunk && <>
            {fields && !original ? <dl className="queue-fields">{fields.map((field, index) => <div key={index}><dt>{field.name}</dt><dd>{field.value || '—'}</dd></div>)}</dl> : <pre className="queue-text" data-queued-input-text>{chunk.text || 'No text recorded.'}</pre>}
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>{chunk.hasMore && <button type="button" className="btn small" disabled={busy} onClick={() => void more()}>Read more input</button>}<button type="button" className="btn ghost small" disabled={busy} onClick={() => void more(true)}>{copied ? 'Copied' : 'Copy complete input'}</button></div>
          </>}
          {selected.images?.map((image, index) => image.sha && source.imageUrl
            ? <img key={image.sha + index} alt={`Queued input image ${index + 1}`} src={source.imageUrl(owner, image.sha)} style={{display: 'block', maxWidth: '100%', maxHeight: '65dvh', objectFit: 'contain', margin: '12px auto'}} />
            : <p key={index} className="muted small">Image bytes not kept{image.omitted ? `: ${image.omitted}` : ''}.</p>)}
        </section>}
        </div>
        {busy && <p className="muted small" role="status">Reading input…</p>}
        {error && <p className="bad small" role="alert">{error} <button type="button" className="btn ghost small" onClick={() => void load()}>Retry receipts</button></p>}
      </div>
    </ReadingDialog>}
  </div>;
  return mode === 'replay' && !standalone ? createPortal(view, document.body) : view;
}
