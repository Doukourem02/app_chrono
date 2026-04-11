/**
 * Titres + messages de secours pour les erreurs de scan QR (API / caméra / réseau).
 * Le message renvoyé par l’API est préféré quand il est présent.
 */

const TITLE_BY_CODE: Record<string, string> = {
  QR_PAYLOAD_MISSING: 'Données manquantes',
  QR_INVALID_JSON: 'QR non reconnu',
  QR_MALFORMED: 'QR incomplet',
  QR_SIGNATURE_INVALID: 'QR non valide',
  QR_EXPIRED: 'QR expiré',
  ORDER_NOT_FOUND: 'Commande introuvable',
  DRIVER_NOT_ASSIGNED: 'Pas votre course',
  ORDER_STATUS_INVALID: 'Étape incorrecte',
  QR_ALREADY_SCANNED: 'Déjà scanné',
  SCAN_SERVER_ERROR: 'Erreur serveur',
  SCAN_INVALID: 'Scan refusé',
  AUTH_REQUIRED: 'Session expirée',
  SCAN_BAD_RESPONSE: 'Réponse serveur',
  SCAN_NETWORK: 'Pas de connexion',
  CAMERA_READ_ERROR: 'Lecture du code',
  SCAN_UNKNOWN: 'Erreur',
};

const FALLBACK_MESSAGE_BY_CODE: Record<string, string> = {
  QR_PAYLOAD_MISSING:
    'Le téléphone n’a pas transmis le contenu du QR. Refermez et rouvrez le scanner, ou réessayez.',
  QR_INVALID_JSON:
    'Ce n’est pas un QR Chrono valide. Demandez au client d’ouvrir le QR depuis l’app (pas une capture floue ou un autre code).',
  QR_MALFORMED:
    'Le QR semble tronqué ou corrompu. Demandez au client d’afficher à nouveau le code plein écran.',
  QR_SIGNATURE_INVALID:
    'La signature du QR ne correspond pas (autre commande, faux QR ou ancien code). Utilisez le QR affiché dans l’app client pour cette livraison.',
  QR_EXPIRED:
    'Le QR a expiré. Le client doit rouvrir « Afficher le QR code » pour en obtenir un nouveau.',
  ORDER_NOT_FOUND:
    'Aucune commande ne correspond à ce QR. Vérifiez que c’est bien la course affichée chez vous.',
  DRIVER_NOT_ASSIGNED:
    'Vous n’êtes pas le livreur assigné à cette commande. Ce QR correspond à une autre course.',
  ORDER_STATUS_INVALID:
    'Le scan n’est autorisé qu’avec le colis pris en charge (statut ramassage / livraison).',
  QR_ALREADY_SCANNED:
    'Ce QR a déjà été enregistré pour votre compte. Si l’app ne reflète pas la livraison, tirez vers le bas pour rafraîchir.',
  SCAN_SERVER_ERROR:
    'Le serveur n’a pas pu valider le scan. Réessayez dans quelques secondes.',
  SCAN_INVALID: 'Le scan a été refusé. Vérifiez le QR et réessayez.',
  AUTH_REQUIRED:
    'Reconnectez-vous : votre session n’est plus valide pour enregistrer le scan.',
  SCAN_BAD_RESPONSE:
    'Réponse inattendue du serveur. Vérifiez la connexion et réessayez.',
  SCAN_NETWORK:
    'Connexion réseau insuffisante. Vérifiez les données / le Wi‑Fi et réessayez.',
  CAMERA_READ_ERROR:
    'Le code n’a pas pu être lu. Éclairage, distance, netteté : réessayez ou nettoyez l’objectif.',
  SCAN_UNKNOWN:
    'Une erreur technique s’est produite. Fermez le scanner et réessayez.',
};

export function getQRScanErrorAlert(
  code: string | undefined,
  serverMessage?: string | null
): { title: string; message: string } {
  const trimmed = serverMessage?.trim();
  const title =
    (code && TITLE_BY_CODE[code]) || 'Scan impossible';
  const message =
    trimmed ||
    (code && FALLBACK_MESSAGE_BY_CODE[code]) ||
    'Une erreur inattendue s’est produite. Réessayez ou contactez le support si le problème continue.';
  return { title, message };
}
