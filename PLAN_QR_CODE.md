# 📱 Plan d'Implémentation du Système QR Code pour Chrono

## 🎯 Objectifs Principaux

1. **Sécurité** : S'assurer que le colis va à bon port
2. **Traçabilité** : Historique complet des scans QR code
3. **Validation** : Vérification de l'identité du client/livreur aux moments clés
4. **Preuve de livraison** : Confirmation numérique de la récupération et de la livraison

---

## 📋 Cas d'Usage des QR Codes

### **QR Code de Livraison (Delivery QR Code) - UN SEUL QR CODE**

**Quand** : Généré automatiquement lors de la création de la commande  
**Qui utilise** : Le destinataire (reçoit le QR code automatiquement via SMS/WhatsApp)  
**Qui scanne** : Le livreur scanne le QR code du destinataire à la livraison  
**Objectif** : Confirmer que le colis a été livré à la bonne personne

**Flux simplifié** :
1. **Création de commande** → QR code généré automatiquement
2. **Notification automatique** → QR code envoyé au destinataire via SMS/WhatsApp
3. **Récupération** → Le livreur récupère le colis (sans scan)
4. **Livraison** → Le livreur scanne le QR code du destinataire

---

## 🏗️ Architecture Technique

### Phase 1 : Base de Données

#### 1.1 Migration : Ajout des champs QR Code à la table `orders`

```sql
-- Migration : 020_add_qr_codes_to_orders.sql

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_qr_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_qr_scanned_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_qr_scanned_by UUID REFERENCES users(id);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_orders_delivery_qr ON orders(delivery_qr_code) WHERE delivery_qr_code IS NOT NULL;
```

#### 1.2 Table : Historique des scans QR Code

```sql
-- Migration : 021_create_qr_code_scans_table.sql

CREATE TABLE IF NOT EXISTS qr_code_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  qr_code_type TEXT NOT NULL DEFAULT 'delivery' CHECK (qr_code_type = 'delivery'),
  scanned_by UUID NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMP DEFAULT NOW(),
  location JSONB, -- { latitude, longitude } au moment du scan
  device_info JSONB, -- Informations sur l'appareil (optionnel)
  is_valid BOOLEAN DEFAULT TRUE,
  validation_error TEXT, -- Si le scan est invalide, raison
  
  CONSTRAINT unique_scan_per_order UNIQUE(order_id, scanned_by)
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_order ON qr_code_scans(order_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_by ON qr_code_scans(scanned_by);
CREATE INDEX IF NOT EXISTS idx_qr_scans_type ON qr_code_scans(qr_code_type);
```

---

### Phase 2 : Backend - Génération des QR Codes

#### 2.1 Service : Génération de QR Codes

**Fichier** : `chrono_backend/src/services/qrCodeService.ts`

**Fonctionnalités** :
- Générer un QR code unique pour chaque commande (delivery uniquement)
- Format du QR code : JSON avec signature cryptographique
- Structure du QR code :
  ```json
  {
    "orderId": "uuid",
    "orderNumber": "string",
    "recipientName": "string",
    "recipientPhone": "string",
    "creatorName": "string",
    "timestamp": "2025-11-24T20:00:00Z",
    "signature": "hash_cryptographique",
    "expiresAt": "2025-11-26T20:00:00Z"
  }
  ```

**Sécurité** :
- Utiliser un secret partagé pour signer les QR codes
- Expiration des QR codes : 48h après création
- Vérification de la signature lors du scan

#### 2.2 Endpoints API

