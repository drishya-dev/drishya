import { describe, expect, it } from 'vitest';
import { installFocusModality } from '../src/lib/focus-modality.ts';

function createMockDocument() {
  const target = new EventTarget();
  const documentElement = { dataset: {} as DOMStringMap };
  const doc = {
    documentElement,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  return {
    doc: doc as unknown as Document,
    dispatchKey(key: string) {
      const event = new Event('keydown');
      Object.defineProperty(event, 'key', { value: key });
      target.dispatchEvent(event);
    },
    dispatchPointer(type: 'pointerdown' | 'mousedown') {
      target.dispatchEvent(new Event(type));
    },
  };
}

describe('installFocusModality', () => {
  it('starts as pointer, switches to keyboard on non-modifier keys, and returns to pointer on pointer/mouse', () => {
    const { doc, dispatchKey, dispatchPointer } = createMockDocument();
    const cleanup = installFocusModality(doc);
    const root = doc.documentElement;

    expect(root.dataset.inputModality).toBe('pointer');

    // Bare modifier keys must not switch modality away from pointer.
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'FnLock']) {
      dispatchKey(key);
      expect(root.dataset.inputModality).toBe('pointer');
    }

    // Navigation / typing key switches to keyboard immediately in capture phase.
    dispatchKey('Tab');
    expect(root.dataset.inputModality).toBe('keyboard');

    // Pointer or mouse resets modality to pointer before click/focus handlers run.
    dispatchPointer('mousedown');
    expect(root.dataset.inputModality).toBe('pointer');

    dispatchKey('Escape');
    expect(root.dataset.inputModality).toBe('keyboard');

    dispatchPointer('pointerdown');
    expect(root.dataset.inputModality).toBe('pointer');

    cleanup();
    expect(root.dataset.inputModality).toBeUndefined();

    // After cleanup, further events do not re-attach the attribute.
    dispatchKey('Tab');
    expect(root.dataset.inputModality).toBeUndefined();
  });
});
