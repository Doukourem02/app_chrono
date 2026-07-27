# Krono — Logique de livraison

Ce fichier récapitule comment une livraison Krono se déroule de bout en bout : cycle de statuts, types de livraison, dispatch aux livreurs, tournées B2B, et la refonte en cours de la livraison programmée. Contenu regroupé/déplacé depuis `docs/krono-reference-unique.md` le 2026-07-26 pour centraliser toute la logique de livraison dans un seul fichier dédié (voir `krono-reference-unique.md` pour le reste : notifications, paiement, QR, sécurité, etc.).

---

## 1. Cycle officiel d'une commande

Une commande Krono doit rester lisible pour trois publics : **client**, **chauffeur** et **destinataire**.
La question principale est toujours : **où est mon colis, qui s'en occupe, dans combien de temps, et que dois-je faire ?**

| Étape produit | Statuts techniques typiques | Client | Chauffeur | Dynamic Island / Live Activity | Notification | Temps affiché | Passage suivant |
|---|---|---|---|---|---|---|---|
| Recherche livreur | `pending` | `Recherche livreur` ou `Recherche` | N/A | Compact/lock screen sans temps | Push seulement si attente longue, échec ou aucun livreur | Aucun temps | Un chauffeur accepte |
| Livreur accepté / vers collecte | `accepted`, `enroute` | `Prise en charge dans X min` | Mission acceptée, aller au point de collecte | Avatar, véhicule, plaque, progression vers collecte | Push client utile une seule fois, puis Live Activity prend le relais | Chauffeur -> point de collecte | Chauffeur arrive ou confirme présence |
| Arrivé collecte | `in_progress`, `arrived`, `at_pickup` | `Livreur arrivé` ou `Prise en charge dans 1 min` | Récupérer / vérifier le colis | Avatar + indicateur d'arrivée, sans libellé vague | Silencieux sauf action nécessaire | `1 min` si un temps est requis | Colis marqué récupéré |
| Colis récupéré | `picked_up` | `Livraison dans X min` | Aller vers destination | Même composant, progression recalibrée vers destination | Push court possible : `Colis récupéré` | Point de collecte ou position livreur -> destination | Chauffeur se rapproche / arrive |
| Vers livraison | `delivering` | `Livraison dans X min` | Continuer vers destinataire | Minutes + progression vers destination | Pas de push répétée si Live Activity active | Position livreur -> destination | Arrivé destination |
| Arrivé destination | `at_dropoff`, `arrived_dropoff` | `Livreur arrivé` ou `Livraison dans 1 min` | Remettre le colis, scanner QR si requis | Avatar + indicateur d'arrivée | Push si le destinataire doit agir | `1 min` si un temps est requis | QR scanné / remise confirmée |
| Terminé | `completed` | `Livraison terminée` | Mission terminée, commission comptabilisée | Fin propre de l'activité | Push seulement si app absente ou récap utile | Aucun temps | Historique / note / support |
| Annulé / aucun livreur | `cancelled`, `declined`, `no_driver` | Message explicite et action possible | Mission retirée ou indisponible | Fin propre de l'activité | Push critique | Aucun temps | Nouvelle tentative, support ou remboursement |

Règles générales :

- Une commande suivie doit avoir une seule représentation système active côté client.
- L'étape visible doit suivre la réalité métier, pas seulement un libellé technique.
- Le client ne doit jamais avoir à deviner si le livreur va chercher le colis ou va le livrer.
- Le destinataire ne voit que ce qui l'aide à recevoir le colis.

**Statuts canoniques — source de vérité technique (unifiés le 2026-07-22)** : l'enum Postgres `order_status` a 11 valeurs, mais **9 seulement sont le canon applicatif** : `pending, accepted, enroute, in_progress, picked_up, delivering, completed, declined, cancelled`. `draft` et `searching_driver` existent dans l'enum mais ne sont produits ni consommés par aucun code actuel (backend ou front) — documentés ici pour le jour où ils seraient activés. Type source : `krono_backend/src/types/index.ts` (`OrderStatus`), répliqué dans `admin_krono/types/index.ts` et `driver_krono/types/index.ts`. Dette connue, non traitée volontairement : `app_krono/types/index.ts` (`ShipmentStatus`) et `useShipmentStore.ts` forment un système de statut parallèle utilisé uniquement par `app/summary.tsx`, un écran mort (aucune navigation ne pointe dessus) — candidat à suppression sur demande explicite seulement, car supprimer un écran est une décision produit.

---

## 2. Types de livraison, flags et dispatch

### Types de livraison — flags et encart livreur

| Type | Flags / données | Encart livreur (`AdminOrderInfo`) |
|------|-----------------|-----------------------------------|
| **En ligne (classique)** | Aucun flag admin | Pas d'encart |
| **Hors-ligne / opérateur (= téléphonique)** | `placed_by_admin` dans `_chrono_admin`, accompagné de `is_phone_order` si GPS de retrait approximatif | Badge « Hors-ligne · Opérateur » |
| **B2B planning** | `is_b2b_order` | Badge « Commande B2B » + partenaire + tournée si données présentes |
| **Tournée (batch)** | `batch_id`, `batch_position`, `batch_total`, `partner_name` | Affichage X/Y, contexte partenaire |

