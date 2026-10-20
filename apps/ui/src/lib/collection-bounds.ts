/** Natural height for short collections; a row budget for long, locally scrollable ones.
 * Row height is a budget, not a fixed item height: wrapped content is never clipped. */
export function collectionBounds(count:number,rows=6,rowHeight=36) {
  if(!Number.isInteger(count)||count<0||!Number.isInteger(rows)||rows<1||!Number.isFinite(rowHeight)||rowHeight<=0)throw new RangeError('Invalid collection bounds');
  return {state:count>rows?'scroll' as const:'fit' as const,maxBlockSize:count>rows?rows*rowHeight:undefined};
}

/** Same fit-or-bound policy for a paged collection. Clamp saved pages after shrink. */
export function collectionPage(count:number,page=0,size=8){
 const bounds=collectionBounds(count,size,1);
 if(!Number.isInteger(page)||page<0)throw new RangeError('Invalid collection page');
 const pages=Math.max(1,Math.ceil(count/size)),current=Math.min(page,pages-1),start=current*size;
 return {state:bounds.state==='fit'?'fit' as const:'page' as const,page:current,pages,start,end:Math.min(count,start+size)};
}
