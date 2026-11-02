import {expect,it} from 'vitest';
import {readMoments,saveMoment,momentKey} from '../src/lib/saved-moments.ts';
it('bounds saved references, rejects corrupt metadata and redacts notes before persistence',()=>{
  const item={operationId:'one',sequence:4,title:'Action',note:'sk-proj-abcdefghijklmnopqrstuvw0123456789'};
  const saved=saveMoment([],item);expect(saved[0]!.note).toContain('REDACTED');expect(saved[0]!.note).not.toContain('abcdefghijklmnop');
  expect(readMoments(JSON.stringify([...saved,...saved]))).toHaveLength(1);expect(readMoments(JSON.stringify([{...item,sequence:-1}]))).toEqual([]);expect(readMoments('broken')).toEqual([]);
  let items=saved;for(let n=1;n<50;n++)items=saveMoment(items,{...item,operationId:String(n)});
  expect(()=>saveMoment(items,{...item,operationId:'overflow'})).toThrow('50 moments');expect(saveMoment(items,{...item,note:'updated'})).toHaveLength(50);
  expect(momentKey('bundle','one')).not.toBe(momentKey('daemon','one'));
});
