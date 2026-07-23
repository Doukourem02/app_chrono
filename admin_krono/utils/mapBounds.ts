/**
 * Bornes géographiques de la Côte d'Ivoire.
 * Restreint la carte aux frontières du pays.
 */
export const COTE_IVOIRE_BOUNDS = {
  /** Sud-Ouest [lng, lat] */
  sw: [-8.6, 4.34] as [number, number],
  /** Nord-Est [lng, lat] */
  ne: [-2.5, 10.7] as [number, number],
} as const

/** Format mapbox-gl maxBounds: [[sw_lng, sw_lat], [ne_lng, ne_lat]] */
export const COTE_IVOIRE_MAX_BOUNDS: [[number, number], [number, number]] = [
  COTE_IVOIRE_BOUNDS.sw,
  COTE_IVOIRE_BOUNDS.ne,
]
