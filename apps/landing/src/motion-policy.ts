export type MotionMode = 'auto' | 'reduced' | 'off';

export interface MotionInputs {
  width: number;
  height: number;
  finePointer: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  lowResource: boolean;
  hidden: boolean;
  queryOff: boolean;
  userMode: MotionMode;
}

export interface MotionPolicy {
  animate: boolean;
  pin: boolean;
  pointer: boolean;
  intro: boolean;
  static: boolean;
  reason: 'full' | 'query-off' | 'user-off' | 'system-reduced' | 'save-data' | 'low-resource' | 'user-reduced' | 'hidden' | 'invalid-viewport';
}

export function resolveMotionPolicy(input: MotionInputs): MotionPolicy {
  const validViewport = Number.isFinite(input.width) && Number.isFinite(input.height) && input.width > 0 && input.height > 0;
  const pin = validViewport && input.width >= 1000 && input.height >= 700;
  const base = {pin, pointer: false};
  if (!validViewport) return {...base, animate: false, intro: false, static: true, reason: 'invalid-viewport'};
  if (input.hidden) return {...base, animate: false, intro: false, static: true, reason: 'hidden'};
  if (input.queryOff) return {...base, animate: false, intro: false, static: true, reason: 'query-off'};
  if (input.userMode === 'off') return {...base, animate: false, intro: false, static: true, reason: 'user-off'};
  if (input.reducedMotion) return {...base, animate: false, intro: false, static: true, reason: 'system-reduced'};
  if (input.saveData) return {...base, animate: false, intro: false, static: true, reason: 'save-data'};
  if (input.lowResource) return {...base, animate: false, intro: false, static: true, reason: 'low-resource'};
  if (input.userMode === 'reduced') return {...base, animate: false, intro: false, static: true, reason: 'user-reduced'};
  return {...base, animate: true, intro: input.width >= 600 && input.height >= 650, pointer: input.finePointer, static: false, reason: 'full'};
}
