# 📋 Proposition : Système de Gestion des Livreurs Partenaires dans le Dashboard Admin

## 🎯 Objectif

Permettre aux admins de gérer efficacement les livreurs partenaires et leurs soldes commission depuis le dashboard, tout en distinguant clairement les partenaires des livreurs internes.

---

## 📊 Analyse de l'Existant

### Pages Actuelles du Dashboard
- **`/users`** : Liste tous les utilisateurs (clients, drivers, admins) avec filtres par rôle
- **`/reports`** : Rapports généraux incluant les drivers (livraisons, revenus, ratings)
- **`/tracking`** : Suivi en temps réel des livreurs en ligne
- **`/dashboard`** : Vue d'ensemble avec statistiques

### Ce qui manque actuellement
- ❌ Distinction visuelle entre livreurs **partenaires** et **internes**
- ❌ Gestion dédiée des soldes commission
- ❌ Historique des transactions commission (recharges, prélèvements)
- ❌ Interface de recharge manuelle par admin
- ❌ Alertes sur les soldes faibles/suspendus

---

## 🏗️ Architecture Proposée

### 1. **Nouvelle Page : `/drivers` (ou améliorer `/users` avec onglets)**

#### Option A : Page dédiée `/drivers` (Recommandée)
```
/drivers
├── Vue liste avec filtres
│   ├── Filtre : Tous | Partenaires | Internes
│   ├── Colonnes : Nom, Type, Statut, Solde Commission, Actions
│   └── Badge visuel : 🟢 Partenaire | 🔵 Interne
├── Vue détail d'un livreur
│   ├── Informations générales
│   ├── Statistiques (livraisons, revenus, rating)
│   ├── Section Commission (si partenaire)
│   │   ├── Solde actuel
│   │   ├── Taux commission
│   │   ├── Statut (Actif/Suspendu)
│   │   └── Historique transactions
│   └── Actions : Recharger, Suspendre/Réactiver, Changer type
```

#### Option B : Améliorer `/users` avec onglets
```
/users
├── Onglet "Tous"
├── Onglet "Clients"
├── Onglet "Livreurs"
│   ├── Sous-filtres : Tous | Partenaires | Internes
│   └── Colonnes enrichies avec type et solde
└── Onglet "Admins"
```

**💡 Recommandation : Option A** (Page dédiée `/drivers` pour une meilleure UX)

---

### 2. **Section Commission dans le Dashboard**

#### 2.1. Vue Liste des Livreurs Partenaires

**Colonnes du tableau :**
| Colonne | Description | Exemple |
|---------|-------------|---------|
| **Nom** | Prénom + Nom | Jean Dupont |
| **Type** | Badge visuel | 🟢 Partenaire / 🔵 Interne |
| **Email** | Email du livreur | jean@example.com |
| **Téléphone** | Numéro de téléphone | +225 07 12 34 56 78 |
| **Solde Commission** | Solde actuel avec couleur | 15 000 FCFA (vert) / 500 FCFA (orange) / 0 FCFA (rouge) |
| **Statut** | Actif / Suspendu | 🟢 Actif / 🔴 Suspendu |
| **Livraisons** | Total / Complétées | 45 / 42 |
| **Rating** | Note moyenne | 4.8 ⭐ |
| **Actions** | Menu d'actions | ⋮ |

**Filtres :**
- 🔍 Recherche (nom, email, téléphone)
- 📊 Type : Tous | Partenaires | Internes
- 💰 Statut solde : Tous | Actif (>0) | Suspendu (=0) | Faible (<3000)
- 📍 Statut livreur : Tous | En ligne | Hors ligne

**Tri :**
- Par solde (croissant/décroissant)
- Par nombre de livraisons
- Par rating
- Par date d'inscription

---

#### 2.2. Vue Détail d'un Livreur Partenaire

**Onglets :**
1. **📊 Vue d'ensemble**
   - Informations personnelles
   - Statistiques (livraisons, revenus, rating)
   - Statut en ligne/hors ligne

2. **💳 Commission** (Uniquement pour partenaires)
   - **Carte Solde**
     - Solde actuel : `15 000 FCFA`
     - Taux commission : `10%`
     - Statut : `🟢 Actif` / `🔴 Suspendu`
     - Dernière mise à jour : `Il y a 2 heures`
   
   - **Actions rapides**
     - 🔵 **Recharger** : Modal avec montant + méthode (Admin manuel / Mobile Money)
     - 🟡 **Suspendre/Réactiver** : Toggle pour suspendre le compte
     - 🟢 **Changer taux** : Modifier le taux de commission (10% ou 20%)
   
   - **Historique des transactions**
     - Tableau avec colonnes :
       - Date/Heure
       - Type (Recharge / Prélèvement / Remboursement)
       - Montant
       - Solde avant → Solde après
       - Commande associée (si prélèvement)
       - Méthode de paiement
       - Statut
     - Filtres : Par type, par période, par montant
     - Export CSV/Excel

