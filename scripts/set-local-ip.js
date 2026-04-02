#!/usr/bin/env node
/* eslint-env node */

/**
 * Met à jour l'IP de la machine dans tous les fichiers .env du projet.
 * Fonctionne pour simulateur iOS/Android ET appareil physique sur le même Wi-Fi.
 *
 * Usage: node scripts/set-local-ip.js
 * Depuis n'importe quel sous-dossier: node ../../scripts/set-local-ip.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function getLocalIP() {
  try {
    const interfaces = os.networkInterfaces();

    // Préférer en0 (Ethernet) ou en1 (Wi-Fi) sur Mac
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && name.startsWith('en')) {
          return iface.address;
        }
      }
    }

    // Fallback : première IP non-interne
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch {
    // Fallback si os.networkInterfaces() échoue (sandbox, etc.)
    try {
      const { execSync } = require('child_process');
      // Mac: ipconfig getifaddr en0 (Wi-Fi)
      let ip = '';
      try {
        ip = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
      } catch {
        ip = execSync("ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1", {
          encoding: 'utf8',
        }).trim();
      }
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
    } catch {}
  }

  return 'localhost';
}

function setOrReplace(content, key, value) {
  const line = `${key}=${value}`;
  if (content.includes(`${key}=`)) {
    return content.replace(new RegExp(`${key}=.*`, 'g'), line);
  }
  return content + (content.endsWith('\n') ? '' : '\n') + line + '\n';
}

function updateEnvFile(envPath, updates) {
  if (!fs.existsSync(envPath)) {
    return false;
  }
  let content = fs.readFileSync(envPath, 'utf8');
  for (const [key, value] of Object.entries(updates)) {
    content = setOrReplace(content, key, value);
  }
  fs.writeFileSync(envPath, content, 'utf8');
  return true;
}

function main() {
  const ip = getLocalIP();

  console.log('🔍 Détection de l\'IP locale...\n');

  if (ip === 'localhost') {
    console.warn('⚠️  Aucune IP locale trouvée, utilisation de localhost');
    console.warn('   Fonctionne uniquement pour les simulateurs.\n');
  } else {
    console.log(`📡 IP détectée: ${ip}\n`);
  }

  const apiUrl = `http://${ip}:4000`;
  const adminUrl = `http://${ip}:3000`;

  const updated = [];

  // driver_chrono
  const driverEnv = path.join(PROJECT_ROOT, 'driver_chrono', '.env');
  if (updateEnvFile(driverEnv, {
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_SOCKET_URL: apiUrl,
  })) {
    updated.push('driver_chrono/.env');
  }

  // app_chrono
  const appEnv = path.join(PROJECT_ROOT, 'app_chrono', '.env');
  if (updateEnvFile(appEnv, {
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_SOCKET_URL: apiUrl,
    EXPO_PUBLIC_TRACK_BASE_URL: adminUrl,
  })) {
    updated.push('app_chrono/.env');
  }

  // admin_chrono
  const adminEnv = path.join(PROJECT_ROOT, 'admin_chrono', '.env.local');
  const adminBase = path.join(PROJECT_ROOT, 'admin_chrono', '.env');
  const adminExample = path.join(PROJECT_ROOT, 'admin_chrono', '.env.local.example');
  if (!fs.existsSync(adminEnv)) {
    // Copier depuis .env (valeurs réelles) si dispo, sinon depuis l'exemple
    if (fs.existsSync(adminBase)) {
      fs.copyFileSync(adminBase, adminEnv);
    } else if (fs.existsSync(adminExample)) {
      fs.copyFileSync(adminExample, adminEnv);
    }
  }
  if (updateEnvFile(adminEnv, {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_SOCKET_URL: apiUrl,
    // Origine du navigateur pour Next.js (allowedDevOrigins + CSP ws:// en dev)
    NEXT_PUBLIC_DEV_ORIGIN: adminUrl,
    // IP seule : affichée par npm run dev (Next indique souvent 0.0.0.0 car -H 0.0.0.0)
    LAN_DEV_HOST: ip === 'localhost' ? '127.0.0.1' : ip,
  })) {
    updated.push('admin_chrono/.env.local');
  }

  if (updated.length > 0) {
    console.log('✅ Fichiers mis à jour:');
    updated.forEach((f) => console.log(`   - ${f}`));
    console.log(`\n🔗 API/Socket: ${apiUrl}`);
    console.log(`🔗 Admin (navigateur / téléphone): ${adminUrl}`);
    console.log('\n💡 Redémarrez les apps pour appliquer les changements.');
  } else {
    console.log('ℹ️  Aucun fichier .env trouvé à mettre à jour.');
    console.log('   Créez .env dans driver_chrono et app_chrono, .env.local dans admin_chrono.');
  }
}

main();
