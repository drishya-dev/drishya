import { expect, it } from 'vitest';
import { observationId, recordingIdFor } from '../src/index.ts';

// These ids are stored in every user's database. They were computed from the source that spelled the field separator as a
// literal NUL byte; the source now writes it as the escape \u0000, which is the same string, so no id may change.
it('keeps recording and observation ids identical to those computed before the separator was escaped', () => {
  expect(recordingIdFor('codex', '/home/u/.codex/sessions/2026/11/14/rollout-x.jsonl')).toBe('rec_ddc9c9a8f99871e6');
  expect(recordingIdFor('antigravity', '/home/u/.gemini/antigravity/brain/abc/.system_generated/logs/transcript.jsonl')).toBe('rec_09982e367ac7d10e');
  expect(observationId('claude-code', 'src_0123456789abcdef', 0, 1234, { part: 0 })).toBe('obs_8eb0f1a2685385bc092a5bbf');
  expect(observationId('antigravity', 'src_0123456789abcdef', 3, 0, { recordId: 'abc:7', part: 2 })).toBe('obs_75026a9f9c2299df60734ea3');
});
