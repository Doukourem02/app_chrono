/**
 * Calcule le rayon optimal en fonction du niveau de zoom
 * Plus le zoom est élevé, plus le rayon est petit (pour éviter que les marqueurs soient trop éloignés)
 * 
 * @param zoom Niveau de zoom de la carte (généralement entre 1 et 20)
 * @returns Rayon en mètres
 */
export function calculateOptimalRadius(zoom: number): number {
  if (zoom >= 15) {
    return 100 // Zoom élevé : séparation fine mais visible
  } else if (zoom >= 13) {
    return 150 // Zoom moyen-élevé : séparation modérée
  } else if (zoom >= 12) {
    return 180 // Zoom moyen : séparation large
  } else if (zoom >= 10) {
    return 220 // Zoom faible-moyen : séparation très large
  } else {
    return 300 // Zoom très faible : séparation maximale
  }
}

/**
 * Calcule un offset pour séparer visuellement les marqueurs qui ont la même position
 * Utilise un algorithme en cercle pour placer les marqueurs autour de la position centrale
 * 
 * @param position Position GPS { lat, lng }
 * @param index Index du marqueur dans le groupe (0 = premier, 1 = deuxième, etc.)
 * @param totalInGroup Nombre total de marqueurs à la même position
 * @param radiusMeters Rayon du cercle en mètres (par défaut 100m)
 * @returns Position décalée { lat, lng }
 */
export function calculateMarkerOffset(
  position: { lat: number; lng: number },
  index: number,
  totalInGroup: number,
  radiusMeters: number = 100
): { lat: number; lng: number } {
  if (totalInGroup <= 1) {
    return position
  }

  const angleStep = (2 * Math.PI) / totalInGroup
  const angle = index * angleStep

  // Convertir le rayon en degrés (approximation)
  // 1 degré de latitude ≈ 111 km
  // 1 degré de longitude ≈ 111 km * cos(latitude)
  const latOffset = (radiusMeters / 111000) * Math.cos(angle)
  const lngOffset = (radiusMeters / (111000 * Math.cos(position.lat * Math.PI / 180))) * Math.sin(angle)

  return {
    lat: position.lat + latOffset,
    lng: position.lng + lngOffset,
  }
}

/**
 * Groupe les drivers par position et calcule les offsets
 * 
 * @param drivers Liste des drivers avec leurs positions
 * @param zoom Niveau de zoom de la carte (optionnel, pour ajuster le rayon)
 * @returns Map avec userId -> position décalée
 */
export function calculateDriverOffsets<T extends { userId: string; current_latitude?: number; current_longitude?: number }>(
  drivers: T[],
  zoom?: number
): Map<string, { lat: number; lng: number; originalPosition: { lat: number; lng: number } }> {
  const offsetMap = new Map<string, { lat: number; lng: number; originalPosition: { lat: number; lng: number } }>()
  
  // Grouper les drivers par position (avec une tolérance pour les positions très proches)
  const positionGroups = new Map<string, T[]>()
  const TOLERANCE = 0.00001 // ~1 mètre de différence
  
  drivers.forEach((driver) => {
    if (!driver.current_latitude || !driver.current_longitude) return
    
    const position = {
      lat: driver.current_latitude,
      lng: driver.current_longitude,
    }
    
    let foundGroup = false
    for (const [groupKey, groupDrivers] of positionGroups.entries()) {
      const [groupLat, groupLng] = groupKey.split(',').map(Number)
      const latDiff = Math.abs(position.lat - groupLat)
      const lngDiff = Math.abs(position.lng - groupLng)

      if (latDiff < TOLERANCE && lngDiff < TOLERANCE) {
        groupDrivers.push(driver)
        foundGroup = true
        break
      }
    }

    if (!foundGroup) {
      const groupKey = `${position.lat},${position.lng}`
      positionGroups.set(groupKey, [driver])
    }
  })
  
  // Rayon par défaut plus grand pour une meilleure visibilité même sans zoom
  const optimalRadius = zoom ? calculateOptimalRadius(zoom) : 200

  positionGroups.forEach((groupDrivers, groupKey) => {
    const [centerLat, centerLng] = groupKey.split(',').map(Number)
    const centerPosition = { lat: centerLat, lng: centerLng }
    
    groupDrivers.forEach((driver, index) => {
      const offsetPosition = calculateMarkerOffset(centerPosition, index, groupDrivers.length, optimalRadius)
      offsetMap.set(driver.userId, {
        lat: offsetPosition.lat,
        lng: offsetPosition.lng,
        originalPosition: centerPosition,
      })
    })
  })
  
  return offsetMap
}

