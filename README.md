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

| Composant | Stack | Description |
| --- | --- | --- |
| `chrono_backend/` | Node.js + Express + Socket.IO | API REST, WebSocket, migrations SQL |
| `admin_chrono/` | Next.js 16, React Query, Socket.IO client | Dashboard web pour les ops/admin |
| `app_chrono/` | Expo, React Native, Expo Router | Application client (commande / tracking) |
| `driver_chrono/` | Expo, React Native | Application chauffeur |

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
- `NEXT_PUBLIC_API_URL` (ex: `http://localhost:4000`)
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Apps mobiles (`app_chrono/.env`, `driver_chrono/.env`)

```bash
cp app_chrono/.env.example app_chrono/.env
cp driver_chrono/.env.example driver_chrono/.env
```

Variables clés :
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_GOOGLE_API_KEY`

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

### Apps mobiles
- Expo + React Native
- Expo Router
- Zustand
- Socket.IO client
- React Native Maps

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

## 🧪 Tests

Tests automatisés à venir (TODO commun aux 4 projets).

---

## 🐛 Dépannage rapide

| Problème | Pistes |
| --- | --- |
| WebSocket indisponible | Vérifier backend, `*_SOCKET_URL`, CORS |
| DB inaccessible | Migrations exécutées ? `DATABASE_URL` correct ? |
| Google Maps vide | Permissions + `EXPO/NEXT_PUBLIC_GOOGLE_API_KEY` |
| Dashboard boucle de fetch | Tenir compte des instructions dans `admin_chrono/README` local (filtres de dates, query keys stabilisés) |

---

## 📚 Ressources

- [Expo docs](https://docs.expo.dev/)
- [Supabase docs](https://supabase.com/docs)
- [Socket.IO docs](https://socket.io/docs/)
- [Next.js docs](https://nextjs.org/docs)
- [React Query docs](https://tanstack.com/query)

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

## 📦 Prérequis

- **Node.js** >= 18.x
- **npm** ou **yarn**
- **PostgreSQL** >= 14 (ou Supabase)
- **Expo CLI** (pour les apps mobiles)
- **Supabase** compte (pour la base de données)
- **Google Maps API Key** (pour les cartes)
- **Compte Vonage/Nexmo** (optionnel, pour SMS)

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone <votre-repo>
cd PROJET_CHRONO
```

### 2. Installer les dépendances

#### Backend

```bash
cd chrono_backend
npm install
```

#### App Client

```bash
cd app_chrono
npm install
```

#### App Driver

```bash
cd driver_chrono
npm install
```

### 3. Configuration de la base de données

1. Créez un projet Supabase ou utilisez votre propre instance PostgreSQL
2. Exécutez les migrations dans l'ordre :
   ```bash
   cd chrono_backend/migrations
   # Voir README.md dans le dossier migrations pour l'ordre d'exécution
   ```

## ⚙️ Configuration

### Variables d'environnement

Copiez les fichiers `.env.example` et remplissez les valeurs :

#### Backend (`chrono_backend/.env`)

```bash
cp chrono_backend/.env.example chrono_backend/.env
# Modifiez chrono_backend/.env avec vos valeurs
```

Variables importantes :
- `DATABASE_URL` - URL de connexion PostgreSQL
- `SUPABASE_URL` - URL de votre projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Clé service role Supabase
- `JWT_SECRET` - Secret pour signer les tokens JWT
- `EMAIL_USER` / `EMAIL_PASS` - Credentials email (Nodemailer)

#### App Client (`app_chrono/.env`)

```bash
cp app_chrono/.env.example app_chrono/.env
# Modifiez app_chrono/.env avec vos valeurs
```

Variables importantes :
- `EXPO_PUBLIC_API_URL` - URL de l'API backend
- `EXPO_PUBLIC_SOCKET_URL` - URL du serveur WebSocket
- `EXPO_PUBLIC_SUPABASE_URL` - URL Supabase
- `EXPO_PUBLIC_GOOGLE_API_KEY` - Clé API Google Maps

#### App Driver (`driver_chrono/.env`)

```bash
cp driver_chrono/.env.example driver_chrono/.env
# Modifiez driver_chrono/.env avec vos valeurs
```

Mêmes variables que l'app client.

## 🎯 Démarrage

### Backend

```bash
cd chrono_backend
npm run dev
```

Le serveur démarre sur `http://localhost:4000`

### App Client

```bash
cd app_chrono
npm start
```

Puis choisissez :
- `i` pour iOS Simulator
- `a` pour Android Emulator
- Scanner le QR code avec Expo Go

### App Driver

```bash
cd driver_chrono
npm start
```

Même processus que l'app client.

## 📁 Structure du projet

