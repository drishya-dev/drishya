/* Drishya never derives the interface size from the viewport (Yash, 11 Nov): browser zoom and the OS display scaling
   control it, as in VS Code or Slack. The factor is therefore always 1. The API stays so that its callers (and the
   px->rem build step, which is identity at a 16 px root) keep working without a second edit. */
export const INTERFACE_REFERENCE = { width: 1440, height: 900 } as const;
export const INTERFACE_SCALE_LIMIT = 1;

export const interfaceScale = (_width?: number, _height?: number): 1 => 1;

/** Logical design lengths become rem; DOM measurements and pointer coordinates remain CSS pixels. */
export const interfaceRem = (pixels: number) => `${pixels / 16}rem`;

export const currentInterfaceScale = (): 1 => 1;
export const useInterfaceScale = (): 1 => 1;

/** Kept for ProductShell; there is nothing to install now that the factor is constant. */
export function installInterfaceScale(): () => void {
  return () => {};
}
