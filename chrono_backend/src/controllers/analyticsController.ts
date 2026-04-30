import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { formatDeliveryId } from '../utils/formatDeliveryId.js';

type CommuneDefinition = {
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
};

const ABIDJAN_COMMUNES: CommuneDefinition[] = [
  { name: 'Abobo', lat: 5.416, lng: -4.015, aliases: ['abobo'] },
  { name: 'Adjamé', lat: 5.358, lng: -4.027, aliases: ['adjame', 'adjamé'] },
  { name: 'Attécoubé', lat: 5.358, lng: -4.048, aliases: ['attecoube', 'attécoubé'] },
  { name: 'Cocody', lat: 5.358, lng: -3.989, aliases: ['cocody'] },
  { name: 'Koumassi', lat: 5.292, lng: -3.958, aliases: ['koumassi'] },
  { name: 'Marcory', lat: 5.278, lng: -3.993, aliases: ['marcory'] },
  { name: 'Plateau', lat: 5.319, lng: -4.02, aliases: ['plateau', 'le plateau'] },
  { name: 'Port-Bouët', lat: 5.238, lng: -3.957, aliases: ['port bouet', 'port-bouet', 'port-bouët'] },
  { name: 'Treichville', lat: 5.304, lng: -4.008, aliases: ['treichville'] },
  { name: 'Yopougon', lat: 5.339, lng: -4.084, aliases: ['yopougon'] },
  { name: 'Bingerville', lat: 5.358, lng: -3.888, aliases: ['bingerville'] },
  { name: 'Anyama', lat: 5.488, lng: -4.052, aliases: ['anyama'] },
  { name: 'Songon', lat: 5.318, lng: -4.178, aliases: ['songon'] },
];

const ACTIVE_ORDER_STATUSES = new Set(['accepted', 'enroute', 'picked_up', 'delivering', 'in_progress']);
const PENDING_ORDER_STATUSES = new Set(['pending', 'searching']);
const CANCELLED_ORDER_STATUSES = new Set(['cancelled', 'declined']);

function normalizeCommuneText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseLocationValue(value: unknown): any {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractCoordinates(value: any): { lat: number; lng: number } | null {
  const location = parseLocationValue(value);
  if (!location || typeof location === 'string') return null;

  const lat = location?.coordinates?.latitude ?? location?.coordinates?.lat ?? location?.latitude ?? location?.lat;
  const lng = location?.coordinates?.longitude ?? location?.coordinates?.lng ?? location?.longitude ?? location?.lng;
  const latNumber = Number(lat);
  const lngNumber = Number(lng);

  if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) return null;
  return { lat: latNumber, lng: lngNumber };
}

function findNearestCommune(lat: number, lng: number): string {
  let nearest = 'Autre';
  let minDist = Infinity;

  for (const commune of ABIDJAN_COMMUNES) {
    const distance = Math.pow(lat - commune.lat, 2) + Math.pow(lng - commune.lng, 2);
    if (distance < minDist) {
      minDist = distance;
      nearest = commune.name;
    }
  }

  return nearest;
}

function findCommuneByText(value: unknown): string | null {
  const text = normalizeCommuneText(value);
  if (!text) return null;

  const match = ABIDJAN_COMMUNES.find((commune) =>
    commune.aliases.some((alias) => text.includes(normalizeCommuneText(alias)))
  );

  return match?.name ?? null;
}

function extractAddressText(value: any): string {
  const location = parseLocationValue(value);
  if (!location) return '';
  if (typeof location === 'string') return location;

  return [
    location.address,
    location.formatted_address,
    location.name,
    location.street,
    location.description,
    location.approximate_pickup_zone_label,
    location.approximate_pickup_zone,
    location.details?.operator_course_notes,
  ]
    .filter(Boolean)
    .join(' ');
}

