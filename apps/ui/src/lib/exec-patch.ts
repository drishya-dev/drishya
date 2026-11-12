import { parseApplyPatch, type PatchFile } from '../../../../packages/projection/src/patch.ts';

export interface ExecPatchMaterial {
  files: PatchFile[];
  truncated: boolean;
}

/** Recognise literal `apply_patch` payloads in Codex `exec` scripts without evaluating JS. */
export function extractExecPatches(source: string, truncated = false): ExecPatchMaterial | undefined {
  if (!source || source.length > 2 * 1024 * 1024) return;
  if (!source.includes('apply_patch') && !(truncated && source.includes('*** Begin Patch'))) return;
  if (truncated && !source.includes('apply_patch') && !/^\s*(?:const|let|var)\s+[\w$]+\s*=\s*["'`]\*\*\* Begin Patch/.test(source)) return;
  const literals: { value: string; truncated: boolean }[] = [];
  for (let i = 0; i < source.length;) {
    const c = source[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (source.startsWith('//', i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end + 1; continue; }
    if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); if (end < 0) break; i = end + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let value = '';
      let closed = false;
      let hasInterpolation = false;
      i++;
      while (i < source.length) {
        const next = source[i++]!;
        if (next === quote) { closed = true; break; }
        if (quote === '`' && next === '$' && source[i] === '{') { hasInterpolation = true; break; }
        if (next !== '\\') { value += next; continue; }
        if (i >= source.length) break;
        const escape = source[i++]!;
        const simple: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
        if (escape === '\n') continue;
        if (escape === '\r') { if (source[i] === '\n') i++; continue; }
        if (escape === 'u' || escape === 'x') {
          const count = escape === 'u' ? 4 : 2;
          const hex = source.slice(i, i + count);
          if (hex.length < count) break;
          if (!/^[\da-f]+$/i.test(hex)) { value = ''; break; }
          value += String.fromCharCode(parseInt(hex, 16));
          i += count;
        } else if (escape in simple) value += simple[escape];
        else if (['\\', '"', "'", '`', '$'].includes(escape)) value += escape;
        else { value = ''; break; }
      }
      if (hasInterpolation) return;
      if ((closed || truncated || source.length >= 3800) && /^\*\*\* Begin Patch\r?\n/.test(value)) {
        if (!closed) {
          // Drop a trailing partial line at a preview truncation boundary.
          const lastNl = value.lastIndexOf('\n');
          // The newline goes too: left in place it parses as one more, blank, context line.
          if (lastNl > 0) value = value.slice(0, lastNl);
        }
        literals.push({ value, truncated: !closed });
      }
      if (!closed) break;
      continue;
    }
    i++;
  }
  const files: PatchFile[] = [];
  let anyTruncated = false;
  for (const literal of literals) {
    if (literal.truncated) anyTruncated = true;
    for (const file of parseApplyPatch(literal.value)) {
      if (file.hunks.length > 0 || file.op === 'add' || file.op === 'delete') files.push(file);
    }
  }
  return files.length ? { files, truncated: anyTruncated } : undefined;
}
