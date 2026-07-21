# Recommandation — stabiliser Krono pour l'App Store

Date : 2026-06-19  
Objet : audit produit/technique, risques confirmés par le code, plan de stabilisation pour la sortie App Store.

---

## 1. Avis général

Krono n'est plus un simple prototype. Le projet porte déjà une vraie plateforme logistique :

- app client ;
- app livreur ;
- dashboard admin ;
- portail partenaire B2B ;
- backend API + Socket.IO ;
- Supabase/Postgres ;
- tracking public ;
- notifications push + SMS + WhatsApp ;
- QR preuve de livraison ;
- Live Activity iOS ;
- paiements, commissions, dette différée ;
- tournées groupées B2B.

Le point fort principal est la clarté de la vision produit. Les documents dans `docs/`, surtout `docs/krono-reference-unique.md`, montrent que Krono a déjà une mémoire produit : statuts, règles métier, fichiers clés, décisions ouvertes, parcours B2B, notifications, pricing, sécurité, production.

Le risque principal n'est pas que Krono manque de fonctionnalités. Le risque est inverse : Krono a déjà beaucoup de surface produit, donc les prochains bugs ne seront pas seulement des bugs UI. Ils peuvent toucher :

- l'argent ;
- la confidentialité ;
- les partenaires ;
- les livreurs ;
- la preuve de livraison ;
- la confiance terrain.

La recommandation centrale :

> Avant d'ajouter de grosses fonctionnalités, Krono doit entrer dans une phase de stabilisation produit, sécurité, base de données et flux critiques. L'objectif est d'être prêt à 100 % le jour où l'app passe de TestFlight à l'App Store public.

---

## 2. Ce qui est solide

### Vision produit

Le produit est cohérent : Krono ne fait pas seulement "commande + livreur". Il couvre tout le cycle réel :

- création de livraison ;
- dispatch ;
- suivi temps réel ;
- preuve QR/code ;
- notification client/destinataire ;
- paiement ;
- commission livreur ;
- support/litige ;
- portail partenaire ;
- facturation mensuelle B2B ;
- tournées groupées.

La vraie promesse Krono est :

> Transformer une livraison artisanale en activité suivie, prouvée, facturable et présentable au client final.

### Architecture générale

La séparation des surfaces est saine :

- `chrono_backend/` : API REST, sockets, jobs, pricing, notifications ;
- `admin_chrono/` : dashboard ops/admin et portail partenaire ;
- `app_chrono/` : client B2C + petit B2B mobile ;
- `driver_chrono/` : livreur, navigation, QR, tournées ;
- `docs/` : mémoire produit ;
- `supabase/` et `migrations/` : sécurité et base de données.

### Ce qui est déjà en place pour la production

- CORS strict en production ;
- Helmet ;
- rate limit (auth, OTP, commandes) ;
- Socket.IO authentifié ;
- Sentry ;
- Redis adapter optionnel ;
- `X-Request-Id` côté mobile ;
- scripts de readiness ;
- CI GitHub ;
- tests backend et utilitaires ;
- effort de refactoring des très gros fichiers.

---

## 3. Risques principaux

### 3.1 Sécurité des routes — confirmé par le code

**Confirmé.** Les routes suivantes n'ont aucun middleware d'authentification :

`chrono_backend/src/routes/deliveryRoutes.ts` :
- `POST /api/deliveries/` — création commande sans token
- `GET /api/deliveries/:userId` — historique commandes sans token
- `GET /api/deliveries/:userId/statistics` — statistiques financières sans token

`chrono_backend/src/routes/driverRoutes.ts` :
- `GET /api/drivers/:driverId/details` — détails livreur sans token
- `GET /api/drivers/:userId/revenues` — revenus livreur sans token
- `GET /api/drivers/:userId/statistics` — statistiques sans token
- `GET /api/drivers/online` — liste des livreurs en ligne sans token *(point non signalé dans la version précédente)*

