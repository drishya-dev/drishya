import type { Page } from '@playwright/test';

// UI-6: one in-page measurement of the phone defects that no single control test sees: sideways overflow, controls
// below the hit-target floor, controls another element sits on top of, and text cut off without an ellipsis.
// It reads geometry only (numbers and class names), never captured text.
export interface PhoneMetrics {
  overflow: number;
  offscreen: string[];
  small: string[];
  /** Floating chrome (fixed or sticky) another element sits on top of. */
  occluded: string[];
  /** Scrolling content a floating layer covers at its centre: normal while scrolling, listed so a layer that hides too much shows. */
  covered: string[];
  clipped: string[];
  /** Children an overflow:hidden parent cuts through (a tag half hidden by its row). */
  cut: string[];
  controls: number;
}

export const PHONE_SIZES = [[320, 700], [360, 740], [390, 844], [430, 932], [844, 390]] as const;
export const HIT_FLOOR = 32;

export async function phoneMetrics(page: Page, scope = 'body'): Promise<PhoneMetrics> {
  return page.evaluate(({ scope, floor }) => {
    const root = document.querySelector(scope) ?? document.body;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${[...el.classList].slice(0, 2).join('.')}`;
    // An element a scroller or an overflow:hidden ancestor cuts off is not "off screen": the ancestor owns it.
    const clipRect = (el: Element) => {
      let left = 0, right = vw, top = 0, bottom = vh;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const b = p.getBoundingClientRect();
        if (s.overflowX !== 'visible') { left = Math.max(left, b.left); right = Math.min(right, b.right); }
        if (s.overflowY !== 'visible') { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
      }
      return { left, right, top, bottom };
    };
    const seen = (el: Element) => (el as HTMLElement).getClientRects().length > 0 && (el as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !el.closest('[aria-hidden=true],[inert]');
    const out: PhoneMetrics = { overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw, offscreen: [], small: [], occluded: [], covered: [], clipped: [], cut: [], controls: 0 };
    const controlSelector = 'button, a[href], summary, select, input:not([type=hidden]), textarea, [role=button], [role=menuitem], [role=tab], [role=switch], [role=checkbox], [role=radio], [tabindex]:not([tabindex="-1"])';
    const interactive = new Set<Element>();
    for (const el of root.querySelectorAll(controlSelector)) if (seen(el) && !(el as HTMLButtonElement).disabled) interactive.add(el);
    for (const el of root.querySelectorAll('*')) {
      if (!seen(el) || el.matches('svg *')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const { left, right } = clipRect(el);
      const style = getComputedStyle(el);
      // Text that runs past an edge is only a defect when nothing clips it on purpose.
      if (style.position !== 'fixed' && (rect.right > Math.min(right, vw) + 1 || rect.left < Math.max(left, 0) - 1) && rect.right > vw + 1 && interactive.has(el)) out.offscreen.push(`${name(el)} ${Math.round(rect.left)}..${Math.round(rect.right)}`);
      if (interactive.has(el) && rect.left < -1) out.offscreen.push(`${name(el)} ${Math.round(rect.left)}..${Math.round(rect.right)}`);
      if (style.overflowY === 'hidden' && !style.display.includes('box')) for (const child of el.children) {
        if (!seen(child) || child.matches('svg, svg *')) continue;
        const cr = child.getBoundingClientRect();
        if (cr.width === 0 || cr.height === 0) continue;
        if (cr.bottom > rect.bottom + 1 && cr.top < rect.bottom - 1) out.cut.push(`${name(child)} in ${name(el)} by ${Math.round(cr.bottom - rect.bottom)}px`);
      }
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim());
      if (own && style.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 && style.textOverflow !== 'ellipsis' && style.whiteSpace === 'nowrap' && !['auto', 'scroll'].includes(style.overflowX)) out.clipped.push(`${name(el)} ${el.scrollWidth}/${el.clientWidth}`);
    }
    for (const el of interactive) {
      if (el.matches('input[type=checkbox],input[type=radio]') && el.closest('label')) continue;
      out.controls++;
      const rect = el.getBoundingClientRect(), { left, right, top: clipTop, bottom: clipBottom } = clipRect(el);
      if (rect.width === 0 || rect.height === 0) continue;
      // The hit area people feel is the control or its label wrapper, whichever is bigger.
      const host = el.closest('label') ?? el;
      const hit = host.getBoundingClientRect();
      if (Math.min(hit.width, hit.height) < floor - 0.5) out.small.push(`${name(el)} ${Math.round(hit.width)}x${Math.round(hit.height)}`);
      // Occlusion: sample the centre of the part of the control that is on screen.
      const y0 = Math.max(rect.top, clipTop), y1 = Math.min(rect.bottom, clipBottom), x = (Math.max(rect.left, left, 0) + Math.min(rect.right, right, vw)) / 2, y = (y0 + y1) / 2;
      if (y1 - y0 < 2) continue;
      if (x <= 0 || x >= vw || y <= 0 || y >= vh || Math.min(rect.right, right) - Math.max(rect.left, left) < 2) continue;
      const top = document.elementFromPoint(x, y);
      if (top && top !== el && !el.contains(top) && !top.contains(el) && !(el.closest('label')?.contains(top))) {
        const layer = (n: Element) => { for (let p: Element | null = n; p && p !== document.body; p = p.parentElement) { const position = getComputedStyle(p).position; if (position === 'fixed' || position === 'sticky') return p; } return null; };
        (layer(el) ? out.occluded : out.covered).push(`${name(el)} under ${name(top)}`);
      }
    }
    return out;
  }, { scope, floor: HIT_FLOOR });
}

// Floating surfaces that must never lie on top of each other on a phone. The header groups are not listed: the header
// is owned by UI-1 and has its own guard there.
export const SURFACES: Record<string, string> = {
  drawer: '.map-connections',
  mapTools: '.map-tools',
  zoom: '.map-zoom',
  legend: '.map-legend',
  toolsButton: '.catalog-toggle',
  toolbox: '.workbench-station',
  composer: '.prompt-composer',
  follow: '.workspace-follow',
  files: '.folder-explorer',
};

export async function surfaceOverlaps(page: Page): Promise<string[]> {
  return page.evaluate(surfaces => {
    const found = Object.entries(surfaces).flatMap(([name, selector]) => [...document.querySelectorAll(selector)].filter(el => (el as HTMLElement).getClientRects().length && (el as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).map(el => ({ name, rect: el.getBoundingClientRect() })));
    const header = [...document.querySelectorAll('.workspace-header, .workspace-leading, .workspace-secondary')].filter(el => (el as HTMLElement).getClientRects().length).map(el => ({ name: `header:${el.className.split(' ')[0]}`, rect: el.getBoundingClientRect() }));
    const out: string[] = [];
    const area = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    for (let i = 0; i < found.length; i++) {
      for (let j = i + 1; j < found.length; j++) if (found[i]!.name !== found[j]!.name || false) { const px = area(found[i]!.rect, found[j]!.rect); if (px > 4) out.push(`${found[i]!.name}/${found[j]!.name} ${Math.round(px)}px²`); }
      for (const h of header) { const px = area(found[i]!.rect, h.rect); if (px > 4) out.push(`${found[i]!.name}/${h.name} ${Math.round(px)}px²`); }
    }
    return out;
  }, SURFACES);
}
