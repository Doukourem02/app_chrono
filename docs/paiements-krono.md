# Paiements, livraison et QR — Krono (référence unique)

**Dernière mise à jour** : avril 2026  

Document unique pour le dépôt PROJET_CHRONO : **paiements** (commande, différé, partiel), **crédit commission livreur partenaire**, et **QR de livraison** (preuve de remise — **pas** de QR paiement Chrono ; Orange / Wave / MTN restent les PSP).

---

## 1. Deux circuits d’argent à ne jamais confondre

| Circuit | Qui ? | Objet | Dans le projet |
|--------|--------|--------|----------------|
| **Paiement de la course** | Client et/ou destinataire | Prix de la livraison (espèces, OM, Wave, différé, partiel) | `orders`, `transactions`, `invoices`, `payment_methods` (migration `021_payment_messaging_history_profiles.sql`, etc.) |
| **Crédit commission partenaire** | Livreur **partenaire** (externe / indépendant) | Crédit prépayé pour recevoir des courses ; débit **après** livraison complétée | `commission_balance`, `commission_transactions`, `driver_profiles.driver_type` (`internal` / `partner`) |

Le **QR livraison** ne fait partie **d’aucun** de ces circuits financiers : il est **logistique / preuve**, pas encaissement.

---

## 2. Déroulé chronologique (ordre des opérations)

### 2.1 Création de commande

1. Le **commanditaire** (client ou destinataire selon `payment_payer`) choisit le **mode de paiement** dans l’app client (`OrderDetailsSheet`, `PaymentBottomSheet`, etc.).
2. Le backend enregistre la commande (`orders`) et, selon le flux, **transactions** / **factures**.
3. **Génération automatique côté serveur** du **QR livraison** (token signé + image ; pas un clic « générer » obligatoire pour l’utilisateur).
4. Le QR est **disponible sur le suivi** + **partage** possible (SMS / WhatsApp) vers le destinataire.

### 2.2 Assignation et exécution de la course

1. Un livreur **partenaire** doit avoir un **solde commission** suffisant pour **recevoir** la course (`canReceiveOrders`).
2. Acceptation → enlèvement → navigation vers le point de chute.
3. Le **choix du mode de paiement** a déjà eu lieu à la commande ; sur le terrain, le livreur **exécute** (cash, constat, etc.).

### 2.3 À la porte — QR, infos colis, puis paiement si dû

**Séquence cible** lorsqu’un **encaissement sur place** est prévu (**espèces**, ou OM/Wave **déclenché au moment de la livraison**) :

1. Contrôles terrain (adresse, colis visible).
2. **Scan QR** (ou **code secours** sous le QR) → validation **serveur** → le livreur voit le **récap colis / destinataire / commande**.
3. **Paiement** si un montant est **encore dû à cet instant** (cash ou init PSP).
4. **Confirmer la livraison** → statut **`completed`** lorsque les règles métier sont remplies (scan + cohérence paiement selon le mode).

| Mode | Argent avant la livraison ? | À la porte | Encaissement après scan |
|------|----------------------------|------------|-------------------------|
| OM / Wave **déjà acquitté** | Oui | QR = **preuve de remise** | Non (sauf reliquat / partiel) |
| **Espèces** | Non | QR puis **cash** | **Oui**, après scan / infos |
| **Différé** | Dette enregistrée | QR = **preuve remise** | Non sur place |
| **Partiel** | Partie payée | QR puis règles **reliquat** | Souvent après scan si dû sur place |

Si la commande est **déjà payée** avant l’arrivée du livreur, l’**argent précède** le scan dans le temps ; à la porte, le QR sert surtout la **traçabilité / preuve**.

### 2.4 Après « colis livré »

- L’écran **course active** peut disparaître : **normal**.
- **Notification** « Livraison confirmée » + entrée **Historique** (récap, **remise validée par scan** si applicable). Preuve en base : `orders`, `qr_code_scans`, admin.
- **Commission livreur partenaire** : débit sur `commission_balance` **après** livraison complétée (backend) — **indépendant** du QR côté client.

