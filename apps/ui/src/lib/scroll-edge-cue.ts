export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface ScrollEdgeCue {
  top: boolean;
  bottom: boolean;
}

/** Reports whether content overflows above and/or below a scroll container's viewport. */
export function scrollEdgeCue(metrics: ScrollMetrics, threshold = 2): ScrollEdgeCue {
  const { scrollTop, scrollHeight, clientHeight } = metrics;
  if (!Number.isFinite(scrollTop) || !Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight) || clientHeight <= 0) {
    return { top: false, bottom: false };
  }
  const max = Math.max(0, scrollHeight - clientHeight);
  if (max <= threshold) return { top: false, bottom: false };
  const clampedTop = Math.max(0, Math.min(max, scrollTop));
  return {
    top: clampedTop > threshold,
    bottom: clampedTop < max - threshold,
  };
}
