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

it("never shows Claude Code's trailing instruction as the person's words", () => {
  const input = { questions: [{ question: 'Which area?', options: [{ label: 'Cart' }, { label: 'Checkout' }] }] };
  const typed = askQuestions(input, 'User has answered your questions: "Which area?"="Both, but start small". Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say')[0]!;
  expect(typed.typed).toBe('Both, but start small');
  const chosen = askQuestions(input, 'User has answered your questions: "Which area?"="Checkout". You can now continue with the user\'s answers in mind.')[0]!;
  expect(chosen.chosen).toEqual(['Checkout']);
  expect(chosen.typed).toBeUndefined();
});


it('does not infer selected options from words inside a typed answer', () => {
  const input={questions:[{question:'Deploy?',multiSelect:true,options:[{label:'Docker'},{label:'No'}]}]};
  const q=askQuestions(input,'The user answered: "Deploy?"="Do not use Docker. Nothing yet.".')[0]!;
  expect(q.chosen).toEqual([]);
  expect(q.typed).toBe('Do not use Docker. Nothing yet.');
});

it('keeps typed words intact when a chosen label is a substring of earlier prose', () => {
  const input={questions:[{question:'Area?',multiSelect:true,options:[{label:'Cart'},{label:'Checkout'}]}]};
  const q=askQuestions(input,'The user answered: "Area?"="Cartography, Cart".')[0]!;
  expect(q.chosen).toEqual(['Cart']);expect(q.typed).toBe('Cartography');
});

it('preserves punctuation and quotes inside the captured answer framing', () => {
  const input={questions:[{question:'Next?',options:[{label:'Continue'}]}]};
  const literal='"Keep quotes", and punctuation...';
  const q=askQuestions(input,`The user answered: "Next?"="${literal}". You can now continue.`)[0]!;
  expect(q.answer).toBe(literal);expect(q.typed).toBe(literal);
});

it('ignores null and non-object question entries without crashing the surrounding card', () => {
  const input={questions:[null,42,'raw',[],{question:'Valid?',options:[null,{label:'Yes'}]}]};
  expect(askQuestions(input)).toMatchObject([{question:'Valid?',options:[{label:'Yes'}]}]);
});

it('does not guess between a comma-bearing option and multiple option names', () => {
  const input={questions:[{question:'Choose?',multiSelect:true,options:[{label:'A'},{label:'B'},{label:'A, B'}]}]};
  const q=askQuestions(input,'The user answered: "Choose?"="A, B".')[0]!;
  expect(q.chosen).toEqual([]);expect(q.typed).toBe('A, B');
});
