/**
 * Libellés transparence distance route — doc krono-reference-unique.md §1.
 */

export type RouteMetricsSource = 'mapbox_route' | 'straight_line';

export function distanceMetricCaption(source: RouteMetricsSource): string {
  return source === 'mapbox_route'
    ? 'Itinéraire routier (Mapbox)'
    : 'Estimation ligne droite — mise à jour après calcul de route';
}

export function durationMetricCaption(source: RouteMetricsSource): string {
  return source === 'mapbox_route'
    ? 'Selon trafic (Mapbox)'
    : 'Selon vitesse moyenne';
}

/** Sous-titre court pour badge ETA sur la carte */
export function mapEtaSubtitle(source: RouteMetricsSource): string {
  return source === 'mapbox_route' ? 'Itinéraire' : 'Estimation';
}
