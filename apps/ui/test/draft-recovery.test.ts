import {describe,expect,it} from 'vitest';
import {recoverySnapshot,sealRecovery,unsealRecovery,restoreRecovery} from '../src/lib/draft-recovery.ts';
import {WorkspaceDrafts} from '../src/lib/workspace-drafts.ts';
const draft={base:'const before = 1;\r\n',text:'const after = 2;\r\n',modifiedAt:'2026-10-18T00:00:00Z'};
const password='synthetic recovery passphrase';
describe('explicit encrypted draft recovery',()=>{
  it('round trips exact text and bases without plaintext paths or credentials in the capsule',async()=>{
    const store=new WorkspaceDrafts();store.set('one','src/first.ts',draft);store.set('two','other.ts',draft);
    const snapshot=recoverySnapshot(store,'one','C:/synthetic/project'),sealed=await sealRecovery(snapshot,password);
    expect(sealed).not.toContain('src/first.ts');expect(sealed).not.toContain('const after');expect(sealed).not.toContain(password);
    const restored=await unsealRecovery(sealed,password);expect(restored).toEqual(snapshot);
    const next=new WorkspaceDrafts();restoreRecovery(next,restored,'one','c:\\synthetic\\project');expect(next.get('one','src/first.ts')).toEqual(draft);expect(next.get('two','other.ts')).toBeUndefined();
  });
  it('uses fresh randomness and rejects incorrect passwords, tampering and short passphrases',async()=>{
    const store=new WorkspaceDrafts();store.set('one','file.ts',draft);const snapshot=recoverySnapshot(store,'one','/synthetic');
    const first=await sealRecovery(snapshot,password),second=await sealRecovery(snapshot,password);expect(first).not.toBe(second);
    await expect(unsealRecovery(first,'wrong passphrase')).rejects.toThrow('Incorrect passphrase');
    const envelope=JSON.parse(first);envelope.cipher='A'+envelope.cipher.slice(1);await expect(unsealRecovery(JSON.stringify(envelope),password)).rejects.toThrow();
    await expect(sealRecovery(snapshot,'short')).rejects.toThrow('12–1024');
  });
  it('rejects secrets and protected paths without silently changing draft code',async()=>{
    const store=new WorkspaceDrafts();store.set('one','file.ts',{...draft,text:'sk-proj-abcdefghijklmnopqrstuvw0123456789'});
    expect(()=>recoverySnapshot(store,'one','/synthetic')).toThrow('Detected secret');expect(store.get('one','file.ts')!.text).toContain('sk-proj-');
    store.discard('one','file.ts');store.set('one','../outside.ts',draft);expect(()=>recoverySnapshot(store,'one','/synthetic')).toThrow('unsupported');
  });
  it('restores atomically, refuses a different live draft and binds both root and recording',()=>{
    const stored=new WorkspaceDrafts();stored.set('one','first.ts',draft);stored.set('one','second.ts',draft);const snapshot=recoverySnapshot(stored,'one','/original');
    const next=new WorkspaceDrafts();next.set('one','second.ts',{...draft,text:'unsaved newer work'});
    expect(()=>restoreRecovery(next,snapshot,'one','/original')).toThrow('live draft');expect(next.get('one','first.ts')).toBeUndefined();
    expect(()=>restoreRecovery(next,snapshot,'other','/original')).toThrow('different recording');expect(()=>restoreRecovery(next,snapshot,'one','/elsewhere')).toThrow('different recording');
  });
  it('never evicts a ninth draft and rejects oversized or invalid recovery files',async()=>{
    const stored=new WorkspaceDrafts();stored.set('one','new.ts',draft);const snapshot=recoverySnapshot(stored,'one','/original');
    const next=new WorkspaceDrafts();for(let n=0;n<8;n++)next.set('one',`file${n}.ts`,draft);
    expect(()=>restoreRecovery(next,snapshot,'one','/original')).toThrow('Eight drafts');expect(next.entries()).toHaveLength(8);
    await expect(unsealRecovery('x'.repeat(7*1024*1024+1),password)).rejects.toThrow('exceeds');
    await expect(unsealRecovery('{}',password)).rejects.toThrow('Unsupported');
  });
});

