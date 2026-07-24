'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import config from '@/lib/config'
import { useAuthStore } from '@/stores/authStore'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [configError, setConfigError] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { setUser, checkAdminRole } = useAuthStore()

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://placeholder.supabase.co') {
      setConfigError(true)
    }

    const errorParam = searchParams.get('error')
    if (errorParam === 'access_denied') {
      setError('Accès refusé. Vous devez être administrateur.')
    }

    if (searchParams.get('reset') === 'success') {
      setSuccess('Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After') || 0)
          setError(
            retryAfter > 0
              ? `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`
              : 'Trop de tentatives de connexion. Réessayez plus tard.'
          )
        } else {
          setError(result.error || 'Une erreur est survenue lors de la connexion')
        }
        return
      }

      if (!result.session?.access_token || !result.session?.refresh_token || !result.session?.user) {
        setError('Une erreur est survenue lors de la connexion')
        return
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })

      if (sessionError) {
        setError('Une erreur est survenue lors de la connexion')
        return
      }

      setUser(result.session.user)
      await checkAdminRole()

      const redirect = searchParams.get('redirect') || '/dashboard'
      router.push(redirect)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors de la connexion'
      setError(errorMessage)
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

  const logoContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    width: logoSize,
    height: logoSize,
    position: 'relative',
  }

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

  const successStyle: React.CSSProperties = {
    backgroundColor: '#F0FDF4',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#BBF7D0',
    color: '#166534',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
  }

  const belowCardStyle: React.CSSProperties = {
    marginTop: '24px',
    fontSize: '14px',
    color: '#6B7280',
    textAlign: 'center',
  }

  const forgotLinkStyle: React.CSSProperties = {
    color: '#8B5CF6',
    fontWeight: 500,
    textDecoration: 'none',
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

  const configErrorContainerStyle: React.CSSProperties = {
    ...containerStyle,
  }

  const configErrorCardStyle: React.CSSProperties = {
    ...cardStyle,
  }

  const configErrorIconStyle: React.CSSProperties = {
    width: '64px',
    height: '64px',
    backgroundColor: '#FEE2E2',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  }

  const codeStyle: React.CSSProperties = {
    backgroundColor: '#F3F4F6',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '4px',
    paddingBottom: '4px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
  }

  const codeBlockStyle: React.CSSProperties = {
    backgroundColor: '#F3F4F6',
    padding: '16px',
    borderRadius: '8px',
    textAlign: 'left',
    fontSize: '12px',
    fontFamily: 'monospace',
    marginTop: '16px',
  }

  if (configError) {
    return (
      <div style={configErrorContainerStyle}>
        <div style={configErrorCardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={configErrorIconStyle}>
              <svg style={{ width: '32px', height: '32px', color: '#DC2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 style={titleStyle}>Configuration requise</h1>
            <p style={{ ...subtitleStyle, marginBottom: '16px' }}>
              Supabase n&apos;est pas configuré. Veuillez créer un fichier <code style={codeStyle}>.env.local</code> à la racine du projet avec :
            </p>
            <div style={codeBlockStyle}>
              <div>NEXT_PUBLIC_SUPABASE_URL=your_supabase_url</div>
              <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoContainerStyle}>
            <Image
              src={config.app.logoUrl}
              alt={config.app.name}
              width={logoSize}
              height={logoSize}
              style={{
                width: logoSize,
                height: logoSize,
                maxWidth: '100%',
                objectFit: 'contain',
              }}
              priority
            />
          </div>
          <h1 style={titleStyle}>{config.app.name}</h1>
          <p style={subtitleStyle}>Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={handleLogin} style={formStyle}>
          {success && !error && (
            <div style={successStyle} role="status">
              {success}
            </div>
          )}

          {error && (
            <div style={errorStyle} role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" style={labelStyle}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              placeholder="admin@krono.com"
              style={{
                ...inputStyle,
              }}
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
            <label htmlFor="password" style={labelStyle}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  ...inputStyle,
                  paddingRight: '44px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#8B5CF6'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#D1D5DB'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#6B7280',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#7C3AED'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#8B5CF6'
              }
            }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>

      <div style={belowCardStyle}>
        Mot de passe oublié ?{' '}
        <Link href="/forgot-password" style={forgotLinkStyle}>
          Réinitialiser
        </Link>
      </div>
    </div>
  )
}
