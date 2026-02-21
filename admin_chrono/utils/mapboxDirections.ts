/**
 * Service pour récupérer les directions via Mapbox Directions API
 * Remplace Google Directions API
 */

const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic";

export interface MapboxRouteResult {
  coordinates: Array<{ lat: number; lng: number }>;
  duration: number; // secondes
  durationTypical?: number; // secondes (quand trafic disponible)
  distance: number; // mètres
}

export interface MapboxDirectionsResponse {
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][]; // [lng, lat]
    };
    legs?: Array<{
      duration?: number;
      duration_typical?: number;
      distance?: number;
    }>;
    duration?: number;
    distance?: number;
  }>;
  code?: string;
  message?: string;
}

/**
 * Récupère la route entre deux points via Mapbox Directions API (avec trafic)
 */
export async function fetchMapboxDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  accessToken: string
): Promise<MapboxRouteResult | null> {
  if (!accessToken || accessToken.startsWith("<")) {
    return null;
  }

  // Mapbox utilise lng,lat (inversé par rapport à Google)
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${MAPBOX_DIRECTIONS_URL}/${coords}?geometries=geojson&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as MapboxDirectionsResponse;

    if (data.code !== "Ok" || !data.routes?.[0]) {
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];

    // GeoJSON coordinates: [lng, lat] -> convertir en { lat, lng }
    const geometryCoords = route.geometry?.coordinates;
    const coordinates: Array<{ lat: number; lng: number }> = geometryCoords
      ? geometryCoords.map(([lng, lat]) => ({ lat, lng }))
      : [];

    const duration = leg?.duration ?? route.duration ?? 0;
    const durationTypical = leg?.duration_typical;
    const distance = leg?.distance ?? route.distance ?? 0;

    return {
      coordinates,
      duration,
      durationTypical,
      distance,
    };
  } catch (error) {
    console.error("[mapboxDirections] Error:", error);
    return null;
  }
}
