import { haversineKm } from "@/lib/road-distance";

export type OptimizablePoint = {
  latitude: number;
  longitude: number;
  code?: string;
};

function hasValidCoords(point: OptimizablePoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

function getDistance(a: OptimizablePoint, b: OptimizablePoint): number {
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
}

function calculateRouteDistance(points: OptimizablePoint[]): number {
  if (points.length < 2) return 0;

  return points.reduce((total, point, index) => {
    const next = points[index + 1];
    return next ? total + getDistance(point, next) : total;
  }, 0);
}

function greedyNearestNeighbor(points: OptimizablePoint[], start: OptimizablePoint): OptimizablePoint[] {
  const remaining = [...points];
  const ordered: OptimizablePoint[] = [];
  let current = start;

  while (remaining.length > 0) {
    const nextIndex = remaining.reduce((bestIndex, candidate, candidateIndex) => {
      const currentDistance = getDistance(current, candidate);
      if (currentDistance < bestIndex.distance) {
        return { distance: currentDistance, index: candidateIndex };
      }
      return bestIndex;
    }, { distance: Number.POSITIVE_INFINITY, index: 0 });

    const next = remaining.splice(nextIndex.index, 1)[0];
    ordered.push(next);
    current = next;
  }

  return ordered;
}

const TWO_OPT_MAX_ITERATIONS = 500;

function twoOptImprove(points: OptimizablePoint[]): OptimizablePoint[] {
  const improved = [...points];

  if (improved.length < 4) return improved;

  let changed = true;
  let iterations = 0;

  while (changed && iterations < TWO_OPT_MAX_ITERATIONS) {
    changed = false;
    iterations += 1;
    const currentDistance = calculateRouteDistance(improved);

    for (let i = 0; i < improved.length - 2; i += 1) {
      for (let j = i + 1; j < improved.length - 1; j += 1) {
        const candidate = [...improved];
        candidate.splice(i, j - i + 1, ...improved.slice(i, j + 1).reverse());
        const candidateDistance = calculateRouteDistance(candidate);

        if (candidateDistance < currentDistance) {
          improved.splice(0, improved.length, ...candidate);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return improved;
}

export function optimizeRouteOrder<T extends OptimizablePoint>(
  points: ReadonlyArray<T>,
  start: { lat: number; lng: number },
): T[] {
  const validPoints = points.filter((point) => hasValidCoords(point));
  const invalidPoints = points.filter((point) => !hasValidCoords(point));

  if (validPoints.length === 0) return [...points];
  if (validPoints.length === 1) return [...points];

  const startPoint = {
    latitude: start.lat,
    longitude: start.lng,
  };
  const candidateStarts = [...validPoints]
    .sort((left, right) => getDistance(startPoint, left) - getDistance(startPoint, right))
    .slice(0, Math.min(5, validPoints.length));

  const bestRoute = candidateStarts.reduce<{ route: T[]; distance: number } | null>((best, candidate) => {
    const initialRoute = greedyNearestNeighbor([candidate, ...validPoints.filter((point) => point !== candidate)], candidate);
    const improvedRoute = twoOptImprove(initialRoute);
    const totalDistance = calculateRouteDistance(improvedRoute);

    if (!best || totalDistance < best.distance) {
      return { route: improvedRoute as T[], distance: totalDistance };
    }

    return best;
  }, null);

  const route = bestRoute?.route ?? [...validPoints];
  return [...route, ...invalidPoints];
}
