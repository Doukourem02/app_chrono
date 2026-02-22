import { useState, useEffect, useRef, useMemo } from 'react';

interface DriverWithPosition {
  user_id: string;
  current_latitude: number;
  current_longitude: number;
}

interface Position {
  lat: number;
  lng: number;
}

const ANIMATION_DURATION_MS = 2500;

function positionsKey(
  drivers: DriverWithPosition[],
  offsets?: Map<string, Position>
): string {
  return drivers
    .map((d) => {
      const off = offsets?.get(d.user_id);
      const lat = off ? off.lat : d.current_latitude;
      const lng = off ? off.lng : d.current_longitude;
      return `${d.user_id}:${lat.toFixed(6)}:${lng.toFixed(6)}`;
    })
    .sort()
    .join('|');
}

/**
 * Interpole les positions des chauffeurs pour un déplacement fluide sur la carte.
 * Quand les positions sont mises à jour (ex: refresh API), les marqueurs se déplacent
 * en douceur au lieu de "sauter".
 */
export function useAnimatedDriverPositions(
  drivers: DriverWithPosition[],
  driverOffsets?: Map<string, { lat: number; lng: number }>
): Map<string, Position> {
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());
  const previousRef = useRef<Map<string, Position>>(new Map());
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startPositionsRef = useRef<Map<string, Position>>(new Map());

  const depsKey = useMemo(
    () => positionsKey(drivers, driverOffsets),
    [drivers, driverOffsets]
  );

  useEffect(() => {
    if (drivers.length === 0) {
      setPositions(new Map());
      previousRef.current = new Map();
      return;
    }

    const targets = new Map<string, Position>();
    const starts = new Map<string, Position>();

    for (const d of drivers) {
      const off = driverOffsets?.get(d.user_id);
      const target: Position = off
        ? { lat: off.lat, lng: off.lng }
        : { lat: d.current_latitude, lng: d.current_longitude };
      targets.set(d.user_id, target);
      const prev = previousRef.current.get(d.user_id);
      starts.set(d.user_id, prev ?? target);
    }

    const hasMovement = Array.from(targets.entries()).some(([id, t]) => {
      const s = starts.get(id);
      return s && (Math.abs(s.lat - t.lat) > 1e-6 || Math.abs(s.lng - t.lng) > 1e-6);
    });

    if (!hasMovement) {
      setPositions(targets);
      previousRef.current = targets;
      return;
    }

    startPositionsRef.current = starts;
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - (startTimeRef.current ?? 0);
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const next = new Map<string, Position>();
      for (const [id, target] of targets) {
        const start = startPositionsRef.current.get(id) ?? target;
        next.set(id, {
          lat: start.lat + (target.lat - start.lat) * easeOut,
          lng: start.lng + (target.lng - start.lng) * easeOut,
        });
      }
      setPositions(next);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousRef.current = targets;
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [depsKey, drivers, driverOffsets]);

  return positions;
}
