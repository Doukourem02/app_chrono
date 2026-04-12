import { useEffect, useMemo, useRef } from 'react'

export type LngLat = { lat: number; lng: number }

/**
 * Interpolation fluide entre positions GPS ; met à jour via callback (évite un re-render à chaque frame).
 */
export function useInterpolateLngLat(
  target: LngLat | null,
  onUpdate: (pt: LngLat | null) => void,
  durationMs = 2200
): void {
  const stableTarget = useMemo((): LngLat | null => {
    if (target == null) return null
    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return null
    return { lat: target.lat, lng: target.lng }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable identity from lat/lng; parent may pass a new object each render
  }, [target?.lat, target?.lng])

  const targetRef = useRef<LngLat | null>(null)
  const lastShownRef = useRef<LngLat | null>(null)
  const frameRef = useRef<number | null>(null)
  const onUpdateRef = useRef(onUpdate)

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    const notify = (pt: LngLat | null) => {
      onUpdateRef.current(pt)
    }

    if (!stableTarget) {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      targetRef.current = null
      lastShownRef.current = null
      notify(null)
      return
    }

    const prevTarget = targetRef.current
    targetRef.current = stableTarget

    if (!prevTarget) {
      lastShownRef.current = stableTarget
      notify(stableTarget)
      return
    }

    if (prevTarget.lat === stableTarget.lat && prevTarget.lng === stableTarget.lng) {
      return
    }

    const from = lastShownRef.current ?? prevTarget
    const to = stableTarget

    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const ease = 1 - (1 - t) ** 3
      const next = {
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      }
      lastShownRef.current = next
      notify(next)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [stableTarget, durationMs])
}
