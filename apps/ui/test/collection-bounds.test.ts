import {expect,it} from 'vitest';
import {collectionBounds} from '../src/lib/collection-bounds.ts';
it('fits a short collection without a reserved band and caps a long one without omitting items',()=>{
 expect(collectionBounds(3)).toEqual({state:'fit',maxBlockSize:undefined});
 expect(collectionBounds(6).state).toBe('fit');
 expect(collectionBounds(300)).toEqual({state:'scroll',maxBlockSize:216});
 expect(collectionBounds(300,8,28).maxBlockSize).toBe(224);
});
it('refuses invalid dimensions instead of producing an unscrollable NaN or negative cap',()=>{
 for(const args of [[-1,6,36],[3,0,36],[3,6,NaN],[Infinity,6,36]])expect(()=>collectionBounds(args[0]!,args[1]!,args[2]!)).toThrow(RangeError);
});
