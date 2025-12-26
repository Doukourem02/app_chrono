# 🚗 Configuration des Profils Livreurs (driver_profiles)

## 📋 État Actuel

La table `driver_profiles` est **vide** et prête à être utilisée. Tous les nouveaux livreurs qui s'inscrivent seront automatiquement créés comme **partenaires** par défaut.

---

## 🔄 Flux d'Inscription d'un Nouveau Livreur Partenaire

### 1. Inscription via l'App Driver (`driver_chrono`)

**Étape 1 : Register** (`app/(auth)/register.tsx`)
- L'utilisateur entre son email et numéro de téléphone
- Redirection vers `otpMethod`

**Étape 2 : OTP Method** (`app/(auth)/otpMethod.tsx`)
- Choix de la méthode de vérification (email ou SMS)
- Envoi du code OTP via `/api/auth-simple/send-otp`

**Étape 3 : Verification** (`app/(auth)/verification.tsx`)
- Vérification du code OTP via `/api/auth-simple/verify-otp`
- **Création automatique du profil** dans `driver_profiles` avec :
  - `driver_type = 'partner'` ✅
  - `vehicle_type = 'moto'` (par défaut)
  - `is_online = false`
  - `is_available = true`
  - `rating = 5.0`

**Étape 4 : Success** (`app/(auth)/success.tsx`)
- Si nouveau partenaire ET profil incomplet → Redirection vers `partner-onboarding`
- Sinon → Redirection vers `/(tabs)` (dashboard)

**Étape 5 : Partner Onboarding** (`app/(auth)/partner-onboarding.tsx`) - **NOUVEAU**
- Acceptation des conditions de commission prépayée
- Complétion du profil :
  - Type de véhicule (moto/vehicule/cargo)
  - Numéro de plaque
  - Marque, modèle, couleur (optionnel)
  - Numéro de permis
- Mise à jour via `/api/drivers/:userId/vehicle`

**Étape 6 : Dashboard** (`app/(tabs)/index.tsx`)
- Le livreur peut maintenant recevoir des commandes

---

## 🔧 Backend : Création Automatique du Profil

### Fonction `createDriverProfile()` dans `authController.ts`

```typescript
const { data: driverProfile, error: insertError } = await clientForInsert
  .from('driver_profiles')
  .insert([
    {
      user_id: userId,
      email: email,
      phone: phone || null,
      first_name: firstName || null,
      last_name: lastName || null,
      vehicle_type: 'moto',
      driver_type: 'partner', // ✅ Par défaut, tous sont partenaires
      is_online: false,
      is_available: true,
      rating: 5.0,
      total_deliveries: 0,
    },
  ])
```

**Appelée automatiquement lors de :**
- Inscription avec OTP (`verifyOTPCode`)
- Inscription classique (`registerUserWithPostgreSQL`)

---

## 📊 Structure de la Table `driver_profiles`

### Colonnes Principales

| Colonne | Type | Défaut | Description |
|---------|------|--------|-------------|
| `id` | UUID | `gen_random_uuid()` | ID unique du profil |
| `user_id` | UUID | - | Référence vers `auth.users(id)` |
| `driver_type` | VARCHAR(20) | `'partner'` | **'internal'** ou **'partner'** |
| `email` | TEXT | - | Email du livreur |
| `phone` | TEXT | - | Téléphone du livreur |
| `first_name` | TEXT | - | Prénom |
| `last_name` | TEXT | - | Nom |
| `vehicle_type` | TEXT | `'moto'` | 'moto', 'vehicule', 'cargo' |
| `vehicle_plate` | TEXT | - | Numéro de plaque |
| `vehicle_brand` | TEXT | - | Marque du véhicule |
| `vehicle_model` | TEXT | - | Modèle du véhicule |
| `vehicle_color` | TEXT | - | Couleur du véhicule |
| `license_number` | TEXT | - | Numéro de permis |
| `is_online` | BOOLEAN | `false` | Statut en ligne |
| `is_available` | BOOLEAN | `true` | Disponibilité |
| `current_latitude` | DECIMAL | - | Position GPS latitude |
| `current_longitude` | DECIMAL | - | Position GPS longitude |
| `rating` | DECIMAL(3,2) | `5.0` | Note moyenne (0-5) |
| `total_deliveries` | INTEGER | `0` | Nombre total de livraisons |
| `created_at` | TIMESTAMPTZ | `NOW()` | Date de création |
| `updated_at` | TIMESTAMPTZ | `NOW()` | Date de mise à jour |

