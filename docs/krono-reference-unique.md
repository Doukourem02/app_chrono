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
| **Contrôleur partenaire (admin)** | `chrono_backend/src/controllers/partnerController.ts` |
| **Contrôleur tournées** | `chrono_backend/src/controllers/batchController.ts` |
| **Commission B2B** | `chrono_backend/src/services/b2bCommissionService.ts` |
| **Job facturation mensuel** | `chrono_backend/src/jobs/partnerInvoiceJob.ts` |
| **Middleware auth portail partenaire** | `chrono_backend/src/middleware/verifyPartnerUser.ts` |
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

Décision ouverte : scan obligatoire avant `completed` ou preuve complémentaire seulement.

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

### Pourquoi le B2B

Krono sert aujourd'hui des particuliers (B2C). Le B2B cible des professionnels — e-commerces, restaurants, pharmacies, boutiques — qui ont des volumes élevés et réguliers. Au lieu de payer 15-25 % de commission sur chaque course, ils s'abonnent à un forfait mensuel avec un quota de livraisons incluses.

Revenus Krono : forfait prévisible + commissions sur excédents. Valeur partenaire : coût réduit par livraison, tournées groupées, portail dédié.

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

C'est une **entité distincte** créée par l'admin dans la table `partners`. Elle a un plan d'abonnement, un quota mensuel, une facturation automatique, et un accès au portail web. Elle peut avoir plusieurs utilisateurs liés (ex : 3 gestionnaires d'une même enseigne).

> **Exemple concret :** MedExpress est une chaîne de pharmacies avec 150 livraisons/mois. L'admin Krono crée une fiche partenaire "MedExpress" dans `partners`, lui attribue le plan Pro (200 courses/mois, 3 % de commission). Les 3 managers de MedExpress sont ensuite liés à ce partenaire via `partner_users`. Ils accèdent au portail web `/partner/:id/dashboard` pour voir leurs commandes, leur quota, leurs factures.

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
| Profil 1 (petit commerçant) | `true` | `null` | ✅ Doit pouvoir créer des livraisons — commission par défaut 3 % |
| Profil 2 (volume modéré) | `true` | `null` ou lié | ✅ Tournées disponibles — commission selon abonnement si lié |
| Profil 3 (entreprise) | `true` | lié par admin | ✅ Quota, facturation, portail — commission selon plan |

Le `partner_id` est requis seulement pour les fonctionnalités liées à l'abonnement (quota, facturation, portail). La création de commande B2B de base doit fonctionner avec `is_business: true` seul, avec un taux de commission par défaut. **Ce point est à corriger** dans `NewB2BShippingModal` et `b2bCommissionService` (voir "Reste à faire" en fin de section).

---

### Plans tarifaires B2B (validés le 2026-05-02)

| Plan | Prix mensuel | Quota inclus | Commission in-quota | Commission excédent |
|---|---|---|---|---|
| **Starter** | 15 000 FCFA | 50 courses | 3 % | 20 % |
| **Pro** | 40 000 FCFA | 200 courses | 3 % | 15 % |
| **Business** | 100 000 FCFA | Illimité | 0 % | 10 % |

Sans abonnement : taux standard du partenaire (15-25 %, champ `partners.commission_rate`).

---

### Schéma de données B2B

8 tables créées par les migrations `032` → `035` :

| Table | Rôle |
|---|---|
| `partners` | Fiche entreprise partenaire (nom, email, téléphone, plan, commission_rate, status) |
| `partner_users` | Utilisateurs du partenaire (`owner` / `manager`) — porte l'accès portail |
| `partner_drivers` | Livreurs attitrés d'un partenaire |
| `partner_subscriptions` | Abonnement actif (`pending_payment` → `active`), historique des plans |
| `partner_usage` | Compteur mensuel de livraisons par partenaire (upsert atomique SQL) |
| `partner_invoices` | Factures mensuelles générées automatiquement |
| `delivery_batches` | Tournées groupées (ensemble de commandes à livrer en une sortie) |
| `batch_orders` | Lien tournée ↔ commandes, avec position optimisée |

La table `orders` reçoit une colonne `partner_id UUID REFERENCES partners(id)` pour rattacher chaque commande B2B à son partenaire.

---

### Logique commission B2B (b2bCommissionService)

À chaque commande B2B, trois cas :

1. **Abonnement actif + quota non dépassé** → taux `in_quota` (3 % Starter/Pro, 0 % Business)
2. **Abonnement actif + quota dépassé** → `excess_commission_rate` (10-20 % selon plan)
3. **Pas d'abonnement** → taux standard `partners.commission_rate` (15-25 %)

Le compteur `partner_usage.deliveries_count` est incrémenté via un `INSERT … ON CONFLICT DO UPDATE` SQL atomique pour éviter les doublons en cas de requêtes simultanées.

---

### Tournées (delivery_batches)

Un partenaire B2B livre souvent plusieurs commandes en une seule sortie (ex : 8 colis confiés à un livreur). Le système :

1. Crée une tournée (`delivery_batches`) regroupant les commandes
2. Optimise automatiquement l'ordre de passage via l'algorithme nearest-neighbor (haversine)
3. Permet au livreur de valider chaque livraison une par une
4. Clôture la tournée automatiquement quand toutes les commandes sont `completed` ou `cancelled`