**Clarification 2026-07-26** : "Hors-ligne / opérateur" et "Téléphonique" ne sont **pas deux types distincts** — `is_phone_order` n'est jamais positionné indépendamment de `placed_by_admin` (vérifié : seule `createAdminOrder` écrit ces flags, dans le même objet `_chrono_admin`, jamais de branche qui les dissocie ; zéro occurrence côté `app_krono`). C'est le même scénario réel : quelqu'un appelle, l'admin crée la commande à sa place. `is_phone_order` sert uniquement à indiquer que le point de retrait n'a pas de GPS précis (zone approximative choisie à la place) — c'est une précision sur la qualité de l'adresse, pas un type de livraison séparé.

**Règle mnémotechnique :** encart = `isB2BOrder` OU `placedByAdmin` OU `isPhoneOrder` (normalisé via `mapAdminOrderFlags`). Priorité badge : B2B > opérateur.

**Décisions arrêtées :**
- `partner_id` présent → toujours propager `is_b2b_order = true` sur la commande (pas de `partner_id` silencieux sans encart B2B livreur).
- Tournée hybride (petit B2B sans portail) → batch créé avec `user_id` (pas de `partner_id` requis).
- Tournée grand B2B → batch avec `partner_id` + `partner_name` remontés côté livreur.

### Matrice segment × type de livraison (arrêtée)

**O** = cas courant, **—** = non prévu.

|  | En ligne | Hors-ligne opérateur (= téléphonique) | B2B planning | Tournée (batch) |
|--|:--------:|:--------------------------------------:|:------------:|:---------------:|
| **Lambda** | O | — | — | — |
| **Hybride (Starter, sans portail)** | O | — | O | O (`user_id`) |
| **Grand B2B (Pro/Business)** | — | O | O | O (`partner_id`) |

Lambda : pas de tournée grand public pour l'instant. Hybride : pas de saisie hors-ligne (flow app uniquement). Grand B2B : pas de commande en ligne classique (passe par admin/portail).

### Comportement dispatch B2B

- GPS optionnel (contrairement au B2C)
- Tous les livreurs disponibles notifiés
- Livreurs **internes** prioritaires sur commandes B2B
- Paiement **différé** (`deferred`) disponible
- Si livreur attitré sélectionné pour une commande unitaire → `preferred_driver_id` priorisé, puis fallback automatique si le livreur n'est pas joignable ou refuse.
- Si livreur attitré sélectionné pour une tournée → `driver_id` explicite sur `/api/batches`, donc assignation directe au livreur choisi.

### Livreurs dédiés partenaires

Définitions :
- **Livreur B2B opt-in** : livreur qui accepte de recevoir des commandes B2B (`driver_profiles.accepts_b2b_orders = true`).
- **Livreur dédié partenaire** : livreur explicitement rattaché à un partenaire dans `partner_drivers`.
- **Priorité douce** : Krono propose d'abord la commande au livreur dédié sélectionné, puis l'assignation automatique prend le relais si besoin.

Règle produit : le partenaire peut demander ou sélectionner un livreur déjà validé, mais il ne rattache jamais directement un livreur à son compte. Le rattachement officiel reste une action admin Krono.

Modèle de données :
- `partner_drivers.partner_id` + `driver_user_id` identifie le rattachement.
- Un même livreur peut être dédié à plusieurs partenaires ; l'unicité est seulement sur le couple `(partner_id, driver_user_id)`.
- Un seul livreur par défaut est autorisé par partenaire (`is_default = true` unique).
- `partner_driver_requests` couvre trois demandes : `known_driver`, `previous_krono_driver`, `general_request`.

Admin Krono :
- Liste les livreurs dédiés d'un partenaire avec nom, téléphone, disponibilité, véhicule et opt-in B2B.
- Ajoute un livreur existant, refuse un utilisateur qui n'a pas `role = driver`, et retourne un warning si le livreur n'accepte pas encore les commandes B2B.
- Définit le livreur par défaut en remettant les autres rattachements du partenaire à `is_default = false`.
- Retire un livreur dédié.
- Liste et traite les demandes partenaire : validation avec `driver_user_id` ou rejet avec note.

Portail partenaire :
- Affiche les livreurs dédiés en lecture seule.
- Sur une nouvelle commande, propose "Assignation automatique" et les livreurs dédiés configurés ; les livreurs sans opt-in B2B sont désactivés avec un libellé clair.
- Sélectionne automatiquement le livreur par défaut si `is_default = true` et `accepts_b2b_orders = true`.
- Envoie `preferred_driver_id` seulement si la préférence livreur est activée.
- Permet de demander un livreur dédié depuis l'historique d'une commande livrée par Krono, ou via une demande générale.

Texte produit recommandé :

> Livreur dédié : Krono propose d'abord la commande au livreur sélectionné pour ce partenaire. Si aucun livreur dédié n'est disponible, l'assignation automatique prend le relais.

Texte de demande :

