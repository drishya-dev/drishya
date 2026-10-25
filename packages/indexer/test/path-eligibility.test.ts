import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {buildGraph,isIndexableFile} from '../src/index.ts';
let root:string;
beforeAll(()=>{
 root=mkdtempSync(join(tmpdir(),'drishya-path-eligibility-'));writeFileSync(join(root,'.gitignore'),'ignored/\n/cache-root/\n*.generated.ts\nignored-name.txt\n');
 for(const folder of ['src','ignored','cache-root','src/cache-root','node_modules','nested/node_modules'])mkdirSync(join(root,folder),{recursive:true});
 for(const path of ['README.md','src/code.ts','src/empty.txt','src/cache-root/kept.ts','ignored/no.ts','cache-root/no.ts','src/skip.generated.ts','ignored-name.txt','node_modules/no.ts','nested/node_modules/no.ts','picture.png'])writeFileSync(join(root,path),path.endsWith('empty.txt')?'':'synthetic');
 writeFileSync(join(root,'large.txt'),'x'.repeat(512*1024+1));symlinkSync(join(root,'src'),join(root,'linked'),process.platform==='win32'?'junction':'dir');
});
afterAll(()=>rmSync(root,{recursive:true,force:true}));
it('agrees with the complete map eligibility while a bounded map omits eligible files',async()=>{
 const full=await buildGraph(root),bounded=await buildGraph(root,{maxFiles:1});expect(bounded.truncated).toBe(true);expect(bounded.nodes).toHaveLength(1);
 for(const path of ['README.md','src/code.ts','src/empty.txt','src/cache-root/kept.ts','ignored/no.ts','cache-root/no.ts','src/skip.generated.ts','ignored-name.txt','node_modules/no.ts','nested/node_modules/no.ts','picture.png','large.txt'])expect(await isIndexableFile(root,path),path).toBe(full.nodes.some(n=>n.path===path));
 expect(await isIndexableFile(root,'README.md')).toBe(true);expect(bounded.nodes.some(n=>n.path==='README.md')).toBe(false);
});
it.each(['../outside.txt','/etc/passwd','C:/private.txt','src\\code.ts','src/../README.md','src//code.ts','missing.ts','src','linked/code.ts'])('refuses non-file, missing, escaping and linked candidate %s',async path=>{expect(await isIndexableFile(root,path)).toBe(false);});
