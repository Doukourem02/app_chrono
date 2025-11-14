'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [configError, setConfigError] = useState(false)
  const { setUser, checkAdminRole } = useAuthStore()

  useEffect(() => {
    // Vérifier si Supabase est configuré
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://placeholder.supabase.co') {
      setConfigError(true)
    }

    // Vérifier s'il y a un message d'erreur dans l'URL
    const errorParam = searchParams.get('error')
    if (errorParam === 'access_denied') {
      setError('Accès refusé. Vous devez être administrateur.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      if (data.user) {
        setUser(data.user)
        const isAdmin = await checkAdminRole()

        if (!isAdmin) {
          await supabase.auth.signOut()
          setError('Accès refusé. Vous devez être administrateur.')
          setUser(null)
          return
        }

        // Rediriger vers la page demandée ou le dashboard
        const redirect = searchParams.get('redirect') || '/dashboard'
        router.push(redirect)
      }
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
    marginBottom: '32px',
  }

  const logoContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    width: '120px',
    height: '120px',
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
              src="/assets/logo.png"
              alt="Chrono Admin Logo"
              width={120}
              height={120}
              style={{
                objectFit: 'contain',
              }}
              priority
            />
          </div>
          <h1 style={titleStyle}>Chrono Admin</h1>
          <p style={subtitleStyle}>Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={handleLogin} style={formStyle}>
          {error && (
            <div style={errorStyle}>
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
              placeholder="admin@chrono.com"
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
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
    </div>
  )
}