> Vous souhaitez un livreur dédié ? Envoyez une demande à Krono. Notre équipe vérifie le livreur et l'ajoute à votre compte si tout est conforme.

---

## 3. Tournées (delivery_batches)

Un partenaire B2B livre souvent plusieurs commandes en une seule sortie (ex : 8 colis confiés à un livreur). Le système :

1. Crée une tournée (`delivery_batches`) regroupant les commandes
2. Peut proposer un ordre conseillé via l'algorithme nearest-neighbor (haversine), sans l'imposer au livreur
3. Permet au livreur de valider chaque livraison une par une
4. Clôture la tournée automatiquement quand toutes les commandes sont `completed` ou `cancelled`

**Seuil minimum — décision 2026-07-26** : une tournée nécessite **au moins 3 commandes**. En dessous de 3, l'écran de création de tournée **refuse de valider** (message "Minimum 3 commandes pour une tournée") — pas de conversion automatique côté serveur. L'admin/partenaire crée alors ses 1 ou 2 commandes via l'écran normal de commande B2B individuelle (voir section 2, "Comportement dispatch B2B" — popup unitaire par commande, pas d'écran `/batch/:id`), une par une comme n'importe quelle commande unitaire. Pas encore implémenté (validation front à ajouter côté création de tournée admin).

Règle centrale : **une tournée B2B = une popup, une acceptation, une assignation** ; les livraisons enfants ne déclenchent pas de popups séparées.

Règle terrain : **le chauffeur choisit librement l'ordre des arrêts**. La tournée B2B est un lot business unique, mais côté conduite elle doit se comporter comme une liste de livraisons simples.

Notification livreur :
- L'offre de tournée est émise au niveau `batchId` via `batch-assigned` avec `status: "offer"` et `ordersCount`.
- Le message côté chauffeur doit présenter la tournée complète, par exemple "Nouvelle tournée B2B - 18 livraisons à effectuer".
- Le livreur a deux actions principales : accepter ou refuser.
- L'app chauffeur déduplique par `batchId` pour éviter plusieurs popups si le socket rejoue le même événement.
- Le backend ne doit pas envoyer `new-order-request` pour chaque livraison enfant d'une tournée.

Acceptation :
- L'acceptation se fait au niveau `batchId` (`accept-batch`).
- Si la tournée est libre, elle est assignée au livreur qui accepte.
- Si elle est déjà assignée au même livreur, l'app ouvre la tournée sans afficher "Tournée indisponible".
- Si elle est déjà assignée à un autre livreur, alors seulement l'app affiche l'indisponibilité.
- Le backend verrouille la ligne `delivery_batches` pendant l'acceptation pour rendre le double clic / double événement socket idempotent.

Après acceptation :
- L'écran `/batch/[batchId]` charge toutes les livraisons enfants via `GET /api/batches/:id`.
- Chaque arrêt propose scan QR, saisie manuelle du code, ou preuve alternative encadrée.
- Le livreur peut sélectionner n'importe quel arrêt restant ; aucun arrêt précédent ne doit bloquer la livraison choisie.
- Le backend vérifie que l'arrêt appartient bien à la tournée et au livreur avant de le clôturer.

### Flux détaillé côté livreur (driver_krono) — vérifié 2026-07-23

Fichiers impliqués : `app/batch/[batchId].tsx` (écran tournée), `components/BatchDeliveryFlow.tsx` (bouton collecte flottant sur la carte principale + bannière tournée + nettoyage du store au retour accueil), `store/useBatchStore.ts`, `services/batchApiService.ts`, `components/MapboxNavigationScreen.tsx`, `hooks/useGeofencing.ts`.

**Réception et acceptation** : le serveur envoie l'offre via socket (`pendingOffer` dans le store) ; popup d'acceptation ; si acceptée → `router.push('/batch/[batchId]')`.

**Phase collecte** : dès que la tournée est chargée avec des coordonnées de collecte, la navigation vers le point de collecte démarre **automatiquement** (pas de bouton manuel). L'arrivée est détectée par le callback natif Mapbox (`onArrive`) pour la navigation elle-même, et par un second geofencing dans `BatchDeliveryFlow.tsx` qui affiche un bouton flottant "Tous les colis récupérés" sur la carte principale. Confirmer appelle `confirmBatchPickup` (`PATCH /api/batches/:id/pickup`) → `pickedUp: true`. Fallback : si aucune coordonnée de collecte n'est fournie, une carte simple avec le bouton de confirmation s'affiche directement (rien à géolocaliser).

**Phase livraison** : liste des arrêts triés par position, chacun avec ses actions (Démarrer, Scanner QR, Entrer le code, Preuve alternative). Arrivée détectée par geofencing. Une fois un arrêt validé (`validateBatchOrder`), le livreur est **automatiquement dirigé vers l'arrêt suivant** sans dialogue de confirmation intermédiaire — mais reste libre de choisir un autre arrêt manuellement dans la liste.

**Méthodes de preuve** : `qr_scan`, `manual_code`, `photo_signature`, `batch_driver_confirmation`.

