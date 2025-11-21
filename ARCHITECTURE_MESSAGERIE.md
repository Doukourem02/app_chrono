# Architecture du Système de Messagerie - Chrono Delivery

## Vue d'ensemble

Le système de messagerie permet la communication en temps réel entre :
- **Client ↔ Livreur** : Pendant qu'une commande est en cours ✅ **IMPLÉMENTÉ**
- **Admin ↔ Client** : Support client et suivi ⏳ **À IMPLÉMENTER**
- **Admin ↔ Livreur** : Gestion et coordination ⏳ **À IMPLÉMENTER**

### État d'implémentation

- ✅ **Backend** : API et Socket.IO complètement implémentés
- ✅ **App Client** : Messagerie fonctionnelle avec le livreur
- ✅ **App Livreur** : Messagerie fonctionnelle avec le client
- ⏳ **App Admin** : Interface existante mais utilise des données mockées

---

## Structure de la base de données

### Tables existantes

- ✅ `conversations` : Table créée et fonctionnelle
- ✅ `messages` : Table créée et fonctionnelle

### Types de conversations

1. **Conversation Client-Livreur (`type: 'order'`)** ✅
   - Créée automatiquement lors de l'acceptation d'une commande
   - Accessible depuis la page de tracking (client) et détails de commande (livreur)

2. **Conversation Admin-Client (`type: 'support'`)** ⏳
   - À créer manuellement par l'admin
   - Accessible depuis l'interface admin

3. **Conversation Admin-Livreur (`type: 'admin'`)** ⏳
   - À créer manuellement par l'admin
   - Accessible depuis l'interface admin

---

## Implémentation Admin - À FAIRE

### Fichiers à créer

#### 1. Service API (`admin_chrono/services/adminMessageService.ts`)

```typescript
import { adminApiService } from '@/lib/adminApiService'

export interface Conversation {
  id: string
  type: 'order' | 'support' | 'admin'
  order_id?: string
  participant_1_id: string
  participant_2_id: string
  participant_1?: { id: string; name: string; avatar?: string }
  participant_2?: { id: string; name: string; avatar?: string }
  last_message_at?: string
  created_at: string
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  sender?: { id: string; name: string; avatar?: string }
  content: string
  message_type: 'text' | 'image' | 'system'
  is_read: boolean
  read_at?: string
  created_at: string
}

class AdminMessageService {
  /**
   * Récupère toutes les conversations (admin peut tout voir)
   */
  async getConversations(type?: 'order' | 'support' | 'admin'): Promise<Conversation[]>

  /**
   * Récupère une conversation par ID
   */
  async getConversationById(conversationId: string): Promise<Conversation | null>

  /**
   * Crée une nouvelle conversation de support ou admin
   */
  async createConversation(
    userId: string,
    type: 'support' | 'admin'
  ): Promise<Conversation>

  /**
   * Récupère les messages d'une conversation
   */
  async getMessages(
    conversationId: string,
    page?: number,
    limit?: number
  ): Promise<Message[]>

  /**
   * Envoie un message
   */
  async sendMessage(
    conversationId: string,
    content: string
  ): Promise<Message>

  /**
   * Marque les messages comme lus
   */
  async markAsRead(conversationId: string): Promise<void>

  /**
   * Récupère le nombre de messages non lus
   */
  async getUnreadCount(): Promise<number>
}

export const adminMessageService = new AdminMessageService()
```

#### 2. Service Socket.IO (`admin_chrono/services/adminMessageSocketService.ts`)

```typescript
import { io, Socket } from 'socket.io-client'
import { Message, Conversation } from './adminMessageService'

class AdminMessageSocketService {
  private socket: Socket | null = null
  private adminId: string | null = null
  private isConnected = false

  connect(adminId: string): void
  disconnect(): void
  joinConversation(conversationId: string): void
  leaveConversation(conversationId: string): void
  sendMessage(conversationId: string, content: string): void
  markAsRead(conversationId: string): void
  onNewMessage(callback: (message: Message, conversation: Conversation) => void): () => void
  onTyping(callback: (data: { userId: string; isTyping: boolean }) => void): () => void
}

export const adminMessageSocketService = new AdminMessageSocketService()
```

#### 3. Store Zustand (`admin_chrono/stores/useAdminMessageStore.ts`)

```typescript
import { create } from 'zustand'

interface AdminMessageStore {
  conversations: Conversation[]
  currentConversation: Conversation | null
  messages: Record<string, Message[]>
  unreadCount: number
  loading: boolean
  error: string | null

  setConversations: (conversations: Conversation[]) => void
  setCurrentConversation: (conversation: Conversation | null) => void
  addMessage: (conversationId: string, message: Message) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  markAsRead: (conversationId: string) => void
  setUnreadCount: (count: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const useAdminMessageStore = create<AdminMessageStore>((set) => ({
  // Implementation
}))
```

#### 4. Composant ConversationList (`admin_chrono/components/ConversationList.tsx`)

