# Apps mobiles — auth, persistance, cycle de vie

**Rôle de ce fichier** : (1) **où c’est dans le code** ; (2) **ce qu’il faut valider sur un vrai iPhone** — impossible sans **OTP / Twilio** opérationnel pour un login complet, ou sans session déjà présente.

---

## Bloqué tant que le test réel n’est pas possible

- **Twilio / SMS** : compte suspendu ou non rechargé → pas d’OTP → pas de parcours login bout‑en‑bout sur device pour valider la session.
- Tout ce qui suit suppose : build **TestFlight prod** (ou équivalent), **réseau** Wi‑Fi puis **4G** si tu veux être exhaustif.

---

## À valider sur device *(dès que OTP OK)*

**Session (client Krono)**  
- Login → **Home** (app en arrière‑plan) → rouvrir → **toujours connecté**.  
- Login → **tuer l’app** → relancer → **toujours connecté** tant que le refresh JWT est valide (défaut backend ~10 ans sans variable d’env).  
- Si déconnexion : **volontaire** (bouton déconnexion, réinstall, effacement données), **refresh expiré** (rare : durée longue côté `jwt.ts` / `JWT_REFRESH_EXPIRES_IN`), ou **bug** — noter la date du build.

**Session (livreur Krono pro)**  
- **Mêmes scénarios** que le client.

**Cycle de vie / temps réel**  
- Après retour **premier plan** : l’app rafraîchit le token (`_layout`) et **resynchronise les sockets** si le JWT a changé ou le lien est mort (déjà en code).  
- Vérifier en usage réel : **commandes** et **messagerie** restent cohérentes (événements reçus, pas d’état « figé »).

---

## Carte du code *(référence)*

### Client (`app_chrono`)

| Élément | Fichier |
|--------|---------|
| Auth Zustand + persist | `store/useAuthStore.ts` — clé `auth-storage` |
| Refresh SecureStore | `utils/secureTokenStorage.ts` — `chrono:refreshToken` |
| Cold start | `app/index.tsx` — `hydrateTokens`, `ensureAccessToken`, route `(tabs)` / `(auth)` ; refresh présent sans access immédiat → **pas de logout** sur simple échec réseau |
| Retour actif + refresh périodique | `app/_layout.tsx` — `AppState`, `ensureAccessToken`, sync socket |
| Socket commandes | `services/userOrderSocketService.ts` ; branchement `app/(tabs)/_layout.tsx` |

### Livreur (`driver_chrono`)

| Élément | Fichier |
|--------|---------|
| Auth | `store/useDriverStore.ts` + SecureStore équivalent |
| Cold start | `app/index.tsx` |
| Retour actif + refresh | `app/_layout.tsx` |
| Sockets | `services/orderSocketService.ts`, `services/driverMessageSocketService.ts` — branchement `app/(tabs)/index.tsx` |

### Décisions déjà en place

- **Pas** d’écran « l’app charge » pour l’hydratation : tout passe **en coulisse** ; le **splash natif** couvre le tout début.
- **Backend** : durée de vie du refresh cohérente ; côté app, erreur réseau sur le refresh **ne déclenche pas** un logout si un refresh existe encore.

---

*Déploiement + backlog qualité (réseau, push, tests dynamiques, etc.) : **`docs/ckprod.md`** (§4.7).*
