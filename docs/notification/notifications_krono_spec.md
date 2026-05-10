# Spécification complète — Notifications Krono

> Document de référence. Mise à jour : 2026-05-10.  
> Couvre **tous les types de livraison** et **tous les canaux** de notification.

---

## Table des matières

1. [Types de livraison](#1-types-de-livraison)
2. [Canaux de notification disponibles](#2-canaux-de-notification-disponibles)
3. [Livraison B2C classique](#3-livraison-b2c-classique)
4. [Livraison B2B — Tournée groupée](#4-livraison-b2b--tournée-groupée)
5. [Livraison planifiée (scheduled)](#5-livraison-planifiée-scheduled)
6. [Notifications livreur](#6-notifications-livreur)
7. [Notifications admin / partenaire](#7-notifications-admin--partenaire)
8. [Matrice globale](#8-matrice-globale)
9. [Diagnostic — Ce qui manque ou est à vérifier](#9-diagnostic--ce-qui-manque-ou-est-à-vérifier)

---

## 1. Types de livraison

| Dimension | Valeurs |
|---|---|
| **Modèle** | B2C (client particulier) · B2B (partenaire, tournée groupée) |
| **Timing** | À la demande (`is_scheduled = false`) · Planifiée (`is_scheduled = true`) |
| **Véhicule** | Moto (`moto`) · Cargo (`cargo`) · Véhicule (`vehicule`) |
| **Priorité** | Standard · Sensible (`is_sensitive`) · VIP (`is_vip`) |
| **Paiement** | Immédiat (cash) · Différé B2B (deferred) |

---

## 2. Canaux de notification disponibles

| Canal | Destinataire | Condition |
|---|---|---|
| **Push Expo (app)** | Client avec app Krono | Token Expo enregistré |
| **Push Expo (app)** | Destinataire avec app Krono | Compte lié au numéro de téléphone |
| **SMS Twilio** | Destinataire SANS app | Pas de compte Krono + numéro valide |
| **WhatsApp Twilio** | Destinataire B2B | Configuré côté serveur |
| **Web Push** | Visiteur page `/track` | Abonné aux notifications web |
| **Live Activity (iOS)** | Client avec app iOS | Token APNS actif |
| **Socket temps réel** | Client connecté | Session active dans l'app |

---

## 3. Livraison B2C classique

### 3a. Client AVEC l'app Krono (Expo push)

| Statut | Titre push | Corps push | Reçu ? |
|---|---|---|---|
| `pending` | *(aucune)* | *(aucune)* | — |
| `accepted` / `enroute` | **Prise en charge** | Le livreur se dirige vers le point de collecte. | ✅ |
| `in_progress` | **Livreur arrivé** | Le livreur est au point de collecte. | ✅ |
| `picked_up` | **Colis récupéré** | Le livreur a récupéré le colis. | ✅ |
| `delivering` | **Livraison en cours** | Le livreur se dirige vers la destination. | ✅ |
| `completed` | **Livraison terminée** | Votre commande est livrée. | ✅ |
| `cancelled` | **Commande annulée** | Votre commande a été annulée. | ✅ |
| `declined` | **Commande refusée** | Votre commande n'a pas été acceptée. | ✅ |

> **Payload data :** `{ type: "order_status", orderId, status, trackUrl }`  
> **Tap :** Ouvre `/order-tracking/{orderId}`

---

### 3b. Destinataire AVEC l'app Krono (différent du payeur)

| Statut | Titre push | Corps push |
|---|---|---|
| `accepted` / `enroute` | **Prise en charge** | Le livreur va récupérer le colis. |
| `in_progress` | **Livreur arrivé** | Le livreur est au point de collecte. |
| `picked_up` | **Colis récupéré** | Votre colis a été récupéré. |
| `delivering` | **Livraison en cours** | Le livreur se dirige vers vous. |
| `completed` | **Livraison terminée** | Votre colis a été livré. |
| `cancelled` | **Commande annulée** | Cette livraison a été annulée. |
| `declined` | **Commande refusée** | Cette livraison n'a pas été acceptée. |

---

### 3c. Destinataire SANS l'app Krono (SMS de secours)

Envoyé **uniquement si** le destinataire n'a pas de compte Krono lié à son numéro.

| Statut | Message SMS |
|---|---|
| `accepted` / `enroute` | `Krono — Prise en charge. Le livreur va récupérer le colis. Suivi : {url}` |
| `picked_up` | `Krono — Colis récupéré. Le livreur a récupéré votre colis. Suivi : {url}` |
| `delivering` | `Krono — Livraison en cours. Le livreur se dirige vers vous. Suivi : {url}` |
| `completed` | `Krono — Livraison terminée. Votre colis a été livré. Suivi : {url}` |
| `cancelled` | `Krono — Commande annulée. Cette livraison a été annulée. Suivi : {url}` |

---

### 3d. Live Activity iOS (Dynamic Island)

Mise à jour en temps réel à chaque changement de statut.

| Statut | Événement APNS | Contenu affiché |
|---|---|---|
| `accepted` → `delivering` | `update` | ETA · progression · initiales livreur · plaque |
| `completed` / `cancelled` / `declined` | `end` | Fin de l'activité |

Mise à jour de **position GPS** toutes les ~6 secondes si déplacement > 1,5 % de progression.

---

### 3e. Web Push (page `/track`)

Envoyé aux visiteurs abonnés aux notifications de la page de suivi.

| Statut | Titre | Corps |
|---|---|---|
| `accepted` / `enroute` | Prise en charge | Le livreur va récupérer le colis. |
| `picked_up` | Colis récupéré | Votre colis a été récupéré. |
| `delivering` | Livraison en cours | Le livreur se dirige vers vous. |
| `completed` | Livraison terminée | Votre colis a été livré. |

---

## 4. Livraison B2B — Tournée groupée

### Flux chronologique complet

```
1. Livreur accepte la tournée (accept-batch)
   └─▶ notifyB2BBatchRecipientsProof() pour chaque commande du batch
       ├─ Push "Code de livraison : XXXXXX" → destinataire AVEC app
       └─ WhatsApp ou SMS avec code → destinataire SANS app

2. Statuts intermédiaires (accepted → in_progress → picked_up)
   └─▶ notifyAllForOrderStatus() pour chaque commande
       ├─ Push → payeur
       ├─ Push → destinataire (si compte)
       └─ SMS → destinataire (si sans compte)

3. Livreur livre chaque arrêt (QR scan / code manuel)
   └─▶ Statut "completed" → notification finale par commande
```

---

### 4a. Destinataire B2B AVEC l'app Krono

| Moment | Canal | Titre | Corps |
|---|---|---|---|
| Batch accepté par livreur | Push | `Code de livraison : {code}` | Votre livreur Krono est en chemin. Montrez ce code à la réception. |
| Colis récupérés (`picked_up`) | Push | **Colis récupéré** | Votre colis a été récupéré. |
| En route vers vous (`delivering`) | Push | **Livraison en cours** | Le livreur se dirige vers vous. |
| Livré (`completed`) | Push | **Livraison terminée** | Votre colis a été livré. |

> **Tap sur "Code de livraison" :** doit ouvrir `/order-tracking/{orderId}?openQR=1` → modal QR s'ouvre automatiquement *(correction déjà implémentée)*.

---

### 4b. Destinataire B2B SANS l'app Krono

| Moment | Canal | Message |
|---|---|---|
| Batch accepté | **WhatsApp** (prioritaire) | `Krono - code de réception {label} : {code}. Montrez ce code ou le QR au livreur Krono. Lien : {url}` |
| Batch accepté | **SMS** (fallback si WhatsApp KO) | Même message |
| Livré (`completed`) | **SMS** | `Krono — Livraison terminée. Votre commande est livrée. Suivi : {url}` |

---

### 4c. Payeur B2B (partenaire qui commande)

Reçoit les mêmes notifications push que le payeur B2C classique, à chaque changement de statut pour chaque commande du batch.

---

## 5. Livraison planifiée (scheduled)

Même flux que B2C classique. La seule différence : la commande reste en `pending` jusqu'à `scheduled_at`, puis le moteur d'attribution démarre normalement.

> **À vérifier :** une notification de rappel (type `order_status_reminder`) est prévue dans le code mais son déclenchement automatique n'a pas été confirmé actif en production.

---

## 6. Notifications livreur

### 6a. Nouvelle commande (B2C)

Envoyée via **socket** uniquement (pas de push Expo pour les offres).

| Événement socket | Contenu | Délai réponse |
|---|---|---|
| `new-order-request` | Objet commande complet (adresses, prix, note, méthode véhicule, is_b2b) | 30 secondes |

Si le livreur ne répond pas → le système passe au suivant.

---

### 6b. Nouvelle tournée groupée (B2B)

| Événement socket | Contenu |
|---|---|
| `batch-assigned` | `{ batchId, ordersCount, partner_id, partner_name, status: 'offer' }` |
| `batch-offer-replay` | Même payload (livreur reconnecté) |

---

### 6c. Mises à jour reçues par le livreur

| Événement | Déclencheur | Payload |
|---|---|---|
| `order:status:update` | Changement de statut externe (ex. QR scanné côté client) | `{ order, location, dbSaved }` |
| `order-cancelled` | Commande annulée | `{ orderId, reason, message }` |
| `driver:geofence:event` | Arrivée en zone pickup/dropoff | `{ orderId, type, location }` |

> **Aucun push Expo n'est envoyé au livreur** pour les offres ou statuts. Tout passe par socket.

---

## 7. Notifications admin / partenaire

Persistées en base (`admin_notification_feed`) — affichées dans le tableau de bord.

| Événement | Titre | Corps |
|---|---|---|
| Commande créée | Nouvelle commande | Commande #{id_court} |
| Commande assignée | Commande assignée | #{id_court} → livreur |
| Commande annulée | Commande annulée | #{id_court} |
| Statut mis à jour | Mise à jour commande | #{id_court} → {statut} |

---

## 8. Matrice globale

| Type | Statut | Push payeur | Push destinataire | SMS | Web Push | WhatsApp | Live Activity |
|---|---|---|---|---|---|---|---|
| **B2C** | pending | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| | accepted/enroute | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| | in_progress | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| | picked_up | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| | delivering | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| | completed | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| | cancelled/declined | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| **B2B batch** | acceptation batch | — | ✅ code | ✅ code | ✗ | ✅ code | ✗ |
| | picked_up | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| | delivering | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |
| | completed (par arrêt) | ✅ | ✅ | ✅* | ✅ | ✗ | ✅ |

`✅*` = SMS uniquement si le destinataire n'a pas de compte Krono  
`—` = non applicable (événement niveau batch, pas commande individuelle)

---

## 9. Diagnostic — Ce qui manque ou est à vérifier

### 🔴 Problème confirmé : notifications intermédiaires B2B non reçues

**Constat :** Lors du test de la tournée groupée, seules les notifications `completed` ont été reçues (3 × "Livraison terminée"). Les statuts `accepted`, `in_progress`, `picked_up`, `delivering` n'ont pas été notifiés.

**Causes possibles à investiguer :**

**A) `confirmBatchPickup()` n'émet pas les événements socket individuels**  
Quand le livreur clique "Tous les colis récupérés", le backend met à jour toutes les commandes du batch en `picked_up`. Il faut vérifier que cette mise à jour déclenche bien `notifyAllForOrderStatus()` pour **chaque** `orderId` — et pas seulement une mise à jour SQL silencieuse.  
→ Fichier : `chrono_backend/src/controllers/batchController.ts` (lignes 330–374)

**B) L'acceptation du batch ne déclenche pas `notifyAllForOrderStatus(status: 'accepted')`**  
L'appel `notifyB2BBatchRecipientsProof()` (codes de livraison) est fait, mais la notification de statut `accepted` pour chaque commande n'est peut-être pas émise séparément.  
→ Fichier : `chrono_backend/src/sockets/orderSocket.ts` (ligne 1899)

**C) Déduplication trop agressive**  
La table `order_status_push_sent` empêche d'envoyer deux fois le même statut pour la même commande. Si lors d'un test précédent ces statuts ont déjà été envoyés, ils seront ignorés.

---

### 🟡 À vérifier : push "Code de livraison" B2B bien reçu

Le push `delivery_proof_code` est envoyé une seule fois à l'acceptation du batch. Si le token Expo n'était pas encore enregistré au moment de l'envoi, la notification est perdue sans retry.

---

### 🟡 À vérifier : `in_progress` déclenche bien une notification

Dans `orderProductRules.ts`, le statut `in_progress` a une copie push définie ("Livreur arrivé"). Mais dans le tableau de la matrice globale, ce statut est marqué **silent** pour le niveau de notif. Vérifier si `notifyAllForOrderStatus()` filtre ce statut ou l'envoie bien.

---

### 🟢 Correct : completed notifié pour chaque arrêt

La confirmation QR / code manuel appelle `qrCodeController.ts` qui émet le statut `completed` et déclenche `notifyAllForOrderStatus()` → push reçu ✅.

---

### Prochaines étapes recommandées

- [ ] **1.** Lire `batchController.ts:confirmBatchPickup` et vérifier si les statuts `picked_up` sont notifiés pour chaque commande
- [ ] **2.** Lire `orderSocket.ts` autour de la ligne 1899 pour vérifier si `accepted` est notifié per-order lors de `accept-batch`
- [ ] **3.** Si manquant, ajouter les appels `notifyAllForOrderStatus()` dans ces deux endroits
- [ ] **4.** Tester avec un nouveau batch (comptes frais, tokens valides) pour confirmer réception de toutes les étapes
