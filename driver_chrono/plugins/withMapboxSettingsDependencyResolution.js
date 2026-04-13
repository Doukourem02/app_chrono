/**
 * Expo / RN 0.81 : pas de dependencyResolutionManagement dans settings.gradle par défaut.
 * Gradle 8 résout alors depuis les repos des sous-projets → message « ignoring the repositories
 * you have declared in the settings » et auth Mapbox fragile.
 *
 * On injecte dependencyResolutionManagement + PREFER_SETTINGS avec google / mavenCentral /
 * jitpack / Mapbox (Basic auth, token depuis les variables d’environnement du worker EAS).
 */
const { withSettingsGradle } = require('expo/config-plugins');

const INJECT_TAG = '// @krono dependencyResolutionManagement mapbox';

function injectDependencyResolutionManagement(contents) {
  if (contents.includes('dependencyResolutionManagement')) {
    return contents;
  }
  if (contents.includes(INJECT_TAG)) {
    return contents;
  }

  const anchor = '}\n\nextensions.configure(com.facebook.react.ReactSettingsExtension)';
  const idx = contents.indexOf(anchor);
  if (idx === -1) {
    return contents;
  }

  let c = contents;
  if (!c.includes('import org.gradle.authentication.http.BasicAuthentication')) {
    c = `import org.gradle.authentication.http.BasicAuthentication\n\n${c}`;
    // recalc idx after prepend
    const idx2 = c.indexOf(anchor);
    if (idx2 === -1) return contents;
    return patchAt(c, idx2);
  }
  return patchAt(c, idx);
}

function patchAt(c, idx) {
  const drm = `

${INJECT_TAG}
dependencyResolutionManagement {
    repositoriesMode.set(org.gradle.api.initialization.resolve.RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
        maven { url 'https://www.jitpack.io' }
        maven {
            url 'https://api.mapbox.com/downloads/v2/releases/maven'
            def e1 = (System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').trim()
            def e2 = (System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
            def e3 = (System.getenv('ORG_GRADLE_PROJECT_MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
            def mapboxSecret = e1 ?: e2 ?: e3
            metadataSources {
                mavenPom()
                artifact()
            }
            authentication {
                basic(BasicAuthentication)
            }
            credentials {
                username = 'mapbox'
                password = mapboxSecret
            }
        }
    }
}
`;
  return c.slice(0, idx + 1) + drm + c.slice(idx + 1);
}

module.exports = function withMapboxSettingsDependencyResolution(config) {
  return withSettingsGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    cfg.modResults.contents = injectDependencyResolutionManagement(cfg.modResults.contents);
    return cfg;
  });
};
