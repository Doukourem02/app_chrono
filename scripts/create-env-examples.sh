#!/bin/bash

# Script pour créer les fichiers .env.example dans tous les projets

echo "📝 Création des fichiers .env.example..."

# Backend
cat > chrono_backend/.env.example << 'EOF'
# ============================================
# CHRONO BACKEND - Variables d'Environnement
# ============================================
# Copiez ce fichier vers .env et remplissez les valeurs

# ============================================
# ENVIRONNEMENT
# ============================================
NODE_ENV=production
PORT=4000

# ============================================
# SÉCURITÉ (CRITIQUE)
# ============================================
# ⚠️ IMPORTANT: Générer un secret fort (min 32 caractères)
# Utilisez: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# Forcer HTTPS en production
FORCE_HTTPS=true
PROXY_ENABLED=true

# ============================================
# BASE DE DONNÉES
# ============================================
# Option 1: PostgreSQL direct
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option 2: Supabase (recommandé)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# ============================================
# CORS - Origines autorisées
# ============================================
# Séparer par des virgules, sans espaces
ALLOWED_ORIGINS=https://admin.yourdomain.com,https://app.yourdomain.com,https://driver.yourdomain.com

# ============================================
# MONITORING & LOGGING
# ============================================
# Sentry pour le monitoring d'erreurs
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Slack pour les alertes (optionnel)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Niveau de log (error, warn, info, debug)
LOG_LEVEL=info

# ============================================
# EMAIL (Optionnel - Nodemailer)
# ============================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-email-password
EMAIL_FROM=noreply@yourdomain.com

# ============================================
# SMS (Optionnel - Vonage/Nexmo)
# ============================================
VONAGE_API_KEY=your-vonage-api-key
VONAGE_API_SECRET=your-vonage-api-secret
VONAGE_FROM=YourAppName

# ============================================
# SWAGGER (Documentation API)
# ============================================
# Activer Swagger en production (déconseillé)
SWAGGER_ENABLED=false

# ============================================
# DEBUG (Développement uniquement)
# ============================================
# Activer les logs de debug Socket.IO
DEBUG_SOCKETS=false
EOF

# Admin
cat > admin_chrono/.env.local.example << 'EOF'
# ============================================
# ADMIN CHRONO - Variables d'Environnement
# ============================================
# Copiez ce fichier vers .env.local et remplissez les valeurs

# ============================================
# SUPABASE
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ============================================
# API BACKEND
# ============================================
# URL de l'API backend (sans trailing slash)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# URL du serveur WebSocket (peut être la même que l'API)
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com

# ============================================
# MAPBOX
# ============================================
# Token Mapbox pour les cartes
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-access-token
EOF

# App Client
cat > app_chrono/.env.example << 'EOF'
# ============================================
# APP CHRONO (Client) - Variables d'Environnement
# ============================================
# Copiez ce fichier vers .env et remplissez les valeurs
# Note: Expo utilise le préfixe EXPO_PUBLIC_ pour les variables publiques

# ============================================
# API BACKEND
# ============================================
# URL de l'API backend (sans trailing slash)
EXPO_PUBLIC_API_URL=https://api.yourdomain.com

# URL du serveur WebSocket (peut être la même que l'API)
EXPO_PUBLIC_SOCKET_URL=https://api.yourdomain.com

# ============================================
# SUPABASE
# ============================================
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ============================================
# MAPBOX
# ============================================
# Token Mapbox pour les cartes
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-access-token

# ============================================
# SENTRY (Optionnel)
# ============================================
# DSN Sentry pour le monitoring d'erreurs
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
EOF

# Driver
cat > driver_chrono/.env.example << 'EOF'
# ============================================
# DRIVER CHRONO (Chauffeur) - Variables d'Environnement
# ============================================
# Copiez ce fichier vers .env et remplissez les valeurs
# Note: Expo utilise le préfixe EXPO_PUBLIC_ pour les variables publiques

# ============================================
# API BACKEND
# ============================================
# URL de l'API backend (sans trailing slash)
EXPO_PUBLIC_API_URL=https://api.yourdomain.com

# URL du serveur WebSocket (peut être la même que l'API)
EXPO_PUBLIC_SOCKET_URL=https://api.yourdomain.com

# ============================================
# SUPABASE
# ============================================
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ============================================
# MAPBOX
# ============================================
# Token Mapbox pour les cartes
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-access-token

# ============================================
# SENTRY (Optionnel)
# ============================================
# DSN Sentry pour le monitoring d'erreurs
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# ============================================
# BETTER STACK / LOGTAIL (Optionnel — logs navigation app livreur)
# ============================================
# Créer une source dédiée dans Better Stack ; le token est public (embarqué dans l'app).
# EXPO_PUBLIC_BETTER_STACK_SOURCE_TOKEN=...
EOF

echo "✅ Fichiers .env.example créés avec succès!"
echo ""
echo "📋 Fichiers créés:"
echo "  - chrono_backend/.env.example"
echo "  - admin_chrono/.env.local.example"
echo "  - app_chrono/.env.example"
echo "  - driver_chrono/.env.example"
echo ""
echo "⚠️  N'oubliez pas de:"
echo "  1. Copier chaque fichier vers .env (ou .env.local pour admin_chrono)"
echo "  2. Remplir toutes les variables avec vos valeurs réelles"
echo "  3. Ne jamais commiter les fichiers .env dans Git"

