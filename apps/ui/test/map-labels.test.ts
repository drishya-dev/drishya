import {expect,it} from 'vitest';
import {placeActivityLabels} from '../src/lib/map-labels.ts';
it('places long file chips only wholly inside genuine free gutters and outside every protected rectangle',()=>{
 const obstacles=[{left:280,top:0,right:1160,bottom:900},{left:0,top:0,right:1440,bottom:100},{left:0,top:800,right:1440,bottom:900}];
 const candidates=[{id:'a',x:240,y:300,kind:'file' as const,text:'a'.repeat(300)},{id:'b',x:245,y:350,kind:'file' as const,text:'b.ts'}];
 const placed=placeActivityLabels(candidates,{width:1440,height:900},obstacles,s=>s.length*7);
 expect(placed).toHaveLength(2);
 for(const p of placed){expect(p.rect.right-p.rect.left).toBeLessThanOrEqual(190);for(const o of obstacles)expect(p.rect.left<o.right&&o.left<p.rect.right&&p.rect.top<o.bottom&&o.top<p.rect.bottom).toBe(false);}
 const [a,b]=placed;expect(a!.rect.left<b!.rect.right&&b!.rect.left<a!.rect.right&&a!.rect.top<b!.rect.bottom&&b!.rect.top<a!.rect.bottom).toBe(false);
 expect(placeActivityLabels(candidates,{width:600,height:900},[{left:0,top:0,right:600,bottom:900}],s=>s.length*7)).toEqual([]);
});
