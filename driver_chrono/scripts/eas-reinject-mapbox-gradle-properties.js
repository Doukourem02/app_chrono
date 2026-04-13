/**
 * EAS Android : réinjecte le secret Mapbox avant ./gradlew (si `android/` existe déjà).
 * - MAPBOX_DOWNLOADS_TOKEN dans gradle.properties
 * - android/.mapbox_downloads_token (fallback lu par build.gradle, contourne soucis de parsing)
 *
 * Sur le cloud EAS, `eas-build-post-install` tourne avant `expo prebuild` : souvent pas de dossier
 * `android/` → no-op. Le prebuild applique `withMapboxAndroidDownloadsTokenFile` + withGradleProperties.
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

/**
 * Contrôle optionnel : ne doit pas faire échouer le build (Gradle reste la vérité).
 * Mapbox renvoie souvent 404 pour les accès refusés ; Gradle peut quand même résoudre selon le contexte.
 */
function verifyMapboxMavenAccessOptional(token) {
  return new Promise((resolve) => {
    const url =
      'https://api.mapbox.com/downloads/v2/releases/maven/com/mapbox/maps/android/10.19.4/android-10.19.4.pom';
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`mapbox:${token}`).toString('base64')}`,
        },
        timeout: 15000,
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.error('[eas-reinject-mapbox] Vérification HTTP optionnelle : OK (200)');
          } else {
            console.warn(
              `[eas-reinject-mapbox] Vérification HTTP optionnelle : HTTP ${res.statusCode} (non bloquant). ` +
                'Sur le dépôt Mapbox, 401/403/404 indiquent souvent un token sans DOWNLOADS:READ ou un mauvais compte. ' +
                'Si Gradle échoue ensuite sur com.mapbox.maps, régénère le secret sk. et les variables Expo.'
            );
          }
          resolve();
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      console.warn(
        '[eas-reinject-mapbox] Vérification HTTP optionnelle : timeout (non bloquant).'
      );
      resolve();
    });
    req.on('error', (err) => {
      console.warn(
        `[eas-reinject-mapbox] Vérification HTTP optionnelle : ${err.message} (non bloquant).`
      );
      resolve();
    });
    req.end();
  });
}

async function main() {
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
  const content = fs.existsSync(gradlePropsPath) ? fs.readFileSync(gradlePropsPath, 'utf8') : '';
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter((line) => !/^\s*MAPBOX_DOWNLOADS_TOKEN\s*=/.test(line));
  filtered.push(`MAPBOX_DOWNLOADS_TOKEN=${token}`);
  const out = filtered.join('\n');
  fs.writeFileSync(gradlePropsPath, out.endsWith('\n') ? out : `${out}\n`);

  fs.writeFileSync(path.join(androidDir, '.mapbox_downloads_token'), token, 'utf8');

  console.error(
    `[eas-reinject-mapbox] android/ prêt : MAPBOX_DOWNLOADS_TOKEN + .mapbox_downloads_token (longueur ${token.length})`
  );

  await verifyMapboxMavenAccessOptional(token);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
