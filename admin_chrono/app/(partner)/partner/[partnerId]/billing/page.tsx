'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { CreditCard, TrendingUp, CheckCircle, Clock } from 'lucide-react'
import { partnerApiService } from '@/lib/partnerApiService'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'

const PLAN_DETAILS: Record<string, { price: number; quota: number | null; inQuotaRate: number }> = {
  starter:  { price: 8_000,  quota: 35,  inQuotaRate: 0.05 },
  pro:      { price: 16_000, quota: 70,  inQuotaRate: 0.03 },
  business: { price: 29_000, quota: 110, inQuotaRate: 0.02 },
}

export default function PartnerBillingPage() {
  const { partnerId } = useParams<{ partnerId: string }>()

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['partner-portal-detail', partnerId],
    queryFn: () => partnerApiService.getDetails(partnerId),
  })

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['partner-portal-usage', partnerId],
    queryFn: () => partnerApiService.getUsage(partnerId),
  })

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['partner-portal-invoices', partnerId],
    queryFn: () => partnerApiService.getInvoices(partnerId),
  })

  const partner = detailData?.data
  const usage = usageData?.data
  const invoices = invoicesData?.data ?? []
  const sub = partner?.active_subscription
  const planDetails = sub ? PLAN_DETAILS[sub.plan] : null
  const fallbackPlan = !sub && partner?.plan && partner.plan !== 'none' ? partner.plan : null

  const isLoading = detailLoading || usageLoading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>Facturation</h1>
        <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 4 }}>Abonnement actif, usage et historique des factures</p>
      </div>

      {/* Abonnement actif */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 16 }}>Abonnement actuel</h2>
        {isLoading ? <SkeletonLoader width="100%" height={80} borderRadius={8} /> : !sub ? (
          <div style={{ padding: '16px', borderRadius: 10, backgroundColor: themeColors.yellowLight, border: `1px solid ${themeColors.yellowPrimary}` }}>
            <p style={{ fontSize: 14, color: themeColors.yellowPrimary, fontWeight: 600 }}>
              {fallbackPlan
                ? `Plan ${fallbackPlan.charAt(0).toUpperCase() + fallbackPlan.slice(1)} — activation en cours`
                : 'Aucun abonnement actif'}
            </p>
            <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 4 }}>
              {fallbackPlan
                ? "Votre plan a bien été sélectionné. L'activation de l'abonnement sera confirmée par votre gestionnaire Krono."
                : 'Contactez votre gestionnaire Krono pour activer un abonnement.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {[
              { label: 'Plan', value: sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1), Icon: CreditCard, color: themeColors.purplePrimary },
              { label: 'Forfait mensuel', value: `${sub.monthly_price.toLocaleString('fr-FR')} FCFA`, Icon: CreditCard, color: themeColors.bluePrimary },
              { label: 'Courses incluses', value: sub.included_orders !== null ? String(sub.included_orders) : '—', Icon: TrendingUp, color: themeColors.greenPrimary },
              { label: 'Taux in-quota', value: planDetails ? `${(planDetails.inQuotaRate * 100).toFixed(0)} %` : '—', Icon: CheckCircle, color: themeColors.greenPrimary },
              { label: 'Taux excédent', value: `${(sub.excess_commission_rate * 100).toFixed(0)} %`, Icon: Clock, color: themeColors.yellowPrimary },
              { label: 'Statut', value: sub.is_active ? 'Actif' : 'Inactif', Icon: CheckCircle, color: sub.is_active ? themeColors.greenPrimary : themeColors.redPrimary },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} style={{ flex: '1 1 160px', padding: '14px 16px', borderRadius: 10, backgroundColor: themeColors.background, border: `1px solid ${themeColors.cardBorder}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon size={16} color={color} />
                <div>
                  <p style={{ fontSize: 11, color: themeColors.textSecondary }}>{label}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quota du mois */}
      {usage && (
        <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 14 }}>
            Quota — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: themeColors.textSecondary }}>Courses effectuées</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: themeColors.textPrimary }}>
              {usage.deliveries_count} {usage.quota !== null ? `/ ${usage.quota}` : '(illimité)'}
            </span>
          </div>
          {usage.quota !== null && (
            <>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: themeColors.grayLight, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.round((usage.deliveries_count / usage.quota) * 100))}%`, borderRadius: 4, backgroundColor: usage.over_quota ? themeColors.redPrimary : themeColors.greenPrimary }} />
              </div>
              <p style={{ fontSize: 12, color: usage.over_quota ? themeColors.redPrimary : themeColors.textSecondary }}>
                {usage.over_quota
                  ? `${usage.deliveries_count - usage.quota} courses hors quota — taux excédent appliqué`
                  : `${usage.remaining} course${(usage.remaining ?? 0) > 1 ? 's' : ''} restante${(usage.remaining ?? 0) > 1 ? 's' : ''} dans le quota`}
              </p>
            </>
          )}
        </div>
      )}

      {/* Factures */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 14 }}>Historique des factures</h2>
        {invoicesLoading ? (
          <SkeletonLoader width="100%" height={60} borderRadius={8} />
        ) : invoices.length === 0 ? (
          <p style={{ fontSize: 13, color: themeColors.textSecondary }}>{"Aucune facture pour l'instant."}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                {['Période', 'Montant', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: themeColors.textSecondary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                  <td style={{ padding: '12px 12px', fontSize: 13, color: themeColors.textPrimary }}>
                    {new Date(inv.period_start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, color: themeColors.textPrimary }}>
                    {inv.amount.toLocaleString('fr-FR')} FCFA
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      backgroundColor: inv.status === 'paid' ? themeColors.greenLight : inv.status === 'overdue' ? themeColors.redLight : themeColors.yellowLight,
                      color: inv.status === 'paid' ? themeColors.greenPrimary : inv.status === 'overdue' ? themeColors.redPrimary : themeColors.yellowPrimary,
                    }}>
                      {inv.status === 'paid' ? 'Payée' : inv.status === 'overdue' ? 'En retard' : 'En attente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
