# Krono — référence unique projet

Ce fichier est la **mémoire courte du projet** et le **contrat produit Krono**.
Il sert de **référence unique Krono** pour les décisions produit, les règles durables, les cartes de fichiers et les points de vigilance validés.

Ce document répond à une question : **qu'est-ce que Krono doit faire, afficher, notifier, calculer et protéger à chaque étape d'une livraison ?**

Règle :

- Si c'est une tâche à exécuter, elle doit être traitée puis résumée ici seulement si elle change une règle durable.
- Si c'est une décision produit, une carte de fichiers ou une règle à retenir, elle reste ici.
- Si le code contredit ce document, le comportement produit attendu est celui décrit ici.
- Si une décision n'est pas tranchée, elle doit apparaître dans la section "Décisions encore ouvertes".

---

## 1. Carte rapide des fichiers utiles

### App client

| Sujet | Fichier |
|---|---|
| Live Activity / Dynamic Island | `app_chrono/services/orderLiveActivity.ts` |
| UI Dynamic Island SwiftUI/Expo UI | `app_chrono/widgets/orderTrackingLiveActivity.tsx` |
| Sync Live Activity depuis le store | `app_chrono/hooks/useOrderLiveActivitySync.ts` |
| Socket commande client | `app_chrono/services/userOrderSocketService.ts` |
| Push client / tap notification | `app_chrono/services/clientPushService.ts` |
| Notification Android foreground service client | `app_chrono/services/clientBackgroundLocation.ts` |
| Écran suivi commande | `app_chrono/app/order-tracking/[orderId].tsx` |
| Auth client | `app_chrono/store/useAuthStore.ts` |
| Refresh token client | `app_chrono/utils/secureTokenStorage.ts` |
| **Onboarding B2B** | `app_chrono/app/(auth)/business-onboarding.tsx` |
| **Store mode business / tournées** | `app_chrono/store/useBusinessStore.ts` |
| **API partenaire mobile** | `app_chrono/services/partnerApi.ts` |
| **Modal livraison client B2B (Profil 1)** | `app_chrono/components/NewB2BShippingModal.tsx` |
| **Bottom sheet tournée (Profil 2)** | `app_chrono/components/BatchShippingBottomSheet.tsx` |
| **Cartes d'action (standard + B2B)** | `app_chrono/components/ActionCards.tsx` |

### App chauffeur

| Sujet | Fichier |
|---|---|
| Push chauffeur / tap notification | `driver_chrono/services/driverPushService.ts` |
| Notification Android foreground service chauffeur | `driver_chrono/services/driverBackgroundLocation.ts` |
| Auth chauffeur | `driver_chrono/store/useDriverStore.ts` |
| Sockets commandes | `driver_chrono/services/orderSocketService.ts` |
| Sockets messages | `driver_chrono/services/driverMessageSocketService.ts` |
| Dépannage app chauffeur | `driver_chrono/docs/TROUBLESHOOTING.md` |
| **Store tournée active** | `driver_chrono/store/useBatchStore.ts` |
| **API tournées chauffeur** | `driver_chrono/services/batchApiService.ts` |
| **Écran tournée B2B** | `driver_chrono/app/batch/[batchId].tsx` |
| **Encart admin / B2B / hors-ligne** | `driver_chrono/components/AdminOrderInfo.tsx` |
| **Normalisation flags commande** | `driver_chrono/utils/mapAdminOrderFlags.ts` |
| **Store commande livreur** | `driver_chrono/store/useOrderStore.ts` |

### Backend

| Sujet | Fichier |
|---|---|
| Socket commande | `chrono_backend/src/sockets/orderSocket.ts` |
| Push Expo | `chrono_backend/src/services/expoPushService.ts` |
| Notifications destinataire | `chrono_backend/src/services/recipientOrderNotifyService.ts` |
| SMS Twilio | `chrono_backend/src/services/twilioSmsService.ts` |
| Track public | `chrono_backend/src/controllers/trackController.ts`, `routes/trackRoutes.ts` |
| Prix livraison | `chrono_backend/src/services/priceCalculator.ts` |
| Tarification dynamique | `chrono_backend/src/services/dynamicPricing.ts` |
| QR livraison | `chrono_backend/src/services/qrCodeService.ts` |
| Commission livreur | `chrono_backend/src/services/commissionService.ts` |
| **Création commande admin (hors-ligne / téléphone / B2B)** | `chrono_backend/src/controllers/adminController.ts` (`createAdminOrder`, `_chrono_admin`) |
| **Contrôleur partenaire (admin + invitation portail)** | `chrono_backend/src/controllers/partnerController.ts` |
| **Contrôleur tournées** | `chrono_backend/src/controllers/batchController.ts` |
| **Commission B2B** | `chrono_backend/src/services/b2bCommissionService.ts` |
| **Job facturation mensuel** | `chrono_backend/src/jobs/partnerInvoiceJob.ts` |
| **Middleware auth portail partenaire** | `chrono_backend/src/middleware/verifyPartnerUser.ts` |
| **E-mail lien portail (magic / recovery)** | `chrono_backend/src/services/emailService.ts` (`sendPartnerPortalMagicLinkEmail`) |
| **Notification socket tournée** | `chrono_backend/src/sockets/orderSocket.ts` (`emitBatchAssigned`) |
| **Optimisation itinéraire** | `chrono_backend/src/utils/haversine.ts` |

### Admin / web

| Sujet | Fichier |
|---|---|
| Page tracking public | `admin_chrono/app/track/[token]/page.tsx` |
| Web push tracking | `admin_chrono/public/sw.js` |
| Performance dashboard / analytics | `admin_chrono/app/(dashboard)/gamification/page.tsx` |
| Performance analytics API | `admin_chrono/app/api/analytics/performance/route.ts` |
| **Liste partenaires B2B** | `admin_chrono/app/(dashboard)/partners/page.tsx` |
| **Fiche partenaire (KPIs + abonnement + factures)** | `admin_chrono/app/(dashboard)/partners/[id]/page.tsx` |
| **Layout portail partenaire** | `admin_chrono/app/(partner)/partner/[partnerId]/layout.tsx` |
| **Page upgrade (Starter / none bloqué portail)** | `admin_chrono/app/(partner)/partner/[partnerId]/upgrade/page.tsx` |
| **Dashboard portail partenaire** | `admin_chrono/app/(partner)/partner/[partnerId]/dashboard/page.tsx` |
| **Commandes portail partenaire** | `admin_chrono/app/(partner)/partner/[partnerId]/orders/page.tsx` |
| **Nouvelle commande portail** | `admin_chrono/app/(partner)/partner/[partnerId]/orders/new/page.tsx` |
| **Facturation portail partenaire** | `admin_chrono/app/(partner)/partner/[partnerId]/billing/page.tsx` |
| **Équipe portail partenaire** | `admin_chrono/app/(partner)/partner/[partnerId]/team/page.tsx` |
| **Service API portail partenaire** | `admin_chrono/lib/partnerApiService.ts` |

---

## 2. Cycle officiel d'une commande

Une commande Krono doit rester lisible pour trois publics : **client**, **chauffeur** et **destinataire**.
La question principale est toujours : **où est mon colis, qui s'en occupe, dans combien de temps, et que dois-je faire ?**

| Étape produit | Statuts techniques typiques | Client | Chauffeur | Dynamic Island / Live Activity | Notification | Temps affiché | Passage suivant |

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

Tournées B2B :

- Une tournée peut être acceptée en bloc, mais la preuve reste individuelle : **N livraisons = N preuves**.
- Chaque livraison enfant doit avoir son propre QR ou code sécurisé.
- Le scan QR passe l'`expectedOrderId` côté chauffeur et le backend refuse un QR qui correspond à une autre livraison.
- La saisie manuelle valide le code pour l'`orderId` concerné ; un code d'une autre livraison ne doit pas clôturer cet arrêt.
- Si le QR/code n'est pas disponible, la preuve alternative doit être encadrée : photo, nom/signature, horodatage, position GPS et identité livreur.
- Les preuves alternatives sont visibles côté admin / portail partenaire comme preuve moins forte qu'un QR ou code validé.

Décision ouverte hors tournée : pour les commandes classiques, scan obligatoire avant `completed` ou preuve complémentaire seulement.