**Fin de tournée** : quand tous les arrêts sont `completed`/`cancelled`, écran de fin + bouton "Retour à l'accueil" qui réinitialise le store (`clearBatch()`) — un `useFocusEffect` de sécurité dans `BatchDeliveryFlow.tsx` vide aussi le store si l'utilisateur revient à l'accueil autrement (tous les arrêts traités mais store pas encore vidé). La bannière "Tournée · N restant(s)" sur la carte principale disparaît automatiquement dès que le store est vide (lecture réactive Zustand).

**ETA / navigation** : les deux phases (collecte et livraison) écrivent l'ETA courant dans `useBatchStore.setLastEtaMinutes()` à chaque tick Mapbox ; la bannière "Tournée · N restant(s)" affiche cette valeur en direct. Le **statut de la commande** (`picked_up`/`accepted`/`completed`/`cancelled`) est aussi émis en direct au client (payeur) via `emitOrderStatusToPayer()` (`orderSocket.ts`, ajouté le 2026-07-23) — c'est ce qui alimente la Live Activity/Dynamic Island côté `app_krono`.

**Langue de navigation** : la navigation Mapbox est forcée en français des deux côtés — iOS via `options.locale = Locale(identifier: "fr_FR")` (patch existant), Android via un patch ajouté le 2026-07-23 (`driver_krono/scripts/patches/MapboxNavigationView.kt`, copié sur `node_modules` au postinstall par `apply-mapbox-navigation-patch.js`) qui remplace le `Locale.US.language` codé en dur par `"fr"` pour la voix, et ajoute `.language("fr")` aux options de route pour la bannière de manœuvre. **Non vérifié sur un vrai build Android** (build local bloqué par le souci Gradle/JDK déjà connu) — à confirmer lors du prochain build réel.

### Notification tournée — règle anti-spam

Un batch de N commandes n'envoie **qu'une seule notification** au livreur via `emitBatchAssigned`. Les N commandes individuelles sont créées silencieusement via REST (pas de `notifyDriversForOrder`). Aucune popup d'offre individuelle n'apparaît pour les commandes appartenant à une tournée.

Si le livreur est hors ligne au moment du socket, la push `batch_assigned` (`driverPushService.ts`) lui permet de naviguer directement vers l'écran `/batch/:id` à l'ouverture de l'app.

---

## 4. Simulation — comment le livreur reçoit les commandes (référence produit)

Trois cas possibles selon la nature de la commande.

### Cas 1 — Commande classique (client particulier, 1 livraison)

```
CLIENT APP              BACKEND                  LIVREUR APP
    │                      │                          │
    │── passe commande ──►  │                          │
    │                      │── socket "new-order" ──► │
    │                      │                          │ [POPUP s'affiche — 30s]
    │                      │                          │  "Jean Dupont — 2 500 FCFA"
    │                      │                          │  [Accepter] [Décliner]
    │                      │ ◄── "accept-order" ──────│
    │                      │── confirmation ─────────►│
    │                      │                          │ [BottomSheet] → navigation
    │                      │                          │ → [Je pars] → géofencing auto
    │                      │                          │ → [Scanner QR] → TERMINÉ ✓
```

### Cas 2 — Tournée B2B (1 partenaire, N livraisons)

**1 seule notification groupée**, pas N popups séparées.

```
ADMIN                   BACKEND                  LIVREUR APP
    │                      │                          │
    │── crée N livraisons   │                          │
    │   pour "Resto Chez    │                          │
    │   Maman" ──────────►  │                          │
    │                      │ crée batch + optimise     │
    │                      │ l'ordre (haversine)       │
    │                      │── socket "batch-assigned"►│
    │                      │   { batchId, ordersCount, │
    │                      │     partner_name }        │
    │                      │                          │ Son + vibration
    │                      │                          │ → router.push("/batch/id")
    │                      │                          │ → GET /api/batches/:id
    │                      │                          │ → liste ordonnée affichée
```

Écran tournée — ce que voit le livreur :

```
┌────────────────────────────────────────┐
│  ←  Resto Chez Maman              🔄   │
│     #BATCH_XYZ                         │
│  3/10 livraisons       7 restantes     │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░       │
│                                        │
│  ①  Mamadou Diallo               📞   │
│     12 Rue des Peupliers              │
│     [Scanner QR] [Entrer code]        │
│     [Preuve alternative]              │
│  ②✓ Aïssa Koné          QR validé     │
│  ③✓ Ibrahima Sow         Code validé  │
│  ④  Fatou Traoré                 📞   │
│     45 Ave de la Paix                 │
│     [Scanner QR] [Entrer code]        │
│  ⑤…⑥…⑦…⑧…⑨…⑩                       │
│                                        │
│  Appui long sur preuve alternative     │
│  → annuler une livraison               │
└────────────────────────────────────────┘
```

Le livreur valide **stop par stop** dans l'ordre qu'il veut. Chaque stop doit avoir sa propre preuve. Quand tout est `completed` ou `cancelled` → écran "Tournée terminée !".

### Cas 3 — Commande B2B individuelle (1 livraison d'un partenaire)

