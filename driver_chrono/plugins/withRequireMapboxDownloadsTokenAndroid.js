/**
 * Sur EAS Build Android, com.mapbox.maps:* est résolu sur api.mapbox.com — sans secret DOWNLOADS:READ,
 * Gradle échoue avec « Could not find com.mapbox.maps:android:… ».
 *
 * On écrit MAPBOX_DOWNLOADS_TOKEN dans gradle.properties au prebuild : plus fiable que System.getenv()
 * pour le daemon Gradle sur les workers EAS.
 */
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withRequireMapboxDownloadsTokenAndroid(config) {
  const isEasAndroid =
    process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android';

  const token = (
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ||
    process.env.MAPBOX_DOWNLOADS_TOKEN ||
    ''
  ).trim();

  if (isEasAndroid) {
    if (!token) {
      throw new Error(
        '[driver_chrono] Variable manquante : RNMAPBOX_MAPS_DOWNLOAD_TOKEN (ou MAPBOX_DOWNLOADS_TOKEN). ' +
          'Crée un token secret Mapbox (sk.…) avec le scope DOWNLOADS:READ, puis expo.dev → projet driver_chrono → ' +
          'Environment variables → environnement production → ajoute RNMAPBOX_MAPS_DOWNLOAD_TOKEN (Sensitive). ' +
          'Sans cela, Gradle ne peut pas télécharger com.mapbox.maps sur le Maven Mapbox.'
      );
    }
    if (token.startsWith('pk.')) {
      throw new Error(
        '[driver_chrono] RNMAPBOX_MAPS_DOWNLOAD_TOKEN ne doit pas être le token public (pk.…). ' +
          'Utilise un token secret (sk.…) avec le scope DOWNLOADS:READ pour le dépôt Maven Mapbox. ' +
          'Le pk. reste dans EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN pour le runtime.'
      );
    }
  }

  if (!token) {
    return config;
  }

  return withGradleProperties(config, (exported) => {
    exported.modResults = exported.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'MAPBOX_DOWNLOADS_TOKEN')
    );
    exported.modResults.push({
      type: 'property',
      key: 'MAPBOX_DOWNLOADS_TOKEN',
      value: token,
    });
    return exported;
  });
};
