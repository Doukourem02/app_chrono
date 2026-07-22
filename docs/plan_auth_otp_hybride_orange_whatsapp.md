# Plan — Authentification OTP hybride SMS/WhatsApp (Orange CI)

Statut : **validé le 2026-07-22, routage backend/front implémenté le 2026-07-22 — reste le template WhatsApp côté console Twilio (bloquant pour la prod) et les vérifications listées en 3.**

## 1. Constat

En Côte d'Ivoire, trois opérateurs mobiles : MTN, Orange, Moov. Les OTP envoyés par SMS classique via Twilio ne sont pas délivrés de façon fiable aux numéros Orange (probable filtrage/route A2P non enregistrée côté agrégateur pour Orange CI — piste non encore vérifiée côté Twilio). MTN et Moov n'ont pas ce problème.

En parallèle, un WhatsApp Sender Twilio a été mis en place et est opérationnel :
- Numéro : `+19788624416`
- Nom d'affichage : Krono Livraison
- WhatsApp Business Account ID : `1637749137326619`
- Meta Business Manager ID : `174819703498006`

## 2. Décision produit

Pas de bascule 100% WhatsApp — approche **hybride par opérateur** :

- **Orange** → OTP envoyé **exclusivement par WhatsApp** (le SMS est considéré non fiable pour cet opérateur).
- **MTN / Moov** → OTP envoyé par **SMS classique** en premier (fonctionne bien, moins cher).
- **Fallback universel** → un bouton "Renvoyer par WhatsApp" disponible pour tout utilisateur en cas d'échec/timeout du SMS, quel que soit l'opérateur détecté.

## 3. Reste à faire

- [x] Détection de l'opérateur à partir du numéro : **préfixe national CI retenu** (01 Moov, 05 MTN, 07 Orange — fiable, stable depuis le plan de numérotation 2021, pas de coût d'appel API). Implémenté dans `chrono_backend/src/utils/phoneE164CI.ts` (`detectCarrierCI`), testé dans `chrono_backend/tests/unit/utils/phoneE164CI.test.ts`.
- [ ] Vérifier côté Twilio s'il existe une route SMS dédiée/enregistrée pour Orange CI avant de considérer le SMS Orange comme définitivement non viable.
- [x] Backend : logique de choix de canal à l'inscription/connexion (Orange → WhatsApp only, MTN/Moov → SMS avec `otpMethod` demandé, fallback WhatsApp sur demande via le front). Implémenté dans `chrono_backend/src/controllers/authController.ts` (`sendOTPCode`) ; `otpStorage.ts` / `bruteForceProtection.ts` / `rateLimiter.ts` inchangés (canal découplé de la logique anti-abus).
- [ ] Templates WhatsApp approuvés (Content Template Builder Twilio) — **bloquant restant** : requis pour initier une conversation WhatsApp avec un OTP hors session 24h. Étape console Twilio/Meta à faire côté utilisateur, puis renseigner `TWILIO_WHATSAPP_CONTENT_SID` en `.env`.
- [x] UX : message clair si un utilisateur Orange n'a pas WhatsApp installé/actif (pas de blocage silencieux) — message d'erreur dédié dans `authController.ts` + bouton "Renvoyer par WhatsApp" affiché sur l'écran de vérification (`app_chrono/app/(auth)/verification.tsx`, `driver_chrono/app/(auth)/verification.tsx`) quand la méthode courante n'est pas déjà WhatsApp.
- [ ] Vérifier l'impact coût (conversation WhatsApp vs SMS) sur le volume Orange.

## 4. Ne pas implémenter sans accord explicite

Ce document sert de plan de référence. L'implémentation ne doit démarrer qu'après validation explicite de l'utilisateur, en commençant par l'analyse du code d'auth backend actuel pour brancher la détection d'opérateur et le routage.
