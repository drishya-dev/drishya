export interface OriginBounds {left:number;top:number;right:number;bottom:number;width:number;height:number}

/** A clipped row is not a motion origin: the whole filename must have a visible home. */
export function containsOrigin(row: OriginBounds, bounds: Pick<OriginBounds,'left'|'top'|'right'|'bottom'>): boolean {
  return row.width > 0 && row.height > 0 && row.left >= bounds.left && row.top >= bounds.top && row.right <= bounds.right && row.bottom <= bounds.bottom;
}

/** Read at the arrival's measurement frame. Never cache virtualized tree rows or expand folders to create an origin. */
export function fileTreeOrigin(viewer: Element, path: string): HTMLElement | undefined {
  for (const row of viewer.querySelectorAll<HTMLElement>('.folder-tree [data-spine-path]')) {
    if (row.dataset.spinePath !== path || !row.isConnected) continue;
    const rect = row.getBoundingClientRect();
    if (!containsOrigin(rect, {left:0,top:0,right:innerWidth,bottom:innerHeight})) continue;
    let visible = true;
    for (let ancestor: HTMLElement | null = row; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0) { visible = false; break; }
      // Include every actual clipping ancestor, not just the tree's named shell:
      // search results, resized panels and nested scrollers can all clip a row.
      const clipX = /hidden|clip|scroll|auto/.test(style.overflowX), clipY = /hidden|clip|scroll|auto/.test(style.overflowY);
      if (clipX || clipY) {
        const bounds = ancestor.getBoundingClientRect();
        if (clipX && (rect.left < bounds.left || rect.right > bounds.right) || clipY && (rect.top < bounds.top || rect.bottom > bounds.bottom)) { visible = false; break; }
      }
    }
    if (!visible) continue;
    // Test both the filename area and its leading icon. A modal or another panel
    // over the tree must never lend the hidden row its apparent screen position.
    const points = [[rect.left + Math.min(20,rect.width/2),rect.top+rect.height/2],[rect.left+rect.width/2,rect.top+rect.height/2]];
    if (points.every(([x,y]) => { const hit=document.elementFromPoint(x!,y!); return !!hit && (hit === row || row.contains(hit)); })) return row;
  }
  return undefined;
}
