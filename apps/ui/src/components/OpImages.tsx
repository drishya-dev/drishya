import { useEffect, useRef, useState } from 'react';
import type { Operation, OperationImage } from '@drishya/contracts';
import { useApp } from '../state.ts';
import './op-images.css';

const size = (bytes?: number) => bytes === undefined ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const WHY: Record<string, string> = {
  'too-large': 'larger than the 4 MB kept per image',
  'recording-budget': 'past the 256 MB of images kept per session',
  protected: 'from a protected file',
  unrecognised: 'not a recognised image type',
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
      const label = `Captured image${img.width && img.height ? ` · ${img.width}×${img.height}` : ''}${img.bytes ? ` · ${size(img.bytes)}` : ''}`;
      return src
        ? <button type="button" key={i} className="op-image" title={`${label} · open`} aria-label={`Open ${label.toLowerCase()}`} onClick={() => setOpen(img)}
            style={img.width && img.height ? { aspectRatio: `${img.width} / ${img.height}` } : undefined}>
            <img src={src} alt="" loading="lazy" decoding="async" width={img.width} height={img.height} />
          </button>
        : <div key={i} className="op-image-missing" title={label}>Image {img.omitted ? `not kept: ${WHY[img.omitted] ?? img.omitted}` : 'not available here'}{img.bytes ? ` · ${size(img.bytes)}` : ''}</div>;
    })}
    {compact && images.length > 3 && <span className="op-images-more">+{images.length - 3} more</span>}
    {open && url(open) && <ImageReader src={url(open)!} image={open} onClose={() => setOpen(undefined)} />}
  </div>;
}

/** The whole image: fitted first, actual pixels on click; Escape or the backdrop closes it. */
function ImageReader({ src, image, onClose }: { src: string; image: OperationImage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="image-reader" onClose={onClose} onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
    <div className="image-reader-bar">
      <span>Captured image{image.width && image.height ? ` · ${image.width}×${image.height}` : ''}{image.bytes ? ` · ${size(image.bytes)}` : ''}</span>
      <button type="button" onClick={() => setActual((v) => !v)}>{actual ? 'Fit' : 'Actual size'}</button>
      <button type="button" onClick={() => dialog.current?.close()}>Close</button>
    </div>
    <div className={`image-reader-stage${actual ? ' actual' : ''}`}><img src={src} alt="Captured image" onClick={() => setActual((v) => !v)} /></div>
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
  const [state, setState] = useState<{ url: string; modified?: string } | { error: string } | 'loading'>();
  const canOpen = !!source?.currentImageUrl && !!recordingId && !recordingId.includes('+');
  const open = async () => {
    setState('loading');
    try {
      const url = source!.currentImageUrl!(recordingId!, op.id);
      // Checked first so a refusal can be explained; the image then loads from the same address
      // (the page policy allows same-origin images, not blob: URLs).
      const response = await fetch(url);
      if (!response.ok) {
        const reason = response.status === 403 && /approve/.test(await response.text()) ? 'Allow workspace reading for this session to open the current file.' : response.status === 404 ? 'The file is no longer there.' : response.status === 415 ? 'The current file is not a PNG, JPEG, GIF or WebP image.' : response.status === 413 ? 'The current file is larger than 4 MB.' : 'The current file could not be opened here.';
        setState({ error: reason });
        return;
      }
      await response.arrayBuffer();
      setState({ url, modified: response.headers.get('x-drishya-modified-at') ?? undefined });
    } catch { setState({ error: 'The current file could not be opened here.' }); }
  };
  return <div className="path-image" onClick={(e) => e.stopPropagation()}>
    <div className="path-image-line">
      <span className="path-image-path">{path}</span>
      <span>image bytes not captured</span>
      {canOpen && state === undefined && <button type="button" className="path-image-open" onClick={() => void open()}>Open current file</button>}
    </div>
    {state === 'loading' && <div className="path-image-line">Opening the current file…</div>}
    {state && typeof state === 'object' && 'error' in state && <div className="path-image-line">{state.error}</div>}
    {state && typeof state === 'object' && 'url' in state && <figure className="path-image-current">
      <img src={state.url} alt="Current file" />
      <figcaption>Current file{state.modified ? `, modified ${new Date(state.modified).toLocaleString()}` : ''}. It may differ from what the agent saw.</figcaption>
    </figure>}
  </div>;
}
