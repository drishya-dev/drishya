import { redactText } from '../../../../packages/privacy/src/index.ts';

export interface ReviewQuestion {
  id: string; operationId: string; title: string; sequence: number;
  question: string; owner: string; status: 'open' | 'resolved'; createdAt: string; updatedAt: string;
  sequenceBasis?:'captured-observation'|'timeline-position';
}
const clean = (text: string, limit: number) => redactText(text.slice(0, limit)).text;
export function readQuestions(raw: string): ReviewQuestion[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.slice(-100).flatMap(item => {
      if (!item || typeof item.id !== 'string' || item.id.length > 64 || typeof item.operationId !== 'string' || item.operationId.length > 512 || typeof item.question !== 'string' || typeof item.title !== 'string' || !Number.isSafeInteger(item.sequence) || item.sequence < 0 || seen.has(item.id)) return [];
      seen.add(item.id);
      return [{ id: item.id.slice(0, 64), operationId: item.operationId.slice(0, 512), title: clean(item.title, 160), sequence: item.sequence, sequenceBasis:item.sequenceBasis==='captured-observation'?'captured-observation' as const:'timeline-position' as const, question: clean(item.question, 2000), owner: clean(typeof item.owner === 'string' ? item.owner : '', 80), status: item.status === 'resolved' ? 'resolved' as const : 'open' as const, createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 40) : '', updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt.slice(0, 40) : '' }];
    });
  } catch { return []; }
}
export function saveQuestion(items: ReviewQuestion[], next: ReviewQuestion): ReviewQuestion[] {
  if (items.length >= 100 && !items.some(item => item.id === next.id)) throw new Error('Question limit reached · remove a resolved question before adding another.');
  return readQuestions(JSON.stringify([...items.filter(item => item.id !== next.id), next]));
}
