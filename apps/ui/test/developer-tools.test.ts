import {expect,it} from 'vitest';
import {developerToolsEnabled} from '../src/lib/local-preview.ts';

it('product URLs never expose developer tools accidentally',()=>{
 for(const search of ['', '?demo','?demo=local','?experience=modern','?versions','?devtools=0'])expect(developerToolsEnabled(search,'0')).toBe(false);
 expect(developerToolsEnabled('?devtools=1','0')).toBe(true);
 expect(developerToolsEnabled('','1')).toBe(true);
});
