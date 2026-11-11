import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {expect,it} from 'vitest';

const require=createRequire(import.meta.resolve('vite'));
const postcss=require('postcss') as {parse:(css:string)=>{walkDecls:(visit:(decl:{prop:string;value:string;source?:{start?:{line:number}}})=>void)=>void}};
const source=new URL('../src/',import.meta.url);
function cssFiles(dir:URL|string):string[]{const path=typeof dir==='string'?dir:fileURLToPath(dir);return readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.name==='clarity'?[]:entry.isDirectory()?cssFiles(join(path,entry.name)):entry.name.endsWith('.css')?[join(path,entry.name)]:[]);}

it('owns all stylesheet paint in tokens; only shadows and masks retain literals',()=>{
 const failures:string[]=[];
 for(const path of cssFiles(source)){
  if(path.endsWith('tokens.css'))continue;
  postcss.parse(readFileSync(path,'utf8')).walkDecls(decl=>{
   if(/shadow|mask|filter/.test(decl.prop))return;
   if(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i.test(decl.value))failures.push(`${path}:${decl.source?.start?.line} ${decl.prop}`);
  });
 }
 expect(failures).toEqual([]);
});

it('has no second paint palette in renderer or identity TypeScript',()=>{
 const files=['lib/identity.ts','lib/git-light.ts','lib/light-renderer.ts','components/NowWatcher.tsx','components/GitThreadGraph.tsx'];
 for(const file of files)expect(readFileSync(new URL(file,source),'utf8'),file).not.toMatch(/#[\da-f]{3,8}\b/i);
});
