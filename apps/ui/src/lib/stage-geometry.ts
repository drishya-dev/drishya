/** Resolve the actual CSS length (including calc/rem/var), rather than parsing its unevaluated source. */
export function stageWidth(root:HTMLElement=document.documentElement):number {
 const probe=root.ownerDocument.createElement('div');
 probe.style.cssText='position:fixed;left:0;top:0;width:var(--stage-max,100vw);height:0;padding:0;border:0;margin:0;visibility:hidden;pointer-events:none;contain:strict';
 root.appendChild(probe);
 const width=probe.getBoundingClientRect().width;probe.remove();
 return width>0&&Number.isFinite(width)?width:root.ownerDocument.defaultView?.innerWidth??root.clientWidth;
}

/** Browser zoom/OS scaling decide text size. Only the stage's physical-width cap follows the device ratio. */
export function installStageGeometry(target:Window=window,root:HTMLElement=target.document.documentElement):()=>void {
 const previous=root.style.getPropertyValue('--device-ratio'),limited=root.hasAttribute('data-stage-limited');
 let media:MediaQueryList|undefined;
 const update=()=>{
  const ratio=Number.isFinite(target.devicePixelRatio)&&target.devicePixelRatio>0?target.devicePixelRatio:1;
  root.style.setProperty('--device-ratio',String(ratio));
  root.toggleAttribute('data-stage-limited',target.innerWidth>stageWidth(root)+.5);
  media?.removeEventListener('change',update);
  media=target.matchMedia(`(resolution: ${ratio}dppx)`);media.addEventListener('change',update);
  target.dispatchEvent(new Event('drishya-stage-change'));
 };
 target.addEventListener('resize',update);update();
 return()=>{target.removeEventListener('resize',update);media?.removeEventListener('change',update);if(previous)root.style.setProperty('--device-ratio',previous);else root.style.removeProperty('--device-ratio');root.toggleAttribute('data-stage-limited',limited);};
}
