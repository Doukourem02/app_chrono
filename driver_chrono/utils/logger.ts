// Minimal logger for driver_chrono to avoid cross-project imports.
// Keeps the same public methods used by services: debug/info/warn/error/userError.
import { Alert } from 'react-native';

function format(msg: string) {
  return `[driver_chrono] ${msg}`;
}

export const logger = {
  debug: (message: string, _component?: string, extra?: any) => {
    if (__DEV__) console.log(format(message), extra ?? '');
  },
  info: (message: string, _component?: string, extra?: any) => {
    console.info(format(message), extra ?? '');
  },
  warn: (message: string, _component?: string, extra?: any) => {
    console.warn(format(message), extra ?? '');
  },
  error: (message: string, _component?: string, extra?: any) => {
    console.error(format(message), extra ?? '');
  },
  userError: (message: string, title = 'Erreur') => {
    // Logger l'erreur (dans les logs, pas visible à l'utilisateur en production)
    console.error(format(message));
    // En production, ne jamais afficher les détails techniques à l'utilisateur
    // Utiliser un message générique
    if (!__DEV__) {
      try {
        Alert.alert(
          'Erreur',
          'Une erreur s\'est produite. Veuillez réessayer ou contacter le support si le problème persiste.'
        );
      } catch {}
    } else {
      // En développement, afficher le message détaillé
      try {
        Alert.alert(title, message);
      } catch {}
    }
  }
};
