# Migrations SQL — `chrono_backend`

Ce dossier décrit le **schéma Postgres** attendu par l'API Node. Les fichiers **ne s'exécutent pas tout seuls** : tu les lances dans l'ordre (SQL Editor Supabase, `psql`, ou script maison).

## Mise à jour 2026-07-22 — fichiers manquants reconstruits

Jusqu'au 2026-07-22, ce README listait les migrations 016 à 024 comme "réellement présentes"
alors que les fichiers `.sql` correspondants (016 à 022, 024) **n'existaient pas sur le disque** —
seule la table `023_create_push_tokens.sql` existait vraiment parmi cette plage. Le schéma avait
été appliqué directement en prod (Supabase) sans jamais être committé dans ce repo.

Ces fichiers ont été **régénérés le 2026-07-22 par introspection du schéma réel** du projet
Supabase `chrono_delivery` (colonnes, contraintes, index, fonctions et triggers vérifiés un par
un contre la prod) — ce ne sont pas des reconstitutions approximatives, mais ils portent quand
même un risque : l'ordre exact d'application historique et d'éventuelles migrations
intermédiaires depuis supprimées ne sont pas connus avec certitude. **Ne les considère pas comme
un historique git fiable, mais comme un chemin testé et honnête pour repartir d'une base vide.**

