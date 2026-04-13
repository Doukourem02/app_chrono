# Checklist — Push Android (Krono client / livreur) : FCM + `push_tokens`

Si dans Supabase **`push_tokens`** tu ne vois que des lignes **`platform = ios`**, l’app **Android** n’a jamais réussi à obtenir un token Expo **ou** l’API **`POST /api/push/register`** a échoué.

**Référence officielle** : [FCM credentials (Expo)](https://docs.expo.dev/push-notifications/fcm-credentials/)

---

## A. Identifiants à ne pas confondre

| App | Dossier | Slug Expo | `android.package` | `extra.eas.projectId` (dans `app.config.js`) |
|-----|---------|-----------|-------------------|-----------------------------------------------|
| Client | `app_chrono` | `app_chrono` | `com.anonymous.app_chrono` | `02928131-25c4-40be-9a4c-77f251406a82` |
| Livreur | `driver_chrono` | `driver_chrono` | `com.anonymous.driver_chrono` | `9618f8cb-2c98-4b1c-b50c-9f24fe1a2526` |

Chaque **projet Expo** doit avoir **ses propres** credentials FCM (upload du JSON compte de service sur **les deux** si tu publies les deux apps Android).

---

## B. Firebase (une fois par app Android)

Tu peux utiliser **un seul projet Firebase** avec **deux applications Android** (une par package).

1. [Firebase Console](https://console.firebase.google.com/) → créer ou ouvrir un projet.
2. Ajouter une app **Android** :
   - **Client** : nom au choix, package **`com.anonymous.app_chrono`**.
   - **Livreur** : deuxième app Android, package **`com.anonymous.driver_chrono`**.
3. Pour **chaque** app : télécharger **`google-services.json`**.
4. Placer le fichier au **bon endroit** :
   - Client : `app_chrono/google-services.json` (celui qui correspond au package client).
   - Livreur : `driver_chrono/google-services.json` (celui qui correspond au package livreur).

Dans le repo, `app.config.js` active automatiquement `android.googleServicesFile` **si** `google-services.json` est présent à la racine du dossier de l’app (voir `app_chrono/app.config.js` et `driver_chrono/app.config.js`).

> `google-services.json` contient surtout des identifiants « publics » côté client ; beaucoup d’équipes le commitent. En revanche **ne commite jamais** le JSON **clé privée** du compte de service (voir `.gitignore` : `firebase-adminsdk*.json`).

---

## C. Clé compte de service (FCM V1) → EAS

Expo envoie les push Android via **FCM V1** ; il faut uploader une **Google Service Account Key** (JSON) vers **EAS**, pas seulement le `google-services.json`.

1. Firebase → **Project settings** → **Service accounts**.
2. **Generate new private key** → tu obtiens un fichier du type `…-firebase-adminsdk-….json`.
3. **Ne pas** le mettre dans Git (déjà ignoré par pattern dans `app_chrono` / `driver_chrono`).

### Upload via EAS CLI (à refaire pour chaque projet Expo si besoin)

Depuis la machine où est le JSON :

```bash
cd app_chrono   # ou driver_chrono
eas credentials
```

Puis, selon les invites du CLI (texte peut varier légèrement) :

- **Android** → profil **`production`** (ou celui que tu utilises pour l’APK) → **Google Service Account**
- **Manage … Push Notifications (FCM V1)** → **Set up** / **Upload a new service account key** → choisir le JSON.

Répéter depuis **`driver_chrono`** avec le même projet Firebase si les deux apps Android y sont enregistrées (une seule clé admin Firebase peut suffire pour les deux packages, mais **deux uploads** si EAS le demande par projet Expo).

### Rôle IAM (si tu réutilises une vieille clé)

Dans Google Cloud **IAM**, le compte de service doit pouvoir utiliser la messagerie FCM — la doc Expo indique notamment le rôle **Firebase Messaging API Admin** si besoin.

---

## D. Build et installation

Les credentials FCM sont pris en compte au **build** EAS.

```bash
cd app_chrono   # ou driver_chrono
eas build -p android --profile production
```

Installer **le nouvel** APK sur l’appareil (les anciens builds sans FCM / sans `google-services.json` ne suffisent pas).

---

## E. Sur le téléphone

1. Ouvre l’app, **connecte-toi**.
2. Accepte les **notifications** (Android 13+ : permission système).
3. Optionnel : Réglages → App → Notifications = activées.

---

## F. Vérifications

1. **Supabase** → `push_tokens` : au moins une ligne avec `platform = android`, `app_role` = `client` ou `driver`, ton `user_id`.
2. Si rien : **Metro / Logcat** au moment du login :
   - `registerPush: HTTP non OK` → API / JWT / DB / RLS → `docs/notifications-expo-token.md` et migration **`chrono_backend/migrations/023_create_push_tokens.sql`**.
   - Erreur **`getExpoPushTokenAsync`** → FCM / EAS / `google-services.json` / **rebuild**.

---

## G. Rappel

| Plateforme | Canal jusqu’au téléphone |
|------------|---------------------------|
| iOS | APNs (Expo) |
| Android | FCM (Expo) — **obligatoire** côté Firebase + EAS |

Sans token en base, le backend ne peut pas cibler l’appareil, même si l’envoi Expo est correct.
