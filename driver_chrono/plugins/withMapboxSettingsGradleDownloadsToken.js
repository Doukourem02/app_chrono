/**
 * Bloc mapbox-drm-maven (Fleetbase / Expo) : on réinjecte le token (fichier, gradle.properties, env).
 *
 * Ne pas passer en PREFER_PROJECT : avec ce mode, Gradle **ignore** les dépôts de `settings.gradle`
 * et résout depuis les `repositories {}` des sous-projets — souvent sans credentials Mapbox →
 * « Could not find com.mapbox.maps:android:… » malgré un token EAS valide.
 * Garder PREFER_SETTINGS (défaut Expo) pour que le dépôt Mapbox authentifié du settings soit utilisé.
 */
const { withSettingsGradle } = require('expo/config-plugins');

const MAPBOX_MAVEN_MARKER = "url 'https://api.mapbox.com/downloads/v2/releases/maven'";

const TOKEN_BLOCK = `      def mapboxToken = ''
      // 1) Fichier écrit par eas-build-post-install (fiable sur EAS ; pas besoin de providers dans ce closure).
      try {
        def tf = new File(rootDir, '.mapbox_downloads_token')
        if (tf.exists()) {
          mapboxToken = tf.getText('UTF-8').trim()
        }
      } catch (Exception ignored) {
        mapboxToken = ''
      }
      // 2) Propriété Gradle (gradle.properties, -P, ORG_GRADLE_PROJECT_*)
      if (!mapboxToken) {
        try {
          mapboxToken = settings.providers.gradleProperty('MAPBOX_DOWNLOADS_TOKEN').getOrElse('').toString().trim()
        } catch (Exception ignored) {
          mapboxToken = ''
        }
      }
      // 3) gradle.properties brut (UTF-8)
      if (!mapboxToken) {
        try {
          def props = new Properties()
          def gf = new File(rootDir, 'gradle.properties')
          if (gf.exists()) {
            gf.withReader('UTF-8') { reader -> props.load(reader) }
          }
          mapboxToken = (props.getProperty('MAPBOX_DOWNLOADS_TOKEN') ?: '').toString().trim()
        } catch (Exception ignored) {
          mapboxToken = ''
        }
      }
      if (!mapboxToken) {
        mapboxToken = (System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').toString().trim()
      }
      if (!mapboxToken) {
        mapboxToken = (System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: '').toString().trim()
      }
`;

function patchSettingsGradle(contents) {
  if (!contents.includes(MAPBOX_MAVEN_MARKER)) {
    return contents;
  }
  const start = contents.indexOf(MAPBOX_MAVEN_MARKER);
  const lineEnd = contents.indexOf('\n', start);
  if (lineEnd === -1) return contents;
  const afterUrl = lineEnd + 1;
  const rest = contents.slice(afterUrl);
  const credMatch = rest.match(/^\s*if\s*\(\s*mapboxToken\s*\)\s*\{/m);
  if (!credMatch || credMatch.index === undefined) {
    return contents;
  }
  const credStart = afterUrl + credMatch.index;
  return contents.slice(0, afterUrl) + TOKEN_BLOCK + contents.slice(credStart);
}

module.exports = function withMapboxSettingsGradleDownloadsToken(config) {
  return withSettingsGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    cfg.modResults.contents = patchSettingsGradle(cfg.modResults.contents);
    return cfg;
  });
};
