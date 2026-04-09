/**
 * URL canonique du site admin (metadataBase, Open Graph).
 * Ne pas utiliser `VERCEL_URL` ici : à chaque déploiement les og:image deviendraient
 * `https://xxx.vercel.app/...` au lieu du domaine public.
 */
export const CANONICAL_SITE_URL = 'https://admin.kro-no-delivery.com'

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return CANONICAL_SITE_URL
}
