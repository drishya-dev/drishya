import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';

function luminance(hex:string) {
  const full=hex.length===4?'#'+[...hex.slice(1)].map(value=>value+value).join(''):hex;
  const channels=[1,3,5].map(index=>parseInt(full.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722;
}
function contrast(a:string,b:string) {const [low,high]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (high!+.05)/(low!+.05);}

it('keeps readable Modern text and syntax on the base and elevated palette surfaces',()=>{
  expect(contrast('#000','#fff')).toBe(21);expect(contrast('#fff','#fff')).toBe(1);
  const css=readFileSync(new URL('../src/modern/theme-presets.css',import.meta.url),'utf8');
  const failures:string[]=[];let palettes=0;
  for(const [,palette,body] of css.matchAll(/\[data-palette=(\w+)\]\s*\{([^}]+)\}/g)) {
    const tokens=Object.fromEntries([...body!.matchAll(/(--[\w-]+):\s*(#[\da-f]{3,6})\s*;/gi)].map(([,key,value])=>[key!,value!]));
    if(!tokens['--bg'])continue;palettes++;
    for(const foreground of ['--t1','--t2','--t3','--t4','--syntax-keyword','--syntax-string','--syntax-function','--syntax-number']) {
      for(const background of ['--bg','--s1','--s2','--s3']) {
        const ratio=contrast(tokens[foreground]!,tokens[background]!);
        if(ratio<4.5)failures.push(`${palette}: ${foreground} on ${background} = ${ratio.toFixed(3)}`);
      }
    }
  }
  expect(palettes).toBe(7);expect(failures).toEqual([]);
});
