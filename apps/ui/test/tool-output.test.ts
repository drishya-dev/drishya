import { describe, expect, it } from 'vitest';
import { isTableShaped, looksLikeMarkdown, toolOutputText } from '../src/lib/tool-output';
describe('structured tool output display', () => {
  it('decodes nested MCP execution responses and arrays without dropping mixed evidence',()=>{
    const result={output:'first\nsecond',exit_code:0};
    expect(toolOutputText(JSON.stringify({content:[{type:'text',text:JSON.stringify(result)}]})).text).toBe('first\nsecond\nExit code: 0');
    expect(toolOutputText(JSON.stringify([result,result])).text).toBe('first\nsecond\nExit code: 0\n\nfirst\nsecond\nExit code: 0');
    const mixed=JSON.stringify([result,{important:'unrecognized'}]);
    expect(toolOutputText(mixed)).toEqual({text:mixed,decoded:false});
  });
  it('recursively unwraps nested and truncated MCP content[] envelopes without leaving escapes', () => {
    const inner = JSON.stringify({ content: [{ type: 'text', text: '## Heading\n\n- **item**: `"quoted"`\n- line two' }] });
    const nested = JSON.stringify({ content: [{ type: 'text', text: inner }] });
    expect(toolOutputText(nested)).toEqual({
      decoded: true,
      text: '## Heading\n\n- **item**: `"quoted"`\n- line two',
    });
    const deep = JSON.stringify({ content: [{ type: 'text', text: nested }] });
    expect(toolOutputText(deep)).toEqual({
      decoded: true,
      text: '## Heading\n\n- **item**: `"quoted"`\n- line two',
    });
    // Simulate PREVIEW truncation inside an outer and inner MCP content[] envelope.
    const clipped = deep.slice(0, deep.length - 12);
    const decodedClipped = toolOutputText(clipped);
    expect(decodedClipped.decoded).toBe(true);
    expect(decodedClipped.text).toContain('## Heading\n\n- **item**: `"quoted"`');
    expect(decodedClipped.text).not.toContain('\\"');
    expect(decodedClipped.text).not.toContain('\\n');
  });
  it('decodes text+image MCP content while leaving image-only or mixed resource_link untouched', () => {
    const withImage = JSON.stringify({ content: [{ type: 'text', text: 'line one\nline two' }, { type: 'image', data: 'abc' }] });
    expect(toolOutputText(withImage)).toEqual({ decoded: true, text: 'line one\nline two' });
    const mixed = JSON.stringify({ content: [{ type: 'text', text: 'keep' }, { type: 'resource_link', uri: 'https://example.invalid', name: 'x' }] });
    expect(toolOutputText(mixed)).toEqual({ text: mixed, decoded: false });
  });
  it('distinguishes unwrapped Markdown from JSON, patches and plain text', () => {
    expect(looksLikeMarkdown('## Environment\n\n- **Display**: `1280x800`\n- Status: ok')).toBe(true);
    expect(looksLikeMarkdown('# Page Snapshot\n- generic "Home"\n')).toBe(true);
    expect(looksLikeMarkdown('| Col A | Col B |\n| --- | --- |\n| 1 | 2 |')).toBe(true);
    expect(looksLikeMarkdown('{"rows":[{"id":1}]}')).toBe(false);
    expect(looksLikeMarkdown('*** Begin Patch\n*** Update File: a.ts\n*** End Patch')).toBe(false);
    expect(looksLikeMarkdown('Title: Home\nURL: http://127.0.0.1:8501\n---\nPlain prose')).toBe(false);
  });
  it('decodes native execution JSON strings once and retains outcome information', () => {
    const output = 'first line\nsecond line\nconst pattern = "\\n";';
    const raw = JSON.stringify({i:0,status:'fulfilled',value:{output,exit_code:0,wall_time_seconds:1}});
    expect(toolOutputText(raw)).toEqual({decoded:true,text:`Request 0\n${output}\nExit code: 0`});
    expect(JSON.parse(raw).value.output).toBe(output);
  });
  it('handles complete newline-separated envelopes and MCP text, preserving other lines', () => {
    const raw = ['warning',JSON.stringify({output:'one\ntwo',session_id:32}),JSON.stringify({content:[{type:'text',text:'three\nfour'}],isError:true})].join('\n');
    expect(toolOutputText(raw).text).toBe('warning\none\ntwo\nRunning session: 32\nTool error\nthree\nfour');
  });
  it('decodes standard MCP text when the optional error flag is absent',()=>{expect(toolOutputText(JSON.stringify({content:[{type:'text',text:'one\ntwo'}]}))).toEqual({text:'one\ntwo',decoded:true});});
  it('does not reinterpret code, JSON data, cut-off envelopes or Windows paths', () => {
    for(const text of ['const separator = "\\n";', 'C:\\new\\repo\\thing', '{"output":"one\\ntwo"}', '{"chunk_id":"x","output":"one\\n', JSON.stringify({content:[{type:'image',data:'unchanged'}],isError:false})]) expect(toolOutputText(text)).toEqual({text,decoded:false});
  });
  it('leaves JSON primitives and plain lines as written while still decoding envelopes among them', () => {
    const envelope=JSON.stringify({output:'ran',exit_code:0});
    for (const line of ['"quoted"','42','-1','true','null','  plain text','']) expect(toolOutputText(line)).toEqual({text:line,decoded:false});
    expect(toolOutputText(['start','  '+envelope,'42'].join('\n'))).toEqual({text:['start','ran\nExit code: 0','42'].join('\n'),decoded:true});
  });

  describe('isTableShaped literal output detection (UI-50)', () => {
    it('detects pipe tables printed to stdout', () => {
      const table = '| Command | Status | Duration |\n|---|---|---|\n| build | ok | 1.2s |\n| test | ok | 3.4s |';
      expect(isTableShaped(table)).toBe(true);
    });

    it('detects ASCII +--+ tables printed to stdout', () => {
      const ascii = '+----------+--------+\n| Language | Files  |\n+----------+--------+\n| Rust     | 42     |\n+----------+--------+';
      expect(isTableShaped(ascii)).toBe(true);
    });

    it('detects console.table box-drawing tables', () => {
      const box = '┌─────────┬────────┬─────────┐\n│ (index) │  task  │ status  │\n├─────────┼────────┼─────────┤\n│    0    │ "lint" │ "pass"  │\n└─────────┴────────┴─────────┘';
      expect(isTableShaped(box)).toBe(true);
    });

    it('detects tab-separated tabular output', () => {
      const tabs = 'filename\tsize\tstatus\nindex.ts\t1024\tok\nmain.ts\t2048\tok';
      expect(isTableShaped(tabs)).toBe(true);
    });

    it('detects multi-column fixed width output on wide lines', () => {
      const ps = 'UID        PID  PPID  C STIME TTY          TIME CMD\nroot         1     0  0 10:00 ?        00:00:01 /sbin/init\nuser      1234     1  0 10:05 ?        00:00:05 /usr/bin/node server.js';
      expect(isTableShaped(ps)).toBe(true);
    });

    it('does not classify normal prose command output as table-shaped', () => {
      const gitLog = 'commit 3f8a12b (HEAD -> main)\nAuthor: Dev <dev@example.com>\nDate:   Fri Nov 14 10:00:00 2026\n\n    fix(ui): ensure buttons align properly on narrow viewports';
      expect(isTableShaped(gitLog)).toBe(false);

      const sentence = 'All 12 tests passed successfully in 3.4 seconds.';
      expect(isTableShaped(sentence)).toBe(false);

      const bulletList = '- item 1\n- item 2\n- item 3';
      expect(isTableShaped(bulletList)).toBe(false);
    });
  });
});
