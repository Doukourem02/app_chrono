import { Alert } from 'react-native';
import { router } from 'expo-router';
import { logger } from './logger';
import { useErrorModalStore } from '../store/useErrorModalStore';
import { useDeferredPaymentErrorStore } from '../store/useDeferredPaymentErrorStore';
import { ErrorTypes } from '../components/error/errorTypes';

/**
 * Service centralisé pour afficher des messages d'erreur user-friendly
 * Utilise des modals animés avec explications détaillées au lieu de simples Alert.alert
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
    const errorData = ErrorTypes.GENERIC(title, message, onRetry);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur de connexion réseau
   * @param onRetry - Fonction de retry
   * @param operation - Description de l'opération qui a échoué (ex: "la création de commande", "le chargement des données")
   */
  static showNetworkError(onRetry?: () => void, operation?: string) {
    const errorData = ErrorTypes.NETWORK(onRetry, operation);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur de session expirée
   */
  static showSessionExpired() {
    const errorData = ErrorTypes.SESSION_EXPIRED(() => {
      router.replace('/(auth)/login');
    });
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur de permission
   */
  static showPermissionError(permission: 'localisation' | 'photos' | 'caméra' = 'localisation') {
    const errorData = ErrorTypes.PERMISSION(permission);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur de validation (champs manquants, etc.)
   */
  static showValidationError(message: string) {
    const errorData = ErrorTypes.VALIDATION(message);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur API avec message user-friendly
   * @param message - Message précis expliquant exactement ce qui ne fonctionne pas
   * @param onRetry - Fonction de retry
   * @param serviceName - Nom du service concerné (ex: "Service de géolocalisation", "API de paiement")
   */
  static showAPIError(
    message?: string,
    onRetry?: () => void,
    serviceName?: string
  ) {
    const errorData = ErrorTypes.API_ERROR(message, onRetry, serviceName);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur lors de l'enregistrement
   * @param item - Ce qui n'a pas pu être enregistré (ex: "la commande", "vos informations")
   * @param onRetry - Fonction de retry
   * @param reason - Raison précise de l'échec (ex: "L'adresse de livraison est invalide", "Le montant minimum n'est pas atteint")
   */
  static showSaveError(
    item: string = 'les données',
    onRetry?: () => void,
    reason?: string
  ) {
    const errorData = ErrorTypes.SAVE_ERROR(item, onRetry, reason);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur lors du chargement
   * @param item - Ce qui n'a pas pu être chargé (ex: "vos commandes", "la liste des livreurs")
   * @param onRetry - Fonction de retry
   * @param reason - Raison précise de l'échec (ex: "La ressource demandée n'existe pas", "Vous n'avez pas les permissions nécessaires")
   */
  static showLoadError(
    item: string = 'les données',
    onRetry?: () => void,
    reason?: string
  ) {
    const errorData = ErrorTypes.LOAD_ERROR(item, onRetry, reason);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur de compte incomplet
   */
  static showIncompleteAccount(onReconnect?: () => void) {
    const errorData = ErrorTypes.INCOMPLETE_ACCOUNT(() => {
      if (onReconnect) {
        onReconnect();
      } else {
        router.replace('/(auth)/login');
      }
    });
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur de connexion requise
   */
  static showLoginRequired() {
    const errorData = ErrorTypes.LOGIN_REQUIRED();
    errorData.onAction = () => {
      router.replace('/(auth)/login');
      useErrorModalStore.getState().hideError();
    };
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur de service indisponible
   */
  static showServiceUnavailable(service: string = 'ce service', onRetry?: () => void) {
    const errorData = ErrorTypes.SERVICE_UNAVAILABLE(service, onRetry);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
  }

  /**
   * Erreur lors de l'ouverture d'une application externe
   */
  static showExternalAppError(app: 'email' | 'téléphone' | 'whatsapp' | 'navigation') {
    const errorData = ErrorTypes.EXTERNAL_APP(app);
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError();
    };
    useErrorModalStore.getState().showError(errorData);
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
   * Erreur de paiement différé - quota atteint
   * Utilise le modal dédié avec explications détaillées
   */
  static showDeferredPaymentError(
    message: string,
    details?: {
      errorCode?: string;
      monthlyRemaining?: number;
      monthlyLimit?: number;
      requestedAmount?: number;
      monthlyUsages?: number;
      maxUsagesPerMonth?: number;
      annualLimit?: number;
      cooldownDaysRemaining?: number;
      blockEndDate?: string;
      minAmount?: number;
    }
  ) {
    const errorData: import('../components/error/DeferredPaymentErrorModal').DeferredPaymentErrorData = {
      message,
      errorCode: details?.errorCode,
      details: details ? {
        monthlyRemaining: details.monthlyRemaining,
        monthlyLimit: details.monthlyLimit,
        requestedAmount: details.requestedAmount,
        monthlyUsages: details.monthlyUsages,
        maxUsagesPerMonth: details.maxUsagesPerMonth,
        annualLimit: details.annualLimit,
        cooldownDaysRemaining: details.cooldownDaysRemaining,
        blockEndDate: details.blockEndDate,
        minAmount: details.minAmount,
      } : undefined,
      onClose: () => {
        useDeferredPaymentErrorStore.getState().hideError();
      },
    };
    useDeferredPaymentErrorStore.getState().showError(errorData);
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

