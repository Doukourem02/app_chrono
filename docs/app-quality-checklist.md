# Chrono — checklist qualité & robustesse (apps mobiles)

Ce document complète **`docs/ckprod.md`** (déploiement / stores). Ici : **comportement sérieux en prod**, par phases — tu n’as pas à tout faire d’un coup.

---

## Lien avec la prod

| Sujet | Document |
|--------|----------|
| DNS, EAS, TestFlight, soumission | `docs/ckprod.md` |
| Variables `EXPO_PUBLIC_*` sur EAS | `app_chrono/.env.example`, encart dans `ckprod.md` |

---

## Phase 0 — Déjà traité ou en cours *(référence)*

- [x] Infra API / admin / DNS
- [x] EAS : toutes les vars nécessaires en **production** (éviter l’écart dev vs TestFlight)
- [x] Pages **CGU** / **confidentialité** (`admin_chrono/app/legal/*`) + URLs dans EAS
- [ ] **Persistance de session** : correction « logout dès que le refresh access échoue au cold start » (`app/index.tsx`, `driver_chrono/app/index.tsx`) — *à valider sur device*

---

## Phase 1 — Session & auth *(priorité haute, « sérieux »)*

- [ ] Valider sur **iPhone** : login → sortie app (home) → retour → **toujours connecté** (4G + Wi‑Fi)
- [ ] Même test après **tuer l’app** (multitâche) puis relance
- [ ] **Refresh token** : durée de vie côté backend cohérente ; pas de déconnexion sur simple timeout réseau
- [ ] **Root layout** : au retour au premier plan, éviter les `logout()` agressifs si l’API est down (*auditer `userApiService` / `apiService`*)
- [ ] Aligner **driver** et **client** sur les mêmes règles (déjà partiellement le cas)

---

## Phase 2 — État & cycle de vie

- [ ] **État global** : `isAuthenticated`, `user`, commandes — documenter où est la source de vérité (Zustand + rehydration)
- [ ] **Arrière-plan / premier plan** : pause des polls lourds ; reconnexion socket si besoin
- [ ] **Cold start** : écran de chargement ou état neutre jusqu’à fin d’hydratation + tentative de refresh token (*option UX*)

---

## Phase 3 — Réseau & erreurs

- [ ] Messages utilisateur si **timeout** / **hors ligne** (pas d’écran figé)
- [ ] **Edge cases** : JSON invalide, 502 — pas de crash ; logs + Sentry
- [ ] Politique **retry** documentée (déjà partielle sur le refresh)

---

## Phase 4 — Performance & batterie

- [ ] GPS : fréquence raisonnable ; arrêt quand l’écran carte n’est pas actif si possible
- [ ] Taille des assets / cartes — vérifier périodiquement

---

## Phase 5 — Notifications push *(plus tard, comme convenu)*

- [ ] Comptes **APNs** (iOS) / **FCM** (Android), clés côté Expo
- [ ] Backend : envoi ciblé (nouvelle course, statut, etc.)
- [ ] Tests sur **vrai device** ; comportement en arrière-plan

---

## Phase 6 — Monitoring & QA

- [ ] **Sentry** (`EXPO_PUBLIC_SENTRY_DSN` sur EAS + rebuild)
- [ ] **Uptime** API (`/health/live`) — voir `ckprod.md`
- [ ] Scénarios de test manuels avant chaque release (auth, commande, carte, socket)

---

## Phase 7 — Dette technique & évolution

- [ ] Après stabilisation : tests automatisés ciblés (auth, refresh)
- [ ] Version minimale d’app vs API (message « mettez à jour » si besoin)
- [ ] Revue périodique des dépendances majeures (Expo, Mapbox)

---

## Ordre recommandé pour toi maintenant

1. **Phase 1** : installer les builds avec le correctif session, tester les allers-retours app.
2. **Phase 3** (léger) : noter tout comportement bizarre réseau.
3. **Phase 5** quand tu es prêt : push.
4. Le reste en fonction du trafic et des retours utilisateurs.

*Les piliers « iceberg » (widget, webhooks massifs, charge 10k users, etc.) ne sont pas tous listés ici : ajoute-les quand le produit les exige.*
