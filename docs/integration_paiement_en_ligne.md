# Intégration paiement en ligne — reste à faire

Remplace `docs/audit_krono.md` (audit du 2026-07-22, terminé — contenu utile déplacé dans `docs/krono-reference-unique.md`). Ce fichier ne contient que ce qui reste bloqué par l'intégration réelle d'un opérateur mobile money (Orange Money, MTN, Wave...).

**Pourquoi ces 3 points sont ouverts** : le code actuel est un stub/simulation volontaire — garde-fou explicite dans `mobileMoneyService.ts:257-271` qui bloque le mobile money réel en production tant que `MOBILE_MONEY_REAL_INTEGRATION_ENABLED` n'est pas mis à `true`. Non corrigeables avant l'intégration ; à reprendre à ce moment-là.

## 1. Recharge de commission sans paiement — trou de sécurité fermé le 2026-07-23

`chrono_backend/src/controllers/commissionController.ts` — `POST /commission/:userId/recharge` créditait le solde directement **sans jamais appeler** `initiateMobileMoneyPayment`, donc sans jamais passer par le garde-fou de production décrit ci-dessus. C'était un vrai trou exploitable en prod (contrairement aux points #2 et #3, correctement protégés par le garde-fou), pas juste une limitation du stub — corrigé : l'endpoint appelle maintenant `initiateMobileMoneyPayment` avant tout crédit, donc bloqué en production tant que `MOBILE_MONEY_REAL_INTEGRATION_ENABLED` n'est pas activé, comme le reste du système de paiement.

Reste à faire au moment de l'intégration réelle (comme les points #2 et #3) : appeler l'API réelle de l'opérateur et ne créditer qu'après confirmation du callback/webhook — actuellement le crédit a lieu dès que `initiateMobileMoneyPayment` renvoie `success: true`, ce qui n'arrivera qu'en dev/test tant que l'intégration réelle n'est pas branchée.

## 2. Dette marquée "payée" sans confirmation réelle

`chrono_backend/src/controllers/paymentController.ts:829-852` (`repayDeferred`) — seul `paymentResult.success` est testé, pas `paymentResult.status`.

À faire : vérifier le statut réel renvoyé par l'opérateur avant de marquer la dette réglée.

## 3. Aucun webhook/callback mobile money implémenté

`checkPaymentStatus` (`mobileMoneyService.ts:224-250`) est un stub qui renvoie toujours `pending`. Cause racine des points #1 et #2.

À faire : construire le webhook signé + retries + idempotence en même temps que l'intégration API (voir aussi `docs/krono-reference-unique.md` section 7 "PSP mobile money plus tard" pour le travail hors code : compte marchand, clés API, KYC, litiges).

## Travail hors code (préalable, à faire par l'utilisateur)

- Compte marchand / agrégateur pour Orange Money, Wave, MTN.
- Clés API sandbox puis production.
- KYC, gestion des litiges et remboursements côté opérateur.

## Une fois l'intégration commencée

Brancher `paymentController`, `commissionController` et les transactions sur l'API réelle, puis supprimer ce fichier et documenter l'état final dans `docs/krono-reference-unique.md` (section 7).
