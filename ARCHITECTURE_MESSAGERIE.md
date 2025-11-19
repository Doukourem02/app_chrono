# 📨 Architecture du Système de Messagerie - Chrono Delivery

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Structure de la base de données](#structure-de-la-base-de-données)
3. [Types de conversations](#types-de-conversations)
4. [Architecture technique](#architecture-technique)
5. [Flux de communication](#flux-de-communication)
6. [Implémentation par application](#implémentation-par-application)
7. [Sécurité et permissions](#sécurité-et-permissions)
8. [Plan d'implémentation](#plan-dimplémentation)

---

## 🎯 Vue d'ensemble

Le système de messagerie permet la communication en temps réel entre :
- **Client ↔ Livreur** : Pendant qu'une commande est en cours
- **Admin ↔ Client** : Support client et suivi
- **Admin ↔ Livreur** : Gestion et coordination

### Principes de base

1. **Conversations liées aux commandes** : Chaque conversation client-livreur est automatiquement créée lors de l'assignation d'une commande
2. **Conversations libres** : Les conversations admin peuvent être créées indépendamment
3. **Temps réel** : Utilisation de Socket.IO pour la réception instantanée des messages
4. **Persistance** : Tous les messages sont stockés en base de données pour l'historique

---

## 🗄️ Structure de la base de données

### Table `conversations` (déjà existante)

D'après l'image Supabase, la table `conversations` a la structure suivante :

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR NOT NULL, -- 'order' | 'support' | 'admin'
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE, -- NULL pour conversations admin
  participant_1_id UUID NOT NULL REFERENCES users(id), -- Premier participant
  participant_2_id UUID NOT NULL REFERENCES users(id), -- Deuxième participant
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ, -- Dernier message pour tri
  is_archived BOOLEAN DEFAULT FALSE
);

-- Index pour améliorer les performances
CREATE INDEX idx_conversations_order_id ON conversations(order_id);
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
```

### Table `messages` (à créer)

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  message_type VARCHAR DEFAULT 'text', -- 'text' | 'image' | 'system'
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read) WHERE is_read = FALSE;
```

### Règles de création des conversations

#### 1. Conversation Client-Livreur (type: 'order')
- **Création automatique** : Lorsqu'une commande est acceptée par un livreur (`status: 'accepted'`)
- **Participant 1** : `user_id` de la commande (client)
- **Participant 2** : `driver_id` de la commande (livreur)
- **order_id** : ID de la commande
- **Durée de vie** : La conversation reste accessible même après la livraison pour l'historique

#### 2. Conversation Admin-Client (type: 'support')
- **Création manuelle** : Par l'admin depuis l'interface de messagerie
- **Participant 1** : ID de l'admin
- **Participant 2** : ID du client
- **order_id** : NULL (ou optionnellement lié à une commande si nécessaire)

#### 3. Conversation Admin-Livreur (type: 'admin')
- **Création manuelle** : Par l'admin depuis l'interface de messagerie
- **Participant 1** : ID de l'admin
- **Participant 2** : ID du livreur
- **order_id** : NULL (ou optionnellement lié à une commande si nécessaire)

---

## 🔄 Types de conversations

### 1. Conversation liée à une commande (`type: 'order'`)

**Quand elle est créée :**
- Automatiquement quand un livreur accepte une commande
- Backend : Dans le handler `driver-accept-order` du socket

**Participants :**
- Client (propriétaire de la commande)
- Livreur (qui a accepté la commande)

**Accès :**
- **Client** : Depuis la page de tracking de commande (`/order-tracking/[orderId]`)
- **Livreur** : Depuis la page de détails de commande (à créer dans `driver_chrono`)
- **Admin** : Peut voir toutes les conversations dans l'interface admin

**Fonctionnalités :**
- Envoi de messages texte
- Notification en temps réel
- Indicateur de lecture
- Historique complet même après livraison

### 2. Conversation de support (`type: 'support'`)

**Quand elle est créée :**
- Par l'admin depuis l'interface de messagerie
- Le client peut aussi initier une conversation via un bouton "Contacter le support"

**Participants :**
- Admin
- Client

**Accès :**
- **Admin** : Interface de messagerie (`/message`)
- **Client** : Section "Support" dans l'app (à créer)

### 3. Conversation admin-livreur (`type: 'admin'`)

**Quand elle est créée :**
- Par l'admin depuis l'interface de messagerie

**Participants :**
- Admin
- Livreur

**Accès :**
- **Admin** : Interface de messagerie (`/message`)
- **Livreur** : Section "Messages" dans l'app (à créer)

---

## 🏗️ Architecture technique

### Backend (chrono_backend)

#### 1. Routes API (`/api/messages`)

```typescript
// GET /api/messages/conversations
// Récupère toutes les conversations de l'utilisateur connecté
// Query params: ?type=order|support|admin&order_id=xxx

// GET /api/messages/conversations/:conversationId
// Récupère les détails d'une conversation

// POST /api/messages/conversations
// Crée une nouvelle conversation (admin uniquement pour support/admin)

// GET /api/messages/conversations/:conversationId/messages
// Récupère les messages d'une conversation (pagination)
// Query params: ?page=1&limit=50

// POST /api/messages/conversations/:conversationId/messages
// Envoie un nouveau message

// PUT /api/messages/messages/:messageId/read
// Marque un message comme lu

// GET /api/messages/unread-count
// Récupère le nombre de messages non lus
```

#### 2. Socket.IO Events

```typescript
// Événements émis par le client
'send-message' → { conversationId, content, messageType }
'join-conversation' → { conversationId }
'leave-conversation' → { conversationId }
'mark-messages-read' → { conversationId }

// Événements émis par le serveur
'new-message' → { message, conversation }
'message-sent' → { messageId, conversationId, success }
'conversation-updated' → { conversation }
'typing' → { conversationId, userId, isTyping }
```

#### 3. Service de messagerie (`src/services/messageService.ts`)

```typescript
class MessageService {
  // Créer une conversation liée à une commande
  async createOrderConversation(orderId: string): Promise<Conversation>
  
  // Créer une conversation de support/admin
  async createSupportConversation(adminId: string, userId: string, type: 'support' | 'admin'): Promise<Conversation>
  
  // Envoyer un message
  async sendMessage(conversationId: string, senderId: string, content: string): Promise<Message>
  
  // Récupérer les messages d'une conversation
  async getMessages(conversationId: string, page: number, limit: number): Promise<Message[]>
  
  // Marquer les messages comme lus
  async markAsRead(conversationId: string, userId: string): Promise<void>
  
  // Récupérer les conversations d'un utilisateur
  async getUserConversations(userId: string, type?: string): Promise<Conversation[]>
}
```

#### 4. Socket Handler (`src/sockets/messageSocket.ts`)

```typescript
// Gérer les événements Socket.IO pour la messagerie
socket.on('send-message', async (data) => {
  // 1. Valider les permissions
  // 2. Créer le message en base
  // 3. Émettre 'new-message' aux participants de la conversation
  // 4. Envoyer une notification push si l'utilisateur est déconnecté
});

socket.on('join-conversation', (conversationId) => {
  // Rejoindre la room Socket.IO pour cette conversation
  socket.join(`conversation:${conversationId}`);
});

socket.on('mark-messages-read', async (data) => {
  // Marquer les messages comme lus
  // Émettre une mise à jour aux autres participants
});
```

---

## 📱 Implémentation par application

### 1. App Client (app_chrono)

#### A. Page de tracking de commande (`app/order-tracking/[orderId].tsx`)

**Modifications à apporter :**

1. **Bouton "Message" dans TrackingBottomSheet**
   - Actuellement : Icône non fonctionnelle (ligne 156, 262)
   - Action : Ouvrir un modal/bottom sheet de messagerie

2. **Nouveau composant : `MessageBottomSheet.tsx`**
   ```typescript
   interface MessageBottomSheetProps {
     orderId: string;
     conversationId?: string; // Si la conversation existe déjà
     onClose: () => void;
   }
   ```
   - Affiche les messages de la conversation
   - Input pour envoyer un message
   - Connexion Socket.IO pour recevoir les messages en temps réel
   - Indicateur de "typing" du livreur

3. **Service : `userMessageService.ts`**
   ```typescript
   class UserMessageService {
     // Récupérer ou créer la conversation pour une commande
     async getOrCreateOrderConversation(orderId: string): Promise<Conversation>
     
     // Récupérer les messages
     async getMessages(conversationId: string): Promise<Message[]>
     
     // Envoyer un message
     async sendMessage(conversationId: string, content: string): Promise<Message>
   }
   ```

4. **Socket Service : `userMessageSocketService.ts`**
   ```typescript
   class UserMessageSocketService {
     connect(userId: string): void
     joinConversation(conversationId: string): void
     sendMessage(conversationId: string, content: string): void
     onNewMessage(callback: (message: Message) => void): void
     onTyping(callback: (data: { userId: string, isTyping: boolean }) => void): void
   }
   ```

#### B. Store Zustand : `useMessageStore.ts`

```typescript
interface MessageStore {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  unreadCount: number;
  
  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  markAsRead: (conversationId: string) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
}
```

---

### 2. App Livreur (driver_chrono)

#### A. Page de détails de commande (à créer : `app/order-details/[orderId].tsx`)

**Fonctionnalités :**
- Afficher les détails de la commande
- Bouton "Message" pour communiquer avec le client
- Carte avec le trajet
- Actions (appeler, message, etc.)

#### B. Composant : `DriverMessageBottomSheet.tsx`

Similaire à `MessageBottomSheet` du client, mais adapté pour le livreur.

#### C. Service : `driverMessageService.ts`

Similaire à `userMessageService`, mais avec les endpoints driver.

#### D. Socket Service : `driverMessageSocketService.ts`

Similaire à `userMessageSocketService`, mais pour le driver.

#### E. Store : `useDriverMessageStore.ts`

Similaire à `useMessageStore`, mais pour le driver.

---

### 3. App Admin (admin_chrono)

#### A. Page de messagerie (`app/(dashboard)/message/page.tsx`)

**Modifications à apporter :**

1. **Remplacer les données mockées** (lignes 123-127)
   - Récupérer les conversations depuis l'API
   - Filtrer par type (client, livreur, toutes)

2. **Composant : `ConversationList.tsx`**
   - Liste des conversations avec recherche
   - Badge de messages non lus
   - Tri par dernière activité

3. **Composant : `ChatArea.tsx`**
   - Zone d'affichage des messages
   - Input pour envoyer un message
   - Indicateur de "typing"
   - Scroll automatique vers le bas

4. **Service : `adminMessageService.ts`**
   ```typescript
   class AdminMessageService {
     // Récupérer toutes les conversations
     async getConversations(type?: string): Promise<Conversation[]>
     
     // Créer une nouvelle conversation de support
     async createSupportConversation(userId: string, type: 'support' | 'admin'): Promise<Conversation>
     
     // Récupérer les messages
     async getMessages(conversationId: string): Promise<Message[]>
     
     // Envoyer un message
     async sendMessage(conversationId: string, content: string): Promise<Message>
   }
   ```

5. **Socket Service : `adminMessageSocketService.ts`**

6. **Store : `useAdminMessageStore.ts`**

---

## 🔐 Sécurité et permissions

### Règles d'accès

1. **Conversation Client-Livreur**
   - ✅ Client peut voir uniquement ses conversations
   - ✅ Livreur peut voir uniquement ses conversations
   - ✅ Admin peut voir toutes les conversations

2. **Conversation Support**
   - ✅ Admin peut créer et voir toutes les conversations
   - ✅ Client peut voir uniquement ses conversations

3. **Conversation Admin-Livreur**
   - ✅ Admin peut créer et voir toutes les conversations
   - ✅ Livreur peut voir uniquement ses conversations

### Validation backend

```typescript
// Middleware pour vérifier l'accès à une conversation
async function canAccessConversation(userId: string, conversationId: string, userRole: string): Promise<boolean> {
  const conversation = await getConversation(conversationId);
  
  if (!conversation) return false;
  
  // Admin peut tout voir
  if (userRole === 'admin') return true;
  
  // Vérifier si l'utilisateur est participant
  if (conversation.participant_1_id === userId || conversation.participant_2_id === userId) {
    return true;
  }
  
  return false;
}
```

### Row Level Security (RLS) Supabase

```sql
-- Politique pour les conversations
CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (
  participant_1_id = auth.uid() OR 
  participant_2_id = auth.uid() OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Politique pour les messages
CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.participant_1_id = auth.uid() OR 
         conversations.participant_2_id = auth.uid() OR
         EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  )
);
```

---

## 🚀 Plan d'implémentation

### Phase 1 : Base de données et Backend API

1. ✅ Créer la table `messages` (migration SQL)
2. ✅ Créer les routes API `/api/messages/*`
3. ✅ Créer le service `messageService.ts`
4. ✅ Créer le handler Socket.IO `messageSocket.ts`
5. ✅ Intégrer la création automatique de conversation lors de l'acceptation d'une commande

### Phase 2 : App Client

1. ✅ Créer `userMessageService.ts`
2. ✅ Créer `userMessageSocketService.ts`
3. ✅ Créer `useMessageStore.ts`
4. ✅ Créer `MessageBottomSheet.tsx`
5. ✅ Intégrer le bouton "Message" dans `TrackingBottomSheet.tsx`
6. ✅ Tester l'envoi/réception de messages

### Phase 3 : App Livreur

1. ✅ Créer la page `order-details/[orderId].tsx`
2. ✅ Créer `driverMessageService.ts`
3. ✅ Créer `driverMessageSocketService.ts`
4. ✅ Créer `useDriverMessageStore.ts`
5. ✅ Créer `DriverMessageBottomSheet.tsx`
6. ✅ Intégrer le bouton "Message" dans la page de détails

### Phase 4 : App Admin

1. ✅ Créer `adminMessageService.ts`
2. ✅ Créer `adminMessageSocketService.ts`
3. ✅ Créer `useAdminMessageStore.ts`
4. ✅ Remplacer les données mockées dans `message/page.tsx`
5. ✅ Créer `ConversationList.tsx`
6. ✅ Créer `ChatArea.tsx`
7. ✅ Implémenter la création de conversations de support

### Phase 5 : Améliorations

1. ✅ Notifications push pour les messages non lus
2. ✅ Indicateur de "typing"
3. ✅ Envoi d'images (optionnel)
4. ✅ Recherche dans les messages
5. ✅ Archivage des conversations
6. ✅ Badge de messages non lus dans la navigation

---

## 📝 Notes importantes

### Gestion des conversations liées aux commandes

- **Création automatique** : La conversation est créée quand le livreur accepte la commande
- **Unicité** : Une seule conversation par commande (vérifier avant création)
- **Persistance** : La conversation reste accessible même après la livraison

### Performance

- **Pagination** : Charger les messages par lots de 50
- **Lazy loading** : Charger les messages uniquement quand la conversation est ouverte
- **Cache** : Utiliser le store Zustand pour mettre en cache les conversations et messages

### Notifications

- **Temps réel** : Socket.IO pour les utilisateurs connectés
- **Push notifications** : Pour les utilisateurs déconnectés (à implémenter avec Expo Notifications)

### UX

- **Indicateur de lecture** : Afficher "✓" pour envoyé, "✓✓" pour lu
- **Horodatage** : Afficher "Il y a X minutes" ou la date
- **Scroll automatique** : Aller au dernier message lors de l'ouverture
- **Sons** : Optionnel, son de notification pour nouveaux messages

---

## 🔗 Fichiers à créer/modifier

### Backend
- `chrono_backend/migrations/024_create_messages_table.sql`
- `chrono_backend/src/routes/messageRoutes.ts`
- `chrono_backend/src/controllers/messageController.ts`
- `chrono_backend/src/services/messageService.ts`
- `chrono_backend/src/sockets/messageSocket.ts`

### App Client
- `app_chrono/services/userMessageService.ts`
- `app_chrono/services/userMessageSocketService.ts`
- `app_chrono/store/useMessageStore.ts`
- `app_chrono/components/MessageBottomSheet.tsx`
- Modifier : `app_chrono/components/TrackingBottomSheet.tsx`

### App Livreur
- `driver_chrono/app/order-details/[orderId].tsx` (nouveau)
- `driver_chrono/services/driverMessageService.ts`
- `driver_chrono/services/driverMessageSocketService.ts`
- `driver_chrono/store/useDriverMessageStore.ts`
- `driver_chrono/components/DriverMessageBottomSheet.tsx`

### App Admin
- `admin_chrono/services/adminMessageService.ts`
- `admin_chrono/services/adminMessageSocketService.ts`
- `admin_chrono/stores/useAdminMessageStore.ts`
- `admin_chrono/components/ConversationList.tsx`
- `admin_chrono/components/ChatArea.tsx`
- Modifier : `admin_chrono/app/(dashboard)/message/page.tsx`

---

## ✅ Checklist de validation

- [ ] Les conversations sont créées automatiquement lors de l'acceptation d'une commande
- [ ] Les clients peuvent envoyer des messages aux livreurs depuis la page de tracking
- [ ] Les livreurs peuvent envoyer des messages aux clients depuis la page de détails
- [ ] Les admins peuvent voir toutes les conversations
- [ ] Les admins peuvent créer des conversations de support
- [ ] Les messages sont reçus en temps réel via Socket.IO
- [ ] Les messages sont persistés en base de données
- [ ] Les indicateurs de lecture fonctionnent
- [ ] Les permissions sont correctement appliquées
- [ ] Les notifications push sont envoyées pour les messages non lus

---

**Document créé le :** $(date)
**Version :** 1.0
**Auteur :** Assistant IA

