# Krono — référence unique projet

Ce fichier est la **mémoire courte du projet** et le **contrat produit Krono**.
Il ne sert pas à suivre les tâches à faire : les actions restent dans `docs/checklist-fonctionnalites-app.md`.

Ce document répond à une question : **qu'est-ce que Krono doit faire, afficher, notifier, calculer et protéger à chaque étape d'une livraison ?**

Règle :

- Si c'est une tâche à exécuter, elle va dans la checklist.
- Si c'est une décision produit, une carte de fichiers ou une règle à retenir, elle reste ici.
- Si le code contredit ce document, le comportement produit attendu est celui décrit ici.
- Si une décision n'est pas tranchée, elle doit apparaître dans la section "Décisions encore ouvertes".

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

## 2. Cycle officiel d'une commande

Une commande Krono doit rester lisible pour trois publics : **client**, **chauffeur** et **destinataire**.
La question principale est toujours : **où est mon colis, qui s'en occupe, dans combien de temps, et que dois-je faire ?**

| Étape produit | Statuts techniques typiques | Client | Chauffeur | Dynamic Island / Live Activity | Notification | Temps affiché | Passage suivant |
|---------------|-----------------------------|--------|-----------|--------------------------------|--------------|---------------|-----------------|
| Recherche livreur | `pending` | `Recherche livreur` ou `Recherche` | N/A | Compact/lock screen sans temps | Push seulement si attente longue, échec ou aucun livreur | Aucun temps | Un chauffeur accepte |
| Livreur accepté / vers collecte | `accepted`, `enroute` | `Prise en charge dans X min` | Mission acceptée, aller au point de collecte | Avatar, véhicule, plaque, progression vers collecte | Push client utile une seule fois, puis Live Activity prend le relais | Chauffeur -> point de collecte | Chauffeur arrive ou confirme présence |
| Arrivé collecte | `in_progress`, `arrived`, `at_pickup` | `Livreur arrivé` ou `Prise en charge dans 1 min` | Récupérer / vérifier le colis | Avatar + indicateur d'arrivée, sans libellé vague | Silencieux sauf action nécessaire | `1 min` si un temps est requis | Colis marqué récupéré |
| Colis récupéré | `picked_up` | `Livraison dans X min` | Aller vers destination | Même composant, progression recalibrée vers destination | Push court possible : `Colis récupéré` | Point de collecte ou position livreur -> destination | Chauffeur se rapproche / arrive |
| Vers livraison | `delivering` | `Livraison dans X min` | Continuer vers destinataire | Minutes + progression vers destination | Pas de push répétée si Live Activity active | Position livreur -> destination | Arrivé destination |
| Arrivé destination | `at_dropoff`, `arrived_dropoff` | `Livreur arrivé` ou `Livraison dans 1 min` | Remettre le colis, scanner QR si requis | Avatar + indicateur d'arrivée | Push si le destinataire doit agir | `1 min` si un temps est requis | QR scanné / remise confirmée |
| Terminé | `completed` | `Livraison terminée` | Mission terminée, commission comptabilisée | Fin propre de l'activité | Push seulement si app absente ou récap utile | Aucun temps | Historique / note / support |
| Annulé / aucun livreur | `cancelled`, `declined`, `no_driver` | Message explicite et action possible | Mission retirée ou indisponible | Fin propre de l'activité | Push critique | Aucun temps | Nouvelle tentative, support ou remboursement |

Règles générales :

- Une commande suivie doit avoir une seule représentation système active côté client.
- L'étape visible doit suivre la réalité métier, pas seulement un libellé technique.
- Le client ne doit jamais avoir à deviner si le livreur va chercher le colis ou va le livrer.
- Le destinataire ne voit que ce qui l'aide à recevoir le colis.

---

## 3. Règles de temps et progression

Le terme technique `ETA` peut exister dans le code, les logs et les discussions internes.
Il ne doit pas être affiché comme mot à l'utilisateur.

Règles produit :

- Pendant `pending`, on affiche `Recherche`, pas un temps estimé.
- Avant récupération du colis, le temps affiché correspond au trajet **livreur -> point de collecte**.
- Après récupération du colis, le temps affiché correspond au trajet **position livreur ou point de collecte -> destination**.
- Quand un temps fiable existe, afficher `X min`, `Prise en charge dans X min` ou `Livraison dans X min`.
- Ne pas afficher de libellé vague côté client comme `Route` ou `En route` lorsqu'un temps peut être affiché.
- Si le temps est inconnu mais que la commande est active, utiliser un fallback court et clair, par exemple `1 min` uniquement si l'état le justifie.
- La progression visuelle doit être cohérente avec le temps : une barre presque pleine ne doit pas annoncer `5 min` si le livreur est déjà à proximité.

