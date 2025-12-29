# 🚀 Guide Build Chrono Livraison – Version Simple

## 📋 But du document

Expliquer simplement comment faire un build mobile qui fonctionne sur un vrai téléphone.

---

## 💡 Idée clé (à retenir absolument)

**Un téléphone ne peut PAS utiliser `localhost`. Il faut utiliser l'IP locale de ton ordinateur.**

- ✅ **Sur ton ordinateur** : `localhost` = ton ordinateur → Ça fonctionne
- ❌ **Sur ton téléphone** : `localhost` = ton téléphone → Le backend n'est PAS là !

**Solution :** Utiliser l'IP locale de ton ordinateur (ex: `192.168.1.96`)

---

## 📝 Étape 1 – Trouver ton IP locale

### Sur Mac/Linux :

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Exemple de résultat :**
```
inet 192.168.1.96 netmask 0xffffff00 broadcast 192.168.1.255
```

👉 Ton IP locale est : `192.168.1.96`

### Sur Windows :

```bash
ipconfig
```

**Chercher la ligne "Adresse IPv4" sous "Carte réseau sans fil Wi-Fi" :**
```
Adresse IPv4. . . . . . . . . . . . . . . : 192.168.1.96
```

👉 Ton IP locale est : `192.168.1.96`

---

## 📝 Étape 2 – Configurer les fichiers `.env`

Créez un fichier `.env` dans chaque app :

- `app_chrono/.env`
- `driver_chrono/.env`

**Contenu des fichiers `.env` :**

```bash
# ⚠️ REMPLACEZ 192.168.1.96 par TON IP locale trouvée à l'étape 1

# URL du backend (utiliser l'IP locale, PAS localhost)
EXPO_PUBLIC_API_URL=http://192.168.1.96:4000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.96:4000

# Supabase (obligatoire)
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon

# Google Maps (obligatoire pour les cartes)
EXPO_PUBLIC_GOOGLE_API_KEY=votre_cle_google_maps
```

**⚠️ Important :**
- ❌ **NE PAS utiliser `localhost`** - Un téléphone ne peut pas accéder à `localhost`
- ✅ **Utiliser l'IP locale** de ton ordinateur (ex: `192.168.1.96`)

---

## 📝 Étape 3 – Lancer le backend

```bash
cd chrono_backend
npm run dev
```

Tu devrais voir :
```
🚀 Server running on http://localhost:4000
```

**Note :** Le backend écoute automatiquement sur toutes les interfaces (`0.0.0.0`), donc il est accessible depuis n'importe quel appareil sur le même réseau WiFi.

---

## 📝 Étape 4 – Tester depuis le téléphone

**Conditions :**
- ✅ Ton téléphone doit être sur le **même réseau WiFi** que ton ordinateur
- ✅ Le backend doit être démarré

**Sur ton téléphone :**

1. Ouvre le navigateur (Chrome, Safari, etc.)
2. Tape dans la barre d'adresse :
   ```
   http://192.168.1.96:4000/health
   ```
   (Remplace `192.168.1.96` par TON IP locale)

3. Tu devrais voir :
   ```json
   {"status":"ok"}
   ```

✅ **Si ça fonctionne :** Ton téléphone peut accéder au backend → L'app fonctionnera !

❌ **Si ça ne fonctionne pas :** Voir la section "Dépannage" ci-dessous.

---

## 📝 Étape 5 – Lancer le build

### Pour Android (APK) :

```bash
cd driver_chrono  # ou app_chrono
eas build --profile development --platform android
```

**Résultat :** Un fichier APK que tu peux installer sur ton appareil Android.

### Pour iOS :

```bash
cd driver_chrono  # ou app_chrono
eas build --profile development --platform ios
```

**Note :** Pour iOS sur appareil physique, tu auras besoin d'un compte Apple Developer (gratuit pour développement).

---

## ✅ Checklist rapide

Avant de lancer le build, vérifie :

- [ ] **IP locale trouvée** (ex: `192.168.1.96`)
- [ ] **Fichiers `.env` créés** avec l'IP locale (pas localhost)
- [ ] **Backend accessible** depuis le téléphone (`http://IP:4000/health` → `{"status":"ok"}`)
- [ ] **Variables `.env` correctes** (API_URL, SOCKET_URL, Supabase, Google Maps)
- [ ] **EAS CLI installé et connecté** (`eas login`)
- [ ] **Build lancé avec EAS**

---

## 🎯 Phrase finale

**Si ton téléphone voit l'URL `http://IP:4000/health` et retourne `{"status":"ok"}`, alors ton app fonctionnera.**

---

## 🔧 Dépannage rapide

### ❌ Le téléphone ne peut pas accéder au backend

**Vérifications :**

1. **Pare-feu :**
   - **Mac :** Système > Préférences Système > Sécurité > Pare-feu > Options > Autoriser Node.js
   - **Windows :** Paramètres > Réseau et Internet > Pare-feu Windows > Autoriser une application > Node.js

2. **Même réseau WiFi :**
   - Assure-toi que ton téléphone et ton ordinateur sont sur le même réseau WiFi

3. **Backend démarré :**
   - Vérifie que le backend tourne (`cd chrono_backend && npm run dev`)

### ❌ Google Maps ne s'affiche pas

- Vérifie que `EXPO_PUBLIC_GOOGLE_API_KEY` est définie dans `.env`
- Vérifie que la clé API est activée pour Maps SDK (Android et iOS), Directions API, Geocoding API

### ❌ GPS ne fonctionne pas

- Autorise les permissions de localisation dans les paramètres de l'appareil
- Vérifie que `expo-location` est installé (déjà dans package.json)

---

## 💡 Exemple complet

**Scénario :**
- Ton ordinateur : IP `192.168.1.96`
- Ton téléphone : IP `192.168.1.105`
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
   - Elle pourra se connecter au backend sur ton ordinateur ✅

---

## 📋 Commandes rapides

```bash
# 1. Trouver ton IP locale
# Mac/Linux :
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows :
ipconfig

# 2. Tester depuis le téléphone
# Ouvrir navigateur mobile : http://VOTRE_IP:4000/health

# 3. Démarrer le backend
cd chrono_backend
npm run dev

# 4. Build Android
cd driver_chrono  # ou app_chrono
eas build --profile development --platform android

# 5. Build iOS
cd driver_chrono  # ou app_chrono
eas build --profile development --platform ios
```

---

## ✅ Résumé

**Pour que le build fonctionne sur un téléphone physique :**

1. ✅ Trouve ton IP locale
2. ✅ Configure les fichiers `.env` avec l'IP locale (pas localhost)
3. ✅ Lance le backend
4. ✅ Teste depuis le téléphone : `http://IP:4000/health` → `{"status":"ok"}`
5. ✅ Lance le build avec EAS

**Si ton téléphone voit l'URL `http://IP:4000/health` et retourne `{"status":"ok"}`, alors ton app fonctionnera ! 🚀**
