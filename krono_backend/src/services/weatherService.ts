/**
 * Service d'intégration météo (OpenWeatherMap)
 * Ajuste les temps de livraison selon les conditions météorologiques
 */
import logger from '../utils/logger.js';

interface WeatherData {
  temperature: number; // °C
  condition: string; // 'clear', 'rain', 'snow', 'wind', etc.
  windSpeed: number; // m/s
  humidity: number; // %
  description: string; // Description textuelle
  icon: string; // Code icône OpenWeatherMap
}

interface WeatherAdjustment {
  multiplier: number; // Multiplicateur pour ajuster l'ETA (1.0 = pas d'ajustement)
  delayMinutes: number; // Délai additionnel en minutes
  alert?: string; // Message d'alerte si conditions difficiles
  bonusEligible: boolean; // Si le livreur est éligible à un bonus
}

/**
 * Récupère les données météo pour une position GPS
 */
export async function getWeatherData(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey || apiKey.startsWith('<')) {
    logger.warn('[weatherService] OpenWeather API key not configured');
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=fr`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      logger.warn(`[weatherService] API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;

    // Déterminer la condition principale
    const mainCondition = data.weather?.[0]?.main?.toLowerCase() || 'clear';
    const condition = normalizeCondition(mainCondition);

    return {
      temperature: Math.round(data.main?.temp || 0),
      condition,
      windSpeed: data.wind?.speed || 0,
      humidity: data.main?.humidity || 0,
      description: data.weather?.[0]?.description || '',
      icon: data.weather?.[0]?.icon || '',
    };
  } catch (error) {
    logger.error('[weatherService] Error fetching weather:', error);
    return null;
  }
}

/**
 * Normalise la condition météo
 */
function normalizeCondition(condition: string): string {
  const normalized = condition.toLowerCase();
  
  if (normalized.includes('rain') || normalized.includes('drizzle')) {
    return 'rain';
  }
  if (normalized.includes('snow')) {
    return 'snow';
  }
  if (normalized.includes('wind') || normalized.includes('storm')) {
    return 'wind';
  }
  if (normalized.includes('fog') || normalized.includes('mist')) {
    return 'fog';
  }
  
  return 'clear';
}

/**
 * Calcule l'ajustement de l'ETA selon les conditions météo
 */
export function calculateWeatherAdjustment(
  weather: WeatherData | null,
  vehicleType: 'moto' | 'vehicule' | 'cargo' | null = null
): WeatherAdjustment {
  if (!weather) {
    return {
      multiplier: 1.0,
      delayMinutes: 0,
      bonusEligible: false,
    };
  }

  let multiplier = 1.0;
  let delayMinutes = 0;
  let alert: string | undefined;
  let bonusEligible = false;

  // Ajustements selon la condition
  switch (weather.condition) {
    case 'rain':
      multiplier = 1.15; // +15% de temps
      delayMinutes = 2;
      alert = 'Pluie : Conditions difficiles, livraison ralentie';
      bonusEligible = true;
      
      // Moto plus affectée par la pluie
      if (vehicleType === 'moto') {
        multiplier = 1.25; // +25% pour moto
        delayMinutes = 3;
      }
      break;

    case 'snow':
      multiplier = 1.30; // +30% de temps
      delayMinutes = 5;
      alert = 'Neige : Conditions très difficiles, livraison ralentie';
      bonusEligible = true;
      break;

    case 'wind':
      // Vent fort (> 15 m/s = ~54 km/h)
      if (weather.windSpeed > 15) {
        multiplier = 1.20; // +20% de temps
        delayMinutes = 3;
        alert = 'Vent fort : Conditions difficiles, livraison ralentie';
        bonusEligible = true;
        
        // Moto très affectée par le vent fort
        if (vehicleType === 'moto') {
          multiplier = 1.35; // +35% pour moto
          delayMinutes = 5;
        }
      }
      break;

    case 'fog':
      multiplier = 1.10; // +10% de temps
      delayMinutes = 1;
      alert = 'Brouillard : Visibilité réduite, livraison ralentie';
      break;

    default:
      // Conditions claires, pas d'ajustement
      break;
  }

  // Ajustement selon la température extrême
  if (weather.temperature > 35) {
    // Très chaud
    multiplier *= 1.05;
    delayMinutes += 1;
  } else if (weather.temperature < 5) {
    // Très froid
    multiplier *= 1.05;
    delayMinutes += 1;
    if (weather.condition === 'rain' || weather.condition === 'snow') {
      bonusEligible = true;
    }
  }

  return {
    multiplier,
    delayMinutes,
    alert,
    bonusEligible,
  };
}

/**
 * Applique l'ajustement météo à un ETA en minutes
 */
export function applyWeatherAdjustment(
  baseETAMinutes: number,
  adjustment: WeatherAdjustment
): number {
  const adjusted = baseETAMinutes * adjustment.multiplier + adjustment.delayMinutes;
  return Math.ceil(adjusted);
}

/**
 * Vérifie si les conditions météo sont difficiles
 */
export function isDifficultWeather(weather: WeatherData | null): boolean {
  if (!weather) return false;
  
  return (
    weather.condition === 'rain' ||
    weather.condition === 'snow' ||
    (weather.condition === 'wind' && weather.windSpeed > 15) ||
    weather.temperature < 5 ||
    weather.temperature > 35
  );
}

