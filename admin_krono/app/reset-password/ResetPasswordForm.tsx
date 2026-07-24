'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import config from '@/lib/config'

export default function ResetPasswordForm() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionValid, setSessionValid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Le lien reçu par email contient un token de récupération dans l'URL ;
    // supabase-js le détecte automatiquement (detectSessionInUrl) et ouvre
    // une session temporaire. On vérifie juste qu'elle existe bien.
    let active = true

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSessionValid(!!data.session)
      setCheckingSession(false)
    }

    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionValid(true)
        setCheckingSession(false)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError("Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré — redemandez-en un.")
        return
      }

      await supabase.auth.signOut()
      router.push('/login?reset=success')
    } catch {
      setError('Une erreur est survenue, réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: '16px',
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: '448px',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    padding: '32px',
  }

  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '24px',
  }

  const logoSize = 78

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6B7280',
    marginTop: '8px',
  }

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#FEF2F2',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#FECACA',
    color: '#991B1B',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '8px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingTop: '10px',
    paddingBottom: '10px',
    paddingLeft: '16px',
    paddingRight: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#D1D5DB',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s',
  }

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    paddingTop: '10px',
    paddingBottom: '10px',
    paddingLeft: '16px',
    paddingRight: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.5 : 1,
    transition: 'background-color 0.2s',
  }

  const linkStyle: React.CSSProperties = {
    color: '#8B5CF6',
    fontWeight: 500,
    textDecoration: 'none',
  }

  const logo = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', width: logoSize, height: logoSize, position: 'relative' }}>
      <Image
        src={config.app.logoUrl}
        alt={config.app.name}
        width={logoSize}
        height={logoSize}
        style={{ width: logoSize, height: logoSize, maxWidth: '100%', objectFit: 'contain' }}
        priority
      />
    </div>
  )

  if (checkingSession) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>Vérification du lien…</p>
      </div>
    )
  }

  if (!sessionValid) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            {logo}
            <h1 style={titleStyle}>Lien invalide ou expiré</h1>
            <p style={subtitleStyle}>
              Ce lien de réinitialisation n&apos;est plus valide. Redemandez-en un nouveau.
            </p>
          </div>
          <a href="/forgot-password" style={{ ...linkStyle, display: 'block', textAlign: 'center' }}>
            Demander un nouveau lien
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          {logo}
          <h1 style={titleStyle}>Nouveau mot de passe</h1>
          <p style={subtitleStyle}>Choisissez un nouveau mot de passe pour votre compte.</p>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          {error && (
            <div style={errorStyle} role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" style={labelStyle}>
              Nouveau mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              placeholder="••••••••"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#8B5CF6'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#D1D5DB'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" style={labelStyle}>
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#8B5CF6'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#D1D5DB'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#7C3AED'
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#8B5CF6'
            }}
          >
            {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
