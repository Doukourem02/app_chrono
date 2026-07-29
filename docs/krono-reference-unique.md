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
| Live Activity / Dynamic Island | `app_krono/services/orderLiveActivity.ts` |
| UI Dynamic Island SwiftUI/Expo UI | `app_krono/widgets/orderTrackingLiveActivity.tsx` |
| Sync Live Activity depuis le store | `app_krono/hooks/useOrderLiveActivitySync.ts` |
| Socket commande client | `app_krono/services/userOrderSocketService.ts` |
| Push client / tap notification | `app_krono/services/clientPushService.ts` |
| Notification Android foreground service client | `app_krono/services/clientBackgroundLocation.ts` |
| Écran suivi commande | `app_krono/app/order-tracking/[orderId].tsx` |
| Auth client | `app_krono/store/useAuthStore.ts` |
| Refresh token client | `app_krono/utils/secureTokenStorage.ts` |
| **Onboarding B2B** | `app_krono/app/(auth)/business-onboarding.tsx` |
| **Store mode business / tournées** | `app_krono/store/useBusinessStore.ts` |
| **API partenaire mobile** | `app_krono/services/partnerApi.ts` |
| **Modal livraison client B2B (Profil 1)** | `app_krono/components/NewB2BShippingModal.tsx` |
| **Bottom sheet tournée (Profil 2)** | `app_krono/components/BatchShippingBottomSheet.tsx` |
| **Cartes d'action (standard + B2B)** | `app_krono/components/ActionCards.tsx` |

### App chauffeur

| Sujet | Fichier |
|---|---|
| Push chauffeur / tap notification | `driver_krono/services/driverPushService.ts` |
| Notification Android foreground service chauffeur | `driver_krono/services/driverBackgroundLocation.ts` |
| Auth chauffeur | `driver_krono/store/useDriverStore.ts` |
| Sockets commandes | `driver_krono/services/orderSocketService.ts` |
| Sockets messages | `driver_krono/services/driverMessageSocketService.ts` |
| Dépannage app chauffeur | `driver_krono/docs/TROUBLESHOOTING.md` |
| **Store tournée active** | `driver_krono/store/useBatchStore.ts` |
| **API tournées chauffeur** | `driver_krono/services/batchApiService.ts` |
| **Écran tournée B2B** | `driver_krono/app/batch/[batchId].tsx` |
| **Encart admin / B2B / hors-ligne** | `driver_krono/components/AdminOrderInfo.tsx` |
| **Normalisation flags commande** | `driver_krono/utils/mapAdminOrderFlags.ts` |
| **Store commande livreur** | `driver_krono/store/useOrderStore.ts` |

### Backend

| Sujet | Fichier |
|---|---|
| Socket commande | `krono_backend/src/sockets/orderSocket.ts` |
| Push Expo | `krono_backend/src/services/expoPushService.ts` |
| Notifications destinataire | `krono_backend/src/services/recipientOrderNotifyService.ts` |
| SMS Twilio | `krono_backend/src/services/twilioSmsService.ts` |
| Track public | `krono_backend/src/controllers/trackController.ts`, `routes/trackRoutes.ts` |
| Prix livraison | `krono_backend/src/services/priceCalculator.ts` |
| Tarification dynamique | `krono_backend/src/services/dynamicPricing.ts` |
| QR livraison | `krono_backend/src/services/qrCodeService.ts` |
| Commission livreur | `krono_backend/src/services/commissionService.ts` |
| **Création commande admin (hors-ligne / téléphone / B2B)** | `krono_backend/src/controllers/adminController.ts` (`createAdminOrder`, `_chrono_admin`) |
| **Contrôleur partenaire — CRUD/statut** | `krono_backend/src/controllers/partnerCrudController.ts` |
| **Contrôleur partenaire — invitations portail** | `krono_backend/src/controllers/partnerUserController.ts` |
| **Contrôleur partenaire — abonnements/factures** | `krono_backend/src/controllers/partnerSubscriptionController.ts` |
| **Contrôleur partenaire — livreurs dédiés** | `krono_backend/src/controllers/partnerDriverController.ts` |
| **`partnerController.ts` (legacy)** | Code mort à ~95 % (mêmes noms de fonctions que les 4 fichiers ci-dessus, jamais routés) — seules `getPartnerOrderTracking`/`getPartnerOrderQRCode` y sont encore branchées (`partnerRoutes.ts`) |
| **Contrôleur tournées** | `krono_backend/src/controllers/batchController.ts` |
| **Commission B2B** | `krono_backend/src/services/b2bCommissionService.ts` |
| **Job facturation mensuel** | `krono_backend/src/jobs/partnerInvoiceJob.ts` |
| **Middleware auth portail partenaire** | `krono_backend/src/middleware/verifyPartnerUser.ts` |
| **E-mail lien portail (magic / recovery)** | `krono_backend/src/services/emailService.ts` (`sendPartnerPortalMagicLinkEmail`) |
| **Notification socket tournée** | `krono_backend/src/sockets/orderSocket.ts` (`emitBatchAssigned`) |
| **Optimisation itinéraire** | `krono_backend/src/utils/haversine.ts` |

### Admin / web

| Sujet | Fichier |
|---|---|
| Page tracking public | `admin_krono/app/track/[token]/page.tsx` |
| Web push tracking | `admin_krono/public/sw.js` |
| Performance dashboard / analytics | `admin_krono/app/(dashboard)/gamification/page.tsx` |
| Performance analytics API | `admin_krono/app/api/analytics/performance/route.ts` |
| **Liste partenaires B2B** | `admin_krono/app/(dashboard)/partners/page.tsx` |
| **Fiche partenaire (KPIs + abonnement + factures)** | `admin_krono/app/(dashboard)/partners/[id]/page.tsx` |
| **Layout portail partenaire** | `admin_krono/app/(partner)/partner/[partnerId]/layout.tsx` |
| **Page upgrade (Starter / none bloqué portail)** | `admin_krono/app/(partner)/partner/[partnerId]/upgrade/page.tsx` |
| **Dashboard portail partenaire** | `admin_krono/app/(partner)/partner/[partnerId]/dashboard/page.tsx` |
| **Commandes portail partenaire** | `admin_krono/app/(partner)/partner/[partnerId]/orders/page.tsx` |
| **Nouvelle commande portail** | `admin_krono/app/(partner)/partner/[partnerId]/orders/new/page.tsx` |
| **Facturation portail partenaire** | `admin_krono/app/(partner)/partner/[partnerId]/billing/page.tsx` |
| **Équipe portail partenaire** | `admin_krono/app/(partner)/partner/[partnerId]/team/page.tsx` |
| **Service API portail partenaire** | `admin_krono/lib/partnerApiService.ts` |

