/**
 * Utilitaires pour gérer les couleurs du thème
 * Utilise les variables CSS définies dans globals.css
 */

export const themeColors = {
  // Backgrounds
  background: 'var(--background)',
  cardBg: 'var(--card-bg)',
  
  // Text
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',
  foreground: 'var(--foreground)',
  
  // Borders
  cardBorder: 'var(--card-border)',
  
  // Purple
  purplePrimary: 'var(--purple-primary)',
  purpleLight: 'var(--purple-light)',
  purpleDark: 'var(--purple-dark)',
  
  // Gray
  grayLight: 'var(--gray-light)',
  grayMedium: 'var(--gray-medium)',
  grayDark: 'var(--gray-dark)',
  
  // Green
  greenPrimary: 'var(--green-primary)',
  greenLight: 'var(--green-light)',
  greenDark: 'var(--green-dark)',
  
  // Yellow
  yellowPrimary: 'var(--yellow-primary)',
  yellowLight: 'var(--yellow-light)',
  yellowDark: 'var(--yellow-dark)',
  
  // Blue
  bluePrimary: 'var(--blue-primary)',
  blueLight: 'var(--blue-light)',
  blueDark: 'var(--blue-dark)',
  
  // Red
  redPrimary: 'var(--red-primary)',
  redLight: 'var(--red-light)',
  redDark: 'var(--red-dark)',
} as const
