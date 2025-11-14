import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour permettre les requêtes cross-origin en développement
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['http://192.168.1.85:3000', 'http://localhost:3000'],
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

    // CSP avec ou sans upgrade-insecure-requests selon l'environnement
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' http://localhost:* http://192.168.*:* https://*.supabase.co https://maps.googleapis.com wss://*.supabase.co",
      "frame-src 'self' https://maps.googleapis.com",
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
