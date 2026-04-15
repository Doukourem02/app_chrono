# Checklist — Suivi destinataire (reste à faire)

**Déjà validé (ne plus recocher ici)** : push payeur ; destinataire **avec** compte Krono (Expo, pas de SMS en doublon) ; destinataire **sans** compte (SMS / suivi fonctionnels en test).

---

## À faire plus tard (détails produit & technique)

### Coûts des canaux « message sortant »

- **SMS (Twilio)** : facturé **par SMS** en production — chaque statut notifié par SMS = un coût.
- **WhatsApp Business API** : en général **payant** aussi (facturation Meta / conversations), ce n’est pas un remplacement « gratuit » du SMS à grande échelle.
- **Push Expo / compte** : pas de coût par message côté opérateur téléphonique (hors infra serveur / Expo).

### Alternative sans coût « par notification » pour ceux qui n’ont pas l’app Chrono

- **Pas de magie** : sans ouvrir un lien, pas de notifs navigateur.
- **Lien de suivi** : page du type `https://<PUBLIC_TRACK_BASE_URL>/track/<token>` (token lié à la commande). Le backend peut ajouter ce lien dans le SMS (variable `PUBLIC_TRACK_BASE_URL` côté serveur).
- **Web Push (navigateur)** : l’utilisateur ouvre le lien **une fois**, active **« Activer les alertes navigateur »** sur la page `/track`, puis reçoit les mises à jour **dans Chrome / Safari** sans installer Chrono — **sans facturation au message** comme le SMS (hors hébergement / certificats habituels).
- **Limite** : sur **iOS**, le Web Push est souvent limité (souvent mieux avec PWA installée) ; le SMS reste un filet si besoin.

### Backend (options déjà prévues ou à brancher)

- Couper les SMS destinataire statut par statut sans retirer le code : `DISABLE_RECIPIENT_ORDER_SMS=true` (voir `recipientOrderNotifyService.ts`).
- **Tap sur une notif** : ouvrir l’écran cible avec `data.orderId` / `data.trackUrl` (à finaliser côté apps si pas partout).
- **Migrations** : s’assurer que **025** (`recipient_user_id`) et **026** (dédup push statut) sont appliquées sur l’environnement de prod utilisé.

### Infra / QA si pas encore fait un jour

- Web Push : variables `WEB_PUSH_*`, table `track_web_push_subscriptions`, `admin_chrono` avec `sw.js` en HTTPS, `ALLOWED_ORIGINS` pour `/track`.
- **Observabilité** : logs quand `recipient_user_id` est auto-résolu ; traces des fallbacks SMS.

---

## Références code

| Sujet | Fichier |
|--------|---------|
| Orchestration notify | `chrono_backend/src/services/recipientOrderNotifyService.ts` |
| Expo | `chrono_backend/src/services/expoPushService.ts` |
| SMS transactionnel | `chrono_backend/src/services/twilioSmsService.ts` |
| Web Push | `chrono_backend/src/services/trackWebPushService.ts` |
| API track + subscribe | `chrono_backend/src/controllers/trackController.ts`, `routes/trackRoutes.ts` |
| UI suivi | `admin_chrono/app/track/[token]/page.tsx`, `admin_chrono/public/sw.js` |
