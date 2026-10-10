// Shared by capture and rebuildable projections. Inspect source; never evaluate it.
// Only a literal patch in a direct,
// awaited call can be classified. Dynamic JavaScript remains captured script text.
export function literalPatch(source: string): string | undefined {
  if (!source.includes('apply_patch') || source.length > 2 * 1024 * 1024) return;
  const tokens: { value: string; literal: boolean }[] = [];
  for (let i = 0; i < source.length;) {
    if (tokens.length > 100_000) return;
    const c = source[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (source.startsWith('//', i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end + 1; continue; }
    if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); if (end < 0) return; i = end + 2; continue; }
    // Regex and division are deliberately outside the supported static subset.
    if (c === '/') return;
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let value = '';
      let closed = false;
      i++;
      while (i < source.length) {
        const next = source[i++]!;
        if (next === quote) { closed = true; break; }
        if (quote === '`' && next === '$' && source[i] === '{') return;
        if (next !== '\\') { value += next; continue; }
        const escape = source[i++];
        if (escape === undefined) return;
        const simple: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
        if (escape === '\n') continue;
        if (escape === '\r') { if (source[i] === '\n') i++; continue; }
        if (escape === 'u' || escape === 'x') {
          const count = escape === 'u' ? 4 : 2;
          const hex = source.slice(i, i + count);
          if (hex.length !== count || !/^[\da-f]+$/i.test(hex)) return;
          value += String.fromCharCode(parseInt(hex, 16)); i += count;
        } else if (escape in simple) value += simple[escape];
        else if (['\\', '"', "'", '`', '$'].includes(escape)) value += escape;
        else return;
      }
      if (!closed) return;
      tokens.push({ value, literal: true });
      continue;
    }
    const word = /^[\w$]+/.exec(source.slice(i));
    tokens.push({ value: word?.[0] ?? c, literal: false });
    i += word?.[0].length ?? 1;
  }
  // Do not promote a conditional, callback or otherwise deferred invocation.
  if (tokens.some((t, i) => !t.literal && (/^(if|for|while|switch|function|return|throw|try|catch|class)$/.test(t.value)
    || (t.value === '=' && tokens[i + 1]?.value === '>')))) return;
  const patches: string[] = [];
  for (let i = 0; i + 6 < tokens.length; i++) {
    const call = tokens.slice(i, i + 5);
    if (!call.every((t, n) => !t.literal && t.value === ['await', 'tools', '.', 'apply_patch', '('][n])) continue;
    const argument = tokens[i + 5]!;
    const end = tokens[i + 6]!;
    if (!argument.literal || end.literal || end.value !== ')') return;
    if (!/^\*\*\* Begin Patch\r?\n/.test(argument.value) || !argument.value.trimEnd().endsWith('*** End Patch')) return;
    patches.push(argument.value);
  }
  // Multiple invocations have independent outcomes that the wrapper may not expose.
  return patches.length === 1 ? patches[0] : undefined;
}
