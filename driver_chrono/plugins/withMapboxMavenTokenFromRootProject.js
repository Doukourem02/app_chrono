/**
 * Renforce le bloc Maven @rnmapbox : token depuis gradle.properties, env, puis fichier
 * .mapbox_downloads_token (écrit sur EAS par eas-build-post-install).
 *
 * Important : même mod `projectBuildGradle` que @rnmapbox/maps. Dans app.config.js ce plugin doit
 * être listé *avant* @rnmapbox/maps : le plugin enregistré en dernier s’exécute en premier sur le
 * fichier ; on veut s’exécuter après l’ajout du dépôt Maven pour remplacer la ligne `token = …`.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

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
      }`;

function patchMapboxTokenBlock(contents) {
  const legacy =
    "def token = project.properties['MAPBOX_DOWNLOADS_TOKEN'] ?: System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN')";
  const prev =
    "def token = (rootProject.findProperty('MAPBOX_DOWNLOADS_TOKEN') ?: System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').toString().trim()";

  if (contents.includes(legacy)) {
    return contents.replace(legacy, BLOCK.trim());
  }
  if (contents.includes(prev)) {
    return contents.replace(prev, BLOCK.trim());
  }
  return contents;
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
