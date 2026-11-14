import { expect, it } from 'vitest';
import {
  askQuestions,
  isQuestionTool,
  questionAcceptance,
  recordQuestionReceipt,
  getQuestionReceipt,
  recordQuestionStop,
  isQuestionStopped,
  clearQuestionReceipts,
} from '../src/lib/ask-question.ts';

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

it('preserves punctuation and quotes inside the answer framing', () => {
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


it('does not attribute an offered selected preview or harness follow-up to the person', () => {
  const input={questions:[{question:'Name?',options:[{label:'Alpha'},{label:'Beta'}]}]};
  const result='Your questions have been answered: "Name?"="Alpha" selected preview:\nexample command\n"captured reference"\nexample.dev. You can now continue with these answers in mind.';
  const q=askQuestions(input,result)[0]!;
  expect(q.answer).toBe('Alpha');expect(q.chosen).toEqual(['Alpha']);expect(q.typed).toBeUndefined();
});

it('keeps preview wording when it is part of a typed answer rather than an offered option', () => {
  const input={questions:[{question:'Next?',options:[{label:'Continue'}]}]};
  const literal='This " selected preview: remains my answer.';
  const q=askQuestions(input,`The user answered: "Next?"="${literal}". You can now continue.`)[0]!;
  expect(q.answer).toBe(literal);expect(q.typed).toBe(literal);expect(q.chosen).toEqual([]);
});

// Codex's request_user_input_async, in the shape real journals record: a `title`, options as plain strings (or none), and a
// result that only says whether the question was accepted.
it('reads a Codex question: title as the question, string options, and no invented answer', () => {
  const [withOptions, bare] = askQuestions({ questions: [{ title: 'Which approach?', options: ['Small patch', 'Rewrite'] }, { title: 'Anything else?' }] }, '{"accepted":true}');
  expect(withOptions).toMatchObject({ question: 'Which approach?', multiSelect: false, chosen: [] });
  expect(withOptions!.options).toEqual([{ label: 'Small patch' }, { label: 'Rewrite' }]);
  expect(withOptions!.answer).toBeUndefined();
  expect(bare).toMatchObject({ question: 'Anything else?', options: [], chosen: [] });
});
it('knows both question tools and reads Codex acceptance only from its own result shape', () => {
  expect(isQuestionTool('AskUserQuestion') && isQuestionTool('request_user_input_async')).toBe(true);
  expect(isQuestionTool('Read')).toBe(false);
  expect(questionAcceptance('{"accepted":true}')).toBe(true);
  expect(questionAcceptance('{"accepted":false}')).toBe(false);
  expect(questionAcceptance('The user answered: "A"="B"')).toBeUndefined();
  expect(questionAcceptance(undefined)).toBeUndefined();
});

it('reads native Codex keyed answer arrays without treating an acknowledgement as an answer', () => {
  const input={questions:[{id:'check',question:'Which check?',options:[{label:'Alpha'},{label:'Beta'}]}]};
  expect(isQuestionTool('request_user_input')).toBe(true);
  expect(askQuestions(input,'{"answers":{"check":{"answers":["Alpha"]}}}')[0]).toMatchObject({answer:'Alpha',chosen:['Alpha']});
  expect(askQuestions(input,'{"answers":{"other":{"answers":["Alpha"]}}}')[0]!.answer).toBeUndefined();
  expect(askQuestions(input,'{"accepted":true}')[0]!.answer).toBeUndefined();
});

it('stores and retrieves question receipts distinct from journal results', () => {
  clearQuestionReceipts();
  expect(getQuestionReceipt('rec-1', 'op-1')).toBeUndefined();
  const questions = askQuestions({ questions: [{ id: 'q0', question: 'Which area?', options: [{ label: 'Cart' }, { label: 'Checkout' }] }] });
  recordQuestionReceipt('rec-1', 'op-1', { q0: { options: ['Cart'], text: 'custom note' } }, questions);
  const receipt = getQuestionReceipt('rec-1', 'op-1');
  expect(receipt).toBeDefined();
  expect(receipt?.chosen).toEqual(['Cart']);
  expect(receipt?.typed).toBe('custom note');
  expect(getQuestionReceipt('rec-1', 'op-2')).toBeUndefined();
});

it('records and checks deliberate stop status for a question operation', () => {
  clearQuestionReceipts();
  expect(isQuestionStopped('rec-1', 'op-1')).toBe(false);
  recordQuestionStop('rec-1', 'op-1');
  expect(isQuestionStopped('rec-1', 'op-1')).toBe(true);
  expect(isQuestionStopped('rec-1', 'op-2')).toBe(false);
  clearQuestionReceipts();
  expect(isQuestionStopped('rec-1', 'op-1')).toBe(false);
});
