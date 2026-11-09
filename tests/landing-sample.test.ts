import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateChapterPayload, type Chapter} from '../apps/landing/src/sample-model.ts';
import {createSampleController, type SampleClock} from '../apps/landing/src/sample-controller.ts';

const mockChapters: Chapter[] = [
  {
    key: 'read',
    title: 'Read the checkout guard',
    short: 'Read',
    description: 'The exact source the agent saw.',
    step: 4,
    operationId: 'rec_x0001.toolu_synthetic0001',
    kind: 'read',
    path: 'src/checkout/guard.ts',
    provenance: 'Step 4 · Claude Code read guard.ts',
    text: 'if (cart.total) return "missing-total";',
    status: 'Captured file',
    mapped: true,
  },
  {
    key: 'failure',
    title: 'Inspect the failing test',
    short: 'Failure',
    description: 'A free-order check fails.',
    step: 24,
    operationId: 'rec_x0001.toolu_synthetic0009',
    kind: 'test',
    command: 'pnpm test checkout',
    provenance: 'Step 24 · Claude Code ran tests',
    text: 'FAIL src/checkout/guard.test.ts\n  ✕ free orders allow checkout',
    status: '5 passed / 1 failed',
    mapped: false,
  },
  {
    key: 'edit',
    title: 'Review the guard edit',
    short: 'Edit',
    description: 'The recorded edit distinguishes zero from null.',
    step: 26,
    operationId: 'rec_x0001.toolu_synthetic0010',
    kind: 'edit',
    path: 'src/checkout/guard.ts',
    provenance: 'Step 26 · Claude Code edited guard.ts',
    text: '- if (!cart.total) return "missing-total";\n+ if (cart.total == null) return "missing-total";',
    status: 'Recorded edit',
    mapped: true,
  },
  {
    key: 'retest',
    title: 'Check the next test run',
    short: 'Next test',
    description: 'The later run reports six passing tests.',
    step: 28,
    operationId: 'rec_x0001.toolu_synthetic0011',
    kind: 'test',
    command: 'pnpm test checkout',
    provenance: 'Step 28 · Claude Code ran tests',
    text: 'PASS src/checkout/guard.test.ts\n  ✓ free orders allow checkout',
    status: '6 passed / 0 failed',
    mapped: false,
  },
];

class FakeClock implements SampleClock {
  public now = 0;
  private nextId = 1;
  private entries = new Map<number, {time: number; callback: () => void}>();

  set(callback: () => void, delayMs: number): number {
    const id = this.nextId++;
    this.entries.set(id, {time: this.now + delayMs, callback});
    return id;
  }

  clear(handle: unknown): void {
    if (typeof handle === 'number') {
      this.entries.delete(handle);
    }
  }

  advance(ms: number): void {
    const target = this.now + ms;
    while (true) {
      let earliestId: number | null = null;
      let earliestTime = Infinity;
      for (const [id, entry] of this.entries.entries()) {
        if (entry.time <= target && entry.time < earliestTime) {
          earliestId = id;
          earliestTime = entry.time;
        }
      }
      if (earliestId === null) break;
      const entry = this.entries.get(earliestId)!;
      this.entries.delete(earliestId);
      this.now = entry.time;
      entry.callback();
    }
    this.now = target;
  }

  pendingCount(): number {
    return this.entries.size;
  }
}

test('validateChapterPayload validates 4 exact chapters within bounds', () => {
  const result = validateChapterPayload({chapters: mockChapters});
  assert.equal(result.length, 4);
  assert.equal(result[0]?.key, 'read');
  assert.equal(result[3]?.key, 'retest');
});

test('validateChapterPayload rejects payload over 512 KiB', () => {
  assert.throws(
    () => validateChapterPayload({chapters: mockChapters}, 513 * 1024),
    /exceeds maximum size/i
  );
});

test('validateChapterPayload rejects text over 65536 characters', () => {
  const badChapters = JSON.parse(JSON.stringify(mockChapters));
  badChapters[0].text = 'x'.repeat(65537);
  assert.throws(
    () => validateChapterPayload({chapters: badChapters}),
    /exceeds 65536 code units/i
  );
});

test('validateChapterPayload rejects unexpected steps and unsafe paths', () => {
  const badSteps = JSON.parse(JSON.stringify(mockChapters));
  badSteps[0].step = 5;
  assert.throws(
    () => validateChapterPayload({chapters: badSteps}),
    /expected step 4/i
  );

  const badPath = JSON.parse(JSON.stringify(mockChapters));
  badPath[0].path = '../unsafe/path.ts';
  assert.throws(
    () => validateChapterPayload({chapters: badPath}),
    /unsafe path/i
  );
});

