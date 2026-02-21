/**
 * Calcule un offset pour séparer visuellement les marqueurs qui ont la même position
 * (ex: simulateur avec même lat/lng pour plusieurs chauffeurs)
 * Comme admin_chrono/utils/markerOffset.ts
 */

export function calculateOptimalRadius(zoom: number): number {
  if (zoom >= 15) return 100;
  if (zoom >= 13) return 150;
  if (zoom >= 12) return 180;
  if (zoom >= 10) return 220;
  return 300;
}

function calculateMarkerOffset(
  position: { lat: number; lng: number },
  index: number,
  totalInGroup: number,
  radiusMeters: number = 100
): { lat: number; lng: number } {
  if (totalInGroup <= 1) return position;

  const angleStep = (2 * Math.PI) / totalInGroup;
  const angle = index * angleStep;
  const latOffset = (radiusMeters / 111000) * Math.cos(angle);
  const lngOffset = (radiusMeters / (111000 * Math.cos((position.lat * Math.PI) / 180))) * Math.sin(angle);

  return {
    lat: position.lat + latOffset,
    lng: position.lng + lngOffset,
  };
}

export interface DriverWithPosition {
  user_id: string;
  current_latitude?: number;
  current_longitude?: number;
}

/**
 * Groupe les drivers par position et calcule les offsets pour les séparer visuellement
 */
export function calculateDriverOffsets<T extends DriverWithPosition>(
  drivers: T[],
  zoom?: number
): Map<string, { lat: number; lng: number }> {
  const offsetMap = new Map<string, { lat: number; lng: number }>();
  const positionGroups = new Map<string, T[]>();
  const TOLERANCE = 0.00001;

  drivers.forEach((driver) => {
    if (!driver.current_latitude || !driver.current_longitude) return;

    const position = {
      lat: driver.current_latitude,
      lng: driver.current_longitude,
    };

    let foundGroup = false;
    for (const [groupKey, groupDrivers] of positionGroups.entries()) {
      const [groupLat, groupLng] = groupKey.split(',').map(Number);
      const latDiff = Math.abs(position.lat - groupLat);
      const lngDiff = Math.abs(position.lng - groupLng);

      if (latDiff < TOLERANCE && lngDiff < TOLERANCE) {
        groupDrivers.push(driver);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      positionGroups.set(`${position.lat},${position.lng}`, [driver]);
    }
  });

  const optimalRadius = zoom ? calculateOptimalRadius(zoom) : 200;

  positionGroups.forEach((groupDrivers, groupKey) => {
    const [centerLat, centerLng] = groupKey.split(',').map(Number);
    const centerPosition = { lat: centerLat, lng: centerLng };

    groupDrivers.forEach((driver, index) => {
      const offsetPosition = calculateMarkerOffset(centerPosition, index, groupDrivers.length, optimalRadius);
      offsetMap.set(driver.user_id, { lat: offsetPosition.lat, lng: offsetPosition.lng });
    });
  });

  return offsetMap;
}
