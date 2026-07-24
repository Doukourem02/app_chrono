# Tâches — Krono

Ce fichier liste uniquement ce qui **nécessite une action de l'utilisateur** (accès externe, décision produit, argent, test sur device réel) — pas les tâches "code pur" que je peux traiter seul. `docs/krono-reference-unique.md` ne doit contenir que de l'orientation produit (règles, architecture, cartes de fichiers, décisions) — pas de tâches. Un item traité est supprimé d'ici ; si ça change une règle durable, c'est résumé dans la référence.

Paiement / mobile money : fichier dédié `docs/integration_paiement_en_ligne.md` (ne pas dupliquer ici).

---

## 🔴 Urgent — rotation de secrets compromis (action manuelle, pas du code)

- **`SUPABASE_ACCESS_TOKEN`** potentiellement compromis (était dans un fichier local) : aller sur `supabase.com/dashboard/account/tokens`, le révoquer, en générer un nouveau si besoin.
- **`service_role` key Supabase** potentiellement compilée dans des builds mobile précédents (était dans `app_krono/.env`) : Supabase Dashboard → Settings → API → régénérer la `service_role` key pour invalider l'ancienne.
- **Token Twilio** en clair dans `.env` : à faire tourner (rotation côté console Twilio).
- **`SENTRY_AUTH_TOKEN`** : à sortir des `.env` locaux et déplacer dans les secrets EAS (ne doit pas rester en clair dans un fichier committable).
- **M-7 — token BetterStack/Logtail** : BetterStack → Sources → New Source → créer une source "Krono Driver Mobile", puis remplacer le token dans `driver_krono/.env` et dans les secrets EAS.
- **M-3 — `HEALTH_SECRET` backend Render** : ajouter la variable `HEALTH_SECRET` dans les variables d'environnement du dashboard Render (valeur déjà générée — ne pas la committer en clair dans ce fichier ni ailleurs dans le repo), puis configurer la sonde monitoring pour envoyer le header `x-health-secret: <valeur>` dans ses requêtes.

---

## Sécurité / Backend

- Tester le chemin "base Supabase vide → migrations 001 à 041" de bout en bout (nécessite une branche Supabase payante, pas encore lancée).
- Vérifier sur un vrai appareil les alertes push de solde commission livreur (`commissionService.checkAndSendAlerts`).

## OTP / Auth (Orange CI)

- **Bloquant prod** : faire approuver un template WhatsApp (Twilio/Meta Content Template Builder) puis renseigner `TWILIO_WHATSAPP_CONTENT_SID` en `.env`.
- Vérifier côté console Twilio s'il existe une route SMS dédiée/enregistrée pour Orange CI.
- Vérifier l'impact coût (conversation WhatsApp vs SMS) sur le volume Orange une fois en prod.

## B2B / Partenaires

**Nécessitent une décision produit avant tout code (rien à faire seul dessus) :**
- **Fusion de deux fiches partenaire** : que devient un abonnement/quota en double, un utilisateur lié aux deux fiches, un historique de factures divergent ? Pas implémenté, pas de règle définie.
- **Documenter la feature Commissionnaire** dans `docs/commissionnaire.md` : aucun code n'existe pour cette feature, et le pricing/l'avance de fonds/le plafond budget/l'assurance-litiges ne sont pas décidés. Rédiger cette doc reviendrait à inventer des règles produit ; à faire une fois ces décisions prises.
- **E-mail portail obligatoire à l'étape forfait** (`app_krono/app/(auth)/business-onboarding.tsx:106`, actuellement `portalEmail.trim() || undefined`, jamais bloquant) : la tâche elle-même est conditionnelle ("si le produit l'exige") — décision à prendre : le rendre obligatoire ou non.

### Grille B2B / monétisation cible

