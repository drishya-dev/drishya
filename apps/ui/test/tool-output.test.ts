import { describe, expect, it } from 'vitest';
import { toolOutputText } from '../src/lib/tool-output';
describe('structured tool output display', () => {
  it('decodes nested MCP execution responses and arrays without dropping mixed evidence',()=>{
    const result={output:'first\nsecond',exit_code:0};
    expect(toolOutputText(JSON.stringify({content:[{type:'text',text:JSON.stringify(result)}]})).text).toBe('first\nsecond\nExit code: 0');
    expect(toolOutputText(JSON.stringify([result,result])).text).toBe('first\nsecond\nExit code: 0\n\nfirst\nsecond\nExit code: 0');
    const mixed=JSON.stringify([result,{important:'unrecognized'}]);
    expect(toolOutputText(mixed)).toEqual({text:mixed,decoded:false});
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
});
