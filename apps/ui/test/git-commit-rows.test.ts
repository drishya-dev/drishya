import {describe,expect,it} from 'vitest';
import {ago,refsInWindow} from '../src/lib/git-commit-rows.ts';

const commit=(hash:string,labels:string[]=[])=>({hash,parents:[],author:'a',time:'2026-10-20T00:00:00Z',subject:hash,labels,omittedLabels:0});
const ref=(name:string,extra:object={})=>({id:`refs/heads/${name}`,name,kind:'branch' as const,tip:name,current:false,...extra});

describe('Git commit rows (GIT-3)',()=>{
  it('keeps refs that label a loaded commit, the checked-out one and the picked one',()=>{
    const refs=[ref('main'),ref('old-work'),ref('feature'),ref('far',{current:true}),ref('picked')];
    const shown=refsInWindow(refs,[commit('a',['main']),commit('b',['feature'])],{selected:'refs/heads/picked'});
    expect(shown.map(item=>item.name)).toEqual(['main','feature','far','picked']);
  });
  it('shows nothing extra when nothing is loaded',()=>{
    expect(refsInWindow([ref('x')],[])).toEqual([]);
  });
  it('words age plainly and falls back to a date when old',()=>{
    const now=Date.parse('2026-10-20T12:00:00Z');
    expect(ago('2026-10-20T11:59:30Z',now)).toBe('just now');
    expect(ago('2026-10-20T11:30:00Z',now)).toBe('30 min ago');
    expect(ago('2026-10-20T07:00:00Z',now)).toBe('5 h ago');
    expect(ago('2026-10-10T12:00:00Z',now)).toBe('10 d ago');
    expect(ago('2025-01-02T12:00:00Z',now)).toMatch(/2025/);
    expect(ago('not a time',now)).toBe('');
  });
});