---

## 9. Pricing

### Déjà en place

| Thème | Côté code |

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
|---|---|
| Commande bloquée | statut commande backend, socket, dernière transition, logs `orderSocket` |
| Livreur sans notification | token push chauffeur, statut disponibilité, socket chauffeur, `expoPushService` |
| Client sans suivi temps réel | socket client, store commande, `userOrderSocketService`, route `order-tracking` |
| Dynamic Island absente | autorisation iOS, Live Activity active, props commande, patch `expo-widgets`, logs app |
| Temps incohérent | coordonnées livreur/pickup/dropoff, Mapbox, fallback Haversine, statut colis |
| Avatar absent | `users.avatar_url`, fallbacks, payload socket/backend, props Live Activity |
| Prix incohérent | `priceCalculator`, Mapbox route, options vitesse, tarification dynamique |
| Paiement / reliquat | `order_id`, transactions, statut paiement, logs PSP quand branché |
| QR problématique | secret QR, scan déjà existant, `qr_code_scans`, statut commande |
| **Boutons B2B inactifs (mobile)** | `user.partner_id` null — admin doit lier le partenaire, puis re-login |
| **Tournée non reçue par livreur** | socket connecté ? `connectedDrivers.has(driverId)` — si non, notification push `batch_assigned` en fallback |
| **Tournée ne charge pas** | `GET /api/batches/:id` avec verifyJWT — vérifier token livreur valide |
| **Quota mal calculé** | `partner_usage.deliveries_count` — vérifier upsert atomique, mois courant |
| **Facture en doublon** | `partner_invoices` — anti-doublon : vérifier la contrainte `(partner_id, period_start)` |

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

| `023_create_push_tokens.sql` | `push_tokens` Expo push client / driver |
| `024_users_name_avatar_columns.sql` | `users.first_name`, `last_name`, `avatar_url` |
| `025_orders_recipient_user_id.sql` | lien compte destinataire |
| `026_order_status_push_dedup.sql` | anti-doublon notifications par `(order_id, status)` |
| `032_create_b2b_partners_core.sql` *(à appliquer)* | Tables `partners`, `partner_users`, `partner_drivers` |
| `033_create_b2b_subscriptions_billing.sql` *(à appliquer)* | Tables `partner_subscriptions`, `partner_usage`, `partner_invoices` |
| `034_create_b2b_batches.sql` *(à appliquer)* | Tables `delivery_batches`, `batch_orders` |
| `035_orders_add_b2b_columns.sql` *(à appliquer)* | `ALTER TABLE orders ADD COLUMN partner_id` + `is_b2b_order` |
| `036_migrate_existing_b2b_partners.sql` *(à appliquer)* | Backfill partenaires existants : crée `partners` + `partner_users` + remplit `orders.partner_id` |
| `037_partners_add_inactive_status.sql` *(à appliquer)* | **Critique** — ajoute `inactive` au CHECK constraint de `partners.status` |
| `041_partner_dedicated_driver_requests.sql` *(à appliquer)* | Livreurs dédiés partenaires : `partner_drivers`, demandes `partner_driver_requests`, unicité `(partner_id, driver_user_id)` et un seul défaut |

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

## 16. B2B / Partenaires

### Principe fondamental

Krono doit s'adapter au workflow du commerçant, et non l'inverse. Le problème n'est pas le device (mobile vs ordinateur). Le problème est la **friction** pour créer et gérer des commandes.

> Si Krono impose "utilise notre système" → échec
> Si Krono dit "continue comme tu fais déjà, mais en mieux" → adoption massive

---

### Pourquoi le B2B

Krono sert aujourd'hui des particuliers (B2C). Le B2B cible des professionnels — e-commerces, restaurants, pharmacies, boutiques — qui ont des volumes élevés et réguliers. Au lieu de payer le taux « paiement à la course » (voir grille ; typiquement 7 %), ils s'abonnent à un forfait mensuel avec un quota de livraisons incluses et un taux réduit dans ce quota.

Revenus Krono : forfait prévisible + commissions sur excédents. Valeur partenaire : coût réduit par livraison, tournées groupées, portail dédié.

### Les 4 profils utilisateurs

| Profil | Description | App | Volume | Abonnement |
|--------|-------------|-----|--------|------------|
| **Profil 0** | Client particulier B2C | `app_chrono` | 1 commande à la fois | Non |
| **Profil 1** | Petit commerçant mobile (revendeur, boutique de quartier) | `app_chrono` mode business | 5–20 commandes/jour | Optionnel |
| **Profil 2** | Vendeur à volume (live TikTok, 20+ commandes d'un coup) | `app_chrono` mode tournée | 20+ à la session | Optionnel |
| **Profil 3** | B2B professionnel structuré (restaurant, pharmacie, boutique) | `admin_chrono` portail partenaire | Régulier et prévisible | Oui (mensuel) |

**Paiement Profil 1** : commandes pour ses clients → compte business, immédiat ou différé si éligible ; commandes pour lui-même → contexte client, règles Profil 0.

**Commission Profil 1** : sans abonnement actif → `partners.commission_rate` (aligné grille « paiement à la course », typiquement 7 %) ; avec abonnement actif → frais in-quota selon plan (voir Plans tarifaires).

### Interfaces — qui utilise quoi

```text
app_chrono      → Profil 0 (client B2C)
                → Profil 1 (petit commerçant, mode business)
                → Profil 2 (vendeur volume, mode tournée)

driver_chrono   → livreurs (menus différents selon driver_type)

admin_chrono
  └── (admin)   → équipe Krono uniquement — jamais exposé aux partenaires
  └── (partner) → Profil 3, portail web (Phase 1 — même projet, layout séparé)

partner_chrono  → Profil 3, portail web indépendant (Phase 2 — si ça grossit)
```

**Règle absolue** : l'admin Krono et le portail partenaire ne se mélangent jamais. Un partenaire ne voit jamais : les autres partenaires, les livreurs et leurs commissions, les finances globales de Krono, les clients des autres.

### Contexte d'utilisation — compte unique

Un seul compte utilisateur avec un **contexte actif** (client ou business) — pas deux comptes figés à vie.

| Critère | Contexte client | Contexte business |
|---------|-----------------|-------------------|
| Nombre de commandes | Une à la fois | Plusieurs, pour ses propres clients |
| Qui paie | Lui, immédiatement | Son compte business ; différé possible si éligible |
| Destinataires | Lui ou un proche | Ses clients |
| Livreur | Dispatch automatique | Livreur(s) attitré(s) possible(s) ; sinon dispatch |

---

### Concepts fondamentaux — à lire en premier

#### Utilisateur business (`is_business: true`) ≠ Partenaire (`partners` table)

Ce sont **deux concepts distincts** que l'architecture sépare volontairement.

---

**Utilisateur business** — déclaration personnelle dans l'app mobile

C'est un utilisateur qui a répondu "oui, je suis professionnel" pendant l'onboarding. Ça change uniquement son interface : il voit les ActionCards B2B ("Livraison Client" / "Tournée Lots") au lieu des cartes standard.

> **Exemple concret :** Fatou vend des robes sur TikTok Shop. Elle livre 10–15 clients par semaine. Elle s'inscrit sur Krono, dit "oui professionnel", saisit "Boutique Fatou Style". Son compte a `is_business: true`. Elle peut créer des livraisons B2B de base. Elle n'a pas besoin d'un abonnement formel ni d'un portail web.

Ce profil correspond aux **Profil 1** et **Profil 2** de la stratégie Krono (petit commerçant, vendeur à volume modéré).

---

**Partenaire** — contrat formel entre Krono et une entreprise

C'est une **entité distincte** dans la table `partners`. Le parcours **prioritaire** est la demande depuis l'app (`registerAsPartner` : statut `pending`, plan et e-mail portail) puis **activation** admin ; l'admin peut aussi créer une fiche hors app (cas B2B pur back-office). La ligne a un plan demandé ou souscrit, un quota mensuel, une facturation automatique, et un accès au portail web. Elle peut avoir plusieurs utilisateurs liés (ex : 3 gestionnaires d'une même enseigne).

