import { Alert } from 'react-native';
import { router } from 'expo-router';
import { logger } from './logger';

/**
 * Service centralisé pour afficher des messages d'erreur user-friendly
 * Remplace tous les Alert.alert avec messages techniques
 */
export class UserFriendlyError {
  /**
   * Affiche un message d'erreur générique user-friendly
   */
  static showGenericError(
    title: string = 'Une erreur est survenue',
    message: string = 'Désolé, une erreur inattendue s\'est produite. Veuillez réessayer ou contacter le support si le problème persiste.',
    onRetry?: () => void
  ) {
    Alert.alert(
      title,
      message,
      [
        { text: 'OK', style: 'default' },
        ...(onRetry ? [{ text: 'Réessayer', onPress: onRetry }] : []),
      ],
      { cancelable: true }
    );
  }

  /**
   * Erreur de connexion réseau
   */
  static showNetworkError(onRetry?: () => void) {
    this.showGenericError(
      'Problème de connexion',
      'Vérifiez votre connexion internet et réessayez.',
      onRetry
    );
  }

  /**
   * Erreur de session expirée
   */
  static showSessionExpired() {
    Alert.alert(
      'Session expirée',
      'Votre session a expiré. Veuillez vous reconnecter.',
      [
        {
          text: 'Se reconnecter',
          onPress: () => {
            // Rediriger vers la page de connexion
            router.replace('/(auth)/login');
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  }

  /**
   * Erreur de permission
   */
  static showPermissionError(permission: 'localisation' | 'photos' | 'caméra' = 'localisation') {
    const messages = {
      localisation: 'Activez la localisation dans les paramètres pour utiliser cette fonctionnalité.',
      photos: 'Autorisez l\'accès à vos photos dans les paramètres pour utiliser cette fonctionnalité.',
      caméra: 'Autorisez l\'accès à la caméra dans les paramètres pour utiliser cette fonctionnalité.',
    };

    Alert.alert(
      'Permission requise',
      messages[permission],
      [
        { text: 'OK', style: 'default' },
      ]
    );
  }

  /**
   * Erreur de validation (champs manquants, etc.)
   */
  static showValidationError(message: string) {
    Alert.alert(
      'Information requise',
      message,
      [{ text: 'OK', style: 'default' }]
    );
  }

  /**
   * Erreur API avec message user-friendly
   */
  static showAPIError(
    message: string = 'Service temporairement indisponible. Réessayez plus tard.',
    onRetry?: () => void
  ) {
    this.showGenericError('Service indisponible', message, onRetry);
  }

  /**
   * Erreur lors de l'enregistrement
   */
  static showSaveError(
    item: string = 'les données',
    onRetry?: () => void
  ) {
    this.showGenericError(
      'Erreur d\'enregistrement',
      `Impossible d'enregistrer ${item}. Veuillez réessayer.`,
      onRetry
    );
  }

  /**
   * Erreur lors du chargement
   */
  static showLoadError(
    item: string = 'les données',
    onRetry?: () => void
  ) {
    this.showGenericError(
      'Erreur de chargement',
      `Impossible de charger ${item}. Veuillez réessayer.`,
      onRetry
    );
  }

  /**
   * Erreur de compte incomplet
   */
  static showIncompleteAccount(onReconnect?: () => void) {
    Alert.alert(
      'Compte incomplet',
      'Votre compte n\'est pas totalement configuré. Veuillez vous reconnecter pour synchroniser votre profil.',
      [
        {
          text: 'Se reconnecter',
          onPress: () => {
            if (onReconnect) {
              onReconnect();
            } else {
              router.replace('/(auth)/login');
            }
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  }

  /**
   * Erreur de connexion requise
   */
  static showLoginRequired() {
    Alert.alert(
      'Connexion requise',
      'Vous devez vous connecter ou créer un compte pour utiliser cette fonctionnalité.',
      [
        {
          text: 'Se connecter',
          onPress: () => router.replace('/(auth)/login'),
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  }

  /**
   * Erreur de service indisponible
   */
  static showServiceUnavailable(service: string = 'ce service', onRetry?: () => void) {
    this.showGenericError(
      'Service indisponible',
      `${service} est temporairement indisponible. Réessayez plus tard.`,
      onRetry
    );
  }

  /**
   * Erreur lors de l'ouverture d'une application externe
   */
  static showExternalAppError(app: 'email' | 'téléphone' | 'whatsapp' | 'navigation') {
    const messages = {
      email: 'Impossible d\'ouvrir l\'application email. Vérifiez que vous avez une application email installée.',
      téléphone: 'Impossible d\'ouvrir l\'application téléphone. Vérifiez que vous avez une application téléphone installée.',
      whatsapp: 'Impossible d\'ouvrir WhatsApp. Vérifiez que WhatsApp est installé sur votre appareil.',
      navigation: 'Impossible d\'ouvrir l\'application de navigation. Vérifiez que vous avez une application de navigation installée.',
    };

    Alert.alert(
      'Application non disponible',
      messages[app],
      [{ text: 'OK', style: 'default' }]
    );
  }

  /**
   * Message de succès
   */
  static showSuccess(message: string, onPress?: () => void) {
    Alert.alert(
      'Succès',
      message,
      [{ text: 'OK', onPress, style: 'default' }]
    );
  }

  /**
   * Message d'information
   */
  static showInfo(title: string, message: string) {
    Alert.alert(
      title,
      message,
      [{ text: 'OK', style: 'default' }]
    );
  }

  /**
   * Confirmation avec actions
   */
  static showConfirmation(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = 'Confirmer',
    cancelText: string = 'Annuler'
  ) {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel' },
        { text: confirmText, onPress: onConfirm, style: 'default' },
      ]
    );
  }

  /**
   * Gère une erreur inconnue et affiche un message user-friendly
   */
  static handleUnknownError(error: any, context?: string, onRetry?: () => void) {
    // Logger l'erreur technique (pas visible à l'utilisateur)
    logger.error(
      `Erreur inconnue${context ? ` dans ${context}` : ''}`,
      context || 'Unknown',
      error
    );

    // Afficher un message user-friendly
    this.showGenericError(
      'Une erreur est survenue',
      'Désolé, une erreur inattendue s\'est produite. Veuillez réessayer ou contacter le support si le problème persiste.',
      onRetry
    );
  }
}

