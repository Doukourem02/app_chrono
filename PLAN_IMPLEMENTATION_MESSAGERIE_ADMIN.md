# Plan d'implémentation - Messagerie Admin

## 📊 État actuel

### ✅ Ce qui existe déjà

**Backend (chrono_backend)** :
- ✅ Routes API `/api/messages/*` complètes
- ✅ Controller `messageController.ts` avec toutes les méthodes
- ✅ Service `messageService.ts` avec gestion des permissions admin
- ✅ Socket.IO handler `messageSocket.ts` 
- ✅ Support des conversations `order`, `support`, `admin`
- ✅ L'admin peut voir toutes les conversations (vérification de rôle)

**App Client (app_chrono)** :
- ✅ `userMessageService.ts` - Service API complet
- ✅ `userMessageSocketService.ts` - Service Socket.IO
- ✅ `useMessageStore.ts` - Store Zustand
- ✅ `MessageBottomSheet.tsx` - Composant UI
- ✅ Intégré dans `order-tracking/[orderId].tsx`
- ⚠️ **Limitation** : Seulement pour conversations de type "order" (client-livreur)

**App Livreur (driver_chrono)** :
- ✅ `driverMessageService.ts` - Service API complet
- ✅ `driverMessageSocketService.ts` - Service Socket.IO
- ✅ `useDriverMessageStore.ts` - Store Zustand
- ✅ `MessageBottomSheet.tsx` - Composant UI
- ⚠️ **Limitation** : Seulement pour conversations de type "order" (client-livreur)

**App Admin (admin_chrono)** :
- ✅ Page `/message` avec UI basique
- ❌ **Manque** : Service API
- ❌ **Manque** : Service Socket.IO
- ❌ **Manque** : Store Zustand
- ❌ **Manque** : Composants réutilisables
- ❌ **Manque** : Utilise des données mockées

---

## 🎯 Objectif

Permettre à l'admin de :
1. **Voir toutes les conversations** (order, support, admin)
2. **Créer des conversations de support** avec les clients
3. **Créer des conversations admin** avec les livreurs
4. **Envoyer et recevoir des messages** en temps réel
5. **Surveiller les conversations** client-livreur et intervenir si nécessaire

---

## 📋 Plan d'implémentation

### Phase 1 : Backend - Vérification (Aucun changement nécessaire)

**Statut** : ✅ Déjà fait

Le backend supporte déjà tout ce dont on a besoin :
- Les endpoints acceptent les admins
- `getUserConversations` retourne toutes les conversations pour un admin
- `canAccessConversation` permet à l'admin d'accéder à toutes les conversations
- Socket.IO supporte l'identification admin

**Action** : Aucune, juste vérifier que `admin-connect` est géré dans le socket handler

---

### Phase 2 : Admin - Service API

**Fichier à créer** : `admin_chrono/services/adminMessageService.ts`

**Fonctionnalités** :
1. Utiliser `adminApiService` (déjà existant) pour les appels API
2. Méthodes similaires à `userMessageService.ts` mais adaptées pour admin :
   - `getConversations(type?)` - Récupère toutes les conversations (admin voit tout)
   - `getConversationById(conversationId)` - Récupère une conversation
   - `createConversation(userId, type)` - Crée une conversation support/admin
   - `getMessages(conversationId, page, limit)` - Récupère les messages
   - `sendMessage(conversationId, content)` - Envoie un message
   - `markAsRead(conversationId)` - Marque comme lu
   - `getUnreadCount()` - Nombre de messages non lus

**Points importants** :
- Utiliser le token Supabase depuis `useAuthStore` (admin)
- Gérer les erreurs et le refresh token
- Types TypeScript identiques à ceux du client/livreur

---

### Phase 3 : Admin - Service Socket.IO

**Fichier à créer** : `admin_chrono/services/adminMessageSocketService.ts`

**Fonctionnalités** :
1. Connexion Socket.IO avec identification admin
2. Émettre `admin-connect` avec l'ID de l'admin
3. Gérer les événements :
   - `new-message` - Nouveau message reçu
   - `typing` - Indicateur de frappe
   - `message-sent` - Confirmation d'envoi
   - `conversation-updated` - Mise à jour de conversation