> **Exemple concret :** MedExpress est une chaîne de pharmacies avec 150 livraisons/mois. L'admin Krono crée une fiche partenaire "MedExpress" dans `partners`, lui attribue le plan Pro (70 courses/mois, 3 % de frais de service in-quota). Les 3 managers de MedExpress sont ensuite liés à ce partenaire via `partner_users`. Ils accèdent au portail web `/partner/:id/dashboard` pour voir leurs commandes, leur quota, leurs factures.

Ce profil correspond au **Profil 3** de la stratégie Krono (entreprise structurée, e-commerce professionnel).

---

#### "Lier un utilisateur à un partenaire" vs "Créer un partenaire"

Ces deux actions sont distinctes et séquentielles :

| Action | Qui la fait | Ce que ça crée |
|--------|-------------|----------------|
| **Créer un partenaire** | Admin Krono | Une ligne dans `partners` (nom, plan, quota, taux commission) |
| **Lier un utilisateur** | Admin Krono | `users.partner_id = partners.id` + une ligne dans `partner_users` |

> **Exemple :** L'admin crée "MedExpress" dans `partners` (étape 1). Ensuite il prend le compte de Moussa (manager chez MedExpress) et lui assigne `partner_id = MedExpress.id` (étape 2). Moussa peut désormais créer des commandes B2B rattachées à MedExpress et accéder au portail. Avant ce lien, Moussa avait `is_business: true` mais ses commandes n'étaient pas facturables sous le contrat MedExpress.

---

#### Gap architectural actuel et règle produit

Dans l'implémentation actuelle, `NewB2BShippingModal` bloque si `user.partner_id` est null. C'est trop restrictif par rapport à la stratégie :

| Profil | `is_business` | `partner_id` | Accès B2B attendu |
|--------|--------------|--------------|-------------------|
| Profil 1 (petit commerçant) | `true` | `null` | ✅ Doit pouvoir créer des livraisons — frais selon `partners.commission_rate` ou règle métier sans abonnement (voir grille) |
| Profil 2 (volume modéré) | `true` | `null` ou lié | ✅ Tournées disponibles — commission selon abonnement si lié |
| Profil 3 (entreprise) | `true` | lié par admin | ✅ Quota, facturation, portail — commission selon plan |

Le `partner_id` est requis seulement pour les fonctionnalités liées à l'abonnement (quota, facturation, portail). La création de commande B2B de base doit fonctionner avec `is_business: true` seul, avec un taux de commission par défaut. **Ce point est à corriger** dans `NewB2BShippingModal` et `b2bCommissionService` (voir "Reste à faire" en fin de section).

---

### Segmentation par forfait — règles arrêtées

| Règle | Décision |
|-------|----------|
| **Starter** = petit B2B | App uniquement — pas d'accès portail partenaire. |
| **Pro / Business** = grand B2B | Accès portail — `verifyPartnerUser` vérifie `plan ∈ {pro, business}` via `partners.status = active`. |
| **`none`** (paiement à la course) | Orienter vers choix de forfait ; `commission_rate = 0.07` sur chaque livraison. |
| **`pending` sans abonnement actif** | Traité comme `none` côté app — message « en attente de validation Krono » ; pas d'accès portail. |
| **Partenaire créé admin sans plan** | Défaut `none` → `commission_rate = 0.07` sauf choix explicite à la création. |
| **Plan effectif** | `partner_subscriptions` (`is_active + payment_status='active'`) prime sur `partners.plan`. En cas de divergence temporaire, `partner_subscriptions` gagne toujours. |
| **Portail blocage** | API 403 via `verifyPartnerUser` **et** bandeau visuel dans le layout — les deux coexistent. Message upgrade Pro/Business uniquement sur les entrées portail/grand only, jamais sur l'usage app courant Starter. |
| **Libellé livreur** | Inchangé — seul `is_b2b_order` utilisé, pas de distinction petit/grand B2B côté livreur. |
| **Partenaires existants `none`** | Conserver `none` + communication pour choisir un forfait ; pas de migration automatique. |
| **Invitations `partner_users` si reclassé Starter** | Lien `partner_users` conservé ; accès portail bloqué automatiquement par `verifyPartnerUser` (status `active` requis). |
| **Tier calculé** | Dérivé du plan dans l'API — pas de champ `b2b_segment` persisté en base. |

**Backlog technique (à implémenter, pas de décision produit bloquante) :**
- Inventorier précisément les écrans/boutons « grand only » à bloquer côté `app_chrono` (entrées portail, invite équipe, etc.).
- Resync profil après passage Starter → Pro (admin ou paiement).
- Filtre / colonne Petit (Starter) vs Grand (Pro/Business) sur la liste partenaires dans l'admin (optionnel, utile ops).

---

### Plans tarifaires B2B (grille v2 — 2026-05-04)

Un abonnement réduit les frais de service sur les livraisons dans le quota par rapport au paiement à la course.

| Plan | Abonnement (FCFA/mois) | Quota livraisons/mois | Frais in-quota | Frais au-delà |
|---|---|---|---|---|
| **Paiement à la course** | 0 | — | 7 % | = même taux |
| **Starter** | 8 000 | 35 | 5 % | 6 % |
| **Pro** *(recommandé)* | 16 000 | 70 | 3 % | 5 % |
| **Business** | 29 000 | 110 | 2 % | 3 % |

Sans abonnement : `partners.commission_rate = 0.07` (7 % sur chaque livraison — taux le plus élevé pour inciter à l'abonnement).
Ces valeurs sont les constantes uniques : toute modification passe par `PLAN_DEFAULTS` dans `partnerController.ts` et `QUOTA_COMMISSION` dans `b2bCommissionService.ts`, puis propagée app + admin + doc.

### Principes produit, glossaire et parcours partenaire

**Vision** : mettre en avant les forfaits (Starter, Pro, Business) et l'option « paiement à la course » avant toute commission opaque. Aucun abonnement ni taux d'accord sans **choix explicite** (sélection de plan + validation). Les **frais de service sur les livraisons** (souvent appelés « commission » en interne) sont distincts du **montant de l'abonnement** dans la communication utilisateur.

**Glossaire stable** :

| Terme | Définition |
|--------|-------------|
| **Quota mensuel** | Nombre de livraisons du mois civil où s'applique le taux in-quota réduit du plan. |
| **Au-delà du quota** | Livraisons du même mois après le quota → taux majoré (`excess_commission_rate` sur la souscription). |
| **Abonnement** | Montant FCFA/mois du forfait (Starter / Pro / Business). |
| **Paiement à la course** | Pas d'abonnement ; clé plan API `none` ; commission sur **chaque** livraison (`partners.commission_rate`). |

**Scénario retenu (téléphone / admin)** : tout le métier forfait + e-mail portail est saisi dans l'app. L'admin **active** (`pending` → `active`), l'abonnement facturable et l'invitation portail suivent le plan et l'e-mail déjà enregistrés (pas de re-saisie standard du forfait). Garde-fou : corriger l'e-mail portail avant envoi si erreur évidente. **Unicité** : un utilisateur → un partenaire logique via `partner_users` ; éviter doublon « admin + app » sans règle de fusion.

**Agrément vs mode business** : une fois le partenaire **accepté** (activation + lien portail), couper le mode business dans l'app ne doit pas exiger une **nouvelle** activation admin à chaque fois (le statut agrément reste `active` ; seul `users.is_business` reflète l'usage immédiat). Voir la sous-section « Statuts partenaire » ci-dessous.

**Copy et cohérence** : les écrans app (`business-onboarding.tsx`, succès, profil), admin (liste, fiche, portail facturation) et les messages API doivent reprendre les **mêmes chiffres** que la grille ; pas de « livraisons illimitées » contradictoire avec un quota chiffré ; pas d'anciens paliers (15k / 40k / 100k, 20 % implicite, etc.).

**Périmètre encore ouvert (hors doc seule)** : suppression ou fusion partenaire côté admin (API + FK) ; comportement explicite si `commission_rate` absent sans abonnement ; assouplissement `NewB2BShippingModal` / `partner_id` ; CGU alignées sur la grille ; simulateur d'estimation mensuelle = backlog produit.

### Axes de monétisation futurs (Axes 3–6)