Même flux que le Cas 1, mais la popup affiche le contexte B2B :

```
┌────────────────────────────────────────┐
│  [🧳 Commande B2B]                     │
│  Partenaire : Resto Chez Maman         │
│  Livraison 2/5 de la tournée           │
│  ─────────────────────────────────     │
│  Jean Dupont ⭐4.8          2 500 FCFA │
│  Moto · 3.2 km · 12 min               │
│  [Décliner]          [Accepter]        │
└────────────────────────────────────────┘
```

### Tableau récapitulatif

| Situation | Notification livreur | Comment valider |
|---|---|---|
| Client standard, 1 livraison | Popup d'acceptation (30s) | Géofencing + QR |
| Partenaire B2B, 1 livraison | Popup avec badge B2B + nom partenaire | Idem |
| Partenaire B2B, N livraisons (tournée) | 1 popup tournée avec `ordersCount` → écran liste des stops | QR/code/preuve alternative par stop |

### Règle socket (anti-spam tournée)

```
Tournée (batch)        → socket "batch-assigned"   → écran /batch/[id]
Commande individuelle  → socket "new-order-request" → popup d'acceptation
```

Les N commandes d'un batch sont créées **silencieusement** via REST. Aucune popup individuelle n'apparaît pour une commande appartenant à une tournée.

Si deux événements `batch-assigned` arrivent pour le même `batchId`, l'app chauffeur garde une seule popup visible. Si le livreur refuse, ce `batchId` est mis en sourdine pour la session afin d'éviter une reproposition immédiate en boucle.

---

## 5. Admin — deux points d'entrée de création de commande (Dashboard vs Planning) — décision 2026-07-26

À ne pas confondre avec `app_krono/components/NewB2BShippingModal.tsx` (mobile). Ici il s'agit de deux modals **admin_krono**, tous deux appelés depuis le dashboard web.

**Constat (audit code, 2026-07-26)** :
- `admin_krono/components/orders/NewShippingModal.tsx` (bouton "+ Nouvelle livraison" du Dashboard) — flux générique : client existant ou créé à la volée (numéro jamais inscrit chez Krono), livraison immédiate. Contient aussi un sélecteur `partnerId` optionnel (`t('newShipping.partnerLabel')`) qui est **le seul endroit du code** qui relie réellement une commande à un partenaire B2B facturable (déclenche commission + incrément de quota, cf. `computeB2BCommission` / `applyB2BPartnerMetadata` dans `adminOrderController.ts`).
- `admin_krono/components/orders/NewB2BShippingModal.tsx` (bouton "Nouvelle livraison B2B" de `admin_krono/app/(dashboard)/planning/page.tsx`) — force `isB2BOrder: true` et `isPhoneOrder: true` mais **ne propose aucune sélection de partenaire réel** (pas de champ `partnerId`). La date/heure "programmée" saisie à l'étape Détails est **capturée dans l'UI mais jamais envoyée au backend** (absente du payload `createOrder` et du contrôleur) — fonctionnalité de programmation actuellement inopérante (voir section 6 ci-dessous pour le plan de correction).
- Les deux modals postent vers le même endpoint (`POST /api/admin/orders` → `createAdminOrder`), avec des règles de flags qui se chevauchent sans coordination.

**Décision produit retenue** :
- **Dashboard "Nouvelle livraison"** reste le point d'entrée générique/immédiat : n'importe quel type de client, y compris ceux qui n'ont jamais utilisé Krono (création à la volée). Le sélecteur de partenaire B2B doit en être **retiré** — B2B ne s'y traite plus.
- **Planning**, renommé **"Commande B2B programmée"**, devient le point d'entrée **exclusif** du B2B : sélection d'un partenaire réel obligatoire (déplacer le sélecteur `partnerId` depuis le Dashboard) + date/heure de livraison réellement persistée côté serveur (corriger le payload/contrôleur pour ne plus la perdre). Le champ date/heure reste **obligatoire** (pas de commande B2B "immédiate" depuis cet écran) pour que le rôle des deux écrans reste sans ambiguïté.

**Statut** : décision validée avec l'utilisateur, **pas encore implémentée**.

---

## 6. Livraison programmée — refonte unifiée (décision 2026-07-26)

**Constat — deux mécanismes "programmée" disjoints, tous les deux inopérants côté backend** :

