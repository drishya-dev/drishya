import { expect, it } from 'vitest';
import type { CurrentFile } from '../src/api.ts';
import { SourceVersions } from '../src/lib/source-versions.ts';
const file = (text: string, modifiedAt = 'one'): CurrentFile => ({ path: 'index.ts', scope: 'current-workspace', text, start: 0, totalLines: 1, returnedLines: 1, hasMore: false, redacted: false, modifiedAt });
it('retains the reading version until explicit adoption and never changes a draft', () => {
    const store = new SourceVersions();
    store.offer('a', 'index.ts', file('one'));
    store.offer('a', 'index.ts', file('two', 'two'));
    expect(store.get('a', 'index.ts')).toMatchObject({ reading: { text: 'one' }, newer: { text: 'two' } });
    expect(store.adopt('a', 'index.ts')?.text).toBe('two');
    expect(store.get('a', 'index.ts')?.newer).toBeUndefined();
    expect(store.get('b', 'index.ts')).toBeUndefined();
});
it('bounds source memory, refuses oversized replacements and permits explicit release', () => {
    const store = new SourceVersions();
    for (let i = 0; i < 8; i++)
        store.offer('a', `file${i}`, file('small'));
    expect(store.offer('a', 'ninth', file('small'))).toBeUndefined();
    expect(() => store.offer('a', 'file0', file('x'.repeat(256 * 1024 + 1)))).toThrow('comparison limit');
    expect(store.get('a', 'file0')?.reading.text).toBe('small');
    store.forget('a', 'file0');
    expect(store.offer('a', 'ninth', file('small'))).toBeDefined();
});
it('shares retained versions without a slow second pane clearing newer evidence',()=>{
    const store=new SourceVersions();let notices=0;const stop=store.subscribe(()=>notices++);
    store.offer('a','index.ts',file('base'));
    const older=store.begin('a','index.ts'),newer=store.begin('a','index.ts');
    store.offer('a','index.ts',file('new','new'),newer);
    store.offer('a','index.ts',file('base'),older);
    expect(store.get('a','index.ts')).toMatchObject({reading:{text:'base'},newer:{text:'new'}});
    expect(notices).toBe(2);store.adopt('a','index.ts');expect(notices).toBe(3);stop();
});