function resolveCommuneFromLocation(value: unknown, options: { preferApproximatePickupZone?: boolean } = {}): string {
  const location = parseLocationValue(value);

  if (options.preferApproximatePickupZone && location && typeof location !== 'string') {
    const approximateLabel = location.approximate_pickup_zone_label || location.details?.approximate_pickup_zone_label;
    const approximateId = location.approximate_pickup_zone || location.details?.approximate_pickup_zone;
    const approximateZone = findCommuneByText(approximateLabel) || findCommuneByText(approximateId);
    if (approximateZone) return approximateZone;
  }

  const coordinates = extractCoordinates(location);
  if (coordinates) {
    return findNearestCommune(coordinates.lat, coordinates.lng);
  }

  const textZone = findCommuneByText(extractAddressText(location));
  return textZone || 'Autre';
}

function normalizeOrderStatus(status: unknown): string {
  return String(status || '').toLowerCase();
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * GET /api/analytics/kpis
 * Récupère les KPIs en temps réel
 */
export const getRealTimeKPIs = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.debug('getRealTimeKPIs appelé');
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Helper pour gérer les erreurs de connexion DB
    const safeQuery = async (query: string, params: any[] = []) => {
      try {
        logger.debug('Exécution requête SQL:', { query: query.substring(0, 100), paramsCount: params.length });
        const result = await pool.query(query, params);
        logger.debug('Requête SQL réussie, rows:', result.rows.length);
        return result;
      } catch (dbError: any) {
        logger.error('Erreur requête SQL:', {
          code: dbError.code,
          message: dbError.message,
          query: query.substring(0, 100)
        });
        if (dbError.code === 'ENOTFOUND' || dbError.message?.includes('getaddrinfo') || dbError.code === 'ECONNREFUSED') {
          logger.warn('Erreur connexion base de données, retour de données vides:', dbError.message);
          return { rows: [] };
        }
        throw dbError;
      }
    };

    // Détecter la colonne de prix (price_cfa ou price)
    const priceColumnsInfo = await safeQuery(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;
    
    if (!priceColumn) {
      logger.warn('Colonne de prix non trouvée dans orders, utilisation de 0 pour les revenus');
    }

    // Commandes en cours
    const activeOrdersResult = await safeQuery(
      `SELECT COUNT(*) as count
       FROM orders
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')`,
      []
    );

    // Commandes complétées aujourd'hui
    const completedTodayResult = await safeQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(${priceColumn || '0'}), 0) as revenue
       FROM orders
       WHERE status = 'completed' AND completed_at >= $1`,
      [todayStart]
    );

    // Temps moyen de livraison
    const avgDeliveryTimeResult = await safeQuery(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_minutes
       FROM orders
       WHERE status = 'completed' AND completed_at >= $1`,
      [todayStart]
    );

    // Taux d'acceptation
    const acceptanceRateResult = await safeQuery(
      `SELECT 
        COUNT(*) FILTER (WHERE status IN ('accepted', 'enroute', 'picked_up', 'completed')) as accepted,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COUNT(*) as total
       FROM orders
       WHERE created_at >= $1`,
      [weekStart]
    );

    // Statistiques de ratings
    let averageRating: number | null = null;
    let totalRatings = 0;
    let ratingDistribution = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    
    try {
      const ratingsTableCheck = await safeQuery(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingsResult = await safeQuery(
          `SELECT 
            CASE 
              WHEN COUNT(*) > 0 THEN AVG(CAST(rating AS NUMERIC))
              ELSE NULL
            END as avg_rating,
            COUNT(*) as total_count
           FROM ratings
           WHERE rating IS NOT NULL`
        );
        
        logger.debug('Résultat requête ratings:', {
          rows: ratingsResult.rows,
          rowCount: ratingsResult.rows.length,
          firstRow: ratingsResult.rows[0]
        });
        
        if (ratingsResult.rows[0]) {
          const avgRatingValue = ratingsResult.rows[0].avg_rating;
          totalRatings = parseInt(ratingsResult.rows[0].total_count || '0');
          
          logger.debug('Valeurs extraites:', {
            avgRatingValue,
            totalRatings,
            typeAvgRating: typeof avgRatingValue,
            avgRatingValueString: String(avgRatingValue)
          });
          
          // Ne définir averageRating que s'il y a des ratings
          if (totalRatings > 0) {
            // Convertir en nombre, gérer les cas où c'est une chaîne ou un Decimal
            const ratingNum = typeof avgRatingValue === 'string' 
              ? parseFloat(avgRatingValue) 
              : typeof avgRatingValue === 'number' 
                ? avgRatingValue 
                : avgRatingValue != null
                  ? parseFloat(String(avgRatingValue))
                  : 0;
            
            if (!isNaN(ratingNum) && ratingNum >= 0) {
              averageRating = ratingNum;
              logger.info(`Note moyenne calculée: ${averageRating} (${totalRatings} évaluations)`);
            } else {
              logger.warn(`Note moyenne invalide: ${avgRatingValue} (type: ${typeof avgRatingValue}), totalRatings: ${totalRatings}`);
            }
          } else {
            logger.debug(`Aucune évaluation trouvée (totalRatings: ${totalRatings})`);
          }
        }
        
        // Récupérer la distribution seulement s'il y a des ratings
        if (totalRatings > 0) {
          const distributionResult = await safeQuery(
            `SELECT 
              rating::text,
              COUNT(*) as count
             FROM ratings
             GROUP BY rating
             ORDER BY rating DESC`
          );
          
          distributionResult.rows.forEach((row: any) => {
            const ratingKey = String(row.rating);
            if (ratingKey in ratingDistribution) {
              ratingDistribution[ratingKey as keyof typeof ratingDistribution] = parseInt(row.count || '0');
            }
          });
        }
      } else {
        logger.debug('Table ratings n\'existe pas encore');
      }
    } catch (ratingError: any) {
      logger.warn('Erreur calcul statistiques ratings:', ratingError);
      // En cas d'erreur, on garde averageRating à null pour afficher N/A
    }

    const kpis = {
      activeOrders: parseInt(activeOrdersResult.rows[0]?.count || '0'),
      completedToday: parseInt(completedTodayResult.rows[0]?.count || '0'),
      revenueToday: parseFloat(completedTodayResult.rows[0]?.revenue || '0'),
      avgDeliveryTime: parseFloat(avgDeliveryTimeResult.rows[0]?.avg_minutes || '0'),
      acceptanceRate: acceptanceRateResult.rows[0]?.total > 0
        ? (parseInt(acceptanceRateResult.rows[0]?.accepted || '0') / parseInt(acceptanceRateResult.rows[0]?.total || '1')) * 100
        : 0,
      // Retourner null si pas de ratings, sinon le nombre
      averageRating: averageRating !== null ? averageRating : null,
      totalRatings,
      ratingDistribution,
      timestamp: new Date().toISOString(),
    };
    
    logger.info('KPIs calculés avec succès:', {
      activeOrders: kpis.activeOrders,
      completedToday: kpis.completedToday,
      averageRating: kpis.averageRating,
      totalRatings: kpis.totalRatings
    });
    
    logger.debug('KPIs calculés:', {
      averageRating: kpis.averageRating,
      totalRatings: kpis.totalRatings,
      hasRatingDistribution: !!kpis.ratingDistribution
    });

    res.json(kpis);
  } catch (error: any) {
    logger.error('Error getting KPIs:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/analytics/performance
 * Graphiques de performance
 */
export const getPerformanceData = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Helper pour gérer les erreurs de connexion DB
    const safeQuery = async (query: string, params: any[] = []) => {
      try {
        return await pool.query(query, params);
      } catch (dbError: any) {
        const errorMessage = dbError?.message || (dbError instanceof Error ? dbError.message : String(dbError));
        const errorCode = dbError?.code || dbError?.errno;
        logger.error('Erreur requête SQL dans getPerformanceData:', {
          code: errorCode,
          message: errorMessage,
          query: query.substring(0, 100)
        });
        // Si c'est une erreur de connexion/timeout, retourner des données vides
        if (dbError.code === 'ENOTFOUND' || 
            errorMessage?.includes('getaddrinfo') || 
            dbError.code === 'ECONNREFUSED' ||
            errorMessage?.includes('timeout') ||
            errorMessage?.includes('Connection terminated')) {
          logger.warn('Erreur connexion base de données, retour de données vides');
          return { rows: [] };
        }
        throw dbError;
      }
    };

    // Détecter la colonne de prix (price_cfa ou price)
    const priceColumnsInfo = await safeQuery(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;
    
    if (!priceColumn) {
      logger.warn('Colonne de prix non trouvée dans orders, utilisation de 0 pour les revenus');
    }

    // Données par jour
    const dailyDataResult = await safeQuery(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as revenue
       FROM orders
       WHERE created_at >= $1
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [startDate]
    );

    // Détecter les colonnes d'adresse disponibles (formats historiques et JSON actuels)
    const locationColumnsInfo = await safeQuery(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders'
       AND column_name = ANY($1)`,
      [['pickup_address', 'pickup', 'dropoff_address', 'dropoff']]
    );
    const locationColumnSet = new Set(locationColumnsInfo.rows.map((row: any) => row.column_name));
    const hasPickupAddress = locationColumnSet.has('pickup_address');
    const hasPickupJson = locationColumnSet.has('pickup');
    const hasDropoffAddress = locationColumnSet.has('dropoff_address');
    const hasDropoffJson = locationColumnSet.has('dropoff');
    const pickupColumnName = hasPickupAddress ? 'pickup_address' : hasPickupJson ? 'pickup' : null;
    const dropoffColumnName = hasDropoffAddress ? 'dropoff_address' : hasDropoffJson ? 'dropoff' : null;

    type ZoneAccumulator = {
      zone: string;
      totalOrders: number;
      completedOrders: number;
      activeOrders: number;
      pendingOrders: number;
      cancelledOrders: number;
      revenue: number;
      totalDeliveryMinutes: number;
      deliveryTimeSamples: number;
      activeDriverIds: Set<string>;
      topDestinationCounts: Map<string, number>;
      topRouteCounts: Map<string, number>;
      peakHourCounts: Map<number, number>;
      topDriverStats: Map<string, { driverId: string; driverName: string; completedOrders: number; revenue: number }>;
      activeOrdersList: Array<{
        id: string;
        status: string;
        createdAt: string | null;
        driverName: string;
        destinationZone: string;
      }>;
    };

    const createZoneAccumulator = (zone: string): ZoneAccumulator => ({
      zone,
      totalOrders: 0,
      completedOrders: 0,
      activeOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      revenue: 0,
      totalDeliveryMinutes: 0,
      deliveryTimeSamples: 0,
      activeDriverIds: new Set<string>(),
      topDestinationCounts: new Map<string, number>(),
      topRouteCounts: new Map<string, number>(),
      peakHourCounts: new Map<number, number>(),
      topDriverStats: new Map<string, { driverId: string; driverName: string; completedOrders: number; revenue: number }>(),
      activeOrdersList: [],
    });

    const incrementMap = <T,>(map: Map<T, number>, key: T, by = 1) => {
      map.set(key, (map.get(key) || 0) + by);
    };

    const mapTopCounts = (map: Map<string, number>, limit = 5) =>
      Array.from(map.entries())
        .map(([zone, count]) => ({ zone, count }))
        .sort((a, b) => b.count - a.count || a.zone.localeCompare(b.zone))
        .slice(0, limit);

    const mapPeakHours = (map: Map<number, number>, limit = 4) =>
      Array.from(map.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => b.count - a.count || a.hour - b.hour)
        .slice(0, limit);

    const globalRouteCounts = new Map<string, { fromZone: string; toZone: string; count: number }>();
    let zoneDataResult: { rows: any[] } = { rows: [] };

    if (pickupColumnName) {
      const ordersForZone = await safeQuery(
        `SELECT
          o.id,
          status,
          o.driver_id,
          o.created_at,
          o.completed_at,
          COALESCE(${priceColumn ? `o.${priceColumn}` : '0'}::numeric, 0) as price,
          ${pickupColumnName ? `o.${pickupColumnName}` : 'NULL'} as pickup_data,
          ${dropoffColumnName ? `o.${dropoffColumnName}` : 'NULL'} as dropoff_data,
          COALESCE(NULLIF(TRIM(CONCAT(d.first_name, ' ', d.last_name)), ''), d.email, o.driver_id::text, 'Non assigné') as driver_name
         FROM orders o
         LEFT JOIN users d ON d.id = o.driver_id
         WHERE o.created_at >= $1`,
        [startDate]
      );

      const communeMap = new Map<string, ZoneAccumulator>();

      for (const row of ordersForZone.rows) {
        const pickupZone = resolveCommuneFromLocation(row.pickup_data, { preferApproximatePickupZone: true });
        const dropoffZone = resolveCommuneFromLocation(row.dropoff_data);
        const status = normalizeOrderStatus(row.status);
        const price = parseFloat(row.price || '0');
        const routeKey = `${pickupZone}→${dropoffZone}`;
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        const completedAt = row.completed_at ? new Date(row.completed_at) : null;

        if (!communeMap.has(pickupZone)) {
          communeMap.set(pickupZone, createZoneAccumulator(pickupZone));
        }

        const zoneStats = communeMap.get(pickupZone)!;
        zoneStats.totalOrders += 1;
        incrementMap(zoneStats.topDestinationCounts, dropoffZone);
        incrementMap(zoneStats.topRouteCounts, routeKey);

        if (createdAt && !Number.isNaN(createdAt.getTime())) {
          incrementMap(zoneStats.peakHourCounts, createdAt.getHours());
        }

        const globalRoute = globalRouteCounts.get(routeKey) || { fromZone: pickupZone, toZone: dropoffZone, count: 0 };
        globalRoute.count += 1;
        globalRouteCounts.set(routeKey, globalRoute);

        if (status === 'completed') {
          zoneStats.completedOrders += 1;
          zoneStats.revenue += price;

          if (createdAt && completedAt && !Number.isNaN(createdAt.getTime()) && !Number.isNaN(completedAt.getTime())) {
            const minutes = (completedAt.getTime() - createdAt.getTime()) / 60000;
            if (Number.isFinite(minutes) && minutes >= 0) {
              zoneStats.totalDeliveryMinutes += minutes;
              zoneStats.deliveryTimeSamples += 1;
            }
          }

          if (row.driver_id) {
            const driverId = String(row.driver_id);
            zoneStats.activeDriverIds.add(driverId);
            const currentDriver = zoneStats.topDriverStats.get(driverId) || {
              driverId,
              driverName: row.driver_name || 'Livreur',
              completedOrders: 0,
              revenue: 0,
            };
            currentDriver.completedOrders += 1;
            currentDriver.revenue += price;
            zoneStats.topDriverStats.set(driverId, currentDriver);
          }
        }

        if (ACTIVE_ORDER_STATUSES.has(status)) {
          zoneStats.activeOrders += 1;
          if (row.driver_id) zoneStats.activeDriverIds.add(String(row.driver_id));
          zoneStats.activeOrdersList.push({
            id: String(row.id || '').slice(0, 8),
            status,
            createdAt: toIsoString(row.created_at),
            driverName: row.driver_name || 'Non assigné',
            destinationZone: dropoffZone,
          });
        } else if (PENDING_ORDER_STATUSES.has(status)) {
          zoneStats.pendingOrders += 1;
        } else if (CANCELLED_ORDER_STATUSES.has(status)) {
          zoneStats.cancelledOrders += 1;
        }
      }

      let availableDriverCounts = new Map<string, number>();

      try {
        const driverProfilesTableCheck = await safeQuery(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'driver_profiles'
          )`
        );

        if (driverProfilesTableCheck.rows[0]?.exists) {
          const availableDriversResult = await safeQuery(
            `SELECT user_id, current_latitude, current_longitude
             FROM driver_profiles
             WHERE is_online = true
               AND is_available = true
               AND current_latitude IS NOT NULL
               AND current_longitude IS NOT NULL`
          );

          availableDriverCounts = availableDriversResult.rows.reduce((counts: Map<string, number>, driver: any) => {
            const lat = Number(driver.current_latitude);
            const lng = Number(driver.current_longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return counts;
            const driverZone = findNearestCommune(lat, lng);
            counts.set(driverZone, (counts.get(driverZone) || 0) + 1);
            return counts;
          }, new Map<string, number>());
        }
      } catch (driverError: any) {
        logger.warn('Erreur calcul livreurs disponibles par commune:', driverError?.message || driverError);
      }

      zoneDataResult.rows = Array.from(communeMap.values())
        .map((zoneStats) => {
          const trafficIndex = zoneStats.totalOrders + 2 * zoneStats.activeOrders + 3 * zoneStats.pendingOrders;
          const topRoutes = Array.from(zoneStats.topRouteCounts.entries())
            .map(([routeKey, count]) => {
              const [fromZone, toZone] = routeKey.split('→');
              return { fromZone, toZone, count };
            })
            .sort((a, b) => b.count - a.count || a.toZone.localeCompare(b.toZone))
            .slice(0, 5);

          const topDrivers = Array.from(zoneStats.topDriverStats.values())
            .sort((a, b) => b.completedOrders - a.completedOrders || b.revenue - a.revenue)
            .slice(0, 5);

          return {
            zone: zoneStats.zone,
            completed: zoneStats.completedOrders,
            completedOrders: zoneStats.completedOrders,
            revenue: zoneStats.revenue,
            totalOrders: zoneStats.totalOrders,
            activeOrders: zoneStats.activeOrders,
            pendingOrders: zoneStats.pendingOrders,
            cancelledOrders: zoneStats.cancelledOrders,
            successRate: zoneStats.totalOrders > 0 ? Math.round((zoneStats.completedOrders / zoneStats.totalOrders) * 100) : 0,
            avgDeliveryMinutes:
              zoneStats.deliveryTimeSamples > 0
                ? Math.round(zoneStats.totalDeliveryMinutes / zoneStats.deliveryTimeSamples)
                : 0,
            activeDrivers: zoneStats.activeDriverIds.size,
            availableDrivers: availableDriverCounts.get(zoneStats.zone) || 0,
            trafficIndex,
            topDestinations: mapTopCounts(zoneStats.topDestinationCounts),
            topRoutes,
            peakHours: mapPeakHours(zoneStats.peakHourCounts),
            topDrivers,
            activeOrdersList: zoneStats.activeOrdersList.slice(0, 8),
          };
        })
        .sort((a, b) => b.trafficIndex - a.trafficIndex || b.completedOrders - a.completedOrders);
    }

    // Évolution des ratings dans le temps
    let ratingTrend: Array<{ date: string; average: number; count: number }> = [];
    try {
      const ratingsTableCheck = await safeQuery(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingTrendResult = await safeQuery(
          `SELECT 
            DATE(created_at) as date,
            COALESCE(AVG(rating::numeric), 0) as average,
            COUNT(*) as count
           FROM ratings
           WHERE created_at >= $1
           GROUP BY DATE(created_at)
           ORDER BY date ASC`,
          [startDate]
        );
        
        ratingTrend = ratingTrendResult.rows.map((row: any) => ({
          date: row.date,
          average: parseFloat(row.average || '0'),
          count: parseInt(row.count || '0'),
        }));
      }
    } catch (ratingError: any) {
      const errorMessage = ratingError?.message || (ratingError instanceof Error ? ratingError.message : String(ratingError));
      logger.warn('Erreur calcul évolution ratings:', { error: errorMessage, code: ratingError?.code });
    }

    res.json({
      daily: dailyDataResult.rows,
      byZone: zoneDataResult.rows,
      topPickupDropoffRoutes: Array.from(globalRouteCounts.values())
        .sort((a, b) => b.count - a.count || a.fromZone.localeCompare(b.fromZone))
        .slice(0, 10),
      ratingTrend,
    });
  } catch (error: any) {
    const errorMessage = error?.message || (error instanceof Error ? error.message : String(error));
    const errorCode = error?.code || error?.errno;
    logger.error('Error getting performance data:', { 
      error: errorMessage, 
      code: errorCode,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/analytics/export
 * Export des données en CSV/Excel
 */
export const exportAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.debug('[Export] Début export analytics', { format: req.query.format, days: req.query.days });
    const format = req.query.format as 'csv' | 'json' || 'json';
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Helper pour gérer les erreurs de connexion DB
    const safeQuery = async (query: string, params: any[] = []) => {
      try {
        logger.debug('[Export] Exécution requête SQL:', { query: query.substring(0, 100), paramsCount: params.length });
        const result = await pool.query(query, params);
        logger.debug('[Export] Requête SQL réussie, rows:', result.rows.length);
        return result;
      } catch (dbError: any) {
        const errorMessage = dbError?.message || (dbError instanceof Error ? dbError.message : String(dbError));
        const errorCode = dbError?.code || dbError?.errno;
        logger.error('[Export] Erreur requête SQL dans exportAnalytics:', {
          code: errorCode,
          message: errorMessage,
          query: query.substring(0, 100)
        });
        // Si c'est une erreur de connexion/timeout, retourner des données vides
        if (dbError.code === 'ENOTFOUND' || 
            errorMessage?.includes('getaddrinfo') || 
            dbError.code === 'ECONNREFUSED' ||
            errorMessage?.includes('timeout') ||
            errorMessage?.includes('Connection terminated')) {
          logger.warn('[Export] Erreur connexion base de données, retour de données vides');
          return { rows: [] };
        }
        throw dbError;
      }
    };

    // Détecter la colonne de prix (price_cfa ou price)
    const priceColumnsInfo = await safeQuery(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    logger.debug('[Export] Colonne de prix détectée:', priceColumn);

    const result = await safeQuery(
      `SELECT 
        o.id,
        o.status,
        ${priceColumn ? `o.${priceColumn}` : '0'} as price,
        o.created_at,
        o.completed_at,
        u.email as client_email,
        d.user_id as driver_id
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN driver_profiles d ON d.user_id = o.driver_id
       WHERE o.created_at >= $1
       ORDER BY o.created_at DESC`,
      [startDate]
    );

    // Générer le deliveryId officiel (format: CHLV–YYMMDD-XXXX) et order_number (format: CMD-XXXXXXXX)
    const formattedResults = result.rows.map((row: any) => {
      const deliveryId = formatDeliveryId(row.id, row.created_at); // Format officiel CHLV–YYMMDD-XXXX
      return {
        ...row,
        delivery_id: deliveryId, // Format officiel CHLV–YYMMDD-XXXX
        id_livraison: deliveryId, // Alias pour plus de clarté
        order_number: `CMD-${row.id.substring(0, 8).toUpperCase()}`, // Format simplifié pour compatibilité
      };
    });

    logger.debug('[Export] Résultats récupérés:', { count: formattedResults.length, format });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${Date.now()}.csv`);
      
      // En-têtes CSV
      const headers = ['ID', 'ID Livraison', 'Numéro Commande', 'Statut', 'Prix', 'Créé le', 'Complété le', 'Client', 'Livreur'];
      res.write(headers.join(',') + '\n');
      
      // Données CSV - échapper les valeurs pour éviter les problèmes avec les virgules
      formattedResults.forEach((row: any) => {
        const escapeCSV = (value: any) => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          // Si la valeur contient une virgule, des guillemets ou un saut de ligne, l'entourer de guillemets
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const values = [
          escapeCSV(row.id),
          escapeCSV(row.delivery_id), // Format officiel CHLV–YYMMDD-XXXX
          escapeCSV(row.order_number), // Format simplifié CMD-XXXXXXXX
          escapeCSV(row.status),
          escapeCSV(row.price),
          escapeCSV(row.created_at),
          escapeCSV(row.completed_at),
          escapeCSV(row.client_email),
          escapeCSV(row.driver_id),
        ];
        res.write(values.join(',') + '\n');
      });
      
      res.end();
      logger.debug('[Export] Fichier CSV envoyé');
    } else {
      res.json({ data: formattedResults });
      logger.debug('[Export] Fichier JSON envoyé');
    }
  } catch (error: any) {
    const errorMessage = error?.message || (error instanceof Error ? error.message : String(error));
    const errorCode = error?.code || error?.errno;
    logger.error('[Export] Error exporting analytics:', { 
      error: errorMessage, 
      code: errorCode,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: 'Erreur serveur', details: errorMessage });
  }
};