---

### Facturation mensuelle (partnerInvoiceJob)

Un **job** est une tâche automatique qui tourne en arrière-plan sans intervention humaine. Le `partnerInvoiceJob` est un job Node.js planifié sur un timer de 24h. À chaque déclenchement il vérifie si on est le 1er du mois — si oui, il génère les factures ; sinon, il ne fait rien.

Contenu de la facture générée :
- **Forfait mensuel** (fixe selon le plan)
- **Surplus** : estimation des commandes excédentaires × `excess_commission_rate` × prix moyen (Phase 1 : 1 000 FCFA/course — à rapprocher des transactions réelles en Phase 2)
- Garde anti-doublon : si une facture existe déjà pour ce partenaire / cette période, rien n'est créé

---

### Authentification portail partenaire (verifyPartnerUser)

Les routes `/api/partner/:partnerId/...` sont protégées par `verifyPartnerUser` :
1. Vérifie le token Bearer Supabase de l'utilisateur
2. Contrôle que cet utilisateur appartient au partenaire visé via `partner_users`
3. Injecte `req.partnerUser` (`userId`, `partnerId`, `role`) dans la requête

Un partenaire ne voit jamais les données d'un autre partenaire.

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
            → emitBatchAssigned(driver_id, { batchId, ordersCount:3 })
  → Step 'success' : ordre optimisé affiché
```

#### 6. Livreur reçoit et exécute la tournée
```
Socket "batch-assigned" reçu { batchId, ordersCount:3 }
  → son + haptic
  → useBatchStore.setActiveBatch({ id: batchId, ordersCount:3, stops:[] })
  → router.push("/batch/batch_xyz")

BatchScreen monte :
  → GET /api/batches/batch_xyz (verifyJWT) → stops ordonnés par position
  → Affiche : barre de progression 0/3 + liste ordonnée

Pour chaque stop → appuie "Livré ✓" :
  → PATCH /api/batches/:id/orders/:orderId { status:"completed" }
  → backend vérifie remaining → si 0 : delivery_batches.status="completed"
  → updateStop locale → progress ++

Appui long "Livré ✓" → Alert annulation → PATCH status:"cancelled"

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
│     12 Rue des Peupliers      Livré ✓  │
│  ②✓ Aïssa Koné          [Livré]       │
│  ③✓ Ibrahima Sow         [Livré]      │
│  ④  Fatou Traoré                 📞   │
│     45 Ave de la Paix         Livré ✓  │
│  ⑤…⑥…⑦…⑧…⑨…⑩                       │
│                                        │
│  Appui long sur « Livré ✓ » → annuler  │
└────────────────────────────────────────┘
```

Le livreur valide **stop par stop** dans l'ordre qu'il veut. Quand tout est `completed` ou `cancelled` → écran "Tournée terminée !".

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
| Partenaire B2B, N livraisons (tournée) | 1 notification → écran liste des stops | Bouton "Livré ✓" par stop |

#### Règle socket (anti-spam tournée)

```
Tournée (batch)        → socket "batch-assigned"   → écran /batch/[id]
Commande individuelle  → socket "new-order-request" → popup d'acceptation
```

Les N commandes d'un batch sont créées **silencieusement** via REST. Aucune popup individuelle n'apparaît pour une commande appartenant à une tournée.

---

### État d'avancement B2B (au 2026-05-03)

| Bloc | Contenu | Statut |
|---|---|---|
| **Bloc 1** | Migrations SQL `032`→`035` (8 tables + `partner_id` sur `orders`) | ⏳ À appliquer dans Supabase SQL Editor |
| **Bloc 2** | Routes backend, commission, tournées, facturation, middleware | ✅ Implémenté |
| **Bloc 3** | Interface admin : créer/gérer partenaires, activer abonnements + portail partenaire complet | ✅ Implémenté |
| **Bloc 4** | `app_chrono` : onboarding B2B, Profil 1 (livraison client), Profil 2 (tournée), ActionCards | ✅ Implémenté |
| **Bloc 5** | `driver_chrono` : réception tournée groupée (1 notif), vue ordonnée, validation par livraison, contexte partenaire (nom, position tournée, bouton "Voir la tournée") | ✅ Implémenté (2026-05-03) |
| **Bloc 6** | Décision commission Option A/B | ✅ Validé : Option B (3 % Starter/Pro, 0 % Business) |

**Reste à faire :**
1. Appliquer les migrations `032` → `035` dans Supabase SQL Editor (dans l'ordre) — tout le reste en dépend
2. Brancher `computeB2BCommission` dans le flux de création de commande (`orderRecordController`)
3. Synchroniser `partner_id` dans `useAuthStore` lors du `validateUser` (pour ne pas forcer re-login)
4. Assouplir la condition `partner_id` dans `NewB2BShippingModal` : Profil 1 (`is_business=true`, `partner_id=null`) doit pouvoir créer des livraisons avec commission par défaut 3 % — le blocage actuel est trop restrictif (voir section "Concepts fondamentaux")

---

## 17. Documents vivants

Il doit rester un fichier principal de référence dans `docs/` :

- `docs/krono-reference-unique.md` : référence projet, contrat produit, décisions, cartes de fichiers.
