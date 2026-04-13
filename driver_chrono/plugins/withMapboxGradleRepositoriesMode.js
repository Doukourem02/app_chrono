/**
 * Expo SDK 54 : useExpoVersionCatalog() ouvre dependencyResolutionManagement. Gradle 8 résout
 * alors les deps via les dépôts « settings » ; le bloc Maven Mapbox dans build.gradle n’est pas
 * (ou mal) utilisé → « Could not find com.mapbox.maps:android ».
 *
 * On ajoute explicitement le dépôt Mapbox authentifié dans dependencyResolutionManagement.repositories
 * (fusionné avec la config Expo), en lisant le token depuis gradle.properties puis RNMAPBOX_MAPS_DOWNLOAD_TOKEN.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TAG_BEGIN = '// @generated begin mapbox-drm-maven - expo prebuild';
const TAG_END = '// @generated end mapbox-drm-maven';

const LEGACY_TAG_BEGIN = '// @generated begin mapbox-repositories-mode - expo prebuild';
const LEGACY_TAG_END = '// @generated end mapbox-repositories-mode';

const SNIPPET = `
${TAG_BEGIN}
dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
    maven {
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      def mapboxToken = ''
      try {
        def props = new Properties()
        def gf = new File(rootDir, 'gradle.properties')
        if (gf.exists()) {
          gf.withInputStream { props.load(it) }
        }
        mapboxToken = (props.getProperty('MAPBOX_DOWNLOADS_TOKEN') ?: '').toString().trim()
      } catch (Exception ignored) {
        mapboxToken = ''
      }
      if (!mapboxToken) {
        mapboxToken = (System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').toString().trim()
      }
      if (mapboxToken) {
        authentication { basic(BasicAuthentication) }
        credentials {
          username = 'mapbox'
          password = mapboxToken
        }
      }
    }
  }
}
${TAG_END}
`;

function stripBetween(contents, begin, end) {
  const start = contents.indexOf(begin);
  if (start === -1) return contents;
  const stop = contents.indexOf(end, start);
  if (stop === -1) return contents;
  const after = stop + end.length;
  return (contents.slice(0, start) + contents.slice(after)).replace(/\n{3,}/g, '\n\n');
}

function stripExistingBlocks(contents) {
  let out = contents;
  out = stripBetween(out, LEGACY_TAG_BEGIN, LEGACY_TAG_END);
  out = stripBetween(out, TAG_BEGIN, TAG_END);
  return out;
}

module.exports = function withMapboxGradleRepositoriesMode(config) {
  return withDangerousMod(config, [
    'android',
    (exported) => {
      const settingsPath = path.join(exported.modRequest.platformProjectRoot, 'settings.gradle');
      if (!fs.existsSync(settingsPath)) return exported;

      let contents = fs.readFileSync(settingsPath, 'utf8');
      contents = stripExistingBlocks(contents);

      const anchor = 'expoAutolinking.useExpoVersionCatalog()';
      const idx = contents.indexOf(anchor);
      if (idx === -1) return exported;

      const insertAt = idx + anchor.length;
      const next = contents.slice(0, insertAt) + SNIPPET + contents.slice(insertAt);
      fs.writeFileSync(settingsPath, next);
      return exported;
    },
  ]);
};