N'importe qui connaissant un userId peut lire les données financières d'un livreur ou l'historique d'un client. C'est une fuite de données personnelles et financières.

Priorité : critique avant App Store.

Objectif :

- auditer toutes les routes Express ;
- classer chaque route : publique / client / livreur / admin / partenaire / legacy à supprimer ;
- ajouter `verifyJWT` ou `verifyAdminSupabase` selon le rôle ;
- ajouter les contrôles d'ownership (un userId ne doit pas lire les données d'un autre) ;
- supprimer les routes remplacées par `/api/orders/record` et les routes modernes.

---

### 3.2 Base de données non reconstructible — pire que décrit

**Le README des migrations est lui-même inexact.** Il liste les migrations 016 à 024 comme "réellement présents", mais sur le disque seul `023_create_push_tokens.sql` existe parmi ces numéros. Les fichiers 016, 017, 018, 019, 020, 021, 022, 024 sont absents.

C'est plus grave que "migrations manquantes" : un développeur qui lit le README a confiance, clone le repo, et obtient une base incomplète sans le savoir. Le README garantit ce qui n'existe pas.

Conséquence :

- staging impossible à reconstruire proprement depuis le repo ;
- onboarding d'un second développeur bloqué dès la première heure ;
- restauration en production plus risquée ;
- schéma réel de la base dépendant de mémoire ou de SQL appliqué manuellement en dehors du repo.

Priorité : haute.

Objectif :

- faire un inventaire du schéma réel Supabase (exporter les `CREATE TABLE`) ;
- retrouver ou régénérer les migrations manquantes ;
- créer un chemin testé "base vide → Krono opérationnel" ;
- corriger le README pour qu'il reflète exactement ce qui est sur le disque ;
- vérifier RLS sur toutes les tables exposées.

---

### 3.3 Backend qui tolère l'absence de `DATABASE_URL` — confirmé

**Confirmé.** Dans `chrono_backend/src/config/db.ts` (ligne 8) : si `DATABASE_URL` manque, le backend démarre sans erreur et utilise un `mockPool` silencieux.

Une API qui démarre en production sans vraie base peut répondre avec des données vides au lieu d'échouer clairement. C'est un piège en prod : le service paraît "up" mais ne persiste rien.

Priorité : haute pour production.

Objectif :

- autoriser le mock seulement si `NODE_ENV=test` explicitement ;
- en production, `process.exit(1)` au démarrage si `DATABASE_URL` est absent ;
- rendre l'erreur visible dans les logs et le health check.

---

### 3.4 Mobile Money : intégration factice non documentée

**Nouveau.** `chrono_backend/src/services/mobileMoneyService.ts` contient les trois providers (Orange Money, Wave, MTN Money) mais les fonctions `initiateOrangeMoneyPayment`, `initiateWavePayment` et `initiateMtnMoneyPayment` ne font pas d'appel API réel. Elles génèrent un `providerTransactionId` fictif (`OM-{timestamp}-{random}`) et retournent `status: 'pending'` immédiatement.

De même, `checkPaymentStatus` retourne toujours `pending` sans vérification réelle.

Ce n'est pas un bug tant que le Mobile Money n'est pas activé en production, mais c'est un risque si le système est activé sans que l'intégration réelle soit en place. Un paiement peut paraître "initié" sans qu'il soit passé.

Parallèle : le `commissionController.ts` (ligne 262) note déjà `TODO: Intégrer avec Mobile Money`.

Priorité : haute avant activation paiements en production.

Objectif :