4. Méthodes :
   - `connect(adminId)` - Se connecter
   - `disconnect()` - Se déconnecter
   - `joinConversation(conversationId)` - Rejoindre une conversation
   - `leaveConversation(conversationId)` - Quitter une conversation
   - `sendMessage(conversationId, content)` - Envoyer un message
   - `markAsRead(conversationId)` - Marquer comme lu
   - `onNewMessage(callback)` - Écouter les nouveaux messages
   - `onTyping(callback)` - Écouter les indicateurs de frappe

**Points importants** :
- Similaire à `userMessageSocketService.ts` mais avec `admin-connect`
- Gérer la reconnexion automatique
- Callbacks pour les événements

---

### Phase 4 : Admin - Store Zustand

**Fichier à créer** : `admin_chrono/stores/useAdminMessageStore.ts`

**État à gérer** :
```typescript
{
  conversations: Conversation[],
  currentConversation: Conversation | null,
  messages: Record<string, Message[]>, // conversationId -> messages
  unreadCount: number,
  loading: boolean,
  error: string | null
}
```

**Actions** :
- `setConversations(conversations)` - Définir les conversations
- `setCurrentConversation(conversation)` - Sélectionner une conversation
- `addMessage(conversationId, message)` - Ajouter un message
- `setMessages(conversationId, messages)` - Définir les messages d'une conversation
- `markAsRead(conversationId)` - Marquer comme lu
- `setUnreadCount(count)` - Définir le nombre de non lus
- `setLoading(loading)` - État de chargement
- `setError(error)` - Gestion des erreurs
- `clear()` - Réinitialiser

**Points importants** :
- Similaire à `useMessageStore.ts` du client
- Gérer les doublons de messages
- Mettre à jour `last_message_at` quand un nouveau message arrive

---

### Phase 5 : Admin - Composants UI

#### 5.1 Composant ConversationList

**Fichier à créer** : `admin_chrono/components/ConversationList.tsx`

**Props** :
```typescript
{
  conversations: Conversation[],
  selectedConversationId: string | null,
  onSelectConversation: (id: string) => void,
  searchQuery: string,
  onSearchChange: (query: string) => void,
  filterType: 'all' | 'order' | 'support' | 'admin',
  onFilterChange: (type: 'all' | 'order' | 'support' | 'admin') => void
}
```

**Fonctionnalités** :
- Barre de recherche pour filtrer par nom
- Filtres par type (Toutes, Commandes, Support, Admin)
- Liste des conversations avec :
  - Nom du participant
  - Icône selon le type (📍 order, 💬 support, 🚚 admin)
  - Dernier message (aperçu)
  - Heure du dernier message
  - Badge de messages non lus
- Tri par `last_message_at` (plus récentes en haut)
- Style hover et sélection

#### 5.2 Composant ChatArea

**Fichier à créer** : `admin_chrono/components/ChatArea.tsx`

**Props** :
```typescript
{
  conversation: Conversation | null,
  messages: Message[],
  onSendMessage: (content: string) => void,
  isLoading?: boolean
}
```

**Fonctionnalités** :
- En-tête avec nom du participant et type de conversation
- Zone de messages scrollable :
  - Messages reçus à gauche (fond gris)
  - Messages envoyés à droite (fond violet)
  - Horodatage de chaque message
  - Indicateur de lecture (✓✓)
- Input pour taper le message
- Bouton "Envoyer"
- Scroll automatique vers le dernier message
- Indicateur "typing..." si le participant écrit
- État de chargement

#### 5.3 Composant CreateConversationModal (Optionnel)

**Fichier à créer** : `admin_chrono/components/CreateConversationModal.tsx`

**Fonctionnalités** :
- Modal pour créer une nouvelle conversation
- Sélection du type (Support client / Message livreur)
- Liste des clients/livreurs avec recherche
- Bouton "Créer" qui appelle `adminMessageService.createConversation`

---

### Phase 6 : Admin - Intégration dans la page

**Fichier à modifier** : `admin_chrono/app/(dashboard)/message/page.tsx`

