# 🚚 Chrono Livraison – Monorepo

Plateforme de livraison en temps réel connectant clients, chauffeurs **et administrateurs**. Ce dépôt rassemble :

- `chrono_backend/` → API REST + Socket.IO
- `admin_chrono/` → Dashboard web (Next.js 16 / React 18)
- `app_chrono/` → App mobile client (Expo / React Native)
- `driver_chrono/` → App mobile chauffeur (Expo / React Native)

```
PROJET_CHRONO/
├── chrono_backend/
├── admin_chrono/
├── app_chrono/
├── driver_chrono/
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

| Composant         | Stack                                     | Description                              |
| ----------------- | ----------------------------------------- | ---------------------------------------- |
| `chrono_backend/` | Node.js + Express + Socket.IO             | API REST, WebSocket, migrations SQL      |
| `admin_chrono/`   | Next.js 16, React Query, Socket.IO client | Dashboard web pour les ops/admin         |
| `app_chrono/`     | Expo, React Native, Expo Router           | Application client (commande / tracking) |
| `driver_chrono/`  | Expo, React Native                        | Application chauffeur                    |

---

## 📦 Prérequis

- Node.js ≥ 18
- npm ou yarn
- PostgreSQL 14+ ou Supabase
- Redis (optionnel, recommandé pour production - scaling Socket.IO)
- Expo CLI (pour les apps mobiles)
- Google Maps API key (avec APIs activées : Maps JavaScript API, Places API, Geocoding API)
- Compte Supabase (recommandé)

---

## ⚙️ Installation rapide

```bash
git clone <repo>
cd PROJET_CHRONO

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
- `EMAIL_*`, `VONAGE_*` - (Optionnel) Configuration email/SMS
- `SENTRY_DSN` - (Optionnel) Monitoring d'erreurs Sentry

#### Dashboard admin (`admin_chrono/.env.local`)

```bash
cp admin_chrono/.env.example admin_chrono/.env.local
```

Variables clés :

- `NEXT_PUBLIC_API_URL` (ex: `http://localhost:4000` ou `http://192.168.1.96:4000` pour réseau local)
- `NEXT_PUBLIC_SOCKET_URL` (même URL que API_URL)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_API_KEY` (pour Google Maps)

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
- `EXPO_PUBLIC_GOOGLE_API_KEY` (pour les cartes)

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
cd app_chrono && npm start

# App chauffeur
cd driver_chrono && npm start
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
├── contexts/            # DateFilter, GoogleMaps
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

### Prévision de demande (`/api/demand-forecast/*`)

- `GET /api/demand-forecast/demand` - Prévision demande
- `GET /api/demand-forecast/peaks` - Heures de pointe
- `GET /api/demand-forecast/recommendations` - Recommandations zones

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
- **SMS:** Vonage
- **Monitoring:** Sentry
- **Documentation API:** Swagger
- **QR Codes:** qrcode
- **Cache:** Redis (optionnel)
- **Sécurité:** Helmet, CORS, Rate Limiting, Brute Force Protection

### Dashboard (`admin_chrono`)

- **Framework:** Next.js 16 (App Router)
- **State Management:** React Query (TanStack Query) + Zustand
- **WebSocket:** Socket.IO client
- **Cartes:** Google Maps JS API
- **Graphiques:** Recharts
- **Export:** jsPDF, xlsx
- **Animations:** Framer Motion
- **UI:** Tailwind CSS 4, Lucide React
- **Sécurité:** Content Security Policy (CSP) configuré dynamiquement
- **Authentification:** Supabase Auth Helpers

### Apps mobiles

- **Framework:** Expo ~54, React Native 0.81
- **Routing:** Expo Router 6
- **State Management:** Zustand
- **WebSocket:** Socket.IO client
- **Cartes:** React Native Maps
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
npm run create-admin     # Créer un admin
npm run create-avatars-bucket # Créer bucket avatars

# Apps mobiles
npm start                # Démarrer Expo
npm run android          # Build Android
npm run ios              # Build iOS
npm run lint             # Linter
npm run update-ip        # Mettre à jour l'IP dans .env
```

---

## ✨ Fonctionnalités principales

### Dashboard Admin (`admin_chrono`)

- 📊 **Tableau de bord** avec statistiques en temps réel (KPIs, revenus, livraisons)
- 🗺️ **Suivi des livraisons** en direct sur carte Google Maps
- 👥 **Gestion des utilisateurs** :
  - `/users` - Vue globale de tous les utilisateurs (clients, livreurs, admins)
    - Gestion administrative (création, modification, suppression)
    - Recherche globale par nom, email, téléphone
    - Filtres par rôle
  - `/drivers` - Vue spécialisée pour les livreurs avec gestion opérationnelle
    - Distinction Partenaire/Interne avec badges visuels
    - Gestion des soldes commission avec alertes (vert/orange/rouge)
    - Statut opérationnel (Actif/Suspendu selon solde)
    - Statistiques de performance (livraisons, rating)
    - Recharge et suspension des commissions
    - Rafraîchissement automatique toutes les 30 secondes
  - **Note :** Voir `admin_chrono/docs/DIFFERENCE_USERS_VS_DRIVERS.md` pour plus de détails
- 📈 **Analytics** (`/analytics`) - Analyses détaillées et KPIs
- 📋 **Rapports** (`/reports`) - Rapports exportables (livraisons, revenus, clients, chauffeurs, paiements)
- 💰 **Finances** (`/finances`, `/commissions`) :
  - Transactions clients
  - Commissions livreurs
  - Statistiques financières
- 💬 **Messagerie** (`/message`) - Système de messagerie intégré
- ⭐ **Évaluations** (`/ratings`) - Gestion des notes et avis
- 🎁 **Codes promo** (`/promo-codes`) - Création et gestion
- ⚠️ **Réclamations** (`/disputes`) - Gestion des réclamations
- 📅 **Planning** (`/planning`) - Planification des livraisons
- 🏆 **Gamification** (`/gamification`) - Performance et classements
- 🔐 **Authentification** sécurisée avec Supabase (rôles admin/super_admin)
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

## 🔧 Améliorations récentes

### Corrections importantes

1. **Content Security Policy (CSP)** - Configuration dynamique pour autoriser le backend
2. **Gestion des erreurs Google Maps** - Détection et messages d'erreur améliorés
3. **Protection contre les crashes** - Gestion améliorée des appels multiples à `createOrder()`
4. **Nettoyage des sockets** - Prévention des listeners dupliqués
5. **Scanner QR code** - Gestion gracieuse de l'absence du module natif
6. **Système de commissions** - Gestion complète pour livreurs partenaires
7. **Gamification** - Badges, classements et scores pour les chauffeurs
8. **Analytics avancés** - KPIs en temps réel et rapports exportables
9. **Multi-livraison** - Optimisation de routes pour plusieurs commandes
10. **Prévision de demande** - Analyse des heures de pointe et recommandations
11. **Support client** - Système de tickets et FAQ
12. **Météo intégrée** - Données météo pour planification des livraisons

## 🧪 Tests

Tests automatisés à venir (TODO commun aux 4 projets).

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

- **Variables d'environnement** : `docs/ENV_VARIABLES_GUIDE.md`

  - Où configurer Redis et PostgreSQL Pool
  - Configuration par projet (backend, admin, apps)
  - Checklist de configuration

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
PROJET_CHRONO/
├── docs/
│   └── ENV_VARIABLES_GUIDE.md          # Guide des variables d'environnement
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
