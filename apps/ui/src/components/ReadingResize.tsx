/** A captured pointer and keyboard equivalent make reading space adjustable without execution. */
export function ReadingResize({ value, minimum, maximum, change, label, fromRight = false }: { value: number; minimum: number; maximum: number; change: (width: number) => void; label: string; fromRight?: boolean }) {
  const clamp = (width: number) => Math.max(minimum, Math.min(maximum, width));
  return <div className="reading-resize" role="separator" aria-label={label} aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(value)} tabIndex={0}
    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }}
    onPointerMove={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const rect = e.currentTarget.parentElement!.getBoundingClientRect(); change(clamp(fromRight ? rect.right - e.clientX : e.clientX - rect.left)); }}
    onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
    onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const direction = fromRight ? -1 : 1; change(e.key === 'Home' ? minimum : e.key === 'End' ? maximum : clamp(value + (e.key === 'ArrowRight' ? 32 : -32) * direction)); }} />;
}