test('sample controller advances through exact 1600, 3800, 6400, 8200 ms boundaries', () => {
  const clock = new FakeClock();
  const controller = createSampleController(mockChapters, undefined, clock);

  assert.deepEqual(controller.snapshot(), {
    index: 0,
    owner: 'manual',
    playing: false,
    repeat: false,
  });

  controller.play();
  assert.equal(controller.snapshot().playing, true);
  assert.equal(controller.snapshot().index, 0);

  // Read: 0 to 1600 ms
  clock.advance(1599);
  assert.equal(controller.snapshot().index, 0);
  clock.advance(1); // 1600 ms
  assert.equal(controller.snapshot().index, 1);

  // Failure: 1600 to 3800 ms (dwell 2200 ms)
  clock.advance(2199);
  assert.equal(controller.snapshot().index, 1);
  clock.advance(1); // 3800 ms
  assert.equal(controller.snapshot().index, 2);

  // Edit: 3800 to 6400 ms (dwell 2600 ms)
  clock.advance(2599);
  assert.equal(controller.snapshot().index, 2);
  clock.advance(1); // 6400 ms
  assert.equal(controller.snapshot().index, 3);

  // Retest: 6400 to 8200 ms (dwell 1800 ms)
  clock.advance(1799);
  assert.equal(controller.snapshot().index, 3);
  assert.equal(controller.snapshot().playing, true);
  clock.advance(1); // 8200 ms -> stop & hold

  assert.equal(controller.snapshot().index, 3);
  assert.equal(controller.snapshot().playing, false);
  assert.equal(clock.pendingCount(), 0);
});

test('sample controller repeat mode adds 1200 ms hold at end before restarting', () => {
  const clock = new FakeClock();
  const controller = createSampleController(mockChapters, undefined, clock);

  controller.setRepeat(true);
  controller.play();

  // Reach end of cycle: 8200 ms
  clock.advance(8200);
  assert.equal(controller.snapshot().index, 3);
  assert.equal(controller.snapshot().playing, true);
  assert.equal(clock.pendingCount(), 1);

  // 1200 ms hold: 8200 + 1199 = 9399 ms
  clock.advance(1199);
  assert.equal(controller.snapshot().index, 3);
  assert.equal(controller.snapshot().playing, true);

  // 9400 ms: restarts at 0
  clock.advance(1);
  assert.equal(controller.snapshot().index, 0);
  assert.equal(controller.snapshot().playing, true);
});

test('pause, select, and followScroll manage timers and ownership', () => {
  const clock = new FakeClock();
  const controller = createSampleController(mockChapters, undefined, clock);

  controller.play();
  clock.advance(1000);
  assert.equal(controller.snapshot().index, 0);

  controller.pause();
  assert.equal(controller.snapshot().playing, false);
  assert.equal(clock.pendingCount(), 0);

  // Manual select pauses and changes index
  controller.select(2, 'pointer');
  assert.equal(controller.snapshot().index, 2);
  assert.equal(controller.snapshot().owner, 'manual');

  // Next play from chapter 2 starts chapter 2's full dwell (2600 ms)
  controller.play();
  clock.advance(2600);
  assert.equal(controller.snapshot().index, 3);

  // followScroll sets owner to 'scroll' and pauses playback
  controller.followScroll();
  assert.equal(controller.snapshot().owner, 'scroll');
  assert.equal(controller.snapshot().playing, false);
});

test('setVisible(false) pauses playback and clears timers', () => {
  const clock = new FakeClock();
  const controller = createSampleController(mockChapters, undefined, clock);

  controller.play();
  assert.equal(controller.snapshot().playing, true);
  assert.equal(clock.pendingCount(), 1);

  controller.setVisible(false);
  assert.equal(controller.snapshot().playing, false);
  assert.equal(clock.pendingCount(), 0);
});

test('dispose cleans up subscribers and pending timers', () => {
  const clock = new FakeClock();
  const controller = createSampleController(mockChapters, undefined, clock);

  let notified = 0;
  const unsub = controller.subscribe(() => {
    notified++;
  });

  controller.play();
  assert.ok(notified > 0);

  controller.dispose();
  assert.equal(controller.snapshot().playing, false);
  assert.equal(clock.pendingCount(), 0);

  unsub();
});
