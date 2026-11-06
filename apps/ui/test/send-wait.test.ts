import { expect, it } from 'vitest';
import { sendWaitReason, type SendWaitState } from '../src/lib/send-wait.ts';

const ready: SendWaitState = { unavailable: false, approved: true, cliAvailable: true, overLimit: false, attaching: false, hasPrompt: true };

it('names the first thing a disabled Send waits for', () => {
  expect(sendWaitReason(ready)).toBe('Send prompt');
  expect(sendWaitReason({ ...ready, approved: false })).toMatch(/Enable this workspace/);
  expect(sendWaitReason({ ...ready, cliAvailable: false })).toMatch(/not available for this session/);
  expect(sendWaitReason({ ...ready, overLimit: true })).toMatch(/size limit/);
  expect(sendWaitReason({ ...ready, attaching: true })).toMatch(/files to attach/);
  expect(sendWaitReason({ ...ready, hasPrompt: false })).toMatch(/Write a prompt/);
});

it('explains a disconnected or failed daemon even when everything else is ready', () => {
  expect(sendWaitReason({ ...ready, unavailable: true })).toMatch(/Connection .* unavailable/);
  // It outranks the other reasons, which may be stale while the daemon cannot be reached.
  expect(sendWaitReason({ ...ready, unavailable: true, approved: false, hasPrompt: false })).toMatch(/Connection .* unavailable/);
});
