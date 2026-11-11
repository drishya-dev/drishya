/** DOM paint boundary: canvas/WebGL consume the same computed tokens as DOM text.
 * Geometry modules receive these values explicitly and remain deterministic. */
let key='',style:CSSStyleDeclaration|undefined;
const values=new Map<string,string>();
export function paletteKey(){return typeof document==='undefined'?'jet':`${document.documentElement.dataset.theme}/${document.documentElement.dataset.palette}`;}
export function palettePaint(name:string):string{
  const next=paletteKey();if(key!==next){key=next;values.clear();style=typeof document==='undefined'?undefined:getComputedStyle(document.documentElement);}
  const cached=values.get(name);if(cached)return cached;
  const value=style?.getPropertyValue(name).trim();if(!value)throw Error(`Missing active palette token: ${name}`);values.set(name,value);return value;
}
export function paletteRGB(name:string):[number,number,number]{
  const value=palettePaint(name),hex=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if(hex){const h=hex[1]!.length===3?[...hex[1]!].map(c=>c+c).join(''):hex[1]!;return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255) as [number,number,number];}
  const rgb=/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value);
  if(rgb)return rgb.slice(1,4).map(n=>Number(n)/255) as [number,number,number];
  throw Error(`Palette token is not an RGB paint: ${name}`);
}