1. **App client `app_krono`** (n'importe quel client, pas seulement B2B) : option "Programmée" dans le choix du mode de livraison (`app_krono/constants/clientDeliveryMethods.ts:69`, id `'scheduled'`), au même niveau qu'"Express"/"Standard". C'est **uniquement un forfait de prix** (380 FCFA moto, `orderApi.ts:21`) + un champ texte libre "Créneau souhaité" (`DeliveryMethodBottomSheet.tsx:520-539`, ex. "entre 10h et 12h"), envoyé en `dropoff.details.scheduled_window_note` (`useMapNewOrder.ts:149-172`) — **aucune date/heure structurée**, aucun traitement métier backend (juste affiché tel quel au livreur, `driver_krono/components/OrderRequestPopup.tsx:422-426`).
2. **Admin Planning** `admin_krono/components/orders/NewB2BShippingModal.tsx` : vrai sélecteur date + heure, obligatoire (`scheduledDateValue`/`scheduledTimeValue`, lignes 69-70, 718-735), mais **jamais transmis** dans le payload `createOrder` (lignes 278-297) — saisi puis perdu.
3. Des restes de code défensif référencent `is_scheduled`/`scheduled_at` dans `orderSocket.ts:872,1420` et `orderSocketNotify.ts:133`, utilisés uniquement comme bonus de tri (`isPriorityOrder`, `orderMatchingService.ts:190,203-210` — bonus +1000 pour les livreurs `driver_type = 'internal'`, ne change ni le rayon de recherche ni le pool de candidats). Ces colonnes n'existent dans aucune migration de `orders` → toujours `undefined`/`null` en pratique.
4. Dispatch actuel : `createAdminOrder` sauvegarde `status: 'pending'` puis appelle **immédiatement**, dans la même requête HTTP, `notifyDriversForOrder()` (`orderSocket.ts:787`) qui notifie les livreurs proches par socket.io. Aucun délai, aucun cron, aucune queue nulle part dans `krono_backend/src` (vérifié : pas de `node-cron`/`BullMQ`/`pg_cron`). Une commande "programmée dans 2 jours" est donc aujourd'hui proposée aux livreurs immédiatement à la création, pas au moment prévu.

**Décision produit retenue** : un seul vrai mécanisme de programmation, partagé par les deux points d'entrée (app client + Planning B2B) plutôt que deux logiques disjointes.

1. **Migration** : ajouter une vraie colonne `scheduled_at TIMESTAMPTZ NULL` sur `orders` (remplace les usages `as any` existants) + statut `'scheduled'` distinct de `'pending'`.
2. **Côté app client** : remplacer le champ texte libre "Créneau souhaité" par un vrai sélecteur date/heure quand `speedOptionId === 'scheduled'` (`DeliveryMethodBottomSheet.tsx`), envoyé comme `scheduled_at` réel plutôt que `scheduled_window_note`.
3. **Côté Planning B2B** : corriger `NewB2BShippingModal.tsx` pour que `scheduledDateValue`/`scheduledTimeValue` soient effectivement envoyés à `createOrder` → `adminOrderController.ts` → colonne `scheduled_at`.
4. **Création** : si `scheduled_at` est fourni et dans le futur, `status` = `'scheduled'` à la place de `'pending'`, et **on saute l'appel à `notifyDriversForOrder`** — la commande existe en base (visible dans Planning / historique), invisible des livreurs tant qu'elle n'est pas dispatchée.
5. **Job périodique** (nouveau, même pattern que les jobs déjà existants dans `server.ts` — rappels de dette, facturation) : toutes les 1-2 minutes, cherche `status = 'scheduled' AND scheduled_at <= NOW()`, repasse en `'pending'`, appelle `notifyDriversForOrder` — dispatch réel déclenché au bon moment. Ce job doit aussi gérer le **retry** : si personne n'accepte, aujourd'hui la commande reste `pending` pour toujours sans jamais être re-proposée (`orderSocket.ts`, commentaire explicite "Ne pas annuler automatiquement... on pourrait réessayer" jamais implémenté) — à corriger pour les commandes programmées au minimum.

**Règle de disponibilité livreur au moment du dispatch (validée avec l'utilisateur 2026-07-26, affinée le même jour)** :

Deux régimes de disponibilité, mutuellement exclusifs :

1. **Régime "unitaire"** — s'applique à tous les types dispatchés en popup individuelle : classique, hors-ligne/opérateur, téléphonique, B2B individuelle, **et programmée une fois déclenchée**. Un seul quota, commun aux 5 : **3 commandes actives max** (celle en cours + 2 en attente) — c'est déjà la constante `MAX_ACTIVE_ORDERS_PER_DRIVER = 3`. Cycle : 0 commande → reçoit une proposition → 1 en cours → peut encore en recevoir → 1 en cours + 1 en attente → peut encore en recevoir → 1 en cours + 2 en attente (quota plein, plus aucune proposition) → dès qu'il termine la commande en cours, la suivante en attente devient "en cours", quota repasse à 2/3, il peut recevoir une nouvelle proposition. **Attention** : aujourd'hui ce plafond n'est vérifié qu'au moment où le livreur clique "accepter" (`orderSocket.ts:1572-1577`), pas en amont dans `findNearbyDrivers`/`findAllAvailableDrivers` — donc un livreur déjà à 3 commandes continue de recevoir des popups qu'il ne pourra pas accepter. À corriger : filtrer aussi en amont, pour ce régime comme pour la programmée.
2. **Régime "tournée"** — dès qu'un livreur a une tournée `delivery_batches.status = 'in_progress'` (3 livraisons minimum, voir section 3), il est **totalement bloqué** de toute nouvelle proposition, unitaire ou programmée, quelle que soit la taille de la tournée (3 ou 18 livraisons) — jusqu'à ce que **tous** les arrêts soient `completed`/`cancelled`. Pas de mélange entre les deux régimes : un livreur en tournée n'accumule pas en plus des commandes unitaires en attente. **Correction du 2026-07-26** : contrairement à ce qui était supposé, ce n'est **pas déjà le cas** dans le code — `is_available` n'est jamais mis à `false` à l'acceptation d'une tournée (`accept-batch`, `orderSocket.ts:1793-2005`, aucun `UPDATE driver_profiles`), donc un livreur en tournée reste aujourd'hui candidat à `findNearbyDrivers`/`findAllAvailableDrivers`. Vrai bug à corriger, pas une supposition acquise.

**La programmée ne bénéficie d'aucun régime spécial** : au moment où le job périodique la déclenche, elle doit vérifier exactement les mêmes conditions qu'une commande unitaire classique (quota 3 non atteint) et exclure tout livreur en tournée active — sinon un livreur déjà chargé se retrouve avec une proposition qu'il ne peut pas honorer, ce qui ralentit tout le monde (risque de plainte client sur la lenteur).

**Point d'attention supplémentaire relevé lors de l'audit** : il existe une **deuxième implémentation dupliquée** de `findNearbyDrivers`/`findAllAvailableDrivers` dans `krono_backend/src/sockets/orderSocketMatching.ts` (lignes 26-179, 186-320), utilisée par `orderSocketNotify.ts` — chemin d'appel séparé de celui d'`orderSocket.ts`. Toute correction de filtrage (quota, tournée) doit être appliquée **aux deux implémentations**, sinon la correction ne marche que sur un des deux chemins de dispatch selon lequel est réellement actif à l'exécution (à clarifier lequel des deux est le chemin live avant de corriger — risque de corriger le mauvais fichier).

**Statut** : décision validée avec l'utilisateur, **pas encore implémentée**. Périmètre large (migration + app client + admin Planning + backend dispatch + job périodique + filtre quota/tournée en amont + seuil minimum tournée avec bascule B2B individuelle + doublon `orderSocketMatching.ts`/`orderSocket.ts` à clarifier) — prévoir de découper en plusieurs étapes distinctes plutôt qu'un seul chantier.

---

## 7. Retry — commande sans livreur disponible (décision 2026-07-26)

**Constat actuel** : si aucun livreur ne répond/accepte dans les 30s (`DRIVER_OFFER_RESPONSE_MS`, `orderSocket.ts:332`), la commande reste `pending` **pour toujours**, sans jamais être re-proposée automatiquement (`orderSocket.ts`, commentaire explicite dans le code : "Ne pas annuler automatiquement... on pourrait réessayer" — jamais implémenté). Aucune distinction actuelle entre "personne n'a répondu" et "abandon silencieux total". Vrai pour **tous** les types de livraison, pas seulement la programmée — un problème de fiabilité général, pas propre au chantier programmée.

**Décision produit retenue** :

1. **Boucle de relance automatique** : à l'expiration du délai sans acceptation, une **nouvelle recherche complète** est relancée (pas la même liste de livreurs relancée — un nouveau passage `findNearbyDrivers`/`findAllAvailableDrivers`, pour capter les livreurs qui viennent de passer en ligne entre-temps).
2. **Backoff progressif** : le délai entre les cycles augmente progressivement, de 30s au départ jusqu'à un maximum de 1-2 minutes entre les tentatives (évite de marteler le système en boucle serrée).
3. **Élargissement automatique du rayon, mais borné** — si les premiers cycles échouent (rayon par défaut 10 km, `orderSocket.ts:489`), on élargit la zone de recherche, **sans dépasser un plafond maximum** (ex. un client à Abobo ne doit jamais se voir proposer un livreur venant de Treichville). **Valeur du plafond maximum non tranchée** — à fixer selon la réalité terrain d'Abidjan (proposition de départ 12-15 km, à valider).
4. **Plafond à 3 minutes** de recherche active totale (réduit depuis 5 min — au-delà, le client s'ennuie et décroche ; il peut de toute façon relancer lui-même autant de fois qu'il veut). Au-delà, la commande bascule vers l'état déjà documenté en section 1 du cycle officiel : `no_driver`/`declined` (« Aucun livreur ») — message explicite au client + action possible (nouvelle tentative manuelle, support, remboursement). Pas d'abandon silencieux, mais pas non plus de boucle infinie.
5. **Pas d'alerte admin automatique** : volontairement écarté — au démarrage de Krono notamment, "personne n'a pris la commande" est un cas normal et attendu, pas une anomalie qui justifie une intervention systématique. Le client garde la main (retente lui-même, ou contacte le support s'il le souhaite).
6. **Message client évolutif pendant les 3 minutes** : plutôt qu'un texte figé ("Recherche livreur") du début à la fin, faire évoluer le message avec le temps écoulé pour éviter que le client s'impatiente/décroche (ex. progression du ton rassurant à mesure que ça dure). Détail de copywriting à affiner séparément — pas un point de logique dispatch, mais à ne pas oublier.

**Portée** : ce mécanisme de retry doit s'appliquer à tous les types "régime unitaire" (classique, hors-ligne/opérateur, B2B individuelle, programmée une fois déclenchée). Les tournées ont leur propre logique (une seule offre au niveau du batch, pas de retry automatique documenté ici — à traiter séparément si besoin).

**Statut** : décision validée avec l'utilisateur, **pas encore implémentée**.

---

## 8. Informations affichées au livreur selon le type de commande (audit 2026-07-26)

### État actuel — commande unitaire (classique, B2B, hors-ligne/opérateur)

**Popup avant acceptation** (`driver_krono/components/OrderRequestPopup.tsx`) :
- Nom client + note (rating)
- Prix complet, distance, temps estimé
- **Adresse pickup ET dropoff complètes, en clair** — visibles avant acceptation
- Type de véhicule requis, mode de paiement
- Badge selon le cas (`AdminOrderInfo.tsx`) : « Commande B2B » / « Téléphonique · Opérateur » / « Hors-ligne · Opérateur »
- Si zone approximative (pas de GPS précis) : avertissement explicite + « appelez le client pour la position exacte »
- Notes détaillées (`courierNote`) : **masquées avant acceptation**, texte générique « consultez la fiche après acceptation »
- **Téléphone client : jamais affiché dans ce popup**, ni avant ni après — le composant n'y a même pas accès

**Après acceptation** (`DriverOrderBottomSheet.tsx`) : téléphone débloqué avec bouton « Appeler maintenant » ; bloc d'aide spécifique si hors-ligne/téléphonique.

### État actuel — tournée (batch)

**Popup d'offre avant acceptation** (`BatchOfferPopup.tsx`, type `BatchOffer`) : **seulement** nombre de livraisons + nom du partenaire + texte générique. **Rien d'autre** : pas de prix, pas d'adresse, pas de nom client, pas de téléphone — ces champs n'existent même pas dans le type utilisé par ce popup. Le livreur accepte une tournée entière à l'aveugle.

**Après acceptation** (`app/batch/[batchId].tsx`) : par arrêt — nom destinataire, téléphone (bouton appel), adresse, notes. **Aucun prix nulle part, même après acceptation** — le livreur ne sait jamais combien rapporte chaque livraison d'une tournée.

### Décisions retenues (2026-07-26)

- **Adresse visible avant acceptation pour l'unitaire : conservé tel quel.** Standard pour ce type d'app, aide le livreur à juger la faisabilité (distance réelle, zone) avant de s'engager ; risque faible.
- **Prix pour les tournées : à ajouter.** Aujourd'hui absent à tous les stades, contrairement à l'unitaire. Cible :
  - Dans le popup d'offre (avant acceptation) : ajouter le **montant total** de la tournée, pour que le livreur puisse juger si ça vaut le coup avant de s'engager sur plusieurs arrêts.
  - Dans l'écran détaillé (après acceptation) : montrer le prix **par arrêt**, pas seulement le total.
  - S'applique de la même façon peu importe l'origine de la tournée (grand partenaire B2B ou petit vendeur segment Hybride).
- **Livreurs internes Krono et tournées : pas de contradiction à lever.** Déjà documenté et voulu (section 2, "Comportement dispatch B2B") : les livreurs internes sont prioritaires sur les commandes/tournées B2B. Ils reçoivent bien des tournées, c'est même volontairement encouragé.

**Statut** : décisions validées avec l'utilisateur, **pas encore implémentées**.

---

## 9. Sujet parqué — onboarding business à l'inscription (à traiter séparément, pas de la logique de dispatch)

**Contexte soulevé (2026-07-26)** : dans le petit commerce ivoirien (ex. vendeuses sur TikTok), le vendeur fixe souvent lui-même un tarif de livraison par commune pour ses clients (ex. 1 500 FCFA proche, jusqu'à 2 500-3 000 FCFA plus loin) — un prix de vente à son client, indépendant de ce que Krono facture réellement au vendeur pour le service de livraison.

**Idée proposée** : à l'inscription d'un utilisateur qui s'inscrit "en tant que particulier exerçant un business" sur Krono (correspond au segment déjà documenté "Hybride, Starter, sans portail" — pas un nouveau profil), collecter quelques informations business en plus : comment il veut que ses livraisons se déroulent, combien il facture généralement ses propres livraisons à ses clients.

**Distinction importante à garder en tête pour la suite** :
- Prix Krono → marchand (ce que Krono facture pour le service) : déjà couvert par la grille tarifaire B2B existante (commission, forfait mensuel).
- Prix marchand → client final (ce que la vendeuse facture à sa cliente) : hors système Krono, décision commerciale du marchand.
- L'idée n'est **pas** de faire respecter/gérer ce deuxième prix dans Krono, juste de le **collecter comme donnée d'onboarding** (utile pour comprendre l'activité du marchand, éventuellement recommander la bonne formule, ou plus tard suggérer un tarif Krono cohérent avec sa marge) — pas de logique complexe à construire dans l'immédiat.

**Statut** : sujet identifié, **pas encore creusé** — discussion à reprendre séparément, touche à l'inscription/onboarding partenaire (section B2B de `krono-reference-unique.md`), pas à la logique de dispatch de ce fichier.
