# Architecture du Système de Messagerie - Chrono Delivery

## Vue d'ensemble

Le système de messagerie permet la communication en temps réel entre :
- **Client ↔ Livreur** : Pendant qu'une commande est en cours ✅ **IMPLÉMENTÉ**
- **Admin ↔ Client** : Support client et suivi ⏳ **À IMPLÉMENTER**
- **Admin ↔ Livreur** : Gestion et coordination ⏳ **À IMPLÉMENTER**

### Rôle de la messagerie Admin

La messagerie admin sert principalement à :
1. **Support client** : Répondre aux questions, gérer les réclamations, aider les clients
2. **Communication avec les livreurs** : Coordonner les livraisons, donner des instructions, gérer les problèmes

**Bonus** : L'admin peut également **surveiller** toutes les conversations client-livreur pour intervenir si nécessaire (ex: problème de livraison, conflit, etc.)

### Flux de support : Comment ça fonctionne ?

**Scénario 1 : Le client/livreur a un problème et contacte l'admin**

1. **Client ou livreur** rencontre un problème (livraison, paiement, etc.)
2. **Option A** : L'admin crée une conversation de support avec eux depuis le dashboard
3. **Option B** : (À implémenter) Le client/livreur peut cliquer sur "Contacter le support" dans son app
4. **L'admin voit le message** dans sa messagerie (badge de notification)
5. **L'admin prend la main** : Répond, aide à résoudre le problème, coordonne si nécessaire
6. **Problème résolu** : La conversation peut être archivée

**Scénario 2 : L'admin surveille et intervient**

1. **Client et livreur** communiquent entre eux (conversation de commande)
2. **L'admin voit** cette conversation dans sa liste (type "order")
3. Si un problème survient, **l'admin peut intervenir** directement dans la conversation
4. L'admin aide à résoudre le problème en temps réel

**Résumé du flux :**
```
Problème → Message à l'admin → Admin voit → Admin prend la main → Résolution
```

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

## Guide d'utilisation de la messagerie Admin

### Accès à la messagerie

1. **Navigation** : Dans la sidebar du dashboard admin, cliquer sur "Message" (icône MessageSquare)
2. **URL** : `/message`
3. **Interface** : La page affiche une sidebar avec la liste des conversations et une zone de chat principale

### À quoi sert la messagerie Admin ?

La messagerie admin a **deux fonctions principales** :

1. **Support client** 💬
   - Répondre aux questions des clients
   - Gérer les réclamations
   - Aider à résoudre les problèmes
   - Créer des conversations de type "support"

2. **Communication avec les livreurs** 🚚
   - Coordonner les livraisons
   - Donner des instructions spéciales
   - Gérer les problèmes avec les livreurs
   - Créer des conversations de type "admin"

**Fonction bonus** : L'admin peut aussi **voir toutes les conversations** entre clients et livreurs (type "order") pour surveiller et intervenir si nécessaire.

### Flux pratique : Comment un problème remonte à l'admin ?

**Exemple concret :**

1. **Le client a un problème** (ex: "Ma commande n'arrive pas")
   - Le client peut contacter l'admin via une conversation de support
   - OU l'admin voit qu'il y a un problème dans la conversation client-livreur

2. **L'admin reçoit une notification** 
   - Badge rouge avec le nombre de messages non lus
   - La conversation apparaît en haut de la liste

3. **L'admin ouvre la conversation**
   - Voit le message du client/livreur
   - Comprend le problème

4. **L'admin prend la main**
   - Répond au client : "Bonjour, je vais vérifier votre commande"
   - Contacte le livreur si nécessaire : "Pouvez-vous me donner des nouvelles de la commande #123 ?"
   - Coordonne la résolution du problème

5. **Problème résolu**
   - L'admin confirme : "Votre commande est en route, elle arrivera dans 10 minutes"
   - La conversation peut être archivée une fois le problème résolu

**En résumé :** C'est un système de **support centralisé** où l'admin est le point de contact pour résoudre tous les problèmes.

### Structure de l'interface

