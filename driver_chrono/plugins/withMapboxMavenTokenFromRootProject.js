/**
 * Renforce le bloc Maven @rnmapbox : token depuis .mapbox_downloads_token (EAS), puis gradle.properties / env.
 *
 * @rnmapbox/maps change parfois la ligne `def token = …` (plusieurs variantes). On remplace tout le bloc
 * entre l’URL Mapbox et `if (token) {` pour ne pas dépendre d’une chaîne exacte.
 *
 * Même mod `projectBuildGradle` que @rnmapbox/maps : dans app.config.js ce plugin doit être listé *avant*
 * @rnmapbox/maps pour que le patch s’applique après l’injection du dépôt.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

const MAPBOX_MAVEN_MARKER = "url 'https://api.mapbox.com/downloads/v2/releases/maven'";

const BLOCK = `      def token = ''
      try {
        def tf = rootProject.file('.mapbox_downloads_token')
        if (tf.exists()) {
          token = tf.getText('UTF-8').trim()
        }
      } catch (Exception ignored) {
        token = ''
      }
      if (!token) {
        token = (rootProject.findProperty('MAPBOX_DOWNLOADS_TOKEN') ?: System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: '').toString().trim()
      }
`;

function patchMapboxTokenBlock(contents) {
  if (!contents.includes(MAPBOX_MAVEN_MARKER)) {
    return contents;
  }
  const start = contents.indexOf(MAPBOX_MAVEN_MARKER);
  const lineEnd = contents.indexOf('\n', start);
  if (lineEnd === -1) {
    return contents;
  }
  const afterUrl = lineEnd + 1;
  const searchRegion = contents.slice(afterUrl);
  const m = searchRegion.match(/\s*if\s*\(\s*token\s*\)\s*\{/);
  if (!m || m.index === undefined) {
    return contents;
  }
  const credStart = afterUrl + m.index;
  return contents.slice(0, afterUrl) + BLOCK + contents.slice(credStart);
}

module.exports = function withMapboxMavenTokenFromRootProject(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    cfg.modResults.contents = patchMapboxTokenBlock(cfg.modResults.contents);
    return cfg;
  });
};
