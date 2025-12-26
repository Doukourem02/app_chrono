# 📱 Configuration des Notifications Push Natives

## ⚠️ Important : Expo Go vs Development Build

### ❌ Expo Go ne supporte PAS les notifications push natives

Les notifications push natives (qui viennent du serveur même quand l'app est fermée) **ne fonctionnent PAS** dans Expo Go. Expo Go ne supporte que les notifications locales (programmées dans l'app).

### ✅ Solution : Development Build

Pour utiliser les notifications push natives, vous devez générer un **development build** ou un **production build**.

---

## 🚀 Options de Build

### Option 1 : Development Build Local (Rapide pour tester)

**Avantages** :
- ✅ Rapide pour tester localement
- ✅ Pas besoin de compte Expo
- ✅ Débogage facile

**Commandes** :
```bash
# Android
npm run android

# iOS (nécessite Xcode sur Mac)
npm run ios
```

**Prérequis** :
- Android : Android Studio installé
- iOS : Xcode installé (Mac uniquement)

---

### Option 2 : Development Build avec EAS (Recommandé pour distribution)

**Avantages** :
- ✅ Build dans le cloud (pas besoin d'outils locaux)
- ✅ Facile à partager avec l'équipe
- ✅ Configuration APNs/FCM gérée automatiquement

**Commandes** :
```bash
# Installer EAS CLI (une seule fois)
npm install -g eas-cli

# Se connecter à Expo
eas login

# Générer un development build
eas build --profile development --platform android
# ou
eas build --profile development --platform ios
```

**Prérequis** :
- Compte Expo (gratuit)
- EAS CLI installé

---

## 📋 Configuration Requise

### 1. Plugin expo-notifications

Le plugin est déjà configuré dans `app.config.js` :
```javascript
[
  "expo-notifications",
  {
    "icon": "./assets/images/icon.png",
    "color": "#E6F4FE",
    "sounds": ["./assets/sounds/notification.wav"]
  }
]
```

### 2. Fichier eas.json

Le fichier `eas.json` est créé avec les profils de build :
- `development` : Pour tester
- `preview` : Pour tester avant production
- `production` : Pour la production

### 3. Configuration iOS (APNs)

Pour iOS, vous devrez :
1. Créer un certificat APNs dans Apple Developer
2. Configurer les credentials dans EAS :
   ```bash
   eas credentials
   ```

### 4. Configuration Android (FCM)

Pour Android, EAS gère automatiquement FCM, mais vous pouvez configurer manuellement si besoin.

---

## 🔧 Prochaines Étapes

1. **Installer expo-notifications** :
   ```bash
   cd driver_chrono
   npm install expo-notifications
   ```

2. **Créer le service de notifications** (voir `services/pushNotificationService.ts`)

3. **Générer un development build** :
   - Option locale : `npm run android` ou `npm run ios`
   - Option EAS : `eas build --profile development --platform android`

4. **Tester les notifications** :
   - Installer le build sur un appareil physique (les notifications push ne fonctionnent pas sur simulateur iOS)
   - Tester la réception de notifications depuis le serveur

---

## 📝 Notes Importantes

- ⚠️ Les notifications push natives nécessitent un **appareil physique** pour être testées (pas de simulateur iOS)
- ⚠️ Pour Android, vous pouvez tester sur un émulateur
- ⚠️ Le premier build peut prendre 10-20 minutes (EAS) ou nécessiter la configuration de l'environnement local
- ✅ Une fois le build généré, vous pouvez développer normalement avec `expo start --dev-client`

---

## 🔗 Ressources

- [Documentation expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Development Builds](https://docs.expo.dev/development/introduction/)

