import { describe, expect, it } from 'vitest';
import { EvidenceTrail, type EvidenceLocation } from '../src/lib/evidence-navigation.ts';

const location = (path?: string): EvidenceLocation => ({ filePanel: path, explore: false, inspectorTab: 'detail', inspectorWidth: 700 });
describe('bounded evidence navigation', () => {
  it('restores exact visit controls and cuts forward history on a new destination', () => {
    const trail = new EvidenceTrail();
    const first = trail.visit(location('a.ts'));
    first.memory.set('line', 210);
    trail.visit(location('b.ts'));
    expect(trail.move(-1)).toBe(first);
    expect(trail.current?.memory.get('line')).toBe(210);
    expect(trail.canForward).toBe(true);
    trail.visit(location('c.ts'));
    expect(trail.canForward).toBe(false);
    expect(trail.move(-1)).toBe(first);
  });
  it('does not add visits for inspector tab and width changes, and retains only eight', () => {
    const trail = new EvidenceTrail();
    const first = trail.visit(location('a.ts'));
    expect(trail.visit({ ...location('a.ts'), inspectorTab: 'evidence', inspectorWidth: 1000 })).toBe(first);
    expect(trail.canBack).toBe(false);
    expect(trail.current?.location.inspectorTab).toBe('evidence');
    for (let n = 0; n < 20; n++) trail.visit(location(`${n}.ts`));
    let count = 1;
    while (trail.move(-1)) count++;
    expect(count).toBe(8);
    expect(trail.move(-1)).toBeUndefined();
  });
  it('distinguishes disk, captured evidence, exact matches and map reading', () => {
    const trail = new EvidenceTrail();
    const captured = trail.visit(location('a.ts'));
    const disk = trail.visit({ ...location(), currentFile: 'a.ts' });
    const match = trail.visit({ ...location('a.ts'), filePanelEvidence: 'op/search/3' });
    const map = trail.visit({ ...match.location, explore: true });
    expect(trail.move(-1)).toBe(match);
    expect(trail.move(-1)).toBe(disk);
    expect(trail.move(-1)).toBe(captured);
    expect(map).not.toBe(match);
  });
  it('retains separate line-reference visits in the same captured file', () => {
    const trail=new EvidenceTrail();
    const first=trail.visit({...location('a.ts'),filePanelLine:250});
    trail.visit({...location('a.ts'),filePanelLine:400});
    expect(trail.move(-1)).toBe(first);
    expect(trail.current?.location.filePanelLine).toBe(250);
  });
});

it('a repeated current-file selection restores metadata while captured source visits stay distinct',()=>{
 const trail=new EvidenceTrail(),disk={...location(),currentFile:'a.ts'};
 const first=trail.visit(disk);first.memory.set('disk/query','needle');first.memory.set('scroll/disk/source',{top:80,left:0});
 trail.visit({...disk,currentFile:'b.ts'});
 const returned=trail.visit(disk);expect(returned.memory.get('disk/query')).toBe('needle');expect(returned.memory).not.toBe(first.memory);
 const captured=trail.visit(location('a.ts'));expect(captured.memory.size).toBe(0);
});
