'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Users, UserPlus, Mail } from 'lucide-react'
import { partnerApiService } from '@/lib/partnerApiService'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'
import type { PartnerUser } from '@/types'

// ─── Modal inviter un membre ───────────────────────────────────────────────────
function InviteModal({ partnerId, onClose, onInvited }: { partnerId: string; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email requis'); return }
    setLoading(true)
    setError('')
    const result = await partnerApiService.inviteTeamMember(partnerId, { email: email.trim() })
    setLoading(false)
    if (result.success) { setSuccess(true); setTimeout(() => { onInvited() }, 1500) }
    else { setError((result as { message?: string }).message ?? "Erreur lors de l'invitation.") }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 20 }}>Inviter un membre</h2>
        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Mail size={36} color={themeColors.greenPrimary} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: themeColors.greenPrimary, fontWeight: 600 }}>Invitation envoyée !</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>Adresse email</label>
              <input
                type="email"
                placeholder="contact@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.purpleLight, border: `1px solid ${themeColors.purplePrimary}` }}>
              <p style={{ fontSize: 12, color: themeColors.purplePrimary }}>
                {"La personne invitée aura accès à l'ensemble du portail partenaire. C'est vous qui choisissez qui accède à votre compte."}
              </p>
            </div>
            {error && <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Envoi…' : "Envoyer l'invitation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function PartnerTeamPage() {
  const { partnerId } = useParams<{ partnerId: string }>()
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['partner-portal-team', partnerId],
    queryFn: () => partnerApiService.getTeam(partnerId),
  })

  const members = (data?.data ?? []) as PartnerUser[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>Mon équipe</h1>
          <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 4 }}>
            {members.length} membre{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <UserPlus size={16} /> Inviter un membre
        </button>
      </div>

      {/* Liste membres */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2].map(i => <SkeletonLoader key={i} width="100%" height={64} borderRadius={8} />)}
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: themeColors.textSecondary }}>
            <Users size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>{"Aucun membre dans l'équipe"}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                {['Membre', 'Rôle', 'Ajouté le'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: themeColors.textSecondary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const name = m.user?.first_name && m.user?.last_name
                  ? `${m.user.first_name} ${m.user.last_name}`
                  : m.user?.email ?? '—'
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: themeColors.textPrimary }}>{name}</div>
                      {m.user?.email && <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>{m.user.email}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        backgroundColor: themeColors.purpleLight,
                        color: themeColors.purplePrimary,
                      }}>
                        Propriétaire
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: themeColors.textSecondary }}>
                      {new Date(m.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <InviteModal
          partnerId={partnerId}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false)
            queryClient.invalidateQueries({ queryKey: ['partner-portal-team', partnerId] })
          }}
        />
      )}
    </div>
  )
}
