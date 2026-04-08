'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import config from '@/lib/config'

/** Carré 512×512 — même URL que `metadata.icons` (pas le PNG portrait). Incrémente le query après changement d’icône pour casser le cache. */
const iconHref = `${config.app.iconUrl}?v=krono2`

export function FaviconClient() {
  const pathname = usePathname()

  useEffect(() => {
    const fixTitle = () => {
      const t = document.title?.trim() || ''
      if (
        t === '' ||
        t === 'Sans titre' ||
        t.toLowerCase() === 'untitled' ||
        t === 'Krono Admin Console'
      ) {
        document.title = config.app.name
      }
    }

    const fixIcons = () => {
      const selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
      ] as const

      selectors.forEach((sel) => {
        document.querySelectorAll<HTMLLinkElement>(sel).forEach((link) => {
          const href = link.getAttribute('href') || ''
          const rel = link.getAttribute('rel') || ''
          if (href.includes('vercel.com') || href.includes('vercel.app')) {
            link.remove()
            return
          }
          // Next.js peut injecter rel="icon" + /favicon.ico?... (ICO) : souvent choisi avant le PNG
          if (rel === 'icon' && href.includes('favicon.ico')) {
            link.remove()
            return
          }
          link.href = iconHref
          link.type = 'image/png'
        })
      })
    }

    const run = () => {
      fixTitle()
      fixIcons()
    }

    run()
    const t0 = requestAnimationFrame(run)
    const t1 = window.setTimeout(run, 0)
    const t2 = window.setTimeout(run, 50)
    const t3 = window.setTimeout(run, 300)
    const t4 = window.setTimeout(run, 1500)

    const observer = new MutationObserver(run)
    observer.observe(document.head, { childList: true, subtree: true })
    const stopObserver = window.setTimeout(() => observer.disconnect(), 8000)

    return () => {
      cancelAnimationFrame(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      window.clearTimeout(t4)
      observer.disconnect()
      window.clearTimeout(stopObserver)
    }
  }, [pathname])

  return null
}
