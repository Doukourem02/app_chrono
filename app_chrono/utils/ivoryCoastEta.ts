export type IvoryCoastVehicleType = 'moto' | 'vehicule' | 'cargo' | null | undefined;

type WeatherLike = {
  multiplier?: number;
  delayMinutes?: number;
} | null | undefined;

const AIR_TO_ABIDJAN_ROAD_FACTOR = 1.55;

function normalizeVehicleType(vehicleType: IvoryCoastVehicleType): 'moto' | 'vehicule' | 'cargo' {
  if (vehicleType === 'moto' || vehicleType === 'cargo' || vehicleType === 'vehicule') return vehicleType;
  return 'vehicule';
}

function urbanSpeedKmh(vehicleType: IvoryCoastVehicleType): number {
  switch (normalizeVehicleType(vehicleType)) {
    case 'moto':
      return 20;
    case 'cargo':
      return 13;
    case 'vehicule':
    default:
      return 16;
  }
}

function mapboxDurationMultiplier(vehicleType: IvoryCoastVehicleType): number {
  switch (normalizeVehicleType(vehicleType)) {
    case 'moto':
      return 1.0;
    case 'cargo':
      return 1.25;
    case 'vehicule':
    default:
      return 1.08;
  }
}

function distanceBucketFloorMinutes(distanceKm: number): number {
  if (distanceKm <= 0.15) return 1;
  if (distanceKm <= 0.5) return 2;
  if (distanceKm <= 1) return 4;
  if (distanceKm <= 2) return 7;
  if (distanceKm <= 4) return 12;
  if (distanceKm <= 6) return 17;
  if (distanceKm <= 10) return 26;
  if (distanceKm <= 15) return 38;
  return 0;
}

function operationalDelayMinutes(distanceKm: number): number {
  if (distanceKm <= 0.5) return 0;
  if (distanceKm <= 2) return 1;
  if (distanceKm <= 5) return 2;
  if (distanceKm <= 10) return 4;
  return 6;
}

function applyWeather(minutes: number, weather: WeatherLike): number {
  if (!weather) return minutes;
  const multiplier = Number.isFinite(weather.multiplier) ? Number(weather.multiplier) : 1;
  const delay = Number.isFinite(weather.delayMinutes) ? Number(weather.delayMinutes) : 0;
  return minutes * Math.max(1, multiplier) + Math.max(0, delay);
}

export function realisticUrbanEtaFloorMinutes(
  roadDistanceMeters: number,
  vehicleType: IvoryCoastVehicleType,
): number {
  if (!Number.isFinite(roadDistanceMeters) || roadDistanceMeters <= 0) return 1;
  const distanceKm = roadDistanceMeters / 1000;
  const speedBased = (distanceKm / urbanSpeedKmh(vehicleType)) * 60 + operationalDelayMinutes(distanceKm);
  return Math.max(distanceBucketFloorMinutes(distanceKm), Math.ceil(speedBased));
}

export function realisticEtaMinutesFromRoute(params: {
  distanceMeters: number;
  durationSeconds?: number | null;
  vehicleType?: IvoryCoastVehicleType;
  weatherAdjustment?: WeatherLike;
}): number {
  const floor = realisticUrbanEtaFloorMinutes(params.distanceMeters, params.vehicleType);
  const rawSeconds = Number(params.durationSeconds);
  const mapboxMinutes =
    Number.isFinite(rawSeconds) && rawSeconds > 0
      ? Math.ceil((rawSeconds * mapboxDurationMultiplier(params.vehicleType)) / 60)
      : 0;
  return Math.max(1, Math.ceil(applyWeather(Math.max(floor, mapboxMinutes), params.weatherAdjustment)));
}

export function realisticEtaMinutesFromAirDistance(params: {
  airDistanceMeters: number;
  vehicleType?: IvoryCoastVehicleType;
  weatherAdjustment?: WeatherLike;
}): number {
  const roadDistanceMeters = Math.max(0, params.airDistanceMeters) * AIR_TO_ABIDJAN_ROAD_FACTOR;
  return realisticEtaMinutesFromRoute({
    distanceMeters: roadDistanceMeters,
    vehicleType: params.vehicleType,
    weatherAdjustment: params.weatherAdjustment,
  });
}
