export interface FilePeekState {files:string[];preview?:string}
export function filePeekState(value:unknown):FilePeekState{
 const input=value&&typeof value==='object'?value as Partial<FilePeekState>:{};
 const files=Array.isArray(input.files)?[...new Set(input.files.filter((path):path is string=>typeof path==='string'&&path.length>0&&path.length<=2048))].slice(0,8):[];
 return {files,...(typeof input.preview==='string'&&input.preview.length>0&&input.preview.length<=2048&&!files.includes(input.preview)?{preview:input.preview}:{})};
}
export function openFilePeek(state:FilePeekState,path:string,pin=false):{state:FilePeekState;error?:string}{
 if(!path||path.length>2048)return {state,error:'File path is unavailable.'};
 if(state.files.includes(path))return {state};
 if(pin){if(state.files.length>=8)return {state,error:'Eight tabs are kept open. Close a tab before keeping another.'};return {state:{files:[...state.files,path],...(state.preview&&state.preview!==path?{preview:state.preview}:{})}};}
 return {state:{files:state.files,preview:path}};
}
export function closeFilePeek(state:FilePeekState,path:string):FilePeekState{return {files:state.files.filter(file=>file!==path),...(state.preview&&state.preview!==path?{preview:state.preview}:{})};}
