export interface Chapter {
  key: string;
  title: string;
  short: string;
  description: string;
  step: number;
  operationId: string;
  kind: string;
  path?: string;
  command?: string;
  provenance: string;
  text: string;
  status: string;
  mapped: boolean;
}

export interface SamplePayload {
  chapters: Chapter[];
  totalSteps?: number;
  sourceRevision?: string;
}

const EXPECTED_KEYS = ['read', 'failure', 'edit', 'retest'] as const;
const EXPECTED_STEPS = [4, 24, 26, 28] as const;
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KiB
const MAX_TEXT_CODE_UNITS = 65536;

export function validateChapterPayload(payload: unknown, rawByteLength?: number): Chapter[] {
  if (typeof rawByteLength === 'number' && rawByteLength > MAX_PAYLOAD_BYTES) {
    throw new Error('Chapter metadata exceeds maximum size of 512 KiB');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Malformed chapter metadata');
  }

  const rawChapters = (payload as Record<string, unknown>).chapters;
  if (!Array.isArray(rawChapters) || rawChapters.length !== 4) {
    throw new Error('Chapter metadata must contain exactly four chapters');
  }

  const chapters: Chapter[] = [];
  for (let i = 0; i < 4; i++) {
    const raw = rawChapters[i];
    if (!raw || typeof raw !== 'object') {
      throw new Error(`Chapter ${i} is malformed`);
    }

    const c = raw as Record<string, unknown>;
    const expectedKey = EXPECTED_KEYS[i]!;
    const expectedStep = EXPECTED_STEPS[i]!;

    if (c.key !== expectedKey) {
      throw new Error(`Chapter ${i} expected key "${expectedKey}", got "${String(c.key)}"`);
    }

    if (c.step !== expectedStep) {
      throw new Error(`Chapter "${expectedKey}" expected step ${expectedStep}, got ${String(c.step)}`);
    }

    for (const prop of ['title', 'short', 'description', 'operationId', 'kind', 'provenance', 'text', 'status'] as const) {
      const val = c[prop];
      if (typeof val !== 'string') {
        throw new Error(`Chapter "${expectedKey}" missing required string property "${prop}"`);
      }
      if (val.length > MAX_TEXT_CODE_UNITS) {
        throw new Error(`Chapter "${expectedKey}" property "${prop}" exceeds 65536 code units`);
      }
    }

    if (c.path !== undefined) {
      if (typeof c.path !== 'string') {
        throw new Error(`Chapter "${expectedKey}" invalid path type`);
      }
      if (c.path.length > MAX_TEXT_CODE_UNITS) {
        throw new Error(`Chapter "${expectedKey}" path exceeds 65536 code units`);
      }
      if (!/^[\w./-]+$/.test(c.path) || c.path.startsWith('/') || c.path.split('/').includes('..')) {
        throw new Error(`Chapter "${expectedKey}" contains unsafe path "${c.path}"`);
      }
    }

    if (c.command !== undefined) {
      if (typeof c.command !== 'string') {
        throw new Error(`Chapter "${expectedKey}" invalid command type`);
      }
      if (c.command.length > MAX_TEXT_CODE_UNITS) {
        throw new Error(`Chapter "${expectedKey}" command exceeds 65536 code units`);
      }
    }

    chapters.push({
      key: c.key as string,
      title: c.title as string,
      short: c.short as string,
      description: c.description as string,
      step: c.step as number,
      operationId: c.operationId as string,
      kind: c.kind as string,
      path: c.path as string | undefined,
      command: c.command as string | undefined,
      provenance: c.provenance as string,
      text: c.text as string,
      status: c.status as string,
      mapped: Boolean(c.mapped),
    });
  }

  return chapters;
}
