# Krono — référence unique (Côte d’Ivoire)

**Dernière mise à jour** : avril 2026  

**Rôle** : garder une **vérité produit** courte (monétisation future, règles paiements / QR, calibration marché, **roadmap PSP**). Le détail technique des tarifs déjà livrés est dans le code — voir **§1**.

**Règle** : évolutions tarif, trafic, météo, surge, distance routière et paiements restent **cohérentes** avec ce document (y compris **§5** intégrations opérateurs).

**Autre doc** : `driver_chrono/docs/navigation-suivi-livreur.md`.

---

## Vue d’ensemble

| Section | Contenu |
|--------|---------|
| [§1](#1-déjà-en-place-résumé-code) | Ce qui est implémenté (A–D) — pointeurs code |
| [§2](#2-calibration-restante-avant-prod) | À faire : trajets témoins, grille, plafonds |
| [§3](#3-monétisation-b2c--b2b-futur) | Leviers B2C / B2B (pas la V1 livrée) |
| [§4](#4-paiements-livraison-et-qr) | Circuits d’argent, QR, fichiers, **reste à durcir** |
| [§5](#5-intégrations-psp-orange-money-wave-mtn--roadmap) | Accords marchands, API opérateurs, branchement backend |
| [§6](#6-idées-futures-hors-v1) | Backlog léger |

---

## 1. Déjà en place (résumé code)

Les étapes **A–D** du ancien plan sont **livrées** :

| Thème | Côté code (indicatif) |
|-------|------------------------|
| Prix unifiés, grille base + km, options vitesse | `chrono_backend/src/services/priceCalculator.ts` ; alignement client `app_chrono/services/orderApi.ts` |
| Distance / durée **route** Mapbox ; repli Haversine si pas d’itinéraire | `app_chrono/utils/mapboxDirections.ts`, `useMapLogic.ts` ; enregistrement + socket avec km route |
| Tarif **dynamique** (météo Open-Meteo, surge socket, heure, trafic durée vs typique), plafond contexte | `chrono_backend/src/services/dynamicPricing.ts`, `openMeteoPricing.ts`, `surgePricing.ts` ; `paymentController`, `orderSocket`, `orderRecordController` |
| Transparence ligne droite / route (libellés) | `app_chrono/utils/routePricingLabels.ts` et écrans associés |

**Principe produit conservé** : le fournisseur carto fournit trafic / durées ; la météo vient d’une API externe ; le « cerveau » est la **logique de prix** côté backend avec **plafonds** et facteurs **bornés**.

---

## 2. Calibration restante (avant prod)

À faire **sur le terrain** (pas une étape A–D dans le repo) :

1. Définir **10–20 trajets témoins** Grand Abidjan (court / moyen / long, lagune, pointe / creux).
2. Noter **km route**, **durée**, **prix concurrent** si visible.
3. Ajuster base, per km, minimums, **plafonds** surge / contexte dans `priceCalculator` / `dynamicPricing` selon décision produit.
4. **Geler** la grille (config versionnée ou futur admin).

**Critères de crédibilité** (rappel) : distance routière, temps (trafic), engin, urgence modérée, surge transparent et plafonné, minimum de course, benchmark concurrence.

---

## 3. Monétisation B2C / B2B (futur)

Hors périmètre de la V1 technique tarif/carte ci-dessus ; à trancher produit / juridique plus tard.

### 3.1 B2C

| Levier | Description |
|--------|-------------|
| Commission sur la livraison | % ou fixe sur le prix course |
| Frais petite commande | supplément course très courte |
| Options payantes | urgence, assurance, isotherme, multi-stop |
| Abonnement (optionnel) | packages mensuels |
| Partenariats marchands | visibilité, campagnes |

### 3.2 B2B

| Levier | Description |
|--------|-------------|
| Compte pro / facturation | multi-utilisateurs, centres de coût |
| Forfaits mensuels | volume km ou courses |
| Tarifs dégressifs | au seuil de volume |
| SLA / créneaux | priorité, garanties |
| API / intégration | ERP, e-commerce |
| Dernier km externalisé | contrats cadres, KPI |

---

## 4. Paiements, livraison et QR

**Périmètre** : paiements commande (différé, partiel), **commission prépayée** livreur partenaire, **QR de livraison** = preuve de remise (**pas** de QR « paiement » opérateur dupliqué dans l’app — règle produit ; branchement réel des PSP : **§5**).

### 4.1 Deux circuits d’argent

| Circuit | Qui | Objet | Tables / concepts |
|---------|-----|--------|-------------------|
| **Paiement de la course** | Client / destinataire | Prix livraison | `orders`, `transactions`, `invoices`, `payment_methods` |
| **Commission partenaire** | Livreur **partner** | Crédit prépayé, débit après livraison | `commission_balance`, `commission_transactions`, `driver_profiles.driver_type` |

### 4.2 Modes (rappel)

| Mode | Argent avant livraison ? | À la porte | Après scan |
|------|---------------------------|------------|------------|
| OM / Wave acquitté | Oui | QR = preuve | Non (sauf reliquat / partiel) |
| Espèces | Non | QR puis cash | Si dû |
| Différé | Dette enregistrée | QR = preuve | Règlement in-app |
| Partiel | Partie payée | QR + reliquat | Souvent reliquat in-app |

**Règles produit** : un QR par commande ; pas de fusion QR livraison / paiement opérateur ; mode de paiement choisi par le **commanditaire** ; différé / reliquat réglés **dans l’app** sur `order_id`.

**Limites différé** : `chrono_backend/src/utils/deferredPaymentLimits.ts`.

| Type livreur | `driver_type` | Commission prépayée |
|--------------|---------------|---------------------|
| Interne | `internal` | Non |
| Partenaire | `partner` | Oui |

### 4.3 Fichiers utiles

| Sujet | Emplacement |
|-------|-------------|
| Commande + socket | `chrono_backend/src/sockets/orderSocket.ts` |
| Init paiement / calcul prix | `chrono_backend/src/controllers/paymentController.ts` |
| Transactions | `chrono_backend/src/utils/createTransactionForOrder.ts` |
| Différé | `chrono_backend/src/utils/deferredPaymentLimits.ts` |
| Commission | `chrono_backend/src/services/commissionService.ts`, `commissionController.ts` |
| UI paiement client | `app_chrono/components/PaymentBottomSheet.tsx`, `OrderDetailsSheet.tsx` |
| QR backend | `chrono_backend/src/services/qrCodeService.ts` |
| Recharge commission | `driver_chrono/components/RechargeModal.tsx`, `store/useCommissionStore.ts` |

Schémas SQL indicatifs (colonnes QR, table `qr_code_scans`) : migrations **020** / **021** / **022** dans le dépôt.

### 4.4 Reste à durcir

- Migration **022** appliquée sur **toutes** les bases déjà en prod.
- Option **scan QR obligatoire** avant statut `completed` (règle produit + enforcement serveur).
- Flux **« Payer le reste »** complet (OM / Wave), aligné **§5** (intégrations PSP).
- **`QR_CODE_SECRET`** identique sur toutes les instances backend prod (`chrono_backend/.env.example`).

---

## 5. Intégrations PSP (Orange Money, Wave, MTN) — roadmap

Travail **hors code** en tête : accords marchands et accès API auprès des opérateurs (ou agrégateur agréé).

### 5.1 Périmètre

- **Paiement course** : initier un encaissement, recevoir le statut (succès / échec), idempotence, webhooks.
- **Recharge commission livreur partenaire** : même principe ; montants crédités seulement après **confirmation PSP**.
- **Pas de duplication** des QR « paiement » des opérateurs dans l’app Chrono — aligné **§4**.

### 5.2 Étapes typiques côté entreprise

1. **Compte marchand / agrégateur** auprès d’Orange Money, Wave, MTN, ou d’un **agrégateur** agréé (souvent plus simple qu’un contrat direct par opérateur).
2. Récupération des **clés API**, URLs **sandbox** puis **production**, documentation des **webhooks** (signature, retries).
3. **Conformité** : KYC, conditions d’utilisation, plafonds, litiges et remboursements (produit + juridique).
4. Brancher dans `chrono_backend` : `paymentController`, `commissionController` (remplacer les parties « simulation » par appels PSP + persistance `transactions` / `commission_transactions`).

### 5.3 Fichiers à faire évoluer (indicatif)

- `chrono_backend/src/controllers/paymentController.ts`
- `chrono_backend/src/controllers/commissionController.ts`
- Variables d’environnement (clés API, secrets webhook) — **ne pas commiter** ; documenter dans `.env.example` sans valeurs réelles.

### 5.4 Ressources

- Contacter les **équipes entreprise / API** des opérateurs concernés (Côte d’Ivoire ou pays cible).
- Compléter cette section avec les **liens officiels** de documentation une fois les accès obtenus.

---

## 6. Idées futures (hors V1)

| Idée | Statut |
|------|--------|
| QR paiement fusionné avec QR livraison | **Non retenu** |
| Suivi public enrichi, retour, multi-colis | Backlog |

---

*À faire évoluer avec juridique, produit et accords PSP.*
