# Refactorisation : Commande acceptée + Mapbox

> Plan d'amélioration du flux complet livraison après migration Google Maps → Mapbox.

---

## 0. Schéma global du flux livraison

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLIENT (app_chrono)                    │  LIVREUR (driver_chrono)               │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│  1. Passe commande (pickup → dropoff)   │                                         │
│  2. Attend qu'un livreur accepte        │  • Reçoit la demande                    │
│  3. TRACKING ORDER : suit en temps réel  │  • Accepte la commande                  │
│     les déplacements du livreur         │  • Voit toutes les infos (adresses)    │
│  4. Voit : livreur → pickup → dropoff    │  4. "Je pars" → en route vers pickup   │
│  5. Livraison terminée → Paiement       │  5. Arrivé → "Récupérer le colis"      │
│                                         │  6. "Entamé sa course" → vers dropoff   │
│                                         │  7. Livrer le colis                    │
│                                         │  8. Être payé                          │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 1. Corrections immédiates (faites)

### Erreur "Accès refusé" getUserProfile
- **Problème** : Le client appelait `getUserProfile(driverId)` pour enrichir les infos du livreur, mais le backend renvoyait 403 (un utilisateur ne peut accéder qu'à son propre profil).
- **Solution** :
  - **Backend** (`orderSocket.ts`) : Enrichir `driverInfo` avec les données `users` + `driver_profiles` avant d'émettre `order-accepted`. Le client reçoit directement first_name, last_name, phone, profile_image_url.
  - **Client** (`userOrderSocketService.ts`) : Supprimer les appels à `getUserProfile` pour le driver. Utiliser uniquement les données du socket.

### Erreur "Maximum update depth exceeded"
- **Problème** : `useAnimatedRoute` avait des dépendances instables (`origin`, `destination` objets recréés à chaque render).
- **Solution** : Utiliser des clés stables `originKey`, `destKey` (chaînes "lat,lng") dans les dépendances des `useEffect`.

---

## 2. Statuts et vues carte (Mapbox)

| Statut | Client (app_chrono) — Carte | Livreur (driver_chrono) — Carte |
|--------|-----------------------------|----------------------------------|
| **pending** | Marqueur pickup + dropoff, recherche livreur (radar) | — |
| **accepted** | Marqueur livreur + route **livreur → pickup** + pickup + dropoff | Marqueur livreur + route **livreur → pickup** + marqueur pickup + dropoff |
| **enroute** | Marqueur livreur + route **livreur → pickup** (en cours) | Marqueur livreur + route **livreur → pickup** + marqueur pickup |
| **picked_up** | Marqueur livreur + route **livreur → dropoff** + dropoff | Marqueur livreur + route **livreur → dropoff** + marqueur dropoff |
| **delivering** | Idem picked_up (livreur en route vers dropoff) | Idem picked_up |
| **completed** | Carte neutre ou récap | — |

### Actions livreur par statut

| Statut | Action disponible | Effet |
|--------|-------------------|-------|
| accepted | **Je pars** | → enroute |
| enroute | **Récupérer le colis** | → picked_up |
| picked_up | **Entamé sa course** / Livrer | → delivering → completed |

---

## 3. Flux technique : livreur accepte la commande

```
[Driver] accepte → [Backend] order-accept
  → updateOrderStatusDB('accepted')
  → Création conversation
  → Émission order-accepted au client (avec driverInfo enrichi)
  → Émission order-accepted-confirmation au driver
  → broadcastOrderUpdateToAdmins

[Client] reçoit order-accepted
  → useOrderStore.updateOrderStatus / addOrder
  → setDriverCoordsForOrder (si lat/lng dans driverInfo)
  → updateOrder avec driver (first_name, last_name, phone, position...)
  → Sélection auto de la commande
  → Son "commande acceptée"

[Map] DeliveryMapView
  → orderDriverCoords depuis orderDriverCoordsMap
  → useAnimatedRoute (driver → pickup) si status accepted
  → Marqueur livreur (AnimatedVehicleMarker) + cercle + route
```

---

## 4. Organisation Mapbox par composant

### app_chrono (Client) — Tracking order

| Composant | Rôle | Données Mapbox |
|-----------|------|----------------|
| `DeliveryMapView` | Carte principale | Marqueurs pickup/dropoff, livreur, routes |
| `orderDriverCoordsMap` | Position livreur en temps réel | Mise à jour via socket `order:status:update` + `location` |
| `useAnimatedRoute` | Route driver→pickup ou driver→dropoff | Mapbox Directions API (via backend ou front) |
| `useAnimatedPosition` | Animation fluide du marqueur livreur | Interpolation entre positions |
| `TrackingBottomSheet` | Infos commande + statut | Texte selon status (enroute, picked_up, etc.) |

**Flux données client :**
```
Socket order-accepted → driverInfo (lat/lng) → setDriverCoordsForOrder
Socket order:status:update → location → setDriverCoordsForOrder
orderDriverCoordsMap → DeliveryMapView → marqueur + route
```

### driver_chrono (Livreur) — Vue livraison

| Composant | Rôle | Données Mapbox |
|-----------|------|----------------|
| `DriverMapView` | Carte livreur | Marqueur livreur, pickup, dropoff, routes |
| `useAnimatedRoute` | Route vers pickup ou dropoff | Mapbox Directions |
| `useRouteTracking` | Suivi position en temps réel | GPS + envoi au backend |
| `DriverOrderBottomSheet` | Actions (Je pars, Récupérer, Livrer) | Boutons selon status |
| `useGeofencing` | Détection arrivée pickup/dropoff | Distance driver ↔ cible |

**Flux données livreur :**
```
Driver GPS → updateDriverStatus (backend) → realDriverStatuses
Driver clique "Je pars" → update-delivery-status (enroute) → socket
Driver arrive pickup → "Récupérer" → update-delivery-status (picked_up)
Driver arrive dropoff → "Livrer" → update-delivery-status (completed)
```

### Backend — Synchronisation

| Événement | Émetteur | Récepteur | Données |
|-----------|----------|-----------|---------|
| `order-accepted` | Backend | Client | order + driverInfo (lat, lng, nom, phone) |
| `order:status:update` | Backend | Client + Driver | order + location (lat, lng) |
| `update-delivery-status` | Driver | Backend | orderId, status, location |

---

## 5. Pistes d'amélioration Mapbox

### A. Rendu carte (app_chrono)
- [ ] **Marqueur livreur** : Icône scooter/véhicule selon `vehicle_type` (moto/vehicule/cargo) au lieu d'un cercle violet
- [ ] **Animation fluide** : `useAnimatedPosition` + interpolation Mapbox pour le déplacement du marqueur
- [ ] **Route animée** : `useAnimatedRoute` déjà en place — vérifier que le tracé s'affiche correctement avec Mapbox
- [ ] **Zoom adaptatif** : Ajuster la caméra pour inclure pickup + dropoff + position livreur

### B. Mise à jour position livreur en temps réel
- **Actuel** : Le client reçoit `location` via `order:status:update` quand le livreur clique sur une action (Je pars, Récupérer, Livrer)
- [ ] **Amélioration** : Pour un suivi continu pendant la course, le backend pourrait émettre `driver:location:update` quand le driver envoie sa position via `updateDriverStatus` (API). Le client écoute déjà cet événement.
- [ ] **Fréquence** : Throttle 2–5 s côté driver pour éviter surcharge

### C. Côté driver (driver_chrono)
- [ ] **Carte** : Afficher la route pickup → dropoff avec Mapbox Directions
- [ ] **Marqueur client** : Position pickup visible
- [ ] **Navigation** : Option "Ouvrir dans Waze/Google Maps" pour la navigation réelle

### D. Gestion d'erreurs
- [ ] **Token Mapbox invalide** : Message clair + fallback
- [ ] **Route non calculable** : Afficher ligne droite + message
- [ ] **Socket déconnecté** : Indicateur visuel + reconnexion auto

---

## 6. Fichiers clés

| Rôle | Fichier | Rôle |
|------|---------|------|
| Backend | `chrono_backend/src/sockets/orderSocket.ts` | order-accept, enrichissement driverInfo |
| Backend | `chrono_backend/src/controllers/driverController.ts` | realDriverStatuses, getOnlineDrivers |
| Client | `app_chrono/services/userOrderSocketService.ts` | order-accepted, mise à jour store |
| Client | `app_chrono/components/DeliveryMapView.tsx` | Carte, marqueurs, routes |
| Client | `app_chrono/hooks/useAnimatedRoute.ts` | Route animée pickup/dropoff |
| Client | `app_chrono/hooks/useAnimatedPosition.ts` | Position animée du livreur |
| Driver | `driver_chrono/components/DriverMapView.tsx` | Carte livreur |

---

## 7. Plan d'implémentation recommandé

### Phase 1 — Tracking fiable (Sprint 1) ✅
1. [x] **Backend** : écouter `order:driver:location`, émettre `driver:location:update` au client
2. [x] **Driver** : `emitDriverLocation` avec throttle 3s + distance filter 15m
3. [x] **Client** : écoute déjà `driver:location:update` → `setDriverCoordsForOrder`
4. [ ] Tester : client voit marqueur bouger en temps réel pendant la course

### Phase 1b — UX "mise en relation" (polyline, caméra) ✅
1. [x] **Polyline visible** : contour blanc + trait violet foncé (#5B21B6), épaisseur 6px
2. [x] **Route dès acceptation** : driver émet position immédiatement à l'acceptation (handleAcceptOrder)
3. [x] **Fit caméra** : client fit sur driver + pickup + dropoff à l'assignation (une fois par statut)
4. [x] **Driver app** : même style polyline pour cohérence

### Phase 2 — Améliorer le rendu
1. [ ] Icône véhicule (moto/véhicule/cargo) selon `vehicle_type`
2. [ ] Zoom adaptatif : fit pickup + dropoff + livreur
3. [ ] ETA dynamique sur la carte (temps restant)

### Phase 3 — Robustesse
1. [ ] Gestion erreur Mapbox (token, réseau)
2. [ ] Fallback ligne droite si Directions échoue
3. [ ] Indicateur socket déconnecté

---

## 8. Prochaines étapes suggérées

1. **Tester** le flux complet : driver accepte → client voit marqueur + route
2. **Améliorer le marqueur** : icône véhicule selon type
3. **Vérifier** les mises à jour de position en temps réel (socket + orderDriverCoordsMap)
4. **Documenter** les variables d'environnement Mapbox pour chaque app

---

---

## 9. Alignement avec l'architecture "par couches" (ChatGPT)

> Référence : organisation données → temps réel → calcul route → rendu carte.

### Principe validé : Mapbox ne fait pas le tracking

| Rôle | Mapbox | Source de vérité |
|------|--------|------------------|
| Carte | Afficher carte, marqueurs, routes | — |
| Tracking | — | GPS driver + backend (socket) + client (rendu) |

### Comparaison : notre état actuel vs recommandations

| Recommandation | Notre état | Action |
|----------------|------------|--------|
| **2 événements distincts** : `order:status:update` (rare) + `order:driver:location` (fréquent) | ✅ Implémenté : backend écoute `order:driver:location`, émet `driver:location:update` au client | Fait |
| **Throttle + distance filter** côté driver (2–5 s, 10–20 m min) | ✅ Implémenté : 3 s + 15 m dans driver index | Fait |
| **orderDriverCoordsMap** : mise à jour simple, pas de recalcul monde entier | ✅ `setDriverCoordsForOrder` fait exactement ça | OK |
| **Route** : recalcul uniquement si statut change ou gros écart | ✅ `useAnimatedRoute` dépend de origin/destination/status | OK |
| **Marqueur animé** : interpolation + lissage | ✅ `useAnimatedPosition` | OK |
| **Caméra fit** : sur changement de statut, pas à chaque location | Partiel | À améliorer |
| **Selectors** : fonctions pures (route, marqueurs, camera) | Logique dans les composants | Optionnel : extraire en selectors |
| **Statuts granulaires** (arrived_pickup, arrived_dropoff) | On a accepted → enroute → picked_up → delivering → completed | Optionnel : géofencing peut déclencher ces états |

### Contrats Socket cibles

**A) Événements statut (rares)**
```
order:status:update
{ orderId, status, driverInfo?, timestamps? }
```

**B) Événements location (fréquents) — À IMPLÉMENTER**
```
order:driver:location  (ou driver:location:update avec orderId)
{ orderId, driverId, location: { lat, lng, heading?, speed?, accuracy? }, ts }
```

Règle : le client met à jour uniquement `orderDriverCoordsMap[orderId]`, pas de recalcul global.

### Plan d'exécution aligné

| Sprint | Objectif | Priorité |
|--------|----------|----------|
| **Sprint 1 — Tracking fiable** | Backend : events status + location séparés. Driver : envoi location throttlé. Client : orderDriverCoordsMap stable. | Critique |
| **Sprint 2 — Tracking fluide** | Interpolation marqueur, caméra fit sur status, icônes véhicule | Important |
| **Sprint 3 — Production** | Erreurs, fallback, logs, réduction re-renders | Important |

### Point crucial à valider

- **Driver** : un seul `orderId` actif (ou logique multi-order claire)
- **Backend** : quand un driver envoie `location`, on sait à quelle commande ça appartient
- **Client** : Mapbox = rendu uniquement, pas de logique métier

---

*Dernière mise à jour : février 2026*
