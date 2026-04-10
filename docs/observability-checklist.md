# Checkliste observabilité (Krono / Chrono)

Alignée avec la stack prévue : **garder** Winston, Sentry, Slack ; **ajouter** Better Stack (logs centralisés), corrélation (`request_id`), uptime.

_Dernière mise à jour des cases : avril 2026 — les lignes encore vides sont des vérifications manuelles ou secrets à confirmer._

---

## Compte & configuration (hors code)

- [x] Créer un compte **Better Stack** (ou équivalent si tu changes d’avis).
- [x] Créer une **source / dataset** pour les logs du **backend** et récupérer le **token / URL d’ingestion** (source **Render** + source token).
- [x] (Optionnel mais utile) Activer **l’uptime** dans Better Stack vers l’URL publique de l’API + chemin **health** (ex. `https://api.kro-no-delivery.com/health`).
- [x] Ajouter les variables d’environnement sur **Render** (ou ton hébergeur) : token Better Stack, sans les committer — _à reconfirmer sur le dashboard Render si besoin._

---

## Backend Node (`chrono_backend`)

- [x] Ajouter un **middleware `request_id`** : générer un UUID si absent, accepter `X-Request-Id` du client si présent, exposer la même valeur en réponse (`X-Request-Id`).
- [x] Faire remonter `request_id` dans les logs Winston (**`defaultMeta`** ou équivalent) pour que **chaque ligne** de log d’une requête soit liée.
- [x] Brancher un **envoi des logs vers Better Stack** (transport Winston dédié, ou envoi des lignes JSON déjà produites — **en prod** surtout, pour ne pas saturer en dev si tu préfères).
- [x] Garder l’écriture **fichiers locaux** si tu veux un filet de secours sur le serveur, ou documenter que tout part vers Better Stack uniquement.
- [ ] Vérifier que **`SENTRY_DSN`** reste configuré en prod (inchangé).
- [x] Vérifier que les **alertes Slack** restent comme aujourd’hui (ou ajuster le bruit une fois les logs centralisés) — _comportement inchangé côté code ; ajuster le bruit au besoin après coup._

---

## Apps Expo (`app_chrono`, `driver_chrono`)

- [x] Rien d’obligatoire pour Better Stack au début (les apps ne streament pas Winston).
- [ ] Confirmer **`EXPO_PUBLIC_SENTRY_DSN`** en **EAS / prod** pour les deux apps.
- [x] (Optionnel) Envoyer **`X-Request-Id`** sur les appels API si tu génères un id côté client — aide à **lier** un bug Sentry côté app à une trace côté backend — _implémenté dans `apiFetch` (app + driver)._

---

## Admin Next (`admin_chrono`)

- [x] Finir de **câbler Sentry** là où il reste en TODO (`error.tsx`, `global-error.tsx`, etc.) si tu veux le même niveau que le reste.
- [ ] Vérifier les **variables Sentry** en prod (build / Vercel / autre).

---

## Validation

- [ ] Déclencher une erreur **500** volontaire en staging → voir l’événement dans **Sentry**, la ligne dans **Better Stack**, l’alerte **Slack** si applicable.
- [ ] Faire une requête avec un **`X-Request-Id`** fixe → toutes les lignes backend avec le **même** id dans Better Stack.
- [ ] Couper l’API (ou simuler une panne) → **alerte uptime** reçue.

---

## Ordre conseillé

1. `request_id` + Winston (base pour tout le reste).
2. Ingestion **Better Stack**.
3. **Uptime**.
4. Finitions **Sentry admin** + optionnel **`X-Request-Id`** depuis les apps.
