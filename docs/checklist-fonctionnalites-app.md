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
