import {expect,it} from 'vitest';
import {collectionBounds,collectionPage} from '../src/lib/collection-bounds.ts';
it('fits a short collection without a reserved band and caps a long one without omitting items',()=>{
 expect(collectionBounds(3)).toEqual({state:'fit',maxBlockSize:undefined});
 expect(collectionBounds(6).state).toBe('fit');
 expect(collectionBounds(300)).toEqual({state:'scroll',maxBlockSize:216});
 expect(collectionBounds(300,8,28).maxBlockSize).toBe(224);
});
it('pages the complete collection and clamps a stale large page after shrink',()=>{
 expect(collectionPage(3,37)).toEqual({state:'fit',page:0,pages:1,start:0,end:3});
 expect(collectionPage(300,37)).toEqual({state:'page',page:37,pages:38,start:296,end:300});
 expect(collectionPage(0)).toEqual({state:'fit',page:0,pages:1,start:0,end:0});
 const seen=Array.from({length:38},(_,page)=>collectionPage(300,page)).flatMap(({start,end})=>Array.from({length:end-start},(_,i)=>start+i));
 expect(seen).toEqual(Array.from({length:300},(_,i)=>i));
 for(const page of [-1,.5,NaN,Infinity])expect(()=>collectionPage(3,page)).toThrow(RangeError);
});
it('refuses invalid dimensions instead of producing an unscrollable NaN or negative cap',()=>{
 for(const args of [[-1,6,36],[3,0,36],[3,6,NaN],[Infinity,6,36]])expect(()=>collectionBounds(args[0]!,args[1]!,args[2]!)).toThrow(RangeError);
});
