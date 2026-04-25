import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { calculatePrice, getDistanceInKm } from '../services/orderApi';

interface Coords {
  latitude: number;
  longitude: number;
}

interface RouteSnapshot {
  distanceKm: number;
  durationSeconds: number;
  durationTypicalSeconds?: number;
}

export interface DynamicPriceResult {
  price: number;
}

const DEBOUNCE_MS = 400;

export function useDynamicPrice(
  pickupCoords: Coords | null | undefined,
  dropoffCoords: Coords | null | undefined,
  selectedMethod: string | null | undefined,
  speedOptionId: string | undefined,
  routeSnapshot: RouteSnapshot | null | undefined,
): DynamicPriceResult {
  const [price, setPrice] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords || !selectedMethod) {
      setPrice(0);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const airKm = getDistanceInKm(pickupCoords, dropoffCoords);
        const distance = routeSnapshot?.distanceKm ?? airKm;

        const res = await fetch(`${config.apiUrl}/api/payments/calculate-price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            distance,
            deliveryMethod: selectedMethod,
            speedOptionId,
            pickup: { coordinates: pickupCoords },
            routeDurationSeconds: routeSnapshot?.durationSeconds,
            routeDurationTypicalSeconds: routeSnapshot?.durationTypicalSeconds,
          }),
        });

        if (!res.ok) throw new Error(`price-preview ${res.status}`);

        const data = await res.json();
        if (data.success && typeof data.price === 'number') {
          setPrice(data.price);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        const airKm = getDistanceInKm(pickupCoords, dropoffCoords);
        const distance = routeSnapshot?.distanceKm ?? airKm;
        const fallback = calculatePrice(distance, (selectedMethod ?? 'moto') as 'moto' | 'vehicule' | 'cargo');
        setPrice(fallback);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pickupCoords?.latitude,
    pickupCoords?.longitude,
    dropoffCoords?.latitude,
    dropoffCoords?.longitude,
    selectedMethod,
    speedOptionId,
    routeSnapshot?.distanceKm,
    routeSnapshot?.durationSeconds,
    routeSnapshot?.durationTypicalSeconds,
  ]);

  return { price };
}
