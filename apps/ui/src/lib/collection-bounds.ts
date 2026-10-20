/** Natural height for short collections; a row budget for long, locally scrollable ones.
 * Row height is a budget, not a fixed item height: wrapped content is never clipped. */
export function collectionBounds(count:number,rows=6,rowHeight=36) {
  if(!Number.isInteger(count)||count<0||!Number.isInteger(rows)||rows<1||!Number.isFinite(rowHeight)||rowHeight<=0)throw new RangeError('Invalid collection bounds');
  return {state:count>rows?'scroll' as const:'fit' as const,maxBlockSize:count>rows?rows*rowHeight:undefined};
}
