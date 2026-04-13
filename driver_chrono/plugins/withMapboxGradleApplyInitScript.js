/**
 * Écrit android/mapbox-init.gradle et l’applique depuis settings.gradle (apply from:).
 * EAS n’inclut souvent pas les flags -I du gradleCommand dans l’invocation réelle de ./gradlew.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withSettingsGradle } = require('expo/config-plugins');

const APPLY_LINE = "apply from: 'mapbox-init.gradle'";

const MAPBOX_INIT_GRADLE = `import org.gradle.authentication.http.BasicAuthentication

/**
 * Chargé via apply from: dans settings.gradle (prébuild EAS).
 * Enregistre le dépôt Maven Mapbox avec Basic auth sur tous les projets.
 */
gradle.projectsLoaded {
  def root = gradle.rootProject
  def token = {
    def t = (System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').trim()
    if (t) return t
    t = (System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
    if (t) return t
    t = (System.getenv('ORG_GRADLE_PROJECT_MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
    if (t) return t
    try {
      def tf = new File(root.projectDir, '.mapbox_downloads_token')
      if (tf.exists()) {
        t = tf.getText('UTF-8').trim()
        if (t) return t
      }
    } catch (Exception ignored) {}
    try {
      def gf = new File(root.projectDir, 'gradle.properties')
      if (gf.exists()) {
        def props = new Properties()
        gf.withReader('UTF-8') { reader -> props.load(reader) }
        t = (props.getProperty('MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
        if (t) return t
      }
    } catch (Exception ignored) {}
    return ''
  }.call()

  if (!token || token.length() < 8) {
    throw new GradleException(
      '[driver_chrono] Secret Mapbox Maven vide. Définis RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk., DOWNLOADS:READ) ' +
      'dans EAS → Environment → production, puis rebuild. Une entrée MAPBOX_DOWNLOADS_TOKEN vide dans gradle.properties ne suffit pas.'
    )
  }

  gradle.rootProject.allprojects { proj ->
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
              password = token
            }
          }
        }
        filter {
          includeGroupByRegex 'com\\\\.mapbox.*'
        }
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
    let c = cfg.modResults.contents;
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
