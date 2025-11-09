# 🚚 Chrono Livraison

Plateforme de livraison en temps réel connectant les clients et les chauffeurs pour des livraisons rapides et efficaces.

## 📋 Table des matières

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Structure du projet](#structure-du-projet)
- [API Documentation](#api-documentation)
- [Technologies utilisées](#technologies-utilisées)

## 🏗️ Architecture

Le projet est divisé en trois parties principales :

1. **Backend** (`chrono_backend/`) - API REST et WebSocket en Node.js/Express
2. **App Client** (`app_chrono/`) - Application mobile React Native/Expo pour les clients
3. **App Driver** (`driver_chrono/`) - Application mobile React Native/Expo pour les chauffeurs

```
PROJET_CHRONO/
├── chrono_backend/      # Backend API
├── app_chrono/          # App client (React Native)
├── driver_chrono/        # App chauffeur (React Native)
└── README.md            # Ce fichier
```

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

