'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, Package, CreditCard, TrendingUp, AlertCircle, Mail, Zap, ShieldOff, XCircle, RefreshCw, Trash2, AlertTriangle, Search, User, Phone, Star, Plus } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { supabase } from '@/lib/supabase'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'
import type { Driver, PartnerDriver, PartnerDriverRequest, PartnerInvoice, PartnerPaymentMethod, PartnerSubscription } from '@/types'

const PLAN_DEFAULTS: Record<string, { price: number; quota: number | null; label: string }> = {
  starter:  { price: 8_000,  quota: 35,  label: 'Starter — 8 000 FCFA / mois' },
  pro:      { price: 16_000, quota: 70,  label: 'Pro — 16 000 FCFA / mois' },
  business: { price: 29_000, quota: 110, label: 'Business — 29 000 FCFA / mois' },
}

const PAYMENT_METHOD_LABELS: Record<PartnerPaymentMethod, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  mtn_money: 'MTN Money',
  cash: 'Espèces',
  bank_transfer: 'Virement',
  other: 'Autre',
}

type PartnerPaymentForm = {
  payment_method_type: PartnerPaymentMethod
  payment_provider_account: string
  payment_reference: string
  payment_amount: string
  paid_at: string
  payment_notes: string
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
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
              {email} recevra un email avec un lien sécurisé pour accéder au portail.
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
                {"L'invité recevra un email avec un lien sécurisé pour accéder au portail partenaire Krono."}
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

function PaymentConfirmModal({
  title,
  amount,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  amount: number
  submitLabel: string
  onClose: () => void
  onSubmit: (payload: {
    payment_method_type: PartnerPaymentMethod
    payment_provider_account?: string
    payment_reference?: string
    payment_amount?: number
    paid_at?: string
    payment_notes?: string
  }) => Promise<{ success: boolean; message?: string }>
}) {
  const [form, setForm] = useState<PartnerPaymentForm>({
    payment_method_type: 'wave',
    payment_provider_account: '',
    payment_reference: '',
    payment_amount: String(amount),
    paid_at: todayInputValue(),
    payment_notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const paymentAmount = Number(form.payment_amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
      setError('Montant payé invalide.')
      return
    }

    setLoading(true)
    setError('')
    const result = await onSubmit({
      payment_method_type: form.payment_method_type,
      payment_provider_account: form.payment_provider_account.trim() || undefined,
      payment_reference: form.payment_reference.trim() || undefined,
      payment_amount: paymentAmount,
      paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : undefined,
      payment_notes: form.payment_notes.trim() || undefined,
    })
    setLoading(false)
    if (!result.success) {
      setError(result.message ?? 'Paiement impossible à enregistrer.')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <CreditCard size={18} color={themeColors.purplePrimary} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary }}>{title}</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Moyen</label>
              <select
                value={form.payment_method_type}
                onChange={(e) => setForm((f) => ({ ...f, payment_method_type: e.target.value as PartnerPaymentMethod }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14 }}
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Montant payé</label>
              <input
                type="number"
                min={0}
                value={form.payment_amount}
                onChange={(e) => setForm((f) => ({ ...f, payment_amount: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Numéro / compte</label>
            <input
              value={form.payment_provider_account}
              onChange={(e) => setForm((f) => ({ ...f, payment_provider_account: e.target.value }))}
              placeholder="Ex: +225 07 00 00 00 00"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Référence</label>
              <input
                value={form.payment_reference}
                onChange={(e) => setForm((f) => ({ ...f, payment_reference: e.target.value }))}
                placeholder="ID transaction"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Date</label>
              <input
                type="date"
                value={form.paid_at}
                onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Note admin</label>
            <input
              value={form.payment_notes}
              onChange={(e) => setForm((f) => ({ ...f, payment_notes: e.target.value }))}
              placeholder="Ex: paiement reçu par caisse"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.greenPrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Enregistrement…' : submitLabel}
            </button>
          </div>
        </form>
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
  const [showPayment, setShowPayment] = useState(false)

  const isPending = sub.payment_status === 'pending_payment'
  const isActive = sub.payment_status === 'active' && sub.is_active
  const paymentLabel = sub.payment_method_type ? PAYMENT_METHOD_LABELS[sub.payment_method_type] : null

  return (
    <>
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
          {(paymentLabel || sub.payment_reference || sub.paid_at) && (
            <p style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4 }}>
              Paiement : {[paymentLabel, sub.payment_reference, sub.paid_at ? new Date(sub.paid_at).toLocaleDateString('fr-FR') : null].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>
        {isPending && (
          <button
            onClick={() => setShowPayment(true)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: themeColors.greenPrimary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Enregistrer paiement & activer
          </button>
        )}
      </div>

      {showPayment && (
        <PaymentConfirmModal
          title="Paiement de l'abonnement"
          amount={sub.monthly_price}
          submitLabel="Activer l'abonnement"
          onClose={() => setShowPayment(false)}
          onSubmit={async (payload) => {
            const result = await adminApiService.activatePartnerSubscription(partnerId, sub.id, payload)
            if (result.success) {
              setShowPayment(false)
              onRefresh()
            }
            return { success: result.success, message: result.message }
          }}
        />
      )}
    </>
  )
}

function driverDisplayName(driver: {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}) {
  return [driver.first_name, driver.last_name].filter(Boolean).join(' ').trim() || driver.email || 'Livreur Krono'
}

const REQUEST_TYPE_LABELS: Record<PartnerDriverRequest['request_type'], string> = {
  known_driver: 'Livreur connu',
  previous_krono_driver: 'Livreur rencontré via Krono',
  general_request: 'Demande générale',
}

function PartnerDedicatedDriversSection({ partnerId }: { partnerId: string }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: driversData } = useQuery({
    queryKey: ['partner-dedicated-drivers', partnerId],
    queryFn: () => adminApiService.getPartnerDrivers(partnerId),
    enabled: !!partnerId,
  })

  const { data: requestsData } = useQuery({
    queryKey: ['partner-driver-requests', partnerId],
    queryFn: () => adminApiService.getPartnerDriverRequests(partnerId),
    enabled: !!partnerId,
  })

  const { data: searchData, isFetching: searchLoading } = useQuery({
    queryKey: ['admin-driver-search', search],
    queryFn: () => adminApiService.getDrivers({ search }),
    enabled: search.trim().length >= 2,
  })

  const drivers = driversData?.data ?? []
  const requests = requestsData?.data ?? []
  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const searchResults = (searchData?.data ?? []).slice(0, 8)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['partner-dedicated-drivers', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-driver-requests', partnerId] })
  }

  const runAction = async (fn: () => Promise<{ success: boolean; message?: string }>, failure: string) => {
    setBusy(true)
    setError('')
    const result = await fn()
    setBusy(false)
    if (!result.success) {
      setError(result.message ?? failure)
      return false
    }
    refresh()
    return true
  }

  const handleAdd = async (isDefault = false) => {
    if (!selectedDriverId) {
      setError('Sélectionne un livreur à rattacher.')
      return
    }
    const ok = await runAction(
      () => adminApiService.addPartnerDriver(partnerId, { driver_user_id: selectedDriverId, is_default: isDefault }),
      'Rattachement impossible.',
    )
    if (ok) {
      setSelectedDriverId('')
      setSearch('')
    }
  }

  const handleApprove = async (requestId: string) => {
    if (!selectedDriverId) {
      setError('Sélectionne le livreur Krono à rattacher avant de valider.')
      return
    }
    const ok = await runAction(
      () => adminApiService.reviewPartnerDriverRequest(partnerId, requestId, {
        action: 'approve',
        driver_user_id: selectedDriverId,
        review_note: reviewNote.trim() || undefined,
      }),
      'Validation impossible.',
    )
    if (ok) {
      setSelectedRequestId(null)
      setSelectedDriverId('')
      setSearch('')
      setReviewNote('')
    }
  }

  const handleReject = async (requestId: string) => {
    const ok = await runAction(
      () => adminApiService.reviewPartnerDriverRequest(partnerId, requestId, {
        action: 'reject',
        review_note: reviewNote.trim() || undefined,
      }),
      'Refus impossible.',
    )
    if (ok) {
      setSelectedRequestId(null)
      setReviewNote('')
    }
  }

  return (
    <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: themeColors.textPrimary }}>Livreurs dédiés</h2>
          <p style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4, maxWidth: 760 }}>
            Livreur dédié : Krono propose d’abord la commande au livreur sélectionné pour ce partenaire. Si aucun livreur dédié n’est disponible, l’assignation automatique prend le relais.
          </p>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, backgroundColor: pendingRequests.length ? themeColors.yellowLight : themeColors.greenLight, color: pendingRequests.length ? themeColors.yellowPrimary : themeColors.greenPrimary }}>
          {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {drivers.length === 0 ? (
            <div style={{ border: `1px dashed ${themeColors.cardBorder}`, borderRadius: 8, padding: 16, fontSize: 13, color: themeColors.textSecondary }}>
              Aucun livreur dédié n’est configuré pour ce partenaire.
            </div>
          ) : (
            drivers.map((item: PartnerDriver) => {
              const name = driverDisplayName(item.driver)
              return (
                <div key={item.id} style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 240 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: themeColors.purpleLight, color: themeColors.purplePrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.driver.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.driver.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : <User size={18} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: themeColors.textPrimary }}>{name}</span>
                        {item.is_default && <span style={{ fontSize: 11, fontWeight: 800, color: themeColors.purplePrimary, backgroundColor: themeColors.purpleLight, borderRadius: 999, padding: '2px 8px' }}>Par défaut</span>}
                      </div>
                      <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 3 }}>
                        {item.driver.phone || 'Téléphone non renseigné'} • {item.profile.is_online && item.profile.is_available ? 'Disponible' : 'Indisponible'} • {item.profile.accepts_b2b_orders ? 'B2B actif' : 'B2B désactivé'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!item.is_default && (
                      <button disabled={busy} onClick={() => void runAction(() => adminApiService.setDefaultPartnerDriver(partnerId, item.driver_user_id), 'Action impossible.')} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${themeColors.purplePrimary}`, backgroundColor: 'transparent', color: themeColors.purplePrimary, fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                        <Star size={13} /> Défaut
                      </button>
                    )}
                    <button disabled={busy} onClick={() => void runAction(() => adminApiService.removePartnerDriver(partnerId, item.driver_user_id), 'Retrait impossible.')} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${themeColors.redPrimary}`, backgroundColor: 'transparent', color: themeColors.redPrimary, fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                      Retirer
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: themeColors.textSecondary }}>Rechercher un livreur</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: themeColors.textSecondary }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, téléphone, email…" style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, color: themeColors.textPrimary, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          {search.trim().length >= 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {searchLoading ? <p style={{ fontSize: 12, color: themeColors.textSecondary }}>Recherche…</p> : searchResults.map((driver: Driver) => {
                const selected = selectedDriverId === driver.id
                return (
                  <button key={driver.id} type="button" onClick={() => setSelectedDriverId(driver.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 9, borderRadius: 8, border: `1px solid ${selected ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: selected ? themeColors.purpleLight : 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: themeColors.textPrimary }}>{driverDisplayName(driver)}</span>
                      <span style={{ display: 'block', fontSize: 11, color: themeColors.textSecondary, marginTop: 2 }}>{driver.phone || driver.email || 'Contact non renseigné'} • {driver.accepts_b2b_orders ? 'B2B actif' : 'B2B désactivé'}</span>
                    </span>
                    {driver.phone && <Phone size={13} color={themeColors.textSecondary} />}
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" disabled={busy || !selectedDriverId} onClick={() => void handleAdd(false)} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '9px 10px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 12, fontWeight: 800, cursor: busy || !selectedDriverId ? 'not-allowed' : 'pointer', opacity: busy || !selectedDriverId ? 0.6 : 1 }}>
              <Plus size={14} /> Ajouter
            </button>
            <button type="button" disabled={busy || !selectedDriverId} onClick={() => void handleAdd(true)} style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${themeColors.purplePrimary}`, backgroundColor: 'transparent', color: themeColors.purplePrimary, fontSize: 12, fontWeight: 800, cursor: busy || !selectedDriverId ? 'not-allowed' : 'pointer', opacity: busy || !selectedDriverId ? 0.6 : 1 }}>
              Ajouter défaut
            </button>
          </div>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div style={{ borderTop: `1px solid ${themeColors.cardBorder}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: themeColors.textPrimary }}>Demandes partenaire</h3>
          {pendingRequests.map((request) => (
            <div key={request.id} style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: themeColors.textPrimary }}>{REQUEST_TYPE_LABELS[request.request_type]}</div>
                <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4 }}>
                  {[request.driver_name, request.driver_phone, request.source_order_id ? `Commande ${request.source_order_id.slice(0, 8)}` : null].filter(Boolean).join(' • ') || 'Aucune précision'}
                </div>
                {request.comment && <p style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 6 }}>{request.comment}</p>}
                {selectedRequestId === request.id && (
                  <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Note de revue optionnelle" style={{ marginTop: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, fontSize: 12, boxSizing: 'border-box' }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {selectedRequestId === request.id ? (
                  <>
                    <button disabled={busy} onClick={() => void handleApprove(request.id)} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', backgroundColor: themeColors.greenPrimary, color: '#fff', fontSize: 12, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>Valider</button>
                    <button disabled={busy} onClick={() => void handleReject(request.id)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeColors.redPrimary}`, backgroundColor: 'transparent', color: themeColors.redPrimary, fontSize: 12, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>Refuser</button>
                  </>
                ) : (
                  <button onClick={() => setSelectedRequestId(request.id)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${themeColors.purplePrimary}`, backgroundColor: 'transparent', color: themeColors.purplePrimary, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Traiter</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>}
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
  const [payingInvoice, setPayingInvoice] = useState<PartnerInvoice | null>(null)
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

      <PartnerDedicatedDriversSection partnerId={id} />

      {/* Factures */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 14 }}>Factures</h2>
        {invoices.length === 0 ? (
          <p style={{ fontSize: 13, color: themeColors.textSecondary }}>{"Aucune facture pour l'instant."}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                {['Période', 'Montant', 'Statut', 'Paiement', 'Action'].map(h => (
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
                  <td style={{ padding: '10px 12px', fontSize: 12, color: themeColors.textSecondary }}>
                    {inv.payment_method_type
                      ? [
                          PAYMENT_METHOD_LABELS[inv.payment_method_type],
                          inv.payment_amount != null ? `${inv.payment_amount.toLocaleString('fr-FR')} FCFA` : null,
                          inv.payment_reference,
                          inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-FR') : null,
                        ].filter(Boolean).join(' • ')
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {inv.status !== 'paid' ? (
                      <button
                        type="button"
                        onClick={() => setPayingInvoice(inv)}
                        style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${themeColors.greenPrimary}`, backgroundColor: 'transparent', color: themeColors.greenPrimary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Marquer payée
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: themeColors.textSecondary }}>—</span>
                    )}
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

      {payingInvoice && (
        <PaymentConfirmModal
          title="Paiement de facture"
          amount={payingInvoice.amount}
          submitLabel="Marquer comme payée"
          onClose={() => setPayingInvoice(null)}
          onSubmit={async (payload) => {
            const result = await adminApiService.markPartnerInvoicePaid(id, payingInvoice.id, payload)
            if (result.success) {
              setPayingInvoice(null)
              refresh()
            }
            return { success: result.success, message: result.message }
          }}
        />
      )}
    </div>
  )
}
