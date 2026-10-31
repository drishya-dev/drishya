import type { Projection } from '../../packages/contracts/src/index.ts';

/** One thing a feature has to survive on real sessions. A case never prints journal content: counts only. */
export interface RealCase {
  name: string;
  /** What the case looks for, one line. */
  about: string;
  harnesses: ('claude-code' | 'codex')[];
  /** Cheap substring test on a raw journal line; only matching lines are parsed. */
  prefilter: string | Partial<Record<'claude-code' | 'codex', string>>;
  /** Hits on one parsed journal line, or undefined. `only` counts the stricter subset (for example an image with no text). */
  scan(row: Record<string, unknown>, harness: 'claude-code' | 'codex'): { hits: number; only?: number } | undefined;
  /** Counts read back from the imported recording. Lines starting with "FAIL" fail the check. */
  verify?(projection: Projection, found: { hits: number; only: number }): string[];
}
