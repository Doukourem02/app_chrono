'use client'

import React, { useState } from 'react'
import { ScreenTransition } from '@/components/animations'
import { Bell, Shield, Palette, Database, Sun, Moon, Languages } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { useLanguageStore } from '@/stores/languageStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function SettingsPage() {
  const { theme, toggleTheme } = useThemeStore()
  const { language, setLanguage } = useLanguageStore()
  const t = useTranslation()
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

  const languageToggleButtonStyle: React.CSSProperties = {
    position: 'relative',
    width: '56px',
    height: '32px',
    borderRadius: '16px',
    backgroundColor: language === 'en' ? '#8B5CF6' : '#9CA3AF',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    outline: 'none',
  }

  const languageToggleThumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    left: language === 'en' ? '28px' : '4px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    transition: 'left 0.3s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    color: language === 'en' ? '#8B5CF6' : '#9CA3AF',
  }

  if (!mounted) {
    return null
  }

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>{t('settings.title')}</h1>
          <p style={subtitleStyle}>{t('settings.subtitle')}</p>
        </div>

        {/* Notifications */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Bell size={24} style={{ color: '#8B5CF6' }} />
            {t('settings.notifications.title')}
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.notifications.email.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.notifications.email.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.notifications.push.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.notifications.push.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
          <div style={settingItemLastStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.notifications.sound.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.notifications.sound.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
        </div>

        {/* Sécurité */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Shield size={24} style={{ color: '#8B5CF6' }} />
            {t('settings.security.title')}
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.security.2fa.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.security.2fa.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
          <div style={settingItemLastStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.security.history.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.security.history.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
        </div>

        {/* Préférences */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Palette size={24} style={{ color: '#8B5CF6' }} />
            {t('settings.preferences.title')}
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.preferences.language.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.preferences.language.description')}
              </div>
            </div>
            <div style={toggleContainerStyle}>
              <Languages size={18} style={{ color: language === 'fr' ? '#8B5CF6' : 'var(--text-tertiary)' }} />
              <button
                type="button"
                onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
                style={languageToggleButtonStyle}
                aria-label={`Switch to ${language === 'fr' ? 'English' : 'French'}`}
              >
                <div style={languageToggleThumbStyle}>
                  {language === 'fr' ? 'FR' : 'EN'}
                </div>
              </button>
              <Languages size={18} style={{ color: language === 'en' ? '#8B5CF6' : 'var(--text-tertiary)' }} />
            </div>
          </div>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.preferences.theme.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.preferences.theme.description')}
              </div>
            </div>
            <div style={toggleContainerStyle}>
              <Sun size={18} style={{ color: theme === 'light' ? '#F59E0B' : 'var(--text-tertiary)' }} />
              <button
                type="button"
                onClick={toggleTheme}
                style={toggleButtonStyle}
                aria-label={t('settings.preferences.theme.description')}
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
              <div style={settingLabelStyle}>{t('settings.preferences.timezone.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.preferences.timezone.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
        </div>

        {/* Système */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Database size={24} style={{ color: '#8B5CF6' }} />
            {t('settings.system.title')}
          </h2>
          <div style={settingItemStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.system.backup.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.system.backup.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
          <div style={settingItemLastStyle}>
            <div>
              <div style={settingLabelStyle}>{t('settings.system.logs.label')}</div>
              <div style={settingDescriptionStyle}>
                {t('settings.system.logs.description')}
              </div>
            </div>
            <div style={comingSoonStyle}>{t('settings.comingSoon')}</div>
          </div>
        </div>
      </div>
    </ScreenTransition>
  )
}