Exception : **018 (gamification) et 019 (support)** ne sont **pas** appliquées en prod
(`driver_badges` et `support_tickets` n'existent pas dans la base réelle) — ces migrations
n'ont jamais été construites. Aucun fichier n'a donc été recréé pour ces deux entrées ; si le
besoin revient, ce sera une nouvelle migration numérotée après `041`, pas une résurrection de 018/019.

## Ordre d'exécution (fichiers réellement présents sur le disque)

| #   | Fichier                                            | Rôle principal                                                                                                           | Statut |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --- |
| 1   | `001_create_users_with_roles.sql`                  | `users`, profils                                                                                                         | original |
| 2   | `002_add_roles_to_existing_users.sql`              | Rôles                                                                                                                    | original |
| 3   | `003_adapt_to_existing_users.sql`                  | Adaptation utilisateurs                                                                                                  | original |
| 4   | `004_fix_users_constraint.sql`                     | Contraintes `users`                                                                                                      | original |
| 5   | `005_create_driver_profiles.sql`                   | `driver_profiles`                                                                                                        | original |
| 6   | `006_create_otp_codes_table.sql`                   | `otp_codes` (**ne pas supprimer**, voir 014)                                                                             | original |
| 7   | `007_create_orders_table.sql`                      | `orders`                                                                                                                 | original |
| 8   | `008_create_fn_create_order.sql`                   | RPC `fn_create_order`                                                                                                    | original |
| 9   | `009_create_order_assignments.sql`                 | `order_assignments`                                                                                                      | original |
| 10  | `010_create_ratings_table.sql`                     | `ratings`                                                                                                                | original |
| 11  | `011_add_driver_id_to_orders.sql`                  | Colonne `driver_id`                                                                                                      | original |
| 12  | `012_create_missing_driver_profiles.sql`           | Profils chauffeurs manquants                                                                                             | original |
| 13  | `013_cleanup_unused_tables.sql`                    | Suppressions (lire avant d'exécuter)                                                                                     | original |
| 14  | `014_cleanup_final_tables.sql`                     | Nettoyage ( `**otp_codes` n'est plus supprimée** )                                                                       | original |
| 15  | `015_add_recipient_to_orders.sql`                  | Destinataire sur `orders`                                                                                                | original |
| 16a | `016_create_commission_system.sql`                 | `commission_balance`, `commission_transactions` + fonctions recharge/déduction                                          | **reconstruit 2026-07-22** |
| 16b | `016_add_qr_codes_to_orders.sql`                   | QR livraison sur `orders` + `qr_code_scans`                                                                             | **reconstruit 2026-07-22** |
| 17a | `017_add_driver_type.sql`                          | `driver_profiles.driver_type`                                                                                            | **reconstruit 2026-07-22** |
| 17b | `017_add_tracking_token_to_orders.sql`             | `orders.tracking_token`                                                                                                  | **reconstruit 2026-07-22** |
| 18  | *(aucun fichier)*                                  | Gamification (`driver_badges`) — **jamais construit en prod**, n'existe pas                                             | n/a |
| 19  | *(aucun fichier)*                                  | Support (`support_tickets`) — **jamais construit en prod**, n'existe pas                                                | n/a |
| 20  | `020_driver_locations_and_admin_notifications.sql` | `driver_locations`, `admin_notification_feed`                                                                            | **reconstruit 2026-07-22** |
| 21  | `021_payment_messaging_history_profiles.sql`       | `profiles` (minimal), `payment_methods`, `transactions`, `invoices`, `order_status_history`, `conversations`, `messages` | **reconstruit 2026-07-22** |
| 16c | `016_add_driver_client_info_to_transactions.sql`   | Colonnes livreur/client dénormalisées + triggers sur `transactions` — **dépend de 21, s'exécute après malgré le nom**   | **reconstruit 2026-07-22** |
| 22  | `022_qr_code_scans_unique_order_scanner.sql`       | Index unique `(order_id, scanned_by)` sur `qr_code_scans` (requis pour les `ON CONFLICT` du service QR)                  | **reconstruit 2026-07-22** |
| 23  | `023_create_push_tokens.sql`                       | `push_tokens` — Expo push (client / driver), voir `docs/krono-reference-unique.md`                                       | original |
| 24  | `024_users_name_avatar_columns.sql`                | `users.first_name`, `last_name`, `avatar_url` — requis pour compléter le profil (app livreur / client)                   | **reconstruit 2026-07-22** |
| 25  | `025_orders_recipient_user_id.sql`                 | `orders.recipient_user_id` — lien compte destinataire (push in-app)                                                      | original |
| 26  | `026_order_status_push_dedup.sql`                  | `order_status_push_sent` — anti-doublon notifications par `(order_id, status)`                                           | original |
| 27  | `027_live_activity_tokens.sql`                     | Tokens APNs Live Activity                                                                                                | original |
| 28  | `028_notification_campaign_deliveries.sql`         | Journal notifications de campagne                                                                                        | original |
| 29  | `029_add_delivery_verification_code.sql`           | Code de vérification livraison                                                                                           | original |
| 30  | `030_create_payment_disputes.sql`                  | `payment_disputes`                                                                                                       | original |
| 31  | `031_add_delivering_in_progress_statuses.sql`      | Statuts `delivering` / `in_progress` sur `order_status`                                                                  | original |
| 32-39 | `032_...` à `039_...`                            | Portail partenaire B2B (partners, abonnements, tournées, préférences livreur)                                            | original |
| 40  | `040_qr_code_scans_allow_delivery_proof_types.sql` | Autorise `qr_scan`, `manual_code` et les preuves alternatives B2B/batch dans `qr_code_scans.qr_code_type`                | original |
| 41  | `041_partner_dedicated_driver_requests.sql`        | Demandes de livreur dédié partenaire                                                                                     | original |
| 42  | `042_commission_deduction_lock_idempotency.sql`    | `FOR UPDATE` + contrainte unique sur `deduct_commission` (corrige audit_krono.md #5) — **non appliquée**, à exécuter manuellement | nouveau, 2026-07-22 |

**Important — doublons `016_` et `017_`** : plusieurs fichiers partagent le même préfixe. L'ordre **lexicographique** des noms de fichier est :

- `016_add_driver_client_info_to_transactions.sql`, `016_add_qr_codes_to_orders.sql`, `016_create_commission_system.sql` (ordre alphabétique) — **mais `016_add_driver_client_info_to_transactions.sql` dépend de la table `transactions` créée en 021 : sur une base vide, exécute-le après 021, pas à sa place alphabétique.**
- `017_add_driver_type.sql` **puis** `017_add_tracking_token_to_orders.sql`

Si ton instance a été montée dans un autre ordre, **ne réordonne pas rétroactivement** une base déjà en prod : documente l'ordre réel appliqué.

## Autres dossiers liés au schéma

- `**admin_chrono/migrations/`** : flotte (`fleet_vehicles`, carburant, entretien, etc.) + scripts RLS. À exécuter **en plus** selon la doc ou l'ordre métier (souvent après les tables `users` / `driver_profiles`).
- `**supabase/RLS_POLICIES.sql`** (etc.) : **politiques RLS**, pas la liste complète des `CREATE TABLE`.

## Tables que ce repo ne recrée pas ici

Certaines tables peuvent exister chez toi (dashboard Supabase, anciens scripts) **sans** `CREATE` dans ce dossier, par ex. :

- `notifications` (schéma historique variable — voir commentaire migration 020)
- `driver_wallets`, `driver_wallet_transactions` (voir `driver_payouts`, qui lui existe et n'est pas encore versionné ici)
- tout ce qui vient d'extensions Supabase / SQL manuel

Pour une **nouvelle base vide** : enchaîne **001 → 020 → 021 → 016_add_driver_client_info_to_transactions.sql → 022 → 023 → 024 → 025 → … → 041** (respecte la note ci-dessus sur l'ordre réel de `016_add_driver_client_info_to_transactions.sql`), puis **admin_chrono** + **RLS** si besoin. Ce chemin n'a pas encore été validé de bout en bout sur une base réellement vide (voir section suivante).

## Reste à faire pour une reconstructibilité totale

Cette régénération (2026-07-22) couvre le **schéma** (tables/colonnes/contraintes/fonctions/triggers)
tel qu'observé en prod. Elle ne couvre pas encore :

- les **politiques RLS** détaillées par table (le dossier `supabase/RLS_POLICIES.sql` existe mais n'a pas été comparé colonne par colonne à la prod dans le cadre de cette passe) ;
- un **test réel** "base Supabase vide → exécution de 001 à 041 → API qui démarre et fonctionne" ; à faire avant de considérer ce point totalement clos.

## Vérifier rapidement que **025** et **026** sont appliquées (prod / préprod)

Dans le SQL Editor (ou `psql`), exécuter :

```sql
-- 025 : colonnes destinataire pour push in-app
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('recipient_user_id', 'recipient_is_registered');

-- 026 : anti-doublon notifications par commande + statut
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'order_status_push_sent'
) AS order_status_push_sent_exists;
```

Attendu : **2 lignes** pour la première requête (`recipient_user_id`, `recipient_is_registered`), et `order_status_push_sent_exists = true` pour la seconde.

## Règles

- **Ne modifie pas** un fichier déjà appliqué en prod : ajoute `042_...sql`.
- **013 / 014** suppriment des tables : lis-les avant ; sauvegarde si doute.
- Tester sur une copie / projet de dev avant la prod.
