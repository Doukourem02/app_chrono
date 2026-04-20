# Krono — référence unique projet

Ce fichier est la **mémoire courte du projet**.
Il ne sert pas à suivre les tâches à faire : les actions sont dans `docs/checklist-fonctionnalites-app.md`.

Règle :

- Si c’est une tâche à exécuter, elle va dans la checklist.
- Si c’est une décision produit, une carte de fichiers ou une règle à retenir, elle reste ici.

---

## 1. Carte rapide des fichiers utiles

### App client

| Sujet | Fichier |
|-------|---------|
| Live Activity / Dynamic Island | `app_chrono/services/orderLiveActivity.ts` |
| UI Dynamic Island SwiftUI/Expo UI | `app_chrono/widgets/orderTrackingLiveActivity.tsx` |
| Sync Live Activity depuis le store | `app_chrono/hooks/useOrderLiveActivitySync.ts` |
| Socket commande client | `app_chrono/services/userOrderSocketService.ts` |
| Push client / tap notification | `app_chrono/services/clientPushService.ts` |
| Notification Android foreground service client | `app_chrono/services/clientBackgroundLocation.ts` |
| Écran suivi commande | `app_chrono/app/order-tracking/[orderId].tsx` |
| Auth client | `app_chrono/store/useAuthStore.ts` |
| Refresh token client | `app_chrono/utils/secureTokenStorage.ts` |

### App chauffeur

| Sujet | Fichier |
|-------|---------|
| Push chauffeur / tap notification | `driver_chrono/services/driverPushService.ts` |
| Notification Android foreground service chauffeur | `driver_chrono/services/driverBackgroundLocation.ts` |
| Auth chauffeur | `driver_chrono/store/useDriverStore.ts` |
| Sockets commandes | `driver_chrono/services/orderSocketService.ts` |
| Sockets messages | `driver_chrono/services/driverMessageSocketService.ts` |
| Dépannage app chauffeur | `driver_chrono/docs/TROUBLESHOOTING.md` |

### Backend

| Sujet | Fichier |
|-------|---------|
| Socket commande | `chrono_backend/src/sockets/orderSocket.ts` |
| Push Expo | `chrono_backend/src/services/expoPushService.ts` |
| Notifications destinataire | `chrono_backend/src/services/recipientOrderNotifyService.ts` |
| SMS Twilio | `chrono_backend/src/services/twilioSmsService.ts` |
| Track public | `chrono_backend/src/controllers/trackController.ts`, `routes/trackRoutes.ts` |
| Prix livraison | `chrono_backend/src/services/priceCalculator.ts` |
| Tarification dynamique | `chrono_backend/src/services/dynamicPricing.ts` |
| QR livraison | `chrono_backend/src/services/qrCodeService.ts` |
| Commission livreur | `chrono_backend/src/services/commissionService.ts` |

### Admin / web

| Sujet | Fichier |
|-------|---------|
| Page tracking public | `admin_chrono/app/track/[token]/page.tsx` |
| Web push tracking | `admin_chrono/public/sw.js` |

---

## 2. Dynamic Island / Live Activity — décisions produit

Objectif : raconter une commande en cours de façon simple, utile et élégante.

### États visibles côté client

| État commande | Message principal | Support système attendu |
|---------------|-------------------|-------------------------|
| `pending` / recherche | `Recherche` / `Recherche livreur` | Dynamic Island compact + lock screen sans ETA |
| livreur accepté / vers pickup | `Prise en charge dans X min` | Live Activity avec véhicule, plaque, avatar, progression |
| colis récupéré / livraison | `Livraison dans X min` ou `En livraison` | Même composant, progression vers destination |
| terminé | `Livraison terminée` | Fin propre de l’activité + notification seulement si utile |
| annulé / aucun livreur | Message explicite | Fin activité + push classique si l’utilisateur doit agir |

### Règles UX

- Une commande suivie doit avoir une seule représentation système active côté client.
- L’îlot ne doit pas devenir une fiche contact livreur.
- Priorité d’affichage : état immédiat, minutes, véhicule, plaque, progression.
- Le texte visible côté client doit rester en français.
- La couleur de marque est le violet Krono, pas l’orange.
- `ETA` est un terme technique interne : il ne doit pas être affiché à l’utilisateur.
- Pendant `pending`, on affiche `Recherche`, pas un temps estimé.
- Si la Live Activity est impossible ou désactivée, les notifications classiques deviennent le fallback.
- Android a déjà une base foreground service pour le suivi en arrière-plan ; le reste est de l’enrichir avec statut, ETA, actions et arrêt propre.

---

## 3. Notifications push — comportement retenu

### Ce qui existe

- Tokens Expo via `POST /api/push/register`.
- Apps `app_chrono` / `driver_chrono` avec `expo-notifications`.
- Envoi backend via `chrono_backend/src/services/expoPushService.ts`.
- `DeviceNotRegistered` invalide la ligne en base.
- Tap notification client : `app_chrono/services/clientPushService.ts`.
- Tap notification chauffeur : `driver_chrono/services/driverPushService.ts`.
- Résolution destinataire par téléphone : `recipient_user_id` si compte client unique.
- Anti-doublon statut par commande : `order_status_push_sent` si migration `026` appliquée.

### Règle anti-spam