### 2.5 Plus tard — différé / reliquat

- Règlement du **reliquat** ou du **différé** : **paiement numérique dans l’app**, rattaché à la **commande** (voir §7), pas « cash au prochain livreur » pour une **ancienne** dette.

---

## 3. QR livraison — cadrage produit

### 3.1 Objectif et périmètre

- **Un QR par commande** : preuve de remise, traçabilité des scans, lien **scan ↔ commande ↔ livreur assigné**.
- **Exclu** : QR « paiement » fusionné dans le QR Chrono ; remplacement des encaissements PSP ; icône **Scan** permanente dans la **tab bar** livreur ; preuve d’identité CNI via QR.

### 3.2 Ce que le QR prouve vraiment

| Affirmation | Niveau |
|-------------|--------|
| **Preuve de livraison** (datée, livreur connu, scan enregistré) | **Fort** |
| **Bonne commande** (scan = `orderId` attendu pour ce livreur et ce statut) | **Fort** |
| **Bon colis physique** sur le scooter | **Faible** sans process étiquette / enlèvement |
| **Identité légale** du destinataire | **Faible** — preuve de **possession du secret de remise** |

### 3.3 UX — client (`app_chrono`)

- QR **généré en arrière-plan** ; **« Afficher le QR de remise »** sur le suivi (modal) + **partage**.
- **Option** (V2) : mise en avant du QR si le livreur envoie *« J’arrive / prêt à scanner »* (socket / push), avec garde-fous (statut `delivering`, anti-spam).

### 3.4 UX — livreur (`driver_chrono`)

- **Pas** de scan dans la **navigation principale** (tabs).
- Accès **contextuel** : bottom sheet, bandeau carte, ou **après sortie / pause nav** → écran **Livraison commande X** → **Scanner** → récap → **Confirmer livraison**. La **caméra** reste **manuelle**.

### 3.5 Synchro client « gros plan QR »

- Possible mais **risqué** ; mitigations : livreur assigné + bon statut ; bouton **« Prévenir le client »** ; limite de fréquence. **Hybride** : QR toujours sur le suivi + surbrillance **optionnelle**.

---

## 4. Qui choisit quoi ? (commande vs livreur)

### 4.1 Mode de paiement de la course

C’est le **commanditaire** qui choisit **à la commande** (client ou destinataire, `paymentController`, socket `create-order`). Ce n’est **pas** le livreur qui choisit OM vs Wave dans l’UI client.

### 4.2 Rôle opérationnel du livreur

- **Espèces** : souvent remises **au livreur** ; mise à jour statut en fin de course (`orderSocket`, etc.).
- **Exécution** terrain vs **choix** du mode : le mode est fixé à la commande ; le livreur **applique**.

### 4.3 Ce que le livreur choisit dans l’app

- **Partenaire** : **recharge commission** (OM / Wave) — `RechargeModal`, API commission.
- **Profil** `internal` vs `partner` (admin / onboarding).

---

## 5. Portefeuille électronique — vocabulaire

- **Paiement numérique** pour une commande ou « payer le reste » = **encaissement** + `transactions` sur `order_id` ; pas forcément **solde client** chez Krono.
- **Portefeuille client fort** (recharge réutilisable) = option lourde (compliance). Non requis pour commande + transactions + reliquat in-app.
- **PSP** : argent chez Orange / Wave ; Krono reçoit confirmations — distinct du **crédit commission** livreur.

---

## 6. Modèle cible — commande + transactions

1. **`orders`** : total, mode, statut paiement, partiel, payeur.
2. **`transactions`** : journal (`is_partial`, `partial_amount`, `remaining_amount`, statuts, `order_id`).
3. **Reste à payer** : dérivé de la commande et des encaissements confirmés.

Le **différé** = dette sur la commande jusqu’à transactions de règlement.

---

## 7. Solder différé / reliquat après coup

