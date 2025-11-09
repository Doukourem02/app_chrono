# Tests

Ce dossier contient les tests pour le backend Chrono Livraison.

## 🧪 Structure des tests

```
tests/
├── setup.js          # Configuration globale
├── auth.test.js      # Tests d'authentification
├── order.test.js     # Tests de création et gestion de commandes
├── driver.test.js    # Tests des fonctionnalités chauffeur
└── README.md         # Ce fichier
```

## 🚀 Installation des dépendances de test

```bash
cd chrono_backend
npm install
```

Cela installera toutes les dépendances nécessaires, y compris :
- `jest` - Framework de test
- `@jest/globals` - Types globaux Jest
- `supertest` - Tests HTTP
- `@types/supertest` - Types TypeScript pour supertest
- `ts-jest` - Support TypeScript pour Jest

## 📝 Configuration Jest

La configuration Jest est dans `jest.config.ts` à la racine du backend.

Elle supporte :
- TypeScript avec `ts-jest`
- Modules ES (ESM)
- Tests TypeScript (`.test.ts`) et JavaScript (`.test.js`)

La configuration est automatiquement chargée par Jest.

## ▶️ Exécution des tests

```bash
# Exécuter tous les tests
npm test

# Exécuter un fichier de test spécifique
npm test -- auth.test.js

# Exécuter en mode watch
npm test -- --watch

# Exécuter avec couverture de code
npm test -- --coverage
```

## 📋 Tests à implémenter

Les fichiers de tests sont créés avec des structures de base. Il faut maintenant :

1. **Configurer l'environnement de test**
   - Créer une base de données de test
   - Configurer les mocks pour Supabase
   - Configurer les mocks pour les services externes

2. **Implémenter les tests d'authentification** (`auth.test.js`)
   - Génération et vérification OTP
   - Création de tokens JWT
   - Validation des entrées

3. **Implémenter les tests de commandes** (`order.test.js`)
   - Création de commandes
   - Calcul de prix et durée
   - Assignation de chauffeurs
   - Mises à jour de statut

4. **Implémenter les tests chauffeurs** (`driver.test.js`)
   - Mise à jour de position
   - Gestion du statut online/offline
   - Acceptation et complétion de commandes

## 🔧 Configuration recommandée

### Base de données de test

Créez une base de données séparée pour les tests :

```bash
createdb chrono_test
export TEST_DATABASE_URL=postgresql://user:password@localhost:5432/chrono_test
```

### Variables d'environnement de test

Créez un fichier `.env.test` :

```bash
NODE_ENV=test
DATABASE_URL=postgresql://user:password@localhost:5432/chrono_test
JWT_SECRET=test-jwt-secret
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
```

## 📊 Coverage

Après avoir implémenté les tests, vous pouvez vérifier la couverture :

```bash
npm test -- --coverage
```

Objectif : **> 80% de couverture** pour les flows critiques.

## 🐛 Dépannage

### Erreur "Cannot find module"

Assurez-vous que les dépendances sont installées :
```bash
npm install
```

### Erreur de connexion à la base de données

Vérifiez que :
- La base de données de test existe
- `TEST_DATABASE_URL` est correctement configuré
- Les migrations de test sont exécutées

### Tests qui échouent

- Vérifiez les mocks des services externes
- Assurez-vous que les données de test sont nettoyées entre les tests
- Vérifiez les timeouts pour les tests asynchrones

