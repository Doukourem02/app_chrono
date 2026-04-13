/**
 * Sur EAS Build Android, s'assure que MAPBOX_DOWNLOADS_TOKEN est bien présent dans
 * android/gradle.properties juste avant ./gradlew (après prebuild / caches).
 * Gradle résout com.mapbox.maps sur api.mapbox.com avec ce secret ; sans ligne valide,
 * le bloc maven @rnmapbox n'envoie pas les credentials → « Could not find … ».
 */
const fs = require('fs');
const path = require('path');

function main() {
  if (process.env.EAS_BUILD !== 'true') return;
  const platform = (process.env.EAS_BUILD_PLATFORM || '').toLowerCase();
  if (platform && platform !== 'android') return;

  const token = (
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ||
    process.env.MAPBOX_DOWNLOADS_TOKEN ||
    ''
  )
    .toString()
    .trim();
  if (!token) return;

  const gradlePropsPath = path.join(__dirname, '..', 'android', 'gradle.properties');
  if (!fs.existsSync(gradlePropsPath)) return;

  const content = fs.readFileSync(gradlePropsPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter((line) => !/^\s*MAPBOX_DOWNLOADS_TOKEN\s*=/.test(line));
  filtered.push(`MAPBOX_DOWNLOADS_TOKEN=${token}`);
  const out = filtered.join('\n');
  fs.writeFileSync(gradlePropsPath, out.endsWith('\n') ? out : `${out}\n`);
}

main();
