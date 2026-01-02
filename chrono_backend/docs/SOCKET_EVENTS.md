# Documentation des événements Socket.IO

Cette documentation décrit tous les événements Socket.IO utilisés dans l'application Chrono Livraison.

## 📡 Connexion

### Client → Serveur

#### `user-connect`
Identifie un utilisateur client.

**Payload:**
```typescript
{
  userId: string;
}
```

**Exemple:**
```javascript
socket.emit('user-connect', { userId: 'user-123' });
```

---

#### `driver-connect`
Identifie un chauffeur.

**Payload:**
```typescript
{
  driverId: string;
}
```

**Exemple:**
```javascript
socket.emit('driver-connect', { driverId: 'driver-456' });
```

---

#### `admin-connect`
Identifie un administrateur.

**Payload:**
```typescript
{
  adminId: string;
}
```

**Exemple:**
```javascript
socket.emit('admin-connect', { adminId: 'admin-789' });
```

---

## 📦 Commandes

### Client → Serveur

#### `create-order`
Crée une nouvelle commande de livraison.

**Payload:**
```typescript
{
  userId: string;
  pickup: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  dropoff: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  isUrgent?: boolean;
  price?: number;
  distance?: number;
  estimatedDuration?: string;
  paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred';
  paymentMethodId?: string;
  paymentPayerType?: 'client' | 'recipient';
  isPartialPayment?: boolean;
  partialAmount?: number;
  recipientUserId?: string;
}
```

**Callback (ack):**
```typescript
{
  success: boolean;
  order?: Order;
  message?: string;
  error?: string;
}
```

**Exemple:**
```javascript
socket.emit('create-order', {
  userId: 'user-123',
  pickup: {
    address: '123 Rue Example',
    coordinates: { latitude: 14.7167, longitude: -17.4677 }
  },
  dropoff: {
    address: '456 Avenue Test',
    coordinates: { latitude: 14.7267, longitude: -17.4777 }
  },
  deliveryMethod: 'moto',
  isUrgent: false
}, (response) => {
  if (response.success) {
    console.log('Commande créée:', response.order);
  }
});
```

---

#### `update-delivery-status`
Met à jour le statut d'une livraison.

**Payload:**
```typescript
{
  orderId: string;
  status: 'pending' | 'accepted' | 'enroute' | 'picked_up' | 'completed' | 'cancelled';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}
```

**Callback (ack):**
```typescript
{
  success: boolean;
  order?: Order;
  message?: string;
}
```

**Exemple:**
```javascript
socket.emit('update-delivery-status', {
  orderId: 'order-123',
  status: 'enroute',
  location: {
    latitude: 14.7167,
    longitude: -17.4677,
    address: 'En cours de route'
  }
}, (response) => {
  if (response.success) {
    console.log('Statut mis à jour:', response.order);
  }
});
```

---

#### `send-proof`
Envoie une preuve de livraison (photo/vidéo).

**Payload:**
```typescript
{
  orderId: string;
  proofBase64: string; // Image encodée en base64
  proofType?: 'image' | 'photo' | 'video';
}
```

**Callback (ack):**
```typescript
{
  success: boolean;
  order?: Order;
  dbSaved?: boolean;
  dbError?: string;
}
```

**Exemple:**
```javascript
socket.emit('send-proof', {
  orderId: 'order-123',
  proofBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  proofType: 'image'
}, (response) => {
  if (response.success) {
    console.log('Preuve envoyée:', response.order);
  }
});
```

---

#### `accept-order`
Accepte une commande (chauffeur).

**Payload:**
```typescript
{
  orderId: string;
  driverId: string;
}
```

**Exemple:**
```javascript
socket.emit('accept-order', {
  orderId: 'order-123',
  driverId: 'driver-456'
});
```

---

#### `decline-order`
Décline une commande (chauffeur).

**Payload:**
```typescript
{
  orderId: string;
  driverId: string;
  reason?: string;
}
```

**Exemple:**
```javascript
socket.emit('decline-order', {
  orderId: 'order-123',
  driverId: 'driver-456',
  reason: 'Trop loin'
});
```

---

### Serveur → Client

#### `new_order`
Nouvelle commande disponible (émis aux chauffeurs).

**Payload:**
```typescript
{
  order: Order;
  pickupCoords?: {
    latitude: number;
    longitude: number;
  };
}
```

**Exemple:**
```javascript
socket.on('new_order', (data) => {
  console.log('Nouvelle commande disponible:', data.order);
});
```

---

#### `order:status:update`
Mise à jour du statut d'une commande.

**Payload:**
```typescript
{
  order: Order;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}
```

**Exemple:**
```javascript
socket.on('order:status:update', (data) => {
  console.log('Statut mis à jour:', data.order.status);
});
```

---

#### `order:proof:uploaded`
Preuve de livraison uploadée.

**Payload:**
```typescript
{
  orderId: string;
  uploadedAt: string; // ISO date string
  dbSaved?: boolean;
  dbError?: string;
}
```

