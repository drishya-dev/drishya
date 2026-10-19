interface Rect {left:number;top:number;width:number;height:number}
/** Rectangles are screen pixels; CSS translations are local pixels under a compact passage. */
export function materialTransform(source:Rect,target:Rect,zoom=1):string{
 const scale=Number.isFinite(zoom)&&zoom>0?zoom:1;
 return `translate(${(source.left-target.left)/scale}px,${(source.top-target.top)/scale}px) scale(${source.width/Math.max(1,target.width)},${source.height/Math.max(1,target.height)})`;
}
