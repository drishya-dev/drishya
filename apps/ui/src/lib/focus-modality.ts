const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
  'FnLock',
]);

/** Tracks the most recent input modality on `<html data-input-modality>` so pointer clicks and programmatic `.focus()` after pointer actions do not flash keyboard focus rings. */
export function installFocusModality(doc: Document = document): () => void {
  const root = doc.documentElement;
  root.dataset.inputModality = 'pointer';

  const onPointer = () => {
    root.dataset.inputModality = 'pointer';
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (MODIFIER_KEYS.has(event.key)) return;
    root.dataset.inputModality = 'keyboard';
  };

  doc.addEventListener('pointerdown', onPointer, { capture: true, passive: true });
  doc.addEventListener('mousedown', onPointer, { capture: true, passive: true });
  doc.addEventListener('keydown', onKeyDown, { capture: true, passive: true });

  return () => {
    doc.removeEventListener('pointerdown', onPointer, { capture: true });
    doc.removeEventListener('mousedown', onPointer, { capture: true });
    doc.removeEventListener('keydown', onKeyDown, { capture: true });
    delete root.dataset.inputModality;
  };
}
