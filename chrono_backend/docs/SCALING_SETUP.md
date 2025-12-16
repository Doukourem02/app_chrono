# Guide d'implémentation : Scaling Horizontal avec Redis

Ce guide explique comment configurer Redis Adapter pour Socket.IO et optimiser le pool PostgreSQL pour supporter la production.

## 📋 Table des matières

1. [Installation des dépendances](#installation-des-dépendances)
2. [Configuration Redis](#configuration-redis)
3. [Configuration PostgreSQL Pool](#configuration-postgresql-pool)
4. [Variables d'environnement](#variables-denvironnement)
5. [Tests et vérification](#tests-et-vérification)
6. [Dépannage](#dépannage)

---

## 🚀 Installation des dépendances

### 1. Installer les packages nécessaires

```bash
cd chrono_backend
npm install @socket.io/redis-adapter redis
npm install --save-dev @types/redis
```

### 2. Vérifier l'installation

```bash
npm list @socket.io/redis-adapter redis
```

Vous devriez voir les versions installées.

---

## ⚙️ Configuration Redis

### Option 1 : Redis Cloud (Recommandé pour production)

1. **Créer un compte sur [Redis Cloud](https://redis.com/try-free/)**

   - Plan gratuit : 30 MB, suffisant pour commencer
   - Plan payant : À partir de $10/mois pour 100 MB

2. **Créer une base de données**

   - Choisir une région proche de vos serveurs
   - Noter l'URL de connexion (format: `redis://:password@host:port`)

3. **Configurer dans `.env`**
   ```bash
   REDIS_URL=redis://:votre_password@votre_host:port
   ```

### Option 2 : Redis Local (Développement)

#### Sur macOS (avec Homebrew)

```bash
brew install redis
brew services start redis
```

#### Sur Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

#### Sur Windows

Télécharger depuis [redis.io](https://redis.io/download) ou utiliser WSL.

#### Configuration locale

```bash
REDIS_URL=redis://localhost:6379
```

### Option 3 : Docker (Recommandé pour développement)

```bash
docker run -d -p 6379:6379 --name redis-chrono redis:7-alpine
```

Puis dans `.env`:

```bash
REDIS_URL=redis://localhost:6379
```

---

## 🗄️ Configuration PostgreSQL Pool

### Variables d'environnement recommandées

Ajoutez ces variables dans votre `.env` :

```bash
# Pool PostgreSQL - Ajuster selon votre plan Supabase
DB_POOL_MAX=20          # Maximum de connexions (Supabase Pro: 60, Team: 200)
DB_POOL_MIN=2           # Minimum de connexions maintenues
DB_POOL_IDLE_TIMEOUT=30000      # 30 secondes d'inactivité avant fermeture
DB_POOL_CONNECTION_TIMEOUT=2000 # 2 secondes pour obtenir une connexion
DB_QUERY_TIMEOUT=30000          # 30 secondes max par requête

# Monitoring (optionnel, développement uniquement)
DEBUG_DB_POOL=false     # Activer les logs de monitoring du pool
```

### Limites selon les plans Supabase

| Plan       | Connexions max | DB_POOL_MAX recommandé |
| ---------- | -------------- | ---------------------- |
| Free       | ~4             | 3                      |
| Pro        | ~60            | 20-30                  |
| Team       | ~200           | 50-100                 |
| Enterprise | Illimité       | 100-200                |

**⚠️ Important :** Ne jamais dépasser le nombre de connexions max de votre plan Supabase.

---

## 📝 Variables d'environnement complètes

Ajoutez ces variables à votre fichier `.env` :

```bash
# Redis (optionnel - pour scaling horizontal)
REDIS_URL=redis://localhost:6379
# Ou pour Redis Cloud:
# REDIS_URL=redis://:password@host:port

# PostgreSQL Pool Configuration
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=2000
DB_QUERY_TIMEOUT=30000

# Monitoring (développement uniquement)
DEBUG_DB_POOL=false
```

---

## ✅ Tests et vérification

### 1. Vérifier que Redis fonctionne

```bash
# Tester la connexion Redis
redis-cli ping
# Devrait répondre: PONG
```

### 2. Démarrer le serveur

```bash
npm run dev
```

Vous devriez voir dans les logs :

**Avec Redis configuré :**

```
✅ Redis Publisher connecté
✅ Redis Subscriber connecté
✅ Redis initialisé avec succès - Socket.IO peut maintenant scaler horizontalement
✅ Socket.IO Redis Adapter activé - Scaling horizontal disponible
✅ Pool PostgreSQL initialisé (max: 20, min: 2)
🚀 Serveur lancé sur 0.0.0.0:4000
```

**Sans Redis (mode standalone) :**

```
⚠️  REDIS_URL non configuré - Socket.IO fonctionnera en mode standalone (non scalable)
ℹ️  Socket.IO fonctionne en mode standalone (Redis non disponible)
✅ Pool PostgreSQL initialisé (max: 20, min: 2)
🚀 Serveur lancé sur 0.0.0.0:4000
```

### 3. Tester avec plusieurs instances

Pour tester le scaling horizontal :

1. **Démarrer plusieurs instances du serveur** (sur des ports différents) :

   ```bash
   # Terminal 1
   PORT=4000 npm run dev

   # Terminal 2
   PORT=4001 npm run dev
   ```

2. **Connecter des clients à chaque instance**

3. **Créer une commande depuis l'instance 1**
   - Les drivers connectés à l'instance 2 devraient aussi recevoir la commande
   - Si Redis fonctionne, tous les serveurs partagent les événements Socket.IO

### 4. Monitoring du pool PostgreSQL

Si `DEBUG_DB_POOL=true`, vous verrez des logs toutes les 30 secondes :

```
📊 Pool PostgreSQL stats: { totalCount: 5, idleCount: 3, waitingCount: 0 }
```

---

## 🐛 Dépannage

### Problème : Redis ne se connecte pas

**Erreur :** `❌ Erreur lors de l'initialisation Redis: connect ECONNREFUSED`

**Solutions :**

1. Vérifier que Redis est démarré : `redis-cli ping`
2. Vérifier l'URL Redis dans `.env`
3. Vérifier le firewall/ports
4. Pour Redis Cloud, vérifier les credentials

**Fallback :** Le serveur fonctionnera sans Redis en mode standalone.

### Problème : Trop de connexions PostgreSQL

**Erreur :** `too many clients already`

**Solutions :**

1. Réduire `DB_POOL_MAX` dans `.env`
2. Vérifier votre plan Supabase (limite de connexions)
3. Vérifier qu'il n'y a pas de connexions qui fuient

### Problème : Socket.IO ne partage pas les événements entre serveurs

**Symptôme :** Les événements Socket.IO ne sont pas partagés entre plusieurs instances.

**Solutions :**

1. Vérifier que Redis est bien connecté (logs au démarrage)
2. Vérifier que `REDIS_URL` est correct
3. Vérifier que tous les serveurs utilisent le même Redis

### Problème : Performance dégradée

**Symptôme :** Le serveur est lent sous charge.

**Solutions :**

1. Augmenter `DB_POOL_MAX` (sans dépasser la limite Supabase)
2. Vérifier les indexes en base de données
3. Activer Redis pour le caching
4. Monitorer avec `DEBUG_DB_POOL=true`

---

## 📊 Monitoring en production

### Métriques à surveiller

1. **Pool PostgreSQL**

   - `totalCount` : Nombre total de connexions
   - `idleCount` : Connexions disponibles
   - `waitingCount` : Requêtes en attente d'une connexion

2. **Redis**

   - Latence de connexion
   - Mémoire utilisée
   - Nombre de connexions

3. **Socket.IO**
   - Nombre de connexions actives
   - Événements par seconde
   - Latence des événements

### Outils recommandés

- **Sentry** : Déjà configuré pour les erreurs
- **Redis Insight** : Monitoring Redis (gratuit)
- **Supabase Dashboard** : Monitoring de la base de données
- **New Relic / Datadog** : Monitoring complet (payant)

---

## 🎯 Prochaines étapes

Une fois Redis et le pool PostgreSQL configurés :

1. ✅ **Tests de charge** : Tester avec 50+ commandes simultanées
2. ✅ **Monitoring** : Configurer des alertes pour les métriques critiques
3. ✅ **Scaling horizontal** : Déployer plusieurs instances derrière un load balancer
4. ✅ **Caching** : Utiliser Redis pour cacher les données fréquemment accédées

---

## 📚 Ressources

- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [Redis Documentation](https://redis.io/docs/)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [PostgreSQL Pool Configuration](https://node-postgres.com/features/pooling)

---

## ⚠️ Notes importantes

1. **Redis est optionnel** : Le serveur fonctionne sans Redis, mais ne pourra pas scaler horizontalement
2. **Pool PostgreSQL** : Ne jamais dépasser les limites de votre plan Supabase
3. **Production** : Toujours utiliser Redis Cloud ou un Redis managé en production
4. **Sécurité** : Protéger votre Redis avec un mot de passe fort en production