Priorité des calculs :

1. Route temps réel / Mapbox si disponible.
2. Distance route stockée avec durée connue.
3. Fallback Haversine + vitesse moyenne adaptée au type de véhicule.
4. Fallback produit court si aucune coordonnée fiable n'est disponible.

---

## 4. Dynamic Island / Live Activity — décisions produit

Objectif : raconter une commande en cours de façon simple, utile et élégante.

### États visibles côté client

| État commande | Message principal | Support système attendu |
|---------------|-------------------|-------------------------|
| `pending` / recherche | `Recherche` / `Recherche livreur` | Dynamic Island compact + lock screen sans temps |
| livreur accepté / vers collecte | `Prise en charge dans X min` | Live Activity avec véhicule, plaque, avatar, progression |
| colis récupéré / livraison | `Livraison dans X min` | Même composant, progression vers destination |
| terminé | `Livraison terminée` | Fin propre de l'activité + notification seulement si utile |
| annulé / aucun livreur | Message explicite | Fin activité + push classique si l'utilisateur doit agir |

### Règles UX

- Priorité d'affichage : état immédiat, minutes, véhicule, plaque, progression.
- Le texte visible côté client doit rester en français.
- La couleur de marque est le violet Krono.
- L'îlot ne doit pas devenir une fiche contact livreur.
- L'avatar livreur est attendu dès qu'un livreur est connu.
- Si la Live Activity est impossible, refusée ou fermée, les notifications classiques deviennent le fallback.
- Android a une base foreground service pour le suivi en arrière-plan ; elle doit respecter les mêmes messages produit.

---

## 5. Source de vérité des données

Les mêmes informations doivent alimenter l'écran suivi, les sockets, les push, la Live Activity et le tracking public.
Un champ visible dans une surface ne doit pas disparaître dans une autre surface sans raison produit.

| Donnée | Source prioritaire | Fallback accepté | Surfaces concernées |
|--------|--------------------|------------------|---------------------|
| Avatar livreur | `users.avatar_url` | `profile_image_url`, autre champ historique, initiales | Suivi client, Live Activity, tracking si autorisé |
| Nom livreur | `users.first_name`, `users.last_name` | nom composé ou libellé Krono | Suivi client, chauffeur, support |
| Téléphone livreur | champ téléphone utilisateur/chauffeur | aucun affichage si absent | App client, appel/SMS si autorisé |
| Véhicule | type, marque, modèle, couleur | type véhicule générique | Suivi, Live Activity, notifications |
| Plaque | plaque chauffeur | `KRONO` uniquement si plaque absente | Suivi, Live Activity |
| Position | socket temps réel | dernière position serveur connue | Carte, temps, progression |
| Destinataire | commande + `recipient_user_id` si résolu | lien tracking / SMS | Tracking public, push destinataire |

Règles :

- `users.avatar_url` est la source principale de la photo de profil.
- Les fallbacks doivent être identiques entre app, backend et Live Activity.
- Les données personnelles ne sont affichées que si elles servent l'action de livraison.
- Le tracking public ne doit pas exposer plus d'informations que nécessaire.

---

## 6. Notifications push — comportement retenu

### Ce qui existe

- Tokens Expo via `POST /api/push/register`.
- Apps `app_chrono` / `driver_chrono` avec `expo-notifications`.
- Envoi backend via `chrono_backend/src/services/expoPushService.ts`.
- `DeviceNotRegistered` invalide la ligne en base.
- Tap notification client : `app_chrono/services/clientPushService.ts`.
- Tap notification chauffeur : `driver_chrono/services/driverPushService.ts`.
- Résolution destinataire par téléphone : `recipient_user_id` si compte client unique.
- Anti-doublon statut par commande : `order_status_push_sent` si migration `026` appliquée.

### Types de notifications