3. **📦 Livraisons**
   - Liste des livraisons du livreur
   - Filtres par statut, date
   - Lien vers détails de chaque commande

4. **⭐ Évaluations**
   - Historique des notes reçues
   - Graphique évolution du rating

---

### 3. **Fonctionnalités de Gestion Commission**

#### 3.1. Recharge Manuelle par Admin

**Modal de recharge :**
```
┌─────────────────────────────────────┐
│  Recharger le compte commission     │
├─────────────────────────────────────┤
│  Livreur : Jean Dupont              │
│  Solde actuel : 5 000 FCFA          │
│                                     │
│  Montant : [_______] FCFA          │
│  (Minimum : 10 000 FCFA)           │
│                                     │
│  Méthode :                          │
│  ○ Admin manuel (recharge directe) │
│  ○ Mobile Money (Orange/Wave)      │
│                                     │
│  Notes (optionnel) :                │
│  [________________________]        │
│                                     │
│  [Annuler]  [Recharger]             │
└─────────────────────────────────────┘
```

**Validation :**
- Montant minimum : 10 000 FCFA
- Confirmation avant validation
- Notification au livreur (push/email) après recharge

---

#### 3.2. Prélèvement Automatique vs Manuel

**💡 Recommandation : AUTOMATIQUE (déjà implémenté)**

**Avantages de l'automatique :**
- ✅ Pas d'intervention admin nécessaire
- ✅ Prélèvement immédiat après livraison
- ✅ Transparence totale (historique visible)
- ✅ Réduction des erreurs humaines
- ✅ Scalabilité (fonctionne avec 10 ou 1000 livreurs)

**Fonctionnement actuel (backend) :**
1. Livreur complète une livraison
2. Système calcule commission (10-20% du prix)
3. Prélèvement automatique du solde
4. Transaction enregistrée dans `commission_transactions`
5. Si solde = 0 → Suspension automatique

**Option manuelle (si nécessaire) :**
- Admin peut désactiver le prélèvement automatique pour un livreur spécifique
- Admin doit alors prélever manuellement via l'interface
- ⚠️ Risque d'oubli et de désynchronisation

**Recommandation finale : Garder l'automatique, mais permettre à l'admin de :**
- Voir tous les prélèvements en temps réel
- Annuler un prélèvement (remboursement) en cas d'erreur
- Suspendre temporairement les prélèvements pour un livreur (maintenance)

---

#### 3.3. Alertes et Notifications

**Alertes visuelles dans le dashboard :**
- 🔴 **Rouge** : Solde = 0 (Suspendu)
- 🟠 **Orange** : Solde < 1 000 FCFA (Très faible)
- 🟡 **Jaune** : Solde < 3 000 FCFA (Faible)
- 🟢 **Vert** : Solde > 3 000 FCFA (Normal)

**Notifications admin :**
- Badge sur l'icône "Livreurs" : Nombre de partenaires suspendus
- Liste des alertes dans le header : "3 livreurs partenaires avec solde faible"
- Email/SMS (optionnel) : Si un livreur partenaire est suspendu

---

### 4. **Widget Dashboard Principal**

**Carte "Livreurs Partenaires" dans `/dashboard` :**
```
┌─────────────────────────────────────┐
│  📊 Livreurs Partenaires            │
├─────────────────────────────────────┤
│  Total partenaires : 45             │
│  Actifs (solde > 0) : 42            │
│  Suspendus (solde = 0) : 3          │
│                                     │
│  Solde total : 1 250 000 FCFA       │
│  Prélèvements ce mois : 85 000 FCFA │
│                                     │
│  [Voir tous les partenaires →]      │
└─────────────────────────────────────┘
```

---

### 5. **API Backend Nécessaire**

**Routes à créer/améliorer :**

```typescript
// Récupérer tous les livreurs avec distinction partenaire/interne
GET /api/admin/drivers
  Query params: type? (all|partner|internal), status?, search?

// Récupérer détails d'un livreur (avec commission si partenaire)
GET /api/admin/drivers/:driverId

// Recharger manuellement un compte commission
POST /api/admin/drivers/:driverId/commission/recharge
  Body: { amount, method: 'admin_manual', notes? }

// Suspendre/Réactiver un compte commission
PUT /api/admin/drivers/:driverId/commission/suspend
  Body: { is_suspended: boolean, reason? }

// Modifier le taux de commission
PUT /api/admin/drivers/:driverId/commission/rate
  Body: { commission_rate: 10 | 20 }

// Rembourser un prélèvement (annulation)
POST /api/admin/drivers/:driverId/commission/refund
  Body: { transaction_id, reason }

// Historique des transactions commission
GET /api/admin/drivers/:driverId/commission/transactions
  Query params: limit?, offset?, type?, startDate?, endDate?

// Statistiques commission globales
GET /api/admin/commission/stats
  Returns: { total_partners, active_count, suspended_count, total_balance, monthly_deductions }
```

