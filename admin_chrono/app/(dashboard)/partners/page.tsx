'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Plus, Building2, Eye, CheckCircle, Clock, XCircle, Zap } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { supabase } from '@/lib/supabase'
import { ScreenTransition, SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'
import type { Partner } from '@/types'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

const STATUS_CONFIG = {
  active:    { label: 'Actif',       color: themeColors.greenPrimary,  bg: themeColors.greenLight,  Icon: CheckCircle },
  pending:   { label: 'En attente',  color: '#D97706',                 bg: '#FEF3C7',               Icon: Zap         },
  inactive:  { label: 'Inactif',    color: themeColors.grayDark,      bg: themeColors.grayLight,   Icon: Clock       },
  suspended: { label: 'Suspendu',   color: themeColors.redPrimary,    bg: themeColors.redLight,    Icon: XCircle     },
}

// ─── Modal créer partenaire ───────────────────────────────────────────────────
function CreatePartnerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', commission_rate: '20', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est requis'); return }
    setLoading(true)
    setError('')
    const result = await adminApiService.createPartner({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      commission_rate: parseFloat(form.commission_rate) / 100,
      notes: form.notes.trim() || undefined,
    })
    setLoading(false)
    if (result.success) { onCreated() }
    else { setError('Erreur lors de la création. Réessaie.') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 20 }}>
          Nouveau partenaire
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'name',    label: 'Nom *',          type: 'text',   placeholder: 'Acme Express' },
            { key: 'email',   label: 'Email',           type: 'email',  placeholder: 'contact@acme.com' },
            { key: 'phone',   label: 'Téléphone',       type: 'tel',    placeholder: '+221 77 000 00 00' },
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
              Commission standard (%) — sans abonnement
            </label>
            <input
              type="number" min={0} max={100} step={1}
              value={form.commission_rate}
              onChange={(e) => setForm(f => ({ ...f, commission_rate: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea
              rows={2}
              placeholder="Infos internes..."
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function PartnersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

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
    queryKey: ['partners', statusFilter, planFilter],
    queryFn: () => adminApiService.getPartners({
      status: statusFilter === 'all' ? undefined : statusFilter,
      plan: planFilter === 'all' ? undefined : planFilter,
    }),
    staleTime: 30_000,
  })

  const partners: Partner[] = useMemo(() => (data?.data ?? []) as Partner[], [data])

  const filtered = useMemo(() => {
    if (!search.trim()) return partners
    const q = search.toLowerCase()
    return partners.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    )
  }, [partners, search])

  return (
    <ScreenTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>Partenaires B2B</h1>
            <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
              {filtered.length} partenaire{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} />
            Nouveau partenaire
          </button>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: themeColors.textSecondary }} />
            <input
              placeholder="Rechercher un partenaire…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {[
            { label: 'Statut', value: statusFilter, set: setStatusFilter, options: [['all','Tous'], ['active','Actifs'], ['inactive','Inactifs'], ['suspended','Suspendus']] },
            { label: 'Plan', value: planFilter, set: setPlanFilter, options: [['all','Tous les plans'], ['starter','Starter'], ['pro','Pro'], ['business','Business']] },
          ].map(({ value, set, options }) => (
            <select
              key={value}
              value={value}
              onChange={(e) => set(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer', outline: 'none' }}
            >
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>

        {/* Table */}
        <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 12, border: `1px solid ${themeColors.cardBorder}`, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => <SkeletonLoader key={i} width="100%" height={52} borderRadius={8} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: themeColors.textSecondary }}>
              <Building2 size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>Aucun partenaire trouvé</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                  {['Partenaire', 'Plan', 'Commission', 'Statut', 'Créé le', ''].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((partner) => {
                  const st = STATUS_CONFIG[partner.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.inactive
                  const StIcon = st.Icon
                  return (
                    <tr
                      key={partner.id}
                      onClick={() => router.push(`/partners/${partner.id}`)}
                      style={{ borderBottom: `1px solid ${themeColors.cardBorder}`, cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = themeColors.grayLight }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: themeColors.textPrimary }}>{partner.name}</div>
                        {partner.email && <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>{partner.email}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: themeColors.textPrimary }}>
                        {partner.plan ? PLAN_LABELS[partner.plan] ?? partner.plan : <span style={{ color: themeColors.textSecondary }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: themeColors.textPrimary }}>
                        {(partner.commission_rate * 100).toFixed(0)} %
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, backgroundColor: st.bg, color: st.color, fontSize: 12, fontWeight: 600 }}>
                          <StIcon size={12} />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: themeColors.textSecondary }}>
                        {new Date(partner.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {partner.status === 'pending' && (
                            <button
                              onClick={(e) => handleActivate(e, partner.id)}
                              disabled={activating === partner.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', backgroundColor: '#D97706', color: '#fff', fontSize: 13, fontWeight: 600, cursor: activating === partner.id ? 'not-allowed' : 'pointer', opacity: activating === partner.id ? 0.7 : 1 }}
                            >
                              <Zap size={13} /> {activating === partner.id ? '…' : 'Activer'}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/partners/${partner.id}`) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 13, cursor: 'pointer' }}
                          >
                            <Eye size={14} /> Voir
                          </button>
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
    </ScreenTransition>
  )
}
