import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { redactText } from '../src/index.ts';
import { legacyRedactText } from './legacy-redact.ts';

/** Compare full ordered redaction results without printing captured/fixture contents. */
export function compareRedaction(input: string) {
  const before = legacyRedactText(input), after = redactText(input);
  const label = 'redaction differential sha256=' + createHash('sha256').update(input).digest('hex');
  assert.ok(Buffer.from(before.text).equals(Buffer.from(after.text)), label);
  assert.deepEqual(after.hits, before.hits, label + ' hit order/count');
}
export function compareValue(value: unknown): number {
  if (typeof value === 'string') { compareRedaction(value); return 1; }
  if (Array.isArray(value)) return value.reduce<number>((sum, v) => sum + compareValue(v), 0);
  if (value && typeof value === 'object') return Object.entries(value).reduce((sum, [key, v]) => {
    compareRedaction(key); return sum + 1 + compareValue(v);
  }, 0);
  return 0;
}
