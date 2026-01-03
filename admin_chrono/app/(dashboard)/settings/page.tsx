'use client'

import React, { useState } from 'react'
import { ScreenTransition } from '@/components/animations'
import { Bell, Shield, Palette, Database, Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

export default function SettingsPage() {
  const { theme, toggleTheme } = useThemeStore()
  const [mounted] = useState(() => typeof window !== 'undefined')

  const containerStyle: React.CSSProperties = {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '32px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '16px',
    color: 'var(--text-secondary)',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--card-bg)',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '24px',
    border: '1px solid var(--card-border)',
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const settingItemStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: '1px solid var(--card-border)',
  }

  const settingItemLastStyle: React.CSSProperties = {
    ...settingItemStyle,
    borderBottom: 'none',
  }

  const settingLabelStyle: React.CSSProperties = {
    fontSize: '16px',
    color: 'var(--text-primary)',
    fontWeight: 500,
  }

  const settingDescriptionStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  }

  const comingSoonStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
  }

  const toggleContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const toggleButtonStyle: React.CSSProperties = {
    position: 'relative',
    width: '56px',
    height: '32px',
    borderRadius: '16px',
    backgroundColor: theme === 'dark' ? '#8B5CF6' : '#9CA3AF',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    outline: 'none',
  }

  const toggleThumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    left: theme === 'dark' ? '28px' : '4px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    transition: 'left 0.3s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  if (!mounted) {
    return null
  }

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Paramètres</h1>
          <p style={subtitleStyle}>Gérez les paramètres de l&apos;application</p>
        </div>

        {/* Notifications */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Bell size={24} style={{ color: '#8B5CF6' }} />
            Notifications
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>Notifications par email</div>
              <div style={settingDescriptionStyle}>
                Recevez des notifications par email pour les événements importants
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>Notifications push</div>
              <div style={settingDescriptionStyle}>
                Recevez des notifications en temps réel dans votre navigateur
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
          <div style={settingItemLastStyle}>
            <div>
              <div style={settingLabelStyle}>Notifications sonores</div>
              <div style={settingDescriptionStyle}>
                Activez les sons pour les notifications importantes
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
        </div>

        {/* Sécurité */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Shield size={24} style={{ color: '#8B5CF6' }} />
            Sécurité
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>Authentification à deux facteurs</div>
              <div style={settingDescriptionStyle}>
                Ajoutez une couche de sécurité supplémentaire à votre compte
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
          <div style={settingItemLastStyle}>
            <div>
              <div style={settingLabelStyle}>Historique de connexion</div>
              <div style={settingDescriptionStyle}>
                Consultez l&apos;historique de vos connexions récentes
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
        </div>

        {/* Préférences */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Palette size={24} style={{ color: '#8B5CF6' }} />
            Préférences
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>Langue</div>
              <div style={settingDescriptionStyle}>
                Choisissez la langue de l&apos;interface
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>Thème</div>
              <div style={settingDescriptionStyle}>
                Personnalisez l&apos;apparence de l&apos;application
              </div>
            </div>
            <div style={toggleContainerStyle}>
              <Sun size={18} style={{ color: theme === 'light' ? '#F59E0B' : 'var(--text-tertiary)' }} />
              <button
                type="button"
                onClick={toggleTheme}
                style={toggleButtonStyle}
                aria-label={`Basculer vers le thème ${theme === 'light' ? 'sombre' : 'clair'}`}
              >
                <div style={toggleThumbStyle}>
                  {theme === 'dark' ? (
                    <Moon size={14} style={{ color: '#8B5CF6' }} />
                  ) : (
                    <Sun size={14} style={{ color: '#9CA3AF' }} />
                  )}
                </div>
              </button>
              <Moon size={18} style={{ color: theme === 'dark' ? '#8B5CF6' : 'var(--text-tertiary)' }} />
            </div>
          </div>
          <div style={settingItemLastStyle}>
            <div>
              <div style={settingLabelStyle}>Fuseau horaire</div>
              <div style={settingDescriptionStyle}>
                Définissez votre fuseau horaire
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
        </div>

        {/* Système */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Database size={24} style={{ color: '#8B5CF6' }} />
            Système
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>Sauvegarde automatique</div>
              <div style={settingDescriptionStyle}>
                Configurez les sauvegardes automatiques des données
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
          <div style={settingItemLastStyle}>
            <div>
              <div style={settingLabelStyle}>Logs système</div>
              <div style={settingDescriptionStyle}>
                Consultez les logs et les erreurs du système
              </div>
            </div>
            <div style={comingSoonStyle}>Bientôt disponible</div>
          </div>
        </div>
      </div>
    </ScreenTransition>
  )
}