- documenter explicitement que Mobile Money est un stub ;
- bloquer son activation en production tant que l'intégration réelle n'est pas faite ;
- pour Orange Money : utiliser l'API officielle Orange Money CI ;
- pour Wave : utiliser l'API Wave ;
- ajouter le webhook de confirmation de paiement (les providers poussent la confirmation, ne pas se baser uniquement sur l'initiation).

---

### 3.5 WhatsApp : service implémenté mais non validé bout-en-bout

Le service `twilioWhatsAppService.ts` est proprement écrit et géré (fallback SMS si non configuré, templates, ContentSid). Il est utilisé pour les OTP et les notifications B2B destinataire.

Mais l'état réel en production n'est pas documenté :

- les variables `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_MESSAGING_SERVICE_SID`, `TWILIO_WHATSAPP_CONTENT_SID` sont-elles renseignées en prod ?
- le numéro WhatsApp Business est-il approuvé par Meta/Twilio ?
- les templates sont-ils approuvés (obligatoire pour WhatsApp Business) ?
- le fallback SMS fonctionne-t-il si WhatsApp échoue ?

Priorité : moyenne à haute selon si WhatsApp est activé ou non.

Objectif :

- créer un document de statut des intégrations externes (WhatsApp, SMS, Expo Push, Sentry, Mobile Money) avec leur état : configuré / testé / actif en prod / stub ;
- tester le parcours OTP par WhatsApp de bout en bout sur un vrai numéro ;
- documenter la procédure d'approbation Meta si ce n'est pas fait.

---

### 3.6 Documents légaux : placeholders non finalisés

**Nouveau et critique pour l'App Store.** Les pages légales de `admin_chrono` contiennent des avertissements explicites dans le code :

- `admin_chrono/app/legal/confidentialite/page.tsx` : "Document type à compléter (identité du responsable, base légale, durées, sous-traitants, pays) et à faire valider pour être conforme au RGPD et aux exigences des stores."
- `admin_chrono/app/legal/cgu/page.tsx` : "Document type à adapter à votre activité et à faire valider par un conseil si besoin."

Apple exige une politique de confidentialité valide et complète pour toute app collectant des données personnelles. Une app de livraison collecte : téléphone, email, localisation GPS en temps réel, photos de preuve, données financières. Sans politique conforme, l'app sera rejetée lors de la review Apple.

Priorité : critique avant soumission App Store.

Objectif :

- rédiger une vraie politique de confidentialité avec :
  - identité du responsable de traitement ;
  - liste exhaustive des données collectées (GPS, téléphone, email, photos, transactions) ;
  - base légale de chaque traitement ;
  - durées de conservation ;
  - droits des utilisateurs ;
  - sous-traitants (Supabase, Twilio, Expo, Sentry, Mapbox) et leur pays ;
- rédiger des CGU adaptées à Krono (livraison, responsabilité, litiges, annulations) ;
- héberger la politique sur une URL publique stable (exigée par Apple dans App Store Connect) ;
- renseigner l'URL dans App Store Connect avant soumission.

---

### 3.7 Écrans de paiement mobile : actions incomplètes

**Nouveau.** Dans `app_chrono/app/profile/payment-methods.tsx` :
- `setDefault` et `deleteMethod` ont des commentaires `TODO: via l'API` — les boutons existent dans l'UI mais les actions ne sont pas câblées.

Dans `driver_chrono/app/profile/payments.tsx` :
- `TODO: Charger les méthodes de paiement depuis l'API` — la page est vide en données réelles.

Dans `app_chrono/app/profile/promo-codes.tsx` :
- `TODO: Valider et appliquer le code promo via l'API` — la fonctionnalité n'est pas connectée.

Ces écrans sont visibles par les utilisateurs en production et pourraient créer de la confusion ou de la frustration.

Priorité : moyenne à haute selon ce qui est accessible dans les builds TestFlight actuels.

Objectif :

- soit câbler les actions manquantes ;
- soit masquer ces écrans jusqu'à ce qu'ils soient fonctionnels (ne pas exposer des boutons qui ne font rien).

---

### 3.8 Notifications livreur : alertes solde faible non envoyées

Dans `chrono_backend/src/services/commissionService.ts` (lignes 226-232) :

```
// TODO: Envoyer notification push au livreur
// TODO: Envoyer notification push "Solde très faible, rechargez maintenant"
// TODO: Envoyer notification push "Solde faible, pensez à recharger"
```

Ces alertes sont importantes pour l'expérience livreur. Un livreur avec un solde insuffisant ne peut pas accepter de courses, et sans notification proactive il découvre le problème seulement au moment de la course.

Priorité : moyenne.

Objectif :

- brancher les push existants (`expoPushService`) sur ces points ;
- définir les seuils (faible, très faible) et les documenter.

---

### 3.9 Contradiction business sur le B2B

Les docs indiquent un écart entre stratégie produit et implémentation actuelle.

Dans `docs/krono-reference-unique.md` :
- un utilisateur `is_business = true` sans `partner_id` devrait pouvoir créer des livraisons B2B simples ;
- `partner_id` devrait être requis seulement pour quota, abonnement, facturation et portail.

Mais l'implémentation actuelle bloque certains flux si `partner_id` est absent.

Dans `docs/tale/MONETISATION.md` :
- grille cible validée :
  - paiement à la course : `12% + 150 FCFA` ;
  - Starter : `8% + 100 FCFA` in-quota ;
  - Pro : `5% + 50 FCFA` in-quota ;
  - Business : `0%` in-quota ;
  - hors quota selon plan.

Priorité : haute.

Objectif :

- décider une source de vérité unique pour le pricing B2B ;
- aligner backend, app client, admin, portail et docs ;
- corriger le blocage `partner_id` pour les petits commerçants si la stratégie est confirmée ;
- vérifier que les factures, quotas et commissions utilisent la même règle.

---

### 3.10 Tournées B2B pas encore totalement stabilisées

Les docs signalent des bugs connus :

- notifications intermédiaires B2B non reçues ;
- seules les notifications `completed` sont confirmées ;
- `accepted`, `in_progress`, `picked_up`, `delivering` sont à vérifier ;
- ETA Dynamic Island non alimenté par la tournée ;
- store batch non réinitialisé au retour accueil ;
- bouton/flux de collecte à simplifier.

Priorité : haute, parce que les tournées sont une promesse B2B forte.

Objectif :

- garantir une seule notification d'offre tournée au livreur ;
- garantir les notifications par commande enfant aux bons statuts ;
- synchroniser ETA Mapbox / batch / Dynamic Island ;
- vider proprement le store après fin de tournée ;
- tester les parcours QR, code manuel et preuve alternative stop par stop.

---

### 3.11 Argent, commissions et gains livreurs

Les docs de monétisation expliquent une distinction essentielle :

- prix payé par client/partenaire ;
- revenu Krono ;
- gain réel livreur ;
- commission livreur externe ;
- part Krono si moto Krono ;
- wallet cash/mobile money.

Le risque actuel est de confondre prix de course et gain livreur dans certaines surfaces.

Priorité : haute avant industrialisation financière.

Objectif :

- persister un vrai gain livreur par commande ;
- persister la marge Krono par commande ;
- distinguer :
  - livreur externe avec moto personnelle ;
  - livreur équipé Krono ;
  - livreur recommandé partenaire ;
  - livraison suivie seulement, payée hors Krono ;
- clarifier le wallet :
  - cash : le livreur encaisse, il doit la part Krono ;
  - mobile money : Krono encaisse, puis crédite le gain livreur.

---

### 3.12 Divergence des versions mobiles

`app_chrono` et `driver_chrono` ne sont pas au même niveau Expo/React Native :

- app client : Expo 55 / React Native 0.83 ;
- app livreur : Expo 54 / React Native 0.81.

Ce n'est pas automatiquement un bug, mais c'est un coût de maintenance, surtout avec :

- Mapbox ;
- navigation native ;
- patches postinstall ;
- EAS ;
- iOS/Android ;
- notifications ;
- background location.

Priorité : moyenne à haute.

Objectif :

- décider si cette divergence est volontaire et la documenter ;
- sinon, planifier un alignement progressif ;
- éviter que chaque build EAS devienne un cas particulier.

---

### 3.13 Tests insuffisants sur les flux critiques

Le repo contient déjà des tests, surtout backend et utilitaires. C'est une bonne base.

Mais les zones les plus risquées méritent des tests d'intégration plus systématiques :

- auth ;
- ownership des données ;
- création commande ;
- transition de statuts ;
- paiement différé ;
- commission ;
- B2B pricing ;
- batch/tournée ;
- QR/code/preuve ;
- notifications anti-doublon ;
- portail partenaire.

Priorité : moyenne à haute.

Objectif :

- ne pas chercher 100 % de couverture ;
- couvrir d'abord les flux où une erreur coûte de l'argent ou de la confiance.

---

## 4. Plan de stabilisation recommandé

### Phase 1 — Sécurité et accès aux données

But : empêcher les fuites et les accès non autorisés.

Actions :

1. Auditer toutes les routes Express.
2. Classer chaque route :
   - publique ;
   - client authentifié ;
   - livreur authentifié ;
   - admin ;
   - partenaire portail ;
   - legacy à supprimer.
3. Ajouter les middlewares manquants.
4. Ajouter les contrôles d'ownership.
5. Verrouiller `deliveries`, `drivers` (revenues, statistics, details, online), `messages`, `fleet`, `mapbox`.
6. Vérifier que le tracking public n'expose que le strict nécessaire.

Livrable :

- tableau complet des routes avec leur statut auth ;
- PR de verrouillage ;
- tests 401/403 sur les routes sensibles.

---

### Phase 2 — Base de données et migrations

But : rendre Krono reconstructible depuis un repo propre.

Actions :

1. Comparer le schéma Supabase réel au contenu du repo.
2. Retrouver ou régénérer les migrations manquantes (016-022, 024).
3. Corriger le README des migrations pour qu'il reflète exactement les fichiers présents.
4. Clarifier l'ordre d'exécution réellement appliqué.
5. Tester une base neuve de zéro.
6. Vérifier RLS sur toutes les tables exposées.

Livrable :

- base staging reconstruite depuis zéro ;
- README migrations exact et fiable ;
- checklist Supabase production.

---

### Phase 3 — Légal et conformité App Store

But : passer la review Apple et être conforme à la collecte de données.

Actions :

1. Rédiger une politique de confidentialité réelle et complète.
2. Rédiger des CGU adaptées à Krono.
3. Héberger les deux documents sur une URL publique stable.
4. Renseigner l'URL dans App Store Connect.
5. Remplir le questionnaire "App Privacy" d'Apple (types de données, usage, tracking).
6. Vérifier les `NSUsageDescription` dans `app.config.js` (localisation, caméra, notifications).

Livrable :

- page légale finalisée et déployée ;
- App Store Connect configuré pour la soumission.

---

### Phase 4 — B2B et monétisation

But : aligner stratégie, code, écrans et facturation.

Actions :

1. Valider définitivement la grille B2B cible.
2. Aligner `b2bCommissionService`.
3. Aligner les écrans app/admin/portail.
4. Corriger le cas `is_business=true` sans `partner_id`.
5. Vérifier quota mensuel et hors quota.
6. Vérifier facture partenaire.
7. Ajouter tests unitaires et intégration sur pricing B2B.

Livrable :

- une seule grille officielle ;
- doc mise à jour ;
- tests pricing ;
- parcours petit commerçant non bloqué si décidé.

---

### Phase 5 — Tournées B2B

But : rendre la tournée fiable sur le terrain.

Actions :

1. Corriger les notifications intermédiaires.
2. Vérifier `confirmBatchPickup`.
3. Vérifier `accept-batch`.
4. Synchroniser ETA tournée.
5. Réinitialiser le store batch en fin de tournée.
6. Supprimer les confirmations inutiles.
7. Tester QR/code/preuve alternative stop par stop.

Livrable :

- scénario de test complet tournée ;
- notifications confirmées ;
- Live Activity cohérente ;
- store propre après fin.

---

### Phase 6 — Paiements réels

But : ne pas activer de faux paiements en production.

Actions :

1. Documenter l'état réel de chaque intégration de paiement : Orange Money, Wave, MTN, Mobile Money générique.
2. Ne pas activer Mobile Money tant que l'API réelle n'est pas branchée.
3. Implémenter les webhooks de confirmation de paiement (ne pas se baser sur l'initiation seule).
4. Valider WhatsApp bout-en-bout (OTP + transactionnel B2B).
5. Clarifier cash vs mobile money dans le wallet livreur.

Livrable :

- document de statut des intégrations externes ;
- Mobile Money réel ou bloqué explicitement ;
- WhatsApp testé ou désactivé proprement.

---

### Phase 7 — Argent et wallet

But : ne plus mélanger chiffre d'affaires et gain livreur.

Actions :

1. Ajouter les champs financiers cibles :
   - `driver_earning_cfa` ;
   - `krono_delivery_margin_cfa` ;
   - `b2b_fee_cfa` ;
   - `driver_payout_model`.
2. Clarifier livreur externe vs moto Krono.
3. Brancher les alertes solde faible sur les push existants.
4. Mettre à jour admin finances et app livreur.
5. Ajouter tests sur commission et payout.

Livrable :

- modèle financier fiable ;
- affichage livreur honnête ;
- alertes solde actives.

---

### Phase 8 — Mobile et builds

But : réduire les surprises EAS/native.

Actions :

1. Décider l'alignement Expo app client / livreur.
2. Documenter tous les patches Mapbox nécessaires.
3. Finaliser ou masquer les écrans de paiement client et livreur incomplets.
4. Vérifier que Node/npm CI correspondent aux `engines`.
5. Ajouter un readiness check pour driver app.

Livrable :

- builds plus prévisibles ;
- aucun écran visible avec des boutons non fonctionnels ;
- CI plus proche de la réalité.

---

## 5. Priorités immédiates avant App Store

Ces actions sont bloquantes pour la soumission ou critiques pour la sécurité des données :

1. **Verrouiller les routes publiques sensibles** — données financières et personnelles accessibles sans token.
2. **Mettre le backend en fail-fast si `DATABASE_URL` manque** — ne jamais démarrer avec le mockPool en prod.
3. **Rédiger et héberger les documents légaux** — Apple refuse sans politique de confidentialité réelle.
4. **Documenter et bloquer Mobile Money tant qu'il est un stub** — ne pas exposer un paiement factice.
5. **Corriger les migrations manquantes et le README** — base reconstructible avant mise à l'échelle.
6. **Clarifier et figer la grille B2B officielle** — aligner code, admin et facturation.
7. **Corriger les notifications de tournée B2B** — promesse partenaire non tenue.

---

## 6. Ce qu'il ne faut pas faire avant la stabilisation

Ne pas ajouter avant d'avoir terminé les phases 1 à 3 :

- animations de chargement ou onboarding amélioré ;
- nouveaux badges/gamification ;
- nouvelles surfaces marketing ;
- nouvelle app partenaire indépendante ;
- nouvelles offres commerciales complexes ;
- refonte UI large ;
- fonctionnalités "nice to have".

Ces sujets peuvent revenir après le lancement App Store. Aujourd'hui, la valeur vient de la fiabilité.

---

## 7. Position finale

Krono a une base rare : une vision produit forte, un code déjà large, une documentation vivante, et une compréhension fine du terrain.

Le projet n'a pas besoin d'être réinventé. Il a besoin d'être stabilisé.

La prochaine étape saine est de passer d'un mode :

> construire beaucoup

à un mode :

> verrouiller ce qui fait confiance : argent, données, preuves, partenaires, livreurs, notifications et production.

Le passage de TestFlight à l'App Store public est un seuil. Avant ce seuil, un bug peut être corrigé discrètement. Après, il touche de vrais utilisateurs, de vrais partenaires, et de vrais livreurs qui dépendent de Krono pour leur revenu.

Une fois la stabilisation faite, Krono pourra continuer à grandir sans que chaque nouvelle fonctionnalité augmente le risque global.
