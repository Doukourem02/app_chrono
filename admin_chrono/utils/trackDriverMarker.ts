/**
 * Marqueur « livreur » partagé : suivi public (/track) et admin Tracking Orders.
 */

export function trackDriverIconUrl(): string {
  const u = process.env.NEXT_PUBLIC_TRACK_DRIVER_ICON_URL
  if (u && String(u).trim() !== '') return String(u).trim()
  return '/assets/track-driver-marker.svg'
}

export function buildDriverMarkerShell(iconUrl: string): {
  element: HTMLDivElement
  setRotation: (deg: number) => void
} {
  const outer = document.createElement('div')
  outer.style.width = '52px'
  outer.style.height = '52px'
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  outer.style.pointerEvents = 'auto'
  outer.title = 'Position du livreur'

  const inner = document.createElement('div')
  inner.style.width = '48px'
  inner.style.height = '48px'
  inner.style.display = 'flex'
  inner.style.alignItems = 'center'
  inner.style.justifyContent = 'center'
  inner.style.transformOrigin = '50% 50%'
  inner.style.transition = 'transform 0.4s ease-out'
  inner.style.transform = 'rotate(0deg)'

  const img = document.createElement('img')
  img.src = iconUrl
  img.alt = ''
  img.width = 44
  img.height = 44
  img.style.display = 'block'
  img.style.objectFit = 'contain'
  img.draggable = false

  inner.appendChild(img)
  outer.appendChild(inner)

  return {
    element: outer,
    setRotation(deg: number) {
      inner.style.transform = `rotate(${deg}deg)`
    },
  }
}
