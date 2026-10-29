import {fileURLToPath} from 'node:url';

/** Decode explicit local file URLs without resolving or touching the filesystem. */
export function localFileUrlPath(value:string):string|undefined {
  if(!/^file:/i.test(value))return;
  try {
    const url=new URL(value);
    if(url.protocol!=='file:'||url.hostname&&url.hostname!=='localhost'||url.search||url.hash)return;
    const windows=/^\/[A-Za-z]:\//.test(url.pathname);
    const path=fileURLToPath(url,{windows});
    return path.includes('\0')?undefined:path;
  }catch{return;}
}
