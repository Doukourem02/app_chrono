# Audit KRONO — 2026-07-22

Audit de sécurité et de cohérence du monorepo (backend Node/TS, admin_chrono, app_chrono, driver_chrono, Supabase).

**Note globale au moment de l'audit : 5/10**

Les fondamentaux étaient solides (pas de secrets en dur, `.env` bien ignorés par git, JWT correct, CORS/helmet actifs, RLS présente sur les tables cœur, calculs financiers en `NUMERIC`), mais deux failles critiques permettaient de manipuler de l'argent réel dans le flux commission/paiement, et un taux de commission en code contredisait une décision déjà validée.

**Mise à jour 2026-07-22 (même jour)** : tous les points indépendants de l'intégration mobile money ont été corrigés (voir statuts ci-dessous). Il ne reste ouvert que ce qui dépend de l'intégration réelle des opérateurs économiques, plus deux chantiers volontairement mis de côté car trop larges pour un correctif ponctuel (#10, #14).

## Statut en un coup d'œil

| # | Sujet | Statut |
| --- | --- | --- |
| 1 | Recharge commission sans paiement | ⏳ bloqué — intégration opérateur requise |
| 2 | Dette marquée payée sans confirmation | ⏳ bloqué — intégration opérateur requise |
| 3 | Aucun webhook mobile money | ⏳ bloqué — intégration opérateur requise |
| 4 | Taux de commission B2B incohérent | ✅ corrigé |
| 5 | Pas de verrou sur déduction commission | ✅ corrigé et **appliqué en base** (2026-07-22) |
| 6 | IDOR routes `/check` | ✅ corrigé |
| 7 | Pas de révocation de session | ✅ corrigé (route `/logout` ajoutée) |
| 8 | Rate-limit OTP contournable par IP | ✅ corrigé |
| 9 | RLS absente sur tables B2B | ✅ faux positif — RLS déjà en place, voir note |
| 10 | Statuts de commande incohérents entre apps | 📄 plan documenté, voir `docs/plan_unification_statuts_commande.md` — implémentation non lancée |
| 11 | Client Redis OTP mal fermé | ✅ corrigé |
| 12 | Comparaison OTP non constant-time | ✅ corrigé |
| 13 | Code mort `otpService.ts` | ✅ corrigé (supprimé) |
| 14 | Écart de version Expo entre apps | ⏳ en attente — chantier dédié à planifier |
| 15 | Pas de dossier `types/` dans driver_chrono | ⏳ en attente — lié à #10 |

Type-check (`tsc --noEmit`) et suite de tests (`npm test`, 234 tests) passés après tous les correctifs, sans régression.

---

## 🔴 Bloqué — nécessite l'intégration réelle des opérateurs mobile money

Ces 3 points existent parce que l'intégration avec les opérateurs (Orange Money, MTN, Wave, etc.) n'a pas encore été faite — le code actuel est un stub/simulation volontaire (garde-fou explicite dans `mobileMoneyService.ts:257-271` qui bloque le mobile money réel en prod). **Non corrigeables avant cette intégration** ; à reprendre à ce moment-là.

### 1. Recharge de commission sans paiement
`chrono_backend/src/controllers/commissionController.ts:262-282` — `POST /commission/:userId/recharge` crédite le solde directement sans jamais vérifier un paiement mobile money réel.

### 2. Dette marquée "payée" sans confirmation réelle
`chrono_backend/src/controllers/paymentController.ts:829-852` (`repayDeferred`) — seul `paymentResult.success` est testé, pas `paymentResult.status`.

### 3. Aucun webhook/callback mobile money implémenté
`checkPaymentStatus` (`mobileMoneyService.ts:224-250`) est un stub qui renvoie toujours `pending`. Cause racine des points #1 et #2 : à construire en même temps que l'intégration API.

---

## ✅ Corrigé le 2026-07-22

### 4. Taux de commission B2B
`chrono_backend/src/services/b2bCommissionService.ts` — `QUOTA_COMMISSION` remis à `starter 5% / pro 3% / business 2%` conformément à la grille v2 validée le 2026-05-04 (le code affichait encore `3%/2%/0%`, une ancienne grille).

### 5. Verrou + idempotence sur la déduction de commission
Nouvelle migration `chrono_backend/migrations/042_commission_deduction_lock_idempotency.sql` :
- `deduct_commission()` verrouille désormais la ligne (`FOR UPDATE`) avant de lire/modifier le solde.
- Contrainte unique `commission_transactions_order_deduction_uidx` empêchant deux déductions pour la même commande.

**✅ Appliquée en base le 2026-07-22** (projet Supabase `chrono_delivery`). Vérifié après coup : aucun doublon de déduction préexistant (la requête de diagnostic n'a rien remonté), index unique et verrou `FOR UPDATE` confirmés présents sur la fonction en production.

### 6. IDOR sur `/check/:email` et `/check-by-id/:userId`
`chrono_backend/src/controllers/authController.ts` — ajout du même contrôle d'ownership que sur `updateUserProfile`/`getUserProfile` : un utilisateur ne peut consulter que son propre compte (sauf rôle admin/super_admin).

### 7. Révocation de session
Ajout de la route `POST /api/auth-simple/logout` (`authRoutes.ts`, `authController.ts::logoutUser`), protégée par `verifyJWT`, qui appelle `revokeRefreshToken()` — fonction qui existait déjà mais n'était jamais utilisée.

### 8. Rate-limiting OTP contournable par rotation d'IP
`bruteForceProtection.ts` et `rateLimiter.ts` (`otpLimiter`) : la clé de verrouillage priorise désormais le téléphone normalisé, puis l'e-mail, et ne retombe sur l'IP qu'en dernier recours (via le helper `ipKeyGenerator` d'express-rate-limit pour rester compatible IPv6).

### 9. RLS sur les tables B2B — faux positif, corrigé dans le rapport
Vérification faite : la RLS **est** activée sur `commission_balance`, `commission_transactions` (migration 016), `partners`, `partner_users`, `partner_drivers` (032), `partner_subscriptions`, `partner_usage`, `partner_invoices` (033), `payment_disputes` (030) — directement dans les fichiers de migration concernés, avec des policies `"Service role full access"` (accès refusé à `anon`/`authenticated`, seul le backend en `service_role` passe). Le premier passage d'audit n'avait regardé que `supabase/RLS_POLICIES.sql`, qui ne liste pas ces tables mais ne reflète pas le schéma complet. **Aucune action nécessaire.**

### 11. Client Redis OTP mal fermé
`otpStorage.ts` et `bruteForceProtection.ts` : le handler d'erreur Redis ferme désormais proprement l'ancien client (`quit()`/`disconnect()`) et ne réinitialise la référence module que si elle pointe toujours vers ce client précis (évite d'écraser un client plus récent créé entre-temps).

### 12. Comparaison OTP non constant-time
`otpStorage.ts` : comparaison du code OTP (Redis, mémoire, et fallback DB) désormais via `crypto.timingSafeEqual`.

### 13. Code mort `otpService.ts`
Fichier supprimé (confirmé non importé nulle part).

---

## ⏳ En attente — chantiers plus larges, non traités dans cette passe

Ces points sont indépendants de l'intégration mobile money, mais leur ampleur/risque de régression justifie une passe dédiée plutôt qu'un correctif rapide mêlé aux autres.

### 10. Statuts de commande incohérents entre les 4 apps
Plan documenté dans `docs/plan_unification_statuts_commande.md`, avec vérité terrain confirmée directement en base : l'enum réel `order_status` a **11 valeurs**, aucune des 4 apps ne les couvre. Risque concret identifié : `app_chrono/app/summary.tsx` compare le statut à `confirmed`/`delivered`, des valeurs absentes de l'enum DB (`accepted`/`completed` sont les vraies) — à vérifier en priorité. Implémentation non lancée, en attente de validation du plan.

### 14. Écart de version Expo/React Native entre `app_chrono` (Expo 55) et `driver_chrono` (Expo 54)
Un bump de SDK Expo touche le code natif (iOS/Android, Pods, config plugins) des deux apps — trop risqué pour être fait en passant, à traiter comme son propre chantier avec tests de build dédiés.

### 15. Pas de dossier `types/` centralisé dans `driver_chrono`
Conséquence directe du point #10 — à traiter dans le même chantier.

---

## ✅ Points positifs vérifiés (toujours valables)

- Aucun secret en dur nulle part, `.env` réels bien ignorés par git dans les 4 apps.
- `JWT_SECRET` obligatoire ≥32 caractères imposé au boot, refresh tokens hashés SHA-256 + rotation one-time-use en base.
- Validation stricte des entrées (Joi) : OTP à 6 chiffres, téléphone au format E.164.
- `helmet` avec CSP/HSTS actifs, CORS en allowlist stricte.
- Montants calculés en `NUMERIC` côté SQL, taux de commission calculé côté serveur uniquement.
- Logs qui masquent téléphones et montants.
- Garde-fou explicite qui bloque le mobile money réel hors production.
- `chrono_backend/src/config/db.ts` : pool bien configuré, pas de credentials en dur.
- `chrono_backend/migrations/README.md` à jour, doublons de préfixes de migration documentés.
- URLs d'API dev/prod cohérentes entre les 3 apps front, pas de mélange environnement.

## Prochaines étapes suggérées

1. Valider le plan `docs/plan_unification_statuts_commande.md` (#10) avant de lancer l'implémentation.
2. Planifier séparément le chantier #14 (alignement Expo).
3. Revenir sur #1/#2/#3 au moment de démarrer l'intégration réelle d'un opérateur mobile money.
