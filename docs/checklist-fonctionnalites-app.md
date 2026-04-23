# Krono — checklist fonctionnalités app

Ce fichier suit les **actions à exécuter**. Les décisions produit et règles durables restent dans `docs/krono-reference-unique.md`.

---

## Mini-checklist Krono 8,5/10 — cohérence commande

Objectif : toutes les surfaces Krono doivent raconter la même histoire : app client, app chauffeur, backend, sockets, push, Dynamic Island, tracking public et admin.

### 1. Table officielle des statuts

- [x] Verrouiller le sens métier de chaque statut : `pending`, `accepted`, `enroute`, `in_progress`, `picked_up`, `delivering`, `completed`, `cancelled`, `declined`.
- [x] Associer à chaque statut : message client, message chauffeur, message destinataire, notification, temps attendu.
- [x] Appliquer la décision : `in_progress` = livreur arrivé au point de collecte / prise en charge imminente.

### 2. Source unique de libellés produit

- [x] Centraliser les textes visibles : `Recherche livreur`, `Prise en charge dans X min`, `Livraison dans X min`, `Livreur arrivé`, `Livraison terminée`.
- [x] Supprimer côté client les libellés vagues : `Route`, `En route`, `ETA`, sauf usage interne/debug.
- [x] Réutiliser la même logique dans app client, backend push, Live Activity et tracking public.

### 3. Source unique temps/progression

- [x] Avant colis récupéré : calcul livreur -> point de collecte.
- [x] Après colis récupéré : calcul livreur ou pickup -> destination.
- [x] Produire le même `etaLabel`, `phase` et `progress` pour écran suivi, Dynamic Island, push et tracking public.
- [x] Vérifier que la barre de progression ne contredit jamais les minutes affichées.

### 4. Données livreur unifiées

- [x] Utiliser `users.avatar_url` comme source principale de l'avatar.
- [x] Utiliser le même fallback partout : avatar alternatif, puis initiales.
- [x] Aligner nom, téléphone, plaque, véhicule et position entre les surfaces.
- [x] Vérifier que si l'avatar apparaît sur une surface autorisée, il peut apparaître sur les autres surfaces autorisées.

### 5. Temps réel stabilisé

- [x] Backend = source de vérité statut.
- [x] Socket = diffusion rapide.
- [x] Store client/chauffeur = miroir local.
- [x] Polling = filet de sécurité si socket raté.
- [x] Live Activity et tracking public ne doivent pas inventer un état différent.

### 6. Notifications nettoyées

- [x] Une notification utile par changement important.
- [x] Pas de push répétée si Live Activity affiche déjà l'état.
- [x] Push critique obligatoire : aucun livreur, annulation, paiement bloqué, livraison terminée si app absente.
- [x] Destinataire : push si compte lié, sinon SMS/lien tracking selon config.

### 7. Cas d'erreur élégants

- [x] Aucun livreur trouvé.
- [x] Réseau absent ou socket perdu.
- [x] Position livreur indisponible.
- [x] Paiement/reliquat incomplet.
- [x] QR impossible à scanner.
- [x] Commande bloquée dans un statut trop longtemps.

---

## Tests d'acceptation

- [x] Client crée une commande : il voit `Recherche`, pas un faux temps.
- [x] Livreur accepte : client voit `Prise en charge dans X min`.
- [x] Livreur récupère le colis : client voit `Livraison dans X min`.
- [x] Livraison proche : progression et minutes restent cohérentes.
- [x] Commande terminée : Live Activity se ferme proprement et l'app montre `Livraison terminée`.
- [x] Avatar livreur visible partout où il est autorisé.
- [x] Aucun écran client ne montre `Route`, `En route` ou `ETA`.

Validation locale :

- `app_chrono` : `npx tsc --noEmit`
- `chrono_backend` : `npm run build`
- `admin_chrono` : `npx tsc --noEmit`
- `chrono_backend` : `npm run test:unit -- --watchman=false --runTestsByPath tests/unit/utils/orderProductRules.test.ts`
- racine : `git diff --check`
- patch iOS : `patch-package --error-on-fail` sur `expo-widgets@55.0.13`

---

## Mini-checklist Krono 9/10 — ETA dynamiques Dynamic Island / Live Activity

Objectif : faire en sorte que le Dynamic Island, la Live Activity et les surfaces liées affichent **le bon ETA dynamique de la phase active**, jamais un ETA statique ou un faux `1 min`.

