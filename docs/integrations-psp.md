# Intégrations Orange Money, Wave, MTN (roadmap)

Ce document prépare le travail **hors code** : accords marchands et accès API auprès des opérateurs.

## Périmètre

- **Paiement course** : initier un encaissement, recevoir le statut (succès / échec), idempotence, webhooks.
- **Recharge commission livreur partenaire** : même principe, montants crédités seulement après confirmation PSP.
- **Pas de duplication** des QR « paiement » des opérateurs dans l’app Chrono — voir `docs/paiements-krono.md`.

## Étapes typiques côté entreprise

1. **Compte marchand / agrégateur** auprès d’Orange Money, Wave, ou d’un **agrégateur** agréé (souvent plus simple qu’un contrat direct par opérateur).
2. Récupération des **clés API**, URLs **sandbox** puis **production**, documentation des **webhooks** (signature, retries).
3. **Conformité** : KYC, conditions d’utilisation, plafonds, litiges et remboursements (produit + juridique).
4. Brancher dans `chrono_backend` : `paymentController`, `commissionController` (remplacer les parties « simulation » par appels PSP + persistance `transactions` / `commission_transactions`).

## Fichiers à faire évoluer (indicatif)

- `chrono_backend/src/controllers/paymentController.ts`
- `chrono_backend/src/controllers/commissionController.ts`
- Variables d’environnement (clés API, secrets webhook) — **ne pas commiter** ; documenter dans `.env.example` sans valeurs réelles.

## Ressources

- Contacter les **équipes entreprise / API** des opérateurs concernés (Sénégal ou pays cible).
- Mettre à jour ce fichier avec les **liens officiels** de documentation une fois les accès obtenus.