```typescript
interface ConversationListProps {
  conversations: Conversation[]
  selectedConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  filterType?: 'all' | 'order' | 'support' | 'admin'
  onFilterChange?: (type: 'all' | 'order' | 'support' | 'admin') => void
}
```

**Fonctionnalités :**
- Liste des conversations avec tri par dernière activité
- Badge de messages non lus
- Recherche par nom de participant
- Filtre par type (toutes, commandes, support, admin)
- Indicateur visuel pour la conversation sélectionnée

#### 5. Composant ChatArea (`admin_chrono/components/ChatArea.tsx`)

```typescript
interface ChatAreaProps {
  conversation: Conversation | null
  messages: Message[]
  onSendMessage: (content: string) => void
  isLoading?: boolean
}
```

**Fonctionnalités :**
- Affichage des messages avec distinction envoyé/reçu
- Scroll automatique vers le dernier message
- Input pour envoyer un message
- Indicateur de "typing"
- Horodatage des messages
- Indicateur de lecture

#### 6. Modifier la page (`admin_chrono/app/(dashboard)/message/page.tsx`)

**Modifications à apporter :**

1. Remplacer les données mockées par les vraies données
2. Intégrer `useAdminMessageStore`
3. Utiliser `adminMessageService` pour charger les conversations
4. Utiliser `adminMessageSocketService` pour le temps réel
5. Intégrer les composants `ConversationList` et `ChatArea`
6. Gérer la création de nouvelles conversations

---

## Flux d'implémentation

### Étape 1 : Service API

1. Créer `adminMessageService.ts`
2. Implémenter toutes les méthodes en utilisant `adminApiService`
3. Gérer les erreurs et les types

### Étape 2 : Service Socket.IO

1. Créer `adminMessageSocketService.ts`
2. Implémenter la connexion avec identification admin
3. Gérer les événements Socket.IO

### Étape 3 : Store Zustand

1. Créer `useAdminMessageStore.ts`
2. Définir l'état et les actions
3. Intégrer avec les services

### Étape 4 : Composants

1. Créer `ConversationList.tsx`
2. Créer `ChatArea.tsx`
3. Tester l'affichage et les interactions

### Étape 5 : Intégration

1. Modifier `message/page.tsx`
2. Remplacer les données mockées
3. Connecter tous les composants
4. Tester le flux complet

### Étape 6 : Création de conversations

1. Ajouter un bouton "Nouvelle conversation" dans la sidebar
2. Créer un modal pour sélectionner le type et le participant
3. Implémenter la création via `adminMessageService.createConversation`

---

## Endpoints API Backend (déjà disponibles)

```
GET    /api/messages/conversations
GET    /api/messages/conversations/:conversationId
POST   /api/messages/conversations
GET    /api/messages/conversations/:conversationId/messages
POST   /api/messages/conversations/:conversationId/messages
PUT    /api/messages/messages/:messageId/read
GET    /api/messages/unread-count
```

---

## Événements Socket.IO (déjà disponibles)

**Émis par le client :**
- `send-message` → `{ conversationId, content, messageType }`
- `join-conversation` → `{ conversationId }`
- `leave-conversation` → `{ conversationId }`
- `mark-messages-read` → `{ conversationId }`

**Émis par le serveur :**
- `new-message` → `{ message, conversation }`
- `message-sent` → `{ messageId, conversationId, success }`
- `conversation-updated` → `{ conversation }`
- `typing` → `{ conversationId, userId, isTyping }`

---

## Checklist d'implémentation

- [ ] Créer `adminMessageService.ts`
- [ ] Créer `adminMessageSocketService.ts`
- [ ] Créer `useAdminMessageStore.ts`
- [ ] Créer `ConversationList.tsx`
- [ ] Créer `ChatArea.tsx`
- [ ] Modifier `message/page.tsx` pour utiliser les vrais services
- [ ] Implémenter la création de conversations de support
- [ ] Implémenter la création de conversations admin-livreur
- [ ] Tester l'envoi/réception de messages en temps réel
- [ ] Tester les indicateurs de lecture
- [ ] Tester les badges de messages non lus
- [ ] Tester la recherche et le filtrage

---

## Notes importantes

### Permissions Admin

- L'admin peut voir **toutes** les conversations (order, support, admin)
- L'admin peut créer des conversations de type `support` ou `admin`
- L'admin peut envoyer des messages dans toutes les conversations

### Identification Socket.IO

- L'admin doit s'identifier avec `admin-connect` (à vérifier dans le backend)
- Utiliser l'ID de l'admin depuis la session Supabase

### Gestion des participants

- Pour les conversations `order`, récupérer les infos du client et du livreur
- Pour les conversations `support`, récupérer les infos du client
- Pour les conversations `admin`, récupérer les infos du livreur

---

**Document mis à jour le :** $(date)
**Version :** 2.0
**État :** Client et Livreur implémentés, Admin à implémenter
