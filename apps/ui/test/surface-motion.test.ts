import{afterEach,expect,it,vi}from'vitest';
import{surfaceMotion,surfaceDuration}from'../src/lib/surface-motion.ts';
afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 const animations:{frames:Keyframe[];duration:number;finish:()=>void;cancel:ReturnType<typeof vi.fn>}[]=[];let current={opacity:'1',transform:'none'},enabled=true;
 const node={dataset:{} as Record<string,string>,style:{pointerEvents:''},inert:false,isConnected:true,animate:(frames:Keyframe[],options:{duration:number})=>{let finish!:()=>void,reject!:(reason:unknown)=>void;const finished=new Promise<void>((yes,no)=>{finish=yes;reject=no;}),cancel=vi.fn(()=>reject(Error('Cancelled')));animations.push({frames,duration:options.duration,finish,cancel});return{finished,cancel};}};
 const control=surfaceMotion(node as unknown as HTMLElement,'panel',{allowed:()=>enabled,duration:(_kind,exit)=>exit?160:220,style:()=>({...current}),easing:()=> 'cubic-bezier(.23,1,.32,1)'});
 return{node,animations,control,style:(value:typeof current & {translate?:string;scale?:string})=>{current=value;},enabled:(value:boolean)=>{enabled=value;}};
}
it('reverses from the actual in-flight frame instead of a fixed start size',()=>{
 const f=fixture();f.control.open(true);f.style({opacity:'.43',transform:'none',translate:'0px 2px',scale:'.995'});f.control.close(vi.fn());
 expect(f.animations[1]!.frames[0]).toEqual({opacity:'.43',translate:'0px 2px',scale:'.995'});expect(f.animations[0]!.cancel).toHaveBeenCalledOnce();expect(f.node.inert).toBe(true);expect(f.node.style.pointerEvents).toBe('none');
 f.style({opacity:'.21',transform:'none',translate:'0px 3px',scale:'.99'});f.control.open();expect(f.animations[2]!.frames[0]).toEqual({opacity:'.21',translate:'0px 3px',scale:'.99'});expect(f.node.inert).toBe(false);expect(f.node.style.pointerEvents).toBe('');f.control.dispose();
});
it('an already-resolved old exit cannot close a newer intent',async()=>{
 const f=fixture(),close=vi.fn();f.control.close(close);f.animations[0]!.finish();f.control.open();await Promise.resolve();expect(close).not.toHaveBeenCalled();f.control.dispose();
});
it('a successful exit completes once and retains the actual surface until it finishes',async()=>{
 const f=fixture(),close=vi.fn();f.control.close(close);expect(close).not.toHaveBeenCalled();expect(f.node.dataset.surfacePhase).toBe('closing');f.animations[0]!.finish();await Promise.resolve();expect(close).toHaveBeenCalledOnce();f.control.dispose();
});
it('disabled motion closes immediately and cancels pending animation',()=>{
 const f=fixture(),close=vi.fn();f.control.open(true);f.enabled(false);f.control.close(close);expect(close).toHaveBeenCalledOnce();expect(f.animations).toHaveLength(1);expect(f.animations[0]!.cancel).toHaveBeenCalledOnce();f.control.dispose();
});
it('disposal cancels a queued completion and restores original interaction flags',async()=>{
 const f=fixture(),close=vi.fn();f.control.close(close);f.animations[0]!.finish();f.control.dispose();await Promise.resolve();expect(close).not.toHaveBeenCalled();expect(f.node.inert).toBe(false);expect(f.node.style.pointerEvents).toBe('');expect(f.node.dataset.surfacePhase).toBeUndefined();
});
it('shared CSS timing accepts seconds but refuses invalid or slow UI values',()=>{
 let value='.22s';vi.stubGlobal('document',{documentElement:{}});vi.stubGlobal('getComputedStyle',()=>({getPropertyValue:()=>value}));expect(surfaceDuration('panel')).toBe(220);value='9s';expect(surfaceDuration('panel',true)).toBe(160);value='NaN';expect(surfaceDuration('menu')).toBe(180);
});

it('a repeated pointer close is idempotent but a motion-disabled close finishes immediately',()=>{
 const f=fixture(),first=vi.fn(),next=vi.fn();f.control.close(first);f.control.close(next);expect(f.animations).toHaveLength(1);f.enabled(false);f.control.close(next);expect(next).toHaveBeenCalledOnce();expect(first).not.toHaveBeenCalled();f.control.dispose();
});