it('refuses a Windows path alias of newer live work atomically',()=>{
 const source=new WorkspaceDrafts();source.set('one','other.ts',draft);source.set('one','src/shared.ts',draft);const snapshot=recoverySnapshot(source,'one','C:/synthetic/project');const live=new WorkspaceDrafts();live.set('one','SRC/SHARED.ts',{...draft,text:'newer unsaved work'});
 expect(()=>restoreRecovery(live,snapshot,'one','c:\\synthetic\\project')).toThrow('live draft');expect(live.entries()).toHaveLength(1);expect(live.get('one','other.ts')).toBeUndefined();expect(live.get('one','SRC/SHARED.ts')!.text).toBe('newer unsaved work');
});
it('does not create a second Windows draft for an identical differently-cased path',()=>{
 const source=new WorkspaceDrafts();source.set('one','src/shared.ts',draft);const snapshot=recoverySnapshot(source,'one','C:/synthetic/project');const live=new WorkspaceDrafts();live.set('one','SRC/SHARED.ts',draft);restoreRecovery(live,snapshot,'one','C:/synthetic/project');expect(live.entries()).toEqual([{id:'one',path:'SRC/SHARED.ts'}]);
});
it('preserves genuinely distinct path case in a POSIX recovery snapshot',()=>{
 const source=new WorkspaceDrafts();source.set('one','src/Readme.md',draft);source.set('one','src/README.md',{...draft,text:'different POSIX file'});const snapshot=recoverySnapshot(source,'one','/synthetic/project');const live=new WorkspaceDrafts();restoreRecovery(live,snapshot,'one','/synthetic/project');expect(live.entries()).toHaveLength(2);expect(live.get('one','src/README.md')!.text).toBe('different POSIX file');
});

it('compares draft fields independently of object key order and explicit false creation',()=>{
 const source=new WorkspaceDrafts();source.set('one','file.ts',draft);const snapshot=recoverySnapshot(source,'one','/original');const live=new WorkspaceDrafts();live.set('one','file.ts',{text:draft.text,modifiedAt:draft.modifiedAt,base:draft.base,creation:false});expect(()=>restoreRecovery(live,snapshot,'one','/original')).not.toThrow();expect(live.entries()).toHaveLength(1);
});
it('keeps recording ownership distinct while matching Windows path aliases',()=>{
 const source=new WorkspaceDrafts();source.set('one','file.ts',draft);const snapshot=recoverySnapshot(source,'one','C:/original');const live=new WorkspaceDrafts();live.set('other','FILE.ts',{...draft,text:'other recording draft'});restoreRecovery(live,snapshot,'one','C:/original');expect(live.get('other','FILE.ts')!.text).toBe('other recording draft');expect(live.get('one','file.ts')).toEqual(draft);
});
it('checks all Windows aliases instead of accepting the first identical one',()=>{
 const source=new WorkspaceDrafts();source.set('one','file.ts',draft);const snapshot=recoverySnapshot(source,'one','C:/original');const live=new WorkspaceDrafts();live.set('one','FILE.ts',draft);live.set('one','File.ts',{...draft,text:'another newer alias'});expect(()=>restoreRecovery(live,snapshot,'one','C:/original')).toThrow('live draft');expect(live.entries()).toHaveLength(2);
});

it('applies Windows alias protection to UNC roots and separator/case variants',()=>{
 const source=new WorkspaceDrafts();source.set('one','src/file.ts',draft);const snapshot=recoverySnapshot(source,'one',String.raw`\\server\share\project`);const live=new WorkspaceDrafts();live.set('one','SRC/FILE.ts',{...draft,text:'newer UNC work'});expect(()=>restoreRecovery(live,snapshot,'one','//SERVER/SHARE/PROJECT')).toThrow('live draft');expect(live.entries()).toHaveLength(1);
});
it('does not consume a ninth slot for an already retained Windows alias',()=>{
 const source=new WorkspaceDrafts();source.set('one','file.ts',draft);const snapshot=recoverySnapshot(source,'one','C:/original');const live=new WorkspaceDrafts();live.set('one','FILE.ts',draft);for(let n=0;n<7;n++)live.set('one',`other${n}.ts`,draft);expect(()=>restoreRecovery(live,snapshot,'one','C:/original')).not.toThrow();expect(live.entries()).toHaveLength(8);
});
