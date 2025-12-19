# 🔔 Comportement du Système de Notifications - Dashboard Admin

## 📋 Vue d'ensemble

Le système de notifications du dashboard admin fonctionne en **temps réel** via Socket.IO et affiche les notifications dans un dropdown accessible depuis l'icône de cloche dans le Header.

**🔊 Sons** : Les notifications déclenchent automatiquement des sons :
- `new-order.wav` pour les notifications de commandes
- `new-message.wav` pour les notifications de messages

---

## 🔄 Flux de Fonctionnement

### 1. **Initialisation** (Au chargement du Dashboard)

```
Dashboard Layout → useNotifications() hook activé
    ↓
Écoute des événements Socket.IO :
  - order:created
  - order:status:update
  - new-message (via adminMessageSocketService)
```

**Comportement** :
- Le hook `useNotifications()` est appelé dans `app/(dashboard)/layout.tsx`
- Il s'abonne automatiquement aux événements Socket.IO
- Les notifications sont chargées depuis le localStorage (persistance)

---

### 2. **Réception d'une Nouvelle Commande** (`order:created`)

**Scénario** : Un client crée une commande via l'app mobile

**Flux** :
```
1. Client crée commande → Backend émet 'order:created' via Socket.IO
2. adminSocketService reçoit l'événement
3. adminSocketService.emit('order:created', data) → Émet localement
4. useNotifications() hook écoute → addNotification() appelé
5. Notification ajoutée au store → Badge mis à jour automatiquement
```

**Filtres appliqués** :
- ✅ **Notification créée** si : `order.is_phone_order === false` ou `undefined`
- ❌ **Notification ignorée** si : `order.is_phone_order === true` (commande téléphonique)

**Résultat visuel et sonore** :
- 🔊 **Son** : `new-order.wav` joué automatiquement
- Badge rouge avec "1" apparaît sur l'icône de cloche
- Notification apparaît dans la liste avec :
  - Icône Package (violet)
  - Titre : "Nouvelle commande"
  - Message : "Une nouvelle commande a été créée (CHL-12345)"
  - Timestamp : "À l'instant"
  - Point bleu indiquant "non lu"

---

### 3. **Mise à Jour de Statut de Commande** (`order:status:update`)

**Scénario** : Une commande change de statut (livrée, annulée, refusée)

**Flux** :
```
1. Statut commande change → Backend émet 'order:status:update'
2. adminSocketService reçoit l'événement
3. useNotifications() vérifie si le statut est important
4. Si important → Notification créée
```

**Statuts qui génèrent une notification** :
- ✅ `completed` → "Commande livrée"
- ✅ `cancelled` / `canceled` → "Commande annulée"
- ✅ `declined` → "Commande refusée"
- ❌ Autres statuts (`pending`, `accepted`, `enroute`, etc.) → **Aucune notification**

**Résultat visuel et sonore** :
- 🔊 **Son** : `new-order.wav` joué automatiquement (même son que nouvelle commande)
- Badge mis à jour
- Notification avec le nouveau statut
- Lien vers la page de la commande

---

### 4. **Réception d'un Nouveau Message** (`new-message`)

**Scénario** : Un client ou livreur envoie un message

**Flux** :
```
1. Message envoyé → Backend émet 'new-message' via Socket.IO
2. adminMessageSocketService reçoit l'événement
3. useNotifications() vérifie si on est sur la page Messages
4. Si PAS sur /message → Notification créée
5. Si SUR /message → Notification ignorée (pour éviter le spam)
```

**Filtres appliqués** :
- ✅ **Notification créée** si : Admin n'est PAS sur `/message`
- ❌ **Notification ignorée** si : Admin est déjà sur `/message`

**Types de messages** :
- `support` → "Nouveau message de support"
- `order` → "Nouveau message concernant une commande"
- Autre → "Vous avez reçu un nouveau message"

**Résultat visuel et sonore** :
- 🔊 **Son** : `new-message.wav` joué automatiquement
- Badge mis à jour
- Notification avec icône User (bleu)
- Lien vers la conversation

