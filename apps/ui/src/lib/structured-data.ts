export interface DataNode {pointer:string;parent?:string;key:string;depth:number;value:unknown;size:number;container:boolean}
export interface StructuredData {value:unknown;nodes:DataNode[];table?:{rows:Record<string,unknown>[];columns:string[];pointer:string}}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const pointerKey=(key:string)=>key.replaceAll('~','~0').replaceAll('/','~1');
export function structuredData(text:string):StructuredData|undefined{
 if(text.length>262144||new TextEncoder().encode(text).byteLength>262144)return;let value:unknown;try{value=JSON.parse(text);}catch{return;}
 if(!record(value)&&!Array.isArray(value))return;
 const nodes:DataNode[]=[],pending:Array<{value:unknown;pointer:string;key:string;depth:number;parent:string|undefined}>=[{value,pointer:'',key:'$',depth:0,parent:undefined}];
 while(pending.length){const item=pending.pop()!;if(nodes.length>=25000||item.depth>80)return;
  const childCount=Array.isArray(item.value)?item.value.length:record(item.value)?Object.keys(item.value).length:0;if(nodes.length+pending.length+childCount>=25000)return;
  const keys=Array.isArray(item.value)?Array.from({length:item.value.length},(_,index)=>String(index)):record(item.value)?Object.keys(item.value):[];
  const container=Array.isArray(item.value)||record(item.value);nodes.push({...item,size:keys.length,container});
  for(let index=keys.length-1;index>=0;index--){const key=keys[index]!;pending.push({value:(item.value as Record<string,unknown>)[key],key:Array.isArray(item.value)?`[${key}]`:key,pointer:`${item.pointer}/${pointerKey(key)}`,parent:item.pointer,depth:item.depth+1});}
 }
 const rows=Array.isArray(value)?value:record(value)&&Array.isArray(value.items)?value.items:undefined;
 let table:StructuredData['table'];
 if(rows?.length&&rows.every(record)){const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];if(columns.length&&columns.length<=32)table={rows,columns,pointer:Array.isArray(value)?'':'/items'};}
 return {value,nodes,table};
}
export function visibleDataNodes(nodes:DataNode[],expanded:Set<string>,query=''):DataNode[]{
 const needle=query.trim().toLowerCase();
 if(needle)return nodes.filter(node=>`${node.pointer} ${node.key} ${node.container?'':String(node.value)}`.toLowerCase().includes(needle)).slice(0,500);
 const visible:DataNode[]=[];let hidden:number|undefined;
 for(const node of nodes){if(hidden!==undefined&&node.depth>hidden)continue;hidden=undefined;visible.push(node);if(node.container&&!expanded.has(node.pointer))hidden=node.depth;}
 return visible;
}
export function dataLabel(value:unknown):string{return value===null?'null':Array.isArray(value)?`Array · ${value.length}`:record(value)?`Object · ${Object.keys(value).length}`:typeof value==='string'?value:JSON.stringify(value)??'Unavailable';}