---

## 🎨 Design et UX

### Badges Visuels

**Type de livreur :**
- 🟢 **Partenaire** : Badge vert avec icône "user"
- 🔵 **Interne** : Badge bleu avec icône "briefcase"

**Statut solde :**
- 🟢 **Actif** : Solde > 0, couleur verte
- 🟡 **Faible** : Solde < 3 000 FCFA, couleur orange
- 🔴 **Suspendu** : Solde = 0, couleur rouge, badge "Suspendu"

### Couleurs Recommandées

```css
/* Partenaires */
--partner-primary: #10B981; /* Vert */
--partner-bg: #D1FAE5;

/* Internes */
--internal-primary: #3B82F6; /* Bleu */
--internal-bg: #DBEAFE;

/* Alertes */
--alert-suspended: #EF4444; /* Rouge */
--alert-very-low: #F59E0B; /* Orange */
--alert-low: #FBBF24; /* Jaune */
--alert-normal: #10B981; /* Vert */
```

---

## 📋 Checklist d'Implémentation

### Phase 1 : Distinction Partenaire/Interne
- [ ] Ajouter colonne `driver_type` dans les requêtes API
- [ ] Afficher badge visuel dans la liste des utilisateurs
- [ ] Ajouter filtre "Type de livreur" dans `/users`
- [ ] Mettre à jour les types TypeScript

### Phase 2 : Page Dédiée `/drivers`
- [ ] Créer page `/drivers` avec liste des livreurs
- [ ] Implémenter filtres (type, statut solde, recherche)
- [ ] Ajouter vue détail d'un livreur
- [ ] Intégrer section commission pour partenaires

### Phase 3 : Gestion Commission
- [ ] Créer routes API backend pour commission admin
- [ ] Implémenter modal de recharge manuelle
- [ ] Afficher historique des transactions
- [ ] Ajouter actions (suspendre, changer taux, rembourser)

### Phase 4 : Alertes et Widgets
- [ ] Ajouter widget "Livreurs Partenaires" dans `/dashboard`
- [ ] Implémenter alertes visuelles (couleurs, badges)
- [ ] Ajouter notifications admin (badges, liste alertes)

### Phase 5 : Tests et Optimisation
- [ ] Tests unitaires des nouvelles routes API
- [ ] Tests d'intégration frontend
- [ ] Optimisation des requêtes (pagination, cache)
- [ ] Documentation utilisateur admin

---

## 🚀 Priorités

### 🔥 Priorité 1 (Urgent)
1. Distinction visuelle partenaire/interne dans `/users`
2. Affichage du solde commission pour les partenaires
3. Vue détail avec historique des transactions

### ⚡ Priorité 2 (Important)
4. Recharge manuelle par admin
5. Alertes visuelles (couleurs, badges)
6. Widget dashboard "Livreurs Partenaires"

### 📈 Priorité 3 (Nice to have)
7. Export CSV/Excel des transactions
8. Graphiques d'évolution du solde
9. Notifications email/SMS pour alertes

---

## 💡 Recommandations Finales

### ✅ Prélèvement : AUTOMATIQUE
- **Garder le système automatique actuel** (déjà implémenté backend)
- Permettre à l'admin de voir et gérer les prélèvements
- Option de remboursement en cas d'erreur

### ✅ Gestion : HYBRIDE
- **Automatique** : Prélèvements après livraison
- **Manuel** : Recharges par admin (pour cas spéciaux, promotions, etc.)
- **Supervision** : Admin peut voir, suspendre, modifier

### ✅ Interface : CENTRALISÉE
- Page dédiée `/drivers` pour une meilleure UX
- Toutes les fonctionnalités commission au même endroit
- Vue d'ensemble + détails accessibles rapidement

---

## 📝 Notes Techniques

### Performance
- Pagination des listes (50-100 livreurs par page)
- Cache des soldes commission (rafraîchissement toutes les 5 min)
- Lazy loading de l'historique des transactions

### Sécurité
- Vérification des permissions admin avant chaque action
- Logs de toutes les actions admin sur les commissions
- Validation des montants (min/max) côté backend

### Scalabilité
- Indexation des colonnes `driver_type` et `is_suspended`
- Requêtes optimisées avec JOINs
- Webhooks pour notifications en temps réel (optionnel)

---

**Date de proposition :** 2025-01-XX  
**Auteur :** Assistant IA  
**Statut :** 📋 Proposition (en attente validation)

