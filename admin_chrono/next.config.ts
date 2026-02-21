import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration des images pour autoriser les domaines externes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  // Configuration pour permettre les requêtes cross-origin en développement
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['http://192.168.1.85:3000', 'http://localhost:3000', 'http://192.168.1.91:3000'],
  }),
  
  // Configuration pour réduire les problèmes de HMR (Hot Module Replacement)
  ...(process.env.NODE_ENV === 'development' && {
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        // Réduire les tentatives de reconnexion du HMR
        config.watchOptions = {
          ...config.watchOptions,
          poll: false, // Désactiver le polling pour éviter les problèmes
          aggregateTimeout: 300, // Attendre 300ms avant de recompiler
          ignored: ['**/node_modules', '**/.git', '**/.next'], // Ignorer les dossiers qui changent souvent
        }
        
        // Désactiver le HMR si DISABLE_HMR est défini
        if (process.env.DISABLE_HMR === 'true') {
          config.optimization = {
            ...config.optimization,
            minimize: false,
          }
        }
      }
      return config
    },
    // Configuration Turbopack vide pour éviter l'erreur avec Next.js 16
    // (on utilise webpack via le flag --webpack dans package.json)
    turbopack: {},
    // Désactiver les indicateurs de développement qui peuvent causer des problèmes
    devIndicators: false,
  }),
  async headers() {
    // En développement, on désactive les headers qui forcent HTTPS
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin'
      },
    ]

    // Headers uniquement en production (forcent HTTPS)
    if (!isDevelopment) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      })
    }

    // Extraire l'URL de l'API depuis les variables d'environnement
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    
    // Construire les directives connect-src pour l'API backend
    const connectSrcDirectives = [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://api.mapbox.com",
      "https://events.mapbox.com",
      "https://*.tiles.mapbox.com",
      "https://nominatim.openstreetmap.org",
    ]

    // En dev uniquement: autoriser localhost / réseau local pour API & sockets
    if (isDevelopment) {
      connectSrcDirectives.push(
        "http://localhost:*",
        "ws://localhost:*",
        "wss://localhost:*"
      )
    }
    
    // Ajouter l'URL de l'API backend si elle n'est pas localhost
    if (apiUrl && !apiUrl.includes('localhost')) {
      try {
        const apiUrlObj = new URL(apiUrl)
        const apiHost = `${apiUrlObj.protocol}//${apiUrlObj.host}`
        connectSrcDirectives.push(apiHost)
        
        // Ajouter aussi les versions WebSocket
        if (apiUrlObj.protocol === 'http:') {
          connectSrcDirectives.push(apiHost.replace('http://', 'ws://'))
        } else if (apiUrlObj.protocol === 'https:') {
          connectSrcDirectives.push(apiHost.replace('https://', 'wss://'))
        }
      } catch (e) {
        // Si l'URL n'est pas valide, on continue sans l'ajouter
        console.warn('Invalid API URL in CSP configuration:', apiUrl)
      }
    }
    
    // CSP avec ou sans upgrade-insecure-requests selon l'environnement
    const cspDirectives = [
      "default-src 'self'",
      // En prod: on retire 'unsafe-eval' (utile surtout en dev). On garde 'unsafe-inline' car Next.js émet
      // des scripts inline sans nonce/hashes configurés dans ce projet.
      `script-src 'self' ${isDevelopment ? "'unsafe-eval' " : ''}'unsafe-inline' https://api.mapbox.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob: https://api.mapbox.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src ${connectSrcDirectives.join(' ')}`,
      "frame-src 'self' https://api.mapbox.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ]

    // Ajouter upgrade-insecure-requests uniquement en production
    if (!isDevelopment) {
      cspDirectives.push("upgrade-insecure-requests")
    }

    securityHeaders.push({
      key: 'Content-Security-Policy',
      value: cspDirectives.join('; ')
    })

    return [
      {
        // Appliquer les headers de sécurité à toutes les routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
