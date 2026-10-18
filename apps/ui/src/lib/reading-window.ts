export interface ReadingWindowLayout { x?: number; y?: number; height?: number }
export interface ReadingWindowBounds { width: number; height: number; top: number }

/** Saved geometry is a preference, never permission to leave the current viewport. */
export function readingWindowLayout(saved: ReadingWindowLayout, size: {width:number;height:number}, viewport: ReadingWindowBounds): ReadingWindowLayout {
  const top=Math.min(Math.max(12,viewport.top),Math.max(12,viewport.height-180));
  const available=Math.max(120,viewport.height-top-12);
  const height=typeof saved.height==='number'&&Number.isFinite(saved.height)?Math.max(Math.min(220,available),Math.min(available,saved.height)):undefined;
  const dimensions=height===undefined?{}:{height};
  if(typeof saved.x!=='number'||!Number.isFinite(saved.x)||typeof saved.y!=='number'||!Number.isFinite(saved.y))return dimensions;
  return {...dimensions,x:Math.max(12,Math.min(Math.max(12,viewport.width-size.width-12),saved.x)),y:Math.max(top,Math.min(Math.max(top,viewport.height-(height??size.height)-12),saved.y))};
}
