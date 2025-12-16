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
- Expo CLI (pour les apps mobiles)
- Google Maps API key
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

- `DATABASE_URL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `EMAIL_*`, `VONAGE_*` (optionnel)

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

## 🔌 Documentation API (extraits)

### Auth

- `POST /api/auth-simple/send-otp`
- `POST /api/auth-simple/verify-otp`
- `GET /api/auth-simple/check/:email`

### Commandes

- Socket `create-order`, `accept-order`, `update-order-status`

### Chauffeurs

- `GET /api/drivers/nearby`
- `POST /api/drivers/update-location`

### WebSocket (Server → Client)

- `order:status:update`
- `driver:location:update`
- `new-order-request`

---

## 🧰 Technologies

### Backend

- Node.js / Express
- Socket.IO
- PostgreSQL / Supabase
- JWT, Joi, Winston, Nodemailer

### Dashboard (`admin_chrono`)

- Next.js 16 (App Router)
- React Query + Zustand
- Socket.IO client
- Google Maps JS API
- Content Security Policy (CSP) configuré dynamiquement

### Apps mobiles

- Expo + React Native
- Expo Router
- Zustand
- Socket.IO client
- React Native Maps
- Expo Barcode Scanner (nécessite développement build pour `driver_chrono`)

---

## 🛠️ Scripts utiles

```bash
# Backend
npm run dev
npm run simulate

# Dashboard admin
npm run dev
npm run lint

# Apps mobiles
npm start
npm run android
npm run ios
npm run lint
```

---

## ✨ Fonctionnalités principales

### Dashboard Admin (`admin_chrono`)

- 📊 Tableau de bord avec statistiques en temps réel
- 🗺️ Suivi des livraisons en direct sur carte Google Maps
- 👥 Gestion des chauffeurs et clients
- 📈 Analytics et rapports
- 💬 Système de messagerie intégré
- 🔐 Authentification sécurisée avec Supabase

### App Client (`app_chrono`)

- 📦 Création de commandes de livraison
- 🗺️ Suivi en temps réel de la livraison
- 💳 Paiement intégré (Orange Money, Wave, Cash, Paiement différé)
- 💬 Messagerie avec le chauffeur
- ⭐ Système d'évaluation
- 📍 Géolocalisation automatique

### App Driver (`driver_chrono`)

- 📱 Acceptation/refus de commandes
- 🗺️ Navigation avec carte interactive
- 📸 Scanner QR code pour validation (nécessite développement build)
- 💬 Messagerie avec les clients
- 📊 Statistiques personnelles
- 📍 Partage de position en temps réel

## 🔧 Améliorations récentes

### Corrections importantes

1. **Content Security Policy (CSP)** - Configuration dynamique pour autoriser le backend
2. **Gestion des erreurs Google Maps** - Détection et messages d'erreur améliorés
3. **Protection contre les crashes** - Gestion améliorée des appels multiples à `createOrder()`
4. **Nettoyage des sockets** - Prévention des listeners dupliqués
5. **Scanner QR code** - Gestion gracieuse de l'absence du module natif

## 🧪 Tests

Tests automatisés à venir (TODO commun aux 4 projets).

---

## 🐛 Dépannage rapide

| Problème                                 | Solution                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| WebSocket indisponible                   | Vérifier backend, `*_SOCKET_URL`, CORS                                                                   |
| DB inaccessible                          | Migrations exécutées ? `DATABASE_URL` correct ?                                                          |
| Google Maps vide                         | Permissions + `EXPO/NEXT_PUBLIC_GOOGLE_API_KEY`                                                          |
| Dashboard boucle de fetch                | Tenir compte des instructions dans `admin_chrono/README` local (filtres de dates, query keys stabilisés) |
| **Erreur CSP (Content Security Policy)** | Voir [Configuration CSP](#configuration-csp-pour-admin_chrono)                                           |
| **Erreur Google Maps Billing**           | Voir [Guide Google Maps](#google-maps-configuration)                                                     |
| **Erreur DeletedApiProjectMapError**     | Voir [Guide Google Maps](#google-maps-configuration)                                                     |
| **Scanner QR code ne fonctionne pas**    | Nécessite un développement build (voir [Apps mobiles](#apps-mobiles))                                    |
| **Crash lors de la 2ème commande**       | Vérifier que le backend est à jour avec les dernières corrections                                        |
| **Erreur "aucun userId"**                | L'utilisateur doit être connecté avant de créer une commande                                             |

### Configuration CSP pour `admin_chrono`

Le dashboard admin utilise Content Security Policy (CSP) pour la sécurité. Si vous voyez des erreurs CSP bloquant les connexions au backend :

1. Vérifiez que `NEXT_PUBLIC_API_URL` est correctement défini dans `.env.local`
2. Le fichier `next.config.ts` configure automatiquement le CSP avec l'URL du backend
3. Redémarrez le serveur Next.js après modification de `.env.local`

**Note :** Le CSP est configuré dynamiquement pour autoriser l'URL du backend définie dans `NEXT_PUBLIC_API_URL`.

### Google Maps Configuration

#### Erreurs de facturation (`BillingNotEnabledMapError`)

Même si vous avez configuré un compte de facturation, cette erreur peut survenir si :

1. **Les APIs ne sont pas activées** dans Google Cloud Console :

   - Maps JavaScript API (obligatoire)
   - Places API (obligatoire)
   - Geocoding API (recommandé)

2. **Le projet n'est pas lié au compte de facturation**

3. **La clé API n'est pas correctement configurée**

**Guide complet :** Voir `admin_chrono/docs/GOOGLE_MAPS_BILLING_FIX.md`

#### Erreur projet supprimé (`DeletedApiProjectMapError`)

Si vous voyez cette erreur, le projet Google Cloud associé à votre clé API a été supprimé. Vous devez :

1. Créer un nouveau projet Google Cloud
2. Activer les APIs nécessaires
3. Créer une nouvelle clé API
4. Mettre à jour `NEXT_PUBLIC_GOOGLE_API_KEY` dans `.env.local`

**Guide complet :** Voir `admin_chrono/docs/GOOGLE_MAPS_BILLING_FIX.md`

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

- **Google Maps (Admin)** : `admin_chrono/docs/GOOGLE_MAPS_BILLING_FIX.md`

  - Résolution des erreurs de facturation
  - Résolution de l'erreur `DeletedApiProjectMapError`
  - Configuration des APIs Google Cloud

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
│   └── GOOGLE_MAPS_BILLING_FIX.md
├── driver_chrono/docs/
│   └── TROUBLESHOOTING.md
└── chrono_backend/docs/
    ├── SCALING_SETUP.md                # Configuration Redis et PostgreSQL Pool
    └── BACKUP_RECOVERY.md
```

## 📚 Ressources

- [Expo docs](https://docs.expo.dev/)
- [Supabase docs](https://supabase.com/docs)
- [Socket.IO docs](https://socket.io/docs/)
- [Next.js docs](https://nextjs.org/docs)
- [React Query docs](https://tanstack.com/query)
- [Google Maps Platform](https://developers.google.com/maps)

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
