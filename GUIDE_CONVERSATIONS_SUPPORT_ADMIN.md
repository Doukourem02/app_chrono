# Guide : Conversations Support et Admin

## 📋 Situation Actuelle

### ❌ Ce qui manque actuellement

1. **Les clients/livreurs ne peuvent PAS créer de conversations de support eux-mêmes**
   - Actuellement, seuls les admins peuvent créer des conversations de type "support" ou "admin"
   - Les pages "Support" dans les apps client/livreur redirigent vers email/téléphone/WhatsApp (pas de messagerie intégrée)

2. **Les conversations de type "admin" sont uniquement créées par l'admin**
   - L'admin crée une conversation avec un livreur pour coordonner
   - Le livreur ne peut pas initier cette conversation

---

## ✅ Solution Proposée

### 1. Conversations de Support (`type: 'support'`)

#### **Qui peut créer ?**
- ✅ **Admin** : Peut créer une conversation de support avec un client (déjà implémenté)
- ✅ **Client** : Peut créer une conversation de support avec l'admin (À IMPLÉMENTER)
- ✅ **Livreur** : Peut créer une conversation de support avec l'admin (À IMPLÉMENTER)

#### **Comment ça fonctionne ?**

**Scénario A : Le client/livreur contacte le support**

1. **Client/Livreur** ouvre la page "Support" dans son app
2. **Client/Livreur** clique sur "Contacter le support" (nouveau bouton)
3. **Système** crée automatiquement une conversation de type "support" avec l'admin
4. **Client/Livreur** envoie son premier message : "Bonjour, j'ai un problème avec ma commande #123"
5. **Admin** reçoit une notification dans sa messagerie (badge rouge)
6. **Admin** ouvre la conversation et répond
7. **Client/Livreur** voit la réponse dans son app

**Scénario B : L'admin initie le support**

1. **Admin** voit un problème (ex: réclamation, commande en retard)
2. **Admin** va dans "Messages" → "+ Nouvelle conversation" → "Support client"
3. **Admin** sélectionne le client
4. **Admin** envoie : "Bonjour, nous avons remarqué un problème avec votre commande. Comment pouvons-nous vous aider ?"
5. **Client** reçoit une notification dans son app
6. **Client** ouvre la conversation et répond

#### **Où apparaît la conversation ?**

- **Côté Admin** : Dans la catégorie "Support" de la messagerie
- **Côté Client/Livreur** : Dans leur liste de conversations (nouvelle section "Support")

---

### 2. Conversations Admin-Livreur (`type: 'admin'`)

