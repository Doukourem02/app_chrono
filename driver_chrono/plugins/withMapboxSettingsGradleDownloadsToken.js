/**
 * Avec dependencyResolutionManagement + PREFER_SETTINGS (bloc mapbox-drm-maven / Expo),
 * seul settings.gradle sert à résoudre com.mapbox.maps. Le root build.gradle est ignoré.
 * On réinjecte ici : providers.gradleProperty, gradle.properties en UTF-8, env, .mapbox_downloads_token.
 */
const { withSettingsGradle } = require('expo/config-plugins');

const MAPBOX_MAVEN_MARKER = "url 'https://api.mapbox.com/downloads/v2/releases/maven'";

const TOKEN_BLOCK = `      def mapboxToken = ''
      try {
        mapboxToken = providers.gradleProperty('MAPBOX_DOWNLOADS_TOKEN').getOrElse('').toString().trim()
      } catch (Exception ignored) {
        mapboxToken = ''
      }
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
      if (!mapboxToken) {
        def tf = new File(rootDir, '.mapbox_downloads_token')
        if (tf.exists()) {
          try {
            mapboxToken = tf.getText('UTF-8').trim()
          } catch (Exception ignored) {
            mapboxToken = ''
          }
        }
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
