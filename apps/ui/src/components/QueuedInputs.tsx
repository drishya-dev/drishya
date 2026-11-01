import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {QueueInputChunk, QueuePage, QueueReceipt} from '@drishya/contracts';
import {useApp} from '../state.ts';
import {ReadingDialog} from './ProductShell.tsx';

const labels = {recorded: 'Queue receipt recorded', unknown: 'Queue changed · item outcome unknown', removed: 'Removed from queue', delivered: 'Delivered · native identity confirmed'};

/** A provisional receipt never becomes a prompt by inference. Reading it does not send anything. */
export function QueuedInputs({standalone = false}: {standalone?: boolean}) {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId), mode = useApp(s => s.mode);
  // Past receipts are for the end of the session; while reading back they would sit on top of the text.
  const following = useApp(s => s.follow);
  const projection = useApp(s => s.projection), page = useApp(s => s.historyPage), step = useApp(s => s.step);
  const revision = useApp(s => s.recording?.revision);
  const [loaded, setLoaded] = useState<{key: string; page: QueuePage}>(), [open, setOpen] = useState(false);
  const [selected, select] = useState<QueueReceipt>(), [chunk, setChunk] = useState<QueueInputChunk>();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const cursor = useRef<{key: string; before?: number}>({key: ''});
  const request = useRef(0), reading = useRef(0), active = useRef(true);
  useEffect(() => {active.current = true; return () => {active.current = false; request.current++; reading.current++;};}, []);
  const materialBoundary = !page ? projection?.timeline.slice(0, step).findLast(item => item.type === 'queue') : undefined;
  const boundary = mode === 'replay' ? page ? page.queueBoundary : materialBoundary?.type === 'queue' ? {ownerRecordingId: materialBoundary.ownerRecordingId, observationId: materialBoundary.sourceObservationId} : undefined : undefined;
  const owner = mode === 'replay' ? boundary?.ownerRecordingId : id;
  const through = boundary?.observationId;
  const key = `${owner ?? ''}/${mode}/${through ?? ''}`;
  const data = loaded?.key === key ? loaded.page : undefined;
  const load = async (before = cursor.current.key === key ? cursor.current.before : undefined) => {
    if (!owner || !source?.queue || owner.includes('+') || mode === 'replay' && !through) return;
    cursor.current = {key, before};
    const token = ++request.current;
    try {
      const next = await source.queue(owner, {through, before});
      if (active.current && token === request.current) {setLoaded({key, page: next}); setError('');}
    } catch {if (active.current && token === request.current) setError('Recorded queue receipts could not be loaded.');}
  };
  useEffect(() => {void load(); return () => {request.current++;};}, [source, key, mode === 'history' ? revision : undefined]);
  useEffect(() => {setOpen(false); select(undefined); setChunk(undefined); setError(''); reading.current++;}, [key]);
  useEffect(() => {
    if (!selected || !source?.queueInput || !owner) return;
    const token = ++reading.current;
    setChunk(undefined); setBusy(true); setCopied(false); setError('');
    void source.queueInput(owner, selected.id, through).then(next => {
      if (active.current && token === reading.current) setChunk(next);
    }).catch(() => {if (active.current && token === reading.current) setError('The recorded input text is unavailable. Its image references remain below.');})
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
    } catch {if (active.current && token === reading.current) setError('The complete recorded input could not be read or copied. Retry the reading.');}
    finally {if (active.current && token === reading.current) setBusy(false);}
  };
  if (!source?.queue || !owner || mode === 'replay' && !through || !data?.total && !error) return null;
  const latest = data?.items[0], waiting = latest?.state === 'recorded';
  // Replay hides the composer, so its receipts sit on the page itself, like an exported bundle's.
  const floating = standalone || mode === 'replay';
  const view = <div className="queued-input-receipts" data-waiting={waiting || undefined} style={floating ? {position: 'fixed', right: 20, bottom: 72, zIndex: 12} : {position: 'absolute', left: 0, bottom: 'calc(100% + 8px)', padding: '0 4px'}}>
    <button type="button" className="btn ghost small" aria-label="Read recorded queued inputs" style={floating || waiting || following ? undefined : {visibility: 'hidden'}} onClick={() => {setOpen(true); if (latest) select(latest);}}>
      <span aria-live="polite">{waiting ? 'Queued input recorded' : `Queued inputs${data?.total ? ` · ${data.total}` : ''}`}</span>
    </button>
    {open && <ReadingDialog title="Recorded queued inputs" close={() => {setOpen(false); select(undefined); setError('');}} className="queue-input-reader" style={{width: 'min(880px, calc(100vw - 32px))'}}>
      <div style={{padding: '16px 20px', minWidth: 0}}>
        <p className="muted small">Receipts show what the harness recorded in its queue. They do not establish delivery or inclusion in context. Delivered prompts appear separately in History.</p>
        {!!data?.items.length && <div aria-label="Queued input receipts" style={{maxHeight: '160px', overflow: 'auto', display: 'grid', gap: 4, marginBottom: 14}}>
          {data.items.map(item => <button type="button" key={item.id} className={`btn ghost small${selected?.id === item.id ? ' active' : ''}`} aria-pressed={selected?.id === item.id} onClick={() => select(item)} style={{textAlign: 'left', justifyContent: 'flex-start', whiteSpace: 'normal', overflowWrap: 'anywhere'}}>
            {item.preview || (item.images?.length ? 'Image input' : 'Input without recorded text')} · {labels[item.state]}
          </button>)}
        </div>}
        <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12}}>
          {data?.before !== undefined && <button type="button" className="btn small" onClick={() => {select(undefined); void load(data.before);}}>Earlier receipts</button>}
          {!!data && cursor.current.before !== undefined && <button type="button" className="btn small" onClick={() => {cursor.current = {key}; select(undefined); void load();}}>Newest receipts</button>}
          <small className="muted">{data?.total ?? 0} recorded enqueue receipts{mode === 'replay' ? ' at this replay point' : ''}</small>
        </div>
        {selected && <section aria-label="Recorded queued input">
          <p className="small"><strong>{labels[(data?.items.find(item => item.id === selected.id) ?? selected).state]}</strong>{selected.time && <> · <time dateTime={selected.time}>{new Date(selected.time).toLocaleString()}</time></>}</p>
          {chunk && <><pre data-queued-input-text style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '48dvh', overflow: 'auto', userSelect: 'text', margin: '12px 0'}}>{chunk.text || 'No text recorded.'}</pre>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>{chunk.hasMore && <button type="button" className="btn small" disabled={busy} onClick={() => void more()}>Read more input</button>}<button type="button" className="btn ghost small" disabled={busy} onClick={() => void more(true)}>{copied ? 'Copied' : 'Copy complete input'}</button></div>
          </>}
          {selected.images?.map((image, index) => image.sha && source.imageUrl
            ? <img key={image.sha + index} alt={`Captured queued input image ${index + 1}`} src={source.imageUrl(owner, image.sha)} style={{display: 'block', maxWidth: '100%', maxHeight: '65dvh', objectFit: 'contain', margin: '12px auto'}} />
            : <p key={index} className="muted small">Image bytes not kept{image.omitted ? `: ${image.omitted}` : ''}.</p>)}
        </section>}
        {busy && <p className="muted small" role="status">Reading captured input…</p>}
        {error && <p className="bad small" role="alert">{error} <button type="button" className="btn ghost small" onClick={() => void load()}>Retry receipts</button></p>}
      </div>
    </ReadingDialog>}
  </div>;
  return mode === 'replay' && !standalone ? createPortal(view, document.body) : view;
}