### Backend (`chrono_backend/`)

```
chrono_backend/
├── src/
│   ├── controllers/      # Contrôleurs (auth, delivery, driver, etc.)
│   ├── routes/          # Routes Express
│   ├── middleware/     # Middleware (auth, validation, etc.)
│   ├── services/       # Services métier (OTP, email)
│   ├── sockets/        # Handlers WebSocket
│   ├── config/         # Configuration (DB, Supabase)
│   └── utils/          # Utilitaires (logger, JWT, etc.)
├── migrations/         # Migrations SQL
├── scripts/           # Scripts utilitaires
└── logs/             # Logs de l'application
```

### App Client (`app_chrono/`)

```
app_chrono/
├── app/               # Routes (Expo Router)
│   ├── (auth)/        # Routes d'authentification
│   └── (tabs)/        # Routes principales (tabs)
├── components/        # Composants React Native
├── store/            # Stores Zustand
├── services/         # Services API et WebSocket
├── hooks/            # Hooks personnalisés
├── utils/            # Utilitaires
└── types/            # Types TypeScript
```

### App Driver (`driver_chrono/`)

Structure similaire à `app_chrono/` mais adaptée pour les chauffeurs.

## 🔌 API Documentation

### Endpoints principaux

#### Authentification
- `POST /api/auth-simple/send-otp` - Envoyer un code OTP
- `POST /api/auth-simple/verify-otp` - Vérifier un code OTP
- `GET /api/auth-simple/check/:email` - Vérifier si un email existe

#### Commandes
- WebSocket : `create-order` - Créer une nouvelle commande
- WebSocket : `accept-order` - Accepter une commande (chauffeur)
- WebSocket : `update-order-status` - Mettre à jour le statut

#### Chauffeurs
- `GET /api/drivers/nearby` - Trouver les chauffeurs à proximité
- `POST /api/drivers/update-location` - Mettre à jour la position

#### Notes
- `POST /api/ratings` - Créer une note

### WebSocket Events

#### Client → Server
- `create-order` - Créer une commande
- `cancel-order` - Annuler une commande

#### Server → Client
- `order:status:update` - Mise à jour du statut de commande
- `driver:location:update` - Mise à jour de la position du chauffeur
- `new-order-request` - Nouvelle commande disponible (chauffeur)
- `order:accepted` - Commande acceptée
- `order:declined` - Commande refusée

## 🛠️ Technologies utilisées

### Backend
- **Node.js** + **Express** - Framework web
- **Socket.IO** - Communication temps réel
- **PostgreSQL** / **Supabase** - Base de données
- **JWT** - Authentification
- **Winston** - Logging
- **Joi** - Validation
- **Nodemailer** - Envoi d'emails
- **Vonage/Nexmo** - SMS (optionnel)

### Frontend (Mobile)
- **React Native** - Framework mobile
- **Expo** - Plateforme de développement
- **Expo Router** - Navigation basée sur les fichiers
- **Zustand** - Gestion d'état
- **React Native Maps** - Cartes
- **Socket.IO Client** - WebSocket client

## 🔒 Sécurité

- Authentification par OTP (One-Time Password)
- Tokens JWT pour l'authentification
- Rate limiting sur les endpoints sensibles
- Validation des entrées avec Joi
- Row Level Security (RLS) activé sur Supabase

## 📝 Scripts utiles

### Backend

```bash
npm run dev          # Démarrage en mode développement
npm run simulate     # Simuler un flow de commande
```

### Apps

```bash
npm start           # Démarrer Expo
npm run android     # Démarrer sur Android
npm run ios         # Démarrer sur iOS
npm run lint        # Linter le code
```

## 🧪 Tests

Les tests sont à venir. Voir [TODO](#todo) pour les prochaines étapes.

## 🐛 Dépannage

### Problème de connexion WebSocket

Vérifiez que :
- Le backend est démarré
- `EXPO_PUBLIC_SOCKET_URL` est correctement configuré
- Les CORS sont correctement configurés dans le backend

### Problème de base de données

Vérifiez que :
- Les migrations ont été exécutées
- `DATABASE_URL` est correct
- Supabase RLS est correctement configuré

### Problème de localisation

Vérifiez que :
- Les permissions de localisation sont accordées
- `EXPO_PUBLIC_GOOGLE_API_KEY` est correct
- Les services de localisation sont activés sur l'appareil

## 📚 Ressources

- [Documentation Expo](https://docs.expo.dev/)
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Socket.IO](https://socket.io/docs/)
- [Documentation React Native](https://reactnative.dev/)

## 🤝 Contribution

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

[À définir]

## 👥 Auteurs

[À compléter]

## 🙏 Remerciements

[À compléter]

