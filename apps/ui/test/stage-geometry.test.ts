import{expect,it,vi}from'vitest';
import{installStageGeometry,stageWidth}from'../src/lib/stage-geometry.ts';
function environment(){
 const values=new Map<string,string>(),attributes=new Set<string>(),listeners=new Map<string,()=>void>(),queries:{query:string;change?:()=>void}[]=[];
 const target={devicePixelRatio:1,innerWidth:1920,document:{} as unknown,addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name),dispatchEvent:vi.fn(),matchMedia:(query:string)=>{const record:{query:string;change?:()=>void}={query};queries.push(record);return{addEventListener:(_name:string,fn:()=>void)=>record.change=fn,removeEventListener:()=>{record.change=undefined;}};}};
 const root={style:{getPropertyValue:(name:string)=>values.get(name)??'',setProperty:(name:string,value:string)=>values.set(name,value),removeProperty:(name:string)=>values.delete(name)},hasAttribute:(name:string)=>attributes.has(name),toggleAttribute:(name:string,on:boolean)=>on?attributes.add(name):attributes.delete(name),appendChild:vi.fn(),ownerDocument:{defaultView:target,createElement:()=>({style:{cssText:''},getBoundingClientRect:()=>({width:2560/Number(values.get('--device-ratio')??1)}),remove:vi.fn()})}};
 target.document={documentElement:root};return{target:target as unknown as Window,root:root as unknown as HTMLElement,values,attributes,listeners,queries};
}
it('installs before rendering, updates on ratio-only changes and rearms its resolution listener',()=>{
 const env=environment(),stop=installStageGeometry(env.target,env.root);
 expect(env.values.get('--device-ratio')).toBe('1');expect(stageWidth(env.root)).toBe(2560);
 Object.defineProperty(env.target,'devicePixelRatio',{value:.5,writable:true});Object.defineProperty(env.target,'innerWidth',{value:3840,writable:true});env.queries[0]!.change!();
 expect(env.values.get('--device-ratio')).toBe('0.5');expect(env.queries[0]!.change).toBeUndefined();expect(env.queries.at(-1)!.query).toContain('0.5dppx');expect(env.attributes.has('data-stage-limited')).toBe(false);expect([...env.values.keys()]).toEqual(['--device-ratio']);stop();expect(env.listeners.size).toBe(0);expect(env.queries.at(-1)!.change).toBeUndefined();expect(env.values.size).toBe(0);
});
it('centres only a physically wide viewport, including high-density displays',()=>{
 const env=environment();Object.defineProperty(env.target,'innerWidth',{value:5120,writable:true});const stop=installStageGeometry(env.target,env.root);expect(env.attributes.has('data-stage-limited')).toBe(true);
 Object.defineProperty(env.target,'innerWidth',{value:1920,writable:true});env.listeners.get('resize')!();expect(env.attributes.has('data-stage-limited')).toBe(false);
 Object.defineProperty(env.target,'devicePixelRatio',{value:2,writable:true});env.queries.at(-1)!.change!();expect(env.attributes.has('data-stage-limited')).toBe(true);expect(stageWidth(env.root)).toBe(1280);stop();
});
it('rejects a non-finite device ratio without touching font size and restores previous state',()=>{
 const env=environment();env.values.set('--device-ratio','1.25');env.attributes.add('data-stage-limited');Object.defineProperty(env.target,'devicePixelRatio',{value:NaN});const stop=installStageGeometry(env.target,env.root);expect(env.values.get('--device-ratio')).toBe('1');expect(env.values.has('font-size')).toBe(false);stop();expect(env.values.get('--device-ratio')).toBe('1.25');expect(env.attributes.has('data-stage-limited')).toBe(true);
});
