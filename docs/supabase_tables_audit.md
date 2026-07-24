# Audit des tables Supabase (projet `krono_delivery`)

Audit réalisé le 2026-07-24 : croisement entre les 42 tables réellement présentes dans le projet Supabase `krono_delivery` (via `list_tables`) et leur usage réel dans le code (`krono_backend`, `admin_krono`, `app_krono`, `driver_krono`).

## Tables UTILISÉES (42 tables Supabase)

**Utilisateurs & identité**
| Table | Rôle | Utilisée par |
|---|---|---|
| `users` | Compte utilisateur de base (auth, rôle) | `authController.ts` et quasi tout le backend |
| `profiles` | Infos de profil client | RPC `fn_create_order` via `orderRecordController.ts`, `batchController.ts` |
| `driver_profiles` | Profil livreur (véhicule, statut) | `authController.ts`, `driverController.ts`, `fleetController.ts` |
| `otp_codes` | Codes OTP avec expiration | service OTP backend |
| `refresh_tokens` | Tokens JWT longue durée | `utils/jwt.ts` — ⚠️ utilisée mais **absente des migrations versionnées** du repo |

**Commandes & livraison**
| Table | Rôle | Utilisée par |
|---|---|---|
| `orders` | Commandes de livraison | `orderStorage.ts`, `orderRecordController.ts`, `deliveryController.ts` |
| `order_assignments` | Attribution commande↔livreur | `orderStorage.ts`, `ratingController.ts` |
| `order_status_history` | Historique des statuts | `orderStorage.ts` |
| `qr_code_scans` | Scans QR (confirmation retrait/livraison) | `qrCodeService.ts` |
| `driver_locations` | Historique GPS livreur (throttlé) | `driverLocationAuditService.ts` |
| `delivery_batches` / `batch_orders` | Regroupement commandes en tournée | `batchController.ts`, `orderSocketBatch.ts` |
| `delivery_mileage_logs` | Km + revenus par livraison | `fleetController.ts` |

**Paiement & finance**
| Table | Rôle | Utilisée par |
|---|---|---|
| `payment_methods` | Méthodes de paiement (cash/deferred auto) | `paymentController.ts` |
| `transactions` | Transactions de paiement | `paymentController.ts`, stats `deliveryController.ts` |
| `invoices` | Factures de livraison | `paymentController.ts` |
| `payment_disputes` | Litiges de paiement | `paymentController.ts`, `adminModerationController.ts` |
| `commission_balance` | Solde commission prépayée (livreurs partenaires) | `commissionController.ts`, `commissionService.ts` |
| `commission_transactions` | Historique mouvements commission | `commissionService.ts`, `adminDriverController.ts` |

**Flotte de véhicules**
| Table | Rôle | Utilisée par |
|---|---|---|
| `fleet_vehicles` | Véhicules de la flotte | `fleetController.ts` |
| `vehicle_fuel_logs` | Ravitaillements carburant/électrique | `fleetController.ts` |
| `vehicle_maintenance` | Historique/planning maintenance | `fleetController.ts` |
| `vehicle_documents` | Documents légaux (carte grise, assurance...) | `fleetController.ts` |
| `vehicle_financial_summary` | Résumé financier calculé par véhicule | `fleetController.ts` |

**Messagerie & notifications**
| Table | Rôle | Utilisée par |
|---|---|---|
| `conversations` / `messages` | Chat admin/client/driver | services de messagerie backend |
| `push_tokens` | Tokens Expo Push | routes/services push |
| `track_web_push_subscriptions` | Abonnements push web (suivi colis web) | `trackWebPushService.ts` |
| `order_status_push_sent` | Anti-doublon des push par statut | `recipientOrderNotifyService.ts` |
| `live_activity_tokens` | Tokens APNs Live Activity iOS | `liveActivityApnsService.ts` |
| `notification_campaign_deliveries` | Anti-spam campagnes de réengagement | `notificationCampaignService.ts` |
| `admin_notification_feed` | Flux d'événements pour l'admin | `adminNotificationPersistService.ts` |

**Évaluations**
| Table | Rôle | Utilisée par |
|---|---|---|
| `ratings` | Notes des livreurs par les clients | `ratingController.ts` |

**Portail partenaire B2B**
| Table | Rôle | Utilisée par |
|---|---|---|
| `partners` | Comptes entreprises partenaires | `partnerRoutes.ts`, `admin_krono` |
| `partner_users` | Utilisateurs rattachés à un partenaire | idem |
| `partner_drivers` / `partner_driver_requests` | Livreurs rattachés / demandes de rattachement | idem |
| `partner_subscriptions` | Formule d'abonnement du partenaire | idem |
| `partner_usage` | Consommation (base de facturation) | idem |
| `partner_invoices` | Factures partenaires | idem |
| `partner_audit_logs` | Journal d'audit des actions partenaire | idem |