**POST `/api/orders/:orderId/qr-codes/generate`**
- Génère le QR code de livraison
- Envoie automatiquement le QR code au destinataire via SMS/WhatsApp
- Retourne le QR code en base64 (pour affichage dans l'app)

**GET `/api/orders/:orderId/qr-codes`**
- Récupère le QR code de livraison d'une commande
- Retourne l'image QR code en base64

**POST `/api/qr-codes/scan`**
- Endpoint pour scanner un QR code
- Valide le QR code (signature, expiration)
- Affiche les informations du destinataire et du créateur
- Enregistre le scan dans la base de données
- Met à jour le statut de la commande à `completed`

---

### Phase 3 : Backend - Validation et Logique Métier

#### 3.1 Validation des Scans

**Règles de validation pour le QR Code de Livraison** :
- Le livreur doit être assigné à la commande
- Le statut doit être `picked_up` ou `delivering`
- Le QR code doit être valide (signature + expiration)
- Le QR code ne doit pas avoir été déjà scanné
- Le livreur doit être proche du point de dropoff (géolocalisation - optionnel)

#### 3.2 Mise à jour automatique du statut

- **Après scan du Delivery QR** : `delivering` ou `picked_up` → `completed`

#### 3.3 Affichage après scan

Après un scan réussi, le livreur voit :
- **Nom du destinataire**
- **Téléphone du destinataire**
- **Nom du créateur de commande** (pour confirmation)
- **Numéro de commande**

---

### Phase 4 : Application Client (app_chrono)

#### 4.1 Affichage du QR Code de Livraison

**Écran** : Page de suivi de commande (`app/order-tracking/[orderId].tsx`)

**Fonctionnalités** :
- Afficher le QR code de livraison dès la création de la commande
- Le QR code est automatiquement envoyé au destinataire via SMS/WhatsApp
- Bouton "Afficher QR Code" avec modal plein écran
- Option de partage du QR code (SMS, WhatsApp, etc.) si nécessaire

**Composant** : `components/QRCodeDisplay.tsx`
- Affichage du QR code avec logo Chrono au centre
- Instructions claires pour le destinataire
- Compte à rebours si expiration proche (48h)
- Affichage de l'expiration

#### 4.2 Génération des QR Codes

- Générer automatiquement le QR code lors de la création de la commande
- Envoyer automatiquement le QR code au destinataire via SMS/WhatsApp
- Stocker le QR code dans le store Zustand
- Rafraîchir le QR code si expiration proche

---

### Phase 5 : Application Livreur (driver_chrono)

#### 5.1 Scanner de QR Code

**Écran** : Intégré dans `DriverOrderBottomSheet.tsx`

**Fonctionnalités** :
- Bouton "Scanner QR Code" visible quand :
  - Statut `picked_up` ou `delivering` → Scanner QR de livraison
- Utiliser `expo-camera` ou `expo-barcode-scanner` pour scanner
- Validation en temps réel
- Feedback visuel (succès/erreur)

**Composant** : `components/QRCodeScanner.tsx`
- Vue caméra plein écran
- Overlay avec zone de scan
- Instructions contextuelles
- Vibration/feedback haptique lors du scan réussi

#### 5.2 Affichage après scan

**Composant** : `components/QRCodeScanResult.tsx`

Après un scan réussi, afficher :
- **Nom du destinataire**
- **Téléphone du destinataire**
- **Nom du créateur de commande** (pour confirmation)
- **Numéro de commande**
- Bouton "Confirmer la livraison"

#### 5.3 Validation et Mise à Jour

- Après scan réussi :
  - Afficher les informations du destinataire et du créateur
  - Confirmer la livraison → Mettre à jour le statut à `completed`
  - Enregistrer la localisation GPS au moment du scan
  - Notifier le client et le destinataire en temps réel

---

### Phase 6 : Dashboard Admin (admin_chrono)

#### 6.1 Visualisation des Scans

**Page** : Détails d'une commande

**Fonctionnalités** :
- Afficher l'historique des scans QR code
- Timestamp, localisation, utilisateur qui a scanné
- Indicateur visuel si scan valide/invalide
- Carte montrant l'emplacement du scan

#### 6.2 Statistiques

- Nombre de scans par jour/semaine
- Taux de scans réussis vs échoués
- Temps moyen entre création de commande et scan de livraison

---

## 🔐 Sécurité et Validation

### 1. Signature Cryptographique

- Utiliser `crypto` (Node.js) pour signer les QR codes
- Secret stocké dans les variables d'environnement
- Algorithme : HMAC-SHA256

### 2. Expiration des QR Codes

- **Delivery QR** : Valide 48h après création
- Vérifier l'expiration lors du scan

### 3. Validation Géolocalisation (Optionnel)

- Vérifier que le livreur est à moins de 50m du point de dropoff
- Tolérance configurable selon le contexte (bâtiment, zone rurale, etc.)
- Peut être désactivée si nécessaire

### 4. Protection contre la Réutilisation

- Chaque QR code ne peut être scanné qu'une seule fois
- Enregistrer le scan dans la base de données avec timestamp
- Empêcher les scans multiples

---

## 💡 Idées d'Utilisation Supplémentaires

### 1. **QR Code de Suivi Public**
- QR code unique pour chaque commande (différent des QR pickup/delivery)
- Permet au client de partager le suivi avec d'autres personnes
- Accès en lecture seule aux informations de suivi

### 2. **QR Code de Retour**
- Si le colis ne peut pas être livré, générer un QR code de retour
- Le livreur scanne pour confirmer le retour au point de départ

### 3. **QR Code de Paiement**
- Intégrer le QR code de paiement mobile (Orange Money, Wave) dans le QR code de livraison
- Le destinataire peut payer directement en scannant

### 4. **QR Code Multi-Usage**
- Un seul QR code qui change de fonction selon le contexte :
  - Avant pickup : QR code pour le client
  - Après pickup : QR code pour le destinataire
  - Après delivery : QR code de facture/reçu

### 5. **QR Code de Vérification d'Identité**
- Le destinataire doit scanner son propre QR code (généré dans son profil)
- Double vérification : QR code de commande + QR code d'identité

### 6. **QR Code pour Livraisons Multi-Colis**
- Un QR code maître pour une commande avec plusieurs colis
- Chaque colis a son propre sous-QR code
- Le livreur scanne chaque colis individuellement

### 7. **QR Code de Réclamation**
- Après livraison, générer un QR code pour les réclamations
- Le client peut scanner pour accéder rapidement au formulaire de réclamation

---

## 📱 Flux Utilisateur Détaillé

### Scénario : Création et Livraison du Colis

1. **Client** : Crée une commande → QR code de livraison généré automatiquement
2. **Système** : Envoie automatiquement le QR code au destinataire via SMS/WhatsApp
3. **Destinataire** : Reçoit le QR code sur son téléphone
4. **Livreur** : Récupère le colis (sans scan nécessaire)
5. **Livreur** : Arrive au point de dropoff
6. **Livreur** : Clique sur "Scanner QR Code" dans l'app
7. **Livreur** : Scanne le QR code du destinataire
8. **Système** : Valide le QR code (signature, expiration)
9. **Système** : Affiche les informations au livreur :
   - Nom du destinataire
   - Téléphone du destinataire
   - Nom du créateur de commande
   - Numéro de commande
10. **Livreur** : Confirme la livraison
11. **Système** : Met à jour le statut à `completed`
12. **Client & Destinataire** : Reçoivent notification "Colis livré"
13. **Livreur** : Peut maintenant accepter une nouvelle commande

---

## 🛠️ Technologies et Bibliothèques

### Backend
- **`qrcode`** (npm) : Génération de QR codes
- **`crypto`** (Node.js built-in) : Signature cryptographique
- **`jimp`** ou **`sharp`** : Traitement d'images (ajout de logo)

### Mobile (React Native / Expo)
- **`expo-camera`** : Accès à la caméra
- **`expo-barcode-scanner`** : Scanner de codes-barres/QR codes
- **`react-native-qrcode-svg`** : Génération de QR codes côté client (optionnel)
- **`expo-haptics`** : Feedback haptique lors du scan

### Frontend (Next.js)
- **`qrcode.react`** : Génération de QR codes React
- **`html5-qrcode`** : Scanner de QR codes dans le navigateur (pour admin)

---

## 📊 Structure des Données

### QR Code JSON Structure

```typescript
interface QRCodeData {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string;
  creatorName: string;
  timestamp: string; // ISO 8601
  signature: string; // HMAC-SHA256
  expiresAt: string; // ISO 8601 (48h après création)
}
```

### QR Code Scan Record

```typescript
interface QRCodeScan {
  id: string;
  orderId: string;
  qrCodeType: 'delivery';
  scannedBy: string; // userId du livreur
  scannedAt: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  deviceInfo?: {
    platform: string;
    model?: string;
  };
  isValid: boolean;
  validationError?: string;
}

interface QRCodeScanResult {
  recipientName: string;
  recipientPhone: string;
  creatorName: string;
  orderNumber: string;
}
```

---

## 🔄 Intégration avec le Flux Existant

### Modifications Nécessaires

1. **Création de commande** (`create-order` socket event)
   - Générer automatiquement le QR code de livraison
   - Envoyer automatiquement le QR code au destinataire via SMS/WhatsApp
   - Stocker le QR code dans la base de données

2. **Mise à jour de statut** (`update-delivery-status` socket event)
   - Pour `completed` : Require delivery QR scan
   - Afficher les informations du destinataire après scan

3. **Interface livreur** (`DriverOrderBottomSheet.tsx`)
   - Ajouter bouton "Scanner QR Code" visible quand statut `picked_up` ou `delivering`
   - Intégrer le scanner de QR code
   - Afficher les informations du destinataire après scan réussi

4. **Interface client** (`order-tracking/[orderId].tsx`)
   - Afficher le QR code de livraison dès la création
   - Permettre le partage du QR code si nécessaire

---

## 🚀 Plan d'Implémentation par Phases

### Phase 1 : Fondations (Backend)
- [ ] Migration base de données (champs QR code)
- [ ] Service de génération de QR codes
- [ ] Service de validation de QR codes
- [ ] Endpoints API pour génération et scan

### Phase 2 : Intégration Backend
- [ ] Génération automatique lors de la création de commande
- [ ] Validation lors du scan
- [ ] Mise à jour automatique du statut
- [ ] Tests unitaires et d'intégration

### Phase 3 : Application Livreur
- [ ] Composant scanner de QR code
- [ ] Intégration dans `DriverOrderBottomSheet`
- [ ] Validation et feedback utilisateur
- [ ] Tests sur appareil réel

### Phase 4 : Application Client
- [ ] Affichage des QR codes
- [ ] Partage des QR codes
- [ ] Notifications lors des scans
- [ ] Tests utilisateur

### Phase 5 : Dashboard Admin
- [ ] Visualisation des scans
- [ ] Statistiques
- [ ] Historique complet

### Phase 6 : Améliorations et Optimisations
- [ ] Cache des QR codes
- [ ] Optimisation des performances
- [ ] Analytics et métriques
- [ ] Documentation utilisateur

---

## ⚠️ Points d'Attention

1. **Hors ligne** : Gérer le cas où le livreur n'a pas de connexion internet
   - Solution : Stocker les scans en local et synchroniser quand la connexion revient

2. **QR Code endommagé** : Si le QR code ne peut pas être scanné
   - Solution : Code de secours (code à 6 chiffres) affiché avec le QR code

3. **Destinataire non connecté** : Si le destinataire n'a pas l'app
   - Solution : Le client peut partager le QR code via SMS/WhatsApp

4. **Sécurité** : Protection contre la falsification
   - Solution : Signature cryptographique + expiration + validation serveur

5. **Performance** : Génération de QR codes pour beaucoup de commandes
   - Solution : Génération asynchrone + cache + lazy loading

---

## 📝 Notes Additionnelles

- Les QR codes peuvent être générés en format PNG ou SVG
- Taille recommandée : 300x300px minimum pour un scan facile
- Logo Chrono au centre du QR code (optionnel mais recommandé)
- Code de secours (6 chiffres) affiché sous le QR code pour les cas où le scan échoue
- Support du mode sombre/clair pour l'affichage des QR codes

---

## 🎨 Design des QR Codes

### Format Visuel
- QR code avec logo Chrono au centre (30% de la taille)
- Code de secours en dessous (ex: "Code: 123456")
- Instructions contextuelles (ex: "Montrez ce code au livreur")
- Expiration visible si applicable

### Couleurs
- QR code : Noir sur fond blanc (standard)
- Logo : Couleur de la marque Chrono
- Code de secours : Gris foncé

---

## ✅ Checklist de Validation

Avant de marquer une fonctionnalité comme complète :

- [ ] QR code généré avec signature valide
- [ ] QR code scannable avec différentes applications
- [ ] Validation serveur fonctionnelle
- [ ] Géolocalisation vérifiée
- [ ] Expiration respectée
- [ ] Scan unique (pas de réutilisation)
- [ ] Mise à jour automatique du statut
- [ ] Notifications envoyées
- [ ] Historique enregistré
- [ ] Interface utilisateur intuitive
- [ ] Gestion des erreurs complète
- [ ] Tests sur différents appareils

---

## 📚 Ressources et Documentation

- [QR Code Generator Library (npm)](https://www.npmjs.com/package/qrcode)
- [Expo Camera Documentation](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Expo Barcode Scanner](https://docs.expo.dev/versions/latest/sdk/bar-code-scanner/)
- [QR Code Best Practices](https://www.qrcode.com/en/howto/code.html)

---

**Date de création** : 2025-11-24  
**Version** : 1.0  
**Auteur** : Plan d'implémentation Chrono QR Code System

