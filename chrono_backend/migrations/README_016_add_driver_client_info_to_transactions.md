# Migration 016: Ajouter les informations du livreur et du client à la table transactions

## Description

Cette migration ajoute des colonnes à la table `transactions` existante pour stocker les informations du livreur et du client directement dans la transaction. Cela permet de faire des requêtes simples sans jointures complexes.

## Colonnes ajoutées

### Informations du livreur
- `driver_id` : UUID du livreur (copié depuis `orders.driver_id`)
- `driver_first_name` : Prénom du livreur
- `driver_last_name` : Nom du livreur
- `driver_email` : Email du livreur
- `driver_phone` : Téléphone du livreur

### Informations du client
- `client_first_name` : Prénom du client
- `client_last_name` : Nom du client
- `client_email` : Email du client
- `client_phone` : Téléphone du client

## Installation

### 1. Exécuter la migration SQL

Exécutez le fichier `016_add_driver_client_info_to_transactions.sql` dans votre base de données Supabase :

```sql
-- Via l'éditeur SQL de Supabase ou psql
\i chrono_backend/migrations/016_add_driver_client_info_to_transactions.sql
```

### 2. Initialiser les données existantes

Après avoir créé les colonnes, initialisez-les avec toutes les transactions existantes :

```sql
SELECT initialize_transactions_driver_client_info();
```

Cette fonction va :
- Parcourir toutes les transactions existantes
- Récupérer les informations du livreur depuis `orders.driver_id` → `users`
- Récupérer les informations du client depuis `orders.user_id` → `users`
- Mettre à jour chaque transaction avec ces informations

### 3. Vérifier que les triggers fonctionnent

Les triggers sont automatiquement créés et vont maintenir les colonnes à jour :
- Quand une transaction est créée/modifiée → `trg_transactions_update_driver_client_info`
- Quand une order change (driver_id ou user_id) → `trg_orders_update_transactions_info`

Pour tester, créez une nouvelle transaction et vérifiez que les colonnes sont remplies automatiquement.

## Utilisation

### Requêtes simplifiées

Maintenant, vous pouvez faire des requêtes simples sans jointures :

```sql
-- Toutes les transactions d'un livreur avec les infos du client
SELECT 
  t.*,
  t.driver_first_name,
  t.driver_last_name,
  t.client_first_name,
  t.client_last_name,
  t.client_email
FROM transactions t
WHERE t.driver_id = 'driver_id_here';

-- Courses en attente de paiement pour un livreur
SELECT 
  t.order_id,
  t.client_first_name,
  t.client_last_name,
  t.amount,
  t.partial_amount,
  t.remaining_amount
FROM transactions t
JOIN orders o ON t.order_id = o.id
WHERE t.driver_id = 'driver_id_here'
  AND o.status = 'completed'
  AND (t.remaining_amount > 0 OR t.is_partial = true OR t.payment_method_type = 'deferred');
```

## Avantages

1. **Performance** : Plus besoin de faire des jointures avec `orders` et `users` pour avoir les noms
2. **Simplicité** : Les informations sont directement dans la table `transactions`
3. **Maintenance automatique** : Les triggers maintiennent les colonnes à jour automatiquement
4. **Pas de nouvelle table** : On utilise la table existante, pas besoin de créer une nouvelle table

## Notes importantes

- Les colonnes sont remplies automatiquement via des triggers
- Si vous modifiez directement les tables `orders` ou `users` en dehors de l'application, les triggers se déclencheront automatiquement
- Pour les modifications en masse, il peut être plus efficace de désactiver temporairement les triggers, faire les modifications, puis réinitialiser les données

## Désactiver temporairement les triggers (si nécessaire)

```sql
-- Désactiver
ALTER TABLE transactions DISABLE TRIGGER trg_transactions_update_driver_client_info;
ALTER TABLE orders DISABLE TRIGGER trg_orders_update_transactions_info;

-- Réactiver
ALTER TABLE transactions ENABLE TRIGGER trg_transactions_update_driver_client_info;
ALTER TABLE orders ENABLE TRIGGER trg_orders_update_transactions_info;

-- Réinitialiser après modifications
SELECT initialize_transactions_driver_client_info();
```

