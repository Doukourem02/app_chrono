# Notifications push — Expo, tokens et backend (PROJET_CHRONO)

**Rôle de ce fichier** : feuille de route partagée pour intégrer les **notifications push** (client + livreur), les **Expo push tokens**, et l’**envoi côté backend** quand une commande est **acceptée**, **en route** ou **terminée**. À lire avant d’implémenter.

**Contexte repo** :

| Zone | Dossier |
|------|---------|
| App client | `app_chrono` |
| App livreur | `driver_chrono` |
| API / Socket / logique métier | `chrono_backend` |

**Tests** : tu installes déjà les builds sur **ton iPhone** via **TestFlight** — c’est le bon setup pour valider les push (voir § Simulator ci‑dessous).

---

## 1. Pourquoi Expo Push (et pas APNs/FCM « à la main » dans l’app)

- L’app obtient un **`ExpoPushToken`** via `expo-notifications`.
- Le **backend** envoie les messages à l’**Expo Push API** ; Expo relaie vers **APNs** (iOS) et **FCM** (Android).
- **App fermée** : le système affiche la notification comme pour n’importe quelle app native, tant que les **credentials** (Apple + Google) sont correctement configurés dans **EAS**.

La complexité est surtout **comptes Apple / Google**, **EAS**, **secrets** — pas sur une couche réseau custom dans l’app.

---

## 2. Simulator iOS vs TestFlight / device réel

- **Simulator iOS** : les **push distants sont très limités** (souvent inutilisables pour un vrai parcours). Ne pas s’y fier pour valider la chaîne.
- **TestFlight + iPhone** : c’est la **référence** pour ce projet : même binaire que la prod, APNs de prod, comportement réel en arrière-plan / app tuée.

Garde aussi un **Android physique** si tu publies le livreur ou le client sur le Play Store — mêmes idées (permission, canaux, FCM via Expo).

---

## 3. Notifications « essentielles » (première itération)

| Événement métier | Destinataire typique | Exemple de contenu | Données utiles (`data`) |
|------------------|----------------------|--------------------|-------------------------|
| Commande **acceptée** | Client | Titre court + « Votre course est acceptée » | `type`, `orderId`, écran cible |
| Chauffeur **en route** | Client | « Votre livreur est en route » | idem |
| Livraison **terminée** | Client | « Livraison terminée » | idem (+ éventuellement lien notation) |

**À décider avant code** : est-ce que le **livreur** reçoit aussi des push dans cette phase (ex. nouvelle demande) — ici on se concentre sur le **client** pour ces trois états.

**Règles produit** :

- **Une notification par transition** utile (éviter les doublons : idempotence ou log « déjà notifié pour ce statut » côté backend).
- **Opt-in** : si l’utilisateur refuse la permission, ne pas enregistrer de token (ou marquer `notifications_enabled = false`).
- **Multi-appareils** : plusieurs tokens par utilisateur (téléphone + tablette).
- **Déconnexion** : supprimer ou invalider les tokens du compte.

---

## 4. Checklist comptes et outils

| Étape | Outil / lieu |
|-------|----------------|
| Projet Expo | Dashboard Expo (slug / `projectId` alignés avec `app.config` / EAS) |
| Builds signés | **EAS Build** (`eas build`) |
| iOS push | Compte **Apple Developer** ; capability **Push Notifications** ; credentials gérés par **EAS** (`eas credentials`) |
| Android push | **FCM** lié au projet (selon la doc Expo en vigueur — clé serveur / FCM v1) |
| Secrets | **EAS Secrets** pour tout ce qui ne doit pas être dans Git ; variables d’environnement **chrono_backend** pour `EXPO_ACCESS_TOKEN` si tu utilises l’API Expo authentifiée (recommandé en prod) |
| Distribution test | **TestFlight** (déjà utilisé) |

**Packages côté apps** : `expo-notifications` (+ config plugin dans `app.json` / `app.config.js`).

---

## 5. Côté applications (`app_chrono` / `driver_chrono`)

À implémenter quand on passera au code :

