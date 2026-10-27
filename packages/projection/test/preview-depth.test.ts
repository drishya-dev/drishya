import { describe, expect, it } from 'vitest';
import { previewValue } from '../src/reduce.ts';

// CONTENT-3: a question's offered options sit four levels into AskUserQuestion's input. The general
// preview summarises past depth 3; the question tool keeps depth 5 so the card can list its options.
const input = { questions: [{ question: 'Which area?', header: 'Area', multiSelect: false, options: [{ label: 'Cart totals', description: 'src/cart' }, { label: 'Checkout' }] }] };

describe('previewValue depth', () => {
  it('summarises deep nesting by default', () => {
    const shown = previewValue(input) as typeof input;
    expect(shown.questions[0]!.options).toEqual(['{…}', '{…}']);
  });
  it('keeps option labels when the depth allows it', () => {
    const shown = previewValue(input, 0, 5) as typeof input;
    expect(shown.questions[0]!.options.map((option) => option.label)).toEqual(['Cart totals', 'Checkout']);
    expect(shown.questions[0]!.options[0]!.description).toBe('src/cart');
  });
  it('keeps the options of a Codex question at the default depth, because they are plain strings', () => {
    const codex = { questions: [{ title: 'Which area?', options: ['Cart totals', 'Checkout'] }] };
    expect(previewValue(codex)).toEqual(codex);
  });
});
