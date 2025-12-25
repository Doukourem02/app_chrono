'use client'

import React, { useEffect, useState } from 'react'
import { X, AlertCircle, Info, CheckCircle2 } from 'lucide-react'

export interface ErrorModalData {
  title: string
  message: string
  errorCode?: string
  icon?: 'alert' | 'info' | 'success' | 'warning'
  color?: string
  suggestions?: string[]
  explanation?: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
}

interface ErrorModalProps {
  visible: boolean
  error: ErrorModalData | null
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ visible, error }) => {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (visible) {
      // Use requestAnimationFrame to defer state update and avoid cascading renders
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    } else {
      // Use requestAnimationFrame to defer state update and avoid cascading renders
      requestAnimationFrame(() => {
        setIsAnimating(false)
      })
    }
  }, [visible])

  if (!error || !visible) return null

  const errorColor = error.color || '#EF4444'
  const getIcon = () => {
    switch (error.icon) {
      case 'info':
        return <Info size={48} color={errorColor} />
      case 'success':
        return <CheckCircle2 size={48} color={errorColor} />
      case 'warning':
        return <AlertCircle size={48} color={errorColor} />
      default:
        return <AlertCircle size={48} color={errorColor} />
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    opacity: isAnimating ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
    padding: '20px',
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
    transition: 'transform 0.3s ease-out',
    overflow: 'hidden',
  }

  const iconContainerStyle: React.CSSProperties = {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    backgroundColor: `${errorColor}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    marginTop: '32px',
    marginBottom: '24px',
    transform: isAnimating ? 'scale(1) rotate(0deg)' : 'scale(0.8) rotate(-10deg)',
    transition: 'transform 0.4s ease-out',
  }

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
      <div style={overlayStyle} onClick={error.onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={{ position: 'relative', paddingTop: '16px' }}>
            <button
              onClick={error.onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                padding: '8px',
                borderRadius: '20px',
                backgroundColor: '#F3F4F6',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E5E7EB'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6'
              }}
            >
              <X size={20} color="#6B7280" />
            </button>
            <div style={iconContainerStyle}>{getIcon()}</div>
          </div>

          {/* Content */}
          <div style={{ padding: '0 32px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#1F2937',
                textAlign: 'center',
                marginBottom: '12px',
              }}
            >
              {error.title}
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: '#4B5563',
                textAlign: 'center',
                lineHeight: '24px',
                marginBottom: '24px',
              }}
            >
              {error.message}
            </p>

            {/* Explication détaillée */}
            {error.explanation && (
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <Info size={20} color="#1E40AF" />
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#1E40AF',
                    }}
                  >
                    Pourquoi cette erreur ?
                  </h3>
                </div>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#1E40AF',
                    lineHeight: '20px',
                  }}
                >
                  {error.explanation}
                </p>
              </div>
            )}

            {/* Suggestions */}
            {error.suggestions && error.suggestions.length > 0 && (
              <div
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1F2937',
                    marginBottom: '12px',
                  }}
                >
                  Que pouvez-vous faire ?
                </h3>
                {error.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                      gap: '10px',
                    }}
                  >
                    <CheckCircle2 size={20} color="#8B5CF6" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <p
                      style={{
                        fontSize: '14px',
                        color: '#4B5563',
                        lineHeight: '20px',
                        flex: 1,
                      }}
                    >
                      {suggestion}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Code d'erreur (pour debug) */}
            {error.errorCode && process.env.NODE_ENV === 'development' && (
              <div
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '8px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    marginBottom: '4px',
                  }}
                >
                  Code d&apos;erreur:
                </p>
                <p
                  style={{
                    fontSize: '11px',
                    color: '#9CA3AF',
                    fontFamily: 'monospace',
                  }}
                >
                  {error.errorCode}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '20px',
              borderTop: '1px solid #E5E7EB',
            }}
          >
            {error.onAction && (
              <button
                onClick={() => {
                  if (error.onAction) {
                    error.onAction()
                  }
                }}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#F3F4F6',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#8B5CF6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E5E7EB'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F3F4F6'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Info size={20} />
                {error.actionLabel || 'Aide'}
              </button>
            )}
            <button
              onClick={error.onClose}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '12px',
                backgroundColor: '#8B5CF6',
                border: 'none',
                fontSize: '16px',
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.2s',
              }}
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
              J&apos;ai compris
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

