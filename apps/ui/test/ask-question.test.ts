import { expect, it } from 'vitest';
import { askQuestions } from '../src/lib/ask-question.ts';

const input = { questions: [
  { question: 'Which area?', header: 'Area', multiSelect: false, options: [{ label: 'Cart', description: 'totals' }, { label: 'Checkout' }] },
  { question: 'What is off?', header: 'Off', multiSelect: true, options: [{ label: 'Too slow' }, { label: 'Wrong field' }, { label: 'Not novel' }] },
] };

it('reads questions with their options and no answer while pending', () => {
  const [first, second] = askQuestions(input);
  expect(first).toMatchObject({ question: 'Which area?', header: 'Area', multiSelect: false, chosen: [] });
  expect(first!.options).toEqual([{ label: 'Cart', description: 'totals' }, { label: 'Checkout' }]);
  expect(second!.multiSelect).toBe(true);
  expect(first!.answer).toBeUndefined();
});
it('marks the chosen option, several for multi-select, and keeps typed words separate', () => {
  const result = 'The user answered: "Which area?"="Cart", "What is off?"="Too slow, Not novel, and also the font is tiny".';
  const [first, second] = askQuestions(input, result);
  expect(first).toMatchObject({ answer: 'Cart', chosen: ['Cart'] });
  expect(first!.typed).toBeUndefined();
  expect(second!.chosen).toEqual(['Too slow', 'Not novel']);
  expect(second!.typed).toContain('font is tiny');
});
it('shows a fully typed answer as typed, and survives odd input', () => {
  const [first] = askQuestions(input, 'The user answered: "Which area?"="something else entirely"');
  expect(first).toMatchObject({ chosen: [], typed: 'something else entirely' });
  expect(askQuestions(null)).toEqual([]);
  expect(askQuestions({ questions: [{ question: 'x' }] })).toEqual([]);
});

it('keeps a question whose options the capture reduced to placeholders, with its answer', () => {
  const bounded = { questions: [{ question: 'What is off?', header: 'Off', multiSelect: true, options: ['{…}', '{…}'] }] };
  const [only] = askQuestions(bounded, 'The user answered: "What is off?"="too slow, and the font"');
  expect(only!.options).toEqual([]);
  expect(only).toMatchObject({ answer: 'too slow, and the font', typed: 'too slow, and the font', chosen: [] });
});
