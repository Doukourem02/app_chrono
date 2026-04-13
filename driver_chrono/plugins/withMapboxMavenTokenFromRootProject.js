/**
 * Renforce le bloc Maven @rnmapbox : token depuis gradle.properties, env, puis fichier
 * .mapbox_downloads_token (écrit sur EAS par eas-build-post-install).
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BLOCK = `      def token = (rootProject.findProperty('MAPBOX_DOWNLOADS_TOKEN') ?: System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: '').toString().trim()
      if (!token) {
        def tf = rootProject.file('.mapbox_downloads_token')
        if (tf.exists()) {
          try {
            token = tf.getText('UTF-8').trim()
          } catch (Exception ignored) {
            token = ''
          }
        }
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
  if (contents.includes("@rnmapbox/maps-v2-maven") && !contents.includes('.mapbox_downloads_token')) {
    return contents.replace(prev, BLOCK.trim());
  }
  return contents;
}

module.exports = function withMapboxMavenTokenFromRootProject(config) {
  return withDangerousMod(config, [
    'android',
    (exported) => {
      const buildGradle = path.join(exported.modRequest.platformProjectRoot, 'build.gradle');
      if (!fs.existsSync(buildGradle)) return exported;
      let contents = fs.readFileSync(buildGradle, 'utf8');
      const next = patchMapboxTokenBlock(contents);
      if (next !== contents) {
        fs.writeFileSync(buildGradle, next);
      }
      return exported;
    },
  ]);
};
