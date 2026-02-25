/**
 * Annonces vocales avec voix féminine française uniquement.
 * Utilise la même voix que Mapbox (Amélie) pour une expérience cohérente.
 */
let cachedFemaleVoiceId: string | null = null;
let voiceLookupFailed = false; // Évite les appels répétés getAvailableVoicesAsync (erreurs simulateur iOS)

async function getFrenchFemaleVoice(): Promise<string | null> {
  if (cachedFemaleVoiceId) return cachedFemaleVoiceId;
  if (voiceLookupFailed) return null; // Ne pas réessayer après échec (évite spam TextToSpeech errors)
  try {
    const Speech = await import('expo-speech');
    const voices = await Speech.getAvailableVoicesAsync();
    // Chercher une voix française féminine (Amélie, Céline, etc.)
    const female = voices.find(
      (v) =>
        (v.language?.startsWith('fr') ?? false) &&
        (v.name?.toLowerCase().includes('amelie') ||
          v.name?.toLowerCase().includes('amélie') ||
          v.name?.toLowerCase().includes('celine') ||
          v.identifier?.toLowerCase().includes('amelie'))
    );
    if (female?.identifier) {
      cachedFemaleVoiceId = female.identifier;
      return cachedFemaleVoiceId;
    }
    // Fallback : première voix fr-FR (souvent féminine par défaut sur iOS)
    const frVoice = voices.find((v) => v.language === 'fr-FR' || v.language?.startsWith('fr-'));
    if (frVoice?.identifier) {
      cachedFemaleVoiceId = frVoice.identifier;
      return cachedFemaleVoiceId;
    }
  } catch {
    voiceLookupFailed = true; // Évite les appels répétés qui génèrent des erreurs (simulateur iOS)
  }
  return null;
}

/**
 * Parle le texte avec une voix féminine française.
 * Cohérent avec la navigation Mapbox (voix féminine forcée via fix-mapbox-voice-female.js).
 */
export async function speakAnnouncement(text: string): Promise<void> {
  try {
    const Speech = await import('expo-speech');
    const voiceId = await getFrenchFemaleVoice();
    Speech.speak(text, {
      language: 'fr-FR',
      rate: 0.9,
      ...(voiceId && { voice: voiceId }),
    });
  } catch {
    // no-op si module indisponible
  }
}

/**
 * Répète une annonce vocale plusieurs fois avec un intervalle entre chaque.
 * Ex: "Vous êtes arrivé à destination" x2 avec 2s d'intervalle.
 */
export function speakAnnouncementRepeat(
  text: string,
  times: number = 2,
  intervalMs: number = 2000
): void {
  for (let i = 0; i < times; i++) {
    setTimeout(() => {
      speakAnnouncement(text);
    }, i * intervalMs);
  }
}