---

## 🎯 Types de Livreurs

### 1. Livreur Partenaire (`driver_type = 'partner'`)

**Caractéristiques :**
- ✅ Créé automatiquement lors de l'inscription via l'app
- ✅ Système de commission prépayée obligatoire
- ✅ Doit recharger un crédit commission (min 10 000 FCFA)
- ✅ Commission prélevée : 10% ou 20% par livraison
- ✅ Suspension automatique si solde = 0

**Affectation :**
- Commandes standards
- Pics de demande
- Zones périphériques

### 2. Livreur Interne (`driver_type = 'internal'`)

**Caractéristiques :**
- ❌ **NE PEUT PAS** s'inscrire via l'app**
- ✅ Créé/promu uniquement par l'admin
- ✅ Pas de commission prépayée
- ✅ Rémunération : salaire fixe ou à la course

**Affectation prioritaire :**
- Commandes B2B
- Commandes planifiées
- Commandes sensibles (valeur élevée, clients VIP)

**Comment créer un interne :**
- Via l'interface admin (à créer)
- Ou directement en SQL :
  ```sql
  UPDATE public.driver_profiles
  SET driver_type = 'internal'
  WHERE user_id = 'USER_ID_ICI';
  ```

---

## 🔍 Vérifications Utiles

### Vérifier les livreurs existants

```sql
SELECT 
  id,
  user_id,
  email,
  first_name,
  last_name,
  driver_type,
  vehicle_type,
  vehicle_plate,
  license_number,
  is_online,
  is_available,
  rating,
  total_deliveries,
  created_at
FROM public.driver_profiles
ORDER BY created_at DESC;
```

### Compter par type

```sql
SELECT 
  driver_type,
  COUNT(*) as count
FROM public.driver_profiles
GROUP BY driver_type;
```

### Vérifier les profils incomplets (partenaires sans véhicule/permis)

```sql
SELECT 
  id,
  email,
  first_name,
  last_name,
  vehicle_plate,
  license_number
FROM public.driver_profiles
WHERE driver_type = 'partner'
  AND (vehicle_plate IS NULL OR license_number IS NULL);
```

---

## ✅ Checklist de Déploiement

- [x] Migration `017_add_driver_type.sql` exécutée dans Supabase
- [x] Colonne `driver_type` ajoutée à `driver_profiles`
- [x] Fonctions `is_internal_driver()` et `is_partner_driver()` créées
- [x] Backend modifié pour créer `driver_type = 'partner'` par défaut
- [x] Écran `partner-onboarding.tsx` créé
- [x] Redirection automatique vers onboarding si profil incomplet
- [ ] Interface admin pour promouvoir partenaire → interne (à créer)
- [ ] Vérification solde commission avant envoi commandes (à implémenter)

---

## 🚀 Prochaines Étapes

1. **Tester l'inscription d'un nouveau partenaire** via l'app driver
2. **Vérifier** que le profil est créé avec `driver_type = 'partner'`
3. **Compléter le profil** via l'écran onboarding
4. **Créer l'interface admin** pour gérer les types de livreurs
5. **Implémenter la vérification du solde commission** avant d'envoyer des commandes aux partenaires

---

**Document créé le** : 2025-01-XX  
**Version** : 1.0  
**Statut** : ✅ Prêt pour utilisation

