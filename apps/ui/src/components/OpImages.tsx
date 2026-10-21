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
export function OpImages({ op, compact = false }: { op: Operation; compact?: boolean }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const [open, setOpen] = useState<OperationImage>();
  const images = op.images ?? [];
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
