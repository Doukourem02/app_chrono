/**
 * Expo SDK 54 : expoAutolinking.useExpoVersionCatalog() configure dependencyResolutionManagement
 * (catalogue de versions). Gradle 8 utilise alors un mode où les dépôts déclarés dans les
 * sous-projets / build.gradle (dont le Maven Mapbox avec token) ne sont plus utilisés pour
 * résoudre les dépendances → « Could not find com.mapbox.maps:android » malgré un sk. valide.
 *
 * PREFER_PROJECT réactive la prise en compte des allprojects.repositories du root build.gradle
 * (bloc @rnmapbox/maps-v2-maven).
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TAG_BEGIN = '// @generated begin mapbox-repositories-mode - expo prebuild';
const TAG_END = '// @generated end mapbox-repositories-mode';

const SNIPPET = `
${TAG_BEGIN}
dependencyResolutionManagement {
  repositoriesMode.set(org.gradle.api.initialization.resolve.RepositoriesMode.PREFER_PROJECT)
}
${TAG_END}
`;

function stripExistingMapboxBlock(contents) {
  const start = contents.indexOf(TAG_BEGIN);
  if (start === -1) return contents;
  const end = contents.indexOf(TAG_END, start);
  if (end === -1) return contents;
  const after = end + TAG_END.length;
  return (contents.slice(0, start) + contents.slice(after)).replace(/\n{3,}/g, '\n\n');
}

module.exports = function withMapboxGradleRepositoriesMode(config) {
  return withDangerousMod(config, [
    'android',
    (exported) => {
      const settingsPath = path.join(exported.modRequest.platformProjectRoot, 'settings.gradle');
      if (!fs.existsSync(settingsPath)) return exported;

      let contents = fs.readFileSync(settingsPath, 'utf8');
      contents = stripExistingMapboxBlock(contents);

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
