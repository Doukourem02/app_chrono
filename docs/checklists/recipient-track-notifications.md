# Checklist — Suivi destinataire (lien /track), SMS, Web Push, push app

Trace pour la livraison de la fonctionnalité « payeur + destinataire » : notifications alignées, SMS sans compte, Web Push sur le lien, Expo inchangé pour les comptes liés.

## Prérequis & configuration

- [ ] `DATABASE_URL` défini (backend)
- [ ] Twilio SMS opérationnel pour l’OTP (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` ou `TWILIO_SMS_MESSAGING_SERVICE_SID`)
- [ ] Optionnel marque SMS : `TWILIO_SMS_BODY_BRAND=Krono` (ou équivalent)
- [ ] Web Push : `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT=mailto:…` (générer avec `npx web-push generate-vapid-keys`)
- [ ] `EXPO_ACCESS_TOKEN` si requis par ton projet Expo (push app existant)
- [ ] `ALLOWED_ORIGINS` inclut l’origine qui sert la page `/track` (POST subscribe + fetch API)

## Base de données

- [ ] Migration appliquée : `cd chrono_backend && npm run migrate:track-web-push`
- [ ] Vérifier présence table `track_web_push_subscriptions` (Supabase / psql)

## Déploiement backend

- [ ] Variables d’environnement chargées sur l’hôte (Render, VPS, etc.)
- [ ] Build / redémarrage après ajout de `web-push` (`npm install` déjà fait en repo)
- [ ] Aucune erreur au démarrage (logs `recipient-notify`, `web-push`, `expo-push`)

## Déploiement front (admin / page suivi)

- [ ] Déployer `admin_chrono` avec `public/sw.js` servi à la racine (`/sw.js`)
- [ ] HTTPS obligatoire pour le service worker et les push navigateur
- [ ] `config.apiUrl` pointe vers l’API utilisée en prod

## Tests manuels — destinataire **sans** compte Krono

- [ ] Créer une commande avec téléphone destinataire, **sans** `recipient_user_id`
- [ ] Chaque changement de statut pertinent envoie un **SMS** (si Twilio OK)
- [ ] Ouvrir le lien `/track/{token}` : frise d’étapes + rafraîchissement ~5 s
- [ ] Bouton « Activer les alertes navigateur » : permission accordée → inscription OK
- [ ] Changement de statut → **notification navigateur** reçue (Chrome desktop ou Android)
- [ ] Clic sur la notif → retour sur la page de suivi

## Tests manuels — destinataire **avec** compte (`recipient_user_id`)

- [ ] **Push Expo** reçu pour `picked_up`, `delivering`, `cancelled` (pas de SMS en doublon)
- [ ] Payeur reçoit toujours ses push (`accepted`, `enroute`, `completed`, `cancelled`)

## Tests manuels — payeur (app client)

- [ ] Push inchangés après livraison / annulation / scan QR → completed

## Régression & limites connues

- [ ] Web Push **iOS** : souvent réservé à une PWA installée ; SMS reste le filet de sécurité
- [ ] Si table `track_web_push_subscriptions` absente : logs d’erreur SQL → appliquer migration
- [ ] Si VAPID absent : `webPushAvailable: false`, pas de bouton ; SMS / Expo inchangés

## Références code (repères rapides)

| Sujet | Fichier |
|--------|---------|
| Orchestration notify | `chrono_backend/src/services/recipientOrderNotifyService.ts` |
| Expo | `chrono_backend/src/services/expoPushService.ts` |
| SMS transactionnel | `chrono_backend/src/services/twilioSmsService.ts` |
| Web Push | `chrono_backend/src/services/trackWebPushService.ts` |
| API track + subscribe | `chrono_backend/src/controllers/trackController.ts`, `routes/trackRoutes.ts` |
| UI suivi | `admin_chrono/app/track/[token]/page.tsx`, `admin_chrono/public/sw.js` |

---

*Pour les prochaines grosses features : copier ce fichier dans `docs/checklists/`, adapter le titre et les cases, garder la même structure (prérequis → DB → déploiement → tests → limites).*
