# 🎛️ Chrono Admin Console

Console d'administration web pour la plateforme Chrono Livraison.

## 🚀 Technologies

- **Next.js 16** - Framework React avec App Router
- **TypeScript** - Typage statique
- **Tailwind CSS** - Styles utilitaires
- **Supabase** - Authentification et base de données
- **React Query** - Gestion des données et cache
- **Zustand** - State management
- **Recharts** - Graphiques et visualisations
- **Mapbox** - Cartes et géolocalisation
- **Socket.IO** - Communication temps réel
- **Lucide React** - Icônes

## 📋 Prérequis

- Node.js >= 18.x
- npm ou yarn
- Compte Supabase
- Token d'accès Mapbox

## 🔧 Installation

1. **Cloner et installer les dépendances**

```bash
cd admin_chrono
npm install
```

2. **Configurer les variables d'environnement**

Créez un fichier `.env.local` à la racine du projet :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Backend (en local, pointe vers chrono_backend ; sans ces variables, l’admin utilise l’API prod définie dans `lib/productionApiBase.ts`)
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_public_token
```

3. **Démarrer le serveur de développement**

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 📁 Structure du projet

```
admin_chrono/
├── app/                    # Pages Next.js (App Router)
│   ├── (dashboard)/        # Routes protégées du dashboard
│   │   ├── dashboard/      # Page Dashboard
│   │   ├── orders/         # Page Orders
│   │   ├── tracking/       # Page Live Tracking
│   │   └── users/          # Page Users
│   ├── login/              # Page de connexion
│   ├── layout.tsx          # Layout racine
│   └── page.tsx            # Page d'accueil (redirige vers /dashboard)
├── components/             # Composants React réutilisables
│   └── layout/             # Sidebar, Header, etc.
├── lib/                    # Utilitaires et configurations
│   ├── supabase.ts        # Client Supabase
│   └── config.ts          # Configuration générale
├── stores/                 # Stores Zustand
│   └── authStore.ts       # Store d'authentification
├── types/                  # Types TypeScript
└── middleware.ts           # Middleware Next.js
```

## 🔐 Authentification

L'authentification est gérée via Supabase Auth. Seuls les utilisateurs avec le rôle `admin` ou `super_admin` peuvent accéder à la console.

## 📝 Routes disponibles

- `/login` - Page de connexion
- `/dashboard` - Tableau de bord principal
- `/orders` - Gestion des commandes
- `/tracking` - Suivi en temps réel des livraisons
- `/users` - Gestion des utilisateurs
- `/finance` - Gestion financière
- `/message` - Messagerie interne
- `/settings` - Paramètres

## 🎨 Design

L'interface suit un design moderne avec :
- Palette de couleurs : Purple (#8B5CF6), White, Gray
- Sidebar verticale avec navigation par icônes
- Header avec recherche et filtres
- Cards pour les KPIs et statistiques
- Graphiques interactifs avec Recharts
- Cartes Mapbox pour le suivi

## 🛠️ Développement

### Commandes disponibles

```bash
npm run dev      # Démarrer le serveur de développement
npm run build    # Construire pour la production
npm run start    # Démarrer le serveur de production
npm run lint     # Linter le code
```

## 📦 Déploiement

Le projet peut être déployé sur :
- **Vercel** (recommandé pour Next.js)
- **Netlify**
- **Supabase Hosting**

Assurez-vous de configurer toutes les variables d'environnement dans votre plateforme de déploiement.

## 🔗 Liens utiles

- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Tailwind CSS](https://tailwindcss.com/docs)
