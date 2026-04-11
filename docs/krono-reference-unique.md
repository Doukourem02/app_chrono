# Krono — référence unique (Côte d’Ivoire)

**Dernière mise à jour** : avril 2026  

Ce fichier **remplace** et regroupe tout le cadrage qui était éclaté entre :

- `docs/paiements-krono.md` (supprimé)  
- `docs/tarification-realiste-et-monetisation-krono-ci.md` (supprimé)  
- `app_chrono/docs/tarification-dynamique-meteo-trafic.md` (supprimé)

**Règle** : tarifs, trafic, météo, embouteillages, surge, distance routière et paiements doivent rester **alignés** avec ce document — une seule vérité produit pour ne pas perdre la confiance client sur le terrain.

---

## Vue d’ensemble


| Thème                                                       | Section                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Ligne droite vs route réelle, Mapbox en CI                  | [§2](#2-distance-cartographie-et-ligne-droite)                    |
| Grille tarifaire, état du code, calibration, plan technique | [§3](#3-tarification-réaliste-grille-code-calibration)            |
| Trafic, météo, embouteillages, surge (modèle de prix)       | [§4](#4-tarification-dynamique-trafic-météo-embouteillages-surge) |
| Monétisation B2C / B2B                                      | [§5](#5-monétisation-krono--b2c-et-b2b)                           |
| Paiements, QR, circuits d’argent, implémentation            | [§6](#6-paiements-livraison-et-qr)                                |


Documentation associée (non fusionnée ici) : `docs/integrations-psp.md`, `driver_chrono/docs/navigation-suivi-livreur.md` (guidage livreur ; les **durées** tarif côté client peuvent réutiliser la même famille de données que l’ETA).

---

## 2. Distance, cartographie et ligne droite

### 2.1 Symptôme : « tout est en ligne droite »

En test, distance et prix ne **reflètent pas** la réalité d’une course en ville (détours, ponts, sens interdits, trafic). Le client compare avec Yango ou Google Maps : si toi tu affiches **moins de km** et un prix **déconnecté**, tu perds la crédibilité.

### 2.2 Mapbox « ne connaît pas » la Côte d’Ivoire ?

**Non : ce n’est pas le bon diagnostic.** Les tuiles et le **réseau routier** derrière **Mapbox Directions** couvrent la CI (comme le reste du monde — la précision varie par quartier, mais ce n’est pas une carte vide).

Ce qui pose problème aujourd’hui dans le projet, c’est le **calcul utilisé dans le code** :

- `**getDistanceInKm` (Haversine)** = distance **géodésique** entre deux coordonnées GPS → **ligne droite sur la sphère**, pas un trajet sur la route.
- Tant que **prix** et **affichage** reposent sur ça, tu reproduis **volontairement** une approximation que **aucune** appli concurrente sérieuse n’affiche comme distance de facturation.

**À retenir** : l’écran peut montrer une belle carte Mapbox **et** en parallèle un calcul **100 % ligne droite** — les deux sont compatibles tant que tu n’appelles pas **Directions** pour la distance/durée de la course.

### 2.3 Cible technique

- **Source de vérité** : **Mapbox Directions API** (ou **Google Routes API**, etc.) → `distance` **sur le graphe routier**, `duration` / équivalent **avec conditions** si disponible.
- **Repli** : Haversine **uniquement** si l’API échoue (timeout, quota), avec message produit honnête si besoin.
- **Cohérence** : même paquet distance + durée pour **estimation prix**, **ETA client** et persistance commande (transparence, support).

---

## 3. Tarification réaliste (grille, code, calibration)

### 3.1 Contexte marché

- **Marché** : Côte d’Ivoire, souvent **Grand Abidjan** en premier.
- **Positionnement** : prix **modérés** vs Yango, mais **explicables** (distance route, temps, contexte borné).

### 3.2 Critères pour des prix crédibles


| Critère                            | Rôle                               |
| ---------------------------------- | ---------------------------------- |
| **Distance routière**              | Base lisible ; alignée concurrents |
| **Temps** (idéalement avec trafic) | Reflète embouteillages ; aligné §4 |
| **Engin**                          | moto / véhicule / cargo            |
| **Zone**                           | centre / périphérie / dernier km   |
| **Urgence**                        | prime modérée, plafonnée           |
| **Demande vs livreurs**            | surge **transparent** et plafonné  |
| **Minimum de course**              | éviter micro-courses déficitaires  |
| **Benchmark**                      | trajets témoins vs concurrence     |


### 3.3 État actuel du code (écarts)

**Distance** : Haversine côté app (`app_chrono/services/orderApi.ts`, usages dans `map.tsx`, `DeliveryMethodBottomSheet`, etc.) et parties du backend — pas la longueur d’itinéraire.

**Tarifs** : plusieurs logiques :

- Client : `BASE_PRICES` → **base + km × perKm** (`orderApi.ts`).
- Socket backend : famille **base + perKm** (`orderSocket.ts`).
- `chrono_backend/src/services/priceCalculator.ts` : **distance × tarif_km** seul, avec des **montants différents** du client.

→ Un même trajet peut **changer de prix** selon le chemin d’exécution : à corriger par **un module serveur unique** + client qui **affiche** le résultat serveur (ou même formule partagée).

### 3.4 Calibration avant prod

1. Définir **10–20 trajets témoins** Abidjan (court / moyen / long, lagune, pointe / creux).
2. Noter **km route**, **durée**, **prix concurrent** si visible.
3. Régler base, perKm, perMinute (optionnel), minimums, **plafonds** surge/contexte.
4. **Geler** la grille (config versionnée ou admin).

### 3.5 Plan d’implémentation (ordre recommandé)


| Étape | Action                                                              |
| ----- | ------------------------------------------------------------------- |
| A     | **Unifier** le calcul de prix (serveur + alignement client).        |
| B     | Brancher **distance + durée** Directions (cache TTL pour coût API). |
| C     | Intégrer **coût temps** et facteurs §4 **après** base stable.       |
| D     | Afficher **km route** (et durée) au client.                         |


---

## 4. Tarification dynamique (trafic, météo, embouteillages, surge)

### 4.1 Principe

Un même trajet peut **coûter plus ou moins** selon le **coût réel** : temps, difficulté (trafic, météo), **tension du marché** (demande vs livreurs). Ce n’est pas uniquement `distance × tarif_km` sans contexte.

**Philosophie** : refléter le coût réel pour la plateforme et le livreur, avec **plafonds** et **transparence** pour le client.

### 4.2 Embouteillages et trafic — comment le système « sait » ?

**Culture (Google, Waze, Uber)** : vitesses agrégérées sur le réseau + moteurs d’itinéraires avec durées « typiques » vs « actuelles ».

**Krono ne reconstruit pas** ce réseau mondial.

**Réaliste pour toi** : consommer un fournisseur qui fusionne cartes + historique + souvent temps réel :

- **Mapbox Directions API**  
- ou **Google Routes API**

Signaux utiles (selon champs exacts) :

- `duration` (référence / sans congestion selon API)  
- `duration_in_traffic` ou équivalent

**Indice lecture** :

```text
indice_durée = duration_avec_trafic / duration_référence
```

- proche de **1** → normal  
- **> 1,3** → ralentissement notable  
- **> 2** → congestion forte (ordre de grandeur à calibrer)

L’app appelle l’API, récupère les durées, applique **ta** règle de prix (§4.5).

### 4.3 Météo

**Source** : API météo externe (ex. OpenWeather), sur pickup, milieu de trajet ou zone.

**Exemples de règles** (à calibrer) : pluie légère → faible ou 0 ; pluie forte → bonus difficulté ; orage → coefficient plus élevé, **borné**.

Krono **ne détecte pas** la pluie par capteur : elle **lit** l’API.

### 4.4 Synthèse « fait / ne fait pas »


| Question                                    | Réponse                                                        |
| ------------------------------------------- | -------------------------------------------------------------- |
| L’app calcule-t-elle le trafic comme Waze ? | **Non** — fournisseur carto (Mapbox / Google, …).              |
| Détection pluie interne ?                   | **Non** — API météo.                                           |
| Où est le « cerveau » ?                     | **Logique de prix** : durées, météo, demande, heure, plafonds. |


### 4.5 Modèle d’algorithme cible — BASE × CONTEXTE

**Forme globale** :

```text
prix = (coût_distance + coût_temps) × facteur_contexte
```

**Étape 1 — base** :

```text
coût_distance = distance_km × tarif_km(mode)
coût_temps   = durée_minutes × tarif_minute(mode)
prix_base    = coût_distance + coût_temps
```

- `durée_minutes` : idéalement `**duration_in_traffic**` (ou équivalent), pas seulement durée théorique sans congestion.  
- Une partie du trafic est **déjà** dans le prix via le temps ; éviter **double comptage** avec un énorme coefficient trafic en plus.

**Étape 2 — facteurs contextuels**

**A. Trafic « subtil »** (éviter doublon avec le temps) :

```text
indice_trafic = durée_avec_trafic / durée_sans_trafic
facteur_trafic = clamp(indice_trafic, 1, 1.3)   -- exemple
```

**B. Météo** : ex. pluie forte ×1,10 ; conditions critiques ×1,15 ; sinon ×1.

**C. Demande (surge)** :

```text
ratio = demandes_en_cours / livreurs_disponibles   (ou variante zone + engin)
```

facteur_demande croissant avec la tension (ex. jusqu’à ×2 **plafonné globalement**).

**D. Horaire** : pointe, nuit, etc. (à calibrer Abidjan / légal / com client).

**Fusion** :

```text
facteur_contexte = facteur_demande × facteur_trafic × facteur_meteo × facteur_horaire
facteur_contexte = min(facteur_contexte, 2)   -- ou autre plafond produit
```

**Formule finale rappel** :

```text
prix = (distance × tarif_km + durée_min × tarif_min) × facteur_contexte_plafonné
```

### 4.6 Chaîne technique actuelle (rappel)

Aujourd’hui : estimation / commande avec **Mapbox** côté app, `**createOrderRecord`**, socket `**create-order`**, `**calculatePrice**` / `**estimateDuration**` côté backend — **à faire évoluer** avec durée trafic, météo, métriques offre/demande, **persistance des paramètres** sur la commande (transparence, support, analytics).

### 4.7 Prochaines étapes (implémentation)

1. Choisir fournisseur itinéraire et champs exacts `duration` / trafic.
2. Choisir API météo + seuils.
3. Définir mesure demande / livreurs disponibles (zone, engin, fenêtre temps).
4. Implémenter **backend** d’abord, puis UI (libellés « trafic / météo / forte demande »).
5. Tests + **plafond** validé produit.

---

## 5. Monétisation Krono — B2C et B2B

### 5.1 B2C


| Levier                      | Description                               |
| --------------------------- | ----------------------------------------- |
| Commission sur la livraison | % ou fixe sur le prix course              |
| Frais petite commande       | supplément course très courte             |
| Options payantes            | urgence, assurance, isotherme, multi-stop |
| Abonnement (optionnel)      | packages mensuels                         |
| Partenariats marchands      | visibilité, campagnes                     |


### 5.2 B2B


| Levier                   | Description                         |
| ------------------------ | ----------------------------------- |
| Compte pro / facturation | multi-utilisateurs, centres de coût |
| Forfaits mensuels        | volume km ou courses                |
| Tarifs dégressifs        | au seuil de volume                  |
| SLA / créneaux           | priorité, garanties                 |
| API / intégration        | ERP, e-commerce                     |
| Dernier km externalisé   | contrats cadres, KPI                |


---

## 6. Paiements, livraison et QR

**Périmètre** : **paiements** (commande, différé, partiel), **crédit commission livreur partenaire**, **QR de livraison** (preuve de remise — **pas** de QR paiement Krono ; Orange / Wave / MTN restent les PSP).

### 6.1 Deux circuits d’argent à ne jamais confondre


| Circuit                          | Qui ?                     | Objet                                                                          | Dans le projet                                                                                                         |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Paiement de la course**        | Client et/ou destinataire | Prix de la livraison (espèces, OM, Wave, différé, partiel)                     | `orders`, `transactions`, `invoices`, `payment_methods` (migration `021_payment_messaging_history_profiles.sql`, etc.) |
| **Crédit commission partenaire** | Livreur **partenaire**    | Crédit prépayé pour recevoir des courses ; débit **après** livraison complétée | `commission_balance`, `commission_transactions`, `driver_profiles.driver_type` (`internal` / `partner`)                |


Le **QR livraison** est **logistique / preuve**, pas encaissement.

### 6.2 Déroulé chronologique

**Création de commande** : le commanditaire choisit le **mode de paiement** (`OrderDetailsSheet`, `PaymentBottomSheet`, etc.) ; backend enregistre `orders` + transactions / factures ; **génération serveur** du QR livraison ; QR sur suivi + partage.

**Exécution** : partenaire avec solde commission suffisant (`canReceiveOrders`) ; acceptation → enlèvement → livraison.

**À la porte** (encaissement sur place si prévu) : contrôles → **scan QR** (ou code secours) → validation serveur → récap → paiement si dû → `**completed**` selon règles.


| Mode                        | Argent avant livraison ? | À la porte            | Encaissement après scan       |
| --------------------------- | ------------------------ | --------------------- | ----------------------------- |
| OM / Wave **déjà acquitté** | Oui                      | QR = preuve de remise | Non (sauf reliquat / partiel) |
| **Espèces**                 | Non                      | QR puis cash          | Oui si dû                     |
| **Différé**                 | Dette enregistrée        | QR = preuve           | Non sur place                 |
| **Partiel**                 | Partie payée             | QR + reliquat         | Souvent après scan si dû      |


**Après livraison** : notification, historique, débit commission partenaire **après** complétion (indépendant du QR côté client).

**Différé / reliquat** : règlement **dans l’app**, lié à `order_id` — pas cash au « prochain livreur » pour une **ancienne** dette.

### 6.3 QR livraison — cadrage produit

- **Un QR par commande** ; pas QR paiement fusionné ; pas scan permanent dans la tab bar livreur ; pas preuve CNI via QR.
- **Force de preuve** : livraison datée, livreur, scan enregistré = **fort** ; identité légale destinataire = **faible** (secret de remise).

**UX client** : QR en arrière-plan ; « Afficher le QR de remise » + partage.

**UX livreur** : accès **contextuel** (bottom sheet / après nav) → scanner → récap → confirmer.

### 6.4 Qui choisit quoi ?

**Mode de paiement de la course** : le **commanditaire** à la commande — pas le livreur dans l’UI client.

**Livreur** : applique le mode fixé ; recharge commission si partenaire (`RechargeModal`, API commission).

### 6.5 Portefeuille — vocabulaire

Paiement numérique commande / « payer le reste » = encaissement + `transactions` sur `order_id`. Portefeuille client rechargeable fort = option lourde. PSP = argent chez opérateurs ; distinct de **commission_`*.

### 6.6 Modèle cible — commande + transactions

`orders` (total, mode, statut, partiel, payeur) ; `transactions` (journal, partiel, reliquat) ; reste à payer dérivé.

### 6.7 Solder différé / reliquat

**« Payer le reste »** in-app (OM / Wave), lié à `**order_id`**.

### 6.8 Limites différé

`chrono_backend/src/utils/deferredPaymentLimits.ts` : plafonds, cooldowns, pénalités — toute évolution produit alignée ici.

### 6.9 Livreurs internes vs partenaires


| Type       | `driver_type` | Commission prépayée |
| ---------- | ------------- | ------------------- |
| Interne    | `internal`    | Non                 |
| Partenaire | `partner`     | Oui                 |


### 6.10 Implémentation technique (QR, SQL, fichiers)

**Migrations indicatives** :

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

**Backend QR** : `chrono_backend/src/services/qrCodeService.ts` ; endpoints type `POST /api/orders/:orderId/qr-codes/generate`, `GET .../qr-codes`, `POST /api/qr-codes/scan`. Validation : livreur assigné, statut adapté, signature + expiration, scan unique, géofence optionnelle (~50 m).

**Apps** : client `QRCodeDisplay`, suivi ; livreur `QRCodeScanner`, `QRCodeScanResult` ; admin historique.

**Sécurité** : secret env ; expiration ; validation **serveur** ; pas de double clôture abusive.

**Événements** : `create-order` → QR ; `update-delivery-status` → règle `completed` si scan obligatoire.

**Fichiers utiles paiements** :


| Sujet               | Emplacement                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| Commande + socket   | `chrono_backend/src/sockets/orderSocket.ts`                                   |
| Init paiement       | `chrono_backend/src/controllers/paymentController.ts`                         |
| Transactions        | `chrono_backend/src/utils/createTransactionForOrder.ts`                       |
| Différé             | `chrono_backend/src/utils/deferredPaymentLimits.ts`                           |
| Commission          | `chrono_backend/src/services/commissionService.ts`, `commissionController.ts` |
| UI paiement client  | `app_chrono/components/PaymentBottomSheet.tsx`, `OrderDetailsSheet.tsx`       |
| Recharge commission | `driver_chrono/components/RechargeModal.tsx`, `store/useCommissionStore.ts`   |
| Admin dettes        | `chrono_backend/src/controllers/adminController.ts`                           |


**Technos** : backend `qrcode`, `crypto`, `sharp` / `jimp` ; mobile `expo-camera` / barcode ; admin `qrcode.react` si besoin.

**Points d’attention** : offline + sync ; QR abîmé → **code secours** ; destinataire sans app → SMS/WhatsApp.

### 6.11 État d’implémentation (avril 2026)

Grande partie **en place** ; suite selon **accords PSP** (`docs/integrations-psp.md`).

**Déjà là** : migrations `016` + `022` (scan unique), `qrCodeService`, controllers/routes, création commande + QR, admin, suivi public, apps client/livreur.

**Prod** : `**QR_CODE_SECRET`** identique sur toutes les instances (`chrono_backend/.env.example`).

**À durcir** : migration **022** sur bases existantes ; option scan obligatoire avant `completed` ; flux **« Payer le reste »** complet.

### 6.12 Idées futures (hors V1)


| Idée                              | Statut         |
| --------------------------------- | -------------- |
| QR paiement dans le QR livraison  | **Non retenu** |
| Suivi public, retour, multi-colis | Backlog        |


---

*Ce document unique remplace les anciennes fusions « paiements + PLAN_QR » et les docs tarif dispersées. À faire évoluer avec juridique et produit.*