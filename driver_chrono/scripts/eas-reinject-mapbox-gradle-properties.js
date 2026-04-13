/**
 * EAS Android : réinjecte le secret Mapbox avant ./gradlew.
 * - MAPBOX_DOWNLOADS_TOKEN dans gradle.properties
 * - android/.mapbox_downloads_token (fallback lu par build.gradle, contourne soucis de parsing)
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

  const androidDir = path.join(__dirname, '..', 'android');
  if (!fs.existsSync(androidDir)) return;

  const gradlePropsPath = path.join(androidDir, 'gradle.properties');
  if (fs.existsSync(gradlePropsPath)) {
    const content = fs.readFileSync(gradlePropsPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const filtered = lines.filter((line) => !/^\s*MAPBOX_DOWNLOADS_TOKEN\s*=/.test(line));
    filtered.push(`MAPBOX_DOWNLOADS_TOKEN=${token}`);
    const out = filtered.join('\n');
    fs.writeFileSync(gradlePropsPath, out.endsWith('\n') ? out : `${out}\n`);
  }

  fs.writeFileSync(path.join(androidDir, '.mapbox_downloads_token'), token, 'utf8');
}

main();
