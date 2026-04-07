# Migrations SQL — `chrono_backend`

Ce dossier décrit le **schéma Postgres** attendu par l’API Node. Les fichiers **ne s’exécutent pas tout seuls** : tu les lances dans l’ordre (SQL Editor Supabase, `psql`, ou script maison).

## Ordre d’exécution (fichiers réellement présents)

| # | Fichier | Rôle principal |
|---|---------|----------------|
| 1 | `001_create_users_with_roles.sql` | `users`, profils |
| 2 | `002_add_roles_to_existing_users.sql` | Rôles |
| 3 | `003_adapt_to_existing_users.sql` | Adaptation utilisateurs |
| 4 | `004_fix_users_constraint.sql` | Contraintes `users` |
| 5 | `005_create_driver_profiles.sql` | `driver_profiles` |
| 6 | `006_create_otp_codes_table.sql` | `otp_codes` (**ne pas supprimer**, voir 014) |
| 7 | `007_create_orders_table.sql` | `orders` |
| 8 | `008_create_fn_create_order.sql` | RPC `fn_create_order` |
| 9 | `009_create_order_assignments.sql` | `order_assignments` |
| 10 | `010_create_ratings_table.sql` | `ratings` |
| 11 | `011_add_driver_id_to_orders.sql` | Colonne `driver_id` |
| 12 | `012_create_missing_driver_profiles.sql` | Profils chauffeurs manquants |
| 13 | `013_cleanup_unused_tables.sql` | Suppressions (lire avant d’exécuter) |
| 14 | `014_cleanup_final_tables.sql` | Nettoyage ( **`otp_codes` n’est plus supprimée** ) |
| 15 | `015_add_recipient_to_orders.sql` | Destinataire sur `orders` |
| 16a | `016_create_commission_system.sql` | Commissions |
| 16b | `016_add_qr_codes_to_orders.sql` | QR + `qr_code_scans` |
| 17a | `017_add_driver_type.sql` | `driver_type` |
| 17b | `017_add_tracking_token_to_orders.sql` | `tracking_token` |
| 18 | `018_create_gamification_tables.sql` | `driver_badges` |
| 19 | `019_create_support_tables.sql` | `support_tickets` |
| 20 | `020_driver_locations_and_admin_notifications.sql` | `driver_locations`, `admin_notification_feed` |
| 21 | `021_payment_messaging_history_profiles.sql` | `profiles` (minimal), `payment_methods`, `transactions`, `invoices`, `order_status_history`, `conversations`, `messages` |
| 22 | `022_qr_code_scans_unique_order_scanner.sql` | Index unique `(order_id, scanned_by)` sur `qr_code_scans` (requis pour les `ON CONFLICT` du service QR) |
| 23 | `023_create_push_tokens.sql` | `push_tokens` — Expo push (client / driver), voir `docs/notifications-expo-token.md` |
| 24 | `024_users_name_avatar_columns.sql` | `users.first_name`, `last_name`, `avatar_url` — requis pour compléter le profil (app livreur / client) |

**Important — doublons `016_` et `017_`** : deux fichiers partagent le même préfixe. L’ordre **lexicographique** des noms de fichier est :

- `016_add_qr_codes_to_orders.sql` **puis** `016_create_commission_system.sql`
- `017_add_driver_type.sql` **puis** `017_add_tracking_token_to_orders.sql`

Si ton instance a été montée dans un autre ordre, **ne réordonne pas rétroactivement** une base déjà en prod : documente l’ordre réel appliqué.

## Autres dossiers liés au schéma

- **`admin_chrono/migrations/`** : flotte (`fleet_vehicles`, carburant, entretien, etc.) + scripts RLS. À exécuter **en plus** selon la doc ou l’ordre métier (souvent après les tables `users` / `driver_profiles`).
- **`supabase/RLS_POLICIES.sql`** (etc.) : **politiques RLS**, pas la liste complète des `CREATE TABLE`.

## Tables que ce repo ne recrée pas ici

Certaines tables peuvent exister chez toi (dashboard Supabase, anciens scripts) **sans** `CREATE` dans ce dossier, par ex. :

- `notifications` (schéma historique variable — voir commentaire migration 020)
- `driver_wallets`, `driver_wallet_transactions`, `driver_payouts`
- tout ce qui vient d’extensions Supabase / SQL manuel

Pour une **nouvelle** base vide : enchaîne **001 → 023** comme ci-dessus, puis **admin_chrono** + **RLS** si besoin.

## Règles

- **Ne modifie pas** un fichier déjà appliqué en prod : ajoute `022_...sql`.
- **013 / 014** suppriment des tables : lis-les avant ; sauvegarde si doute.
- Tester sur une copie / projet de dev avant la prod.
