import { useEffect, useMemo, useRef, useState } from 'react';
import type { Operation, OperationImage } from '@drishya/contracts';
import { useApp } from '../state.ts';
import './op-images.css';

const size = (bytes?: number) => bytes === undefined ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const WHY: Record<string, string> = {
  'too-large': 'larger than the 4 MB kept per image',
  'recording-budget': 'past the 256 MB of images kept per session',
  protected: 'from a protected file',
  unrecognised: 'not a recognised image type',
  remote: 'a remote reference; never fetched automatically',
};

/**
 * CONTENT-1: images an action returned, as the agent received them. Thumbnails load only when on
 * screen, with their size reserved; the full image opens on request. Nothing is fetched from elsewhere.
 */
export function OpImages({ images, compact = false }: { images: OperationImage[]; compact?: boolean }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const [open, setOpen] = useState<OperationImage>();
  const url = (img: OperationImage) => img.sha && source?.imageUrl && recordingId ? source.imageUrl(recordingId, img.sha) : undefined;
  const shown = compact ? images.slice(0, 3) : images;
  return <div className={`op-images${compact ? ' compact' : ''}`} onClick={(e) => e.stopPropagation()}>
    {shown.map((img, i) => {
      const src = url(img);
      const label = `Image${img.width && img.height ? ` · ${img.width}×${img.height}` : ''}${img.bytes ? ` · ${size(img.bytes)}` : ''}`;
      return src
        ? <ImageThumbnail key={`${i}:${src}`} src={src} image={img} label={label} onOpen={() => setOpen(img)} />
        : <div key={i} className="op-image-missing" title={label}>Image {img.omitted ? `not kept: ${WHY[img.omitted] ?? img.omitted}` : 'not available here'}{img.bytes ? ` · ${size(img.bytes)}` : ''}</div>;
    })}
    {compact && images.length > 3 && <span className="op-images-more">+{images.length - 3} more</span>}
    {open && url(open) && <ImageReader src={url(open)!} image={open} onClose={() => setOpen(undefined)} />}
  </div>;
}

