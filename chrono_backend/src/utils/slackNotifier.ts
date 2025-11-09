/**
 * Intégration Slack pour les alertes et notifications
 * 
 * Configuration requise:
 *   SLACK_WEBHOOK_URL: URL du webhook Slack
 *   SLACK_CHANNEL: Canal Slack (optionnel)
 */

import logger from './logger.js';

interface SlackMessage {
  text?: string;
  blocks?: any[];
  attachments?: any[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

let slackConfig: SlackConfig | null = null;

/**
 * Initialise la configuration Slack
 */
export function initSlack(): void {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    logger.warn('⚠️ SLACK_WEBHOOK_URL non configuré - notifications Slack désactivées');
    return;
  }
  
  slackConfig = {
    webhookUrl,
    channel: process.env.SLACK_CHANNEL,
    username: process.env.SLACK_USERNAME || 'Chrono Backend',
    iconEmoji: process.env.SLACK_ICON_EMOJI || ':warning:'
  };
  
  logger.info('✅ Slack notifier initialisé');
}

/**
 * Envoie un message à Slack
 */
export async function sendSlackMessage(
  message: string,
  options: {
    level?: 'info' | 'warning' | 'error' | 'critical';
    title?: string;
    fields?: { title: string; value: string; short?: boolean }[];
    color?: string;
  } = {}
): Promise<void> {
  if (!slackConfig) {
    // Initialiser si pas encore fait
    initSlack();
    if (!slackConfig) {
      return; // Slack non configuré
    }
  }
  
  const { level = 'info', title, fields = [], color } = options;
  
  // Couleurs selon le niveau
  const colors: { [key: string]: string } = {
    info: '#36a64f',      // Vert
    warning: '#ff9900',   // Orange
    error: '#ff0000',     // Rouge
    critical: '#8b0000'   // Rouge foncé
  };
  
  const emojis: { [key: string]: string } = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨'
  };
  
  const slackMessage: SlackMessage = {
    username: slackConfig.username,
    icon_emoji: emojis[level] || ':information_source:',
    channel: slackConfig.channel,
    attachments: [
      {
        color: color || colors[level] || colors.info,
        title: title || `${emojis[level]} ${level.toUpperCase()}`,
        text: message,
        fields: fields.map(field => ({
          title: field.title,
          value: field.value,
          short: field.short !== false
        })),
        footer: 'Chrono Backend',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
  
  try {
    const response = await fetch(slackConfig.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });
    
    if (!response.ok) {
      logger.error(`❌ Erreur lors de l'envoi à Slack: ${response.status} ${response.statusText}`);
    } else {
      logger.debug(`✅ Message Slack envoyé: ${title || message}`);
    }
  } catch (error: any) {
    logger.error(`❌ Erreur lors de l'envoi à Slack:`, error.message);
  }
}

/**
 * Alerte critique (erreurs serveur, crash, etc.)
 */
export async function sendCriticalAlert(
  message: string,
  details?: { [key: string]: string }
): Promise<void> {
  const fields = details
    ? Object.entries(details).map(([key, value]) => ({
        title: key,
        value: value.substring(0, 1000), // Limite Slack
        short: true
      }))
    : [];
  
  await sendSlackMessage(message, {
    level: 'critical',
    title: '🚨 ALERTE CRITIQUE',
    fields,
    color: '#8b0000'
  });
}

/**
 * Alerte d'erreur (erreurs applicatives)
 */
export async function sendErrorAlert(
  message: string,
  error?: Error | string,
  context?: { [key: string]: string }
): Promise<void> {
  const fields: { title: string; value: string; short?: boolean }[] = [];
  
  if (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    fields.push({
      title: 'Erreur',
      value: errorMessage.substring(0, 1000),
      short: false
    });
    
    if (error instanceof Error && error.stack) {
      fields.push({
        title: 'Stack Trace',
        value: error.stack.substring(0, 1000),
        short: false
      });
    }
  }
  
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      fields.push({
        title: key,
        value: value.substring(0, 1000),
        short: true
      });
    });
  }
  
  await sendSlackMessage(message, {
    level: 'error',
    title: '❌ Erreur',
    fields,
    color: '#ff0000'
  });
}

/**
 * Alerte d'avertissement (warnings importants)
 */
export async function sendWarningAlert(
  message: string,
  context?: { [key: string]: string }
): Promise<void> {
  const fields = context
    ? Object.entries(context).map(([key, value]) => ({
        title: key,
        value: value.substring(0, 1000),
        short: true
      }))
    : [];
  
  await sendSlackMessage(message, {
    level: 'warning',
    title: '⚠️ Avertissement',
    fields,
    color: '#ff9900'
  });
}

/**
 * Notification d'information (déploiements, backups, etc.)
 */
export async function sendInfoNotification(
  message: string,
  context?: { [key: string]: string }
): Promise<void> {
  const fields = context
    ? Object.entries(context).map(([key, value]) => ({
        title: key,
        value: value.substring(0, 1000),
        short: true
      }))
    : [];
  
  await sendSlackMessage(message, {
    level: 'info',
    title: 'ℹ️ Information',
    fields,
    color: '#36a64f'
  });
}

// Initialiser au chargement du module
initSlack();