- Si une Live Activity active affiche déjà un statut non critique, éviter une push classique identique.
- Garder les push classiques pour : annulation, aucun livreur, livraison terminée si app absente, message livreur, problème paiement.
- Si Live Activity absente / refusée / fermée, reprendre le canal push classique pour les statuts importants.

### Flux destinataire

1. Numéro destinataire sur la commande.
2. Backend tente `recipient_user_id`.
3. Compte trouvé : push app.
4. Pas de compte : fallback SMS / lien `/track` selon config.

Rappel : le push part aux tokens d’un `user_id`, pas à un numéro seul.

---

## 4. Prod / TestFlight — rappels essentiels

Le build EAS production ne lit pas le `.env` local.
Toutes les variables utiles doivent être dans l’environnement EAS `production`.

Variables à vérifier :

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `EXPO_PUBLIC_LEGAL_CGU_URL`
- `EXPO_PUBLIC_LEGAL_PRIVACY_URL`
- `EXPO_PUBLIC_SENTRY_DSN`
- variables Sentry build si upload sourcemaps activé

Smoke tests prod :

- API : `GET https://api.kro-no-delivery.com/health`
- API : `GET https://api.kro-no-delivery.com/health/live`
- Admin : `https://admin.kro-no-delivery.com`
- iPhone réel : login, commande, carte Mapbox, sockets, Live Activity.
- Android réel : login, commande, carte, sockets, push.

---

## 5. Pricing, paiements, QR

### Déjà en place

| Thème | Côté code |
|-------|-----------|
| Prix unifiés, base + km, options vitesse | `chrono_backend/src/services/priceCalculator.ts`, `app_chrono/services/orderApi.ts` |
| Distance / durée route Mapbox, fallback Haversine | `app_chrono/utils/mapboxDirections.ts`, `useMapLogic.ts` |
| Tarification dynamique météo / surge / heure / trafic | `chrono_backend/src/services/dynamicPricing.ts`, `openMeteoPricing.ts`, `surgePricing.ts` |
| Transparence route / ligne droite | `app_chrono/utils/routePricingLabels.ts` |

### Paiement et QR

- QR de livraison = preuve de remise, pas QR de paiement opérateur.
- Un QR par commande.
- Mode de paiement choisi par le commanditaire.
- Différé / reliquat réglés dans l’app sur `order_id`.
- Migration `022` : index unique `(order_id, scanned_by)` sur `qr_code_scans`.
- `QR_CODE_SECRET` doit être identique sur toutes les instances backend prod.

### PSP plus tard

Travail hors code en premier :

- Compte marchand / agrégateur pour Orange Money, Wave, MTN.
- Clés API sandbox puis production.
- Webhooks signés, retries, idempotence.
- KYC, litiges, remboursements.
- Branchement backend : `paymentController`, `commissionController`, transactions.

---

## 6. Migrations importantes

| Migration | Sujet |
|----------|-------|
| `023_create_push_tokens.sql` | `push_tokens` Expo push client / driver |
| `024_users_name_avatar_columns.sql` | `users.first_name`, `last_name`, `avatar_url` |
| `025_orders_recipient_user_id.sql` | lien compte destinataire |
| `026_order_status_push_dedup.sql` | anti-doublon notifications par `(order_id, status)` |

Migrations SQL : voir `chrono_backend/migrations/README.md`.

---

## 7. Décisions encore ouvertes

- Plusieurs commandes actives : commande sélectionnée, plus récente, ou priorité statut métier.
- APNs Live Activity : fréquence maximale des updates backend.
- Notifications : liste exacte des statuts qui doivent vibrer / sonner.
- Android : enrichissement de la base foreground service existante avec statut, ETA, actions et arrêt propre.
- Notifications périodiques : quels rappels sont utiles, lesquels seraient perçus comme du spam.
- Widgets écran d’accueil : choisir les données visibles sans exposer trop d’informations privées.
- Rétention : niveau acceptable de gamification et de messages d’engagement.
- Paiement : choix PSP direct opérateur ou agrégateur.
- QR : scan obligatoire avant `completed` ou seulement preuve complémentaire.

---

## 8. Vision app mature

Une application Krono mature ne doit pas seulement suivre une livraison. Elle doit donner confiance, rester utile sans être lourde, et créer une impression premium.

### Notifications intelligentes

- Les notifications doivent être utiles, actionnables et annulables.
- Les rappels périodiques doivent être rares et justifiés : dette/reliquat, récap accepté, note à laisser, mission chauffeur.
- Les notifications marketing doivent être désactivables et séparées des notifications opérationnelles.

### Widgets écran d’accueil

- Client : commande active, ETA, raccourci suivi, nouvelle livraison.
- Chauffeur : disponibilité, course active, revenus du jour.
- Les widgets doivent avoir de beaux états vides, sinon ils donnent une impression d’application inachevée.

### Attractivité

- Onboarding clair et rassurant.
- Fin de commande soignée : résumé, note, support, nouvelle livraison.
- Historique lisible et valorisant.
- Micro-interactions discrètes, jamais gratuites.
- Gamification chauffeur utile : objectifs, revenus, badges, mais sans infantiliser.

---

## 9. Documents vivants

Il ne doit rester que deux fichiers principaux dans `docs/` :

- `docs/checklist-fonctionnalites-app.md` : actions à exécuter, priorisées.
- `docs/krono-reference-unique.md` : référence projet, décisions, cartes de fichiers.
