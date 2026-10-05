import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';

export interface PresentationFrame {
  step: number;
  settled: ReadonlyMap<string, boolean>;
}
export function frameOf(scene: Scene): PresentationFrame {
  return { step: scene.step, settled: new Map(scene.passages.slice(-64).map((p) => [p.id, p.settled])) };
}

/** Semantic arrivals only. Loading another history page at the same step is never new work. */
export function choreographyBetween(previous: PresentationFrame | undefined, scene: Scene, p: Projection, timelineStart = 0) {
  const empty = { arrivals: [] as string[], outcomes: [] as string[], prose: [] as string[], settle: [] as string[] };
  if (!previous || scene.step <= previous.step) return empty;
  // Combined views can repeat source sequences. Actual timeline positions are the clock;
  // paged projections carry a trailing 128-step window, whose global offset is explicit.
  const events = p.timeline.slice(Math.max(0, previous.step - timelineStart), Math.max(0, scene.step - timelineStart));
  return {
    arrivals: events.filter((item) => item.type === 'op-start').slice(-3).map((item) => item.operationId),
    outcomes: events.filter((item) => item.type === 'op-end').slice(-3).map((item) => item.operationId),
    prose: events.filter((item) => item.type === 'prose').slice(-2).map((item) => item.proseId),
    settle: scene.passages.filter((ps) => previous.settled.get(ps.id) === false && ps.settled).slice(-2).map((ps) => ps.id),
  };
}
