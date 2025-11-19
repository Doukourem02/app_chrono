import { useCallback, useMemo, useRef, useState } from 'react';


export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<number | undefined>(undefined);

  useMemo(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay) as unknown as number;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useThrottle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T => {
  const lastCallTime = useRef<number>(0);
  const timeoutRef = useRef<number | undefined>(undefined);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime.current;

      if (timeSinceLastCall >= delay) {
        lastCallTime.current = now;
        return func(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastCallTime.current = Date.now();
          return func(...args);
        }, delay - timeSinceLastCall) as unknown as number;
      }
    }) as T,
    [func, delay]
  );
};

export const useMemoizedCalculation = <T>(
  calculation: () => T,
  dependencies: React.DependencyList
): T => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => calculation(), [...dependencies, calculation]);
};

export const useAsyncState = <T>() => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (asyncFunction: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
};

export const useOptimizedCoordinates = (
  coords: { latitude: number; longitude: number } | null,
  precision: number = 6
) => {
  return useMemo(() => {
    if (!coords) return null;
    return {
      latitude: Number(coords.latitude.toFixed(precision)),
      longitude: Number(coords.longitude.toFixed(precision)),
    };
  }, [coords, precision]);
};