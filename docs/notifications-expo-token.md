# Notifications push & destinataire (référence unique)

Un seul fichier pour l’état, le livré récent, ce qui reste à valider, et le backlog « plus tard ».  
*(Migrations SQL : toujours `chrono_backend/migrations/README.md`.)*

---

## 1. Ce qui est en place (backend + apps)

- Tokens Expo via `POST /api/push/register` ; apps `app_chrono` / `driver_chrono` avec `expo-notifications` + canal Android.
- Envoi push : `chrono_backend/src/services/expoPushService.ts` ; `DeviceNotRegistered` → invalidation ligne en base.
- Résolution destinataire par téléphone au `saveOrder` → `recipient_user_id` si compte client unique (`phoneE164CI`, `resolveRecipientUserIdByPhone`, `orderStorage`).
- Push : `trackUrl` dans le body + `data` ; statuts destinataire : `accepted`, `enroute`, `picked_up`, `delivering`, `completed`, `cancelled`.
- Orchestration SMS / push / web : `recipientOrderNotifyService.ts` ; anti-doublon statut par commande si migration **026** appliquée (`order_status_push_sent`).

### Lot livré (sans enjeu SMS supplémentaire)

| Sujet | Détail |
|--------|--------|
| Tap notif + cold start | Client : `app_chrono/services/clientPushService.ts`, `app/_layout.tsx`. Livreur : `driver_chrono/services/driverPushService.ts`. Payload : `order_status`, `order_chat_message`, `trackUrl`. |
| Déconnexion | `unregister*` avant clear session : `useAuthStore` / `useDriverStore`. |
| Logs | Ex. destinataire avec compte → pas de SMS destinataire (log dans `recipientOrderNotifyService.ts`). |

---

## 2. Flux décisionnel (destinataire)

1. Numéro destinataire sur la commande.
2. Backend tente `recipient_user_id` (déjà en base ou résolution téléphone).
3. Compte trouvé → push app (pas de SMS obligatoire pour ce canal).
4. Pas de compte → fallback SMS / lien `/track` selon config (`PUBLIC_TRACK_BASE_URL`, Twilio, `DISABLE_RECIPIENT_ORDER_SMS`).

**Rappel** : le push part aux tokens d’un `user_id`, pas « au numéro » seul. Ambiguïté multi-comptes → pas d’attribution auto.

---

## 3. Reste à valider (terrain / manuel)

- Push réels sur appareil : payeur, destinataire inscrit, pas de doublon SMS si `recipient_user_id` présent.
- Migrations **025** / **026** : requêtes de contrôle dans `chrono_backend/migrations/README.md` (*Vérifier rapidement que 025 et 026…*).

---

## 4. Plus tard (budget / produit / infra lourde)

- Coûts **SMS** (Twilio) et options **WhatsApp** ; politique fine (`DISABLE_RECIPIENT_ORDER_SMS`, etc.).
- **Sans compte Chrono** : lien `/track` ; **Web Push** navigateur (`WEB_PUSH_*`, `admin_chrono`, `sw.js`, HTTPS) — voir `trackWebPushService.ts`, `trackController`.

---

## 5. Références code

| Sujet | Fichier |
|--------|---------|
| Notify orchestration | `chrono_backend/src/services/recipientOrderNotifyService.ts` |
| Expo push | `chrono_backend/src/services/expoPushService.ts` |
| SMS | `chrono_backend/src/services/twilioSmsService.ts` |
| Web Push | `chrono_backend/src/services/trackWebPushService.ts` |
| Track API | `chrono_backend/src/controllers/trackController.ts`, `routes/trackRoutes.ts` |
| UI `/track` | `admin_chrono/app/track/[token]/page.tsx`, `admin_chrono/public/sw.js` |
| Tap push client | `app_chrono/services/clientPushService.ts` |
| Tap push livreur | `driver_chrono/services/driverPushService.ts` |
| Résolution téléphone | `chrono_backend/src/utils/resolveRecipientUserIdByPhone.ts`, `phoneE164CI.ts` |
| Persistance commande | `chrono_backend/src/config/orderStorage.ts` |

---

*Mettre à jour ce fichier seulement quand le comportement prod change ou qu’un nouveau lot est livré — éviter de multiplier les docs du même sujet.*
