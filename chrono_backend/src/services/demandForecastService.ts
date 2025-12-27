/**
 * Service de prévision de demande
 * Analyse les données historiques pour prédire les pics de demande
 */

import pool from '../config/db.js';
import logger from '../utils/logger.js';

interface DemandForecast {
  zone: string;
  hour: number;
  dayOfWeek: number; // 0 = dimanche, 6 = samedi
  predictedDemand: number;
  confidence: number; // 0-1
}

interface HistoricalData {
  zone: string;
  hour: number;
  dayOfWeek: number;
  orderCount: number;
  date: Date;
}

/**
 * Analyse les données historiques pour une zone
 */
export async function analyzeHistoricalData(
  zone: string,
  daysBack: number = 30
): Promise<HistoricalData[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const result = await pool.query(
      `SELECT 
        EXTRACT(HOUR FROM created_at)::int as hour,
        EXTRACT(DOW FROM created_at)::int as day_of_week,
        COUNT(*)::int as order_count,
        created_at
      FROM orders
      WHERE 
        pickup_address LIKE $1
        AND created_at >= $2
        AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at), created_at
      ORDER BY created_at DESC`,
      [`%${zone}%`, cutoffDate]
    );

    return result.rows.map(row => ({
      zone,
      hour: row.hour,
      dayOfWeek: row.day_of_week,
      orderCount: row.order_count,
      date: new Date(row.created_at),
    }));
  } catch (error: any) {
    logger.error('Error analyzing historical data:', error);
    return [];
  }
}

/**
 * Prédit la demande pour une zone et une heure donnée
 */
export async function predictDemand(
  zone: string,
  hour: number,
  dayOfWeek: number
): Promise<DemandForecast> {
  const historicalData = await analyzeHistoricalData(zone, 30);

  // Filtrer les données pour la même heure et jour de la semaine
  const relevantData = historicalData.filter(
    d => d.hour === hour && d.dayOfWeek === dayOfWeek
  );

  if (relevantData.length === 0) {
    // Pas de données historiques, retourner une prédiction basique
    return {
      zone,
      hour,
      dayOfWeek,
      predictedDemand: 0,
      confidence: 0,
    };
  }

  // Calculer la moyenne des commandes
  const totalOrders = relevantData.reduce((sum, d) => sum + d.orderCount, 0);
  const averageDemand = totalOrders / relevantData.length;

  // Calculer la confiance basée sur le nombre de données
  const confidence = Math.min(1, relevantData.length / 10); // Max confiance avec 10+ données

  return {
    zone,
    hour,
    dayOfWeek,
    predictedDemand: Math.round(averageDemand),
    confidence,
  };
}

/**
 * Prédit les pics de demande pour une zone
 */
export async function predictPeakHours(zone: string): Promise<Array<{ hour: number; predictedDemand: number }>> {
  const forecasts: Array<{ hour: number; predictedDemand: number }> = [];

  for (let hour = 0; hour < 24; hour++) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const forecast = await predictDemand(zone, hour, dayOfWeek);
    
    forecasts.push({
      hour,
      predictedDemand: forecast.predictedDemand,
    });
  }

  // Trier par demande décroissante
  return forecasts.sort((a, b) => b.predictedDemand - a.predictedDemand);
}

/**
 * Recommande des zones aux livreurs selon la demande prévue
 */
export async function recommendZonesForDrivers(): Promise<Array<{ zone: string; predictedDemand: number; recommendation: string }>> {
  // Zones principales (à adapter selon votre géographie)
  const zones = ['Cocody', 'Marcory', 'Yopougon', 'Abobo', 'Plateau', 'Adjamé'];
  
  const recommendations = await Promise.all(
    zones.map(async zone => {
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay();
      
      const forecast = await predictDemand(zone, hour, dayOfWeek);
      
      let recommendation = 'Demande normale';
      if (forecast.predictedDemand > 10) {
        recommendation = 'Forte demande prévue - Recommandé';
      } else if (forecast.predictedDemand > 5) {
        recommendation = 'Demande modérée';
      } else if (forecast.predictedDemand < 2) {
        recommendation = 'Demande faible';
      }

      return {
        zone,
        predictedDemand: forecast.predictedDemand,
        recommendation,
      };
    })
  );

  return recommendations.sort((a, b) => b.predictedDemand - a.predictedDemand);
}

