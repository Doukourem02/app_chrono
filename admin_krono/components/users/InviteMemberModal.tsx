'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { themeColors } from '@/utils/theme'
import { useTranslation } from '@/hooks/useTranslation'

interface InviteMemberModalProps {
  onClose: () => void
}

type InviteRole = 'admin' | 'super_admin'

export default function InviteMemberModal({ onClose }: InviteMemberModalProps) {
  const t = useTranslation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setError(t('users.invite.errorGeneric'))
        return
      }

      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          setError(t('users.invite.errorRateLimit'))
        } else if (response.status === 409) {
          setError(t('users.invite.errorExists'))
        } else {
          setError(result.error || t('users.invite.errorGeneric'))
        }
        return
      }

      setSuccess(true)
    } catch {
      setError(t('users.invite.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: themeColors.textPrimary,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: themeColors.textPrimary,
    marginBottom: '8px',
    marginTop: '16px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${themeColors.cardBorder}`,
    fontSize: '14px',
    outline: 'none',
    color: themeColors.textPrimary,
    backgroundColor: themeColors.cardBg,
  }

  const roleOptionStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${active ? themeColors.purplePrimary : themeColors.cardBorder}`,
    backgroundColor: active ? `${themeColors.purplePrimary}1A` : 'transparent',
    color: active ? themeColors.purplePrimary : themeColors.textPrimary,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  })

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#991B1B',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginTop: '16px',
  }

  const successStyle: React.CSSProperties = {
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#166534',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
  }

  const submitButtonStyle: React.CSSProperties = {
    width: '100%',
    marginTop: '20px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: themeColors.purplePrimary,
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('users.invite.modalTitle')}</h2>
          <button
            onClick={onClose}
            aria-label={t('users.invite.cancel')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div style={successStyle} role="status">{t('users.invite.success')}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={labelStyle} htmlFor="invite-email">{t('users.invite.emailLabel')}</label>
            <input
              id="invite-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('users.invite.emailPlaceholder')}
              style={inputStyle}
            />

            <label style={labelStyle}>{t('users.invite.roleLabel')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setRole('admin')} style={roleOptionStyle(role === 'admin')}>
                {t('users.invite.roleAdmin')}
              </button>
              <button type="button" onClick={() => setRole('super_admin')} style={roleOptionStyle(role === 'super_admin')}>
                {t('users.invite.roleSuperAdmin')}
              </button>
            </div>

            {error && <div style={errorStyle} role="alert" aria-live="polite">{error}</div>}

            <button type="submit" disabled={loading} style={submitButtonStyle}>
              {loading ? t('users.invite.submitting') : t('users.invite.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