#### **Qui peut créer ?**
- ✅ **Admin uniquement** : Peut créer une conversation avec un livreur
- ❌ **Livreur** : Ne peut pas créer cette conversation (c'est intentionnel)

#### **Comment ça fonctionne ?**

**Scénario : L'admin coordonne avec un livreur**

1. **Admin** veut donner des instructions à un livreur
2. **Admin** va dans "Messages" → "+ Nouvelle conversation" → "Message livreur"
3. **Admin** sélectionne le livreur
4. **Admin** envoie : "Bonjour, pouvez-vous prendre en charge cette livraison urgente ?"
5. **Livreur** reçoit une notification dans son app
6. **Livreur** ouvre la conversation et répond
7. **Admin** voit la réponse dans sa messagerie

#### **Où apparaît la conversation ?**

- **Côté Admin** : Dans la catégorie "Admin" de la messagerie
- **Côté Livreur** : Dans sa liste de conversations (nouvelle section "Admin")

---

## 🔧 Implémentation Nécessaire

### Backend (Déjà prêt ✅)

Le backend supporte déjà la création de conversations de support par les clients/livreurs. Il faut juste modifier le contrôleur pour permettre aux clients/livreurs de créer des conversations de support.

### Frontend - À Implémenter

#### 1. **App Client** (`app_chrono`)

**Fichier à modifier :** `app_chrono/app/profile/support.tsx`

**Ajouter :**
- Un bouton "Contacter le support" qui crée une conversation de support
- Une section pour afficher les conversations de support existantes
- Intégration avec `userMessageService` pour créer la conversation

**Nouveau flux :**
```typescript
// Quand le client clique sur "Contacter le support"
const handleContactSupport = async () => {
  // 1. Récupérer l'ID de l'admin (premier admin disponible ou admin par défaut)
  // 2. Créer une conversation de type "support"
  const conversation = await userMessageService.createSupportConversation(adminId);
  // 3. Rediriger vers la messagerie avec cette conversation ouverte
  router.push(`/messages/${conversation.id}`);
};
```

#### 2. **App Livreur** (`driver_chrono`)

**Fichier à modifier :** `driver_chrono/app/profile/support.tsx`

**Ajouter :**
- Un bouton "Contacter le support" qui crée une conversation de support
- Une section pour afficher les conversations de support existantes
- Intégration avec `driverMessageService` pour créer la conversation

#### 3. **Backend** (`chrono_backend`)

**Fichier à modifier :** `chrono_backend/src/controllers/messageController.ts`

**Modifier la fonction `createConversation` :**
```typescript
// Actuellement : Seuls les admins peuvent créer des conversations support/admin
// Nouveau : Les clients/livreurs peuvent créer des conversations de support

if (type === 'support') {
  // Si c'est un client ou livreur qui crée, trouver un admin
  if (userRole !== 'admin') {
    // Trouver le premier admin disponible (ou admin par défaut)
    const adminId = await findAvailableAdmin();
    conversation = await messageService.createSupportConversation(
      adminId,  // Admin comme participant_1
      userId,   // Client/Livreur comme participant_2
      'support'
    );
  } else {
    // Admin crée avec un client/livreur
    conversation = await messageService.createSupportConversation(
      userId,      // Admin
      participantId, // Client/Livreur
      'support'
    );
  }
}
```

---

## 📱 Interface Utilisateur

### Côté Client/Livreur

**Page Support** (`/profile/support`)

```
┌─────────────────────────────────┐
│  Aide & Support                 │
├─────────────────────────────────┤
│                                 │
│  [💬 Contacter le support]      │  ← Nouveau bouton
│                                 │
│  Conversations de support       │  ← Nouvelle section
│  ┌───────────────────────────┐  │
│  │ Support - En attente      │  │
│  │ Dernier message: ...      │  │
│  └───────────────────────────┘  │
│                                 │
│  Contactez-nous                 │
│  [Email] [Téléphone] [WhatsApp] │
│                                 │
│  FAQ                            │
│  ...                            │
└─────────────────────────────────┘
```

### Côté Admin

**Page Messages** (`/message`)

```
┌─────────────────────────────────┐
│  Messages            [🔔 3]     │
├──────────┬──────────────────────┤
│ Support  │  [Conversation]      │
│ ┌──────┐ │                      │
│ │Client│ │  Messages...         │
│ │💬    │ │                      │
│ └──────┘ │                      │
│          │  [Input message]     │
└──────────┴──────────────────────┘
```

---

## 🎯 Résumé des Actions

### Pour les Clients/Livreurs

1. **Contacter le support** :
   - Ouvrir "Support" → Cliquer "Contacter le support"
   - Une conversation est créée automatiquement avec l'admin
   - Envoyer le message

2. **Voir les conversations de support** :
   - Dans la page "Support" ou dans une nouvelle section "Messages"
   - Voir l'historique des conversations avec l'admin

### Pour l'Admin

1. **Créer une conversation de support** :
   - Messages → "+ Nouvelle conversation" → "Support client"
   - Sélectionner le client
   - Envoyer le premier message

2. **Créer une conversation admin-livreur** :
   - Messages → "+ Nouvelle conversation" → "Message livreur"
   - Sélectionner le livreur
   - Envoyer le message

3. **Voir toutes les conversations** :
   - Filtrer par type (Toutes, Commandes, Support, Admin)
   - Répondre aux messages entrants

---

## ✅ Checklist d'Implémentation

### Backend
- [ ] Modifier `createConversation` pour permettre aux clients/livreurs de créer des conversations de support
- [ ] Ajouter une fonction `findAvailableAdmin()` pour trouver un admin disponible
- [ ] Tester la création de conversations de support par les clients/livreurs

### Frontend Client
- [ ] Ajouter bouton "Contacter le support" dans `app_chrono/app/profile/support.tsx`
- [ ] Ajouter méthode `createSupportConversation` dans `userMessageService.ts`
- [ ] Créer une page/section pour afficher les conversations de support
- [ ] Intégrer avec la messagerie existante

### Frontend Livreur
- [ ] Ajouter bouton "Contacter le support" dans `driver_chrono/app/profile/support.tsx`
- [ ] Ajouter méthode `createSupportConversation` dans `driverMessageService.ts`
- [ ] Créer une page/section pour afficher les conversations de support
- [ ] Intégrer avec la messagerie existante

### Frontend Admin
- [ ] Ajouter bouton "+ Nouvelle conversation" dans la page Messages
- [ ] Créer un modal pour sélectionner le type (Support/Admin) et le participant
- [ ] Implémenter la création de conversations depuis l'interface admin

---

## 💡 Exemples Concrets

### Exemple 1 : Client a un problème

1. **Client** : "Ma commande #123 n'arrive pas"
   - Client ouvre Support → "Contacter le support"
   - Conversation créée automatiquement
   - Client envoie : "Bonjour, ma commande #123 est en retard"

2. **Admin** : Reçoit notification → Ouvre conversation → Répond
   - "Bonjour, je vais vérifier immédiatement votre commande"

3. **Client** : Voit la réponse → Continue la conversation

### Exemple 2 : Admin coordonne avec livreur

1. **Admin** : "Nous avons une livraison urgente"
   - Admin crée conversation admin-livreur
   - Admin envoie : "Bonjour, pouvez-vous prendre cette livraison urgente ?"

2. **Livreur** : Reçoit notification → Ouvre conversation → Répond
   - "Oui, je suis disponible"

3. **Admin** : Envoie les détails de la commande

---

**Document créé le :** $(date)
**Version :** 1.0