/** Keep the reserved thumbnail size even when bytes have expired or the request fails. */
function ImageThumbnail({ src, image, label, onOpen }: { src: string; image: OperationImage; label: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="op-image" title={`${label} · open`} aria-label={`Open ${label.toLowerCase()}`} onClick={onOpen}
    style={image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}>
    {failed ? <span className="op-image-missing">Image could not be loaded · open to retry</span>
      : <img src={src} alt="" loading="lazy" decoding="async" width={image.width} height={image.height} onError={() => setFailed(true)} />}
  </button>;
}

/** The whole image: fitted first, actual pixels on click; Escape or the backdrop closes it. */
function ImageReader({ src, image, onClose, currentCaption }: { src: string; image: OperationImage; onClose: () => void; currentCaption?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  // Explicit retry bypasses a cached failed response without changing the image's hash/owner.
  const imageSrc = retry ? `${src}${src.includes('?') ? '&' : '?'}retry=${retry}` : src;
  useEffect(() => { dialog.current?.showModal(); }, []);
  const caption = currentCaption ?? `Image${image.width && image.height ? ` · ${image.width}×${image.height}` : ''}${image.bytes ? ` · ${size(image.bytes)}` : ''}`;
  return <dialog ref={dialog} className="image-reader" aria-label={currentCaption ? 'Current image reader' : 'Image reader'} onClose={onClose} onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
    <div className="image-reader-bar">
      <span title={caption}>{caption}</span>
      <button type="button" disabled={failed} aria-pressed={actual} onClick={() => setActual((v) => !v)}>{actual ? 'Fit' : 'Actual size'}</button>
      <button type="button" onClick={() => dialog.current?.close()}>Close</button>
    </div>
    {currentCaption && <p className="image-reader-context">Current file. It may differ from what the agent saw.</p>}
    <div className={`image-reader-stage${actual ? ' actual' : ''}`}>
      {failed ? <div className="op-image-missing"><p role="status">{currentCaption ? 'Current file could not be loaded. It may have changed or become unavailable.' : 'Image could not be loaded. It may no longer be available.'}</p>
        <button type="button" className="btn ghost" onClick={() => { setFailed(false); setRetry((value) => value + 1); }}>Retry image</button></div>
        : <img key={retry} src={imageSrc} alt={currentCaption ? 'Current file' : 'Image'} onError={() => setFailed(true)} onClick={() => setActual((v) => !v)} />}
    </div>
  </dialog>;
}

const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i;

/** The image path an action referenced when its bytes were not captured (DATA-1 image items, Reads). */
export function pathOnlyImage(op: Operation): string | undefined {
  if (op.images?.some((img) => img.sha)) return undefined;
  // Text recorded for an image Read is not the image, so only kept bytes count as captured.
  if (op.detail.kind === 'read') return IMAGE_FILE.test(op.detail.path) ? op.detail.path : undefined;
  if (op.detail.kind === 'other') {
    const image = (op.detail.input as { image?: { path?: unknown; savedPath?: unknown } } | undefined)?.image;
    const path = image?.path ?? image?.savedPath;
    return typeof path === 'string' ? path : undefined;
  }
  return undefined;
}

/**
 * CONTENT-1 slice 3: an image known only by its path. Says so, and opens today's file on request,
 * under workspace approval, labelled as current: it may differ from what the agent saw.
 */
export function PathImage({ op, path }: { op: Operation; path: string }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  type Status = { url: string; modified?: string; request: number } | { error: string; consent?:boolean } | 'loading';
  // An older request or image error must not replace a different file/source's view.
  const owner = useMemo(() => ({}), [source, recordingId, op.id, path]);
  const latestOwner = useRef(owner); latestOwner.current = owner;
  const request = useRef(0);
  const [result, setResult] = useState<{ owner: object; value: Status }>();
  const [readerOwner, setReaderOwner] = useState<object>();
  const state = result?.owner === owner ? result.value : undefined;
  useEffect(() => () => { request.current++; }, [owner]);
  const remote = /^https?:\/\//i.test(path) || /^[\\/]{2}/.test(path) || /^file:\/\/[^/]/i.test(path) && !/^file:\/\/localhost\//i.test(path);
  const canOpen = !remote && !!source?.currentImageUrl && !!recordingId && !recordingId.includes('+');
  const open = async (grant=false) => {
    if (!canOpen) return;
    const currentRequest = ++request.current;
    const current = () => latestOwner.current === owner && request.current === currentRequest && useApp.getState().source === source && useApp.getState().recordingId === recordingId;
    const update = (value: Status) => { if (current()) setResult({ owner, value }); };
    update('loading');
    try {
      if(grant)await source!.approveCurrentImage!(recordingId!,op.id);
      const url = source!.currentImageUrl!(recordingId!, op.id);
      // Checked first so a refusal can be explained; the image then loads from the same address
      // (the page policy allows same-origin images, not blob: URLs).
      const response = await fetch(url);
      if (!response.ok) {
        const reason = response.status === 403 ? /approve/.test(await response.text()) ? 'Allow workspace reading for this session to open the current file.' : 'This image is outside the readable workspace or protected.' : response.status === 404 ? 'The file is no longer there.' : response.status === 415 ? 'The current file is not a PNG, JPEG, GIF or WebP image.' : response.status === 413 ? 'The current file is larger than 4 MB.' : 'The current file could not be opened here.';
        update({ error: reason,consent:response.status===409||response.status===403&&!reason.startsWith('Allow workspace') });
        return;
      }
      await response.arrayBuffer();
      update({ url, modified: response.headers.get('x-drishya-modified-at') ?? undefined, request: currentRequest });
    } catch { update({ error: 'The current file could not be opened here.' }); }
  };
  return <div className="path-image" onClick={(e) => e.stopPropagation()}>
    {op.images?.length?<OpImages images={op.images} compact/>:null}
    <div className="path-image-line">
      <span className="path-image-path">{path}</span>
      <span>image bytes not recorded</span>
      {canOpen && (state === undefined || typeof state === 'object' && 'error' in state) && <button type="button" className="path-image-open" onClick={() => void open()}>{state ? 'Retry current file' : 'Open current file'}</button>}
    </div>
    {state&&typeof state==='object'&&'error'in state&&state.consent&&source?.approveCurrentImage&&<div className="path-image-consent">
      <p>This image is outside ordinary workspace reading. Allow only this file's current image bytes for this server session? Its contents may have changed.</p>
      <button type="button" onClick={()=>void open(true)}>Allow this image only</button>
    </div>}
    {remote && <div className="path-image-line">Remote image reference · never fetched automatically.</div>}
    {state === 'loading' && <div className="path-image-line">Opening the current file…</div>}
    {state && typeof state === 'object' && 'error' in state && <div className="path-image-line" role="status">{state.error}</div>}
    {state && typeof state === 'object' && 'url' in state && <figure className="path-image-current">
      <button type="button" className="path-image-reader-open" aria-label="Open current image reader" onClick={() => setReaderOwner(owner)}>
        <img src={state.url} alt="Current file" onError={() => { if (latestOwner.current === owner && request.current === state.request) setResult({ owner, value: { error: 'The current file could not be loaded. It may have changed or become unavailable.' } }); }} />
      </button>
      <figcaption>Current file{state.modified ? `, modified ${new Date(state.modified).toLocaleString()}` : ''}. It may differ from what the agent saw.</figcaption>
      {readerOwner === owner && <ImageReader src={state.url} image={{}} currentCaption={`Current file${state.modified ? `, modified ${new Date(state.modified).toLocaleString()}` : ''}. It may differ from what the agent saw.`} onClose={() => setReaderOwner(undefined)} />}
    </figure>}
  </div>;
}