- **Règle** : **« Payer le reste »** dans l’app (OM / Wave), lié à **`order_id`** — pas cash au **nouveau** livreur pour une **ancienne** commande.
- Cash OK **pendant la prestation** si vos règles le permettent ; pas comme canal principal pour solder **a posteriori** une dette identifiée.

---

## 8. Limites différé (backend)

`chrono_backend/src/utils/deferredPaymentLimits.ts` : plafonds, usages, cooldowns, pénalités retard. Toute évolution produit doit rester alignée.

---

## 9. Livreurs internes vs partenaires

| Type | `driver_type` | Commission prépayée |
|------|----------------|---------------------|
| Interne | `internal` | Non |
| Partenaire | `partner` | Oui — `commission_balance`, `commissionService` |

---

## 10. Implémentation technique

### 10.1 QR — base de données (indicatif)

```sql
-- Champs orders (ex. 020_add_qr_codes_to_orders.sql)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_qr_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_qr_scanned_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_qr_scanned_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_qr ON orders(delivery_qr_code) WHERE delivery_qr_code IS NOT NULL;
```

```sql
-- Table scans (ex. 021_create_qr_code_scans_table.sql)

CREATE TABLE IF NOT EXISTS qr_code_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  qr_code_type TEXT NOT NULL DEFAULT 'delivery' CHECK (qr_code_type = 'delivery'),
  scanned_by UUID NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  location JSONB,
  device_info JSONB,
  is_valid BOOLEAN DEFAULT TRUE,
  validation_error TEXT,
  CONSTRAINT unique_scan_per_order UNIQUE(order_id, scanned_by)
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_order ON qr_code_scans(order_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_by ON qr_code_scans(scanned_by);
```

### 10.2 QR — backend

- Service : `chrono_backend/src/services/qrCodeService.ts` — payload JSON signé (HMAC-SHA256, secret env), image (`qrcode`, logo optionnel `sharp` / `jimp`).
- Endpoints indicatifs : `POST /api/orders/:orderId/qr-codes/generate`, `GET /api/orders/:orderId/qr-codes`, `POST /api/qr-codes/scan`.
- **Validation scan** : livreur assigné ; statut `picked_up` / `delivering` (adapter au projet) ; signature + expiration ; scan unique ; géofence optionnelle (~50 m).

### 10.3 QR — applications

- **Client** : suivi (`order-tracking/[orderId].tsx`), `QRCodeDisplay.tsx` (instructions, expiration, **code secours**, partage).
- **Livreur** : `QRCodeScanner.tsx`, `QRCodeScanResult.tsx` dans bottom sheet / hors tab bar.
- **Admin** : historique scans sur commande, stats.

### 10.4 QR — sécurité

Secret env ; expiration serveur ; pas de double clôture avec le même QR ; **validation toujours serveur**.

### 10.5 QR — événements

- `create-order` : générer / persister QR ; notifications / partage selon config.
- `update-delivery-status` : si scan obligatoire, bloquer `completed` sans scan valide.
- Option : `driver_ready_to_scan` → client met en avant le QR.

### 10.6 QR — phases (checklist)

1. Migrations + `qrCodeService` + endpoints + tests.  
2. Branchement création commande + règle `completed`.  
3. App livreur (scanner contextuel).  
4. App client (affichage, partage, historique, notif).  
5. Admin.  
6. Hors-ligne / cache / doc utilisateur.

### 10.7 Paiements — fichiers code utiles

| Sujet | Emplacement |
|--------|-------------|
| Commande + socket | `chrono_backend/src/sockets/orderSocket.ts` |
| Init paiement | `chrono_backend/src/controllers/paymentController.ts` |
| Transactions | `chrono_backend/src/utils/createTransactionForOrder.ts` |
| Différé | `chrono_backend/src/utils/deferredPaymentLimits.ts` |
| Commission | `chrono_backend/src/services/commissionService.ts`, `commissionController.ts` |
| UI paiement client | `app_chrono/components/PaymentBottomSheet.tsx`, `OrderDetailsSheet.tsx` |
| Recharge commission | `driver_chrono/components/RechargeModal.tsx`, `store/useCommissionStore.ts` |
| Admin dettes | `chrono_backend/src/controllers/adminController.ts` |

