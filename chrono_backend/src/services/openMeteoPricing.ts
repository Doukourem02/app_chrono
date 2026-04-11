/**
 * Météo pour tarification — Open-Meteo (sans clé API).
 * https://open-meteo.com/
 */

const FETCH_MS = 2200;

function wmoWeatherMultiplier(code: number, precipitationMm: number): number {
  if (precipitationMm >= 3) return 1.12;
  if (precipitationMm >= 0.8) return 1.08;
  if (code >= 95 || code === 96 || code === 99) return 1.15;
  if (code >= 80 && code <= 86) return 1.1;
  if (code >= 61 && code <= 67) return 1.08;
  if (code >= 51 && code <= 57) return 1.05;
  return 1;
}

export async function getWeatherMultiplierForCoords(
  lat: number,
  lon: number
): Promise<number> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 1;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=precipitation,weather_code`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_MS);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return 1;
    const data = (await res.json()) as {
      current?: { weather_code?: number; precipitation?: number };
    };
    const code = data.current?.weather_code ?? 0;
    const prec = data.current?.precipitation ?? 0;
    return wmoWeatherMultiplier(code, prec);
  } catch {
    return 1;
  }
}
