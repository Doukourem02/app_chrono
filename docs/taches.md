# Tâches — Krono

Ce fichier liste uniquement ce qui **nécessite une action de l'utilisateur** (accès externe, décision produit, argent, test sur device réel) — pas les tâches "code pur" que je peux traiter seul. `docs/krono-reference-unique.md` ne doit contenir que de l'orientation produit (règles, architecture, cartes de fichiers, décisions) — pas de tâches. Un item traité est supprimé d'ici ; si ça change une règle durable, c'est résumé dans la référence.

Paiement / mobile money : fichier dédié `docs/integration_paiement_en_ligne.md` (ne pas dupliquer ici).

---

## 🔴 Urgent — rotation de secrets compromis (action manuelle, pas du code)

État au 2026-07-27 — fait : `SUPABASE_ACCESS_TOKEN` révoqué/recréé, `service_role` Supabase migré vers la nouvelle Secret API key `krono_backend_sk` (local + Render), `anon` Supabase migré vers des Publishable keys `web_admin`/`mobile` (local + Vercel + EAS prod/preview), `HEALTH_SECRET` ajouté sur Render, `SENTRY_AUTH_TOKEN` nettoyé du `.env` local d'`app_krono` (déjà en EAS), token BetterStack/Logtail driver (M-7) migré vers une source dédiée "Krono Driver Mobile" (local + EAS production, testé avec succès HTTP 202). Résumé de la nouvelle architecture de clés Supabase ajouté dans `krono-reference-unique.md` (section 10).

Reste à faire (vérifié : aucun de ces tokens n'a jamais été commité dans l'historique git, sauf mention contraire) :

- **Désactiver les clés Supabase legacy** (`anon`/`service_role`, page "Legacy anon, service_role API keys") — volontairement pas encore fait : `app_krono`/`driver_krono` sont déjà publiées avec l'ancienne clé `anon` compilée en dur dans les builds installés ; désactiver maintenant casserait l'app pour tout utilisateur n'ayant pas encore mis à jour. À faire après la prochaine release mobile (nouveau build avec la clé `publishable`).
- **Token Twilio** — rotation mise en attente : le compte Twilio affiche **"Suspended"** (découvert le 2026-07-27, page Auth Tokens). À investiguer en priorité (onglet Billing du compte Twilio) avant toute rotation — l'OTP SMS/WhatsApp est probablement non fonctionnel en prod tant que le compte est suspendu.

---

## Sécurité / Backend

- Tester le chemin "base Supabase vide → migrations 001 à 041" de bout en bout (nécessite une branche Supabase payante, pas encore lancée).
- Vérifier sur un vrai appareil les alertes push de solde commission livreur (`commissionService.checkAndSendAlerts`).
- **Remplacer l'email/téléphone de support placeholder** (`app_krono/app/profile/support.tsx` et `driver_krono/app/profile/support.tsx`) : actuellement `support@chrono.com` (ancienne marque) et `+225 00 00 00 00 00` (faux numéro). Donner le vrai email et numéro de support Krono.

## OTP / Auth (Orange CI)

- **Bloquant prod** : faire approuver un template WhatsApp (Twilio/Meta Content Template Builder) puis renseigner `TWILIO_WHATSAPP_CONTENT_SID` en `.env`.
- Vérifier côté console Twilio s'il existe une route SMS dédiée/enregistrée pour Orange CI.
- Vérifier l'impact coût (conversation WhatsApp vs SMS) sur le volume Orange une fois en prod.

## B2B / Partenaires

**Nécessite une décision produit avant tout code (rien à faire seul dessus) :**
- **E-mail portail obligatoire à l'étape forfait** (`app_krono/app/(auth)/business-onboarding.tsx:106`, actuellement `portalEmail.trim() || undefined`, jamais bloquant) : la tâche elle-même est conditionnelle ("si le produit l'exige") — décision à prendre : le rendre obligatoire ou non.

Roadmap produit post-lancement (peu prioritaire) : déplacée dans `docs/roadmap_produit.md`.

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

## Tournées B2B (driver_krono)

- **Patch Android navigation en français à valider sur un vrai build** : voir `krono-reference-unique.md` section 16 (Tournées, "Langue de navigation") — appliqué le 2026-07-23 mais non testé, build Android local bloqué.

## App Store / Stabilisation

- **Documents légaux** (confidentialité, CGU) — **bloquant Apple**. `admin_krono/app/legal/confidentialite/page.tsx` et `.../cgu/page.tsx` sont des placeholders explicites ; nécessite des infos réelles sur l'entreprise (identité responsable de traitement, adresse, contact DPO) que seul l'utilisateur peut fournir.
- **Divergence versions mobiles** : merger `chore/align-expo-driver-chrono-55` (Expo 55, commit `afbf357`, poussée sur le remote) après validation build Android réel (device/émulateur ou `eas build`) + test manuel navigation turn-by-turn Mapbox sur device — bloqué localement par un souci Gradle/JDK (`JvmVendorSpec.IBM_SEMERU`), probable problème d'environnement machine.