### 10.8 QR — technologies

Backend : `qrcode`, `crypto`, `sharp` ou `jimp`. Mobile : `expo-camera` / barcode scanner, `expo-haptics`. Admin : `qrcode.react`, `html5-qrcode` si besoin.

### 10.9 QR — points d’attention

Offline (queue + sync), QR abîmé → **code secours**, destinataire sans app → partage SMS/WhatsApp.

### 10.10 QR — qualité avant prod

Signature / expiration serveur ; scan unique ; pas de complétion sans scan si politique exige QR ; historique client + admin ; pas d’icône scan dans la tab bar livreur.

### 10.11 Ressources

- [qrcode (npm)](https://www.npmjs.com/package/qrcode)  
- [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/)  
- [Expo Barcode Scanner](https://docs.expo.dev/versions/latest/sdk/bar-code-scanner/)

### 10.12 Prochaines étapes

- Flux **« Payer le reste »** (idempotence, webhooks PSP).  
- Recharges commission **réelles** (aujourd’hui partie simulation — `commissionController`).  
- Option : **solde client interne** (tables dédiées, séparé de `commission_*`).  
- QR backlog : suivi public, retour, multi-colis (hors V1) ; **non retenu** : QR paiement OM/Wave dans le QR livraison.

---

## 11. Idées futures QR (hors V1)

| Idée | Statut |
|------|--------|
| QR paiement dans le QR livraison | **Non retenu** — PSP |
| Suivi public lecture seule, retour, multi-colis, réclamation | Backlog |

---

## 12. État d’implémentation dans le dépôt (avril 2026)

Une grande partie est **déjà en place** ; la suite dépend surtout des **accords PSP** (voir `docs/integrations-psp.md`).

### Déjà implémenté

| Zone | Fichiers / détail |
|------|-------------------|
| **Migrations** | `016_add_qr_codes_to_orders.sql` (`delivery_qr_*`, table `qr_code_scans`) ; **`022_qr_code_scans_unique_order_scanner.sql`** — index unique `(order_id, scanned_by)` pour `ON CONFLICT` côté service |
| **Backend QR** | `src/services/qrCodeService.ts` (HMAC, génération image, scan, historique) ; `src/controllers/qrCodeController.ts` ; `src/routes/qrCodeRoutes.ts` |
| **Création commande** | `orderSocket.ts` — génération QR après création (non bloquante si échec) |
| **Admin** | Détail commande + `GET /api/admin/orders/:orderId/qr-scans` |
| **Suivi public** | `trackController.ts` — QR si besoin |
| **App client** | `app_chrono/services/qrCodeService.ts`, `QRCodeDisplay`, `TrackingBottomSheet` |
| **App livreur** | `driver_chrono/services/qrCodeService.ts`, `QRCodeScanner`, `QRCodeScanResult`, entrée **Scanner QR** dans `DriverOrderBottomSheet` (`picked_up` / `delivering`) |

### Configuration obligatoire en production

- Définir **`QR_CODE_SECRET`** (voir `chrono_backend/.env.example`) — **même secret** sur toutes les instances qui signent ou valident les QR.

### À faire / durcir (hors PSP)

- Appliquer la migration **022** sur les bases existantes (`npm run migrate` ou process du projet).
- Option produit : rendre le scan **obligatoire** avant `completed` si le livreur utilise le flux « Colis livré » sans QR (aujourd’hui le scan **clôt déjà** côté API).
- Flux **« Payer le reste »** (reliquat / différé) — toujours à brancher côté API + app client.

### Côté opérateurs (Orange, Wave, MTN, etc.)

- Pas de clés dans le dépôt : démarche **commerciale + technique** décrite dans **`docs/integrations-psp.md`**.

---

*Document unique : fusion du cadrage paiements et de l’ancien `PLAN_QR_CODE.md` (avril 2026). À faire évoluer avec le juridique et le produit.*
