import type {RealCase} from './types.ts';

/** Text stays inside the scanner; reports expose counts only. */
export function assistantText(row:any,harness:'claude-code'|'codex'):string|undefined{
 const blocks=harness==='claude-code'&&row.type==='assistant'?row.message?.content:
  harness==='codex'&&row.type==='response_item'&&(row.payload?.role==='assistant'||row.payload?.type==='agent_message')?row.payload.content:undefined;
 if(!Array.isArray(blocks))return;
 const text=blocks.filter((b:any)=>b.type==='text'||b.type==='output_text'||b.type==='input_text').map((b:any)=>typeof b.text==='string'?b.text:'').join('\n');
 return text||undefined;
}
export const fullProse:RealCase={
 name:'full-prose',about:'long assistant prose with stored full-message evidence',harnesses:['claude-code','codex'],prefilter:{'claude-code':'assistant',codex:'response_item'},
 scan(row,harness){const text=assistantText(row,harness);return text&&text.length>4096?{hits:1,only:text.length>64_000?1:0}:undefined;},
 verify(projection){
  const long=projection.prose.filter(p=>p.role==='assistant'&&(p.truncated||p.text.length>4096));
  const stored=long.filter(p=>!p.truncated||projection.artifacts.some(a=>a.id===`art_${p.id}_prose`&&a.availability==='complete'));
  return[`${long.length&&stored.length===long.length?'PASS':'FAIL'} ${long.length} long assistant messages; ${stored.length} have complete text or full recorded artifacts`];
 }
};
