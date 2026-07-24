# Audit des tables Supabase (projet `krono_delivery`)

Audit réalisé le 2026-07-24 : croisement entre les 42 tables réellement présentes dans le projet Supabase `krono_delivery` (via `list_tables`), leur usage réel dans le code (`krono_backend`, `admin_krono`, `app_krono`, `driver_krono`), et leur contenu réel (`COUNT(*)` exécuté le 2026-07-24 — le champ `rows` renvoyé par l'API Supabase est une estimation souvent fausse, donc ignoré ici).

## Tables UTILISÉES (42 tables Supabase)

**Utilisateurs & identité**
| Table | Lignes | Rôle | Utilisée par |
|---|---:|---|---|
| `users` | 9 | Compte utilisateur de base (auth, rôle) | `authController.ts` et quasi tout le backend |
| `profiles` | 6 | Infos de profil client | RPC `fn_create_order` via `orderRecordController.ts`, `batchController.ts` |
| `driver_profiles` | 2 | Profil livreur (véhicule, statut) | `authController.ts`, `driverController.ts`, `fleetController.ts` |
| `otp_codes` | 0 | Codes OTP avec expiration | service OTP backend — vide car les codes expirent/sont nettoyés en continu, normal |
| `refresh_tokens` | 0 | Tokens JWT longue durée | `utils/jwt.ts` — vide car rotation/expiration continue, normal ; ⚠️ table **absente des migrations versionnées** du repo |

**Commandes & livraison**
| Table | Lignes | Rôle | Utilisée par |
|---|---:|---|---|
| `orders` | 669 | Commandes de livraison | `orderStorage.ts`, `orderRecordController.ts`, `deliveryController.ts` |
| `order_assignments` | 552 | Attribution commande↔livreur | `orderStorage.ts`, `ratingController.ts` |
| `order_status_history` | 2 246 | Historique des statuts | `orderStorage.ts` |
| `qr_code_scans` | 25 | Scans QR (confirmation retrait/livraison) | `qrCodeService.ts` |
| `driver_locations` | 741 | Historique GPS livreur (throttlé) | `driverLocationAuditService.ts` |
| `delivery_batches` | 27 | Regroupement commandes en tournée | `batchController.ts`, `orderSocketBatch.ts` |
| `batch_orders` | 54 | Lien commande↔tournée | `batchController.ts`, `orderSocketBatch.ts` |
| `delivery_mileage_logs` | 0 | Km + revenus par livraison | `fleetController.ts` — **table utilisée dans le code mais jamais alimentée en pratique**, à vérifier |

**Paiement & finance**
| Table | Lignes | Rôle | Utilisée par |
|---|---:|---|---|
| `payment_methods` | 2 | Méthodes de paiement (cash/deferred auto) | `paymentController.ts` |
| `transactions` | 543 | Transactions de paiement | `paymentController.ts`, stats `deliveryController.ts` |
| `invoices` | 543 | Factures de livraison | `paymentController.ts` |
| `payment_disputes` | 0 | Litiges de paiement | `paymentController.ts`, `adminModerationController.ts` — vide car aucun litige créé pour l'instant, normal |
| `commission_balance` | 1 | Solde commission prépayée (livreurs partenaires) | `commissionController.ts`, `commissionService.ts` |
| `commission_transactions` | 0 | Historique mouvements commission | `commissionService.ts`, `adminDriverController.ts` — vide alors que `commission_balance` a 1 ligne, à vérifier |

**Flotte de véhicules**
| Table | Lignes | Rôle | Utilisée par |
|---|---:|---|---|
| `fleet_vehicles` | 2 | Véhicules de la flotte | `fleetController.ts` |
| `vehicle_fuel_logs` | 0 | Ravitaillements carburant/électrique | `fleetController.ts` — vide, aucun plein enregistré pour l'instant |
| `vehicle_maintenance` | 0 | Historique/planning maintenance | `fleetController.ts` — vide, aucune maintenance enregistrée pour l'instant |
| `vehicle_documents` | 0 | Documents légaux (carte grise, assurance...) | `fleetController.ts` — vide, aucun document uploadé pour l'instant |
| `vehicle_financial_summary` | 0 | Résumé financier calculé par véhicule | `fleetController.ts` — vide, dépend des 3 tables ci-dessus (encore vides) |

**Messagerie & notifications**
| Table | Lignes | Rôle | Utilisée par |
|---|---:|---|---|
| `conversations` | 105 | Chat admin/client/driver | services de messagerie backend |
| `messages` | 4 | Messages échangés | services de messagerie backend |
| `push_tokens` | 9 | Tokens Expo Push | routes/services push |
| `track_web_push_subscriptions` | 1 | Abonnements push web (suivi colis web) | `trackWebPushService.ts` |
| `order_status_push_sent` | 451 | Anti-doublon des push par statut | `recipientOrderNotifyService.ts` |
| `live_activity_tokens` | 134 | Tokens APNs Live Activity iOS | `liveActivityApnsService.ts` |
| `notification_campaign_deliveries` | 0 | Anti-spam campagnes de réengagement | `notificationCampaignService.ts` — vide, aucune campagne envoyée pour l'instant |
| `admin_notification_feed` | 592 | Flux d'événements pour l'admin | `adminNotificationPersistService.ts` |

**Évaluations**
| Table | Lignes | Rôle | Utilisée par |
|---|---:|---|---|
| `ratings` | 17 | Notes des livreurs par les clients | `ratingController.ts` |

**Portail partenaire B2B**
| Table | Lignes | Rôle | Utilisée par |
|---|---:|---|---|
| `partners` | 1 | Comptes entreprises partenaires | `partnerRoutes.ts`, `admin_krono` |
| `partner_users` | 2 | Utilisateurs rattachés à un partenaire | idem |
| `partner_drivers` | 0 | Livreurs rattachés à un partenaire | idem — vide, aucun livreur affecté pour l'instant |
| `partner_driver_requests` | 1 | Demandes de rattachement livreur↔partenaire | idem |
| `partner_subscriptions` | 1 | Formule d'abonnement du partenaire | idem |
| `partner_usage` | 1 | Consommation (base de facturation) | idem |
| `partner_invoices` | 0 | Factures partenaires | idem — vide, aucune facture générée pour l'instant |
| `partner_audit_logs` | 0 | Journal d'audit des actions partenaire | idem — vide, aucune action auditée pour l'instant |

## Récapitulatif — tables avec données vs tables vides

**Tables avec des données réelles (29/42)**, du plus rempli au moins rempli :
`order_status_history` (2 246), `driver_locations` (741), `orders` (669), `admin_notification_feed` (592), `order_assignments` (552), `invoices` (543), `transactions` (543), `order_status_push_sent` (451), `live_activity_tokens` (134), `conversations` (105), `batch_orders` (54), `delivery_batches` (27), `qr_code_scans` (25), `ratings` (17), `push_tokens` (9), `users` (9), `profiles` (6), `messages` (4), `driver_profiles` (2), `fleet_vehicles` (2), `partner_users` (2), `payment_methods` (2), `commission_balance` (1), `partner_driver_requests` (1), `partner_subscriptions` (1), `partner_usage` (1), `partners` (1), `track_web_push_subscriptions` (1).

**Tables vides — 0 ligne (13/42)** :
| Table | Explication probable |
|---|---|
| `otp_codes` | Normal — les codes OTP expirent et sont nettoyés en continu |
| `refresh_tokens` | Normal — rotation/expiration continue des tokens |
| `payment_disputes` | Normal — aucun litige créé pour l'instant |
| `commission_transactions` | ⚠️ À vérifier — `commission_balance` a 1 ligne (donc de la commission a été créditée) mais aucun mouvement historisé |
| `delivery_mileage_logs` | ⚠️ À vérifier — le code d'auto-log existe (`autoLogDeliveryMileage`) mais rien n'a encore été écrit |
| `vehicle_fuel_logs` | Normal — aucun plein enregistré pour l'instant (feature flotte peu utilisée) |
| `vehicle_maintenance` | Normal — aucune maintenance enregistrée pour l'instant |
| `vehicle_documents` | Normal — aucun document uploadé pour l'instant |
| `vehicle_financial_summary` | Normal — dépend des 3 tables flotte ci-dessus, encore vides |
| `notification_campaign_deliveries` | Normal — aucune campagne de réengagement envoyée pour l'instant |
| `partner_drivers` | Normal — aucun livreur encore affecté à un partenaire |
| `partner_invoices` | Normal — aucune facture partenaire générée pour l'instant |
| `partner_audit_logs` | Normal — aucune action partenaire auditée pour l'instant |
| `driver_payouts` | Cohérent — cette table n'est **pas utilisée dans le code** (voir section suivante), donc personne n'y écrit |

## Correctifs appliqués le 2026-07-24

Suite à l'audit, le code parlant à des tables inexistantes a été supprimé :

- **`deliveries`** — `createDelivery` (POST `/api/deliveries`, INSERT dans `deliveries`) supprimée : fonction + route retirées, aucun frontend ne l'appelait. Le bloc `UPDATE deliveries` dans `updateDeliveryStatus` a été retiré (le reste de la fonction — notifications, commission, kilométrage — repose sur `activeOrders`/`orders` et fonctionne normalement).
- **`driver_badges`** (gamification) — feature entièrement orpheline (aucun frontend n'appelait `/api/gamification`, y compris la page `admin_krono/gamification` qui consomme en réalité `/api/analytics/performance`). Route, contrôleur, service et test supprimés en entier : `gamificationRoutes.ts`, `gamificationController.ts`, `gamificationService.ts`, `gamificationController.test.ts`, plus le montage dans `app.ts`.
- **`support_tickets`** — feature jamais appelée par aucun frontend (même `/api/support/faq`, qui pourtant ne touchait pas la base). Route, contrôleur, service et test supprimés en entier : `supportRoutes.ts`, `supportController.ts`, `supportService.ts`, `supportController.test.ts`, plus le montage dans `app.ts`.
- `npx tsc --noEmit` passe sans erreur après ces suppressions.

**`delivery_proofs` volontairement laissée de côté** — contrairement aux trois cas ci-dessus, ce n'est pas du code mort : `saveDeliveryProofRecord()` (`orderStorage.ts:757`) est appelée activement à chaque preuve de livraison (via socket `orderSocket.ts:2534` et `batchController.ts:854`). Supprimer ce code ferait disparaître l'enregistrement des preuves de livraison (photo/OTP) au lieu de corriger le bug — la vraie table `delivery_proofs` devrait plutôt être recréée par migration. À traiter séparément.

## Tables présentes en base mais NON utilisées dans le code

| Table | Lignes | Constat |
|---|---:|---|
| `driver_payouts` | 0 | Créée en base, mais **une seule occurrence dans tout le repo — un simple commentaire** dans `driver_krono/app/profile/payments.tsx:7`. Aucune requête réelle, cohérent avec 0 ligne. Candidate à implémenter (versements livreurs) ou à supprimer si abandonnée. |

*(Note : les tables `promo_codes`, `client_profiles`, `partner_profiles`, `drivers`, `reviews`, `driver_vehicles`, `loyalty_transactions`, `driver_status_logs`, `addresses`, `driver_wallets`, `payments`, `notifications` — évoquées dans d'anciennes migrations ou README — n'existent **plus du tout** dans la base Supabase actuelle : elles ont déjà été supprimées par les migrations `013_cleanup_unused_tables.sql` et `014_cleanup_final_tables.sql`. Rien à nettoyer côté base sur ces noms-là.)*

## ⚠️ Problème actif détecté : code qui interroge des tables inexistantes (état avant correctif)

Ce sont des **bugs latents**, pas de la simple table "inutilisée" :

- **`deliveries`** — supprimée en migration 014, mais `deliveryController.ts` (`createDelivery`, `updateDeliveryStatus`) continuait de faire des requêtes dessus. ✅ **Corrigé** (voir section correctifs ci-dessus).
- **`delivery_proofs`** — supprimée en 014, mais `orderStorage.ts:760` (`saveDeliveryProofRecord`, `INSERT INTO delivery_proofs`) la référence toujours, appelée activement depuis `orderSocket.ts` et `batchController.ts`. ⏳ **Pas corrigé** — décision à prendre (voir section correctifs).
- **`driver_badges`** — jamais créée en prod (README : migration gamification jamais construite), mais `gamificationController.ts`/`gamificationService.ts` l'interrogeaient et `/api/gamification` était **monté** dans `app.ts` → endpoint cassé si appelé. ✅ **Corrigé** (feature entière supprimée).
- **`support_tickets`** — même situation : jamais créée, mais `supportService.ts` l'interrogeait et `/api/support` était monté dans `app.ts` → endpoint cassé. ✅ **Corrigé** (feature entière supprimée).

## Cas particulier
- **`promo_codes`** — pas de migration versionnée ; `adminModerationController.ts` fait un `CREATE TABLE IF NOT EXISTS` au runtime avant utilisation. Explique pourquoi elle n'apparaît pas dans la liste Supabase actuelle (jamais encore exécutée sur ce projet).
