import { ErrorModalData } from './ErrorModal'

/**
 * Types d'erreurs prédéfinis avec leurs configurations
 */
export const ErrorTypes = {
  /**
   * Erreur de réseau
   * Le message doit être précis sur le type de problème réseau
   */
  NETWORK: (onRetry?: () => void, operation?: string): ErrorModalData => {
    const operationMessage = operation 
      ? ` lors de ${operation}`
      : '';
    
    return {
      title: 'Problème de connexion',
      message: `Impossible de se connecter au serveur${operationMessage}. Vérifiez votre connexion internet et réessayez.`,
      errorCode: 'NETWORK_ERROR',
      icon: 'warning',
      color: '#F59E0B',
      explanation: `Cette erreur survient lorsque votre navigateur ne peut pas établir une connexion avec nos serveurs${operationMessage}. Cela peut être dû à une connexion internet instable, un problème réseau temporaire, ou un serveur temporairement indisponible.`,
      suggestions: [
        'Vérifiez que vous êtes connecté à internet',
        'Essayez de rafraîchir la page',
        'Vérifiez votre connexion réseau',
        'Réessayez dans quelques instants',
      ],
      actionLabel: 'Réessayer',
      onAction: onRetry,
      onClose: () => {},
    }
  },

  /**
   * Erreur de session expirée
   */
  SESSION_EXPIRED: (onReconnect?: () => void): ErrorModalData => ({
    title: 'Session expirée',
    message: 'Votre session a expiré. Veuillez vous reconnecter pour continuer.',
    errorCode: 'SESSION_EXPIRED',
    icon: 'warning',
    color: '#EF4444',
    explanation: 'Pour votre sécurité, votre session expire après une période d\'inactivité. Toutes vos données sont sauvegardées, mais vous devez vous reconnecter pour continuer à utiliser l\'application.',
    suggestions: [
      'Cliquez sur "Se reconnecter" pour accéder à la page de connexion',
      'Vos données sont sauvegardées, vous ne perdrez rien',
      'Après reconnexion, vous retrouverez toutes vos informations',
    ],
    actionLabel: 'Se reconnecter',
    onAction: onReconnect || (() => {
      window.location.href = '/login'
    }),
    onClose: () => {},
  }),

  /**
   * Erreur de permission
   */
  PERMISSION: (type: 'localisation' | 'photos' | 'caméra' = 'localisation'): ErrorModalData => {
    const configs = {
      localisation: {
        title: 'Permission de localisation requise',
        message: 'Cette fonctionnalité nécessite l\'accès à votre localisation.',
        explanation: 'Nous avons besoin de votre localisation pour vous proposer des services personnalisés comme la recherche d\'adresses proches, le calcul d\'itinéraires, et le suivi de livraison en temps réel.',
        suggestions: [
          'Cliquez sur l\'icône de localisation dans la barre d\'adresse',
          'Autorisez l\'accès à la localisation',
          'Rechargez la page',
        ],
      },
      photos: {
        title: 'Permission d\'accès aux photos requise',
        message: 'Cette fonctionnalité nécessite l\'accès à vos photos.',
        explanation: 'Nous avons besoin d\'accéder à vos photos pour vous permettre de télécharger des images, par exemple pour compléter votre profil ou partager des documents.',
        suggestions: [
          'Allez dans les paramètres de votre navigateur',
          'Autorisez l\'accès aux fichiers',
          'Rechargez la page',
        ],
      },
      caméra: {
        title: 'Permission d\'accès à la caméra requise',
        message: 'Cette fonctionnalité nécessite l\'accès à votre caméra.',
        explanation: 'Nous avons besoin d\'accéder à votre caméra pour vous permettre de prendre des photos, scanner des codes QR, ou utiliser des fonctionnalités de réalité augmentée.',
        suggestions: [
          'Cliquez sur l\'icône de caméra dans la barre d\'adresse',
          'Autorisez l\'accès à la caméra',
          'Rechargez la page',
        ],
      },
    }

    const config = configs[type]
    return {
      ...config,
      errorCode: `PERMISSION_${type.toUpperCase()}_DENIED`,
      icon: 'warning',
      color: '#F59E0B',
      onClose: () => {},
    }
  },

  /**
   * Erreur de validation
   */
  VALIDATION: (message: string): ErrorModalData => ({
    title: 'Information requise',
    message,
    errorCode: 'VALIDATION_ERROR',
    icon: 'warning',
    color: '#F59E0B',
    explanation: 'Certaines informations sont manquantes ou incorrectes. Veuillez vérifier et compléter tous les champs requis.',
    suggestions: [
      'Vérifiez que tous les champs obligatoires sont remplis',
      'Assurez-vous que les formats sont corrects (email, téléphone, etc.)',
      'Vérifiez que les valeurs respectent les limites (montants, dates, etc.)',
    ],
    onClose: () => {},
  }),

  /**
   * Erreur API / Service indisponible
   * Le message doit être précis et expliquer exactement ce qui ne fonctionne pas
   */
  API_ERROR: (message?: string, onRetry?: () => void, serviceName?: string): ErrorModalData => {
    const defaultMessage = serviceName 
      ? `Le service "${serviceName}" est temporairement indisponible. Nous rencontrons des difficultés techniques avec ce service spécifique.`
      : 'Le service est temporairement indisponible. Nous rencontrons des difficultés techniques.';
    
    return {
      title: 'Service indisponible',
      message: message || defaultMessage,
      errorCode: 'API_ERROR',
      icon: 'alert',
      color: '#EF4444',
      explanation: serviceName
        ? `Le service "${serviceName}" que vous essayez d'utiliser rencontre actuellement des problèmes techniques. Cela peut être dû à une maintenance programmée, une surcharge temporaire, ou un problème technique spécifique à ce service.`
        : 'Nos serveurs rencontrent actuellement des difficultés techniques. Cela peut être dû à une maintenance programmée, une surcharge temporaire, ou un problème technique. Nous travaillons à résoudre le problème au plus vite.',
      suggestions: [
        'Réessayez dans quelques instants',
        'Vérifiez votre connexion internet',
        'Si le problème persiste, contactez le support en mentionnant le service concerné',
      ],
      actionLabel: 'Réessayer',
      onAction: onRetry,
      onClose: () => {},
    }
  },

  /**
   * Erreur d'enregistrement
   * Le message doit être précis sur ce qui n'a pas pu être enregistré et pourquoi
   */
  SAVE_ERROR: (item: string = 'les données', onRetry?: () => void, reason?: string): ErrorModalData => {
    const reasonMessage = reason 
      ? ` Raison : ${reason}`
      : '';
    
    return {
      title: 'Erreur d\'enregistrement',
      message: `Impossible d'enregistrer ${item}.${reasonMessage} Veuillez vérifier les informations et réessayer.`,
      errorCode: 'SAVE_ERROR',
      icon: 'alert',
      color: '#EF4444',
      explanation: reason
        ? `Une erreur s'est produite lors de l'enregistrement de ${item}. ${reason} Cela peut être dû à une validation échouée, une connexion instable, ou un problème serveur.`
        : `Une erreur s'est produite lors de l'enregistrement de ${item}. Cela peut être dû à une connexion instable, un problème de synchronisation, une validation échouée, ou une erreur serveur temporaire.`,
      suggestions: [
        'Vérifiez que toutes les informations sont correctes',
        'Vérifiez votre connexion internet',
        'Réessayez d\'enregistrer',
        'Si le problème persiste, contactez le support',
      ],
      actionLabel: 'Réessayer',
      onAction: onRetry,
      onClose: () => {},
    }
  },

  /**
   * Erreur de chargement
   * Le message doit être précis sur ce qui n'a pas pu être chargé et pourquoi
   */
  LOAD_ERROR: (item: string = 'les données', onRetry?: () => void, reason?: string): ErrorModalData => {
    const reasonMessage = reason 
      ? ` Raison : ${reason}`
      : '';
    
    return {
      title: 'Erreur de chargement',
      message: `Impossible de charger ${item}.${reasonMessage} Veuillez vérifier votre connexion et réessayer.`,
      errorCode: 'LOAD_ERROR',
      icon: 'alert',
      color: '#EF4444',
      explanation: reason
        ? `Une erreur s'est produite lors du chargement de ${item}. ${reason} Cela peut être dû à une connexion instable, un problème de synchronisation, ou une erreur serveur.`
        : `Une erreur s'est produite lors du chargement de ${item}. Cela peut être dû à une connexion instable, un problème de synchronisation, une ressource introuvable, ou une erreur serveur temporaire.`,
      suggestions: [
        'Vérifiez votre connexion internet',
        'Réessayez de charger',
        'Si le problème persiste, contactez le support',
      ],
      actionLabel: 'Réessayer',
      onAction: onRetry,
      onClose: () => {},
    }
  },

  /**
   * Erreur de compte incomplet
   */
  INCOMPLETE_ACCOUNT: (onReconnect?: () => void): ErrorModalData => ({
    title: 'Compte incomplet',
    message: 'Votre compte n\'est pas totalement configuré. Veuillez vous reconnecter pour synchroniser votre profil.',
    errorCode: 'INCOMPLETE_ACCOUNT',
    icon: 'warning',
    color: '#F59E0B',
    explanation: 'Votre profil n\'est pas complètement synchronisé avec nos serveurs. Cela peut arriver après une mise à jour de l\'application ou un changement de configuration. Une reconnexion permettra de synchroniser toutes vos informations.',
    suggestions: [
      'Cliquez sur "Se reconnecter"',
      'Vos données sont sauvegardées',
      'Après reconnexion, votre profil sera à jour',
    ],
    actionLabel: 'Se reconnecter',
    onAction: onReconnect || (() => {
      window.location.href = '/login'
    }),
    onClose: () => {},
  }),

  /**
   * Erreur de connexion requise
   */
  LOGIN_REQUIRED: (): ErrorModalData => ({
    title: 'Connexion requise',
    message: 'Vous devez vous connecter ou créer un compte pour utiliser cette fonctionnalité.',
    errorCode: 'LOGIN_REQUIRED',
    icon: 'info',
    color: '#8B5CF6',
    explanation: 'Cette fonctionnalité nécessite que vous soyez connecté à votre compte. Cela nous permet de personnaliser votre expérience et de sécuriser vos données.',
    suggestions: [
      'Cliquez sur "Se connecter" pour accéder à la page de connexion',
      'Si vous n\'avez pas de compte, créez-en un gratuitement',
      'Après connexion, vous pourrez utiliser toutes les fonctionnalités',
    ],
    actionLabel: 'Se connecter',
    onAction: () => {
      window.location.href = '/login'
    },
    onClose: () => {},
  }),

  /**
   * Erreur de service indisponible
   */
  SERVICE_UNAVAILABLE: (service: string = 'ce service', onRetry?: () => void): ErrorModalData => ({
    title: 'Service indisponible',
    message: `${service} est temporairement indisponible. Réessayez plus tard.`,
    errorCode: 'SERVICE_UNAVAILABLE',
    icon: 'alert',
    color: '#EF4444',
    explanation: 'Le service que vous essayez d\'utiliser est temporairement indisponible. Cela peut être dû à une maintenance programmée ou un problème technique temporaire.',
    suggestions: [
      'Réessayez dans quelques instants',
      'Vérifiez votre connexion internet',
      'Si le problème persiste, contactez le support',
    ],
    actionLabel: 'Réessayer',
    onAction: onRetry,
    onClose: () => {},
  }),

  /**
   * Erreur générique
   */
  GENERIC: (title: string = 'Une erreur est survenue', message: string = 'Désolé, une erreur inattendue s\'est produite.', onRetry?: () => void): ErrorModalData => ({
    title,
    message,
    errorCode: 'GENERIC_ERROR',
    icon: 'alert',
    color: '#EF4444',
    explanation: 'Une erreur inattendue s\'est produite. Cela peut être dû à un problème temporaire ou à une configuration incorrecte.',
    suggestions: [
      'Réessayez dans quelques instants',
      'Vérifiez votre connexion internet',
      'Si le problème persiste, contactez le support',
    ],
    actionLabel: 'Réessayer',
    onAction: onRetry,
    onClose: () => {},
  }),
}