| Axe | Horizon | Description |
|-----|---------|-------------|
| **Axe 3 — API d'intégration** | Phase 2 (~6 mois) | Grandes enseignes intègrent Krono dans leur SI via API. Nécessite `partner_api_keys`, middleware auth, webhooks signés. |
| **Axe 4 — Marque blanche** | Phase 3 (~12 mois) | Krono gère la livraison, le partenaire garde sa marque. |
| **Axe 5 — Flotte dédiée Enterprise** | Phase 3 | Chauffeurs dédiés assignés à un seul partenaire. Forfait hebdomadaire ou mensuel. |
| **Axe 6 — Publicité et données agrégées** | Après volume atteint | Partenaires premium mis en avant. Insights analytiques vendus. |

---

### Schéma de données B2B

8 tables créées par les migrations `032` → `035` :

| Table | Rôle |
|---|---|
| `partners` | Fiche entreprise partenaire (nom, email, téléphone, plan, commission_rate, status) |
| `partner_users` | Utilisateurs du partenaire (`owner` / `manager`) — porte l'accès portail |
| `partner_drivers` | Livreurs attitrés d'un partenaire |
| `partner_subscriptions` | Abonnement (`payment_status`, `is_active`) — à l'activation admin, création en `active` si le plan est déjà choisi côté app |
| `partner_usage` | Compteur mensuel de livraisons par partenaire (upsert atomique SQL) |
| `partner_invoices` | Factures mensuelles générées automatiquement |
| `delivery_batches` | Tournées groupées (ensemble de commandes à livrer en une sortie) |
| `batch_orders` | Lien tournée ↔ commandes, avec position optimisée |

La table `orders` reçoit une colonne `partner_id UUID REFERENCES partners(id)` pour rattacher chaque commande B2B à son partenaire.

---

### Logique commission B2B (b2bCommissionService)

Pour une commande B2B rattachée à un `partner_id`, le service lit l'abonnement actif (`is_active`, `payment_status = active`) puis l'usage du mois (`partner_usage`) :

1. **Abonnement actif + quota non dépassé** → taux **in-quota** (`QUOTA_COMMISSION`) : Starter **5 %**, Pro **3 %**, Business **2 %**.
2. **Abonnement actif + quota dépassé** → `excess_commission_rate` de la souscription (aligné sur `PLAN_DEFAULTS` dans `partnerController.ts`, ex. Starter **6 %**, Pro **5 %**, Business **3 %**).
3. **Pas d'abonnement actif** → `partners.commission_rate` (souvent **0,07** pour paiement à la course ; pas de repli implicite type 20 % sur données propres).

Branchement : `orderRecordController` appelle `computeB2BCommission` puis `incrementPartnerUsage`. Le compteur `partner_usage.deliveries_count` est incrémenté via un `INSERT … ON CONFLICT DO UPDATE` SQL atomique pour éviter les doublons en cas de requêtes simultanées.

### Types de livraison — flags et encart livreur

| Type | Flags / données | Encart livreur (`AdminOrderInfo`) |
|------|-----------------|-----------------------------------|
| **En ligne (classique)** | Aucun flag admin | Pas d'encart |
| **Hors-ligne / opérateur** | `placed_by_admin` dans `_chrono_admin` | Badge « Hors-ligne · Opérateur » |
| **Téléphonique / coords souples** | `is_phone_order` | Badge fusionné « Hors-ligne · Opérateur » si `placed_by_admin` vrai (comportement actuel conservé — pas de badge séparé « Téléphonique ») |
| **B2B planning** | `is_b2b_order` | Badge « Commande B2B » + partenaire + tournée si données présentes |
| **Tournée (batch)** | `batch_id`, `batch_position`, `batch_total`, `partner_name` | Affichage X/Y, contexte partenaire |

**Règle mnémotechnique :** encart = `isB2BOrder` OU `placedByAdmin` OU `isPhoneOrder` (normalisé via `mapAdminOrderFlags`). Priorité badge : B2B > opérateur.

**Décisions arrêtées :**
- `partner_id` présent → toujours propager `is_b2b_order = true` sur la commande (pas de `partner_id` silencieux sans encart B2B livreur).
- Tournée hybride (petit B2B sans portail) → batch créé avec `user_id` (pas de `partner_id` requis).
- Tournée grand B2B → batch avec `partner_id` + `partner_name` remontés côté livreur.

### Matrice segment × type de livraison (arrêtée)

**O** = cas courant, **—** = non prévu.

|  | En ligne | Hors-ligne opérateur | Téléphonique | B2B planning | Tournée (batch) |
|--|:--------:|:--------------------:|:------------:|:------------:|:---------------:|
| **Lambda** | O | — | — | — | — |
| **Hybride (Starter, sans portail)** | O | — | — | O | O (`user_id`) |
| **Grand B2B (Pro/Business)** | — | O | O | O | O (`partner_id`) |

Lambda : pas de tournée grand public pour l'instant. Hybride : pas de saisie hors-ligne ni téléphonique (flow app uniquement). Grand B2B : pas de commande en ligne classique (passe par admin/portail).

---

### Comportement dispatch B2B

- GPS optionnel (contrairement au B2C)
- Tous les livreurs disponibles notifiés
- Livreurs **internes** prioritaires sur commandes B2B
- Paiement **différé** (`deferred`) disponible
- Si livreur attitré sélectionné pour une commande unitaire → `preferred_driver_id` priorisé, puis fallback automatique si le livreur n'est pas joignable ou refuse.
- Si livreur attitré sélectionné pour une tournée → `driver_id` explicite sur `/api/batches`, donc assignation directe au livreur choisi.

### Livreurs dédiés partenaires

Définitions :
- **Livreur B2B opt-in** : livreur qui accepte de recevoir des commandes B2B (`driver_profiles.accepts_b2b_orders = true`).
- **Livreur dédié partenaire** : livreur explicitement rattaché à un partenaire dans `partner_drivers`.
- **Priorité douce** : Krono propose d'abord la commande au livreur dédié sélectionné, puis l'assignation automatique prend le relais si besoin.

Règle produit : le partenaire peut demander ou sélectionner un livreur déjà validé, mais il ne rattache jamais directement un livreur à son compte. Le rattachement officiel reste une action admin Krono.

Modèle de données :
- `partner_drivers.partner_id` + `driver_user_id` identifie le rattachement.
- Un même livreur peut être dédié à plusieurs partenaires ; l'unicité est seulement sur le couple `(partner_id, driver_user_id)`.
- Un seul livreur par défaut est autorisé par partenaire (`is_default = true` unique).
- `partner_driver_requests` couvre trois demandes : `known_driver`, `previous_krono_driver`, `general_request`.

Admin Krono :
- Liste les livreurs dédiés d'un partenaire avec nom, téléphone, disponibilité, véhicule et opt-in B2B.
- Ajoute un livreur existant, refuse un utilisateur qui n'a pas `role = driver`, et retourne un warning si le livreur n'accepte pas encore les commandes B2B.
- Définit le livreur par défaut en remettant les autres rattachements du partenaire à `is_default = false`.
- Retire un livreur dédié.
- Liste et traite les demandes partenaire : validation avec `driver_user_id` ou rejet avec note.

Portail partenaire :
- Affiche les livreurs dédiés en lecture seule.
- Sur une nouvelle commande, propose "Assignation automatique" et les livreurs dédiés configurés ; les livreurs sans opt-in B2B sont désactivés avec un libellé clair.
- Sélectionne automatiquement le livreur par défaut si `is_default = true` et `accepts_b2b_orders = true`.
- Envoie `preferred_driver_id` seulement si la préférence livreur est activée.
- Permet de demander un livreur dédié depuis l'historique d'une commande livrée par Krono, ou via une demande générale.

Texte produit recommandé :

> Livreur dédié : Krono propose d'abord la commande au livreur sélectionné pour ce partenaire. Si aucun livreur dédié n'est disponible, l'assignation automatique prend le relais.

Texte de demande :

> Vous souhaitez un livreur dédié ? Envoyez une demande à Krono. Notre équipe vérifie le livreur et l'ajoute à votre compte si tout est conforme.

---

### Tournées (delivery_batches)

Un partenaire B2B livre souvent plusieurs commandes en une seule sortie (ex : 8 colis confiés à un livreur). Le système :

