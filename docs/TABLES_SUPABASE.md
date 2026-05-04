# Tables Supabase — PROJET KRONO

> Dernière mise à jour : 2026-05-04  
> Base : `gglpozefhtzgakivvfxm.supabase.co` — schéma `public`  
> Total : **42 tables** — 24 actives, 18 vides

---

## Comptage des lignes (snapshot du 2026-05-04)

| Table | Lignes |
|---|---|
| `order_status_history` | 2 180 |
| `orders` | 595 |
| `driver_locations` | 551 |
| `invoices` | 533 |
| `transactions` | 533 |
| `admin_notification_feed` | 517 |
| `order_assignments` | 494 |
| `order_status_push_sent` | 332 |
| `conversations` | 91 |
| `live_activity_tokens` | 58 |
| `push_tokens` | 9 |
| `ratings` | 8 |
| `users` | 7 |
| `profiles` | 5 |
| `messages` | 4 |
| `fleet_vehicles` | 2 |
| `driver_profiles` | 2 |
| `payment_methods` | 2 |
| `commission_balance` | 1 |
| `partner_subscriptions` | 1 |
| `partners` | 1 |
| `partner_users` | 1 |
| `track_web_push_subscriptions` | 1 |
| `qr_code_scans` | 11 |
| `batch_orders` | **0** |
| `commission_transactions` | **0** |
| `delivery_batches` | **0** |
| `delivery_mileage_logs` | **0** |
| `driver_payouts` | **0** |
| `driver_wallet_transactions` | **0** |
| `driver_wallets` | **0** |
| `notification_campaign_deliveries` | **0** |
| `notifications` | **0** |
| `otp_codes` | **0** |
| `partner_drivers` | **0** |
| `partner_invoices` | **0** |
| `partner_usage` | **0** |
| `payment_disputes` | **0** |
| `vehicle_documents` | **0** |
| `vehicle_financial_summary` | **0** |
| `vehicle_fuel_logs` | **0** |
| `vehicle_maintenance` | **0** |

---

## Rôle de chaque table

### Commandes

| Table | Rôle |
|---|---|
| `orders` | Table centrale — chaque commande de livraison (client, adresse, prix, statut, driver assigné). |
| `order_assignments` | Historique des assignations d'une commande à un livreur (accepté, refusé, réassigné). |
| `order_status_history` | Log immuable de tous les changements de statut d'une commande (pending → accepted → delivering → delivered). |
| `order_status_push_sent` | Anti-doublon : enregistre les push notifications déjà envoyées pour un changement de statut donné. |

### Livraisons groupées (Batch)

| Table | Rôle |
|---|---|
| `delivery_batches` | Header d'une tournée de livraison groupée — lié à un partner ou un user, avec un driver assigné. |
| `batch_orders` | Table de liaison `delivery_batches` ↔ `orders` avec la position optimisée dans la tournée. |
| `delivery_mileage_logs` | Kilométrage parcouru par livraison — destiné au suivi GPS de la distance réelle. |

### Utilisateurs & Authentification

| Table | Rôle |
|---|---|
| `users` | Comptes utilisateurs de base (email, téléphone, rôle : client / driver / admin). |
| `profiles` | Profil étendu de l'utilisateur (nom, avatar, préférences). Complète `users`. |
| `otp_codes` | Codes OTP temporaires pour la vérification téléphonique — supprimés après validation. |

### Livreurs

| Table | Rôle |
|---|---|
| `driver_profiles` | Profil métier du livreur (type : `internal` ou `partner`, véhicule, statut de disponibilité). |
| `driver_locations` | Positions GPS en temps réel des livreurs (lat, lng, heading, timestamp). |
| `driver_payouts` | Virements que **Krono verse aux livreurs** (Orange Money, Wave, virement bancaire) — module non encore activé, mais rôle futur réel. À garder. |
| ~~`driver_wallets`~~ | ~~Orpheline — aucune référence dans le backend. Les gains sont calculés depuis `orders`, les commissions via `commission_balance`. **Supprimée le 2026-05-04.**~~ |
| ~~`driver_wallet_transactions`~~ | ~~Orpheline — même situation que `driver_wallets`. **Supprimée le 2026-05-04.**~~ |

### Commissions (livreurs partenaires)

| Table | Rôle |
|---|---|
| `commission_balance` | Solde de commission prépayé d'un livreur de type `partner` — suspendu si solde < minimum. |
| `commission_transactions` | Historique des recharges et déductions de commission (créé par les fonctions SQL `recharge_commission_balance` et `deduct_commission`). |

### Partners B2B

| Table | Rôle |
|---|---|
| `partners` | Entreprises partenaires B2B (nom, taux de commission, statut). |
| `partner_users` | Utilisateurs appartenant à un partner (ex : gestionnaire de compte B2B). |
| `partner_drivers` | Livreurs dédiés à un partner spécifique. |
| `partner_subscriptions` | Abonnement actif d'un partner (plan : starter / pro / business, quota de commandes incluses, taux hors-quota). |
| `partner_usage` | Compteur mensuel de livraisons B2B par partner — compare avec le quota de l'abonnement. |
| `partner_invoices` | Factures générées automatiquement par `partnerInvoiceJob.ts` pour facturer les partners. |

### Paiements & Finances

