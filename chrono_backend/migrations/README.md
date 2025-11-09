# Migrations de la Base de Données

Ce dossier contient toutes les migrations SQL nécessaires pour créer et maintenir la structure de la base de données.

## 📋 Ordre d'exécution

Les migrations doivent être exécutées dans l'ordre numérique suivant :

1. **001_create_users_with_roles.sql** - Création de la table `users` avec système de rôles
2. **002_add_roles_to_existing_users.sql** - Ajout des rôles aux utilisateurs existants
3. **003_adapt_to_existing_users.sql** - Adaptation des utilisateurs existants
4. **004_fix_users_constraint.sql** - Correction des contraintes sur la table `users`
5. **005_create_driver_profiles.sql** - Création de la table `driver_profiles` avec statut online/offline
6. **006_create_otp_codes_table.sql** - Création de la table `otp_codes` pour l'authentification OTP
7. **007_create_orders_table.sql** - Création de la table `orders`
8. **008_create_fn_create_order.sql** - Fonction RPC pour créer des commandes
9. **009_create_order_assignments.sql** - Création de la table `order_assignments`
10. **010_create_ratings_table.sql** - Création de la table `ratings`
11. **011_add_driver_id_to_orders.sql** - Ajout de la colonne `driver_id` à la table `orders`
12. **012_create_missing_driver_profiles.sql** - Création des profils chauffeurs manquants
13. **013_cleanup_unused_tables.sql** - Nettoyage des tables inutilisées (drivers, reviews)
14. **014_cleanup_final_tables.sql** - Nettoyage final des tables inutilisées
15. **015_add_recipient_to_orders.sql** - Ajout des informations destinataire aux commandes
16. **016_create_payment_methods_table.sql** - Création de la table `payment_methods` pour les méthodes de paiement (Orange Money, Wave, Cash, Paiement différé)
17. **017_create_transactions_table.sql** - Création de la table `transactions` pour les transactions de paiement
18. **018_create_invoices_table.sql** - Création de la table `invoices` pour les factures
19. **019_add_payment_fields_to_orders.sql** - Ajout des champs de paiement à la table `orders`
20. **020_add_work_time_to_driver_profiles.sql** - Ajout de la gestion du temps de travail aux chauffeurs (10h max/jour)
21. **021_create_payment_disputes_table.sql** - Création de la table `payment_disputes` pour les litiges de paiement
22. **022_add_split_payment_fields.sql** - Ajout des champs pour le paiement partiel et paiement par destinataire
23. **023_drop_payments_table.sql** - Suppression de la table `payments` si elle existe (non utilisée, remplacée par `transactions`)

## 🚀 Exécution

### Via Supabase Dashboard

1. Connectez-vous à votre projet Supabase
2. Allez dans **SQL Editor**
3. Exécutez chaque fichier dans l'ordre numérique
4. Vérifiez les messages de confirmation dans la console

### Via psql

```bash
# Exécuter toutes les migrations dans l'ordre
for file in $(ls -1 *.sql | sort -V); do
  echo "Exécution de $file..."
  psql $DATABASE_URL -f $file
done
```

### Via Node.js (script)

```bash
cd chrono_backend
node scripts/run-migrations.js
```

## ⚠️ Notes importantes

- **Ne modifiez jamais** les migrations déjà exécutées en production
- **Créez une nouvelle migration** si vous devez modifier une table existante
- Testez toujours les migrations dans un environnement de développement avant la production
- Les migrations 013 et 014 suppriment des tables - assurez-vous qu'elles ne sont plus utilisées

## 📊 Structure de la base de données

### Tables principales

- `users` - Utilisateurs (clients et chauffeurs)
- `profiles` - Profils utilisateurs
- `driver_profiles` - Profils chauffeurs avec statut online/offline
- `orders` - Commandes de livraison
- `order_assignments` - Assignations des commandes aux chauffeurs
- `ratings` - Notes et commentaires
- `otp_codes` - Codes OTP pour l'authentification
- `payment_methods` - Méthodes de paiement des utilisateurs (Orange Money, Wave, Cash, Paiement différé)
- `transactions` - Transactions de paiement
- `invoices` - Factures pour les commandes
- `payment_disputes` - Litiges de paiement et réclamations

### Tables de nettoyage (supprimées)

Les migrations 013 et 014 suppriment les tables suivantes :
- `drivers` (remplacée par `driver_profiles`)
- `reviews` (remplacée par `ratings.comment`)
- `driver_vehicles` (non utilisée)
- `loyalty_transactions` (non utilisée)
- `driver_status_logs` (non utilisée)
- `delivery_proofs` (remplacée par un autre système)
- `addresses` (adresses stockées en JSONB dans `orders`)

## 🔄 Rollback

Pour revenir en arrière, il faudra créer des migrations de rollback manuelles. Les migrations ne sont pas prévues pour être annulées automatiquement.

## 📝 Création d'une nouvelle migration

Pour créer une nouvelle migration :

1. Créez un fichier avec le numéro suivant : `016_description.sql`
2. Ajoutez des commentaires explicatifs
3. Testez dans un environnement de développement
4. Documentez les changements dans ce README