---

## 2. Cycle officiel d'une commande

**Déplacé dans `docs/logique_livraison.md` (section 1)** — cycle de statuts, tableau étape par étape (client/chauffeur/Live Activity/notification), statuts canoniques `order_status`.

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
|---|---|---|
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
|---|---|---|---|
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
- Apps `app_krono` / `driver_krono` avec `expo-notifications`.
- Envoi backend via `krono_backend/src/services/expoPushService.ts`.
- `DeviceNotRegistered` invalide la ligne en base.
- Tap notification client : `app_krono/services/clientPushService.ts`.
- Tap notification chauffeur : `driver_krono/services/driverPushService.ts`.
- Résolution destinataire par téléphone : `recipient_user_id` si compte client unique.
- Anti-doublon statut par commande : `order_status_push_sent` si migration `026` appliquée.

### Canaux disponibles (repris de `docs/notification/notifications_krono_spec.md`, supprimé le 2026-07-22)

| Canal | Destinataire | Condition |
|---|---|---|
| Push Expo (app) | Client ou destinataire avec app Krono | Token Expo enregistré |
| SMS Twilio | Destinataire sans app | Pas de compte Krono + numéro valide |
| WhatsApp Twilio | Destinataire B2B | Configuré côté serveur (voir section 17 — non validé bout-en-bout) |
| Web Push | Visiteur page `/track` | Abonné aux notifications web |
| Live Activity (iOS) | Client avec app iOS | Token APNs actif |
| Socket temps réel | Client ou livreur connecté | Session active dans l'app |

**Livreur : aucun push Expo pour les offres ou statuts, tout passe par socket** — `new-order-request` (offre B2C, 30s pour répondre), `batch-assigned`/`batch-offer-replay` (offre tournée), `order:status:update`, `order-cancelled`, `driver:geofence:event`. Seule la push `batch_assigned` existe en fallback si le livreur est hors ligne au moment du socket (voir section 16).

**B2B — code de livraison à l'acceptation du batch** : pour chaque commande du batch, `notifyB2BBatchRecipientsProof()` envoie le code au destinataire — push `Code de livraison : {code}` si compte Krono, sinon WhatsApp en priorité (`Krono - code de réception {label} : {code}...`) avec repli SMS si WhatsApp échoue. Le tap sur la notif doit ouvrir `/order-tracking/{orderId}?openQR=1` (modal QR auto).

**Admin** : événements persistés dans `admin_notification_feed` (commande créée, assignée, annulée, statut mis à jour) — affichés dans le dashboard, pas de push.

### Types de notifications

| Type | Exemple | Règle |
|---|---|---|
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

**État actuel (2026-07-22)** : `krono_backend/src/services/mobileMoneyService.ts` est un **stub explicite** — `initiateOrangeMoneyPayment`/`initiateWavePayment`/`initiateMtnMoneyPayment`/`checkPaymentStatus` ne font aucun appel API réel, ils renvoient `status: 'pending'` avec un ID fictif. Un garde-fou bloque désormais tout paiement en production tant que `MOBILE_MONEY_REAL_INTEGRATION_ENABLED` n'est pas explicitement à `true` (impossible de l'activer par accident). Ce qui reste à faire pour l'intégration réelle (travail hors code + fichiers/lignes précis) : `docs/integration_paiement_en_ligne.md`.

**Alertes solde commission livreur** : `commissionService.ts` (`checkAndSendAlerts`) envoie un vrai push (`expoPushService.sendCampaignPushToUser`) aux trois seuils — suspendu (solde ≤ 0), très faible (≤ 1 000 FCFA), faible (≤ 3 000 FCFA).

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
|---|---|
| Prix unifiés, base + km, options vitesse | `krono_backend/src/services/priceCalculator.ts`, `app_krono/services/orderApi.ts` |
| Distance / durée route Mapbox, fallback Haversine | `app_krono/utils/mapboxDirections.ts`, `useMapLogic.ts` |
| Tarification dynamique météo / surge / heure / trafic | `krono_backend/src/services/dynamicPricing.ts`, `openMeteoPricing.ts`, `surgePricing.ts` |
| Transparence route / ligne droite | `app_krono/utils/routePricingLabels.ts` |

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

**Routes deliveries/drivers (audit 2026-07-22)** : toutes les routes de `deliveryRoutes.ts` et `driverRoutes.ts` (historique commandes, statistiques, revenus livreur, détails livreur, liste livreurs en ligne) sont protégées par `verifyJWT` **et** un contrôle d'ownership (`req.user.id !== userId` → 403) dans les contrôleurs. Un utilisateur ne peut lire que ses propres données.

**Backend fail-fast en production** : `krono_backend/src/config/db.ts` fait `process.exit(1)` avec un log `FATAL` si `DATABASE_URL` est absent ou si la création du pool échoue, **quand `NODE_ENV=production`**. Le `mockPool` (réponses vides silencieuses) reste utilisable seulement en dev/test — plus de risque de service "up" sans base réelle en prod.

**Audit sécurité 2026-07-22** : passage complet du monorepo, tout corrigé sauf ce qui dépend de l'intégration mobile money réelle (voir `docs/integration_paiement_en_ligne.md`). Acquis à retenir :
- Révocation de session : route `POST /api/auth-simple/logout` (`verifyJWT` + `revokeRefreshToken()`) — avant, aucun moyen de révoquer un refresh token compromis.
- IDOR corrigé sur `/check/:email` et `/check-by-id/:userId` (`authController.ts`) — même contrôle d'ownership que sur les autres routes profil.
- Rate-limit OTP : la clé de verrouillage priorise téléphone normalisé puis e-mail, IP seulement en dernier recours — empêche le contournement par rotation d'IP.
- Comparaison du code OTP en `crypto.timingSafeEqual` (Redis, mémoire, fallback DB) — empêche une attaque par timing.
- RLS confirmée active (pas un trou) sur `commission_balance`, `commission_transactions`, `partners`, `partner_users`, `partner_drivers`, `partner_subscriptions`, `partner_usage`, `partner_invoices`, `payment_disputes` — policies `service_role` uniquement, `anon`/`authenticated` refusés.

