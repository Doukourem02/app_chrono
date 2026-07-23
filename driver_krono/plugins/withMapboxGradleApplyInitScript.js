/**
 * Écrit android/mapbox-init.gradle et l’applique depuis settings.gradle (apply from:).
 * EAS n’inclut souvent pas les flags -I du gradleCommand dans l’invocation réelle de ./gradlew.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withSettingsGradle } = require('expo/config-plugins');

const APPLY_LINE = "apply from: 'mapbox-init.gradle'";
const DRM_TAG = '// @krono dependencyResolutionManagement mapbox';

/** Ancien plugin retiré : supprimer le bloc DRM du settings pour éviter PREFER_* + conflits Expo / rnmapbox. */
function stripKronoDependencyResolutionManagement(contents) {
  const i = contents.indexOf(DRM_TAG);
  if (i === -1) {
    return contents;
  }
  const braceStart = contents.indexOf('dependencyResolutionManagement', i);
  if (braceStart === -1) {
    return contents;
  }
  const open = contents.indexOf('{', braceStart);
  if (open === -1) {
    return contents;
  }
  let depth = 0;
  let j = open;
  for (; j < contents.length; j++) {
    const c = contents[j];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  let end = j;
  while (end < contents.length && /[\s\r\n]/.test(contents[end])) {
    end++;
  }
  const before = contents.slice(0, i).replace(/\s+$/, '');
  const after = contents.slice(end).replace(/^\s+/, '');
  return `${before}\n\n${after}`;
}

function stripOrphanBasicAuthImportInSettings(contents) {
  const imp = 'import org.gradle.authentication.http.BasicAuthentication';
  if (!contents.startsWith(imp)) {
    return contents;
  }
  const rest = contents.slice(imp.length).replace(/^\r?\n+/, '');
  if (rest.includes('BasicAuthentication')) {
    return contents;
  }
  return rest;
}

const MAPBOX_INIT_GRADLE = `import org.gradle.authentication.http.BasicAuthentication

/**
 * apply from: settings.gradle — enregistre le listener tout de suite (avant la config des sous-projets).
 * projectsLoaded + allprojects arrive trop tard / est fragile avec dependencyResolutionManagement : :rnmapbox_maps
 * déclare ses propres repos → Gradle ignore les dépôts du settings pour cette config.
 */
def mapboxToken = {
  def t = (System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').trim()
  if (t) return t
  t = (System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
  if (t) return t
  t = (System.getenv('ORG_GRADLE_PROJECT_MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
  if (t) return t
  try {
    def tf = new File(rootDir, '.mapbox_downloads_token')
    if (tf.exists()) {
      t = tf.getText('UTF-8').trim()
      if (t) return t
    }
  } catch (Exception ignored) {}
  try {
    def gf = new File(rootDir, 'gradle.properties')
    if (gf.exists()) {
      def props = new Properties()
      gf.withReader('UTF-8') { reader -> props.load(reader) }
      t = (props.getProperty('MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
      if (t) return t
    }
  } catch (Exception ignored) {}
  return ''
}.call()

if (!mapboxToken || mapboxToken.length() < 8) {
  throw new GradleException(
    '[driver_chrono] Secret Mapbox Maven vide. Définis RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk., DOWNLOADS:READ) ' +
    'dans EAS → Environment → production, puis rebuild. Une entrée MAPBOX_DOWNLOADS_TOKEN vide dans gradle.properties ne suffit pas.'
  )
}

gradle.beforeProject { proj ->
  proj.repositories {
    exclusiveContent {
      forRepository {
        maven {
          url 'https://api.mapbox.com/downloads/v2/releases/maven'
          metadataSources {
            mavenPom()
            artifact()
          }
          authentication { basic(BasicAuthentication) }
          credentials {
            username = 'mapbox'
            password = mapboxToken
          }
        }
      }
      filter {
        includeGroupByRegex 'com\\\\.mapbox.*'
      }
    }
  }
}
`;

function withWriteMapboxInitFile(config) {
  return withDangerousMod(config, [
    'android',
    (exported) => {
      const out = path.join(exported.modRequest.platformProjectRoot, 'mapbox-init.gradle');
      fs.writeFileSync(out, MAPBOX_INIT_GRADLE, 'utf8');
      return exported;
    },
  ]);
}

function withApplyMapboxInitInSettings(config) {
  return withSettingsGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    let c = stripKronoDependencyResolutionManagement(cfg.modResults.contents);
    c = stripOrphanBasicAuthImportInSettings(c);
    if (!c.includes(APPLY_LINE)) {
      c = `${c.trimEnd()}\n\n${APPLY_LINE}\n`;
    }
    cfg.modResults.contents = c;
    return cfg;
  });
}

module.exports = function withMapboxGradleApplyInitScript(config) {
  config = withWriteMapboxInitFile(config);
  config = withApplyMapboxInitInSettings(config);
  return config;
};