- Décider : implémenter maintenant la grille commerciale **cible validée** de `docs/tale/MONETISATION.md` (%+frais fixe FCFA, ex. Starter 8%+100 in-quota — différente de la grille technique actuelle 5%/3%/2%), ou stopgap simple d'abord. Touche backend, app client, admin, portail.
- Persister gain livreur réel / marge Krono par commande (`driver_earning_cfa`, `krono_delivery_margin_cfa`, `b2b_fee_cfa`, `driver_payout_model`) — dépend de la décision grille ci-dessus (`docs/tale/MONETISATION.md` section 7/10). Certains écrans confondent aujourd'hui prix de la course et gain livreur.

### Roadmap produit (peu prioritaire, jalons futurs)

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

## Évaluation qualité — critères nécessitant le simulateur (nécessite mon feu vert)

Suite à l'audit `docs/evaluation_krono_2026-07-23.md` (backend et accessibilité terminés,
doc supprimé — absorbé ici). 7 critères sur 20 restent plafonnés parce qu'ils ne peuvent pas
être jugés depuis le code seul, il faut lancer l'app sur simulateur/device (skill `run`) :

- Design UI
- UX (parcours réels : OTP, commande, paiement, tournée)
- Performance/fluidité perçue
- Optimisation ressources (profiling mémoire/CPU)
- Animations/micro-interactions
- Temps de chargement/réactivité
- Standards iOS/Android (HIG/Material)

**Nécessite mon autorisation explicite avant de lancer le simulateur.**

**Pourquoi c'est repoussé à après le WhatsApp OTP (voir "OTP / Auth (Orange CI)" ci-dessus)** :
actuellement l'app est considérée comme pointant en production. Lancer le simulateur pour
tester ces critères implique de passer par l'authentification (OTP), ce qui déclencherait un
vrai envoi SMS/WhatsApp via Twilio (coût réel / quota consommé) — inacceptable tant que le
template WhatsApp n'est pas validé.

Vérifié dans le code (2026-07-23) — la parade technique existe déjà, à utiliser le moment
venu plutôt qu'à réinventer :
- `emailService.ts` (SMS) : si aucune config Twilio/Vonage n'est présente en environnement
  non-production, l'envoi est **simulé** (code loggué + renvoyé dans `debug_code` de la
  réponse API) — zéro coût.
- `twilioWhatsAppService.ts` (WhatsApp) : **pas** de simulation — si les clés Twilio sont
  présentes, un vrai envoi est tenté. C'est le chemin forcé pour tout numéro détecté Orange CI.
- Donc pour tester sans frais une fois prêt : lancer l'app contre un **backend local** (pas
  Render prod) avec un **numéro de test MTN/Moov** (pas Orange) → passe par le chemin SMS
  simulé, code recyclable directement depuis la réponse API/les logs, aucun envoi réel.

## Bugs mineurs repérés (audit accessibilité 2026-07-23)

- `app_krono/app/profile/support.tsx` **et** `driver_krono/app/profile/support.tsx` : items
  FAQ en accordéon (chevron d'expansion) sans aucune action — fonctionnalité inachevée,
  identique dans les 2 apps. Laissé de côté pour l'instant sur demande explicite.

## Tournées B2B (driver_krono)

- **Patch Android navigation en français à valider sur un vrai build** : voir `krono-reference-unique.md` section 16 (Tournées, "Langue de navigation") — appliqué le 2026-07-23 mais non testé, build Android local bloqué.

## App Store / Stabilisation

- **Documents légaux** (confidentialité, CGU) — **bloquant Apple**. `admin_krono/app/legal/confidentialite/page.tsx` et `.../cgu/page.tsx` sont des placeholders explicites ; nécessite des infos réelles sur l'entreprise (identité responsable de traitement, adresse, contact DPO) que seul l'utilisateur peut fournir.
- **Divergence versions mobiles** : merger `chore/align-expo-driver-chrono-55` (Expo 55, commit `afbf357`, poussée sur le remote) après validation build Android réel (device/émulateur ou `eas build`) + test manuel navigation turn-by-turn Mapbox sur device — bloqué localement par un souci Gradle/JDK (`JvmVendorSpec.IBM_SEMERU`), probable problème d'environnement machine.
