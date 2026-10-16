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

/** Refresh during sustained capture, with one request in flight and one trailing refresh.
 * A trailing debounce can starve forever when notices arrive faster than its delay. */
export function liveRefresh(refresh: () => Promise<void>, failed: (error: unknown) => void, delay = 150) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false, dirty = false, closed = false;
  const run = async () => {
    timer = undefined;
    if (closed || running) return;
    dirty = false; running = true;
    try { await refresh(); } catch (error) { if (!closed) failed(error); }
    finally { running = false; if (dirty && !closed) schedule(); }
  };
  const schedule = () => {
    if (closed) return;
    dirty = true;
    if (timer === undefined && !running) timer = setTimeout(() => void run(), delay);
  };
  return { schedule, close() { closed = true; if (timer !== undefined) clearTimeout(timer); } };
}
