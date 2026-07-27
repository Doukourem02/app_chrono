'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Plus, Building2, Eye, CheckCircle, XCircle, Zap, Trash2, AlertTriangle, GitMerge, X } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { supabase } from '@/lib/supabase'
import { ScreenTransition, SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'
import type { Partner } from '@/types'
import { useTranslation } from '@/hooks/useTranslation'
import { useLanguageStore } from '@/stores/languageStore'
import { useAuthStore } from '@/stores/authStore'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

const PLAN_COMMISSION: Record<string, number> = {
  starter: 5,
  pro: 3,
  business: 2,
}

const STATUS_STYLE: Record<Partner['status'], { color: string; bg: string; Icon: typeof CheckCircle }> = {
  active:    { color: themeColors.greenPrimary,  bg: themeColors.greenLight,  Icon: CheckCircle },
  pending:   { color: '#D97706',                 bg: '#FEF3C7',               Icon: Zap         },
  inactive:  { color: themeColors.redPrimary,    bg: themeColors.redLight,    Icon: XCircle     },
  suspended: { color: themeColors.redPrimary,    bg: themeColors.redLight,    Icon: XCircle     },
  merged:    { color: themeColors.grayDark,      bg: themeColors.grayLight,   Icon: GitMerge    },
}

// ─── Modal créer partenaire ───────────────────────────────────────────────────
function CreatePartnerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslation()
  const [form, setForm] = useState({ name: '', email: '', phone: '', plan: '', commission_rate: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('partnersPage.createModal.nameRequired')); return }
    setLoading(true)
    setError('')
    const result = await adminApiService.createPartner({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      ...(form.plan ? { plan: form.plan } : {}),
      ...(form.commission_rate ? { commission_rate: parseFloat(form.commission_rate) / 100 } : {}),
      notes: form.notes.trim() || undefined,
    })
    setLoading(false)
    if (result.success) { onCreated() }
    else { setError(t('partnersPage.createModal.createError')) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 20 }}>
          {t('partnersPage.createModal.title')}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'name',    label: t('partnersPage.createModal.labelName'),    type: 'text' as const,   placeholder: 'Acme Express' },
            { key: 'email',   label: t('partnersPage.createModal.labelEmail'),   type: 'email' as const,  placeholder: 'contact@acme.com' },
            { key: 'phone',   label: t('partnersPage.createModal.labelPhone'),   type: 'tel' as const,    placeholder: '+221 77 000 00 00' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>
              {t('partnersPage.createModal.planOptional')}
            </label>
            <select
              value={form.plan}
              onChange={(e) => setForm(f => ({ ...f, plan: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">{t('partnersPage.createModal.planNoneOption')}</option>
              <option value="starter">{t('partnersPage.createModal.planStarterOption')}</option>
              <option value="pro">{t('partnersPage.createModal.planProOption')}</option>
              <option value="business">{t('partnersPage.createModal.planBusinessOption')}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>
              {t('partnersPage.createModal.commissionLabel')}
            </label>
            <input
              type="number" min={0} max={100} step={1}
              value={form.commission_rate}
              onChange={(e) => setForm(f => ({ ...f, commission_rate: e.target.value }))}
              placeholder={t('partnersPage.createModal.commissionPlaceholder')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>{t('partnersPage.createModal.notes')}</label>
            <textarea
              rows={2}
              placeholder={t('partnersPage.createModal.notesPlaceholder')}
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? t('partnersPage.createModal.creating') : t('partnersPage.createModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal fusionner deux fiches sélectionnées ────────────────────────────────
function MergeSelectedPartnersModal({
  partners,
  onClose,
  onMerged,
}: {
  partners: [Partner, Partner]
  onClose: () => void
  onMerged: (message?: string) => void
}) {
  const t = useTranslation()
  const [survivorId, setSurvivorId] = useState(partners[0].id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    const loserId = partners.find((p) => p.id !== survivorId)!.id
    setLoading(true)
    setError('')
    const result = await adminApiService.mergePartners(survivorId, loserId)
    setLoading(false)
    if (result.success) {
      onMerged(result.message)
    } else {
      setError(result.message ?? t('partnersPage.mergeModal.mergeError'))
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <GitMerge size={22} color={themeColors.purplePrimary} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary }}>{t('partnersPage.mergeModal.title')}</h2>
        </div>
        <p style={{ fontSize: 13, color: themeColors.textSecondary, lineHeight: 1.5, marginBottom: 16 }}>
          {t('partnersPage.mergeModal.description')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {partners.map((p) => (
            <label
              key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${survivorId === p.id ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: survivorId === p.id ? themeColors.purpleLight : 'transparent', cursor: 'pointer' }}
            >
              <input type="radio" checked={survivorId === p.id} onChange={() => setSurvivorId(p.id)} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: themeColors.textPrimary }}>{p.name}</p>
                <p style={{ fontSize: 12, color: themeColors.textSecondary }}>{p.email ?? '—'} · {t(`partnersPage.status.${p.status}`)}</p>
              </div>
              {survivorId === p.id && (
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: themeColors.purplePrimary }}>{t('partnersPage.mergeModal.keepThisOne')}</span>
              )}
            </label>
          ))}
        </div>
        {error && <p style={{ fontSize: 13, color: themeColors.redPrimary, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? t('partnersPage.mergeModal.merging') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal suppression partenaire ─────────────────────────────────────────────
function DeletePartnerModal({
  partner,
  onClose,
  onDeleted,
}: {
  partner: Partner
  onClose: () => void
  onDeleted: () => void
}) {
  const t = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setLoading(true)
    setError('')
    const result = await adminApiService.deletePartner(partner.id)
    setLoading(false)
    if (result.success) {
      onDeleted()
      onClose()
    } else {
      setError(result.message ?? t('partnersPage.deleteModal.deleteError'))
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={22} color={themeColors.redPrimary} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary }}>{t('partnersPage.deleteModal.title')}</h2>
        </div>
        <p style={{ fontSize: 14, color: themeColors.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>
          {t('partnersPage.deleteModal.description', { name: partner.name })}
        </p>
        {error && <p style={{ fontSize: 13, color: themeColors.redPrimary, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleDelete} disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.redPrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? t('partnersPage.deleteModal.deleting') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function PartnersPage() {
  const t = useTranslation()
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const language = useLanguageStore((state) => state.language)
  const dateLocale = language === 'en' ? 'en-US' : 'fr-FR'
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'small' | 'large'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showMergeConfirm, setShowMergeConfirm] = useState(false)
  const [mergeNotice, setMergeNotice] = useState('')

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  const handleActivate = async (e: React.MouseEvent, partnerId: string) => {
    e.stopPropagation()
    setActivating(partnerId)
    await adminApiService.activatePartner(partnerId)
    queryClient.invalidateQueries({ queryKey: ['partners'] })
    setActivating(null)
  }

  useEffect(() => {
    const channel = supabase
      .channel('admin-partners-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, () => {
        queryClient.invalidateQueries({ queryKey: ['partners'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const { data, isLoading } = useQuery({
    queryKey: ['partners', planFilter, statusFilter],
    queryFn: () => adminApiService.getPartners({
      plan: planFilter === 'all' ? undefined : planFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    staleTime: 30_000,
  })

  const partners: Partner[] = useMemo(() => (data?.data ?? []) as Partner[], [data])

  const filtered = useMemo(() => {
    let list = partners
    if (statusFilter === 'all') {
      list = list.filter(p => p.status !== 'merged')
    }
    if (segmentFilter === 'small') {
      list = list.filter(p => p.plan === 'starter')
    } else if (segmentFilter === 'large') {
      list = list.filter(p => p.plan === 'pro' || p.plan === 'business')
    }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    )
  }, [partners, search, segmentFilter, statusFilter])

  const selectedPartners = useMemo(
    () => partners.filter((p) => selectedIds.includes(p.id)),
    [partners, selectedIds]
  )

  return (
    <ScreenTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>{t('partnersPage.title')}</h1>
            <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
              {filtered.length === 1
                ? t('partnersPage.partnerCountOne', { count: filtered.length })
                : t('partnersPage.partnerCountMany', { count: filtered.length })}
            </p>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={16} />
              {t('partnersPage.newPartner')}
            </button>
          )}
        </div>

        {mergeNotice && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 10, backgroundColor: themeColors.greenLight, border: `1px solid ${themeColors.greenPrimary}` }}>
            <span style={{ fontSize: 13, color: themeColors.greenPrimary }}>{mergeNotice}</span>
            <button type="button" onClick={() => setMergeNotice('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeColors.greenPrimary, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: themeColors.textSecondary }} />
            <input
              placeholder={t('partnersPage.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('partnersPage.filterStatusAria')}
            style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer', outline: 'none' }}
          >
            {[
              ['all', t('partnersPage.statusAll')],
              ['pending', t('partnersPage.status.pending')],
              ['active', t('partnersPage.status.active')],
              ['inactive', t('partnersPage.status.inactive')],
              ['suspended', t('partnersPage.status.suspended')],
              ['merged', t('partnersPage.status.merged')],
            ].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label={t('partnersPage.filterPlanAria')}
            style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer', outline: 'none' }}
          >
            {[
              ['all', t('partnersPage.planAll')],
              ['none', t('partnersPage.noPlan')],
              ['starter', PLAN_LABELS.starter],
              ['pro', PLAN_LABELS.pro],
              ['business', PLAN_LABELS.business],
            ].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value as 'all' | 'small' | 'large')}
            aria-label={t('partnersPage.filterSegmentAria')}
            style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer', outline: 'none' }}
          >
            {[
              ['all', t('partnersPage.segmentAll')],
              ['small', t('partnersPage.segmentSmall')],
              ['large', t('partnersPage.segmentLarge')],
            ].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Barre de fusion — visible dès que 2 fiches sont sélectionnées */}
        {isSuperAdmin && selectedIds.length === 2 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 10, backgroundColor: themeColors.purpleLight, border: `1px solid ${themeColors.purplePrimary}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: themeColors.purplePrimary }}>{t('partnersPage.mergeBar.selected')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 13, cursor: 'pointer' }}
              >
                <X size={14} /> {t('partnersPage.mergeBar.clearSelection')}
              </button>
              <button
                type="button"
                onClick={() => setShowMergeConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <GitMerge size={14} /> {t('partnersPage.mergeBar.mergeButton')}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 12, border: `1px solid ${themeColors.cardBorder}`, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => <SkeletonLoader key={i} width="100%" height={52} borderRadius={8} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: themeColors.textSecondary }}>
              <Building2 size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>{t('partnersPage.empty')}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                  {isSuperAdmin && <th style={{ width: 36, padding: '12px 8px' }} />}
                  {[t('partnersPage.colPartner'), t('partnersPage.colPlan'), t('partnersPage.colCommission'), t('partnersPage.colApproval'), t('partnersPage.colCreated'), t('partnersPage.colActions')].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((partner) => {
                  const agr = STATUS_STYLE[partner.status]
                  const AgrIcon = agr.Icon
                  const statusLabel = t(`partnersPage.status.${partner.status}`)
                  const isSelected = selectedIds.includes(partner.id)
                  const selectDisabled = partner.status === 'merged' || (!isSelected && selectedIds.length >= 2)
                  return (
                    <tr
                      key={partner.id}
                      onClick={() => router.push(`/partners/${partner.id}`)}
                      style={{ borderBottom: `1px solid ${themeColors.cardBorder}`, cursor: 'pointer', transition: 'background 0.15s', backgroundColor: isSelected ? themeColors.purpleLight : undefined }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = themeColors.grayLight }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? themeColors.purpleLight : 'transparent' }}
                    >
                      {isSuperAdmin && (
                        <td style={{ padding: '14px 8px' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={selectDisabled}
                            onChange={() => toggleSelect(partner.id)}
                            style={{ cursor: selectDisabled ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                          />
                        </td>
                      )}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: themeColors.textPrimary }}>{partner.name}</div>
                        {partner.email && <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>{partner.email}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: themeColors.textPrimary }}>
                        {partner.plan && partner.plan !== 'none' ? (
                          <span style={{ fontWeight: 600 }}>{PLAN_LABELS[partner.plan] ?? partner.plan}</span>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{t('partnersPage.noPlan')}</span>
                        )}
                        {partner.status === 'pending' && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 6px', borderRadius: 8 }}>{t('partnersPage.requestedBadge')}</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: themeColors.textPrimary }}>
                        {partner.plan && partner.plan !== 'none' && PLAN_COMMISSION[partner.plan] !== undefined
                          ? `${PLAN_COMMISSION[partner.plan]} %`
                          : partner.commission_rate != null
                            ? `${(partner.commission_rate * 100).toFixed(0)} %`
                            : <span style={{ color: themeColors.textSecondary }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }} onClick={(e) => e.stopPropagation()}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 10px',
                            borderRadius: 8,
                            backgroundColor: agr.bg,
                            color: agr.color,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <AgrIcon size={14} /> {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: themeColors.textSecondary }}>
                        {new Date(partner.created_at).toLocaleDateString(dateLocale)}
                      </td>
                      <td style={{ padding: '14px 16px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {isSuperAdmin && partner.status === 'pending' && (
                            <button
                              onClick={(e) => handleActivate(e, partner.id)}
                              disabled={activating === partner.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', backgroundColor: '#D97706', color: '#fff', fontSize: 13, fontWeight: 600, cursor: activating === partner.id ? 'not-allowed' : 'pointer', opacity: activating === partner.id ? 0.7 : 1 }}
                            >
                              <Zap size={13} /> {activating === partner.id ? '…' : t('partnersPage.activate')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); router.push(`/partners/${partner.id}`) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 13, cursor: 'pointer' }}
                          >
                            <Eye size={14} /> {t('common.view')}
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              title={t('partnersPage.deleteTitle')}
                              onClick={(e) => { e.stopPropagation(); setPartnerToDelete(partner) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${themeColors.redPrimary}`, backgroundColor: 'transparent', color: themeColors.redPrimary, fontSize: 13, cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <CreatePartnerModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['partners'] })
          }}
        />
      )}

      {partnerToDelete && (
        <DeletePartnerModal
          partner={partnerToDelete}
          onClose={() => setPartnerToDelete(null)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ['partners'] })
          }}
        />
      )}

      {showMergeConfirm && selectedPartners.length === 2 && (
        <MergeSelectedPartnersModal
          partners={[selectedPartners[0], selectedPartners[1]]}
          onClose={() => setShowMergeConfirm(false)}
          onMerged={(message) => {
            setShowMergeConfirm(false)
            setSelectedIds([])
            setMergeNotice(message ? `${t('partnersPage.mergeModal.mergedNotice')} ${message}` : t('partnersPage.mergeModal.mergedNotice'))
            queryClient.invalidateQueries({ queryKey: ['partners'] })
          }}
        />
      )}
    </ScreenTransition>
  )
}
