/** Material-space offset while a mode reflow can fold a tall run into a line. */
export function modeAnchorOffset(offset:number,originalHeight:number,height:number):number {
  if(height>=originalHeight-.5)return offset;
  return Math.max(offset,Math.min(0,Math.min(height,12)-height));
}
