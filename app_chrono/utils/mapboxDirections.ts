/**
 * Service pour récupérer les directions via Mapbox Directions API
 * Remplace Google Directions API
 */

const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic";

export interface MapboxRouteResult {
  coordinates: { lat: number; lng: number }[];
  duration: number;
  durationTypical?: number;
  distance: number;
}

export interface MapboxDirectionsResponse {
  routes?: {
    geometry?: { coordinates?: [number, number][] };
    legs?: {
      duration?: number;
      duration_typical?: number;
      distance?: number;
    }[];
    duration?: number;
    distance?: number;
  }[];
  code?: string;
  message?: string;
}

export async function fetchMapboxDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  accessToken: string
): Promise<MapboxRouteResult | null> {
  if (!accessToken || accessToken.startsWith("<")) return null;

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${MAPBOX_DIRECTIONS_URL}/${coords}?geometries=geojson&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as MapboxDirectionsResponse;

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const geometryCoords = route.geometry?.coordinates;
    const coordinates: { lat: number; lng: number }[] = geometryCoords
      ? geometryCoords.map(([lng, lat]) => ({ lat, lng }))
      : [];

    return {
      coordinates,
      duration: leg?.duration ?? route.duration ?? 0,
      durationTypical: leg?.duration_typical,
      distance: leg?.distance ?? route.distance ?? 0,
    };
  } catch (error) {
    console.error("[mapboxDirections] Error:", error);
    return null;
  }
}
