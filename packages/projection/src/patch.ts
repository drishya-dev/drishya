// Edits: hunk construction and verified reconstruction (engineering plan §4). A patch is only
// applied against a base we hold; if anything fails to match, reconstruction is unavailable.

import { isBlobText, type BlobText, type Hunk } from '@drishya/contracts';

/** Restore sealed text before exposing a hunk to string-only diff consumers. */
export function resolveHunkLines(hunks: Hunk[], read?: (reference: BlobText) => string | undefined): Hunk[] {
  if (hunks.every(hunk => hunk.lines.every(line => typeof line === 'string'))) return hunks;
  return hunks.map(hunk => ({
    ...hunk,
    lines: hunk.lines.map((line: unknown) => {
      if (typeof line === 'string') return line;
      if (!isBlobText(line)) return ' [Captured diff line unavailable]';
      const full = read?.(line);
      if (full !== undefined) return full;
      const preview = typeof line.preview === 'string' ? line.preview : '';
      if (!preview) return ' [Captured diff line unavailable]';
      return preview + ' [Remaining captured text unavailable]';
    }),
  }));
}

export interface PatchFile {
  path: string;
  op: 'update' | 'add' | 'delete';
  moveTo?: string;
  hunks: Hunk[];
}

const FILE_HEADERS = [
  ['*** Update File:', 'update'],
  ['*** Add File:', 'add'],
  ['*** Delete File:', 'delete'],
] as const;
const MOVE_HEADER = '*** Move to:';

function patchPath(label: string): string | undefined {
  const path = label.trim();
  return path && !/[\r\n\u2028\u2029]/.test(path) ? path : undefined;
}

/** Read only line ranges actually reported in a unified diff. Never guess them from context. */
export function parseUnifiedHunks(content: string): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | undefined;
  for (const line of content.split('\n')) {
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match) { current = { oldStart: Number(match[1]), oldLines: Number(match[2] ?? 1), newStart: Number(match[3]), newLines: Number(match[4] ?? 1), lines: [] }; hunks.push(current); }
    else if (current && /^[ +\-]/.test(line) && !line.startsWith('---') && !line.startsWith('+++')) current.lines.push(line);
  }
  return hunks;
}

/** Codex apply_patch ("*** Begin Patch" / "*** Update File:" / "@@" / "-old" "+new"). */
export function parseApplyPatch(text: string): PatchFile[] {
  const files: PatchFile[] = [];
  let cur: PatchFile | undefined;
  let hunk: Hunk | undefined;
  const flush = () => {
    if (cur && hunk && hunk.lines.length) cur.hunks.push(finishHunk(hunk));
    hunk = undefined;
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const header = FILE_HEADERS.find(([prefix]) => line.startsWith(prefix));
    if (header) {
      flush();
      const [prefix, op] = header;
      const path = patchPath(line.slice(prefix.length));
      if (path === undefined) { cur = undefined; continue; }
      cur = { path, op, hunks: [] };
      files.push(cur);
      if (cur.op === 'add') hunk = { oldStart: 0, oldLines: 0, newStart: 1, newLines: 0, lines: [] };
      continue;
    }
    if (!cur) continue;
    if (line.startsWith(MOVE_HEADER)) {
      const path = patchPath(line.slice(MOVE_HEADER.length));
      if (path !== undefined) cur.moveTo = path;
      continue;
    }
    if (line.startsWith('*** End Patch') || line.startsWith('*** End of File')) continue;
    if (line.startsWith('@@')) {
      flush();
      hunk = { oldStart: 0, oldLines: 0, newStart: 0, newLines: 0, lines: [] };
      continue;
    }
    if (!hunk) hunk = { oldStart: 0, oldLines: 0, newStart: 0, newLines: 0, lines: [] };
    if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) hunk.lines.push(line);
    else if (line === '') hunk.lines.push(' ');
  }
  flush();
  return files;
}

function finishHunk(h: Hunk): Hunk {
  const oldLines = h.lines.filter((l) => !l.startsWith('+')).length;
  const newLines = h.lines.filter((l) => !l.startsWith('-')).length;
  return { ...h, oldLines, newLines };
}

/**
 * Applies context hunks (without trusted line numbers) to a held base by locating each hunk's
 * old lines in order. Returns the new text and hunks with real line numbers, or undefined.
 */
export function applyHunks(base: string, hunks: Hunk[]): { text: string; hunks: Hunk[] } | undefined {
  const lines = base.split('\n');
  const out: Hunk[] = [];
  let from = 0;
  let delta = 0;
  for (const h of hunks) {
    const oldSeq = h.lines.filter((l) => !l.startsWith('+')).map((l) => l.slice(1));
    const newSeq = h.lines.filter((l) => !l.startsWith('-')).map((l) => l.slice(1));
    let at = -1;
    if (oldSeq.length === 0) at = h.oldStart > 0 ? h.oldStart - 1 : lines.length;
    else {
      for (let i = from; i + oldSeq.length <= lines.length; i++) {
        let ok = true;
        for (let k = 0; k < oldSeq.length; k++) if (lines[i + k]!.trimEnd() !== oldSeq[k]!.trimEnd()) { ok = false; break; }
        if (ok) { at = i; break; }
      }
    }
    if (at < 0) return undefined;
    lines.splice(at, oldSeq.length, ...newSeq);
    out.push({ ...h, oldStart: at + 1 - delta, oldLines: oldSeq.length, newStart: at + 1, newLines: newSeq.length });
    delta += newSeq.length - oldSeq.length;
    from = at + newSeq.length;
  }
  return { text: lines.join('\n'), hunks: out };
}

