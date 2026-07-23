/**
 * Écrit uniquement `android/.mapbox_downloads_token` pendant le prebuild (withDangerousMod).
 *
 * `MAPBOX_DOWNLOADS_TOKEN` dans `gradle.properties` est déjà géré par
 * `withRequireMapboxDownloadsTokenAndroid` (withGradleProperties) — ne pas réécrire ce fichier ici :
 * selon l’ordre d’exécution du prebuild, on pourrait écraser un `gradle.properties` pas encore fusionné.
 *
 * Les blocs Groovy (withMapboxSettingsGradleDownloadsToken, etc.) lisent d’abord ce fichier.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

function getToken() {
  return (
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ||
    process.env.MAPBOX_DOWNLOADS_TOKEN ||
    ''
  )
    .toString()
    .trim();
}

module.exports = function withMapboxAndroidDownloadsTokenFile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const token = getToken();
      const androidRoot = cfg.modRequest.platformProjectRoot;
      if (!token || !androidRoot || !fs.existsSync(androidRoot)) {
        return cfg;
      }

      fs.writeFileSync(path.join(androidRoot, '.mapbox_downloads_token'), token, 'utf8');

      return cfg;
    },
  ]);
};
