# Guide de dépannage - Driver Chrono

## Erreur : Cannot find native module 'ExpoBarCodeScanner'

### Problème
L'erreur `Cannot find native module 'ExpoBarCodeScanner'` apparaît car `expo-barcode-scanner` nécessite du code natif et ne fonctionne pas avec Expo Go.

### Solution

Vous avez deux options :

#### Option 1 : Créer un développement build (Recommandé)

1. **Pour iOS :**
   ```bash
   npx expo run:ios
   ```

2. **Pour Android :**
   ```bash
   npx expo run:android
   ```

Cela va créer un développement build avec tous les modules natifs nécessaires, y compris `expo-barcode-scanner`.

#### Option 2 : Utiliser Expo Go avec un développement build personnalisé

Si vous préférez utiliser Expo Go, vous devez créer un développement build personnalisé avec EAS Build :

```bash
# Installer EAS CLI si ce n'est pas déjà fait
npm install -g eas-cli

# Se connecter à votre compte Expo
eas login

# Créer un développement build
eas build --profile development --platform ios
# ou
eas build --profile development --platform android
```

### Note importante

Le composant `QRCodeScanner` a été modifié pour gérer gracieusement l'absence du module natif. Si le module n'est pas disponible, un message informatif sera affiché à l'utilisateur expliquant qu'un développement build est requis.

---

## Warning : Route missing default export

### Problème
Le warning `Route "./(tabs)/index.tsx" is missing the required default export` apparaît parfois même si le fichier a bien un export par défaut.

### Solution

1. **Vider le cache Metro :**
   ```bash
   npx expo start --clear
   ```

2. **Si le problème persiste, redémarrer complètement :**
   ```bash
   # Arrêter le serveur Metro (Ctrl+C)
   # Supprimer le cache
   rm -rf node_modules/.cache
   # Redémarrer
   npx expo start --clear
   ```

3. **Vérifier que le fichier a bien un export par défaut :**
   Le fichier `app/(tabs)/index.tsx` doit contenir :
   ```typescript
   export default function Index() {
     // ...
   }
   ```

Ce warning est généralement un faux positif et peut être ignoré si le fichier fonctionne correctement.

---

## Autres problèmes courants

### Le scanner QR code ne s'ouvre pas

1. Vérifiez que vous utilisez un développement build (pas Expo Go)
2. Vérifiez les permissions de la caméra dans les paramètres de l'appareil
3. Redémarrez l'application après avoir accordé les permissions

### L'application ne se connecte pas au backend

1. Vérifiez que le fichier `.env` contient les bonnes valeurs :
   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.96:4000
   EXPO_PUBLIC_SOCKET_URL=http://192.168.1.96:4000
   ```

2. Vérifiez que le backend est bien démarré et accessible depuis votre appareil/simulateur

3. Pour iOS Simulator, utilisez `localhost` au lieu de l'IP locale :
   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:4000
   EXPO_PUBLIC_SOCKET_URL=http://localhost:4000
   ```

### Erreurs de build

Si vous rencontrez des erreurs lors de la création d'un développement build :

1. **Vérifiez que toutes les dépendances sont installées :**
   ```bash
   npm install
   ```

2. **Vérifiez la configuration dans `app.config.js`**

3. **Pour iOS, vérifiez que Xcode est installé et à jour**

4. **Pour Android, vérifiez que Android Studio est installé et configuré**

---

## Support

Si les problèmes persistent après avoir suivi ces étapes, vérifiez :
- Les logs de la console pour plus de détails
- La documentation Expo : https://docs.expo.dev/
- La documentation de `expo-barcode-scanner` : https://docs.expo.dev/versions/latest/sdk/bar-code-scanner/

