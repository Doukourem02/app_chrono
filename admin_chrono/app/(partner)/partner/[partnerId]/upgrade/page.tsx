'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Crown, CheckCircle, ArrowLeft, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { themeColors } from '@/utils/theme'
import logoImage from '@/assets/chrono.png'

const UPGRADE_PLANS = [
  {
    name: 'Pro',
    price: '16 000 FCFA / mois',
    quota: '70 courses incluses',
    commission: '3 % in-quota • 5 % excédent',
    highlight: false,
  },
  {
    name: 'Business',
    price: '29 000 FCFA / mois',
    quota: '110 courses incluses',
    commission: '2 % in-quota • 3 % excédent',
    highlight: true,
  },
]

const PORTAL_FEATURES = [
  'Tableau de bord équipe',
  'Suivi des commandes en temps réel',
  'Historique & factures',
  'Gestion des membres de l\'équipe',
  'Invitations collaborateurs',
]

export default function UpgradePage() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: themeColors.background, display: 'flex', flexDirection: 'column' }}>
      {/* Header minimal */}
      <header style={{ padding: '16px 32px', borderBottom: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src={logoImage} alt="Krono" width={28} height={28} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary }}>Krono</span>
        </div>
        <button
          onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: themeColors.textSecondary, fontSize: 13, cursor: 'pointer' }}
        >
          <LogOut size={14} />
          Se déconnecter
        </button>
      </header>

      {/* Contenu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 32 }}>
        {/* Message principal */}
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, backgroundColor: themeColors.purpleLight, marginBottom: 20 }}>
            <Crown size={28} color={themeColors.purplePrimary} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 12 }}>
            Le portail partenaire est réservé aux forfaits Pro et Business
          </h1>
          <p style={{ fontSize: 14, color: themeColors.textSecondary, lineHeight: 1.6 }}>
            Votre compte est actuellement sur le forfait <strong>Starter</strong>.
            Passez à <strong>Pro</strong> ou <strong>Business</strong> pour accéder au portail web, gérer votre équipe et suivre vos commandes en temps réel.
          </p>
        </div>

        {/* Fonctionnalités portail */}
        <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '20px 24px', width: '100%', maxWidth: 520 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: themeColors.textSecondary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Inclus avec Pro & Business
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PORTAL_FEATURES.map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={15} color={themeColors.greenPrimary} />
                <span style={{ fontSize: 14, color: themeColors.textPrimary }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cards forfaits */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 640 }}>
          {UPGRADE_PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                flex: '1 1 260px',
                backgroundColor: plan.highlight ? themeColors.purplePrimary : themeColors.cardBg,
                border: `2px solid ${plan.highlight ? themeColors.purplePrimary : themeColors.cardBorder}`,
                borderRadius: 14,
                padding: '24px 20px',
              }}
            >
              <p style={{ fontSize: 18, fontWeight: 700, color: plan.highlight ? '#fff' : themeColors.textPrimary, marginBottom: 6 }}>
                {plan.name}
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: plan.highlight ? '#fff' : themeColors.purplePrimary, marginBottom: 4 }}>
                {plan.price}
              </p>
              <p style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.75)' : themeColors.textSecondary, marginBottom: 4 }}>
                {plan.quota}
              </p>
              <p style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.6)' : themeColors.textTertiary }}>
                {plan.commission}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p style={{ fontSize: 13, color: themeColors.textSecondary }}>
            Pour changer de forfait, contactez votre gestionnaire Krono ou modifiez votre abonnement depuis l&apos;application mobile.
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textSecondary, fontSize: 13, cursor: 'pointer' }}
          >
            <ArrowLeft size={14} />
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  )
}
