# 🚀 Guide Complet - Build de Développement

## 📋 Table des matières

1. [Introduction](#introduction)
2. [Pourquoi utiliser l'IP locale ?](#pourquoi-utiliser-lip-locale)
3. [Comment trouver votre IP locale](#comment-trouver-votre-ip-locale)
4. [Configuration des variables d'environnement](#configuration-des-variables-denvironnement)
5. [Vérification de l'accessibilité du backend](#vérification-de-laccessibilité-du-backend)
6. [Checklist avant le build](#checklist-avant-le-build)
7. [Commandes de build](#commandes-de-build)
8. [Dépannage après installation](#dépannage-après-installation)

---

## 🎯 Introduction

Ce guide vous accompagne étape par étape pour générer un build de développement et installer l'application sur un appareil physique.

**⚠️ Point crucial :** Pour qu'un appareil physique puisse se connecter au backend, vous devez utiliser l'**IP locale** de votre ordinateur au lieu de `localhost`.

---

## ❓ Pourquoi utiliser l'IP locale ?

### Le problème avec `localhost`

Quand vous utilisez `localhost` ou `127.0.0.1` dans votre application mobile :

```
❌ EXPO_PUBLIC_API_URL=http://localhost:4000
```

**Cela signifie :** "Connecte-toi à CET appareil-ci"

- ✅ Sur votre **ordinateur** : `localhost` = votre ordinateur → Ça fonctionne
- ❌ Sur votre **téléphone** : `localhost` = votre téléphone → Le backend n'est PAS sur votre téléphone !

**Résultat :** L'app sur votre téléphone essaie de se connecter à un serveur qui n'existe pas sur le téléphone, donc ça ne fonctionne pas.

### ✅ La solution : Utiliser l'IP locale

C'est l'adresse de votre ordinateur sur votre réseau WiFi local.

**Exemple :**
- Votre ordinateur : `192.168.1.96` (sur le réseau WiFi)
- Votre téléphone : `192.168.1.105` (sur le même réseau WiFi)
- Ils peuvent se parler car ils sont sur le même réseau !

```
✅ EXPO_PUBLIC_API_URL=http://192.168.1.96:4000
```

**Cela signifie :** "Connecte-toi à l'ordinateur qui a l'adresse 192.168.1.96"

- ✅ Sur votre **téléphone** : Il va chercher l'ordinateur à l'adresse `192.168.1.96` → Le backend est là → Ça fonctionne !

---

## 🔍 Comment trouver votre IP locale ?

### Sur Mac :

```bash
# Ouvrir le Terminal et taper :
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Exemple de résultat :**
```
inet 192.168.1.96 netmask 0xffffff00 broadcast 192.168.1.255
```

👉 Votre IP locale est : `192.168.1.96`

### Sur Windows :

```bash
# Ouvrir PowerShell ou CMD et taper :
ipconfig
```

**Chercher la ligne "Adresse IPv4" sous "Carte réseau sans fil Wi-Fi" :**
```
Adresse IPv4. . . . . . . . . . . . . . . : 192.168.1.96
```

👉 Votre IP locale est : `192.168.1.96`

### Sur Linux :

```bash
# Ouvrir le Terminal et taper :
hostname -I
```

**Exemple de résultat :**
```
192.168.1.96
```

---

## 📝 Configuration des variables d'environnement

### Étape 1 : Créer les fichiers `.env`

Créez un fichier `.env` à la racine de chaque app mobile :

- `app_chrono/.env`
- `driver_chrono/.env`

### Étape 2 : Contenu des fichiers `.env`

```bash
# ⚠️ REMPLACEZ 192.168.1.96 par VOTRE IP locale trouvée ci-dessus

# URL du backend (utiliser l'IP locale, PAS localhost)
EXPO_PUBLIC_API_URL=http://192.168.1.96:4000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.96:4000

# Supabase (obligatoire)
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon

# Google Maps (obligatoire pour les cartes)
EXPO_PUBLIC_GOOGLE_API_KEY=votre_cle_google_maps
```

**⚠️ Points critiques :**
- ❌ **NE PAS utiliser `localhost`** - Un appareil physique ne peut pas accéder à `localhost`
- ✅ **Utiliser l'IP locale** de votre machine (ex: `192.168.1.96`)
- ✅ **Vérifier que le backend est accessible** depuis l'appareil (même réseau WiFi)

**Exemple concret :**
Si votre IP est `192.168.1.96`, alors :
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.96:4000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.96:4000
```

---

## 🧪 Vérification de l'accessibilité du backend

### Étape 1 : Démarrer le backend

```bash
cd chrono_backend
npm run dev
```

Vous devriez voir :
```
🚀 Server running on http://localhost:4000
```

**Note :** Le backend est déjà configuré pour écouter sur `0.0.0.0` (toutes les interfaces), donc il est accessible depuis n'importe quel appareil sur le même réseau.

### Étape 2 : Tester depuis votre ordinateur

Ouvrez votre navigateur et allez sur :
```
http://localhost:4000/health
```

Vous devriez voir :
```json
{"status":"ok"}
```

✅ **Ça fonctionne sur votre ordinateur !**

### Étape 3 : Tester depuis votre téléphone (IMPORTANT)

**Conditions :**
- ✅ Votre téléphone doit être sur le **même réseau WiFi** que votre ordinateur
- ✅ Le backend doit être démarré

**Sur votre téléphone :**

1. Ouvrez le navigateur (Chrome, Safari, etc.)
2. Tapez dans la barre d'adresse :
   ```
   http://192.168.1.96:4000/health
   ```
   (Remplacez `192.168.1.96` par VOTRE IP locale)

3. Vous devriez voir :
   ```json
   {"status":"ok"}
   ```

✅ **Si ça fonctionne :** Votre téléphone peut accéder au backend → L'app fonctionnera !

❌ **Si ça ne fonctionne pas :** Voir la section "Dépannage" ci-dessous.

---

## ✅ Checklist avant le build

Avant de lancer le build, cochez chaque point :

### 1. Variables d'environnement ⚠️ CRITIQUE

- [ ] Trouvé votre IP locale (ex: `192.168.1.96`)
- [ ] Créé `app_chrono/.env` avec `EXPO_PUBLIC_API_URL=http://VOTRE_IP:4000`
- [ ] Créé `driver_chrono/.env` avec `EXPO_PUBLIC_API_URL=http://VOTRE_IP:4000`
- [ ] `EXPO_PUBLIC_SOCKET_URL` pointe vers l'IP locale (pas localhost)
- [ ] `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` configurés
- [ ] `EXPO_PUBLIC_GOOGLE_API_KEY` configurée

### 2. Backend accessible ⚠️ CRITIQUE

- [ ] Backend démarré (`cd chrono_backend && npm run dev`)
- [ ] Testé `http://localhost:4000/health` sur votre ordinateur → ✅ OK
- [ ] Testé `http://VOTRE_IP:4000/health` sur votre téléphone (même WiFi) → ✅ OK

### 3. Permissions ✅

- [ ] `expo-location` est installé (déjà dans package.json)
- [ ] Les permissions sont déclarées dans `app.config.js` (déjà fait)

**Note :** Les permissions sont gérées automatiquement par `expo-location` :
- **iOS** : Permissions déclarées automatiquement
- **Android** : Permissions déclarées automatiquement dans le manifest

### 4. Google Maps API Key ⚠️ CRITIQUE

- [ ] Clé API Google Maps configurée dans `.env`
- [ ] Clé API activée pour :
  - [ ] Maps SDK for Android
  - [ ] Maps SDK for iOS
  - [ ] Directions API
  - [ ] Geocoding API
  - [ ] Places API (si utilisé)
- [ ] Restrictions de la clé API configurées :
  - Pour développement : Autoriser toutes les IPs ou votre IP
  - Pour production : Restreindre par bundle ID / package name

**Test :** Vérifier que les cartes s'affichent correctement en développement.

### 5. Configuration EAS Build ✅

- [ ] EAS CLI installé (`npm install -g eas-cli`)
- [ ] Connecté à EAS (`eas login`)
- [ ] Projet configuré (`eas build:configure` - si première fois)

**Note :** Le fichier `eas.json` est déjà configuré pour le build de développement.

### 6. Assets (icônes, splash) ✅

- [ ] `assets/images/icon.png` (1024x1024) présent
- [ ] `assets/images/splash-icon.png` présent
- [ ] `assets/images/android-icon-*.png` présents (pour Android)

### 7. Test en développement local ✅

- [ ] Testé en développement local (Expo Go) pour vérifier la configuration

---

## 🚀 Commandes de build

### Pour Android (APK) :

```bash
cd driver_chrono  # ou app_chrono
eas build --profile development --platform android
```

**Résultat :** Un fichier APK que vous pouvez installer sur votre appareil Android.

### Pour iOS (simulateur) :

```bash
cd driver_chrono  # ou app_chrono
eas build --profile development --platform ios
```

**Note :** Pour iOS sur appareil physique, vous aurez besoin :
- Compte Apple Developer (gratuit pour développement)
- Certificat de développement

---

## 🔧 Dépannage après installation

### 1. ❌ L'app ne se connecte pas au backend

**Vérifications :**

- [ ] Backend démarré (`cd chrono_backend && npm run dev`)
- [ ] IP dans `.env` est l'IP locale (pas localhost)
- [ ] Appareil sur le même réseau WiFi que l'ordinateur
- [ ] Test de l'URL depuis le navigateur mobile : `http://VOTRE_IP:4000/health` → Doit retourner `{"status":"ok"}`

**Solutions :**

1. **Vérifier le pare-feu :**
   - **Mac :** Système > Préférences Système > Sécurité > Pare-feu > Options > Autoriser Node.js
   - **Windows :** Paramètres > Réseau et Internet > Pare-feu Windows > Autoriser une application > Node.js

2. **Vérifier que le backend écoute sur toutes les interfaces :**
   - Le backend doit écouter sur `0.0.0.0` (déjà configuré dans `server.ts`)

3. **Vérifier le réseau WiFi :**
   - Assurez-vous que votre téléphone et votre ordinateur sont sur le même réseau WiFi

### 2. ❌ Google Maps ne s'affiche pas

**Vérifications :**

- [ ] `EXPO_PUBLIC_GOOGLE_API_KEY` est définie dans `.env`
- [ ] Clé API activée pour les bons services (Maps SDK, Directions, etc.)
- [ ] Restrictions de la clé API configurées correctement

**Solutions :**

- Vérifier les logs : `adb logcat | grep -i "maps"` (Android)
- Vérifier la console Google Cloud pour les erreurs d'API
- Tester la clé API dans un navigateur : `https://maps.googleapis.com/maps/api/js?key=VOTRE_CLE`

### 3. ❌ GPS ne fonctionne pas

**Vérifications :**

- [ ] Permissions de localisation autorisées dans les paramètres de l'appareil
- [ ] `expo-location` est bien installé
- [ ] GPS activé sur l'appareil

**Solutions :**

- Autoriser les permissions dans Paramètres > Applications > Chrono > Permissions > Localisation
- Tester avec une autre app de localisation pour vérifier le GPS
- Vérifier que vous êtes à l'extérieur ou près d'une fenêtre (GPS nécessite une vue du ciel)

### 4. ❌ Socket.IO ne se connecte pas

**Vérifications :**

- [ ] `EXPO_PUBLIC_SOCKET_URL` est définie (même IP que API_URL)
- [ ] Backend Socket.IO écoute sur `0.0.0.0` (déjà configuré)
- [ ] Backend démarré et accessible

**Solutions :**

- Vérifier les logs backend pour les erreurs de connexion
- Vérifier que CORS autorise votre origine (déjà configuré pour les IPs locales en développement)
- Tester la connexion WebSocket : `ws://VOTRE_IP:4000`

### 5. ❌ L'IP change à chaque fois

**Solution 1 : Configurer une IP fixe sur votre routeur**

Configurez votre routeur pour attribuer une IP fixe à votre ordinateur (DHCP Reservation).

**Solution 2 : Utiliser ngrok (alternative rapide)**

```bash
# Installer ngrok
npm install -g ngrok

# Créer un tunnel
ngrok http 4000
```

Vous obtiendrez une URL comme : `https://abc123.ngrok.io`

Utilisez cette URL dans `.env` :
```bash
EXPO_PUBLIC_API_URL=https://abc123.ngrok.io
EXPO_PUBLIC_SOCKET_URL=https://abc123.ngrok.io
```

**Note :** L'URL ngrok change à chaque redémarrage. Pour une URL fixe, utilisez un compte ngrok payant.

---

## 📋 Commandes rapides

```bash
# 1. Trouver votre IP locale
# Mac/Linux :
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows :
ipconfig

# 2. Tester l'accessibilité du backend depuis l'appareil
# Ouvrir navigateur mobile : http://VOTRE_IP:4000/health

# 3. Démarrer le backend
cd chrono_backend
npm run dev

# 4. Build Android
cd driver_chrono  # ou app_chrono
eas build --profile development --platform android

# 5. Build iOS (simulateur)
cd driver_chrono  # ou app_chrono
eas build --profile development --platform ios
```

---

## 💡 Exemple complet

**Scénario :**
- Votre ordinateur : IP `192.168.1.96`
- Votre téléphone : IP `192.168.1.105`
- Tous deux sur le même WiFi : `MonWiFi`

**Configuration :**

1. **Trouver l'IP locale :**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # Résultat : 192.168.1.96
   ```

2. **Créer les fichiers `.env` :**
   ```bash
   # app_chrono/.env et driver_chrono/.env
   EXPO_PUBLIC_API_URL=http://192.168.1.96:4000
   EXPO_PUBLIC_SOCKET_URL=http://192.168.1.96:4000
   EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
   EXPO_PUBLIC_GOOGLE_API_KEY=votre_cle_google_maps
   ```

3. **Démarrer le backend :**
   ```bash
   cd chrono_backend
   npm run dev
   # Écoute sur http://0.0.0.0:4000 (accessible depuis n'importe quelle IP du réseau)
   ```

4. **Tester depuis le téléphone :**
   - Ouvrir navigateur mobile
   - Aller sur `http://192.168.1.96:4000/health`
   - Voir `{"status":"ok"}` → ✅ Ça fonctionne !

5. **Build et installation :**
   ```bash
   cd driver_chrono
   eas build --profile development --platform android
   ```
   - L'app installée sur le téléphone utilisera `http://192.168.1.96:4000`
   - Elle pourra se connecter au backend sur votre ordinateur ✅

---

## 🎯 Résumé en une phrase

**Utilisez l'IP locale de votre ordinateur (ex: `192.168.1.96`) au lieu de `localhost` dans les fichiers `.env`, car votre téléphone ne peut pas accéder à `localhost` (qui serait le téléphone lui-même, pas votre ordinateur).**

---

## ✅ Checklist finale rapide

Avant de lancer le build :

- [ ] IP locale trouvée
- [ ] Fichiers `.env` créés avec l'IP locale
- [ ] Backend démarré et accessible depuis le téléphone
- [ ] Google Maps API Key configurée
- [ ] EAS CLI installé et connecté
- [ ] Assets présents
- [ ] Test en développement local réussi

**Une fois tous ces points vérifiés, vous êtes prêt pour le build ! 🚀**

---

**Besoin d'aide ?** Consultez la section "Dépannage" ci-dessus ou vérifiez les logs du backend et de l'application.