1. **Permission** : demander l’autorisation au bon moment (souvent après login ou premier écran pertinent).
2. **Obtenir le token** : `getExpoPushTokenAsync` (ou équivalent selon la doc Expo de ta SDK).
3. **Canal Android** : créer un canal par défaut (Android 8+) pour un comportement prévisible.
4. **Enregistrer sur le backend** : `POST` authentifié avec `{ expoPushToken, platform, app: 'client' | 'driver' }` (+ éventuellement `deviceId` stable).
5. **Refresh** : si le token change, renvoyer au backend (listener / au prochain cold start).
6. **Réception** :
   - **Premier plan** : handler pour afficher une bannière in-app ou silencieux selon choix produit.
   - **Tap sur la notification** : lire `data.orderId` (etc.) et **router** (Expo Router : écran suivi commande).
7. **Logout** : appeler un endpoint `DELETE` (ou `POST` unregister) pour retirer le token.

Fichiers probables : `app/_layout.tsx` ou un hook dédié `usePushNotifications.ts`, + appel depuis le service API existant (`userApiService` / `apiService`).

---

## 6. Côté backend (`chrono_backend`)

À implémenter :

1. **Table** (exemple) : `push_tokens` — `user_id`, `expo_push_token`, `platform`, `app_role`, `created_at`, `updated_at`, `invalidated_at`.
2. **Routes** :
   - `POST /api/.../push/register` (JWT) — upsert par `(user_id, token)` ou `(user_id, device_id)`.
   - `DELETE /api/.../push/register` ou par token — à la déconnexion.
3. **Envoi** : après mise à jour **fiable** du statut commande (acceptée / en route / terminée), construire le message Expo :

   - `to`: token(s) du **client** concerné,
   - `title` / `body`,
   - `data`: `{ type, orderId, ... }` pour le deep link,
   - options Android (`channelId`, `priority`) si besoin.

4. **API Expo** : `POST https://exp.host/--/api/v2/push/send` (ou SDK Node officiel), avec en-tête **`Authorization: Bearer <EXPO_ACCESS_TOKEN>`** en production si requis par ta config.

5. **Erreurs** : si Expo indique **DeviceNotRegistered** (ou équivalent), **marquer le token invalide** en base pour ne pas réessayer en boucle.

6. **Performance** : optionnel — mettre l’envoi dans une **file** (job async) pour ne pas bloquer la requête HTTP du changement de statut.

Point d’accroche code : là où tu émets déjà les événements Socket / mets à jour la commande en base — **même endroit** (ou listener d’événement domaine) pour déclencher le push.

---

## 7. Sécurité et contenu

- Éviter les **données sensibles** dans le `body` visible sur l’écran de verrouillage ; détails dans `data` et chargement après ouverture app si nécessaire.
- Alignement **RGPD** : finalité des notifs, préférences utilisateur si tu étends plus tard.

---

## 8. Plan d’implémentation suggéré (ordre)

1. Config **EAS** + **push** iOS (TestFlight) pour **une** app (ex. client).
2. Backend : table + `register` + **script de test** qui envoie un push de démo à ton token (depuis ton Mac ou le serveur).
3. `app_chrono` : permission + token + register après login.
4. Brancher les **trois événements** métier côté backend.
5. Deep link + test **app tuée** sur iPhone (TestFlight).
6. Répéter pour `driver_chrono` si besoin (token séparé, `app_role: driver`).

---

## 9. Liens utiles (à ouvrir au moment de l’implémentation)

- Documentation Expo : *Push notifications* (guide officiel, aligné sur ta version de SDK Expo).
- EAS : *Build*, *Submit*, *Using push notifications*.

---

## 10. Croisement avec le reste de la doc

- **Auth / cycle de vie** : `docs/mobile-auth-and-lifecycle.md` (session, premier plan, sockets). Les push sont **complémentaires** : quand l’app est fermée, le socket ne tourne pas — le push sert de **réveil** ; la vérité reste **API** + resync à l’ouverture.
- **Prod / qualité** : `docs/ckprod.md` pour le contexte déploiement.

---

*Document rédigé pour travailler ensemble sur PROJET_CHRONO ; à mettre à jour au fil des choix produit (livreur, préférences, langues, etc.).*
