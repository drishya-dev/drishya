import type {Projection} from '@drishya/contracts';
import type {Scene} from '@drishya/scene';

export type SearchDestination = {kind:'operation';id:string;step:number}|{kind:'prose';step:number}|{kind:'prompt';step:number};

/** Exact captured identity only; turn ordinals and nearby timestamps are not locations. */
export function searchDestination(projection:Projection,observationId:string,scene?:Scene):SearchDestination|undefined{
 const op=projection.operations.find(op=>op.observationIds.includes(observationId));
 if(op)return{kind:'operation',id:op.id,step:op.startSequence+1};
 const prose=projection.prose.find(prose=>prose.observationIds.includes(observationId));
 if(prose)return{kind:'prose',step:prose.sequence+1};
 const turnId=`turn_${observationId}`;
 const index=projection.timeline.findIndex(item=>item.type==='turn'&&item.id===turnId);
 if(index>=0)return{kind:'prompt',step:index+1};
 // Paged histories retain every passage's prompt identity/position even while
 // its body is outside the resident page. No full projection fetch is needed.
 const prompt=scene?.passages.find(p=>p.turnId===turnId&&p.turnStep!==undefined);
 if(prompt?.turnStep!==undefined)return{kind:'prompt',step:prompt.turnStep+1};
}
