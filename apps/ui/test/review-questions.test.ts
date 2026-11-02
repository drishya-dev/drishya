import { expect, it } from 'vitest';
import { readQuestions, saveQuestion, type ReviewQuestion } from '../src/lib/review-questions.ts';
const question = (id: string): ReviewQuestion => ({ id, operationId: 'captured-op', title: 'Read source', sequence: 2, question: 'What happens at zero?', owner: 'Reviewer', status: 'open', createdAt: '', updatedAt: '' });
it('updates the same anchored question and preserves a manually resolved status', () => {
  const saved = saveQuestion([], question('one'));
  expect(saveQuestion(saved, { ...saved[0]!, status: 'resolved' })).toHaveLength(1);
  expect(saveQuestion(saved, { ...saved[0]!, status: 'resolved' })[0]?.operationId).toBe('captured-op');
});
it('redacts notes and rejects corrupt/duplicate anchors without truncating evidence identities', () => {
  const result = readQuestions(JSON.stringify([question('one'), question('one'), { ...question('long'), operationId: 'x'.repeat(513) }, { ...question('secret'), question: 'sk-proj-abcdefghijklmnopqrstuvw0123456789' }]));
  expect(result).toHaveLength(2); expect(result[1]!.question).not.toContain('abcdefghijklmnop');
  expect(readQuestions('{}')).toEqual([]);
});
it('refuses a new question at the bound instead of silently discarding unresolved decisions', () => {
  const full = Array.from({ length: 100 }, (_, n) => question(`${n}`));
  expect(() => saveQuestion(full, question('new'))).toThrow('Question limit reached');
  expect(saveQuestion(full, { ...full[0]!, status: 'resolved' })).toHaveLength(100);
});
it('does not relabel old saved timeline positions as observations',()=>{
  expect(readQuestions(JSON.stringify([question('old')]))[0]!.sequenceBasis).toBe('timeline-position');
  expect(saveQuestion([],{...question('new'),sequenceBasis:'captured-observation'})[0]!.sequenceBasis).toBe('captured-observation');
});
