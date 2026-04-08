'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const ICON_HREF = '/favicon.png?v=krono'

export function FaviconClient() {
  const pathname = usePathname()

  useEffect(() => {
    const apply = () => {
      const selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
      ] as const

      selectors.forEach((sel) => {
        document.querySelectorAll<HTMLLinkElement>(sel).forEach((link) => {
          link.href = ICON_HREF
          link.type = 'image/png'
        })
      })
    }

    apply()
    const t = window.setTimeout(apply, 0)
    return () => window.clearTimeout(t)
  }, [pathname])

  return null
}