### Diagnostic actuel

- [x] Le comportement attendu est clair :
  - avant récupération du colis : ETA = **livreur -> point de collecte**
  - après récupération du colis : ETA = **livreur -> destination**
- [x] Le problème actuel est identifié :
  - fallback statique `pickup -> dropoff` encore utilisé dans certains chemins
  - fallback `1 min` encore utilisé quand l’ETA dynamique n’est pas disponible
  - risque de réutiliser un ETA d’une phase précédente dans la phase suivante
- [x] Les zones à corriger sont connues :
  - `app_chrono/services/orderLiveActivity.ts`
  - `chrono_backend/src/services/liveActivityApnsService.ts`
  - `app_chrono/utils/orderProductRules.ts`
  - éventuellement le rendu `app_chrono/widgets/orderTrackingLiveActivity.tsx` si le fallback visuel doit changer

### Règle produit à appliquer

- [x] `pending` : afficher `Recherche`, sans ETA.
- [x] `accepted` / `enroute` / `in_progress` : afficher l’ETA dynamique **position livreur -> collecte**.
- [x] `picked_up` / `delivering` : afficher l’ETA dynamique **position livreur -> destination**.
- [x] `completed` / `cancelled` / `declined` : ne plus afficher d’ETA.
- [x] Interdire tout ETA statique principal basé seulement sur `pickup -> dropoff`.
- [x] Interdire le fallback visuel `1 min` quand aucune donnée de mouvement fiable n’existe.

### Source unique ETA dynamique

- [x] Créer ou extraire une fonction unique qui reçoit :
  - `status`
  - `driverCoords`
  - `pickupCoords`
  - `dropoffCoords`
  - `deliveryMethod`
- [x] Cette fonction doit retourner au minimum :
  - `phase`
  - `target`
  - `etaLabel`
  - `progress`
- [x] La même logique doit alimenter :
  - écran suivi client
  - Dynamic Island côté app
  - Live Activity APNs côté backend
  - tracking public si ETA affiché

### Hiérarchie de fallback

- [x] Source 1 : position live du livreur.
- [x] Source 2 : dernière position connue récente du livreur.
- [x] Source 3 : statut sans minute si aucune position fiable n’existe.
- [x] Ne jamais inventer `1 min` par défaut pour masquer une absence de données.
- [x] Ne jamais conserver l’ETA pickup quand la commande est déjà passée en `picked_up`.

### Progression

- [x] La barre de progression doit suivre la même phase que l’ETA affiché.
- [x] Avant collecte : progression relative vers le point de collecte.
- [x] Après récupération : progression relative vers la destination.
- [x] Si l’ETA réel monte ou descend avec le mouvement, la progression doit raconter la même histoire.

### Ordre de codage recommandé

- [x] Extraire la règle ETA dynamique dans un helper partagé.
- [x] Brancher `orderLiveActivity.ts` sur ce helper.
- [x] Brancher `liveActivityApnsService.ts` sur ce helper ou son équivalent backend strictement aligné.
- [x] Retirer les fallbacks `pickup -> dropoff` et `1 min` qui servent encore de valeur principale.
- [x] Ajuster le rendu compact/minimal pour qu’il n’affiche pas une minute fictive.
- [x] Ajouter des tests ciblés sur les transitions `accepted -> picked_up -> delivering`.

### Tests d’acceptation

- [x] Commande non acceptée : Dynamic Island affiche `Recherche`.
- [x] Livreur accepté : l’ETA affiché correspond à la distance réelle **livreur -> collecte**.
- [x] Livreur au point de collecte : l’ETA baisse jusqu’à `arrivé` / `< 1 min`, pas un temps statique.
- [x] Dès `picked_up` : l’ETA bascule immédiatement sur **livreur -> destination**.
- [x] Si la navigation affiche `11 min`, le Dynamic Island ne doit pas afficher `1 min`.
- [x] Si la map affiche `< 1 min`, le Dynamic Island ne doit pas afficher `5 min` statique.
- [x] Aucune surface ne conserve un ETA d’une phase précédente après transition de statut.

Validation locale :

- `app_chrono` : `npx tsc --noEmit`
- `chrono_backend` : `npm run build`
- `chrono_backend` : `npm run test:unit -- --watchman=false --runTestsByPath tests/unit/utils/orderProductRules.test.ts`
- racine : `git diff --check`
