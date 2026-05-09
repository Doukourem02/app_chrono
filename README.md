# 🚚 Chrono Livraison – Monorepo

Plateforme de livraison en temps réel connectant clients, chauffeurs **et administrateurs**. Ce dépôt rassemble :

- `chrono_backend/` → API REST + Socket.IO
- `admin_chrono/` → Dashboard web (Next.js 16 / React 19)
- `app_chrono/` → App mobile client (Expo / React Native)
- `driver_chrono/` → App mobile chauffeur (Expo / React Native)

```
PROJET_KRONO/
├── chrono_backend/
├── admin_chrono/
├── app_chrono/
├── driver_chrono/
├── docs/                 # Docs vivants : actions + référence projet
├── supabase/             # SQL / RLS (selon usage)
├── scripts/              # IP locale, utilitaires repo
└── README.md
```

---

## 📋 Sommaire

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation rapide](#installation-rapide)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Structure du projet](#structure-du-projet)
- [Documentation API](#documentation-api)
- [Technologies](#technologies)
- [Dépannage](#dépannage)

---

## 🏗️ Architecture

| Composant         | Stack                                     | Description                                              |
| ----------------- | ----------------------------------------- | -------------------------------------------------------- |
| `chrono_backend/` | Node.js + Express + Socket.IO             | API REST, WebSocket, migrations SQL                      |
| `admin_chrono/`   | Next.js 16, React Query, Socket.IO client | Dashboard ops/admin + portail partenaire B2B             |
| `app_chrono/`     | Expo, React Native, Expo Router           | Application client (commande / tracking)                 |
| `driver_chrono/`  | Expo, React Native                        | Application chauffeur (livraisons, revenus, gamification)|

---

## 📦 Prérequis

- Node.js ≥ 18
- npm ou yarn
- PostgreSQL 14+ ou Supabase
- Redis (optionnel, recommandé pour production - scaling Socket.IO)
- Expo CLI (pour les apps mobiles)
- **Mapbox** : token **pk.** pour admin (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`) et apps (`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`) — voir section [Mapbox](#mapbox-configuration)
- Compte **Supabase** (recommandé)
- **OTP SMS** : compte **Twilio** (principal dans le backend) ou **Vonage** (alternative) — variables dans `chrono_backend/.env.example`

---

## ⚙️ Installation rapide

```bash
git clone <repo>
cd PROJET_KRONO

# Backend
cd chrono_backend && npm install && cd -

# Dashboard admin
cd admin_chrono && npm install && cd -

# Apps mobiles
cd app_chrono && npm install && cd -
cd driver_chrono && npm install && cd -
```

---

## 🔐 Configuration

### 1. Base de données

1. Créez un projet Supabase ou une instance PostgreSQL.
2. Copiez les fichiers `.env.example` de chaque app.
3. Appliquez les migrations :
   ```bash
   cd chrono_backend/migrations
   # suivre le README local pour l'ordre exact
   ```

### 2. Variables d’environnement

#### Backend (`chrono_backend/.env`)

```bash
cp chrono_backend/.env.example chrono_backend/.env
```

Variables clés :

- `DATABASE_URL` - URL de connexion PostgreSQL
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Configuration Supabase
- `JWT_SECRET` - Secret pour les tokens JWT
- `REDIS_URL` - (Optionnel) URL Redis pour scaling Socket.IO
- `EMAIL_*` — (Optionnel) envoi mail
- `TWILIO_*` — SMS / WhatsApp OTP (principal)
- `VONAGE_*` — (Optionnel) SMS alternatif si pas Twilio
- `SENTRY_DSN` - (Optionnel) Monitoring d'erreurs Sentry

#### Dashboard admin (`admin_chrono/.env.local`)

```bash
cp admin_chrono/.env.local.example admin_chrono/.env.local
```

Variables clés :

- `NEXT_PUBLIC_API_URL` (ex: `http://localhost:4000` ou `http://192.168.1.96:4000` pour réseau local)
- `NEXT_PUBLIC_SOCKET_URL` (même URL que API_URL)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (cartes **Mapbox**, token **pk.**)

**Important :** Le CSP (Content Security Policy) est configuré automatiquement dans `next.config.ts` pour autoriser l'URL définie dans `NEXT_PUBLIC_API_URL`. Redémarrez le serveur après modification.

#### Apps mobiles (`app_chrono/.env`, `driver_chrono/.env`)

```bash
cp app_chrono/.env.example app_chrono/.env
cp driver_chrono/.env.example driver_chrono/.env
```

Variables clés :

- `EXPO_PUBLIC_API_URL` (ex: `http://localhost:4000` ou `http://192.168.1.96:4000` pour réseau local)
- `EXPO_PUBLIC_SOCKET_URL` (même URL que API_URL)
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (cartes **Mapbox** ; builds **EAS prod** : aussi sur `eas env`, pas seulement le `.env` local)

**Note pour iOS Simulator :** Utilisez `localhost` au lieu de l'IP locale.

---

## 🚀 Démarrage

```bash
# Backend
cd chrono_backend
npm run dev          # http://localhost:4000
# Documentation API Swagger : http://localhost:4000/api-docs

# Dashboard admin
cd admin_chrono
npm run dev -- --hostname 0.0.0.0 --port 3000
# http://localhost:3000/dashboard

# App client
cd app_chrono && npm start   # ou npx expo start

# App chauffeur
cd driver_chrono && npm start   # ou npx expo start
```

Expo propose ensuite `i` (iOS), `a` (Android), ou QR code via Expo Go.

---

## 📁 Structure du projet

### Backend (`chrono_backend/`)

```
chrono_backend/
├── src/
│   ├── controllers/   # Auth, deliveries, drivers, admin…
│   ├── routes/        # Routes Express
│   ├── middleware/    # Auth, validation
│   ├── sockets/       # Handlers Socket.IO
│   ├── services/      # OTP, email, etc.
│   ├── config/        # DB, logger, Supabase
│   └── utils/
├── migrations/
├── scripts/
└── logs/
```

### Dashboard admin (`admin_chrono/`)

```
admin_chrono/
├── app/                 # App Router (pages / api routes)
├── components/          # KPI cards, tables, tracker, etc.
├── hooks/               # useRealTimeTracking, useSocketConnection…
├── lib/                 # Services API, adminSocketService
├── contexts/            # DateFilter, Mapbox
├── stores/              # Zustand stores (auth…)
└── utils/               # formatDeliveryId, debug helpers
```

### Apps Expo (`app_chrono/` & `driver_chrono/`)

```
app_chrono/
├── app/ (Expo Router)
├── components/
├── hooks/
├── services/
├── store/
├── utils/
└── types/
```

`driver_chrono/` reprend la même organisation adaptée au flux chauffeur.

---

## 🔌 Documentation API

> **Note :** Le backend expose une documentation Swagger interactive. Une fois le backend démarré, accédez à `/api-docs` pour explorer toutes les routes disponibles avec leurs paramètres et réponses.

### Auth (`/api/auth-simple/*`)

- `POST /api/auth-simple/send-otp` - Envoi d'un code OTP
- `POST /api/auth-simple/verify-otp` - Vérification du code OTP
- `GET /api/auth-simple/check/:email` - Vérifier si un utilisateur existe
- `POST /api/auth-simple/register` - Inscription
- `POST /api/auth-simple/login` - Connexion
- `POST /api/auth-simple/refresh-token` - Rafraîchir le token
- `GET /api/auth-simple/users/:userId/profile` - Profil utilisateur
- `PUT /api/auth-simple/users/:userId/profile` - Mettre à jour le profil
- `POST /api/auth-simple/users/:userId/avatar` - Upload avatar

### Commandes (`/api/deliveries/*`)

- `POST /api/deliveries/` - Créer une commande
- `GET /api/deliveries/:userId` - Liste des commandes utilisateur
- `GET /api/deliveries/:userId/statistics` - Statistiques utilisateur
- `POST /api/deliveries/:orderId/cancel` - Annuler une commande
- `POST /api/deliveries/:orderId/status` - Mettre à jour le statut
- `POST /api/deliveries/:orderId/proof` - Upload preuve de livraison

### Chauffeurs (`/api/drivers/*`)

- `GET /api/drivers/online` - Liste des chauffeurs en ligne
- `GET /api/drivers/:driverId/details` - Détails d'un chauffeur
- `PUT /api/drivers/:userId/status` - Mettre à jour le statut (online/offline)
- `GET /api/drivers/:userId/revenues` - Revenus du chauffeur
- `GET /api/drivers/:userId/statistics` - Statistiques du chauffeur
- `GET /api/drivers/:userId/work-time` - Temps de travail
- `PUT /api/drivers/:userId/vehicle` - Mettre à jour le véhicule
- `PUT /api/drivers/:userId/driver-type` - Changer le type (partenaire/interne)

### Admin (`/api/admin/*`)

- `GET /api/admin/dashboard-stats` - Statistiques du dashboard
- `GET /api/admin/delivery-analytics` - Analytics de livraison
- `GET /api/admin/recent-activities` - Activités récentes
- `GET /api/admin/ongoing-deliveries` - Livraisons en cours
- `GET /api/admin/orders` - Liste des commandes (filtrées par statut)
- `POST /api/admin/orders` - Créer une commande admin
- `POST /api/admin/orders/:orderId/cancel` - Annuler une commande
- `GET /api/admin/users` - Liste des utilisateurs
- `GET /api/admin/drivers` - Liste des chauffeurs
- `GET /api/admin/drivers/:driverId` - Détails complets d'un chauffeur
- `PUT /api/admin/drivers/:driverId/status` - Modifier le statut d'un chauffeur
- `POST /api/admin/drivers/:driverId/commission/recharge` - Recharger commission
- `PUT /api/admin/drivers/:driverId/commission/suspend` - Suspendre commission
- `PUT /api/admin/drivers/:driverId/commission/rate` - Modifier taux commission
- `GET /api/admin/drivers/:driverId/commission/transactions` - Historique commission
- `GET /api/admin/financial-stats` - Statistiques financières
- `GET /api/admin/transactions` - Transactions
- `GET /api/admin/reports/deliveries` - Rapport livraisons
- `GET /api/admin/reports/revenues` - Rapport revenus
- `GET /api/admin/reports/clients` - Rapport clients
- `GET /api/admin/reports/drivers` - Rapport chauffeurs
- `GET /api/admin/reports/payments` - Rapport paiements
- `GET /api/admin/ratings` - Liste des évaluations
- `DELETE /api/admin/ratings/:ratingId` - Supprimer une évaluation
- `GET /api/admin/promo-codes` - Liste des codes promo
- `POST /api/admin/promo-codes` - Créer un code promo
- `GET /api/admin/disputes` - Liste des réclamations
- `PUT /api/admin/disputes/:disputeId` - Mettre à jour une réclamation
- `GET /api/admin/search` - Recherche globale

### Paiements (`/api/payments/*`)

- `POST /api/payments/methods` - Créer une méthode de paiement
- `GET /api/payments/methods` - Liste des méthodes de paiement
- `POST /api/payments/calculate-price` - Calculer le prix
- `POST /api/payments/initiate` - Initier un paiement
- `GET /api/payments/transactions` - Liste des transactions
- `GET /api/payments/transactions/:transactionId` - Détails transaction
- `POST /api/payments/disputes` - Créer une réclamation
- `GET /api/payments/deferred/limits` - Limites paiement différé
- `GET /api/payments/deferred/debts` - Dettes différées

### Messagerie (`/api/messages/*`)

- `GET /api/messages/conversations` - Liste des conversations
- `GET /api/messages/conversations/:conversationId` - Détails conversation
- `POST /api/messages/conversations` - Créer une conversation
- `GET /api/messages/conversations/:conversationId/messages` - Messages
- `POST /api/messages/conversations/:conversationId/messages` - Envoyer message
- `PUT /api/messages/conversations/:conversationId/read` - Marquer comme lu
- `GET /api/messages/unread-count` - Nombre de messages non lus

### QR Codes (`/api/qr-codes/*`)

- `POST /api/qr-codes/orders/:orderId/qr-codes/generate` - Générer QR code
- `GET /api/qr-codes/orders/:orderId/qr-codes` - Récupérer QR code
- `GET /api/qr-codes/orders/:orderId/qr-codes/scans` - Historique scans
- `POST /api/qr-codes/qr-codes/scan` - Scanner un QR code

### Commissions (`/api/commissions/*`)

- `GET /api/commissions/:userId/balance` - Solde commission
- `GET /api/commissions/:userId/transactions` - Transactions commission
- `POST /api/commissions/:userId/recharge` - Recharger commission

### Gamification (`/api/gamification/*`)

- `GET /api/gamification/badges/:driverId` - Badges d'un chauffeur
- `POST /api/gamification/badges/:driverId/check` - Vérifier badges
- `GET /api/gamification/leaderboard` - Classement
- `GET /api/gamification/score/:driverId` - Score d'un chauffeur

### Analytics (`/api/analytics/*`)

- `GET /api/analytics/kpis` - KPIs en temps réel
- `GET /api/analytics/performance` - Données de performance
- `GET /api/analytics/export` - Exporter analytics

### Support (`/api/support/*`)

- `GET /api/support/faq` - Recherche FAQ
- `POST /api/support/tickets` - Créer un ticket
- `GET /api/support/tickets` - Liste des tickets

### Météo (`/api/weather/*`)

- `GET /api/weather/:latitude/:longitude` - Données météo

### Multi-livraison (`/api/multi-delivery/*`)

- `POST /api/multi-delivery/optimize` - Optimiser route
- `GET /api/multi-delivery/zones` - Zones avec commandes

### Prévision de demande (`/api/forecast/*`)

- `GET /api/forecast/demand` - Prévision demande
- `GET /api/forecast/peaks` - Heures de pointe
- `GET /api/forecast/recommendations` - Recommandations zones

### Flotte (`/api/fleet/*`)

- `GET /api/fleet/vehicles` - Liste des véhicules
- `GET /api/fleet/vehicles/:plate` - Détails véhicule
- `POST /api/fleet/vehicles` - Créer un véhicule
- `PUT /api/fleet/vehicles/:plate` - Mettre à jour un véhicule
- `POST /api/fleet/vehicles/:plate/fuel` - Ajouter un plein carburant
- `GET /api/fleet/vehicles/:plate/fuel` - Historique carburant
- `POST /api/fleet/vehicles/:plate/maintenance` - Créer une maintenance
- `PUT /api/fleet/maintenance/:id` - Mettre à jour une maintenance
- `GET /api/fleet/vehicles/:plate/maintenance` - Historique maintenance
- `POST /api/fleet/vehicles/:plate/documents/upload` - Upload document véhicule
- `POST /api/fleet/vehicles/:plate/documents` - Sauvegarder document
- `GET /api/fleet/vehicles/:plate/documents` - Documents d'un véhicule
- `GET /api/fleet/documents/expiring` - Documents proches d'expiration
- `GET /api/fleet/vehicles/:plate/financial-summary` - Résumé financier
- `GET /api/fleet/vehicles/:plate/mileage` - Historique kilométrage

### Partenaires (`/api/partners/*`)

- `POST /api/partners/register` - S'inscrire comme partenaire
- `POST /api/partners/deregister` - Se désinscrire
- `PATCH /api/partners/business-mode` - Activer/désactiver mode business
- `POST /api/partners/` - Créer un partenaire (admin)
- `GET /api/partners/` - Lister les partenaires (admin)
- `GET /api/partners/:id` - Détails d'un partenaire
- `POST /api/partners/:id/subscriptions` - Créer un abonnement
- `PATCH /api/partners/:id/subscriptions/:subId/activate` - Activer un abonnement
- `PATCH /api/partners/:id/activate` - Activer un partenaire
- `PATCH /api/partners/:id/status` - Mettre à jour le statut
- `DELETE /api/partners/:id` - Supprimer un partenaire
- `GET /api/partners/:id/drivers` - Chauffeurs d'un partenaire
- `POST /api/partners/:id/drivers` - Ajouter un chauffeur partenaire
- `DELETE /api/partners/:id/drivers/:driverUserId` - Retirer un chauffeur
- `PATCH /api/partners/:id/drivers/:driverUserId/default` - Définir chauffeur par défaut
- `GET /api/partners/:id/driver-requests` - Demandes de chauffeurs
- `PATCH /api/partners/:id/driver-requests/:requestId` - Valider/refuser une demande
- `GET /api/partners/:id/usage` - Usage et quota
- `GET /api/partners/:id/invoices` - Factures
- `PATCH /api/partners/:id/invoices/:invoiceId/pay` - Marquer facture comme payée

### Portail partenaire (`/api/partner/:partnerId/*`)

Routes dédiées au tableau de bord partenaire (accès restreint par JWT partenaire).

### Commandes en lot (`/api/batches/*`)

- `POST /api/batches/` - Créer un lot de commandes
- `GET /api/batches/:id` - Récupérer un lot
- `PATCH /api/batches/:id/orders/:orderId` - Valider une commande du lot

### Enregistrement de commandes (`/api/orders/*`)

- `GET /api/orders/` - Lister les enregistrements
- `POST /api/orders/record` - Enregistrer une commande

### Notifications push (`/api/push/*`)

- `POST /api/push/register` - Enregistrer un token push
- `DELETE /api/push/register` - Désabonner un token push
- `POST /api/push/live-activity/register` - Enregistrer un token Live Activity (iOS)
- `POST /api/push/live-activity/end` - Terminer une Live Activity

### Géocodage Mapbox (`/api/mapbox/*`)

- `GET /api/mapbox/geocode` - Géocodage d'une adresse
- `GET /api/mapbox/reverse` - Géocodage inverse (coordonnées → adresse)
- `GET /api/mapbox/directions` - Calcul d'itinéraire
- `GET /api/mapbox/search/suggest` - Suggestions de recherche
- `GET /api/mapbox/search/retrieve/:mapboxId` - Récupérer un lieu par ID Mapbox

### Synchronisation (`/api/sync/*`)

- `POST /api/sync/sync-users` - Synchroniser utilisateurs depuis Supabase Auth (admin)
- `GET /api/sync/sync-status` - Statut de la synchronisation

### WebSocket Events

**Client → Server:**
- `create-order` - Créer une commande
- `accept-order` - Accepter une commande
- `update-order-status` - Mettre à jour le statut
- `update-location` - Mettre à jour la position

**Server → Client:**
- `order:status:update` - Mise à jour statut commande
- `driver:location:update` - Mise à jour position chauffeur
- `new-order-request` - Nouvelle demande de commande
- `order:accepted` - Commande acceptée
- `order:cancelled` - Commande annulée

---

## 🧰 Technologies

### Backend

- **Runtime:** Node.js / Express 5
- **WebSocket:** Socket.IO avec Redis Adapter (scaling)
- **Base de données:** PostgreSQL / Supabase
- **Authentification:** JWT, Supabase Auth
- **Validation:** Joi
- **Logging:** Winston
- **Email:** Nodemailer, Resend
- **SMS / WhatsApp OTP:** Twilio (principal), Vonage (alternative)
- **Monitoring:** Sentry
- **Documentation API:** Swagger
- **QR Codes:** qrcode
- **Cache:** Redis (optionnel)
- **Sécurité:** Helmet, CORS, Rate Limiting, Brute Force Protection

### Dashboard (`admin_chrono`)

- **Framework:** Next.js 16 (App Router) + React 19
- **State Management:** React Query (TanStack Query) + Zustand
- **WebSocket:** Socket.IO client
- **Cartes:** Mapbox GL JS (`mapbox-gl`)
- **Graphiques:** Recharts
- **Export:** jsPDF, xlsx
- **Animations:** Framer Motion
- **UI:** Tailwind CSS 4, Lucide React
- **i18n:** système de traduction maison (`/locales`)
- **Sécurité:** CSP configuré dynamiquement dans `next.config.ts`
- **Authentification:** Supabase Auth Helpers (rôles admin/super_admin)
- **Tests:** Vitest (utilitaires purs)

### Apps mobiles

- **Framework:** Expo ~54, React Native 0.81
- **Routing:** Expo Router 6
- **State Management:** Zustand
- **WebSocket:** Socket.IO client
- **Cartes:** `@rnmapbox/maps` (Mapbox)
- **Scanner:** Expo Barcode Scanner (nécessite développement build pour `driver_chrono`)
- **Localisation:** Expo Location
- **Monitoring:** Sentry React Native
- **Stockage:** AsyncStorage
- **Images:** Expo Image
- **Animations:** React Native Reanimated, Worklets

---

## 🛠️ Scripts utiles

```bash
# Backend
npm run dev              # Développement
npm run build            # Build production
npm run start            # Production
npm run simulate         # Simuler un flux de livraison
npm run test             # Tests
npm run test:coverage    # Tests avec couverture
npm run backup:postgres  # Backup PostgreSQL
npm run backup:supabase  # Backup Supabase
npm run backup:all       # Backup complet
npm run recovery:list    # Lister les backups
npm run recovery:restore # Restaurer un backup

# Dashboard admin
npm run dev              # Développement
npm run build            # Build production
npm run start            # Production
npm run lint             # Linter
npm run test             # Tests Vitest
npm run create-admin     # Créer un admin
npm run create-avatars-bucket # Créer bucket avatars

# Apps mobiles
npm start                # Démarrer Expo (ou npx expo start)
npm run android          # Build Android
npm run ios              # Build iOS
npm run lint             # Linter
npm run update-ip        # Mettre à jour l'IP dans .env
```

---

## ✨ Fonctionnalités principales

### Dashboard Admin (`admin_chrono`)

- 📊 **Tableau de bord** (`/dashboard`) - KPIs, revenus et livraisons en temps réel
- 🗺️ **Tracking live** (`/tracking`) - Suivi des chauffeurs et livraisons en cours sur carte Mapbox
- 📦 **Commandes** (`/orders`) - Vue et gestion de toutes les commandes
- 👥 **Gestion des utilisateurs** :
  - `/users` - Vue globale (clients, livreurs, admins) — création, modification, recherche par nom/email/téléphone
  - `/drivers` - Vue opérationnelle des livreurs : badge Partenaire/Interne, solde commission (alertes vert/orange/rouge), statut Actif/Suspendu, recharge et suspension, rafraîchissement automatique toutes les 30 s
  - Voir `admin_chrono/docs/DIFFERENCE_USERS_VS_DRIVERS.md` pour le détail
- 🤝 **Portail partenaires** (`/partners`) - Gestion des partenaires B2B, abonnements, chauffeurs affiliés, factures, quota d'usage
- 🚗 **Flotte** (`/maintenance`) - Véhicules, carburant, maintenance, documents réglementaires, suivi financier et kilométrique
- 📈 **Analytics** (`/analytics`) - KPIs temps réel, données de performance, export
- 📋 **Rapports** (`/reports`) - Rapports exportables (livraisons, revenus, clients, chauffeurs, paiements)
- 💰 **Finances** (`/finances`, `/commissions`) - Transactions, commissions livreurs, statistiques financières
- 💬 **Messagerie** (`/message`) - Conversations en temps réel avec chauffeurs et clients
- ⭐ **Évaluations** (`/ratings`) - Notes et avis, suppression
- 🎁 **Codes promo** (`/promo-codes`) - Création et gestion
- ⚠️ **Réclamations** (`/disputes`) - Gestion et résolution
- 📅 **Planning** (`/planning`) - Planification des livraisons
- 🏆 **Gamification** (`/gamification`) - Badges, classements, scores chauffeurs
- 🔧 **Espace de travail** (`/workspace`) - Configuration et outils internes
- 🔐 **Authentification** sécurisée avec Supabase (rôles `admin` / `super_admin`)
- ⚙️ **Paramètres** (`/settings`) - Configuration système
- 👤 **Profil** (`/profile`) - Gestion du profil admin

### App Client (`app_chrono`)

- 📦 **Création de commandes** de livraison avec géolocalisation automatique
- 🗺️ **Suivi en temps réel** de la livraison sur carte interactive
- 💳 **Paiement intégré** :
  - Orange Money
  - Wave
  - Cash
  - Paiement différé (avec limites)
- 💬 **Messagerie** avec le chauffeur en temps réel
- ⭐ **Système d'évaluation** après chaque livraison
- 📍 **Géolocalisation** automatique pour adresses pickup/delivery
- 📱 **Historique des commandes** avec statuts détaillés
- 🎁 **Points de fidélité** et récompenses
- 💰 **Méthodes de paiement** sauvegardées
- 🔔 **Notifications** en temps réel
- 📊 **Statistiques personnelles** (commandes, dépenses)

### App Driver (`driver_chrono`)

- 📱 **Acceptation/refus de commandes** avec notifications en temps réel
- 🗺️ **Navigation** avec carte interactive et calcul d'ETA
- 📸 **Scanner QR code** pour validation de livraison (nécessite développement build)
- 💬 **Messagerie** avec les clients en temps réel
- 📊 **Statistiques personnelles** :
  - Livraisons du jour
  - Revenus totaux
  - Note moyenne
  - Temps de travail
- 💰 **Revenus** (`/revenus`) :
  - Revenus par période (jour, semaine, mois, tout)
  - Revenus par méthode de livraison (moto, véhicule, cargo)
  - Historique détaillé des commandes
  - Statistiques de distance
- 📍 **Partage de position** en temps réel avec mise à jour automatique
- 🚗 **Gestion du véhicule** (type, informations)
- 🔄 **Statut online/offline** avec toggle
- 🎯 **Géofencing** pour détection d'arrivée
- 🌤️ **Météo** intégrée pour planification
- 🏆 **Gamification** : badges, classements, scores
- 💳 **Commissions** (pour partenaires) :
  - Solde commission
  - Historique des transactions
  - Recharges

## 🔧 Fonctionnalités notables

- **Portail partenaire B2B** — espace dédié aux entreprises partenaires : abonnements, quota de livraisons, chauffeurs affiliés, facturation
- **Gestion de flotte** — suivi des véhicules (carburant, maintenance, documents réglementaires, kilométrage, résumé financier)
- **Commissions chauffeurs** — solde, recharge, suspension, historique des transactions ; alertes visuelles (vert/orange/rouge) dans le dashboard
- **Commandes en lot (batch)** — création et validation groupée de livraisons
- **Live Activity iOS** — mise à jour du statut de livraison en temps réel sur l'écran verrouillé
- **Notifications push** — tokens Expo Push + Live Activity, dé-duplication côté serveur
- **Géocodage Mapbox backend** — proxy sécurisé pour geocode, reverse, directions, search (clé cachée côté serveur)
- **Prévision de demande** — analyse des heures de pointe et recommandations de zones
- **Synchronisation Supabase** — sync utilisateurs Auth → PostgreSQL
- **Tracking public** — page de suivi partageable sans authentification (`/track/:token`)

## 🧪 Tests & CI

### État des tests par paquet

| Paquet | Framework | Commande | Couverture |
|--------|-----------|----------|------------|
| `chrono_backend` | Jest (unit + intégration) | `npm test` | ~14 % (seuil configuré, CI obligatoire) |
| `admin_chrono` | Vitest | `npm test` | utils purs (phone, ETA, formatId, statuts) |
| `app_chrono` | — | — | pas encore de tests unitaires |
| `driver_chrono` | — | — | pas encore de tests unitaires |

### Lancer les tests

```bash
# Backend (unit + intégration, coverage)
cd chrono_backend
npm test                 # tous les tests
npm run test:coverage    # avec rapport de couverture
npm run test:unit        # tests unitaires seulement
npm run test:integration # tests d'intégration seulement

# Dashboard admin
cd admin_chrono
npm test                 # 35 tests Vitest sur les utilitaires

# Apps Expo (lint uniquement pour l'instant)
cd app_chrono && npm run lint
cd driver_chrono && npm run lint
```

### Pipeline CI (`.github/workflows/ci.yml`)

| Job | Déclencheur | Bloque la PR |
|-----|------------|--------------|
| Backend — Build & Test | push/PR → main, develop | oui |
| Backend — Lint & TypeScript | push/PR | oui |
| Security Scan (audit + TruffleHog) | push/PR | oui |
| Admin — Lint, TypeScript & Build | push/PR | oui |
| Expo — Lint (app_chrono, driver_chrono) | push/PR | oui |

> **Note sécurité :** `jsPDF` et `xlsx` dans `admin_chrono` ont des vulnérabilités sans correctif disponible (pas de version patchée publiée). Ils sont tracés et l'audit CI passe en mode informatif pour ces dépendances.

### Procédure nouveau développeur

```bash
git clone <repo>
cd PROJET_KRONO

# 1. Backend
cd chrono_backend
cp .env.example .env        # remplir DATABASE_URL, SUPABASE_*, JWT_SECRET, TWILIO_*
npm install
# Appliquer les migrations (voir chrono_backend/migrations/README.md pour l'ordre)
npm run dev                  # http://localhost:4000

# 2. Admin
cd ../admin_chrono
cp .env.local.example .env.local  # remplir NEXT_PUBLIC_API_URL, SUPABASE_*, MAPBOX_TOKEN
npm install
npm run dev                  # http://localhost:3000

# 3. Apps mobiles
cd ../app_chrono && cp .env.example .env && npm install
cd ../driver_chrono && cp .env.example .env && npm install
npx expo start               # scanner QR avec Expo Go ou npm run android/ios
```

---

## 🐛 Dépannage rapide

| Problème                                 | Solution                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| WebSocket indisponible                   | Vérifier backend, `*_SOCKET_URL`, CORS                                                                   |
| DB inaccessible                          | Migrations exécutées ? `DATABASE_URL` correct ?                                                          |
| Carte vide                               | Vérifier `MAPBOX_ACCESS_TOKEN` / `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`                                       |
| Dashboard boucle de fetch                | Tenir compte des instructions dans `admin_chrono/README` local (filtres de dates, query keys stabilisés) |
| **Erreur CSP (Content Security Policy)** | Voir [Configuration CSP](#configuration-csp-pour-admin_chrono)                                           |
| **Scanner QR code ne fonctionne pas**    | Nécessite un développement build (voir [Apps mobiles](#apps-mobiles))                                    |
| **Crash lors de la 2ème commande**       | Vérifier que le backend est à jour avec les dernières corrections                                        |
| **Erreur "aucun userId"**                | L'utilisateur doit être connecté avant de créer une commande                                             |

### Configuration CSP pour `admin_chrono`

Le dashboard admin utilise Content Security Policy (CSP) pour la sécurité. Si vous voyez des erreurs CSP bloquant les connexions au backend :

1. Vérifiez que `NEXT_PUBLIC_API_URL` est correctement défini dans `.env.local`
2. Le fichier `next.config.ts` configure automatiquement le CSP avec l'URL du backend
3. Redémarrez le serveur Next.js après modification de `.env.local`

**Note :** Le CSP est configuré dynamiquement pour autoriser l'URL du backend définie dans `NEXT_PUBLIC_API_URL`.

### Mapbox Configuration

Les cartes utilisent Mapbox. Configurez `MAPBOX_ACCESS_TOKEN` (backend) et `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` / `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (apps) dans vos fichiers `.env`. Obtenez un token sur [account.mapbox.com](https://account.mapbox.com).

### Apps mobiles - Développement Build

Certaines fonctionnalités nécessitent un **développement build** (pas Expo Go) :

- **Scanner QR code** (`expo-barcode-scanner`) dans `driver_chrono`

Pour créer un développement build :

```bash
# iOS
cd driver_chrono
npx expo run:ios

# Android
npx expo run:android
```

**Guide complet :** Voir `driver_chrono/docs/TROUBLESHOOTING.md`

---

## 📚 Documentation supplémentaire

### Guides de configuration

- **Référence projet** (priorités validées, Live Activity, Android ongoing, prod, app mature) : `docs/krono-reference-unique.md`
- **Référence projet** (carte fichiers, décisions produit, push, prod, pricing, paiements / QR, PSP) : `docs/krono-reference-unique.md`
- **Variables** : fichiers `.env.example` à la racine de chaque package (`chrono_backend`, `admin_chrono`, `app_chrono`, `driver_chrono`)

- **Scaling et production** : `chrono_backend/docs/SCALING_SETUP.md`
  - Configuration Redis Adapter pour Socket.IO
  - Configuration PostgreSQL Pool
  - Tests et vérification

### Guides de dépannage

- **Scanner QR Code (Driver)** : `driver_chrono/docs/TROUBLESHOOTING.md`
  - Configuration du développement build
  - Résolution des erreurs de modules natifs
  - Problèmes courants avec Expo

### Structure des docs

```
PROJET_KRONO/
├── docs/
│   └── krono-reference-unique.md      # Référence projet, contrat produit, décisions
├── admin_chrono/docs/
│   ├── DIFFERENCE_USERS_VS_DRIVERS.md  # Différence entre /users et /drivers
│   ├── NOTIFICATIONS_BEHAVIOR.md       # Comportement des notifications
│   └── PROPOSITION_GESTION_LIVREURS_PARTENAIRES.md
├── driver_chrono/docs/
│   └── TROUBLESHOOTING.md              # Dépannage app chauffeur
└── chrono_backend/docs/
    ├── SCALING_SETUP.md                # Configuration Redis et PostgreSQL Pool
    ├── BACKUP_RECOVERY.md              # Backup et restauration
    └── SWAGGER_ADDITIONS.md            # Documentation Swagger
```

## 📚 Ressources

- [Expo docs](https://docs.expo.dev/)
- [Supabase docs](https://supabase.com/docs)
- [Socket.IO docs](https://socket.io/docs/)
- [Next.js docs](https://nextjs.org/docs)
- [React Query docs](https://tanstack.com/query)
- [Mapbox](https://docs.mapbox.com/)

---

## 🤝 Contribution

1. Fork
2. `git checkout -b feature/AmazingFeature`
3. Commit (`git commit -m "Add AmazingFeature"`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📄 Licence

À définir.

## 👥 Auteurs & Remerciements

À compléter.
