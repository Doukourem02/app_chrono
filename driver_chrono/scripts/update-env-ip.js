#!/usr/bin/env node
/* eslint-env node */

/**
 * Script pour mettre à jour automatiquement l'IP locale dans le fichier .env
 * Usage: node scripts/update-env-ip.js
 * 
 * Ce script :
 * 1. Détecte votre IP locale actuelle
 * 2. Met à jour EXPO_PUBLIC_API_URL et EXPO_PUBLIC_SOCKET_URL dans le .env
 * 3. Préserve toutes les autres variables d'environnement
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // Chercher l'IP sur l'interface en0 (Ethernet) ou en1 (Wi-Fi) sur Mac
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorer les adresses internes et IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        // Préférer les interfaces actives (Wi-Fi, Ethernet)
        if (name.startsWith('en')) {
          return iface.address;
        }
      }
    }
  }
  
  // Fallback : prendre la première IP non-interne
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
}

function updateEnvFile(ip) {
  // Obtenir le chemin du dossier driver_chrono
  // process.cwd() retourne le répertoire depuis lequel le script est exécuté
  // Quand on fait "npm run update-ip", cwd est le dossier driver_chrono
  const projectRoot = process.cwd();
  const envPath = path.join(projectRoot, '.env');
  
  // Vérifier si le fichier existe
  if (!fs.existsSync(envPath)) {
    console.error('❌ Fichier .env non trouvé à:', envPath);
    console.log('💡 Créez d\'abord un fichier .env dans le dossier driver_chrono');
    process.exit(1);
  }
  
  // Lire le contenu actuel
  let content = fs.readFileSync(envPath, 'utf8');
  
  // Mettre à jour ou ajouter EXPO_PUBLIC_API_URL
  if (content.includes('EXPO_PUBLIC_API_URL=')) {
    content = content.replace(
      /EXPO_PUBLIC_API_URL=.*/g,
      `EXPO_PUBLIC_API_URL=http://${ip}:4000`
    );
  } else {
    content += `\nEXPO_PUBLIC_API_URL=http://${ip}:4000\n`;
  }
  
  // Mettre à jour ou ajouter EXPO_PUBLIC_SOCKET_URL
  if (content.includes('EXPO_PUBLIC_SOCKET_URL=')) {
    content = content.replace(
      /EXPO_PUBLIC_SOCKET_URL=.*/g,
      `EXPO_PUBLIC_SOCKET_URL=http://${ip}:4000`
    );
  } else {
    content += `\nEXPO_PUBLIC_SOCKET_URL=http://${ip}:4000\n`;
  }
  
  // Écrire le fichier mis à jour
  fs.writeFileSync(envPath, content, 'utf8');
  
  console.log('✅ Fichier .env mis à jour avec succès!');
  console.log(`📡 IP détectée: ${ip}`);
  console.log(`🔗 EXPO_PUBLIC_API_URL=http://${ip}:4000`);
  console.log(`🔗 EXPO_PUBLIC_SOCKET_URL=http://${ip}:4000`);
  console.log('\n💡 Redémarrez Expo (Ctrl+C puis npx expo start) pour appliquer les changements');
}

// Exécuter le script
const ip = getLocalIP();
console.log('🔍 Détection de l\'IP locale...\n');

if (ip === 'localhost') {
  console.warn('⚠️  Aucune IP locale trouvée, utilisation de localhost');
  console.warn('   Cela fonctionnera uniquement pour les simulateurs iOS/Android\n');
}

updateEnvFile(ip);

