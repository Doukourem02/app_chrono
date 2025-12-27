import { useState, useEffect, useRef } from 'react'

interface Position {
  latitude: number
  longitude: number
}

interface UseAnimatedPositionProps {
  currentPosition: Position | null
  previousPosition: Position | null
  animationDuration?: number // Durée de l'animation en ms (par défaut 5 secondes pour correspondre à la fréquence GPS)
}

/**
 * Hook pour animer la position d'un driver de manière fluide entre deux points GPS
 * Utilise une interpolation linéaire pour créer une animation fluide
 * Pour React Native (driver_chrono)
 */
export function useAnimatedPosition({
  currentPosition,
  previousPosition,
  animationDuration = 5000, // 5 secondes par défaut (fréquence GPS)
}: UseAnimatedPositionProps): Position | null {
  const [animatedPosition, setAnimatedPosition] = useState<Position | null>(currentPosition)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startPositionRef = useRef<Position | null>(null)
  const targetPositionRef = useRef<Position | null>(null)

  useEffect(() => {
    // Si pas de position actuelle, ne rien faire
    if (!currentPosition) {
      setAnimatedPosition(null)
      return
    }

    // Si c'est la première position ou si la position précédente n'existe pas, utiliser directement la position actuelle
    if (!previousPosition || !startPositionRef.current) {
      setAnimatedPosition(currentPosition)
      startPositionRef.current = currentPosition
      targetPositionRef.current = currentPosition
      return
    }

    // Si la position n'a pas changé, ne rien faire
    if (
      startPositionRef.current.latitude === currentPosition.latitude &&
      startPositionRef.current.longitude === currentPosition.longitude
    ) {
      return
    }

    // Nouvelle position détectée, démarrer l'animation
    startPositionRef.current = previousPosition
    targetPositionRef.current = currentPosition
    startTimeRef.current = Date.now()

    const animate = () => {
      if (!startTimeRef.current || !startPositionRef.current || !targetPositionRef.current) {
        return
      }

      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / animationDuration, 1) // 0 à 1

      // Fonction d'easing pour une animation plus naturelle (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)

      // Interpolation linéaire entre la position de départ et la position cible
      const latitude = startPositionRef.current.latitude + (targetPositionRef.current.latitude - startPositionRef.current.latitude) * easeOut
      const longitude = startPositionRef.current.longitude + (targetPositionRef.current.longitude - startPositionRef.current.longitude) * easeOut

      setAnimatedPosition({ latitude, longitude })

      // Continuer l'animation si on n'a pas atteint la cible
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Animation terminée, s'assurer qu'on est exactement à la position cible
        setAnimatedPosition(targetPositionRef.current)
        startPositionRef.current = targetPositionRef.current
      }
    }

    // Démarrer l'animation
    animationFrameRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [currentPosition, previousPosition, animationDuration])

  return animatedPosition
}

