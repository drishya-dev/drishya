import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';

/** Real discovery and source watches, scoped to empty synthetic homes.
 * Call before importing adapters: Antigravity remembers its roots at module load. */
export function useSyntheticHarnessHomes():()=>void {
  const dir=mkdtempSync(join(tmpdir(),'drishya-synthetic-homes-'));
  const homes={DRISHYA_CLAUDE_HOME:'claude',DRISHYA_CODEX_HOME:'codex',DRISHYA_ANTIGRAVITY_HOME:'antigravity'};
  const previous=Object.fromEntries(Object.keys(homes).map(key=>[key,process.env[key]]));
  let closed=false;
  const cleanup=()=>{
    if(closed)return;closed=true;
    for(const key of Object.keys(homes)) {
      if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
    }
    if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Synthetic harness homes escaped system temp');
    rmSync(dir,{recursive:true,force:true});
  };
  try {
    for(const [key,name] of Object.entries(homes)) {
      const home=join(dir,name);mkdirSync(home);process.env[key]=home;
    }
    return cleanup;
  } catch(error) {cleanup();throw error;}
}
