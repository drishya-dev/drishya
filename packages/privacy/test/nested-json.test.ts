import { describe, expect, it } from 'vitest';
import { redactText, sanitize } from '../src/index.ts';

// SEC-3: a document encoded as text inside a string keeps `\n` as two characters, which glued a token to the letter `n`.
const KEY = 'AKIAZ7QX4K2M9W3PL6TB';
const GH = 'ghp_q7ZxW3rT9vB2nM5kL8jH4gF6dS1aP0oIuYtR';

describe('secrets inside JSON text', () => {
  it('are redacted after an escaped newline, where a word boundary used to be missing', () => {
    const text = JSON.stringify({ query: `notes\n${KEY}\n${GH}\ndone` });
    expect(text).toContain('\\n' + KEY); // the shape that defeated \b
    const result = redactText(text);
    expect(result.text).not.toContain(KEY);
    expect(result.text).not.toContain(GH);
    expect(result.hits.map((h) => h.rule).sort()).toEqual(['aws-access-key', 'github-token']);
    expect(JSON.parse(result.text).query).toContain('[REDACTED:aws-access-key]');
  });

  it('are redacted at any depth, in arrays and in text nested twice', () => {
    const inner = JSON.stringify({ list: [{ v: `x\n${GH}` }] });
    const outer = JSON.stringify({ Arguments: inner });
    const result = redactText(outer);
    expect(result.text).not.toContain(GH);
    expect(JSON.parse(JSON.parse(result.text).Arguments).list[0].v).toContain('[REDACTED:github-token]');
  });

  it('leave a JSON string with nothing to redact exactly as it was', () => {
    for (const text of [JSON.stringify({ a: 'plain\ntext', n: 1.0, z: [1, 2, 3] }, null, 2), '{"a" : "x\ny"}', '[ "x\ty" ]']) expect(redactText(text).text).toBe(text);
  });

  it('do not change prose, paths or text that only looks like JSON', () => {
    for (const text of ['C:\Users\me\{notes}.txt', '{not json \n at all', 'plain \n text', '', '{}', String.raw`{"x": "\d+"}`]) expect(redactText(text).text).toBe(text);
  });

  it('go through sanitize like any other string, with the field recorded', () => {
    const out = sanitize({ tool: { input: { Arguments: JSON.stringify({ q: `a\n${KEY}` }) } } });
    expect(JSON.stringify(out.value)).not.toContain(KEY);
    expect(out.redactions.some((r) => r.field === 'tool.input.Arguments' && r.rule === 'aws-access-key')).toBe(true);
  });

  it('stay bounded on hostile nesting and size', () => {
    const deep = '['.repeat(5000) + `"\n${KEY}"` + ']'.repeat(5000);
    const started = performance.now();
    redactText(deep);
    redactText('{"a":"' + '\n'.repeat(1_000_000) + '"}');
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