| Table | Rôle |
|---|---|
| `transactions` | Toutes les transactions financières de la plateforme (paiements clients, remboursements). |
| `invoices` | Factures client associées aux commandes livrées. |
| `payment_methods` | Méthodes de paiement enregistrées par les utilisateurs (carte, mobile money, etc.). |
| `payment_disputes` | Litiges de paiement ouverts par les clients ou les partenaires. |

### Flotte de véhicules

| Table | Rôle |
|---|---|
| `fleet_vehicles` | Véhicules de la flotte (plaque, type, assignation à un livreur). |
| `vehicle_documents` | Documents administratifs par véhicule (assurance, carte grise, contrôle technique) avec dates d'expiration. |
| `vehicle_maintenance` | Maintenances planifiées et réalisées par véhicule (type, coût, prestataire). |
| `vehicle_fuel_logs` | Journaux de ravitaillement en carburant (quantité, prix, kilométrage). |
| `vehicle_financial_summary` | Résumé financier périodique par véhicule (coûts vs revenus générés). |

### Notifications & Push

| Table | Rôle |
|---|---|
| `push_tokens` | Tokens Expo Push enregistrés par appareil pour l'envoi de notifications mobiles. |
| `live_activity_tokens` | Tokens APNs iOS pour les Live Activities (suivi en temps réel sur l'écran verrouillé). |
| `track_web_push_subscriptions` | Abonnements Web Push pour le tracking de livraison côté navigateur (destinataires). |
| `notifications` | Notifications in-app — table présente mais non utilisée en prod (remplacée par Expo Push direct). |
| `admin_notification_feed` | Fil de notifications de l'interface admin (alertes, événements importants). |
| `notification_campaign_deliveries` | Suivi des envois de campagnes marketing push (qui a reçu quoi, quand). |

### Messagerie

| Table | Rôle |
|---|---|
| `conversations` | Fils de discussion entre client et livreur associés à une commande. |
| `messages` | Messages individuels dans une conversation (texte, type, timestamp). |

### Divers

| Table | Rôle |
|---|---|
| `ratings` | Notes et avis laissés par les clients après une livraison (score, commentaire). |
| `qr_code_scans` | Historique des scans QR code (confirmation de remise en main propre). |

---

## Tables vides — Analyse détaillée

### Groupe 1 — Features implémentées, pas encore utilisées en prod

| Table | Raison |
|---|---|
| `batch_orders` | Aucune tournée créée via `POST /api/batches` — feature B2B non encore activée en prod. |
| `delivery_batches` | Même raison que `batch_orders` — le header de tournée n'a jamais été créé. |
| `commission_transactions` | Le seul livreur partner existant n'a pas encore complété de commande déclenchant une déduction. |
| `partner_usage` | Le partner existe (`partners` = 1 ligne) mais n'a pas encore passé de commandes ce mois-ci. |
| `partner_drivers` | Feature de livreurs dédiés B2B non encore configurée pour le partner actuel. |
| `partner_invoices` | `partnerInvoiceJob.ts` tourne mais aucune facture n'a encore été générée (pas de livraisons B2B facturables). |
| `driver_payouts` | Module de virement livreur non encore activé. **À ne pas supprimer** — stockera les virements que Krono verse aux livreurs via Orange Money / Wave quand le module sera activé. |
| `notification_campaign_deliveries` | `notificationCampaignService.ts` est actif mais aucune campagne n'a encore ciblé d'utilisateurs. |
| `payment_disputes` | Aucun litige ouvert — normal en début d'activité. |

### Groupe 2 — Module Flotte non alimenté

| Table | Raison |
|---|---|
| `vehicle_documents` | 2 véhicules existent dans `fleet_vehicles` mais aucun document n'a été uploadé via l'interface admin. |
| `vehicle_fuel_logs` | Aucun ravitaillement enregistré via `POST /fleet/vehicles/:plate/fuel`. |
| `vehicle_maintenance` | Aucune maintenance saisie via `POST /fleet/vehicles/:plate/maintenance`. |
| `vehicle_financial_summary` | Se remplit via un job ou une saisie manuelle non encore exécutée. |
| `delivery_mileage_logs` | La collecte GPS du kilométrage par livraison n'est pas encore activée en prod. |

### Groupe 3 — Tables orphelines ou obsolètes

| Table | Raison |
|---|---|
| ~~`driver_wallets`~~ | **Supprimée** — aucune référence dans le backend. Les gains livreurs sont calculés dynamiquement depuis `orders`, les commissions via `commission_balance`. Doublon inutile. |
| ~~`driver_wallet_transactions`~~ | **Supprimée** — même situation que `driver_wallets`. |
| `notifications` | Remplacée par le système Expo Push direct (`push_tokens` + `expoPushService.ts`) — table devenue inutile. |
| `otp_codes` | Les codes sont supprimés automatiquement après validation — la table est donc vide en permanence ou le système OTP est désactivé. |

---

## Actions recommandées

| Priorité | Action |
|---|---|
| Faible | Supprimer ou archiver `notifications` si le système Expo Push la remplace définitivement. |
| Fait | ~~`driver_wallets` / `driver_wallet_transactions`~~ supprimées le 2026-05-04 — orphelines, doublons de `commission_balance`. |
| Moyenne | Alimenter le module Flotte (documents, carburant, maintenance) depuis l'interface admin. |
| Haute | Activer les tournées B2B (`delivery_batches` / `batch_orders`) une fois les premiers partners opérationnels. |
