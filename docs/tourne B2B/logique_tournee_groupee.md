# Logique de fonctionnement — Tournée groupée (état actuel)

## Fichiers impliqués
- `app/batch/[batchId].tsx` — écran principal de la tournée
- `store/useBatchStore.ts` — état global de la tournée
- `services/batchApiService.ts` — appels API
- `app/(tabs)/index.tsx` — gère l'offre batch, le géofencing collecte, et le Dynamic Island
- `components/BatchOfferPopup.tsx` — popup d'acceptation de l'offre
- `hooks/useGeofencing.ts` — détection de zone
- `components/MapboxNavigationScreen.tsx` — navigation intégrée

---

## 1. Réception et acceptation de l'offre

- Le serveur envoie une offre via socket → stockée dans `useBatchStore.pendingOffer`
- `BatchOfferPopup` s'affiche dans `index.tsx` avec le nombre de colis et le partenaire
- Si accepté → `router.push('/batch/[batchId]')` + `setActiveBatch` dans le store
- Si refusé → `clearPendingOffer`

---

## 2. Chargement de la tournée

- `BatchScreen` reçoit `batchId` via les params de route
- Si `activeBatch` est vide ou sans stops → appel `getBatch(batchId)` → `setActiveBatch`
- `getBatch` retourne : id, stops (triés par position), pickupAddress, pickupCoordinates, partner_name, pickedUp

---

## 3. Détermination de `pickedUp`

`pickedUp` est `true` si :
- Au moins un order a le statut `picked_up`, `delivering`, `completed` ou `cancelled`
- OU si le batch a le statut `completed` ou `partial`

---

## 4. Phase collecte (avant `pickedUp`)

**Écran affiché :** ScrollView "Point de collecte" avec :
- Icône + titre + nombre de colis
- Adresse du point de collecte
- Bouton "Naviguer vers le point de collecte" (si `pickupCoordinates` présent)
- Bouton "Tous les colis récupérés" (toujours visible)

**Navigation pickup :**
- Déclenchée manuellement via `startPickupNavigation`
- Lance `MapboxNavigationScreen` en `StyleSheet.absoluteFill`
- Annonce vocale au démarrage : *"Commande B2B prise en charge, nous pouvons entamer la tournée."*
- `handlePickupRouteProgressChange` : annonce vocale à 1 min restante
- `markArrivedAtPickup` (via géofencing) → `showPickupArrivalBtn = true`

**Géofencing collecte (double) :**
- Dans `batch/[batchId].tsx` : `useGeofencing` sur `pickupCoordinates` → `markArrivedAtPickup`
- Dans `index.tsx` : second `useGeofencing` identique → `setShowBatchPickupBtn(true)` (bouton flottant sur la map principale)
- Fallback si pas de `pickupCoordinates` : bouton affiché directement dès que stops chargés

**Confirmation collecte (`handleConfirmPickup`) :**
- Appel `confirmBatchPickup(batchId)` → PATCH `/api/batches/:id/pickup`
- `setPickedUp(batchId)` dans le store → `pickedUp: true`, `status: 'in_progress'`
- Annonce vocale : *"Tous les colis pris en charge. Vous pouvez commencer vos livraisons."*

---

## 5. Phase livraison (après `pickedUp`)

**Écran affiché :** ScrollView avec la liste des stops, chaque stop contient :
- Badge position (numéro) + statut (vert/rouge si done/cancelled)
- Nom destinataire, adresse, notes, statut pill, badge preuve
- Actions : Démarrer (nav), Scanner QR, Entrer le code, Preuve alternative

**Barre de progression :** `terminalCount/totalCount` arrêts traités

**Navigation vers un stop (`startNavigationToStop`) :**
- Lance `MapboxNavigationScreen` en `absoluteFill`
- `handleRouteProgressChange` : annonces vocales à 1 min
- `markArrivedAtStop` (via géofencing) → `showArrivalActions = true`
- Boutons d'arrivée : Scanner QR / Code / Preuve alternative

**Validation d'un stop (`finalizeProofDelivery`) :**
- Appel `validateBatchOrder(batchId, orderId, 'completed', proof)` → PATCH `/api/batches/:id/orders/:orderId`
- `updateStop(orderId, 'completed', proof)` dans le store
- Haptic success
- Alert "Arrêt suivant — Naviguer vers X ?" (actuellement présent)

**Annulation d'un stop :** appui long sur "Preuve alternative" → Alert → `validateBatchOrder(..., 'cancelled')`

---

## 6. Méthodes de preuve

| Méthode | Déclencheur |
|---|---|
| `qr_scan` | Scanner QR → `qrCodeService.scanQRCode` |
| `manual_code` | Saisie 6 chiffres → `qrCodeService.manualVerify` |
| `photo_signature` | Photo + nom destinataire |
| `batch_driver_confirmation` | Confirmation directe livreur |

---

## 7. Fin de tournée

- Quand tous les stops sont `completed` ou `cancelled` → `allDone = true`
- Écran : cercle vert + "Tournée terminée !" + stats + bouton "Retour à l'accueil"
- "Retour à l'accueil" → `router.replace('/(tabs)')` (le store n'est pas vidé — bug connu, point 8 du fichier améliorations)

---

## 8. Store `useBatchStore`

| Champ | Rôle |
|---|---|
| `activeBatch` | Tournée en cours (stops, pickedUp, coords…) |
| `pendingOffer` | Offre en attente d'acceptation |
| `offerError` | Erreur lors de l'acceptation |
| `navigationStopOrderId` | Stop en cours de navigation (persisté pour restauration) |
| `isLoading` | Chargement en cours |

---

## 9. Ce qui n'est PAS géré dans `batch/[batchId].tsx`

- Le bouton collecte flottant sur la map principale → géré dans `index.tsx`
- L'ETA du Dynamic Island → **non alimenté** par la tournée (bug connu)
- La réinitialisation du store au retour à l'accueil → **non fait** (bug connu)
