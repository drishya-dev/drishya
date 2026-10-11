/** Select actual captured error lines; never manufacture a diagnosis. */
export function failurePreview(text: string) {
  const lines = text.replace(/\n$/, '').split('\n');
  const at = lines.findIndex(line => /(?:\b(?:[a-z]*error|failed|failure|[a-z]*exception|traceback|panic|fatal)\b|✕|✖|FAIL\s)/i.test(line));
  if (at < 0) return undefined;
  const start = Math.max(0, at - 1), end = Math.min(lines.length, at + 5);
  return { text: lines.slice(start, end).join('\n'), start: start + 1, end, total: lines.length };
}
