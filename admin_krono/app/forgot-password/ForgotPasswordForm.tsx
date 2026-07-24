'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import config from '@/lib/config'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After') || 0)
        setError(
          retryAfter > 0
            ? `Trop de demandes. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`
            : 'Trop de demandes. Réessayez plus tard.'
        )
        return
      }

      if (!response.ok) {
        setError(result.error || 'Une erreur est survenue')
        return
      }

      // Réponse volontairement générique : ne révèle jamais si l'email existe.
      setSubmitted(true)
    } catch {
      setError('Une erreur est survenue, réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
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

  const successStyle: React.CSSProperties = {
    backgroundColor: '#F0FDF4',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#BBF7D0',
    color: '#166534',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
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

  const belowCardStyle: React.CSSProperties = {
    marginTop: '24px',
    fontSize: '14px',
    color: '#6B7280',
    textAlign: 'center',
  }

  const linkStyle: React.CSSProperties = {
    color: '#8B5CF6',
    fontWeight: 500,
    textDecoration: 'none',
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
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
          <h1 style={titleStyle}>Mot de passe oublié</h1>
          <p style={subtitleStyle}>
            {submitted
              ? 'Vérifiez votre boîte mail.'
              : 'Entrez votre email pour recevoir un lien de réinitialisation.'}
          </p>
        </div>

        {submitted ? (
          <div style={successStyle} role="status">
            Si un compte existe avec cet email, un lien de réinitialisation vient d&apos;être envoyé. Pensez à vérifier vos spams.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={formStyle}>
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
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>
        )}
      </div>

      <div style={belowCardStyle}>
        <Link href="/login" style={linkStyle}>
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
