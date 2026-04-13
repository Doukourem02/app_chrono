# Checklist — Push Android (Krono client / livreur) : FCM + `push_tokens`

Si dans Supabase **`push_tokens`** tu ne vois que des lignes **`platform = ios`**, l’app **Android** n’a jamais réussi à obtenir un token Expo **ou** l’API **`POST /api/push/register`** a échoué.

## 1. Configurer FCM pour le build Android (obligatoire)

Expo relaie les push Android via **Firebase Cloud Messaging**. Sans credentials FCM liés au projet EAS, **`getExpoPushTokenAsync`** échoue souvent sur Android.

- Ouvre la doc officielle : [FCM credentials (Expo)](https://docs.expo.dev/push-notifications/fcm-credentials/)
- Sur **expo.dev** → **Credentials** → **Android**, configure **FCM** pour **le bon package** :
  - **App client** : projet slug `app_chrono`, package **`com.anonymous.app_chrono`**
  - **App livreur** : projet slug `driver_chrono`, package **`com.anonymous.driver_chrono`**

Sans cette étape, **iOS peut marcher** et **Android non**, exactement comme sur ta capture Supabase.

## 2. Nouveau build Android

Les credentials FCM sont injectés au **build** EAS.

- Depuis le dossier de l’app concernée :  
  `eas build -p android --profile production`  
  (ou le profil que tu utilises pour distribuer l’APK)
- Installe **ce nouvel** APK sur le téléphone (pas une vieille build).

## 3. Sur le téléphone Android

1. Ouvre l’app (**Krono client** ou **Krono pro**), connecte-toi.
2. Accepte les **notifications** quand le système demande (Android 13+ : permission explicite).
3. Optionnel : Réglages → Apps → l’app → Notifications = **activées**.

## 4. Vérifier que ça a marché

1. **Supabase** → table **`push_tokens`** : une ligne avec  
   `platform = android`, `app_role = client` ou `driver`, ton `user_id`.
2. Si toujours rien : regarder les logs **Metro** / **Logcat** au login :  
   - `registerPush: HTTP non OK` → problème **API** (JWT, RLS, table manquante — voir `docs/notifications-expo-token.md`)  
   - erreur autour de **`getExpoPushTokenAsync`** → presque toujours **FCM / EAS credentials** ou build trop ancien

## 5. Rappel

| Plateforme | Ce qui envoie vraiment la notif au téléphone |
|-------------|-----------------------------------------------|
| iOS         | APNs (géré par Expo si credentials Apple OK) |
| Android     | FCM (doit être configuré sur le projet Expo) |

Le backend envoie toujours vers **l’API Expo** ; si le téléphone n’a **pas de token** en base, il n’y a **personne** à cibler pour Android.
