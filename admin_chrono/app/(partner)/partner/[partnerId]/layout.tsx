'use client'

import React, { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Package, Plus, CreditCard, Users, LogOut, AlertTriangle, Clock, ShieldOff } from 'lucide-react'
import Image from 'next/image'
import logoImage from '@/assets/chrono.png'
import { supabase } from '@/lib/supabase'
import { partnerApiService } from '@/lib/partnerApiService'
import { themeColors } from '@/utils/theme'
import { SkeletonLoader } from '@/components/animations'
import { MapboxProvider } from '@/contexts/MapboxContext'

interface PartnerCtx {
  partnerId: string
  partnerName: string
  status: string
}

const STATUS_BANNER: Record<string, { message: string; bg: string; color: string; Icon: React.ElementType }> = {
  pending: {
    message: 'Votre compte partenaire est en attente de validation par un administrateur Krono. Les fonctionnalités B2B seront disponibles une fois activé.',
    bg: '#FEF3C7', color: '#D97706', Icon: Clock,
  },
  inactive: {
    message: "Votre compte est inactif. Repassez en mode business depuis l'application Krono pour réactiver l'accès.",
    bg: themeColors.grayLight, color: themeColors.grayDark, Icon: AlertTriangle,
  },
  suspended: {
    message: 'Votre compte partenaire est suspendu. Contactez le support Krono pour rétablir l\'accès.',
    bg: themeColors.redLight, color: themeColors.redPrimary, Icon: ShieldOff,
  },
}

const NAV = [
  { href: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
  { href: 'orders',    label: 'Mes commandes',   Icon: Package },
  { href: 'orders/new', label: 'Nouvelle commande', Icon: Plus },
]

const OWNER_NAV = [
  { href: 'billing', label: 'Facturation',  Icon: CreditCard },
  { href: 'team',    label: 'Mon équipe',   Icon: Users },
]

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { partnerId } = useParams<{ partnerId: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const [ctx, setCtx] = useState<PartnerCtx | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/partner/login'); return }

      const access = await partnerApiService.verifyAccess(partnerId)
      if (!access.allowed) { router.replace('/partner/login'); return }

      const PORTAL_PLANS = ['pro', 'business']
      if (!PORTAL_PLANS.includes(access.plan ?? '')) {
        router.push(`/partner/${partnerId}/upgrade`)
        return
      }

      const detail = await partnerApiService.getDetails(partnerId)
      setCtx({
        partnerId,
        partnerName: detail.data?.name ?? 'Partenaire',
        status: detail.data?.status ?? 'active',
      })
      setLoading(false)
    }
    init()
  }, [partnerId, router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)' }}>
        <SkeletonLoader width={200} height={40} borderRadius={8} />
      </div>
    )
  }

  if (!ctx) return null

  const allNav = [...NAV, ...OWNER_NAV]
  const activeHref = allNav
    .map(({ href }) => `/partner/${partnerId}/${href}`)
    .filter((fullHref) => pathname === fullHref || pathname.startsWith(`${fullHref}/`))
    .sort((a, b) => b.length - a.length)[0]

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/partner/login')
  }

  return (
    <MapboxProvider>
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Sidebar portail partenaire */}
      <aside style={{ width: 240, flexShrink: 0, backgroundColor: themeColors.cardBg, borderRight: `1px solid ${themeColors.cardBorder}`, display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        {/* Logo + nom partenaire */}
        <div style={{ padding: '0 20px 20px', borderBottom: `1px solid ${themeColors.cardBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Image src={logoImage} alt="Krono" width={32} height={32} style={{ objectFit: 'contain' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary }}>Krono</span>
          </div>
          <p style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: 500 }}>{ctx.partnerName}</p>
          <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 20, backgroundColor: themeColors.purpleLight, color: themeColors.purplePrimary, fontSize: 11, fontWeight: 600 }}>
            Propriétaire
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {allNav.map(({ href, label, Icon }) => {
            const fullHref = `/partner/${partnerId}/${href}`
            const active = fullHref === activeHref
            return (
              <Link
                key={href}
                href={fullHref}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  backgroundColor: active ? themeColors.purplePrimary : 'transparent',
                  color: active ? '#fff' : themeColors.textSecondary,
                  fontSize: 14, fontWeight: active ? 600 : 400,
                  textDecoration: 'none', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = themeColors.grayLight }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Déconnexion */}
        <div style={{ padding: '12px 12px', borderTop: `1px solid ${themeColors.cardBorder}` }}>
          <button
            onClick={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', backgroundColor: 'transparent', color: themeColors.redPrimary, fontSize: 14, cursor: 'pointer' }}
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {ctx.status !== 'active' && STATUS_BANNER[ctx.status] && (() => {
          const { message, bg, color, Icon } = STATUS_BANNER[ctx.status]!
          return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, backgroundColor: bg, border: `1px solid ${color}`, marginBottom: 20 }}>
              <Icon size={16} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: 13, color, lineHeight: 1.5 }}>{message}</p>
            </div>
          )
        })()}
        {children}
      </main>
    </div>
    </MapboxProvider>
  )
}
