import { UserFriendlyError } from './userFriendlyError';

/**
 * Convertit une erreur brute en message user-friendly
 * Ne jamais afficher les détails techniques aux utilisateurs
 */
export function formatErrorForUser(error: unknown, context?: string): {
  title: string;
  message: string;
  onRetry?: () => void;
} {
  // Logger l'erreur technique (pour les développeurs, pas visible à l'utilisateur)
  if (__DEV__) {
    console.error('[ErrorFormatter] Erreur technique:', error);
  }

  // Erreur réseau
  if (error instanceof TypeError) {
    if (error.message.includes('Network request failed') || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('network')) {
      return {
        title: 'Problème de connexion',
        message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.',
      };
    }
  }

  // Erreur avec message d'erreur API
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    // Erreurs OTP
    if (errorMessage.includes('otp') || errorMessage.includes('code de vérification')) {
      if (errorMessage.includes('expiré') || errorMessage.includes('expired')) {
        return {
          title: 'Code expiré',
          message: 'Le code de vérification a expiré. Veuillez en demander un nouveau.',
        };
      }
      if (errorMessage.includes('incorrect') || errorMessage.includes('invalid')) {
        return {
          title: 'Code incorrect',
          message: 'Le code de vérification est incorrect. Veuillez réessayer.',
        };
      }
      if (errorMessage.includes('trop de demandes') || errorMessage.includes('too many')) {
        return {
          title: 'Trop de tentatives',
          message: 'Trop de demandes de code. Veuillez attendre 1 minute avant de réessayer.',
        };
      }
      return {
        title: 'Erreur de vérification',
        message: 'Une erreur est survenue lors de la vérification du code. Veuillez réessayer.',
      };
    }

    // Erreurs de session
    if (errorMessage.includes('session') || errorMessage.includes('token') || errorMessage.includes('authentification')) {
      return {
        title: 'Session expirée',
        message: 'Votre session a expiré. Veuillez vous reconnecter.',
      };
    }

    // Erreurs serveur
    if (errorMessage.includes('serveur') || errorMessage.includes('server') || errorMessage.includes('500')) {
      return {
        title: 'Erreur serveur',
        message: 'Le serveur rencontre un problème. Veuillez réessayer dans quelques instants.',
      };
    }

    // Erreurs de validation
    if (errorMessage.includes('validation') || errorMessage.includes('requis') || errorMessage.includes('required')) {
      return {
        title: 'Information manquante',
        message: 'Certaines informations sont manquantes ou incorrectes. Veuillez vérifier et réessayer.',
      };
    }

    // Erreurs de permission
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') || errorMessage.includes('403')) {
      return {
        title: 'Accès refusé',
        message: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
      };
    }

    // Erreurs 404
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        title: 'Ressource introuvable',
        message: 'La ressource demandée n\'a pas été trouvée. Veuillez réessayer.',
      };
    }
  }

  // Erreur inconnue - message générique
  return {
    title: 'Une erreur est survenue',
    message: 'Désolé, une erreur inattendue s\'est produite. Veuillez réessayer ou contacter le support si le problème persiste.',
  };
}

/**
 * Affiche une erreur user-friendly à partir d'une erreur brute
 */
export function showUserFriendlyError(error: unknown, context?: string, onRetry?: () => void) {
  const formatted = formatErrorForUser(error, context);
  UserFriendlyError.showGenericError(formatted.title, formatted.message, onRetry);
}