**Clés API Supabase — migration vers le nouveau système (2026-07-27).** Le projet est passé du système historique (`anon`/`service_role`, deux JWT signés par un secret JWT partagé — régénérer l'un régénère forcément l'autre) au nouveau système Supabase (`publishable`/`secret` keys, indépendantes et révocables une par une) :
- `service_role` → remplacé par la secret key `krono_backend_sk` (`sb_secret_...`), utilisée uniquement dans `krono_backend/.env` (variable toujours nommée `SUPABASE_SERVICE_ROLE_KEY`, le code n'a pas changé) et sur Render. Backend uniquement, jamais dans une app mobile/web cliente.
- `anon` → remplacé par deux publishable keys (`sb_publishable_...`) : `web_admin` pour `admin_krono` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, local + Vercel) et `mobile` pour `app_krono`/`driver_krono` (`EXPO_PUBLIC_SUPABASE_ANON_KEY`, local + EAS production et preview, partagée entre les deux apps).
- Les anciennes clés legacy (`anon`/`service_role`) restent **volontairement actives** sur Supabase (onglet "Legacy anon, service_role API keys") : `app_krono`/`driver_krono` sont déjà publiées avec l'ancienne clé `anon` compilée en dur dans les builds installés. Les désactiver ("Disable JWT-based API keys") casserait l'app pour tout utilisateur n'ayant pas encore reçu le build avec la nouvelle clé — à faire seulement après la prochaine release mobile. Voir `docs/taches.md`.

