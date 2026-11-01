import { describe, expect, it } from 'vitest';
import { foldTemporary, parentFolder, timeSection, workspaceGroups } from '../src/lib/home-groups.ts';
import {workingLocations} from '../../../packages/contracts/src/working-locations.ts';

it('retains only an explicit boolean introduction preference',()=>{
  const clean=(value:unknown)=>workingLocations({version:1,sessions:[{id:'@home',entries:[['home/intro',value]]}]}).sessions[0]!.entries;
  expect(clean(false)).toEqual([['home/intro',false]]);expect(clean(true)).toEqual([['home/intro',true]]);
  expect(clean('private text')).toEqual([]);expect(clean({text:'source'})).toEqual([]);
});

describe('Home workspace rail', () => {
  const groups = (...roots: string[]) => workspaceGroups(roots, root => root, () => undefined);
  it('folds scratch folders into one group and keeps every session in it', () => {
    const folded = foldTemporary(groups('C:\\Users\\a\\AppData\\Local\\Temp\\probe-1', '/tmp/probe-2', '/home/a/repo'));
    expect(folded.map(group => group.name)).toEqual(['repo', 'Temporary folders']);
    expect(folded[1]).toMatchObject({ detail: '2 folders', items: ['C:\\Users\\a\\AppData\\Local\\Temp\\probe-1', '/tmp/probe-2'] });
  });
  it('leaves a single scratch folder where it is', () => {
    expect(foldTemporary(groups('/tmp/probe', '/home/a/repo')).map(group => group.name).sort()).toEqual(['probe', 'repo']);
  });
  it('shows the parent folder, shortened from the home folder', () => {
    expect(parentFolder('C:\\Users\\a\\Desktop\\CS\\drishya')).toBe('~/Desktop/CS');
    expect(parentFolder('/Users/a/code/repo/')).toBe('~/code');
    expect(parentFolder('/srv/repo')).toBe('/srv');
  });
});

describe('Home workspace and calendar groups', () => {
  const now = new Date(2026, 9, 13, 12);
  const local = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();
  it('uses local midnight instead of rolling 24 hour or UTC buckets', () => {
    expect(timeSection(local(13, 0), now)).toBe('Today');
    expect(timeSection(local(12, 23), now)).toBe('Yesterday');
    expect(timeSection(local(6, 0), now)).toBe('Previous 7 days');
    expect(timeSection(local(5, 23), now)).toBe('Older');
    expect(timeSection(local(14), now)).toBe('Future date');
    expect(timeSection('invalid', now)).toBe('Time unavailable');
    expect(timeSection(undefined, now)).toBe('Time unavailable');
  });
  it('does not merge equal basenames or invent roots and dates', () => {
    const rows = [{ root: '/one/shop', time: local(12) }, { root: '/two/shop', time: local(13) }, { root: undefined, time: undefined }, { root: '/one/shop', time: local(13) }];
    const groups = workspaceGroups(rows, r => r.root, r => r.time);
    expect(groups.map(g => g.key)).toEqual(['root:/two/shop', 'root:/one/shop', 'unassigned']);
    expect(groups[0]!.name).toBe('shop');
    expect(groups[1]!.items.map(r => r.time)).toEqual([local(13), local(12)]);
    expect(groups[2]!.name).toBe('Unassigned workspace');
    expect(rows[0]!.time).toBe(local(12));
  });
  it('retains every session and full Windows identity before presentation bounds', () => {
    const rows = Array.from({ length: 800 }, (_, n) => ({ root: n % 2 ? 'C:\\work\\app' : 'D:\\work\\app', time: local(13), n }));
    const groups = workspaceGroups(rows, r => r.root, r => r.time);
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.name === 'app' && g.items.length === 400)).toBe(true);
    expect(groups.flatMap(g => g.items)).toHaveLength(800);
  });
});
