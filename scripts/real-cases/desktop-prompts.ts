import type{RealCase}from'./types.ts';import{desktopPrompt}from'../../apps/ui/src/lib/desktop-prompt.ts';
export const desktopPrompts:RealCase={name:'desktop-prompts',about:'strict desktop prompt envelopes, attachment references and captured image counts',harnesses:['codex'],prefilter:'Files mentioned by the user',
 scan(row:any){const p=row.payload;if(row.type!=='response_item'||p?.role!=='user'||!Array.isArray(p.content))return;const text=p.content.filter((c:any)=>c.type==='input_text').map((c:any)=>c.text).join('\n');return desktopPrompt(text)?{hits:1,only:p.content.some((c:any)=>c.type==='input_image')?1:0}:undefined;},
 verify(projection){const turns=projection.timeline.filter(t=>t.type==='turn'&&desktopPrompt(t.prompt??''));return[`${turns.length?'PASS':'FAIL'} ${turns.length} canonical desktop prompt envelopes remain intact for presentation; ${turns.filter(t=>t.type==='turn'&&t.images?.length).length} include image metadata`];},
};
