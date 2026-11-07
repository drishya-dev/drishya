import type {RealCase} from './types.ts';

/** Multiple images in one genuine user message, without reading or printing their content. */
export const multiImagePrompts:RealCase={
  name:'multi-image-prompts',about:'User prompts containing at least two recorded images, on both native harnesses',
  harnesses:['claude-code','codex'],prefilter:{'claude-code':'"image"',codex:'input_image'},
  scan(row,harness){
    if(harness==='claude-code'){
      if(row.type!=='user'||row.isSidechain)return;
      const content=(row.message as {content?:unknown})?.content;
      return Array.isArray(content)&&content.filter(b=>b?.type==='image').length>=2?{hits:1}:undefined;
    }
    const payload=row.payload as {type?:string;role?:string;content?:unknown}|undefined;
    if(row.type!=='response_item'||payload?.type!=='message'||payload.role!=='user'||!Array.isArray(payload.content))return;
    return payload.content.filter(b=>b?.type==='input_image').length>=2?{hits:1}:undefined;
  },
  verify(projection,found){
    const turns=projection.timeline.filter(t=>t.type==='turn'&&(t.images?.length??0)>=2);
    const images=turns.flatMap(t=>t.type==='turn'?t.images??[]:[]);
    return[`${found.hits} native multi-image prompts; ${turns.length} presented; ${images.length} image references; ${images.filter(i=>i.sha).length} captured images`,...(turns.length!==found.hits?[`FAIL presented ${turns.length} of ${found.hits} multi-image prompts`]:[])];
  },
};
