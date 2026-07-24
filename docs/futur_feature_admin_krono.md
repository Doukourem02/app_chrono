# Futures fonctionnalités — Admin Krono

Ce fichier liste les routes backend admin qui existent déjà côté `krono_backend`, mais qui n'ont **aucun bouton/écran correspondant dans `admin_krono`** aujourd'hui — vérifié en grepant le frontend, pas supposé. Tant qu'il n'y a pas d'écran, ce n'est pas une fonctionnalité réelle : pas de décision de droits (admin/super admin) à prendre dessus tant qu'elles ne sont pas construites.

Contexte : découvert le 2026-07-24 en travaillant sur la séparation des rôles `admin` / `super_admin` du dashboard (voir `docs/roles_admin_super_admin.md`).

---

## Créer une commande manuelle / téléphone

- Route backend : `POST /api/admin/orders` → `createAdminOrder` (`krono_backend/src/controllers/adminOrderController.ts`).
- État : fonctionnelle côté backend (géocodage pickup/dropoff, etc.), mais **aucun bouton "nouvelle commande" dans `admin_krono/app/(dashboard)/orders/page.tsx`**.
- Utilité potentielle : créer une commande pour un client qui appelle par téléphone (pas de compte app, ou hors-ligne). Cohérent avec les mentions `_chrono_admin`/`placed_by_admin` déjà documentées dans `docs/krono-reference-unique.md` section 16 (types de livraison), mais rien ne pointe vers cette route depuis l'UI aujourd'hui.

## Changer le statut d'un livreur

- Route backend : `PUT /api/admin/drivers/:driverId/status` → `updateAdminDriverStatus` (`adminDriverController.ts`).
- État : aucune UI trouvée (ni dans la fiche livreur, ni ailleurs) pour appeler cette route.
- À clarifier une fois construit : quel "statut" exactement (en ligne/hors ligne géré par le livreur lui-même normalement, vérifié/non vérifié, banni) — le champ visé par cette route n'a pas été audité en détail.

## Changer le taux de commission d'un livreur

- Route backend : `PUT /api/admin/drivers/:driverId/commission/rate` → `updateAdminDriverCommissionRate` (`adminDriverController.ts`).
- État : le taux (`commission_account.commission_rate`) est **affiché** dans la fiche livreur (`drivers/[driverId]/page.tsx`), mais rien pour le modifier.
- Point de vigilance pour plus tard : si ce champ existe pour des livreurs liés à un partenaire B2B (commission différente du taux standard), bien vérifier qu'on ne casse pas la logique `b2bCommissionService`/`QUOTA_COMMISSION` déjà en place avant d'exposer un bouton qui pourrait écraser un taux calculé automatiquement.

## Rédemption / application réelle d'un code promo

- Ce qui existe : `createAdminPromoCode`/`getAdminPromoCodes` (`adminModerationController.ts`) — admin peut créer/lister des codes, un vrai `INSERT INTO promo_codes` en base (table même créée à la volée via `CREATE TABLE IF NOT EXISTS` au premier appel — pas garantie d'exister en prod avant ça).
- Ce qui n'existe **pas** : aucun code dans `priceCalculator.ts`, `dynamicPricing.ts` ou la création de commande ne lit jamais `promo_codes` pour appliquer une réduction. Créer un code promo aujourd'hui n'a **aucun effet** sur le prix de quoi que ce soit pour un client.
- Côté client : `app_krono/app/profile/promo-codes.tsx` existe mais est masqué/pas branché (déjà noté en session du 2026-07-23 : pas d'API existante pour l'utiliser).
- À construire pour que la fonctionnalité soit réellement complète : un champ "code promo" à la validation de commande + une validation backend (code actif, pas expiré, pas au-delà de `max_uses`) + application de `discount_type`/`discount_value` sur le prix final.
- Découvert le 2026-07-24 en vérifiant (à la demande de l'utilisateur) si les fonctionnalités listées comme "déjà réelles" dans `docs/roles_admin_super_admin.md` fonctionnaient vraiment de bout en bout, pas juste "ont un bouton".

---

**Règle** : quand l'une de ces fonctionnalités est réellement construite (bouton + écran), la retirer d'ici et trancher à ce moment-là si elle est `admin` ou `super_admin` dans `docs/roles_admin_super_admin.md`.