1. Crée une tournée (`delivery_batches`) regroupant les commandes
2. Optimise automatiquement l'ordre de passage via l'algorithme nearest-neighbor (haversine)
3. Permet au livreur de valider chaque livraison une par une
4. Clôture la tournée automatiquement quand toutes les commandes sont `completed` ou `cancelled`

Règle centrale : **une tournée B2B = une popup, une acceptation, une assignation** ; les livraisons enfants ne déclenchent pas de popups séparées.

Notification livreur :
- L'offre de tournée est émise au niveau `batchId` via `batch-assigned` avec `status: "offer"` et `ordersCount`.
- Le message côté chauffeur doit présenter la tournée complète, par exemple "Nouvelle tournée B2B - 18 livraisons à effectuer".
- Le livreur a deux actions principales : accepter ou refuser.
- L'app chauffeur déduplique par `batchId` pour éviter plusieurs popups si le socket rejoue le même événement.
- Le backend ne doit pas envoyer `new-order-request` pour chaque livraison enfant d'une tournée.

Acceptation :
- L'acceptation se fait au niveau `batchId` (`accept-batch`).
- Si la tournée est libre, elle est assignée au livreur qui accepte.
- Si elle est déjà assignée au même livreur, l'app ouvre la tournée sans afficher "Tournée indisponible".
- Si elle est déjà assignée à un autre livreur, alors seulement l'app affiche l'indisponibilité.
- Le backend verrouille la ligne `delivery_batches` pendant l'acceptation pour rendre le double clic / double événement socket idempotent.

Après acceptation :
- L'écran `/batch/[batchId]` charge toutes les livraisons enfants via `GET /api/batches/:id`.
- Chaque arrêt propose scan QR, saisie manuelle du code, ou preuve alternative encadrée.
- Le backend vérifie que l'arrêt appartient bien à la tournée et au livreur avant de le clôturer.

---

### Facturation mensuelle (partnerInvoiceJob)

Un **job** est une tâche automatique qui tourne en arrière-plan sans intervention humaine. Le `partnerInvoiceJob` est un job Node.js planifié sur un timer de 24h. À chaque déclenchement il vérifie si on est le 1er du mois — si oui, il génère les factures ; sinon, il ne fait rien.

Contenu de la facture générée :
- **Forfait mensuel** (fixe selon le plan)
- **Surplus** : estimation des commandes excédentaires × `excess_commission_rate` × prix moyen (Phase 1 : 1 000 FCFA/course — à rapprocher des transactions réelles en Phase 2)
- Garde anti-doublon : si une facture existe déjà pour ce partenaire / cette période, rien n'est créé

---

### Statuts partenaire — lexique et règles de transition

| Statut | Qui l'applique | Sens métier |
|--------|----------------|-------------|
| `pending` | Onboarding app / création admin | En attente de validation admin avant agrément complet. |
| `active` | Admin (activation) | Partenaire opérationnel — commandes sous contrat, quota, portail. |
| `inactive` | **Admin Krono** (sortie programme, impayé, etc.) | Agrément retiré ou gelé côté contrat — portail bloqué. **Ce n'est pas** le simple passage « mode perso » dans l'app. |
| `suspended` | **Admin Krono** | Suspension contractuelle, litige — levée par l'admin. |

