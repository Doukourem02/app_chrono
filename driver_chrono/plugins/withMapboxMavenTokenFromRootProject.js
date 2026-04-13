/**
 * Le bloc maven généré par @rnmapbox/maps utilise project.properties dans une closure
 * imbriquée ; avec Gradle 8.x, rootProject.findProperty est plus fiable pour lire
 * MAPBOX_DOWNLOADS_TOKEN (gradle.properties + ORG_GRADLE_PROJECT_*).
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NEEDLE =
  "def token = project.properties['MAPBOX_DOWNLOADS_TOKEN'] ?: System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN')";
const REPLACEMENT =
  "def token = (rootProject.findProperty('MAPBOX_DOWNLOADS_TOKEN') ?: System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').toString().trim()";

module.exports = function withMapboxMavenTokenFromRootProject(config) {
  return withDangerousMod(config, [
    'android',
    (exported) => {
      const buildGradle = path.join(exported.modRequest.platformProjectRoot, 'build.gradle');
      if (!fs.existsSync(buildGradle)) return exported;
      let contents = fs.readFileSync(buildGradle, 'utf8');
      if (contents.includes(NEEDLE)) {
        contents = contents.replace(NEEDLE, REPLACEMENT);
        fs.writeFileSync(buildGradle, contents);
      }
      return exported;
    },
  ]);
};