export interface EditSpec {
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

/**
 * Applies string edits to a captured base. Each old string must occur (exactly once unless
 * replaceAll). Returns undefined when the base does not support the edit — never a guess.
 */
export function applyEdits(base: string, edits: EditSpec[]): string | undefined {
  let text = base;
  for (const e of edits) {
    if (!e.oldString) return undefined;
    const first = text.indexOf(e.oldString);
    if (first < 0) return undefined;
    if (e.replaceAll) text = text.split(e.oldString).join(e.newString);
    else {
      if (text.indexOf(e.oldString, first + 1) >= 0) return undefined;
      text = text.slice(0, first) + e.newString + text.slice(first + e.oldString.length);
    }
  }
  return text;
}

/**
 * Hunks for an edit whose base is unknown: the old and new strings as one hunk, with line
 * numbers only if the base is available to locate it.
 */
export function hunksFromStrings(edits: EditSpec[], base?: string, context = 2): Hunk[] {
  return edits.map((e) => {
    const oldL = e.oldString.split('\n');
    const newL = e.newString.split('\n');
    let start = 0;
    if (base !== undefined) {
      const at = base.indexOf(e.oldString);
      if (at >= 0) start = base.slice(0, at).split('\n').length;
    }
    // Trim shared leading/trailing lines into context so the change itself stands out.
    let pre = 0;
    while (pre < Math.min(oldL.length, newL.length) - 1 && oldL[pre] === newL[pre]) pre++;
    let post = 0;
    while (post < Math.min(oldL.length, newL.length) - pre - 1 && oldL[oldL.length - 1 - post] === newL[newL.length - 1 - post]) post++;
    const keepPre = Math.max(0, pre - context);
    const lines = [
      ...oldL.slice(keepPre, pre).map((l) => ' ' + l),
      ...oldL.slice(pre, oldL.length - post).map((l) => '-' + l),
      ...newL.slice(pre, newL.length - post).map((l) => '+' + l),
      ...oldL.slice(oldL.length - post, Math.min(oldL.length, oldL.length - post + context)).map((l) => ' ' + l),
    ];
    const s = start ? start + keepPre : 0;
    return { oldStart: s, oldLines: lines.filter((l) => !l.startsWith('+')).length, newStart: s, newLines: lines.filter((l) => !l.startsWith('-')).length, lines };
  });
}

/** Unified hunks between two full texts (line LCS, bounded). Used for Write-over-existing. */
export function diffTexts(a: string, b: string, context = 3, maxCells = 4_000_000): Hunk[] | undefined {
  const A = a.split('\n');
  const B = b.split('\n');
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  const a2 = A.slice(p, A.length - s);
  const b2 = B.slice(p, B.length - s);
  if (a2.length * b2.length > maxCells) return undefined;
  const n = a2.length;
  const m = b2.length;
  const dp = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i * (m + 1) + j] = a2[i] === b2[j] ? dp[(i + 1) * (m + 1) + j + 1]! + 1 : Math.max(dp[(i + 1) * (m + 1) + j]!, dp[i * (m + 1) + j + 1]!);
  const ops: { t: ' ' | '-' | '+'; l: string; ai: number; bi: number }[] = [];
  for (let k = 0; k < p; k++) ops.push({ t: ' ', l: A[k]!, ai: k, bi: k });
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a2[i] === b2[j]) ops.push({ t: ' ', l: a2[i]!, ai: p + i++, bi: p + j++ });
    // Deletions before additions, as git shows them.
    else if (i < n && (j === m || dp[(i + 1) * (m + 1) + j]! >= dp[i * (m + 1) + j + 1]!)) ops.push({ t: '-', l: a2[i]!, ai: p + i++, bi: p + j });
    else ops.push({ t: '+', l: b2[j]!, ai: p + i, bi: p + j++ });
  }
  for (let k = 0; k < s; k++) ops.push({ t: ' ', l: A[A.length - s + k]!, ai: A.length - s + k, bi: B.length - s + k });

  const hunks: Hunk[] = [];
  let k = 0;
  while (k < ops.length) {
    while (k < ops.length && ops[k]!.t === ' ') k++;
    if (k >= ops.length) break;
    let start = Math.max(0, k - context);
    let end = k;
    // extend while changes are within 2*context of each other
    while (end < ops.length) {
      if (ops[end]!.t !== ' ') {
        end++;
        continue;
      }
      let q = end;
      while (q < ops.length && ops[q]!.t === ' ') q++;
      if (q < ops.length && q - end <= context * 2) end = q;
      else break;
    }
    const stop = Math.min(ops.length, end + context);
    const slice = ops.slice(start, stop);
    const first = slice[0]!;
    hunks.push({
      oldStart: first.ai + 1,
      oldLines: slice.filter((o) => o.t !== '+').length,
      newStart: first.bi + 1,
      newLines: slice.filter((o) => o.t !== '-').length,
      lines: slice.map((o) => o.t + o.l),
    });
    k = stop;
    start = stop;
  }
  return hunks;
}
