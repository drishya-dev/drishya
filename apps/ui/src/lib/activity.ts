import type { Marker } from '@drishya/scene';

/** A visual sample, never a navigation index or a claim about unsampled outcomes. */
export function sampleActivity(markers: Marker[], limit = 400): Marker[] {
  if (markers.length <= limit) return markers;
  const chosen = new Set<number>();
  const sample = (indices: number[], budget: number) => {
    const n = Math.min(indices.length, budget);
    for (let i = 0; i < n; i++) chosen.add(indices[n === 1 ? 0 : Math.round(i * (indices.length - 1) / (n - 1))]!);
  };
  // Reserve half the budget for failures; sample remaining chronology including endpoints.
  sample(markers.flatMap((m, i) => m.type === 'fail' ? [i] : []), Math.floor(limit / 2));
  sample(markers.map((_, i) => i).filter((i) => !chosen.has(i)), limit - chosen.size);
  return [...chosen].sort((a, b) => a - b).map((i) => markers[i]!);
}