| Type | Exemple | Règle |
|------|---------|-------|
| Opérationnelle | livreur accepté, colis récupéré | Envoyer une seule fois si utile |
| Critique | annulation, aucun livreur, problème paiement | Toujours privilégier une push claire |
| Silencieuse / système | refresh statut, update Live Activity | Ne pas déranger l'utilisateur |
| Marketing / engagement | promo, retour app, note | Désactivable et séparée des notifications de livraison |

### Règle anti-spam

- Si une Live Activity active affiche déjà un statut non critique, éviter une push classique identique.
- Garder les push classiques pour : annulation, aucun livreur, livraison terminée si app absente, message livreur, problème paiement.
- Si Live Activity absente / refusée / fermée, reprendre le canal push classique pour les statuts importants.
- Ne pas répéter une notification de statut déjà envoyée pour la même commande.

### Flux destinataire

1. Numéro destinataire sur la commande.
2. Backend tente `recipient_user_id`.
3. Compte trouvé : push app.
4. Pas de compte : fallback SMS / lien `/track` selon config.

Rappel : le push part aux tokens d'un `user_id`, pas à un numéro seul.

---

## 7. Paiement, commission, reliquat

Objectif : le client doit comprendre ce qu'il paie, le chauffeur doit comprendre ce qu'il gagne, et Krono doit garder une trace fiable.

Règles produit :

- Le mode de paiement est choisi par le commanditaire de la livraison.
- Le prix affiché à la validation doit être le prix de référence de la commande.
- Si un supplément apparaît après validation, il doit être rattaché à `order_id` et expliqué clairement.
- Un reliquat doit rester visible jusqu'à règlement ou résolution support.
- La commission chauffeur dépend de la commande terminée et des règles backend, pas d'un affichage client.
- Les remboursements, litiges et annulations doivent être traités comme événements financiers traçables.

### PSP mobile money plus tard

Travail hors code en premier :

- Compte marchand / agrégateur pour Orange Money, Wave, MTN.
- Clés API sandbox puis production.
- Webhooks signés, retries, idempotence.
- KYC, litiges, remboursements.
- Branchement backend : `paymentController`, `commissionController`, transactions.

---

## 8. QR et preuve de livraison

Le QR de livraison est une **preuve de remise**, pas un QR de paiement opérateur.

Règles :

- Un QR par commande.
- Le QR est la preuve principale de remise quand le parcours le permet.
- Le scan doit être rattaché à la commande, au livreur et à l'heure.
- Si le QR ne fonctionne pas, un fallback manuel doit être documenté dans le parcours support.
- En cas de litige, les preuves utiles sont : statut commande, scan QR, position, horodatage, identité livreur, confirmation destinataire et support.
- Migration `022` : index unique `(order_id, scanned_by)` sur `qr_code_scans`.
- `QR_CODE_SECRET` doit être identique sur toutes les instances backend prod.

Décision ouverte : scan obligatoire avant `completed` ou preuve complémentaire seulement.

---

## 9. Pricing

### Déjà en place

| Thème | Côté code |
|-------|-----------|
| Prix unifiés, base + km, options vitesse | `chrono_backend/src/services/priceCalculator.ts`, `app_chrono/services/orderApi.ts` |
| Distance / durée route Mapbox, fallback Haversine | `app_chrono/utils/mapboxDirections.ts`, `useMapLogic.ts` |
| Tarification dynamique météo / surge / heure / trafic | `chrono_backend/src/services/dynamicPricing.ts`, `openMeteoPricing.ts`, `surgePricing.ts` |
| Transparence route / ligne droite | `app_chrono/utils/routePricingLabels.ts` |

Règles :

- Le prix doit rester explicable : base, distance, option, majoration éventuelle.
- La distance route est préférable à la ligne droite quand elle est disponible.
- Si un fallback est utilisé, l'interface doit rester honnête sans exposer trop de détail technique.

---

## 10. Sécurité et confidentialité

Krono manipule localisation, téléphone, identité, avatar, tokens push et informations de commande.
Ces données doivent être utiles, limitées et protégées.

Règles :

- Le tracking public affiche uniquement les informations nécessaires à la réception du colis.
- Les liens de tracking doivent avoir une durée de validité ou une logique d'expiration à définir.
- Les numéros de téléphone ne doivent pas être exposés publiquement sans nécessité.
- Les avatars et noms ne doivent pas être réutilisés hors contexte livraison/support.
- Les tokens push, JWT, refresh tokens, secrets QR et clés PSP ne doivent jamais être logs en clair.
- Les logs peuvent contenir des identifiants techniques, mais pas de données sensibles inutiles.
- Toute nouvelle surface publique doit être relue avec la question : "est-ce que cette information aide vraiment à livrer ?"

