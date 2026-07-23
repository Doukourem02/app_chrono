'use client'

import React, { useState } from 'react'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()
  // Initialiser directement à true pour éviter l'erreur ESLint
  const [isAnimating] = useState(true)

  const handleGoHome = () => {
    router.push('/dashboard')
  }

  const handleGoBack = () => {
    router.back()
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: '#F9FAFB',
    position: 'relative',
    overflow: 'hidden',
  }

  const animatedCircleStyle: React.CSSProperties = {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #DBEAFE 0%, #E0E7FF 100%)',
    opacity: isAnimating ? 0.3 : 0,
    transform: isAnimating ? 'scale(1)' : 'scale(0.8)',
    transition: 'all 0.6s ease-out',
    top: '10%',
    right: '10%',
    animation: isAnimating ? 'pulse 3s ease-in-out infinite' : 'none',
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: '600px',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    padding: '48px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    zIndex: 1,
    transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
    opacity: isAnimating ? 1 : 0,
    transition: 'all 0.6s ease-out',
  }

  const iconContainerStyle: React.CSSProperties = {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: '#DBEAFE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 32px',
    position: 'relative',
    transform: isAnimating ? 'scale(1) rotate(0deg)' : 'scale(0.8) rotate(-10deg)',
    transition: 'all 0.6s ease-out',
    animation: isAnimating ? 'bounce 2s ease-in-out infinite' : 'none',
  }

  const iconStyle: React.CSSProperties = {
    width: '64px',
    height: '64px',
    color: '#3B82F6',
  }

  const statusCodeStyle: React.CSSProperties = {
    fontSize: '120px',
    fontWeight: 700,
    color: '#DBEAFE',
    textAlign: 'center',
    margin: '0 0 24px 0',
    lineHeight: 1,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1F2937',
    margin: '0 0 16px 0',
    textAlign: 'center',
  }

  const messageStyle: React.CSSProperties = {
    fontSize: '16px',
    color: '#6B7280',
    textAlign: 'center',
    margin: '0 0 32px 0',
    lineHeight: '1.6',
  }

  const buttonsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  }

  const buttonStyle: (primary: boolean) => React.CSSProperties = (primary) => ({
    padding: '14px 28px',
    backgroundColor: primary ? '#8B5CF6' : '#F3F4F6',
    color: primary ? '#FFFFFF' : '#374151',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    boxShadow: primary ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
  })

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-10px) scale(1.05);
          }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={animatedCircleStyle} />
        <div style={cardStyle}>
          <div style={statusCodeStyle}>404</div>
          <div style={iconContainerStyle}>
            <FileQuestion style={iconStyle} />
          </div>
          <h1 style={titleStyle}>Page introuvable</h1>
          <p style={messageStyle}>
            Désolé, la page que vous recherchez n&apos;existe pas ou a été déplacée.
            Vérifiez l&apos;URL ou retournez à la page d&apos;accueil.
          </p>
          <div style={buttonsContainerStyle}>
            <button
              onClick={handleGoBack}
              style={buttonStyle(false)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E5E7EB'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <ArrowLeft size={20} />
              Retour
            </button>
            <button
              onClick={handleGoHome}
              style={buttonStyle(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#7C3AED'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#8B5CF6'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
            >
              <Home size={20} />
              Retour à l&apos;accueil
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