---

## 🎨 Interface Utilisateur

### **Badge de Notification**

**Comportement** :
- **Visible** uniquement si `unreadCount > 0`
- **Affiche** : Le nombre de notifications non lues
- **Limite** : "99+" si plus de 99 notifications
- **Position** : En haut à droite de l'icône de cloche
- **Couleur** : Rouge (#EF4444) avec bordure blanche

**Exemples** :
- 1 notification → Badge "1"
- 15 notifications → Badge "15"
- 150 notifications → Badge "99+"

---

### **Dropdown des Notifications**

**Ouverture** :
- Clic sur l'icône de cloche
- Fermeture automatique si clic en dehors

**Contenu** :

#### **Header du Dropdown**
- Titre : "Notifications (X)" si des notifications non lues
- Bouton "Tout marquer comme lu" (visible uniquement si `unreadCount > 0`)
- Bouton fermer (X)

#### **Liste des Notifications**

**État vide** :
```
┌─────────────────────────┐
│   🔔 (icône grise)      │
│                         │
│  Aucune notification    │
│                         │
│  Vous serez notifié des │
│  nouvelles activités    │
└─────────────────────────┘
```

**Avec notifications** :
- **Tri** : Plus récentes en premier
- **Limite** : Maximum 50 notifications affichées
- **Scroll** : Si plus de notifications, scroll vertical

**Chaque notification affiche** :
1. **Icône** (32x32px) :
   - `order` → Package (violet #8B5CF6)
   - `message` → User (bleu #3B82F6)
   - `dispute` → X (rouge #EF4444)
   - `system` → Bell (gris #6B7280)

2. **Titre** (gras si non lu, normal si lu)

3. **Message** (description)

4. **Timestamp** (format relatif) :
   - "À l'instant" (< 1 min)
   - "Il y a 5 min" (< 1h)
   - "Il y a 2h" (< 24h)
   - "Il y a 3j" (< 7j)
   - "24 jan" (date absolue si > 7j)

5. **Indicateur "non lu"** :
   - Point bleu (8px) à droite du titre
   - Fond légèrement gris (#F9FAFB) pour les non lues
   - Fond blanc pour les lues

**Interaction** :
- **Clic sur une notification** :
  1. Marque comme lue automatiquement
  2. Navigue vers la page concernée (`notification.link`)
  3. Ferme le dropdown

---

## 💾 Persistance

**Stockage** :
- Utilise `localStorage` via Zustand `persist`
- Clé : `admin-notifications-storage`

**Ce qui est sauvegardé** :
- ✅ Notifications **non lues** uniquement
- ✅ Maximum **20 dernières** notifications non lues
- ✅ Les notifications lues **ne sont pas persistées**

**Comportement au rechargement** :
- Les notifications non lues sont restaurées
- Le `unreadCount` est recalculé automatiquement
- Les notifications lues sont perdues (comportement normal)

---

## 🔢 Gestion du Compteur

**Calcul automatique** :
```typescript
unreadCount = notifications.filter(n => !n.read).length
```

**Mise à jour** :
- ✅ Automatique à chaque `addNotification()`
- ✅ Automatique à chaque `markAsRead()`
- ✅ Automatique à chaque `markAllAsRead()`
- ✅ Automatique à chaque `removeNotification()`
- ✅ Recalculé au rechargement (onRehydrateStorage)

**Synchronisation avec Messages** :
- Si tous les messages sont lus (`messageUnreadCount === 0`)
- → Toutes les notifications de type `message` sont marquées comme lues automatiquement

---

## 🎯 Exemples de Comportement

### **Exemple 1 : Nouvelle Commande Client**

```
1. Client crée commande CHL-12345
2. Backend émet 'order:created'
3. Notification créée :
   - Type: order
   - Titre: "Nouvelle commande"
   - Message: "Une nouvelle commande a été créée (CHL-12345)"
   - Link: /orders?orderId=abc123
4. Badge affiche "1"
5. Admin clique sur notification
6. → Navigue vers /orders?orderId=abc123
7. → Notification marquée comme lue
8. → Badge disparaît
```

### **Exemple 2 : Commande Livrée**

```
1. Livreur marque commande comme "completed"
2. Backend émet 'order:status:update'
3. Notification créée :
   - Type: order
   - Titre: "Commande livrée"
   - Message: "La commande CHL-12345 a été commande livrée"
   - Link: /orders?orderId=abc123
4. Badge mis à jour
```

### **Exemple 3 : Nouveau Message (Admin sur page Messages)**

```
1. Client envoie message
2. Backend émet 'new-message'
3. useNotifications() vérifie : currentPath.includes('/message')
4. → Admin est sur /message
5. → Notification IGNORÉE (pas de spam)
6. Badge non mis à jour
```

### **Exemple 4 : Nouveau Message (Admin ailleurs)**

```
1. Client envoie message
2. Backend émet 'new-message'
3. useNotifications() vérifie : currentPath.includes('/message')
4. → Admin est sur /dashboard
5. → Notification CRÉÉE
6. Badge mis à jour avec "1"
```

### **Exemple 5 : Commande Téléphonique Créée par Admin**

```
1. Admin crée commande téléphonique
2. Backend émet 'order:created' avec is_phone_order: true
3. useNotifications() vérifie : order.is_phone_order
4. → is_phone_order === true
5. → Notification IGNORÉE
6. Badge non mis à jour
```

---

## ⚙️ Configuration et Limites

**Limites** :
- **Maximum 50 notifications** en mémoire
- **Maximum 20 notifications non lues** persistées
- **Badge maximum** : "99+" (au-delà de 99)

**Performance** :
- Notifications triées par date (plus récentes en premier)
- Anciennes notifications supprimées automatiquement
- Persistance optimisée (seulement non lues)

---

## 🐛 Cas Limites Gérés

1. **Socket déconnecté** :
   - Les notifications ne sont pas créées
   - Le système continue de fonctionner normalement
   - Les notifications existantes restent affichées

2. **Données manquantes** :
   - Si `order.id` manquant → Notification ignorée
   - Si `order` manquant → Notification ignorée

3. **Rechargement de page** :
   - Notifications non lues restaurées
   - Compteur recalculé automatiquement
   - Écoute Socket.IO réinitialisée

4. **Navigation** :
   - Clic sur notification → Navigation + marquage comme lu
   - Fermeture dropdown → Notifications conservées

---

## 📊 Résumé du Comportement

| Événement | Condition | Notification Créée ? | Badge Mis à Jour ? |
|-----------|-----------|---------------------|-------------------|
| `order:created` | `is_phone_order === false` | ✅ Oui | ✅ Oui |
| `order:created` | `is_phone_order === true` | ❌ Non | ❌ Non |
| `order:status:update` | Statut = `completed` | ✅ Oui | ✅ Oui |
| `order:status:update` | Statut = `cancelled` | ✅ Oui | ✅ Oui |
| `order:status:update` | Statut = `pending` | ❌ Non | ❌ Non |
| `new-message` | Admin sur `/message` | ❌ Non | ❌ Non |
| `new-message` | Admin ailleurs | ✅ Oui | ✅ Oui |

---

## 🎬 Animation et Transitions

**Badge** :
- Apparition/disparition avec transition (0.2s)
- Taille adaptative selon le nombre

**Notifications** :
- Fond change au hover (#F3F4F6)
- Transition de couleur (0.2s)
- Scroll fluide si beaucoup de notifications

**Dropdown** :
- Ouverture/fermeture instantanée
- Position sticky pour le header
- Scroll indépendant du contenu

---

## ✅ Points Clés

1. **Temps réel** : Notifications créées instantanément via Socket.IO
2. **Intelligent** : Filtre les commandes téléphoniques et les messages si déjà sur la page
3. **Persistant** : Sauvegarde les notifications non lues
4. **Performant** : Limite à 50 notifications, supprime les anciennes
5. **User-friendly** : Interface claire, navigation intuitive, timestamps relatifs

