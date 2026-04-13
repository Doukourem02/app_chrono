/**
 * Sur EAS Build Android, com.mapbox.maps:* est résolu sur api.mapbox.com — sans secret DOWNLOADS:READ,
 * Gradle échoue avec « Could not find com.mapbox.maps:android:… ».
 */
module.exports = function withRequireMapboxDownloadsTokenAndroid(config) {
  const isEasAndroid =
    process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android';
  if (!isEasAndroid) {
    return config;
  }
  const token =
    (process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN || process.env.MAPBOX_DOWNLOADS_TOKEN || '').trim();
  if (!token) {
    throw new Error(
      '[driver_chrono] Variable manquante : RNMAPBOX_MAPS_DOWNLOAD_TOKEN (ou MAPBOX_DOWNLOADS_TOKEN). ' +
        'Crée un token secret Mapbox (sk.…) avec le scope DOWNLOADS:READ, puis expo.dev → projet driver_chrono → ' +
        'Environment variables → environnement production → ajoute RNMAPBOX_MAPS_DOWNLOAD_TOKEN (Sensitive). ' +
        'Sans cela, Gradle ne peut pas télécharger com.mapbox.maps sur le Maven Mapbox.'
    );
  }
  return config;
};