**Authentification OTP hybride par opérateur (Orange CI)** — validé et routage implémenté le 2026-07-22 (remplace `docs/plan_auth_otp_hybride_orange_whatsapp.md`, supprimé). Constat : les OTP SMS classiques via Twilio ne sont pas délivrés de façon fiable aux numéros Orange CI (MTN/Moov n'ont pas ce problème). Décision produit :
- **Orange** (préfixe `07`) → OTP envoyé **exclusivement par WhatsApp**.
- **MTN** (`05`) / **Moov** (`01`) → OTP par **SMS classique** en premier.
- **Fallback universel** → bouton "Renvoyer par WhatsApp" sur l'écran de vérification, quel que soit l'opérateur.

Implémentation : détection opérateur par préfixe national dans `krono_backend/src/utils/phoneE164CI.ts` (`detectCarrierCI`, testé) ; logique de choix de canal dans `authController.ts` (`sendOTPCode`) ; bouton fallback dans `app_krono/app/(auth)/verification.tsx` et `driver_krono/app/(auth)/verification.tsx`. WhatsApp Sender Twilio opérationnel (`+19788624416`, "Krono Livraison"). Reste à faire côté utilisateur (template WhatsApp, etc.) : voir `docs/taches.md`.

**Rôles `admin` / `super_admin` sur `admin_krono` — implémenté le 2026-07-24.** Aucune auto-inscription sur le dashboard : un compte staff n'existe que via invitation par un `super_admin` (bouton sur la page Utilisateurs → email → `supabase.auth.admin.inviteUserByEmail` → la personne définit son mot de passe via `/reset-password`, réutilisé pour ce cas). Découpage des droits (middleware `requireSuperAdmin`, `krono_backend/src/middleware/requireSuperAdmin.ts`) :
- `admin` garde tout le suivi opérationnel quotidien : commandes, avis, litiges clients, messagerie, flotte, livreurs dédiés partenaires, lecture générale (hors chiffre d'affaires).
- `super_admin` exclusif : recharger la commission d'un livreur (tracé via `commission_transactions.performed_by`, migration `046`), créer/activer/statut/supprimer un partenaire, créer/activer un abonnement, marquer une facture payée, inviter un membre du staff, et la vision financière globale de l'entreprise (`/analytics`, `/reports`, `/finance`, `/commissions`, carte "Chiffre d'affaires" du dashboard).
- Changer le rôle d'un membre du staff existant : `PUT /api/admin/users/:userId/role` (`updateStaffRole`), réservé `super_admin`, avec garde-fou — impossible de faire tomber le nombre de `super_admin` actifs à zéro.
- Code promo : création masquée honnêtement (pas de rôle attribué) car aucune rédemption n'existe encore côté prix — voir `docs/futur_feature_admin_krono.md`.

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

**Régénérées le 2026-07-22** : les fichiers 016, 017, 020, 021, 022, 024 (commission, QR, driver_type, tracking_token, driver_locations/admin_notification_feed, profiles/payment_methods/transactions/invoices/order_status_history/conversations/messages, index qr_code_scans, users.first_name/last_name/avatar_url) étaient absents du disque bien que le schéma existe en prod — ils ont été reconstruits par introspection directe de la base Supabase réelle (`chrono_delivery`) et sont maintenant sur le disque. 018 (gamification) et 019 (support) n'ont **jamais** été appliqués en prod (`driver_badges`/`support_tickets` n'existent pas) — aucun fichier recréé pour ces deux-là, ce n'est pas un oubli. Détail complet et ordre exact d'application : `krono_backend/migrations/README.md`.

| Migration | Sujet |
|---|---|
| `023_create_push_tokens.sql` | `push_tokens` Expo push client / driver |
| `024_users_name_avatar_columns.sql` | `users.first_name`, `last_name`, `avatar_url` |
| `025_orders_recipient_user_id.sql` | lien compte destinataire |
| `026_order_status_push_dedup.sql` | anti-doublon notifications par `(order_id, status)` |
| `032_create_b2b_partners_core.sql` | Tables `partners`, `partner_users`, `partner_drivers` |
| `033_create_b2b_subscriptions_billing.sql` | Tables `partner_subscriptions`, `partner_usage`, `partner_invoices` |
| `034_create_b2b_batches.sql` | Tables `delivery_batches`, `batch_orders` |
| `035_orders_add_b2b_columns.sql` | `ALTER TABLE orders ADD COLUMN partner_id` + `is_b2b_order` |
| `036_migrate_existing_b2b_partners.sql` | Backfill partenaires existants : crée `partners` + `partner_users` + remplit `orders.partner_id` |
| `037_partners_add_inactive_status.sql` | Ajoute `inactive` au CHECK constraint de `partners.status` |
| `041_partner_dedicated_driver_requests.sql` | Livreurs dédiés partenaires : `partner_drivers`, demandes `partner_driver_requests`, unicité `(partner_id, driver_user_id)` et un seul défaut |
| `042_commission_deduction_lock_idempotency.sql` | `deduct_commission()` verrouille la ligne (`FOR UPDATE`) avant lecture/modification du solde + contrainte unique `commission_transactions_order_deduction_uidx` empêchant deux déductions pour la même commande |

Migrations SQL : voir `krono_backend/migrations/README.md`. État d'application (quelles migrations restent à jouer en prod) : `docs/taches.md`.

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
- Multi-ville — détection de zone de service : un utilisateur dans une ville non couverte peut aujourd'hui passer commande sans avertissement (0 livreur disponible, panier silencieusement vide) ; reste à décider si/comment détecter la position et avertir clairement (voir section 18).
- Multi-ville — tableaux de bord admin par ville : combien de livreurs/livraisons par localité ; la colonne `city` existe sur `users` mais n'est utilisée nulle part, à vérifier si la commune Mapbox déjà capturée dans le JSON d'adresse des commandes suffit avant de supposer une migration de schéma nécessaire (voir section 18).

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
| **Profil 0** | Client particulier B2C | `app_krono` | 1 commande à la fois | Non |
| **Profil 1** | Petit commerçant mobile (revendeur, boutique de quartier) | `app_krono` mode business | 5–20 commandes/jour | Optionnel |
| **Profil 2** | Vendeur à volume (live TikTok, 20+ commandes d'un coup) | `app_krono` mode tournée | 20+ à la session | Optionnel |
| **Profil 3** | B2B professionnel structuré (restaurant, pharmacie, boutique) | `admin_krono` portail partenaire | Régulier et prévisible | Oui (mensuel) |

**Paiement Profil 1** : commandes pour ses clients → compte business, immédiat ou différé si éligible ; commandes pour lui-même → contexte client, règles Profil 0.

**Commission Profil 1** : sans abonnement actif → `partners.commission_rate` (aligné grille « paiement à la course », typiquement 7 %) ; avec abonnement actif → frais in-quota selon plan (voir Plans tarifaires).

### Interfaces — qui utilise quoi

```text
app_krono      → Profil 0 (client B2C)
                → Profil 1 (petit commerçant, mode business)
                → Profil 2 (vendeur volume, mode tournée)

driver_krono   → livreurs (menus différents selon driver_type)

admin_krono
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
| **Lier un utilisateur** | Admin Krono | Une ligne dans `partner_users` (`users` n'a pas de colonne `partner_id` propre — `partner_id` est toujours dérivé par jointure sur `partner_users` côté API, jamais un champ stocké désynchronisable) |

> **Exemple :** L'admin crée "MedExpress" dans `partners` (étape 1). Ensuite il prend le compte de Moussa (manager chez MedExpress) et lui assigne `partner_id = MedExpress.id` (étape 2). Moussa peut désormais créer des commandes B2B rattachées à MedExpress et accéder au portail. Avant ce lien, Moussa avait `is_business: true` mais ses commandes n'étaient pas facturables sous le contrat MedExpress.

---

#### Gap architectural — vérifié résolu le 2026-07-23 (implémentation a changé depuis)

Ce que cette section décrivait (`NewB2BShippingModal` qui bloquerait si `user.partner_id` est null) ne correspond plus au code actuel :
- `app_krono/components/NewB2BShippingModal.tsx` **n'est importé nulle part** dans `app_krono` — code mort. Il ne contient d'ailleurs aucun blocage sur `partner_id` (il le transmet tel quel, y compris `null`).
- Le vrai déclencheur du bouton "Nouvelle Livraison" pour un utilisateur `is_business: true` est `ActionCards.tsx`, qui route simplement vers `/(tabs)/map` — le flux de création de commande **standard**, identique à un utilisateur B2C. Aucun blocage sur `partner_id` n'existe sur ce chemin.
- `app_krono/store/useAuthStore.ts` (`validateUser`) synchronise déjà `partner_id`/`is_business`/`company_name` depuis le backend à chaque validation de session — pas de bug de désynchronisation constaté.

Donc Profil 1 (`partner_id=null`) peut déjà créer des livraisons sans blocage — simplement via le flux standard, sans commission B2B spécifique tant qu'aucun `partner_id` n'est rattaché (`computeB2BCommission` n'est appelé que si `partner_id` est présent). Rien à corriger ici pour l'instant.

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

Backlog technique lié à cette segmentation (pas de décision produit bloquante) : `docs/taches.md`.

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
Ces valeurs sont les constantes uniques : toute modification passe par `PLAN_DEFAULTS` dans `partnerControllerUtils.ts` et `QUOTA_COMMISSION` dans `b2bCommissionService.ts`, puis propagée app + admin + doc.

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

**Périmètre encore ouvert** : voir `docs/taches.md` (suppression/fusion partenaire, CGU, simulateur d'estimation, etc.).

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
2. **Abonnement actif + quota dépassé** → `excess_commission_rate` de la souscription (aligné sur `PLAN_DEFAULTS` dans `partnerControllerUtils.ts`, ex. Starter **6 %**, Pro **5 %**, Business **3 %**).
3. **Pas d'abonnement actif** → `partners.commission_rate` (souvent **0,07** pour paiement à la course ; pas de repli implicite type 20 % sur données propres).

Branchement : `orderRecordController` appelle `computeB2BCommission` puis `incrementPartnerUsage`. Le compteur `partner_usage.deliveries_count` est incrémenté via un `INSERT … ON CONFLICT DO UPDATE` SQL atomique pour éviter les doublons en cas de requêtes simultanées.

### Types de livraison, dispatch B2B, livreurs dédiés et tournées

**Déplacé dans `docs/logique_livraison.md` (sections 2 et 3)** — types de livraison et flags (`isB2BOrder`/`placedByAdmin`/`isPhoneOrder`), matrice segment × type, comportement dispatch B2B, livreurs dédiés partenaires, tournées (`delivery_batches`) et flux détaillé côté livreur (`driver_krono`).

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
| `merged` | **Admin Krono** (fusion de fiches) | Fiche en double archivée après fusion — jamais supprimée, `merged_into_partner_id` pointe vers la fiche survivante. Exclue de la liste "Tous les statuts" par défaut. |

**Séparation `users.is_business` (mode business à l'usage) / `partners.status` (agrément)** : couper le mode business dans le profil app met `is_business` à `false` via `setBusinessMode` (endpoint dédié) — **sans** modifier `partners.status`. Le rallumage avec un partenaire déjà `active` remet `is_business` à `true` sans repasser en `pending`. Si le partenaire est `inactive` côté agrément, le portail reste bloqué jusqu'à action admin, même si l'utilisateur remet le toggle.

**`registerAsPartner`** : crée un partenaire `pending` + lien `partner_users` si absent ; si lien existant en `active` ou `pending`, met à jour le `plan` (et cohérence « none » + taux à la course) selon le corps de requête ; si `inactive`, ne rétablit pas l'agrément seul — message métier côté API indiquant qu'une réactivation admin peut être nécessaire.

**`activatePartner` (admin)** : `pending` → `active`, création de `partner_subscriptions` **active** si un plan forfait est déjà choisi, invitation portail best-effort sur `partners.email`.

**Séparation inactif administratif / sanction** : les actions admin « Désactiver » / « Suspendre » restent **tracées** (`actor = admin`) dans `partner_audit_logs` (migration 043) pour ne pas être confondues avec le toggle utilisateur.

**Lien `partner_users`** : conservé pour l'historique ; une désactivation agrément ne supprime pas automatiquement le lien utilisateur ↔ partenaire.

**Fusion de deux fiches partenaire — implémentée le 2026-07-27** (`POST /api/partners/:id/merge`, body `{ mergeFromPartnerId }`, réservé `super_admin`, transaction unique `partnerMergeController.ts`). La fiche `:id` est la survivante, `mergeFromPartnerId` est archivée (`status = 'merged'`, jamais supprimée). Règles appliquées :
- **Abonnement en double** : celui du palier le plus élevé est gardé actif (`starter` < `pro` < `business`), l'autre est désactivé ; en cas d'égalité de palier, celui avec le plus de temps restant (`ends_at`) gagne. Les deux restent rattachés à la fiche survivante pour l'historique.
- **Quota mensuel** (`partner_usage`, `UNIQUE(partner_id, month)`) : les mois en commun sont **sommés**, pas écrasés.
- **Historique** (commandes, factures, tournées, demandes de livreur) : toujours réattribué à la fiche survivante, jamais perdu.
- **Livreurs dédiés** (`partner_drivers`) : le doublon `(partner_id, driver_user_id)` est dédoublonné ; un seul livreur par défaut par partenaire est préservé (`partner_drivers_one_default_per_partner_uidx`).
- **Accès équipe** (`partner_users`) : transfert automatique vers la fiche survivante, sans réinvitation (le rôle est toujours `owner` depuis la migration 044, donc pas de conflit de rôle possible).
- **E-mail de la fiche archivée mis à `NULL`** pour libérer `partners_email_unique_idx` (l'identité canonique devient la fiche survivante).
- Log d'audit `partner_audit_logs` (action `'merge'`) — protégé par un `SAVEPOINT` pour qu'un échec d'insertion du log n'annule jamais la fusion elle-même.
- Migration associée : `048_partner_merge_support.sql` (colonne `merged_into_partner_id`, statut `'merged'`, action `'merge'` sur `partner_audit_logs`).
- UI admin (`admin_krono`, page liste `/partners`) : sélection à cocher (max 2 fiches) → barre d'action "Fusionner" → modale de confirmation où l'admin choisit laquelle des deux garder. Pas d'action de fusion sur la page détail d'une fiche individuelle.

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

**Comportement implémenté (backend)** : `inviteUserByEmail` est tenté en premier. Si Supabase renvoie une erreur du type *e-mail déjà enregistré*, le backend ne traite plus l’opération comme un échec fatal : résolution de l’utilisateur (`public.users`, puis liste Auth admin en secours), assurance du profil public (`ensurePublicUserProfileForAuthUser`), `upsert` sur `partner_users`, génération d’un lien **`magiclink`** via `auth.admin.generateLink` (repli **`recovery`** si besoin) avec `redirectTo = PARTNER_PORTAL_URL` (fallback codé vers la page de login portail prod si la variable est absente), envoi du lien par SMTP Krono quand il est configuré (`sendPartnerPortalMagicLinkEmail` dans `krono_backend/src/services/emailService.ts`). Points d’entrée : `invitePartnerUser`, `invitePortalUser` (`krono_backend/src/controllers/partnerUserController.ts`), et à l’activation `activatePartner` (`krono_backend/src/controllers/partnerCrudController.ts`, auto-invitation best-effort sur l’e-mail fiche partenaire).

**À valider en exploitation** (le code seul ne suffit pas) : déployer ou redémarrer le backend sur l’environnement cible ; tester « Inviter au portail » avec le **même** e-mail qu’un compte app client — la réponse doit réussir (plus de message brut *A user with this email address has already been registered*) ; **Supabase Dashboard → Authentication → URL configuration** : déclarer l’URL exacte de **`PARTNER_PORTAL_URL`** (page de connexion du portail) dans **Redirect URLs**, sinon les liens magic / recovery sont rejetés après clic.

**SMTP Krono** : dans `krono_backend/.env`, renseigner `EMAIL_USER`, `EMAIL_PASS`, idéalement `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, et `EMAIL_HOST` / `EMAIL_PORT` si le fournisseur n’est pas celui par défaut ; redémarrer le backend ; retester réception du mail « Se connecter au portail ». Référence des variables : `krono_backend/.env.example`.

**Sans SMTP Krono** : s’appuyer sur **Mot de passe oublié** sur la page de login du portail (SMTP / templates Auth côté Supabase) ; communiquer l’URL du portail et la consigne : une fois la ligne `partner_users` créée, la réinitialisation mot de passe Supabase permet la première connexion.

**Données / parcours (encore ouverts)** : rendre l’e-mail portail **obligatoire** à l’étape forfait (`app_krono/app/(auth)/business-onboarding.tsx`) si le produit l’exige — aujourd’hui le flux peut partir sans e-mail portail si `users.email` est vide et que la validation ne bloque pas. (Vérifié 2026-07-23 : il n'y a pas de colonne `users.partner_id` à aligner — `partner_id` est toujours calculé depuis `partner_users` à la lecture, aucun risque de désynchronisation.)

**Recette bout en bout** : app (parcours boutique → partenaire `pending`) → admin (activation, auto-liaison / invitation si e-mail connu) → admin (« Inviter au portail » ou renvoi) → portail (connexion, dashboard, commandes, facturation selon besoin).

**Vigilance** : vider les tables **`partners`** / B2B en SQL **ne supprime pas** les comptes **Supabase Authentication**. Les conflits « e-mail déjà utilisé » viennent d’Auth, pas seulement des lignes `partners`.

Le portail vise à terme un modèle d'accès à rôle unique (`owner`), sans rôle intermédiaire « manager ». Travail d'alignement restant (API, UI, types) : `docs/taches.md`.

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
admin_krono → /partners → Nouveau partenaire → name, commission_rate
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

#### 9. Admin passe une commande au nom d'un partenaire B2B (2026-07-26)
```
Dashboard admin → "Nouvelle livraison" → client existant ou nouveau client par téléphone
  → étape Détails → sélecteur optionnel "Rattacher à un partenaire B2B" (GET /api/partners)
  → createOrder({ ..., partnerId })
  → POST /api/admin/orders (verifyAdminSupabase) → createAdminOrder
      partnerId fourni → isB2BOrder implicite (tarification prioritaire, notif tous livreurs)
      → computeB2BCommission(partnerId) → commission ajoutée au prix serveur (même service
        que /api/orders/record, pas de logique dupliquée)
      → saveOrder() puis UPDATE orders SET partner_id, is_b2b_order=true (saveOrder ne connaît
        pas ces colonnes — écriture séparée, cf. applyB2BPartnerMetadata)
      → incrementPartnerUsage(partnerId)
```
Différence avec le flux `/api/orders/record` (app partenaire) : ce chemin admin n'a pas la
contrainte `userId === authUser.id` (l'admin agit pour un tiers), et ne passe jamais par la RPC
`fn_create_order` — il réutilise le chemin `saveOrder` déjà utilisé par les autres commandes admin.

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

**Déplacé dans `docs/logique_livraison.md` (section 3)**.

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
| Contrôleur partenaire (CRUD/statut, invitations, abonnements, livreurs dédiés) | `partnerCrudController.ts`, `partnerUserController.ts`, `partnerSubscriptionController.ts`, `partnerDriverController.ts` (voir section 1 pour le détail — `partnerController.ts` est un fichier legacy à ~95 % mort) |
| E-mail lien portail (magic / recovery) | `krono_backend/src/services/emailService.ts` |
| Contrôleur tournées | `krono_backend/src/controllers/batchController.ts` |
| Logique commission B2B | `krono_backend/src/services/b2bCommissionService.ts` |
| Job facturation mensuel | `krono_backend/src/jobs/partnerInvoiceJob.ts` |
| Middleware auth partenaire | `krono_backend/src/middleware/verifyPartnerUser.ts` |
| Routes partenaire (admin) | `krono_backend/src/routes/partnerRoutes.ts` |
| Routes tournées (JWT) | `krono_backend/src/routes/batchRoutes.ts` |
| Optimisation itinéraire | `krono_backend/src/utils/haversine.ts` |
| Notification socket tournée | `krono_backend/src/sockets/orderSocket.ts` (`emitBatchAssigned`) |

**Admin (`admin_krono`)**

| Sujet | Fichier |
|---|---|
| Liste partenaires | `admin_krono/app/(dashboard)/partners/page.tsx` |
| Fiche partenaire | `admin_krono/app/(dashboard)/partners/[id]/page.tsx` |
| Layout portail partenaire | `admin_krono/app/(partner)/partner/[partnerId]/layout.tsx` |
| Page upgrade (Starter / none bloqué portail) | `admin_krono/app/(partner)/partner/[partnerId]/upgrade/page.tsx` |
| Dashboard portail | `admin_krono/app/(partner)/partner/[partnerId]/dashboard/page.tsx` |
| Commandes portail | `admin_krono/app/(partner)/partner/[partnerId]/orders/page.tsx` |
| Nouvelle commande portail | `admin_krono/app/(partner)/partner/[partnerId]/orders/new/page.tsx` |
| Facturation portail | `admin_krono/app/(partner)/partner/[partnerId]/billing/page.tsx` |
| Équipe portail | `admin_krono/app/(partner)/partner/[partnerId]/team/page.tsx` |
| Service API portail | `admin_krono/lib/partnerApiService.ts` |

**App client (`app_krono`)**

| Sujet | Fichier |
|---|---|
| Onboarding B2B | `app_krono/app/(auth)/business-onboarding.tsx` |
| Store mode business / tournées | `app_krono/store/useBusinessStore.ts` |
| API partenaire mobile | `app_krono/services/partnerApi.ts` |
| Modal livraison client (Profil 1) | `app_krono/components/NewB2BShippingModal.tsx` |
| Bottom sheet tournée (Profil 2) | `app_krono/components/BatchShippingBottomSheet.tsx` |
| Cartes d'action (standard + B2B) | `app_krono/components/ActionCards.tsx` |

**App chauffeur (`driver_krono`)**

| Sujet | Fichier |
|---|---|
| Store tournée active | `driver_krono/store/useBatchStore.ts` |
| API tournées | `driver_krono/services/batchApiService.ts` |
| Écran tournée B2B | `driver_krono/app/batch/[batchId].tsx` |

---

### Simulation — comment le livreur reçoit les commandes (référence produit)

**Déplacé dans `docs/logique_livraison.md` (section 4)** — les 3 cas (commande classique, tournée B2B, commande B2B individuelle) avec schémas de flux et écrans.

---

Les 9 blocs fonctionnels du B2B (migrations, backend, admin, app client, app chauffeur, grille tarifaire, statuts, segmentation, livreurs dédiés) sont implémentés — détail de chaque bloc dans les sous-sections ci-dessus. Statut d'application des migrations et roadmap produit future : `docs/taches.md`.

---

### Livraison programmée & points d'entrée de création de commande (Dashboard vs Planning)

**Déplacé dans `docs/logique_livraison.md` (sections 5 et 6)** — décisions du 2026-07-26 : séparation Dashboard (générique/immédiat) vs Planning (B2B exclusif, renommé "Commande B2B programmée"), refonte unifiée de la livraison programmée (app client + Planning), règle de disponibilité livreur au dispatch (plafond 3 commandes, blocage tournée, doublon `orderSocket.ts`/`orderSocketMatching.ts`). Toutes décisions validées, **pas encore implémentées**.

---

### Feature Commissionnaire (hors périmètre B2B)

Le commissionnaire est une feature **B2C** distincte : le livreur agit à la place du client (courses, achats ponctuels) — ce n'est pas une livraison classique point A → point B avec colis déjà prêt. Pas de mélange avec la logique B2B (tables `partners`, abonnements, pricing). Documentation détaillée à écrire (parcours, pricing, avance de fonds) : voir `docs/taches.md`.

---

## 17. Fiabilité infrastructure — constats et pistes

Constats honnêtes sur 3 lacunes de fiabilité identifiées le 2026-07-25 (pas des technologies manquantes — le choix de ne pas utiliser Docker/Kubernetes/Prisma à ce stade est délibéré et justifié vu l'échelle actuelle). Les deux premiers points ont depuis fait leurs preuves en conditions réelles ; le troisième reste théorique.

**1. Pas de CD, déploiement 100% manuel**
- Constat : `.github/workflows/ci.yml` fait tourner build/tests/lint/audit, mais aucun job ne déploie. Le déploiement de `admin_krono` passe entièrement par le dashboard Vercel, à la main.
- Preuve concrète (2026-07-25) : une session complète a été perdue à déboguer ce type de problème — mauvais Root Directory Vercel (`admin_chrono` vs `admin_krono`), un "Redeploy" qui a repris un vieux commit au lieu du dernier, puis un rollback manuel antérieur qui bloquait `admin.kro-no-delivery.com` sur une version périmée malgré des builds réussis. Un pipeline de déploiement scripté (ou au moins une checklist automatisée de vérification post-déploiement) aurait évité tout ça.
- Piste : soit un vrai step de déploiement dans `ci.yml` (via Vercel CLI/API token), soit a minima un script de vérification post-déploiement (curl sur les routes clés, comparaison du commit déployé vs `HEAD`).

**2. Aucun test end-to-end, seulement unitaire/intégration**
- Constat : tous les tests (`krono_backend` : 53 fichiers, `admin_krono` : 5, `app_krono`/`driver_krono` : 1 chacun) sont unitaires ou d'intégration ciblée. Aucun test ne simule le vrai parcours utilisateur de bout en bout à travers plusieurs systèmes.
- Preuve concrète (2026-07-25) : le bug du code promo. La logique de validation/application avait été construite sur la route REST (`orderRecordController.ts`), entièrement testée et verte. Mais l'app cliente crée en réalité ses commandes via **REST puis Socket.IO** pour la même commande (`userOrderSocketService.ts`) — le handler Socket.IO (`orderSocket.ts`) ignorait complètement le code promo. Tous les tests unitaires passaient parce que chacun testait sa brique isolément ; aucun ne suivait le vrai enchaînement client → REST → Socket.IO.
- Piste : un test d'intégration qui simule le vrai flux client (au moins REST + Socket.IO enchaînés) pour les parcours critiques (création de commande, paiement), pas juste chaque endpoint séparément.

**3. Aucun garde-fou automatisé sur les migrations**
- Constat : les migrations sont des fichiers `.sql` numérotés manuellement dans `krono_backend/migrations/`, sans outil dédié (pas de Prisma Migrate/node-pg-migrate).
- Preuve concrète (2026-07-25) : un `.gitignore` mal réglé (`*.sql` ignoré en bloc avec des exceptions ajoutées une par une, oubliées à partir d'un certain point) a fait que **29 migrations sur 50 n'étaient jamais suivies par git**, découvert par hasard en travaillant sur autre chose, pas détecté par un contrôle quelconque.
- Piste : un check simple en CI — comparer la liste des fichiers `migrations/*.sql` sur disque avec `git ls-files migrations/` et échouer si un fichier manque au suivi git.

Statut : lacunes documentées, aucune n'est corrigée à ce stade (hors du `.gitignore` migrations, corrigé le 2026-07-25 dans la même session). Décision d'implémentation à prendre par l'utilisateur — voir `docs/taches.md`.

---

## 18. Multi-ville — décision produit 2026-07-29

**Décision** : lancer Krono simultanément sur Abidjan et Bouaké plutôt que consolider d'abord sur Abidjan seule (marché déjà occupé par Yango) avant d'étendre. Motivation business, pas technique.

Abidjan et Bouaké sont **le point de départ, pas une limite figée** — l'architecture doit rester ouverte à d'autres villes sans refactoring. Concrètement, dans le code touché ici, `City` (backend `approximatePickupZones.ts` et frontend `admin_krono/lib/approximatePickupZones.ts`) est une chaîne libre (`type City = string`), pas une énumération à 2 valeurs — ajouter une ville se fait en ajoutant ses entrées dans ces fichiers de données, le `<select>` groupé (`NewShippingModal.tsx`) et `APPROXIMATE_PICKUP_CITIES` s'adaptent automatiquement, sans toucher au typage ni au code appelant. Même logique pour `CITY_BOUNDING_BOXES` dans `MapboxAddressAutocomplete.tsx` (app mobile) : un tableau extensible, pas une paire figée.

### Principe d'architecture retenu

Pas d'attribut « ville » figé sur le profil utilisateur. Le scoping se fait dynamiquement à partir de la position GPS réelle au moment de l'usage (utilisateur en déplacement = expérience qui suit sa position, pas son « profil »). C'est délibérément cohérent avec ce que fait déjà le matching livreur (rayon autour du point de retrait réel, pas une notion de ville).

### Déjà city-agnostic nativement (vérifié dans le code, aucun changement nécessaire)

- **Matching livreur** (`findNearbyDrivers`, `orderSocketMatching.ts`) : rayon GPS (défaut 10 km) autour du point de retrait réel. Un client à Bouaké ne peut physiquement pas matcher avec un livreur d'Abidjan (~350 km).
- **Tarification dynamique** (météo `openMeteoPricing.ts`, trafic) : basée sur les coordonnées réelles de la commande, pas un point fixe.
- Le multiplicateur horaire `getHourMultiplierAbidjan` (`dynamicPricing.ts`) est mal nommé mais généraliste (heure locale CI, UTC+0) — s'applique correctement partout dans le pays malgré son nom.

### Corrigé le 2026-07-29 (biais géographique Abidjan en dur)

- **Autocomplétion d'adresse** (`admin_krono/components/AddressAutocomplete.tsx` et `app_krono/components/MapboxAddressAutocomplete.tsx`) : les requêtes de géocodage pour une adresse « rue-like » ajoutaient inconditionnellement le suffixe `, Abidjan` au texte recherché — un client à Bouaké tapant son adresse voyait Mapbox chercher sa rue à Abidjan. Devenu paramétrable (`cityHint` déduit de la position réelle côté mobile via une bounding box Bouaké, prop explicite côté admin) ; la ville reste « Abidjan » par défaut si aucune position n'est connue.
- Points d'entrée mobile qui ne transmettaient pas la position réelle (`add-address.tsx`, point de collecte `BatchShippingBottomSheet.tsx`) : branchés sur `useLocationStore` pour hériter du même comportement que le flux de livraison principal (`DeliveryBottomSheet.tsx`, déjà correct).
- **Zones de retrait approximatives** pour les commandes téléphone/hors-ligne créées par l'admin (`krono_backend/src/utils/approximatePickupZones.ts`, ex-`abidjanApproximatePickupZones.ts`) : généralisées à plusieurs villes, communes de Bouaké ajoutées (coordonnées de bonne foi, non vérifiées sur le terrain contrairement à la liste Abidjan — à confirmer avant lancement réel). Dropdown de sélection (`NewShippingModal.tsx`) groupé par ville via `<optgroup>`.
- **POI curatés** (`poiAbidjan.ts`) : cas concret trouvé le 2026-07-29 — le cinéma « Pathé Cap Sud » (Abidjan) était suggéré à quiconque tapait « Pathé », y compris un client à Bouaké, comme s'il était à proximité. Chaque entrée est maintenant taguée par ville et `searchCuratedPoi` filtre par `cityHint` (même mécanisme que l'autocomplétion). Reste peu de contenu (1 seule entrée) — pas d'équivalent Bouaké pour l'instant, juste plus de faux positif inter-villes.
- **Fallbacks d'affichage carte** (`DeliveryMapView.tsx`, `order-tracking/[orderId].tsx`) : centrent la carte sur Abidjan par défaut, mais uniquement en dernier recours (avant que le GPS réel ou les coordonnées de la commande soient disponibles) — n'affecte aucune donnée réellement affichée, juste le pixel de départ le temps que la vraie position arrive. Laissé tel quel, à changer seulement si perçu comme un problème UX réel.

Décisions encore ouvertes sur ce chantier : voir section 14 (« Détection de zone de service » et « Tableaux de bord admin par ville »).

---

## 19. Fiabilité carte/géolocalisation — audit 2026-07-29

L'utilisateur considère le suivi carte comme la fonctionnalité la plus critique du produit ("si les clients n'ont pas l'impression de bien se repérer, ça sera vraiment compliqué"). Audit complet demandé sur le suivi live, l'app livreur, l'ETA/itinéraire, en dehors de l'autocomplétion d'adresse (déjà couverte section 18).

**Constat central** : le socle technique n'est pas du bricolage (interpolation du marker déjà calibrée, throttle position livreur bien pensé, fallback GPS cache→Balanced→Low). Le vrai problème trouvé n'est pas la plomberie GPS mais l'absence de signal quand le suivi se dégrade silencieusement — un client ne perd pas confiance parce que le tracking bug, mais parce que rien ne lui dit "on a un souci" pendant que ça bug. Les 4 points ci-dessous sont corrigés et vérifiés (`tsc` propre sur les 4 apps, tests backend verts).

**1. Le client ne savait jamais que son livreur avait perdu la connexion (bloquant, corrigé).**
- Constat : `markDriverOfflineAfterSocketGrace` (`orderSocket.ts`) ne notifiait que les admins (`broadcastDriverStatusToAdmins`) après la grâce de 90s ; le client suivant sa commande ne recevait rien, marker figé sans explication.
- Fix : `notifyClientsOfDriverConnectionState(io, driverId, connected)` émet `driver:connection:status` au client concerné (perte ET reconnexion), sur les 3 points d'entrée (grâce expirée, reconnexion auth, `driver-connect`). Côté client, `useOrderStore.driverConnection` (par commande, avec timestamp) + `DriverConnectionBanner.tsx` affichent un bandeau si déconnecté explicitement OU si aucune position reçue depuis 45s (filet de secours si l'event est manqué).

**2. La permission de localisation arrière-plan du livreur pouvait être refusée sans que personne ne le sache (bloquant, corrigé).**
- Constat : `driver_krono/app/(tabs)/index.tsx` appelait `requestBackgroundLocationPermissionForDuty()` au passage en ligne mais jetait le retour (`void`). Un livreur choisissant "Autoriser seulement pendant l'utilisation" (courant sur iOS) voyait son GPS s'arrêter dès l'écran verrouillé, sans alerte.
- Fix : le retour est vérifié ; si refusé, `Alert.alert` explique le risque et propose d'ouvrir les réglages (`Linking.openSettings`, réutilise `openAppLocationSettings` déjà existant).

**3. L'ETA restait figé après un échec Mapbox Directions (gênant, corrigé).**
- Constat : `useAnimatedRoute.ts` dégradait proprement le tracé en ligne droite en cas d'échec, mais `trafficData` (durée affichée) gardait sa dernière valeur connue sans le signaler — y compris sur le recalcul périodique (toutes les 2 min), dont les erreurs étaient volontairement avalées.
- Fix : `setTrafficData({ hasTrafficData: false })` sur chaque échec (chargement initial + recalcul périodique) — `calculateFullETA` (`etaCalculator.ts`) bascule alors proprement sur une estimation à vol d'oiseau au lieu d'afficher une durée trafic obsolète.

**4. La recherche de commerces locaux (Overpass/OSM) était verrouillée sur Abidjan, en dur (gênant, corrigé, lié à la section 18).**
- Constat : `overpassPoiSearch.ts` (copies dupliquées admin/app) ignorait totalement le paramètre `proximity` pour la bbox de recherche (toujours `ABIDJAN_BBOX`), et taguait chaque adresse retournée `, Abidjan` en dur. Plus large que le cas POI curé (section 18) : c'est le mécanisme général sur 20 catégories de commerces (pharmacies, restaurants, écoles...).
- Fix : bbox dérivée de `proximity` (±0.2° autour de la position réelle, fallback Abidjan si position inconnue), `cityHint` propagé pour le libellé d'adresse. Bonus trouvé en creusant : côté app mobile, le paramètre `proximity` envoyé à Mapbox lui-même (biais de recherche) était dérivé d'une chaîne statique plutôt que de `refCoords` (qui priorise la position GPS réelle) — corrigé aussi, sinon Mapbox restait biaisé Abidjan malgré un `cityHint` correct.

**5. Le livreur mettait bien plus longtemps que le client à savoir que sa propre connexion était instable (gênant, corrigé le 2026-07-29, suite à une question de l'utilisateur sur la synchronicité entre les 4 apps).**
- Constat : `driver_krono` avait déjà un `RealtimeDegradedBanner.tsx` fonctionnel, mais déclenché uniquement sur `reconnect_failed` — après épuisement des 24 tentatives de reconnexion Socket.IO (délais jusqu'à 10s chacune), potentiellement plusieurs minutes. Le client, lui, est informé en 45-90s (point 1). Un livreur pouvait donc ignorer pendant plusieurs minutes que le client ne le voyait plus.
- Fix : `orderSocketService.ts` (driver_krono) démarre un timer de 45s au `disconnect` (aligné sur le seuil client) qui active le même `RealtimeDegradedBanner` si toujours déconnecté, sans attendre `reconnect_failed`. Timer nettoyé sur reconnexion et sur `disconnect()` explicite (logout/passage hors ligne).

Statut : les 5 points sont corrigés et vérifiés (`tsc` propre sur les 4 apps, tests backend verts). Pas de décision ouverte supplémentaire issue de cet audit — les 2 déjà notées en section 14 restent les seules côté multi-ville/carte.

---

## 20. Documents vivants

Fichiers vivants dans `docs/` :

- `docs/krono-reference-unique.md` : **orientation uniquement** — contrat produit, règles durables, architecture, cartes de fichiers, décisions. Ne doit pas contenir de tâches à exécuter (voir règle en tête de ce document).
- `docs/logique_livraison.md` : récapitulatif dédié de la logique de livraison — cycle de statuts, types de livraison, dispatch B2B, tournées, simulation du flux livreur, et refonte en cours de la livraison programmée. Contenu déplacé depuis ce fichier le 2026-07-26 pour centraliser le sujet.
- `docs/taches.md` : tout ce qui reste à faire (backlog, migrations à appliquer, stabilisation App Store). Une tâche terminée est supprimée de ce fichier ; si elle change une règle durable, elle est résumée ici.
- `docs/roadmap_produit.md` : vision produit post-lancement (Phase 1bis/2/3 — monétisation scale, self-service portail, marque blanche, etc.), peu prioritaire, aucune de ces features en cours de construction.
- `docs/integration_paiement_en_ligne.md` : reste à faire spécifique à l'intégration mobile money réelle.
- `docs/MONETISATION.md` : grille commerciale cible (%+frais fixe FCFA) — voir section 16 pour la grille technique actuellement en vigueur.
- `docs/supabase_tables_audit.md` : audit du schéma Supabase (tables, colonnes, usage réel).
