#!/usr/bin/env node

/**
 * Script pour obtenir l'adresse IP locale du Mac
 * Usage: node scripts/get-local-ip.js
 */

const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // Chercher l'IP sur l'interface en0 (Ethernet) ou en1 (Wi-Fi) sur Mac
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorer les adresses internes et IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        // Préférer les interfaces actives (Wi-Fi, Ethernet)
        if (name.startsWith('en') || name.startsWith('eth')) {
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

const ip = getLocalIP();
console.log(ip);

