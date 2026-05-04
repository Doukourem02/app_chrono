'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, Package, CreditCard, TrendingUp, AlertCircle, Mail, Zap, ShieldOff, XCircle, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { supabase } from '@/lib/supabase'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'
import type { PartnerSubscription } from '@/types'

const PLAN_DEFAULTS: Record<string, { price: number; quota: number | null; label: string }> = {
  starter:  { price: 8_000,  quota: 35,  label: 'Starter — 8 000 FCFA / mois' },
  pro:      { price: 16_000, quota: 70,  label: 'Pro — 16 000 FCFA / mois' },
  business: { price: 29_000, quota: 110, label: 'Business — 29 000 FCFA / mois' },
}

// ─── Modal inviter au portail ─────────────────────────────────────────────────
function InvitePartnerModal({ partnerId, partnerEmail, onClose }: { partnerId: string; partnerEmail?: string; onClose: () => void }) {
  const [email, setEmail] = useState(partnerEmail ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await adminApiService.invitePartnerUser(partnerId, { email: email.trim() })
    setLoading(false)
    if (result.success) { setDone(true) }
    else { setError(result.message ?? "Erreur lors de l'envoi de l'invitation.") }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Mail size={18} color={themeColors.purplePrimary} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary }}>Inviter au portail</h2>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={40} color={themeColors.greenPrimary} style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: themeColors.textPrimary }}>Invitation envoyée !</p>
            <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 6 }}>
              {email} recevra un email pour définir son mot de passe et accéder au portail.
            </p>
            <button onClick={onClose} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="contact@entreprise.com"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, fontSize: 14, color: themeColors.textPrimary, backgroundColor: themeColors.cardBg, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.purpleLight, border: `1px solid ${themeColors.purplePrimary}` }}>
              <p style={{ fontSize: 12, color: themeColors.purplePrimary }}>
                {"L'invité recevra un email avec un lien sécurisé pour choisir son mot de passe et accéder au portail partenaire Krono."}
              </p>
            </div>
            {error && <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Envoi…' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Modal créer abonnement ────────────────────────────────────────────────────
function DeletePartnerConfirmModal({
  partnerId,
  partnerName,
  onClose,
  onDeleted,
}: {
  partnerId: string
  partnerName: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setLoading(true)
    setError('')
    const result = await adminApiService.deletePartner(partnerId)
    setLoading(false)
    if (result.success) {
      onDeleted()
    } else {
      setError(result.message ?? 'Impossible de supprimer ce partenaire.')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={22} color={themeColors.redPrimary} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary }}>Supprimer le partenaire</h2>
        </div>
        <p style={{ fontSize: 14, color: themeColors.textSecondary, lineHeight: 1.5 }}>
          Suppression définitive de <strong style={{ color: themeColors.textPrimary }}>{partnerName}</strong>. Factures et abonnements liés seront effacés ; les commandes restent sans lien partenaire.
        </p>
        {error && <p style={{ fontSize: 13, color: themeColors.redPrimary, marginTop: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
            Annuler
          </button>
          <button type="button" onClick={handleDelete} disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.redPrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateSubscriptionModal({ partnerId, onClose, onCreated }: { partnerId: string; onClose: () => void; onCreated: () => void }) {
  const [plan, setPlan] = useState('starter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await adminApiService.createPartnerSubscription(partnerId, { plan })
    setLoading(false)
    if (result.success) { onCreated() }
    else { setError('Erreur lors de la création.') }
  }

  const info = PLAN_DEFAULTS[plan]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 20 }}>
          Créer un abonnement
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Plan</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(PLAN_DEFAULTS).map(([key, val]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `2px solid ${plan === key ? themeColors.purplePrimary : themeColors.cardBorder}`, cursor: 'pointer', backgroundColor: plan === key ? themeColors.purpleLight : 'transparent' }}>
                  <input type="radio" name="plan" value={key} checked={plan === key} onChange={() => setPlan(key)} style={{ accentColor: themeColors.purplePrimary }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: themeColors.textPrimary }}>{val.label}</div>
                    <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                      {val.quota !== null ? `${val.quota} courses incluses` : 'Courses illimitées'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {info && (
            <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: themeColors.purpleLight, border: `1px solid ${themeColors.purplePrimary}` }}>
              <p style={{ fontSize: 13, color: themeColors.purplePrimary, fontWeight: 600 }}>
                {"L'abonnement sera créé en statut "}
                <em>en attente de paiement</em>.
              </p>
              <p style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4 }}>
                {"Tu devras l'activer manuellement après confirmation du paiement."}
              </p>
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Création…' : 'Créer l\'abonnement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Carte abonnement ─────────────────────────────────────────────────────────
function SubscriptionCard({ sub, partnerId, onRefresh }: { sub: PartnerSubscription; partnerId: string; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleActivate = async () => {
    setLoading(true)
    await adminApiService.activatePartnerSubscription(partnerId, sub.id)
    setLoading(false)
    onRefresh()
  }

  const isPending = sub.payment_status === 'pending_payment'
  const isActive = sub.payment_status === 'active' && sub.is_active

  return (
    <div style={{ padding: '16px 20px', borderRadius: 12, border: `1px solid ${isActive ? themeColors.greenPrimary : themeColors.cardBorder}`, backgroundColor: isActive ? themeColors.greenLight : themeColors.background, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {isActive
            ? <CheckCircle size={16} color={themeColors.greenPrimary} />
            : <Clock size={16} color={themeColors.yellowPrimary} />}
          <span style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary }}>
            Plan {PLAN_DEFAULTS[sub.plan]?.label ?? sub.plan}
          </span>
        </div>
        <p style={{ fontSize: 13, color: themeColors.textSecondary }}>
          {sub.included_orders !== null ? `${sub.included_orders} courses incluses` : 'Courses illimitées'} •{' '}
          Excédent : {(sub.excess_commission_rate * 100).toFixed(0)} %
        </p>
        <p style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4 }}>
          Statut : {isPending ? 'En attente de paiement' : isActive ? 'Actif' : sub.payment_status}
        </p>
      </div>
      {isPending && (
        <button
          onClick={handleActivate}
          disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: themeColors.greenPrimary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Activation…' : 'Confirmer paiement & activer'}
        </button>
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showCreateSub, setShowCreateSub] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  const handleStatusChange = async (status: 'active' | 'inactive' | 'suspended') => {
    setStatusLoading(true)
    // Activation depuis pending → passe par activatePartner pour créer l'abonnement + envoyer le lien portail
    if (status === 'active' && partner?.status === 'pending') {
      await adminApiService.activatePartner(id)
    } else {
      await adminApiService.updatePartnerStatus(id, status)
    }
    queryClient.invalidateQueries({ queryKey: ['partner', id] })
    queryClient.invalidateQueries({ queryKey: ['partners'] })
    setStatusLoading(false)
  }

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`admin-partner-${id}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partners', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['partner', id] })
        queryClient.invalidateQueries({ queryKey: ['partners'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, queryClient])

  const { data: partnerData, isLoading } = useQuery({
    queryKey: ['partner', id],
    queryFn: () => adminApiService.getPartner(id),
    enabled: !!id,
  })

  const { data: usageData } = useQuery({
    queryKey: ['partner-usage', id],
    queryFn: () => adminApiService.getPartnerUsage(id),
    enabled: !!id,
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['partner-invoices', id],
    queryFn: () => adminApiService.getPartnerInvoices(id),
    enabled: !!id,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['partner', id] })
    queryClient.invalidateQueries({ queryKey: ['partner-usage', id] })
    queryClient.invalidateQueries({ queryKey: ['partner-invoices', id] })
  }

  const partner = partnerData?.data
  const usage = usageData?.data
  const invoices = invoicesData?.data ?? []

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader width={200} height={28} borderRadius={6} />
        <SkeletonLoader width="100%" height={120} borderRadius={12} />
        <SkeletonLoader width="100%" height={80} borderRadius={12} />
      </div>
    )
  }

  if (!partner) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: themeColors.textSecondary }}>
        <AlertCircle size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
        <p>Partenaire introuvable.</p>
      </div>
    )
  }

  const quota = usage?.quota ?? null
  const count = usage?.deliveries_count ?? 0
  const pct = quota ? Math.min(100, Math.round((count / quota) * 100)) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textSecondary, fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Retour
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>{partner.name}</h1>
          {partner.email && <p style={{ fontSize: 13, color: themeColors.textSecondary }}>{partner.email}</p>}
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Mail size={14} /> {partner.email ? 'Renvoyer le lien portail' : 'Inviter au portail'}
        </button>
      </div>

      {/* Bandeau plan demandé pour les pending */}
      {partner.status === 'pending' && partner.plan && (
        <div style={{ padding: '12px 16px', backgroundColor: '#FEF3C7', borderRadius: 10, border: '1px solid #D97706', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={16} color="#D97706" />
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Forfait demandé : </span>
            <span style={{ fontSize: 13, color: '#92400E' }}>{PLAN_DEFAULTS[partner.plan]?.label ?? partner.plan}</span>
            {partner.email && (
              <span style={{ fontSize: 12, color: '#B45309', display: 'block', marginTop: 2 }}>
                Email portail : {partner.email}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Gestion du statut */}
      {(() => {
        const s = partner.status
        const actions: { label: string; status: 'active' | 'inactive' | 'suspended'; Icon: React.ElementType; bg: string; color: string }[] = []
        if (s === 'pending')   actions.push({ label: 'Activer',     status: 'active',    Icon: Zap,       bg: '#D97706', color: '#fff' })
        if (s === 'active')    actions.push({ label: 'Suspendre',   status: 'suspended', Icon: ShieldOff, bg: themeColors.redLight,  color: themeColors.redPrimary })
        if (s === 'active')    actions.push({ label: 'Désactiver',  status: 'inactive',  Icon: XCircle,   bg: themeColors.grayLight, color: themeColors.grayDark })
        if (s === 'suspended' || s === 'inactive') actions.push({ label: 'Réactiver', status: 'active', Icon: RefreshCw, bg: themeColors.greenLight, color: themeColors.greenPrimary })
        if (actions.length === 0) return null
        return (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 16px', backgroundColor: themeColors.cardBg, borderRadius: 12, border: `1px solid ${themeColors.cardBorder}`, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: themeColors.textSecondary, fontWeight: 600, marginRight: 4 }}>Statut :</span>
            {actions.map(({ label, status, Icon, bg, color }) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={statusLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${bg === '#fff' ? '#D97706' : bg}`, backgroundColor: bg, color, fontSize: 13, fontWeight: 600, cursor: statusLoading ? 'not-allowed' : 'pointer', opacity: statusLoading ? 0.6 : 1 }}
              >
                <Icon size={14} /> {statusLoading ? '…' : label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Plan actuel', value: partner.plan ? (PLAN_DEFAULTS[partner.plan]?.label?.split(' — ')[0] ?? partner.plan) : 'Aucun', Icon: CreditCard, color: themeColors.purplePrimary },
          { label: 'Courses ce mois', value: count, Icon: Package, color: themeColors.bluePrimary },
          { label: 'Quota restant', value: usage?.remaining !== null ? String(usage?.remaining ?? '—') : '∞', Icon: TrendingUp, color: themeColors.greenPrimary },
          { label: 'Commission std.', value: partner.commission_rate != null ? `${(partner.commission_rate * 100).toFixed(0)} %` : 'via forfait', Icon: CreditCard, color: themeColors.yellowPrimary },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: themeColors.textSecondary }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quota bar */}
      {pct !== null && (
        <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: themeColors.textPrimary }}>Utilisation du quota</span>
            <span style={{ fontSize: 13, color: themeColors.textSecondary }}>{count} / {quota} courses</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, backgroundColor: themeColors.grayLight, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: pct >= 90 ? themeColors.redPrimary : pct >= 70 ? themeColors.yellowPrimary : themeColors.greenPrimary, transition: 'width 0.4s' }} />
          </div>
          {usage?.over_quota && (
            <p style={{ fontSize: 12, color: themeColors.redPrimary, marginTop: 6 }}>
              Quota dépassé — taux excédent appliqué
            </p>
          )}
        </div>
      )}

      {/* Abonnement */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: themeColors.textPrimary }}>Abonnement</h2>
          <button
            onClick={() => setShowCreateSub(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${themeColors.purplePrimary}`, backgroundColor: 'transparent', color: themeColors.purplePrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Nouvel abonnement
          </button>
        </div>
        {partner.active_subscription ? (
          <SubscriptionCard sub={partner.active_subscription} partnerId={id} onRefresh={refresh} />
        ) : (
          <p style={{ fontSize: 13, color: themeColors.textSecondary }}>Aucun abonnement actif.</p>
        )}
      </div>

      {/* Factures */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 14 }}>Factures</h2>
        {invoices.length === 0 ? (
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
                  <td style={{ padding: '10px 12px', fontSize: 13, color: themeColors.textPrimary }}>
                    {new Date(inv.period_start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: themeColors.textPrimary }}>
                    {inv.amount.toLocaleString('fr-FR')} FCFA
                  </td>
                  <td style={{ padding: '10px 12px' }}>
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

      {/* Suppression (admin) */}
      <div style={{ backgroundColor: themeColors.redLight, border: `1px solid ${themeColors.redPrimary}`, borderRadius: 12, padding: '16px 20px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: themeColors.redPrimary, marginBottom: 8 }}>Zone sensible</h2>
        <p style={{ fontSize: 13, color: themeColors.textSecondary, marginBottom: 12 }}>
          Supprimer définitivement ce partenaire et ses données de facturation B2B. Les commandes historiques conservent une trace sans lien partenaire.
        </p>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: themeColors.redPrimary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Trash2 size={15} /> Supprimer le partenaire
        </button>
      </div>

      {showCreateSub && (
        <CreateSubscriptionModal
          partnerId={id}
          onClose={() => setShowCreateSub(false)}
          onCreated={() => { setShowCreateSub(false); refresh() }}
        />
      )}

      {showInvite && (
        <InvitePartnerModal
          partnerId={id}
          partnerEmail={partner.email ?? undefined}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showDelete && partner && (
        <DeletePartnerConfirmModal
          partnerId={id}
          partnerName={partner.name}
          onClose={() => setShowDelete(false)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ['partners'] })
            router.push('/partners')
          }}
        />
      )}
    </div>
  )
}
