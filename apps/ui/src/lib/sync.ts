// Keeping the viewer consistent with the daemon across reconnects and overlapping requests (B1b).

/**
 * Whether the open view (one recording, or several joined with "+") is behind: some part's
 * revision on the daemon differs from the one it was rendered at. A recording the daemon no
 * longer lists is left alone; a missing local revision counts as behind.
 */
export function needsReload(openId: string, rendered: Record<string, number>, current: Record<string, number>): boolean {
  return openId
    .split('+')
    .filter(Boolean)
    .some((id) => id in current && rendered[id] !== current[id]);
}

/**
 * Last-request-wins guards. Each call returns a check that stays true only while it is the
 * newest request for its key, so a slow response for a view the user already left cannot land
 * on top of the one they moved to (audit A12).
 */
export function latestOnly(): (key: string) => () => boolean {
  const latest = new Map<string, number>();
  let n = 0;
  return (key) => {
    const mine = ++n;
    latest.set(key, mine);
    return () => latest.get(key) === mine;
  };
}