```
┌─────────────────────────────────────────────────────────┐
│  Messages                                    [🔔 Badge] │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  [Recherche] │  Zone de chat principale                │
│              │  - En-tête avec nom du participant      │
│  Conversations│  - Historique des messages             │
│  ┌──────────┐│  - Input pour envoyer un message        │
│  │ Client 1 ││                                          │
│  │ 📍 Order ││                                          │
│  └──────────┘│                                          │
│  ┌──────────┐│                                          │
│  │ Driver 1 ││                                          │
│  │ 🚚 Admin ││                                          │
│  └──────────┘│                                          │
│  ┌──────────┐│                                          │
│  │ Client 2 ││                                          │
│  │ 💬 Support│                                          │
│  └──────────┘│                                          │
│              │                                          │
│  [+ Nouvelle]│                                          │
│  conversation│                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Types de conversations et leurs usages

#### 1. Conversations liées aux commandes (`type: 'order'`)

**Quand elles apparaissent :**
- Automatiquement créées quand un livreur accepte une commande
- L'admin peut voir toutes les conversations client-livreur

**Cas d'usage :**
- **Surveillance** : L'admin peut surveiller les échanges entre client et livreur
- **Intervention** : Si un problème survient, l'admin peut intervenir dans la conversation
- **Support** : Aider à résoudre un problème de livraison en temps réel

**Exemple de workflow :**
```
1. Un client envoie un message au livreur : "Où êtes-vous ?"
2. Le livreur répond : "J'arrive dans 5 minutes"
3. L'admin voit cette conversation dans sa liste
4. Si nécessaire, l'admin peut intervenir : "Bonjour, je vois qu'il y a un retard. Tout va bien ?"
```

**Affichage dans la liste :**
- Icône : 📍 (MapPin) ou icône de commande
- Nom : "Client - [Nom du client]" ou "Commande #[ID]"
- Badge : Affiche le statut de la commande si disponible

#### 2. Conversations de support (`type: 'support'`)

**Quand les créer :**
- Un client contacte le support
- Un problème nécessite un suivi personnalisé
- Un client a une réclamation

**Cas d'usage :**
- **Réclamation** : Un client n'est pas satisfait d'une livraison
- **Question** : Un client a une question sur le service
- **Problème technique** : Aide à l'utilisation de l'application

**Exemple de workflow :**
```
1. Admin crée une conversation de support avec un client
2. Admin envoie : "Bonjour, nous avons reçu votre réclamation. Comment pouvons-nous vous aider ?"
3. Client répond avec les détails du problème
4. Admin propose une solution ou un remboursement
5. Conversation archivée une fois le problème résolu
```

**Comment créer :**
1. Cliquer sur le bouton "+ Nouvelle conversation" dans la sidebar
2. Sélectionner "Support client"
3. Choisir le client dans la liste
4. La conversation s'ouvre automatiquement

**Affichage dans la liste :**
- Icône : 💬 (MessageSquare) ou 👤 (User)
- Nom : "Client - [Nom du client]"
- Badge : "Support" ou "Réclamation"

#### 3. Conversations admin-livreur (`type: 'admin'`)

**Quand les créer :**
- Coordonner avec un livreur
- Donner des instructions spéciales
- Gérer un problème avec un livreur
- Faire un suivi de performance

**Cas d'usage :**
- **Instructions** : "Bonjour, pour la commande #123, merci de faire attention au colis fragile"
- **Coordination** : "Pouvez-vous prendre en charge cette livraison urgente ?"
- **Feedback** : "Merci pour votre excellent service aujourd'hui"
- **Problème** : "Nous avons reçu une plainte concernant votre comportement"

**Exemple de workflow :**
```
1. Admin crée une conversation avec un livreur
2. Admin envoie : "Bonjour, nous avons une livraison urgente. Êtes-vous disponible ?"
3. Livreur répond : "Oui, je peux la prendre"
4. Admin envoie les détails de la commande
5. Livreur confirme et part récupérer le colis
```

**Comment créer :**
1. Cliquer sur le bouton "+ Nouvelle conversation" dans la sidebar
2. Sélectionner "Message livreur"
3. Choisir le livreur dans la liste
4. La conversation s'ouvre automatiquement

**Affichage dans la liste :**
- Icône : 🚚 (Truck) ou icône de livreur
- Nom : "Livreur - [Nom du livreur]"
- Badge : "Admin" ou "Coordination"

### Workflows pratiques

#### Workflow 1 : Répondre à un message d'une conversation existante

1. **Ouvrir la messagerie** : Cliquer sur "Message" dans la sidebar
2. **Sélectionner la conversation** : Cliquer sur une conversation dans la liste (sidebar gauche)
3. **Lire les messages** : L'historique s'affiche dans la zone centrale
4. **Répondre** : 
   - Taper le message dans le champ en bas
   - Cliquer sur "Envoyer" ou appuyer sur Entrée
5. **Confirmation** : Le message apparaît immédiatement dans la conversation

#### Workflow 2 : Créer une conversation de support

1. **Accéder à la messagerie** : Cliquer sur "Message"
2. **Nouvelle conversation** : Cliquer sur "+ Nouvelle conversation"
3. **Sélectionner le type** : Choisir "Support client"
4. **Choisir le client** :
   - Rechercher par nom dans la liste
   - Ou sélectionner depuis la page "Users" (lien direct)
5. **Démarrer la conversation** : La conversation s'ouvre, taper le premier message
6. **Envoyer** : Le client recevra une notification

#### Workflow 3 : Surveiller une conversation client-livreur

1. **Accéder à la messagerie** : Cliquer sur "Message"
2. **Filtrer** : Utiliser le filtre "Commandes" pour voir uniquement les conversations liées aux commandes
3. **Sélectionner** : Cliquer sur une conversation pour voir les échanges
4. **Intervenir si nécessaire** : Si un problème survient, envoyer un message pour aider
5. **Marquer comme lu** : Les messages sont automatiquement marqués comme lus quand on ouvre la conversation

#### Workflow 4 : Gérer plusieurs conversations

1. **Badge de notification** : Le badge 🔔 en haut à droite affiche le nombre de messages non lus
2. **Tri automatique** : Les conversations sont triées par dernière activité (plus récentes en haut)
3. **Recherche** : Utiliser la barre de recherche pour trouver rapidement une conversation
4. **Filtres** : Utiliser les filtres pour voir uniquement :
   - Toutes les conversations
   - Conversations de commandes
   - Conversations de support
   - Conversations admin-livreur

### Fonctionnalités de l'interface

#### Sidebar (liste des conversations)

- **Recherche** : Barre de recherche en haut pour filtrer par nom
- **Filtres** : Boutons pour filtrer par type (Toutes, Commandes, Support, Admin)
- **Liste** : 
  - Nom du participant
  - Dernier message (aperçu)
  - Heure du dernier message
  - Badge de messages non lus (si > 0)
  - Icône selon le type
- **Nouvelle conversation** : Bouton "+" pour créer une nouvelle conversation

#### Zone de chat principale

- **En-tête** : 
  - Nom du participant
  - Type de conversation
  - Statut (en ligne/hors ligne si disponible)
- **Messages** :
  - Messages reçus à gauche (fond gris)
  - Messages envoyés à droite (fond violet)
  - Horodatage de chaque message
  - Indicateur de lecture (✓✓ pour lu)
- **Input** :
  - Zone de texte pour taper le message
  - Bouton "Envoyer"
  - Indicateur "typing..." si le participant est en train d'écrire

### Indicateurs visuels

- **Badge rouge** : Nombre de messages non lus (en haut à droite)
- **Badge sur conversation** : Nombre de messages non lus dans cette conversation
- **Icônes** :
  - 📍 Conversations de commandes
  - 💬 Conversations de support
  - 🚚 Conversations admin-livreur
- **Couleurs** :
  - Conversation sélectionnée : Fond gris clair
  - Message envoyé : Fond violet (#8B5CF6)
  - Message reçu : Fond gris (#F3F4F6)

### Bonnes pratiques

1. **Réactivité** : Répondre rapidement aux messages de support (objectif : < 5 minutes)
2. **Ton professionnel** : Toujours rester courtois et professionnel
3. **Clarté** : Messages courts et clairs
4. **Suivi** : Vérifier régulièrement les messages non lus
5. **Archivage** : Archiver les conversations résolues pour garder la liste propre
6. **Documentation** : Pour les problèmes complexes, noter la solution dans les notes de la commande

### Intégration avec d'autres pages

- **Depuis "Users"** : Bouton "Message" sur la fiche d'un client/livreur pour créer une conversation
- **Depuis "Orders"** : Lien vers la conversation liée à une commande
- **Depuis "Dashboard"** : Widget "Quick Message" avec les conversations récentes

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