**Modifications** :
1. Importer les services et le store
2. Remplacer les données mockées par les vraies données
3. Utiliser `useAdminMessageStore` pour l'état
4. Charger les conversations au montage
5. Connecter Socket.IO au montage
6. Intégrer `ConversationList` et `ChatArea`
7. Gérer la sélection de conversation
8. Gérer l'envoi de messages
9. Gérer les nouveaux messages en temps réel
10. Afficher le badge de messages non lus
11. Gérer la création de nouvelles conversations

**Flux** :
```
Montage → Charger conversations → Connecter Socket → 
Sélection conversation → Charger messages → 
Envoyer message → Mettre à jour en temps réel
```

---

### Phase 7 : Client/Livreur - Support des conversations support/admin (Optionnel)

**Objectif** : Permettre aux clients/livreurs de voir les conversations de support/admin

**App Client (app_chrono)** :
- Modifier `userMessageService.getConversations()` pour inclure `type: 'support'`
- Créer une page/section "Support" pour afficher les conversations de support
- Permettre au client de créer une conversation de support

**App Livreur (driver_chrono)** :
- Modifier `driverMessageService.getConversations()` pour inclure `type: 'admin'`
- Créer une page/section "Messages" pour afficher les conversations admin
- Le livreur peut recevoir des messages de l'admin

**Note** : Cette phase est optionnelle pour le MVP. L'admin peut déjà créer des conversations et les clients/livreurs les verront via l'API.

---

## 🔄 Ordre d'implémentation recommandé

1. **Phase 2** : Service API Admin (base de tout)
2. **Phase 3** : Service Socket.IO Admin (temps réel)
3. **Phase 4** : Store Zustand Admin (état)
4. **Phase 5.1** : Composant ConversationList (UI liste)
5. **Phase 5.2** : Composant ChatArea (UI chat)
6. **Phase 6** : Intégration dans la page (tout connecter)
7. **Phase 5.3** : Modal création conversation (bonus)
8. **Phase 7** : Support client/livreur (optionnel)

---

## 🧪 Tests à effectuer

1. **Chargement des conversations** : L'admin voit toutes les conversations
2. **Filtrage** : Les filtres par type fonctionnent
3. **Recherche** : La recherche par nom fonctionne
4. **Sélection** : Sélectionner une conversation charge les messages
5. **Envoi de message** : L'admin peut envoyer un message
6. **Réception en temps réel** : Les nouveaux messages apparaissent instantanément
7. **Création de conversation** : L'admin peut créer une conversation support/admin
8. **Badge de notification** : Le nombre de messages non lus s'affiche correctement
9. **Marquage comme lu** : Les messages sont marqués comme lus automatiquement
10. **Permissions** : L'admin peut accéder à toutes les conversations

---

## 📝 Notes importantes

### Authentification
- L'admin utilise Supabase Auth (comme le client/livreur)
- Le token est récupéré depuis `useAuthStore` (admin)
- Le backend vérifie le rôle `admin` pour les permissions

### Socket.IO
- L'admin doit s'identifier avec `admin-connect` (à vérifier dans le backend)
- Le backend doit gérer les rooms pour les admins
- Les événements sont les mêmes que pour client/livreur

### Types de conversations
- **order** : Client ↔ Livreur (créée automatiquement)
- **support** : Admin ↔ Client (créée par l'admin)
- **admin** : Admin ↔ Livreur (créée par l'admin)

### Performance
- Pagination des messages (50 par page)
- Lazy loading des conversations
- Cache dans le store Zustand
- Déconnexion Socket.IO quand on quitte la page

---

## ✅ Checklist finale

- [ ] Service API Admin créé et testé
- [ ] Service Socket.IO Admin créé et testé
- [ ] Store Zustand Admin créé et testé
- [ ] Composant ConversationList créé
- [ ] Composant ChatArea créé
- [ ] Page message intégrée avec les vrais services
- [ ] Création de conversations fonctionnelle
- [ ] Messages en temps réel fonctionnels
- [ ] Badge de notifications fonctionnel
- [ ] Tests de bout en bout réussis

---

**Prêt à commencer l'implémentation ?** 🚀