**Exemple:**
```javascript
socket.on('order:proof:uploaded', (data) => {
  console.log('Preuve uploadée pour:', data.orderId);
});
```

---

#### `order:cancelled`
Commande annulée.

**Payload:**
```typescript
{
  orderId: string;
  reason?: string;
}
```

**Exemple:**
```javascript
socket.on('order:cancelled', (data) => {
  console.log('Commande annulée:', data.orderId);
});
```

---

## 🗺️ Géolocalisation

### Client → Serveur

#### `driver_position`
Met à jour la position du chauffeur.

**Payload:**
```typescript
{
  driverId: string;
  latitude: number;
  longitude: number;
  orderId?: string;
  timestamp?: string; // ISO date string
}
```

**Exemple:**
```javascript
socket.emit('driver_position', {
  driverId: 'driver-456',
  latitude: 14.7167,
  longitude: -17.4677,
  orderId: 'order-123'
});
```

---

#### `driver-geofence-event`
Événement de géofence (entrée/sortie d'une zone).

**Payload:**
```typescript
{
  orderId: string;
  eventType: 'entered' | 'validated';
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp?: string;
}
```

**Exemple:**
```javascript
socket.emit('driver-geofence-event', {
  orderId: 'order-123',
  eventType: 'entered',
  location: {
    latitude: 14.7167,
    longitude: -17.4677
  }
});
```

---

### Serveur → Client

#### `driver_position`
Position du chauffeur mise à jour (émis aux clients/admin).

**Payload:**
```typescript
{
  driverId: string;
  latitude: number;
  longitude: number;
  orderId?: string;
  timestamp?: string;
}
```

**Exemple:**
```javascript
socket.on('driver_position', (data) => {
  console.log('Position chauffeur:', data);
});
```

---

## 💬 Messagerie

### Client → Serveur

#### `join-conversation`
Rejoint une conversation pour recevoir les messages en temps réel.

**Payload:**
```typescript
{
  conversationId: string;
}
```

**Exemple:**
```javascript
socket.emit('join-conversation', {
  conversationId: 'conv-123'
});
```

---

#### `leave-conversation`
Quitte une conversation.

**Payload:**
```typescript
{
  conversationId: string;
}
```

**Exemple:**
```javascript
socket.emit('leave-conversation', {
  conversationId: 'conv-123'
});
```

---

#### `send-message`
Envoie un message dans une conversation.

**Payload:**
```typescript
{
  conversationId: string;
  content: string;
  messageType?: string; // 'text', 'image', etc.
}
```

**Exemple:**
```javascript
socket.emit('send-message', {
  conversationId: 'conv-123',
  content: 'Bonjour, où en êtes-vous ?',
  messageType: 'text'
});
```

---

### Serveur → Client

#### `new-message`
Nouveau message reçu.

**Payload:**
```typescript
{
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    messageType: string;
    createdAt: string;
  };
  conversation: {
    id: string;
    participants: string[];
    lastMessage: string;
    updatedAt: string;
  };
}
```

**Exemple:**
```javascript
socket.on('new-message', (data) => {
  console.log('Nouveau message:', data.message);
});
```

---

#### `message-sent`
Confirmation d'envoi de message.

**Payload:**
```typescript
{
  messageId: string;
  conversationId: string;
  success: boolean;
}
```

**Exemple:**
```javascript
socket.on('message-sent', (data) => {
  console.log('Message envoyé:', data.messageId);
});
```

---

## 🔄 Reconnexion

### Client → Serveur

#### `user-reconnect`
Reconnexion d'un utilisateur.

**Payload:**
```typescript
{
  userId?: string;
}
```

**Exemple:**
```javascript
socket.emit('user-reconnect', {
  userId: 'user-123'
});
```

---

## ⚠️ Erreurs

### Serveur → Client

#### `error`
Erreur générique.

**Payload:**
```typescript
{
  message: string;
  code?: string;
}
```

**Exemple:**
```javascript
socket.on('error', (error) => {
  console.error('Erreur Socket.IO:', error.message);
});
```

---

## 📝 Notes importantes

1. **Authentification**: Tous les événements nécessitent une authentification préalable via `user-connect`, `driver-connect`, ou `admin-connect`.

2. **Callbacks (ack)**: Certains événements supportent un callback de confirmation. Utilisez-le pour gérer les réponses du serveur.

3. **Gestion des erreurs**: Toujours écouter l'événement `error` pour gérer les erreurs.

4. **Reconnexion**: En cas de déconnexion, réémettre `user-reconnect` avec le `userId` pour restaurer l'état.

5. **Types TypeScript**: Tous les types sont définis dans `src/types/socketEvents.ts`.

---

## 🔗 Ressources

- [Documentation Socket.IO officielle](https://socket.io/docs/v4/)
- [Types TypeScript Socket.IO](https://socket.io/docs/v4/typescript/)
- Fichier de types: `chrono_backend/src/types/socketEvents.ts`