---

## 11. Support / diagnostic rapide

Cette section sert à savoir quoi vérifier quand un comportement produit est incohérent.

| Problème | Vérifications prioritaires |
|----------|----------------------------|
| Commande bloquée | statut commande backend, socket, dernière transition, logs `orderSocket` |
| Livreur sans notification | token push chauffeur, statut disponibilité, socket chauffeur, `expoPushService` |
| Client sans suivi temps réel | socket client, store commande, `userOrderSocketService`, route `order-tracking` |
| Dynamic Island absente | autorisation iOS, Live Activity active, props commande, patch `expo-widgets`, logs app |
| Temps incohérent | coordonnées livreur/pickup/dropoff, Mapbox, fallback Haversine, statut colis |
| Avatar absent | `users.avatar_url`, fallbacks, payload socket/backend, props Live Activity |
| Prix incohérent | `priceCalculator`, Mapbox route, options vitesse, tarification dynamique |
| Paiement / reliquat | `order_id`, transactions, statut paiement, logs PSP quand branché |
| QR problématique | secret QR, scan déjà existant, `qr_code_scans`, statut commande |

Principe : corriger la source de vérité avant de corriger seulement l'affichage.

---

## 12. Prod / TestFlight — rappels essentiels

Le build EAS production ne lit pas le `.env` local.
Toutes les variables utiles doivent être dans l'environnement EAS `production`.

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

## 13. Migrations importantes

| Migration | Sujet |
|----------|-------|
| `023_create_push_tokens.sql` | `push_tokens` Expo push client / driver |
| `024_users_name_avatar_columns.sql` | `users.first_name`, `last_name`, `avatar_url` |
| `025_orders_recipient_user_id.sql` | lien compte destinataire |
| `026_order_status_push_dedup.sql` | anti-doublon notifications par `(order_id, status)` |

Migrations SQL : voir `chrono_backend/migrations/README.md`.

---

## 14. Décisions encore ouvertes

- Plusieurs commandes actives : commande sélectionnée, plus récente, ou priorité statut métier.
- APNs Live Activity : fréquence maximale des updates backend.
- Notifications : liste exacte des statuts qui doivent vibrer / sonner.
- Android : enrichissement de la base foreground service existante avec statut, temps, actions et arrêt propre.
- Notifications périodiques : quels rappels sont utiles, lesquels seraient perçus comme du spam.
- Widgets écran d'accueil : choisir les données visibles sans exposer trop d'informations privées.
- Rétention : niveau acceptable de gamification et de messages d'engagement.
- Paiement : choix PSP direct opérateur ou agrégateur.
- QR : scan obligatoire avant `completed` ou seulement preuve complémentaire.
- Tracking public : durée exacte de validité des liens.
- Fallback manuel livraison : preuve acceptée si QR impossible.

---

## 15. Vision app mature

Une application Krono mature ne doit pas seulement suivre une livraison.
Elle doit donner confiance, rester utile sans être lourde, et créer une impression premium.

### Notifications intelligentes

- Les notifications doivent être utiles, actionnables et annulables.
- Les rappels périodiques doivent être rares et justifiés : dette/reliquat, récap accepté, note à laisser, mission chauffeur.
- Les notifications marketing doivent être désactivables et séparées des notifications opérationnelles.

### Widgets écran d'accueil

- Client : commande active, temps restant, raccourci suivi, nouvelle livraison.
- Chauffeur : disponibilité, course active, revenus du jour.
- Les widgets doivent avoir de beaux états vides, sinon ils donnent une impression d'application inachevée.

### Attractivité

- Onboarding clair et rassurant.
- Fin de commande soignée : résumé, note, support, nouvelle livraison.
- Historique lisible et valorisant.
- Micro-interactions discrètes, jamais gratuites.
- Gamification chauffeur utile : objectifs, revenus, badges, mais sans infantiliser.

---

## 16. Documents vivants

Il ne doit rester que deux fichiers principaux dans `docs/` :

- `docs/checklist-fonctionnalites-app.md` : actions à exécuter, priorisées.
- `docs/krono-reference-unique.md` : référence projet, contrat produit, décisions, cartes de fichiers.
