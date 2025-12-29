# 🔧 Fix : Connexion IPv4 à Supabase

## ❌ Problème

L'erreur `getaddrinfo ENOTFOUND db.gglpozefhtzgakivvfxm.supabase.co` est causée par l'incompatibilité IPv4 de la connexion directe Supabase.

**Erreur dans les logs :**
```
getaddrinfo ENOTFOUND db.gglpozefhtzgakivvfxm.supabase.co
```

## ✅ Solution : Utiliser le Session Pooler

Le Session Pooler de Supabase est compatible IPv4 et fonctionne sur le port **6543** au lieu de **5432**.

### Étape 1 : Modifier `DATABASE_URL` dans `.env`

**Ancienne configuration (Direct connection - IPv6 uniquement) :**
```bash
DATABASE_URL=postgresql://postgres:TJWycbE36g_*kk@db.gglpozefhtzgakivvfxm.supabase.co:5432/postgres
```

**Nouvelle configuration (Session Pooler - Compatible IPv4) :**
```bash
DATABASE_URL=postgresql://postgres:TJWycbE36g_*kk@db.gglpozefhtzgakivvfxm.supabase.co:6543/postgres?pgbouncer=true
```

### Changements :
- ✅ Port changé de `5432` → `6543`
- ✅ Paramètre ajouté : `?pgbouncer=true`

### Étape 2 : Redémarrer le backend

```bash
cd chrono_backend
npm run dev
```

### Étape 3 : Vérifier la connexion

Tu devrais voir dans les logs :
```
✅ Pool PostgreSQL initialisé (max: 20, min: 2)
```

Au lieu de :
```
❌ getaddrinfo ENOTFOUND db.gglpozefhtzgakivvfxm.supabase.co
```

---

## 📝 Notes importantes

### Session Pooler vs Direct Connection

| Caractéristique | Direct Connection | Session Pooler |
|----------------|-------------------|----------------|
| **Port** | 5432 | 6543 |
| **IPv4** | ❌ Non compatible | ✅ Compatible |
| **IPv6** | ✅ Compatible | ✅ Compatible |
| **Connexions persistantes** | ✅ Oui | ⚠️ Limitées |
| **Recommandé pour** | VMs, containers | Applications web, développement |

### Limitations du Session Pooler

- ⚠️ **Pas de transactions longues** : Les transactions doivent être courtes (< 1 minute)
- ⚠️ **Pas de préparations de requêtes** : Certaines fonctionnalités avancées peuvent ne pas fonctionner
- ⚠️ **Connexions limitées** : Le pooler gère les connexions différemment

**Pour notre cas d'usage (backend Node.js avec pool de connexions), le Session Pooler est parfait !**

---

## 🔍 Vérification dans Supabase Dashboard

1. Va dans **Settings > Database**
2. Clique sur **"Pooler settings"** dans le modal de connexion
3. Sélectionne **"Session mode"** (recommandé pour notre cas)
4. Copie la connection string avec le port **6543**

---

## ✅ Résultat attendu

Après cette modification :
- ✅ Plus d'erreurs `ENOTFOUND`
- ✅ Connexion à la base de données fonctionnelle
- ✅ Toutes les requêtes SQL fonctionnent
- ✅ L'admin dashboard affiche les données

---

## 🆘 Si ça ne fonctionne toujours pas

1. **Vérifier que le Session Pooler est activé** dans Supabase Dashboard
2. **Vérifier le mot de passe** dans la connection string
3. **Vérifier la connectivité réseau** : `ping db.gglpozefhtzgakivvfxm.supabase.co`
4. **Vérifier les logs du backend** pour d'autres erreurs

