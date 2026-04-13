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

/** Environnement d’abord : une ligne MAPBOX_DOWNLOADS_TOKEN vide dans gradle.properties ne doit pas masquer EAS. */
const RESOLVE_TOKEN_ROOT = `      def token = {
        def t = (System.getenv('RNMAPBOX_MAPS_DOWNLOAD_TOKEN') ?: '').trim()
        if (t) return t
        t = (System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
        if (t) return t
        t = (System.getenv('ORG_GRADLE_PROJECT_MAPBOX_DOWNLOADS_TOKEN') ?: '').trim()
        if (t) return t
        try {
          def tf = rootProject.file('.mapbox_downloads_token')
          if (tf.exists()) {
            t = tf.getText('UTF-8').trim()
            if (t) return t
          }
        } catch (Exception ignored) {}
        return (rootProject.findProperty('MAPBOX_DOWNLOADS_TOKEN') ?: '').toString().trim()
      }.call()
`;

const BLOCK = `      metadataSources {
        mavenPom()
        artifact()
      }
${RESOLVE_TOKEN_ROOT}
`;

const LEGACY_SUBPROJECT_HOOK_START = '// @generated begin mapbox-every-subproject-maven';
const LEGACY_SUBPROJECT_HOOK_END = '// @generated end mapbox-every-subproject-maven';

function stripLegacySubprojectMapboxHook(contents) {
  if (!contents.includes(LEGACY_SUBPROJECT_HOOK_START)) {
    return contents;
  }
  const start = contents.indexOf(LEGACY_SUBPROJECT_HOOK_START);
  const end = contents.indexOf(LEGACY_SUBPROJECT_HOOK_END, start);
  if (start === -1 || end === -1) {
    return contents;
  }
  const after = contents.slice(end + LEGACY_SUBPROJECT_HOOK_END.length).replace(/^\r?\n/, '');
  return contents.slice(0, start).replace(/\s+$/, '') + (after ? `\n\n${after}` : '');
}

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
    let next = cfg.modResults.contents;
    if (!next.includes('org.gradle.authentication.http.BasicAuthentication')) {
      next = `import org.gradle.authentication.http.BasicAuthentication\n\n${next}`;
    }
    next = stripLegacySubprojectMapboxHook(next);
    next = patchMapboxTokenBlock(next);
    cfg.modResults.contents = next;
    return cfg;
  });
};
