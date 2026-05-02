export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbor heuristic — returns original indices in optimized order
export function optimizeRouteOrder(
  points: Array<{ lat: number; lng: number; originalIndex: number }>
): number[] {
  if (points.length <= 1) return points.map((p) => p.originalIndex);

  const unvisited = [...points];
  const route: number[] = [];

  let current = unvisited.splice(0, 1)[0]!;
  route.push(current.originalIndex);

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(current.lat, current.lng, unvisited[i]!.lat, unvisited[i]!.lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    current = unvisited.splice(nearestIdx, 1)[0]!;
    route.push(current.originalIndex);
  }

  return route;
}
