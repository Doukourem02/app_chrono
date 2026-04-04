import { Alert, Linking } from 'react-native';

/** Ouvre une URL légale (CGU / confidentialité). Prévoir EXPO_PUBLIC_LEGAL_* dans .env. */
export function openLegalUrl(url: string | undefined, missingMessage: string) {
  const u = url?.trim();
  if (!u) {
    Alert.alert('Information', missingMessage);
    return;
  }
  Linking.openURL(u).catch(() => {
    Alert.alert('Erreur', 'Impossible d’ouvrir le lien.');
  });
}