**Séparation `users.is_business` (mode business à l'usage) / `partners.status` (agrément)** : couper le mode business dans le profil app met `is_business` à `false` via `setBusinessMode` (endpoint dédié) — **sans** modifier `partners.status`. Le rallumage avec un partenaire déjà `active` remet `is_business` à `true` sans repasser en `pending`. Si le partenaire est `inactive` côté agrément, le portail reste bloqué jusqu'à action admin, même si l'utilisateur remet le toggle.

**`registerAsPartner`** : crée un partenaire `pending` + lien `partner_users` si absent ; si lien existant en `active` ou `pending`, met à jour le `plan` (et cohérence « none » + taux à la course) selon le corps de requête ; si `inactive`, ne rétablit pas l'agrément seul — message métier côté API indiquant qu'une réactivation admin peut être nécessaire.

**`activatePartner` (admin)** : `pending` → `active`, création de `partner_subscriptions` **active** si un plan forfait est déjà choisi, invitation portail best-effort sur `partners.email`.

**Séparation inactif administratif / sanction** : les actions admin « Désactiver » / « Suspendre » doivent rester **tracées** (`actor = admin`) dans les audits pour ne pas être confondues avec le toggle utilisateur (voir « Reste à faire » — table d'audit dédiée si absente).

**Lien `partner_users`** : conservé pour l'historique ; une désactivation agrément ne supprime pas automatiquement le lien utilisateur ↔ partenaire.

---

### Authentification portail partenaire (verifyPartnerUser)

Les routes `/api/partner/:partnerId/...` sont protégées par `verifyPartnerUser` :
1. Vérifie le token Bearer Supabase de l'utilisateur
2. Contrôle que cet utilisateur appartient au partenaire visé via `partner_users` (403 sinon)
3. Vérifie que `partners.status = 'active'` — si non, retourne 403 avec un message contextualisé :
   - `pending` → attente validation administrateur Krono
   - `inactive` / `suspended` → contacter le support Krono (agrément ou suspension — distinct du toggle mode business dans l'app)
4. Vérifie que `partners.plan ∈ {pro, business}` — si non, retourne 403 code `portal_plan_required` (Starter → message upgrade Pro/Business ; none → message choisir un forfait). Côté frontend, `verifyAccess()` lit le plan avant d'appeler le backend et redirige vers `/partner/:id/upgrade` si non éligible.
5. Injecte `req.partnerUser` (`userId`, `partnerId`, `role`) dans la requête

Un partenaire ne voit jamais les données d'un autre partenaire. Un partenaire non `active` n'accède à aucune route sensible du portail.

**Portail — banner de statut** : le layout `/partner/:partnerId/layout.tsx` affiche un bandeau contextuel en haut de chaque page si `partners.status ≠ active`. Le message varie selon `pending` / `inactive` / `suspended`.

**Admin — synchronisation temps réel** : les pages liste et fiche partenaire peuvent s'abonner à Supabase Realtime (`postgres_changes` sur `partners`) pour refléter les changements de **fiche partenaire** (statut, plan, etc.). Le simple toggle **mode business** dans l'app met à jour `users`, pas `partners` — une colonne « mode business » côté admin nécessiterait une autre source (poll, vue matérialisée ou Realtime sur `users` si activé). Prérequis pour les changements `partners` : activer Realtime sur la table `partners` dans Supabase Dashboard → Database → Replication.

### Portail — invitation, e-mail déjà dans Supabase Auth et configuration

**Comportement implémenté (backend)** : `inviteUserByEmail` est tenté en premier. Si Supabase renvoie une erreur du type *e-mail déjà enregistré*, le backend ne traite plus l’opération comme un échec fatal : résolution de l’utilisateur (`public.users`, puis liste Auth admin en secours), assurance du profil public (`ensurePublicUserProfileForAuthUser`), `upsert` sur `partner_users`, génération d’un lien **`magiclink`** via `auth.admin.generateLink` (repli **`recovery`** si besoin) avec `redirectTo = PARTNER_PORTAL_URL` (fallback codé vers la page de login portail prod si la variable est absente), envoi du lien par SMTP Krono quand il est configuré (`sendPartnerPortalMagicLinkEmail` dans `chrono_backend/src/services/emailService.ts`). Points d’entrée : `invitePartnerUser`, `invitePortalUser`, et à l’activation `activatePartner` (auto-invitation best-effort sur l’e-mail fiche partenaire). Fichier : `chrono_backend/src/controllers/partnerController.ts`.

**À valider en exploitation** (le code seul ne suffit pas) : déployer ou redémarrer le backend sur l’environnement cible ; tester « Inviter au portail » avec le **même** e-mail qu’un compte app client — la réponse doit réussir (plus de message brut *A user with this email address has already been registered*) ; **Supabase Dashboard → Authentication → URL configuration** : déclarer l’URL exacte de **`PARTNER_PORTAL_URL`** (page de connexion du portail) dans **Redirect URLs**, sinon les liens magic / recovery sont rejetés après clic.

**SMTP Krono** : dans `chrono_backend/.env`, renseigner `EMAIL_USER`, `EMAIL_PASS`, idéalement `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, et `EMAIL_HOST` / `EMAIL_PORT` si le fournisseur n’est pas celui par défaut ; redémarrer le backend ; retester réception du mail « Se connecter au portail ». Référence des variables : `chrono_backend/.env.example`.

**Sans SMTP Krono** : s’appuyer sur **Mot de passe oublié** sur la page de login du portail (SMTP / templates Auth côté Supabase) ; communiquer l’URL du portail et la consigne : une fois la ligne `partner_users` créée, la réinitialisation mot de passe Supabase permet la première connexion.

**Données / parcours (encore ouverts)** : rendre l’e-mail portail **obligatoire** à l’étape forfait (`app_chrono/app/(auth)/business-onboarding.tsx`) si le produit l’exige — aujourd’hui le flux peut partir sans e-mail portail si `users.email` est vide et que la validation ne bloque pas ; colonne **`users.partner_id`** : migration SQL et alignement avec `partner_users` si l’app ou les écrans admin doivent s’en servir comme source unique.

**Recette bout en bout** : app (parcours boutique → partenaire `pending`) → admin (activation, auto-liaison / invitation si e-mail connu) → admin (« Inviter au portail » ou renvoi) → portail (connexion, dashboard, commandes, facturation selon besoin).

**Vigilance** : vider les tables **`partners`** / B2B en SQL **ne supprime pas** les comptes **Supabase Authentication**. Les conflits « e-mail déjà utilisé » viennent d’Auth, pas seulement des lignes `partners`.

### Portail partenaire — alignement rôle unique et points ouverts

Cette liste regroupe le travail restant pour que le portail B2B, l'API et les types reflètent le même modèle d'accès (sans rôle intermédiaire « manager » si le produit ne le propose plus). À traiter en implémentation ; quand une règle devient définitive, la résumer dans les sections concernées ci-dessus et retirer l'item d'ici si besoin.

- **Rôles `partner_users`** : passer tous les enregistrements en `owner` et n'accepter que `owner` côté API — un seul modèle d'accès web ; éviter un rôle `manager` encore en base alors qu'on ne veut plus le produit ainsi.
- **UI portail** : retirer la logique « manager » dans le layout et la page Mon équipe (`admin_chrono/app/(partner)/partner/[partnerId]/layout.tsx`, `.../team/page.tsx`) — menu, textes, invitation « manager » — pour que l'UI colle au même modèle et ne suggère pas un accès restreint imposé par Krono.
- **Types TypeScript** : aligner `role`, `invitePartnerUser`, etc. (`admin_chrono/types`, `partnerApiService`) — éviter incohérences et bugs entre front et réalité des données.
- **Invitation équipe** : vérifier ou implémenter `POST /api/partners/:id/users/invite` (ou retirer l'appel côté front) — le portail s'en sert pour l'équipe ; sans route valide, la fonctionnalité est inutile ou cassée.
- **Séparation des droits** : revue courte des droits admin Krono vs portail partenaire — un compte partenaire ne doit pas pouvoir déclencher des actions réservées à l'équipe Krono.
- **Communication partenaire** : une phrase côté doc / FAQ partenaire — qui est invité au portail relève du choix de l'entreprise partenaire (responsabilité claire sans alourdir le produit).

---

### Compatibilité descendante — utilisateurs existants

Les utilisateurs déjà inscrits avant la mise à jour B2B **ne voient rien de nouveau**. L'écran `business-onboarding` est exclusivement dans le flux d'inscription (`complete-profile` → `business-onboarding`). Un utilisateur existant qui ouvre l'app passe directement à `/(tabs)`. Leur `user.is_business` est `undefined` (falsy) → `ActionCards` affiche les cartes standards. Zéro régression.

---

### Flux B2B bout-en-bout

#### 1. Nouvel utilisateur lambda
```
Inscription → OTP → CompleteProfile → business-onboarding
  → "Non, j'envoie pour moi" → Success → Accueil standard
  (is_business=undefined, ActionCards standards)
```

#### 2. Nouvel utilisateur professionnel
```
Inscription → OTP → CompleteProfile → business-onboarding
  → "Oui, je suis professionnel" → saisit "Acme Express"
  → store: { is_business: true, company_name: "Acme Express", partner_id: null }
  → Accueil B2B (ActionCards: Livraison Client | Tournée Lots)
  → si appuie sans partner_id → Alert "Compte non lié — contacter Krono"
  → Admin lie le partenaire → utilisateur se reconnecte → partner_id disponible
```

#### 3. Admin crée et active un partenaire
```
admin_chrono → /partners → Nouveau partenaire → name, commission_rate
  → POST /api/partners → partners.status="pending"
  → Fiche partenaire → Créer abonnement Pro → POST /api/partners/:id/subscriptions
  → Confirmer paiement → PATCH .../activate → is_active=true, plan="pro"
  → KPIs : 0/200 courses, taux 3%
```

#### 4. Livraison client unique (Profil 1)
```
Accueil B2B → "Livraison Client" → NewB2BShippingModal
  → pickup/dropoff (Mapbox autocomplete) + destinataire + véhicule
  → createB2BOrder({ partnerId, userId, ... })
  → POST /api/orders/record (verifyJWT)
  → computeB2BCommission → in-quota → rate=3%
  → incrementPartnerUsage → deliveries_count++
  → Success : "#A1B2C3D4"
```

#### 5. Tournée groupée (Profil 2)
```
Accueil B2B → "Tournée Lots" → BatchShippingBottomSheet (3 étapes)
  Étape 1 : adresse départ + liste de 3 destinataires ajoutés un par un
  Étape 2 : sélection livreur attitré (GET /api/partners/:id/drivers) ou auto
  Étape 3 : récap → "Lancer la tournée"
    → createBatch() :
        1. POST /api/orders/record × 3 (un par destinataire)
        2. POST /api/batches { partner_id, driver_id, orders:[id1,id2,id3] }
            → haversine nearest-neighbor → ordre optimisé [2,0,1]
            → INSERT delivery_batches + batch_orders (positions 1,2,3)
            → incrementPartnerUsage × 3
            → emit batch-assigned { batchId, ordersCount:3, status:"offer" } si auto
            → ou assignation directe si driver_id explicite
  → Step 'success' : ordre optimisé affiché
```

#### 6. Livreur reçoit et exécute la tournée
```
Socket "batch-assigned" reçu { batchId, ordersCount:3 }
  → son + haptic
  → popup custom "Nouvelle tournée B2B - 3 livraisons à effectuer"
  → [Accepter] émet accept-batch { batchId }
  → confirmation backend → useBatchStore.setActiveBatch({ id: batchId, ordersCount:3, stops:[] })
  → router.push("/batch/batch_xyz")

BatchScreen monte :
  → GET /api/batches/batch_xyz (verifyJWT) → stops ordonnés par position
  → Affiche : barre de progression 0/3 + liste ordonnée

Pour chaque stop :
  → Scanner QR : POST /api/qr-codes/scan avec expectedOrderId=orderId
  → ou Entrer le code : POST /api/qr-codes/manual avec orderId
  → ou Preuve alternative : photo + nom/signature + GPS
  → PATCH /api/batches/:id/orders/:orderId { status:"completed", proofMethod }
  → backend vérifie remaining → si 0 : delivery_batches.status="completed"
  → updateStop locale → progress ++

Appui long "Preuve alternative" → confirmation annulation → PATCH status:"cancelled"

Quand remaining=0 → écran "Tournée terminée !" → retour accueil
```

#### 7. Portail partenaire
```
/partner/:partnerId/dashboard → auth Supabase + verifyAccess(partner_users)
  → KPIs aujourd'hui + quota mensuel
  → Commandes : filtrer par date, statut, créer une nouvelle
  → Facturation (owner) : plan, quota, historique factures
  → Équipe (owner) : membres, inviter
```

#### 8. Job facturation mensuel (1er du mois)
```
setInterval 24h → maybeRunInvoiceJob()
  → new Date().getDate() === 1 → OUI
  → Pour chaque partenaire actif :
      excess = deliveries_count - quota (si > 0)
      amount = monthly_price + excess × excess_commission_rate × 1000
      anti-doublon → INSERT partner_invoices
```

---

### Routes B2B exposées

**Admin uniquement (`verifyAdminSupabase`)**

| Méthode | Route | Action |
|---|---|---|
| `POST` | `/api/partners` | Créer un partenaire |
| `GET` | `/api/partners` | Lister les partenaires (filtre status/plan) |
| `GET` | `/api/partners/:id` | Détail partenaire + abonnement actif + usage courant |
| `POST` | `/api/partners/:id/subscriptions` | Créer un abonnement (`pending_payment`) |
| `PATCH` | `/api/partners/:id/subscriptions/:subId/activate` | Valider paiement → activer l'abonnement |
| `GET` | `/api/partners/:id/usage` | Quota du mois courant |
| `GET` | `/api/partners/:id/invoices` | Historique factures |
| `GET` | `/api/partners/:id/drivers` | Lister les livreurs dédiés |
| `POST` | `/api/partners/:id/drivers` | Rattacher un livreur dédié existant |
| `DELETE` | `/api/partners/:id/drivers/:driverUserId` | Retirer un livreur dédié |
| `PATCH` | `/api/partners/:id/drivers/:driverUserId/default` | Définir le livreur par défaut |
| `GET` | `/api/partners/:id/driver-requests` | Lister les demandes de livreur dédié |
| `PATCH` | `/api/partners/:id/driver-requests/:requestId` | Valider ou refuser une demande |

**JWT standard (`verifyJWT`) — mobile partenaire + livreur**

| Méthode | Route | Action |
|---|---|---|
| `POST` | `/api/batches` | Créer une tournée (app mobile partenaire) |
| `GET` | `/api/batches/:id` | Détail tournée + commandes ordonnées (livreur) |
| `PATCH` | `/api/batches/:id/orders/:orderId` | Valider / annuler une livraison (livreur) |

**Portail partenaire (`verifyPartnerUser`)**

| Méthode | Route | Action |
|---|---|---|
| `GET` | `/api/partner/:partnerId/details` | Voir sa propre fiche |
| `GET` | `/api/partner/:partnerId/usage` | Voir son quota du mois |
| `GET` | `/api/partner/:partnerId/invoices` | Voir ses factures |
| `GET` | `/api/partner/:partnerId/drivers` | Voir les livreurs dédiés validés par Krono |
| `POST` | `/api/partner/:partnerId/driver-requests` | Demander un livreur dédié |
| `PATCH` | `/api/partner/:partnerId/preferences` | Activer/désactiver l'usage des livreurs préférés |

---

### Notification tournée — règle anti-spam

Un batch de N commandes n'envoie **qu'une seule notification** au livreur via `emitBatchAssigned`. Les N commandes individuelles sont créées silencieusement via REST (pas de `notifyDriversForOrder`). Aucune popup d'offre individuelle n'apparaît pour les commandes appartenant à une tournée.

Si le livreur est hors ligne au moment du socket, la push `batch_assigned` (`driverPushService.ts`) lui permet de naviguer directement vers l'écran `/batch/:id` à l'ouverture de l'app.

---

### Comportement selon le profil utilisateur

| Profil | Ce qu'il voit | Précondition |
|---|---|---|
| Utilisateur existant (avant MàJ) | Accueil standard, rien ne change | Aucune |
| Nouvel utilisateur lambda | Onboarding B2B → dit Non → standard | Inscription après MàJ |
| Nouvel utilisateur pro (non activé) | Boutons B2B affichés, mais bloqués | `is_business=true, partner_id=null` |
| Utilisateur business activé | Livraison Client + Tournée Lots fonctionnels | `partner_id` lié par admin + re-login |
| Partenaire (portail web) | Dashboard, commandes, facturation, équipe | Compte `partner_users` + Supabase Auth |
| Admin | Gestion complète partenaires + abonnements | Supabase Admin Auth |
| Livreur (commande B2B unitaire) | `OrderRequestPopup` classique | Flow normal |
| Livreur attitré (tournée) | Écran `/batch/:id` avec liste ordonnée | `batch-assigned` socket/push |

---

### Carte des fichiers B2B

**Backend**

| Sujet | Fichier |
|---|---|
| Contrôleur partenaire | `chrono_backend/src/controllers/partnerController.ts` |
| E-mail lien portail (magic / recovery) | `chrono_backend/src/services/emailService.ts` |
| Contrôleur tournées | `chrono_backend/src/controllers/batchController.ts` |
| Logique commission B2B | `chrono_backend/src/services/b2bCommissionService.ts` |
| Job facturation mensuel | `chrono_backend/src/jobs/partnerInvoiceJob.ts` |
| Middleware auth partenaire | `chrono_backend/src/middleware/verifyPartnerUser.ts` |
| Routes partenaire (admin) | `chrono_backend/src/routes/partnerRoutes.ts` |
| Routes tournées (JWT) | `chrono_backend/src/routes/batchRoutes.ts` |
| Optimisation itinéraire | `chrono_backend/src/utils/haversine.ts` |
| Notification socket tournée | `chrono_backend/src/sockets/orderSocket.ts` (`emitBatchAssigned`) |

**Admin (`admin_chrono`)**

| Sujet | Fichier |
|---|---|
| Liste partenaires | `admin_chrono/app/(dashboard)/partners/page.tsx` |
| Fiche partenaire | `admin_chrono/app/(dashboard)/partners/[id]/page.tsx` |
| Layout portail partenaire | `admin_chrono/app/(partner)/partner/[partnerId]/layout.tsx` |
| Page upgrade (Starter / none bloqué portail) | `admin_chrono/app/(partner)/partner/[partnerId]/upgrade/page.tsx` |
| Dashboard portail | `admin_chrono/app/(partner)/partner/[partnerId]/dashboard/page.tsx` |
| Commandes portail | `admin_chrono/app/(partner)/partner/[partnerId]/orders/page.tsx` |
| Nouvelle commande portail | `admin_chrono/app/(partner)/partner/[partnerId]/orders/new/page.tsx` |
| Facturation portail | `admin_chrono/app/(partner)/partner/[partnerId]/billing/page.tsx` |
| Équipe portail | `admin_chrono/app/(partner)/partner/[partnerId]/team/page.tsx` |
| Service API portail | `admin_chrono/lib/partnerApiService.ts` |

**App client (`app_chrono`)**

| Sujet | Fichier |
|---|---|
| Onboarding B2B | `app_chrono/app/(auth)/business-onboarding.tsx` |
| Store mode business / tournées | `app_chrono/store/useBusinessStore.ts` |
| API partenaire mobile | `app_chrono/services/partnerApi.ts` |
| Modal livraison client (Profil 1) | `app_chrono/components/NewB2BShippingModal.tsx` |
| Bottom sheet tournée (Profil 2) | `app_chrono/components/BatchShippingBottomSheet.tsx` |
| Cartes d'action (standard + B2B) | `app_chrono/components/ActionCards.tsx` |

**App chauffeur (`driver_chrono`)**

| Sujet | Fichier |
|---|---|
| Store tournée active | `driver_chrono/store/useBatchStore.ts` |
| API tournées | `driver_chrono/services/batchApiService.ts` |
| Écran tournée B2B | `driver_chrono/app/batch/[batchId].tsx` |

---

### Simulation — comment le livreur reçoit les commandes (référence produit)

Trois cas possibles selon la nature de la commande.

#### Cas 1 — Commande classique (client particulier, 1 livraison)

```
CLIENT APP              BACKEND                  LIVREUR APP
    │                      │                          │
    │── passe commande ──►  │                          │
    │                      │── socket "new-order" ──► │
    │                      │                          │ [POPUP s'affiche — 30s]
    │                      │                          │  "Jean Dupont — 2 500 FCFA"
    │                      │                          │  [Accepter] [Décliner]
    │                      │ ◄── "accept-order" ──────│
    │                      │── confirmation ─────────►│
    │                      │                          │ [BottomSheet] → navigation
    │                      │                          │ → [Je pars] → géofencing auto
    │                      │                          │ → [Scanner QR] → TERMINÉ ✓
```

#### Cas 2 — Tournée B2B (1 partenaire, N livraisons)

**1 seule notification groupée**, pas N popups séparées.

```
ADMIN                   BACKEND                  LIVREUR APP
    │                      │                          │
    │── crée N livraisons   │                          │
    │   pour "Resto Chez    │                          │
    │   Maman" ──────────►  │                          │
    │                      │ crée batch + optimise     │
    │                      │ l'ordre (haversine)       │
    │                      │── socket "batch-assigned"►│
    │                      │   { batchId, ordersCount, │
    │                      │     partner_name }        │
    │                      │                          │ Son + vibration
    │                      │                          │ → router.push("/batch/id")
    │                      │                          │ → GET /api/batches/:id
    │                      │                          │ → liste ordonnée affichée
```

Écran tournée — ce que voit le livreur :

```
┌────────────────────────────────────────┐
│  ←  Resto Chez Maman              🔄   │
│     #BATCH_XYZ                         │
│  3/10 livraisons       7 restantes     │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░       │
│                                        │
│  ①  Mamadou Diallo               📞   │
│     12 Rue des Peupliers              │
│     [Scanner QR] [Entrer code]        │
│     [Preuve alternative]              │
│  ②✓ Aïssa Koné          QR validé     │
│  ③✓ Ibrahima Sow         Code validé  │
│  ④  Fatou Traoré                 📞   │
│     45 Ave de la Paix                 │
│     [Scanner QR] [Entrer code]        │
│  ⑤…⑥…⑦…⑧…⑨…⑩                       │
│                                        │
│  Appui long sur preuve alternative     │
│  → annuler une livraison               │
└────────────────────────────────────────┘
```

Le livreur valide **stop par stop** dans l'ordre qu'il veut. Chaque stop doit avoir sa propre preuve. Quand tout est `completed` ou `cancelled` → écran "Tournée terminée !".

#### Cas 3 — Commande B2B individuelle (1 livraison d'un partenaire)

Même flux que le Cas 1, mais la popup affiche le contexte B2B :

```
┌────────────────────────────────────────┐
│  [🧳 Commande B2B]                     │
│  Partenaire : Resto Chez Maman         │
│  Livraison 2/5 de la tournée           │
│  ─────────────────────────────────     │
│  Jean Dupont ⭐4.8          2 500 FCFA │
│  Moto · 3.2 km · 12 min               │
│  [Décliner]          [Accepter]        │
└────────────────────────────────────────┘
```

#### Tableau récapitulatif

| Situation | Notification livreur | Comment valider |
|---|---|---|
| Client standard, 1 livraison | Popup d'acceptation (30s) | Géofencing + QR |
| Partenaire B2B, 1 livraison | Popup avec badge B2B + nom partenaire | Idem |
| Partenaire B2B, N livraisons (tournée) | 1 popup tournée avec `ordersCount` → écran liste des stops | QR/code/preuve alternative par stop |

#### Règle socket (anti-spam tournée)

```
Tournée (batch)        → socket "batch-assigned"   → écran /batch/[id]
Commande individuelle  → socket "new-order-request" → popup d'acceptation
```

Les N commandes d'un batch sont créées **silencieusement** via REST. Aucune popup individuelle n'apparaît pour une commande appartenant à une tournée.

Si deux événements `batch-assigned` arrivent pour le même `batchId`, l'app chauffeur garde une seule popup visible. Si le livreur refuse, ce `batchId` est mis en sourdine pour la session afin d'éviter une reproposition immédiate en boucle.

---

### État d'avancement B2B (au 2026-05-07)

| Bloc | Contenu | Statut |
|---|---|---|
| **Bloc 1** | Migrations SQL `032`→`037` (8 tables + `partner_id` sur `orders` + statut `inactive`) | ⏳ À appliquer sur chaque projet Supabase (SQL Editor, dans l'ordre) |
| **Bloc 2** | Routes backend, `computeB2BCommission` dans `orderRecordController`, tournées, facturation, middleware | ✅ Implémenté |
| **Bloc 3** | Interface admin : créer/gérer partenaires, activer abonnements + portail partenaire complet | ✅ Implémenté |
| **Bloc 4** | `app_chrono` : onboarding B2B, Profil 1 (livraison client), Profil 2 (tournée), ActionCards, `setBusinessMode` pour le toggle | ✅ Implémenté |
| **Bloc 5** | `driver_chrono` : réception tournée groupée (1 popup), déduplication par `batchId`, vue ordonnée, QR/code/preuve alternative par livraison, contexte partenaire | ✅ Implémenté |
| **Bloc 6** | Grille tarifaire v2 (forfaits + paiement à la course) | ✅ Alignée doc + `PLAN_DEFAULTS` + `QUOTA_COMMISSION` (toute évolution : une seule source puis propagation) |
| **Bloc 7** | Statuts, séparation agrément / mode business, sécurité portail, sync admin temps réel | ✅ Implémenté (ajustements audit voir ci-dessous) |
| **Bloc 8** | Segmentation Starter (petit B2B) vs Pro/Business (grand B2B) : blocage portail API 403 + redirection frontend page upgrade + `b2b_tier` / `portal_eligible` exposés dans `getPartner` | ✅ Implémenté |
| **Bloc 9** | Livreurs dédiés partenaires : gestion admin, demandes portail, sélection commande/tournée, opt-in B2B et fallback automatique | ✅ Implémenté |

**Reste à faire :**
1. Appliquer les migrations `032` → `037`, puis `041` sur l'environnement Supabase cible (dans l'ordre) — la `037` ajoute `inactive` au CHECK de `partners.status`, la `041` ajoute les demandes de livreur dédié et renforce `partner_drivers`.
2. Synchroniser `partner_id` dans `useAuthStore` lors du `validateUser` si besoin (éviter alertes « compte non lié » après onboarding sans re-login).
3. Assouplir la condition `partner_id` dans `NewB2BShippingModal` : Profil 1 (`is_business=true`, `partner_id=null`) doit pouvoir créer des livraisons avec commission selon règle métier (voir section « Concepts fondamentaux » et grille sans abonnement).
4. **Audit / traçabilité** (non implémenté) : journaliser désactivation, réactivation et suspension avec `user_id` / `partner_id` / `ancien_statut` / `nouveau_statut` / `timestamp` / `source` (`app` | `admin` | `portail`). Créer une table `partner_audit_logs` ou enrichir les logs backend existants.
5. Activer Realtime sur la table `partners` dans Supabase Dashboard (Database → Replication) pour que la sync admin instantanée fonctionne.
6. API suppression / fusion partenaire, unicité stricte, CGU : voir « Périmètre encore ouvert » dans la section principes partenaire ci-dessus.

### Roadmap produit

**Phase 1bis / Phase 2 — Monétisation scale**
- [ ] Paiement abonnement récurrent / automatisé (prestataires locaux : OM, Wave, MTN)
- [ ] Renouvellement auto `partner_subscriptions` : `cancelled_at`, politique `ends_at` nullable

**Phase 2 — ~6 mois après lancement**
- [ ] Portail partenaire : Facturation + Équipe (côté partenaire self-service)
- [ ] Table `partner_api_keys`
- [ ] Endpoint `POST /api/partner/orders` (Axe 3)
- [ ] Webhooks signés avec retries
- [ ] WhatsApp bot pour création de commande rapide

**Phase 3 — ~12 mois et au-delà**
- [ ] Marque blanche (Axe 4)
- [ ] Flotte dédiée Enterprise (Axe 5)
- [ ] Publicité et analytics (Axe 6)
- [ ] Séparation `partner_chrono` en app indépendante si nécessaire

---

### Feature Commissionnaire (hors périmètre B2B)

Le commissionnaire est une feature **B2C** distincte : le livreur agit à la place du client (courses, achats ponctuels) — ce n'est pas une livraison classique point A → point B avec colis déjà prêt. Pas de mélange avec la logique B2B (tables `partners`, abonnements, pricing).

À documenter dans `docs/commissionnaire.md` : parcours, pricing, avance de fonds, qui avance l'argent, plafond budget, article indisponible, assurance / litiges.

---

## 17. Documents vivants

Il doit rester un fichier principal de référence dans `docs/` :

- `docs/krono-reference-unique.md` : référence projet, contrat produit, décisions, cartes de fichiers — y compris principes, glossaire, parcours et dette ouverte **partenaire B2B** (section 16), source unique à tenir alignée avec le code.
