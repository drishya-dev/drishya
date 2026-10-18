export interface ReadingWindowLayout { x?: number; y?: number; width?:number; height?: number }
export interface ReadingWindowBounds { width: number; height: number; top: number; left?:number; right?:number; bottom?:number }

/** Saved geometry is a preference, never permission to leave the current viewport. */
export function readingWindowLayout(saved: ReadingWindowLayout, size: {width:number;height:number}, viewport: ReadingWindowBounds): ReadingWindowLayout {
  const left=viewport.left??12,right=viewport.right??viewport.width-12;
  const top=viewport.bottom===undefined?Math.min(Math.max(12,viewport.top),Math.max(12,viewport.height-180)):viewport.top,bottom=viewport.bottom??viewport.height-12;
  const available=Math.max(120,bottom-top),availableWidth=Math.max(120,right-left);
  const height=typeof saved.height==='number'&&Number.isFinite(saved.height)?Math.max(Math.min(220,available),Math.min(available,saved.height)):undefined;
  const width=typeof saved.width==='number'&&Number.isFinite(saved.width)?Math.max(Math.min(360,availableWidth),Math.min(availableWidth,saved.width)):undefined;
  const dimensions={...(height===undefined?{}:{height}),...(width===undefined?{}:{width})};
  if(typeof saved.x!=='number'||!Number.isFinite(saved.x)||typeof saved.y!=='number'||!Number.isFinite(saved.y))return dimensions;
  return {...dimensions,x:Math.max(left,Math.min(Math.max(left,right-(width??size.width)),saved.x)),y:Math.max(top,Math.min(Math.max(top,bottom-(height??size.height)),saved.y))};
}

export type ReadingEdge='left'|'right'|'top'|'bottom';
export interface WindowRect {x:number;y:number;width:number;height:number}
/** The opposite edge stays anchored, including at minimum size and viewport boundaries. */
export function resizeReadingWindow(rect:WindowRect,edge:ReadingEdge,delta:number,viewport:ReadingWindowBounds):WindowRect{
 const left=viewport.left??12,right=viewport.right??viewport.width-12,top=viewport.bottom===undefined?Math.max(12,Math.min(viewport.top,Math.max(12,viewport.height-232))):viewport.top,bottom=viewport.bottom??viewport.height-12;
 const minWidth=Math.min(360,right-left),minHeight=Math.min(220,bottom-top);
 if(edge==='left'){const x=Math.max(left,Math.min(rect.x+rect.width-minWidth,rect.x+delta));return {...rect,x,width:rect.x+rect.width-x};}
 if(edge==='right')return {...rect,width:Math.max(minWidth,Math.min(right-rect.x,rect.width+delta))};
 if(edge==='top'){const y=Math.max(top,Math.min(rect.y+rect.height-minHeight,rect.y+delta));return {...rect,y,height:rect.y+rect.height-y};}
 return {...rect,height:Math.max(minHeight,Math.min(bottom-rect.y,rect.height+delta))};
}
