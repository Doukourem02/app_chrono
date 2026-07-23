'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import config from '@/lib/config'

export default function PartnerLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const getPartnerOrigin = useCallback(() => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    if (url.hostname.startsWith('admin.')) {
      url.hostname = url.hostname.replace(/^admin\./, 'partner.')
    }
    return url.origin
  }, [])

  const redirectToPartnerDashboard = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('partner_users')
      .select('partner_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      await supabase.auth.signOut()
      setError("Aucun portail partenaire associé à ce compte. Contactez l'équipe Krono.")
      setChecking(false)
      setLoading(false)
      return
    }

    router.replace(`/partner/${data.partner_id}/dashboard`)
  }, [router])

  // Gère le retour depuis le lien magic link / invitation Supabase (hash dans l'URL)
  useEffect(() => {
    const handleSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await redirectToPartnerDashboard(session.user.id)
        return
      }
      setChecking(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        await redirectToPartnerDashboard(session.user.id)
      }
    })

    handleSession()
    return () => subscription.unsubscribe()
  }, [redirectToPartnerDashboard])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email requis'); return }
    setLoading(true)
    setError('')

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${getPartnerOrigin()}/partner/login`,
        shouldCreateUser: false,
      },
    })

    setLoading(false)
    if (otpError) {
      setError("Impossible d'envoyer le lien de connexion. Vérifiez l'adresse email ou contactez l'équipe Krono.")
      return
    }
    setOtpSent(true)
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <p style={{ color: '#6B7280', fontSize: 14 }}>Vérification en cours…</p>
      </div>
    )
  }

  const logoSize = 72

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: 16 }}>
      <div style={{ maxWidth: 440, width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.10)', padding: 32 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Image src={config.app.logoUrl} alt={config.app.name} width={logoSize} height={logoSize} style={{ objectFit: 'contain' }} priority />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Portail Partenaire</h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>Connectez-vous à votre espace Krono Pro</p>
        </div>

        {otpSent ? (
          <div style={{ textAlign: 'center', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Vérifiez votre boîte mail</p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, maxWidth: 320 }}>
              Un lien de connexion a été envoyé à <strong>{email}</strong>. Cliquez dessus pour accéder à votre portail.
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 320 }}>
              Si vous ne recevez rien, contactez le propriétaire B2B pour vérifier votre invitation.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {error && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="contact@entreprise.com"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', backgroundColor: '#8B5CF6', color: '#fff', padding: '11px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#7C3AED' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#8B5CF6' }}
            >
              {loading ? 'Envoi…' : 'Recevoir un lien de connexion'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