## Correctifs appliqués le 2026-07-24

Suite à l'audit, le code parlant à des tables inexistantes a été supprimé :

- **`deliveries`** — `createDelivery` (POST `/api/deliveries`, INSERT dans `deliveries`) supprimée : fonction + route retirées, aucun frontend ne l'appelait. Le bloc `UPDATE deliveries` dans `updateDeliveryStatus` a été retiré (le reste de la fonction — notifications, commission, kilométrage — repose sur `activeOrders`/`orders` et fonctionne normalement).
- **`driver_badges`** (gamification) — feature entièrement orpheline (aucun frontend n'appelait `/api/gamification`, y compris la page `admin_krono/gamification` qui consomme en réalité `/api/analytics/performance`). Route, contrôleur, service et test supprimés en entier : `gamificationRoutes.ts`, `gamificationController.ts`, `gamificationService.ts`, `gamificationController.test.ts`, plus le montage dans `app.ts`.
- **`support_tickets`** — feature jamais appelée par aucun frontend (même `/api/support/faq`, qui pourtant ne touche pas la DB). Route, contrôleur, service et test supprimés en entier : `supportRoutes.ts`, `supportController.ts`, `supportService.ts`, `supportController.test.ts`, plus le montage dans `app.ts`.
- `npx tsc --noEmit` passe sans erreur après ces suppressions.

**`delivery_proofs` volontairement laissée de côté** — contrairement aux trois cas ci-dessus, ce n'est pas du code mort : `saveDeliveryProofRecord()` (`orderStorage.ts:757`) est appelée activement à chaque preuve de livraison (via socket `orderSocket.ts:2534` et `batchController.ts:854`). Supprimer ce code ferait disparaître l'enregistrement des preuves de livraison (photo/OTP) au lieu de corriger le bug — la vraie table `delivery_proofs` devrait plutôt être recréée par migration. À traiter séparément.

## Tables présentes en base mais NON utilisées dans le code

| Table | Constat |
|---|---|
| `driver_payouts` | Créée en base, mais **une seule occurrence dans tout le repo — un simple commentaire** dans `driver_krono/app/profile/payments.tsx:7`. Aucune requête réelle. Candidate à implémenter (versements livreurs) ou à supprimer si abandonnée. |

*(Note : les tables `promo_codes`, `client_profiles`, `partner_profiles`, `drivers`, `reviews`, `driver_vehicles`, `loyalty_transactions`, `driver_status_logs`, `addresses`, `driver_wallets`, `payments`, `notifications` — évoquées dans d'anciennes migrations ou README — n'existent **plus du tout** dans la base Supabase actuelle : elles ont déjà été supprimées par les migrations `013_cleanup_unused_tables.sql` et `014_cleanup_final_tables.sql`. Rien à nettoyer côté base sur ces noms-là.)*

## ⚠️ Problème actif détecté : code qui interroge des tables inexistantes (état avant correctif)

Ce sont des **bugs latents**, pas de la simple table "inutilisée" :

- **`deliveries`** — supprimée en migration 014, mais `deliveryController.ts` (`createDelivery`, `updateDeliveryStatus`) continuait de faire des requêtes dessus. ✅ **Corrigé** (voir section correctifs ci-dessus).
- **`delivery_proofs`** — supprimée en 014, mais `orderStorage.ts:760` (`saveDeliveryProofRecord`, `INSERT INTO delivery_proofs`) la référence toujours, appelée activement depuis `orderSocket.ts` et `batchController.ts`. ⏳ **Pas corrigé** — décision à prendre (voir section correctifs).
- **`driver_badges`** — jamais créée en prod (README : migration gamification jamais construite), mais `gamificationController.ts`/`gamificationService.ts` l'interrogeaient et `/api/gamification` était **monté** dans `app.ts` → endpoint cassé si appelé. ✅ **Corrigé** (feature entière supprimée).
- **`support_tickets`** — même situation : jamais créée, mais `supportService.ts` l'interrogeait et `/api/support` était monté dans `app.ts` → endpoint cassé. ✅ **Corrigé** (feature entière supprimée).

## Cas particulier
- **`promo_codes`** — pas de migration versionnée ; `adminModerationController.ts` fait un `CREATE TABLE IF NOT EXISTS` au runtime avant utilisation. Explique pourquoi elle n'apparaît pas dans la liste Supabase actuelle (jamais encore exécutée sur ce projet).
