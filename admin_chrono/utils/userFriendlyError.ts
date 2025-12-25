import { useErrorModalStore } from '@/store/useErrorModalStore'
import { ErrorTypes } from '@/components/error/errorTypes'

/**
 * Service centralisé pour afficher des messages d'erreur user-friendly
 * Utilise des modals animés avec explications détaillées
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
    const errorData = ErrorTypes.GENERIC(title, message, onRetry)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Erreur de connexion réseau
   * @param onRetry - Fonction de retry
   * @param operation - Description de l'opération qui a échoué (ex: "la création de commande", "le chargement des données")
   */
  static showNetworkError(onRetry?: () => void, operation?: string) {
    const errorData = ErrorTypes.NETWORK(onRetry, operation)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Erreur de session expirée
   */
  static showSessionExpired(onReconnect?: () => void) {
    const errorData = ErrorTypes.SESSION_EXPIRED(onReconnect)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Erreur de permission
   */
  static showPermissionError(permission: 'localisation' | 'photos' | 'caméra' = 'localisation') {
    const errorData = ErrorTypes.PERMISSION(permission)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Erreur de validation (champs manquants, etc.)
   */
  static showValidationError(message: string) {
    const errorData = ErrorTypes.VALIDATION(message)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
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
    const errorData = ErrorTypes.API_ERROR(message, onRetry, serviceName)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
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
    const errorData = ErrorTypes.SAVE_ERROR(item, onRetry, reason)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
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
    const errorData = ErrorTypes.LOAD_ERROR(item, onRetry, reason)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Erreur de compte incomplet
   */
  static showIncompleteAccount(onReconnect?: () => void) {
    const errorData = ErrorTypes.INCOMPLETE_ACCOUNT(onReconnect)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Erreur de connexion requise
   */
  static showLoginRequired() {
    const errorData = ErrorTypes.LOGIN_REQUIRED()
    errorData.onAction = () => {
      window.location.href = '/login'
      useErrorModalStore.getState().hideError()
    }
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Erreur de service indisponible
   */
  static showServiceUnavailable(service: string = 'ce service', onRetry?: () => void) {
    const errorData = ErrorTypes.SERVICE_UNAVAILABLE(service, onRetry)
    errorData.onClose = () => {
      useErrorModalStore.getState().hideError()
    }
    useErrorModalStore.getState().showError(errorData)
  }

  /**
   * Gère une erreur inconnue et affiche un message user-friendly
   */
  static handleUnknownError(error: unknown, context?: string, onRetry?: () => void) {
    // Logger l'erreur technique (pas visible à l'utilisateur)
    if (process.env.NODE_ENV === 'development') {
      console.error(`Erreur inconnue${context ? ` dans ${context}` : ''}:`, error)
    }

    // Afficher un message user-friendly
    this.showGenericError(
      'Une erreur est survenue',
      'Désolé, une erreur inattendue s\'est produite. Veuillez réessayer ou contacter le support si le problème persiste.',
      onRetry
    )
  }
}

