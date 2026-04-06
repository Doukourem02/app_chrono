# Prod Chrono — checklist (`ckprod`)

## 3. Phase PENDANT la production (premier déploiement et publication)

Objectif : sécurité et comptes → données → validation réelle → **légal** → bêta stores → **soumission** → confort (monitoring).

*Infra déjà en place :* API `https://api.kro-no-delivery.com` (Render), admin `https://admin.kro-no-delivery.com` (Vercel), DNS, `ALLOWED_ORIGINS`, secrets EAS, builds **iOS** prod — ne pas refaire sauf incident.

*EAS / TestFlight — piège fréquent :* le build **production** sur les serveurs Expo **ne lit pas** ton `.env` local. L’environnement **production** du projet (`eas env:list` → production) doit contenir **toutes** les variables `EXPO_PUBLIC_*` utiles (API, socket, **Supabase**, **Mapbox `pk.`**, légal, Sentry…), comme dans `app_chrono/.env` / `driver_chrono/.env`. Sinon **`expo run:ios`** peut marcher alors que **TestFlight** plante ou se comporte mal. Création : `eas env:create --environment production --name NOM --value "…" --type string --visibility plaintext` ou `sensitive` + `--non-interactive` (le flag `--type` n’accepte que `string` / `file` ; la confidentialité = `--visibility`).

### 3.1 Checklist *(ordre recommandé)*

*Validations **session / OTP / arrière‑plan / sockets** (détail + Twilio) : **`docs/mobile-auth-and-lifecycle.md`**.*

*Vigilance **A** (Mapbox **sk**, zone Cloudflare **kronodelivery.com**, facturation **Vercel**) : **OK pour l’instant** — ne revérifier qu’en cas d’alerte ou de changement.*

**B — Données prod** *(projet Supabase branché sur l’API prod — pas une « 2ᵉ BDD » obligatoire ; à valider avant de considérer la prod « figée »)*

- [ ] **Supabase** (même projet que le backend prod) : migrations à jour, **RLS** cohérente, **backups** actifs *(dashboard)*.

**C — Smoke web** *(rapide, navigateur)*

- [ ] Admin prod charge sans erreur (sinon CORS / `ALLOWED_ORIGINS`).
- [ ] `GET https://api.kro-no-delivery.com/health` et `/health/live` OK.

**D — Apps sur appareil réel** *(IPA / build prod vs API prod)*

- [ ] **iPhone** : installer les **nouvelles IPAs** ; **login**, **commandes**, **carte** (Mapbox) contre `https://api.kro-no-delivery.com`.
- [ ] **Temps réel** : une action visible côté client / chauffeur (sockets) si tu relies les deux rôles en test.

**E — Légal avant review store**

- [ ] Pages **CGU** et **confidentialité** publiées (URLs stables, HTTPS).
- [ ] Sur **EAS** pour **app_chrono** et **driver_chrono** : `EXPO_PUBLIC_LEGAL_CGU_URL`, `EXPO_PUBLIC_LEGAL_PRIVACY_URL`.
- [ ] **Rebuild** les binaires si tu viens d’ajouter ou de changer ces URLs.

**F — Distribution de test** *(quand binaire + légal sont OK)*

- [ ] **TestFlight** (iOS) : build prod, testeurs internes / externes selon ton besoin.
- [ ] **Google Play** : piste **interne** ou **fermée** avec l’APK/AAB prod.

**G — Android** *(uniquement si tu vises le Play Store)*

- [ ] `eas build --profile production --platform android` — **app_chrono**.
- [ ] `eas build --profile production --platform android` — **driver_chrono**.

**H — Soumission stores**

- [ ] **App Store Connect** : captures, textes, confidentialité, âge, etc.
- [ ] **Play Console** : idem + fiche conforme aux exigences actuelles.

**I — Optionnel (confort)**

- [ ] **Sentry** : erreur de test reçue après une release.
- [ ] **Uptime** (UptimeRobot, Better Stack, …) sur `https://api.kro-no-delivery.com/health/live`.

### 3.2 Docker et Kubernetes à cette phase

- **Docker** : seulement si ton hébergeur ou toi impose une image (sinon le PaaS build souvent depuis `package.json`).
- **Kubernetes** : inutile pour cette étape dans la majorité des cas.

### 3.3 Critères « c’est bon »

- Admin + API répondent ; apps **production** créent des commandes et le **temps réel** fonctionne.
- Légal pointé dans l’app et validé en bêta avant soumission définitive.

---

## 4. Phase APRÈS la production (exploitation continue)

À **entretenir** tant que le service vit : habitudes, pas une liste à « finir une fois » comme le **§3**. La **première mise en place** Sentry / uptime reste le **§3.I**.

### 4.1 Habitudes de sécurité

- Ne pas committer de secrets ; faire tourner les clés si fuite suspectée.
- Ne pas exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
- Après chaque **grosse feature** base / API : revue rapide **RLS** + routes protégées.

### 4.2 Monitoring

- **Sentry** : surveiller les pics après une release *(config initiale + premier test d’erreur : **§3.I**)*.
- **Logs** du PaaS en cas d’incident.
- **Uptime** optionnel sur `https://api.kro-no-delivery.com/health/live` *(outil externe + **§3.I** ; vérifier périodiquement que l’outil est encore actif)*.

### 4.3 Données

- **Backups** Supabase : contrôle périodique *(aligné **§3.B** au moment du go prod)*.
- Avant migrations **destructives** en prod : **export** ou snapshot si possible.

### 4.4 Stores

- Mettre à jour les **textes légaux** et les URLs si la politique change.
- Incrémenter les **versions** / build numbers pour chaque soumission.

### 4.5 Retours utilisateurs et cycles de release

- **Feedback** : formulaire, email support, ou plus tard Sentry + commentaires store.
- **Bugs critiques** : corriger, rebuild EAS, resoumettre ; documenter ce qui était cassé.
- **Cohérence version** : lien clair entre **tag git** / branche release et **build** store.

### 4.6 Évolution technique *(quand tu grandis)*

- **Rate limiting** sur l’API si forte exposition publique.
- **Plusieurs instances** backend : Socket.IO peut exiger **sticky sessions** ou **adapter Redis** — avancé, pas nécessaire au début.
- **CI** : faire échouer le build sur vulnérabilités critiques (`npm audit`) si tu veux durcir.

### 4.7 Backlog qualité app *(hors déploiement pur)*

Amélioration **continue** dans le code ou sur device. **Smoke minimal** : **§3.D** ; session / OTP / arrière‑plan : **`docs/mobile-auth-and-lifecycle.md`**.

- [ ] **Réseau** : messages clairs hors ligne / timeout (pas d’écran muet).
- [ ] **Robustesse API** : pas de crash sur réponses inattendues.
- [ ] **Perf / batterie** : GPS / carte raisonnables quand l’écran carte n’est pas actif.
- [ ] **Push** : APNs / Expo + backend ; tests sur device.
- [ ] **Sentry mobile** : `EXPO_PUBLIC_SENTRY_DSN` sur EAS, rebuild, erreur de test reçue — *première fois **§3.I**, suivi **§4.2***.
- [ ] **Dette** : tests auto ciblés (auth / refresh) ; politique « app trop vieille » vs API si tu casses des contrats.

**Tests dynamiques** *(complètent **§3.D** ; auth / OTP : `mobile-auth-and-lifecycle.md`)* :

1. Auth : inscription / OTP / session stable  
2. Commande : création → statuts → temps réel des deux côtés  
3. Carte : pickup / livraison, Mapbox OK  
4. Paiement (si activé en prod) : nominal + annulation si applicable  
5. Edge : mode avion ~10 s puis retour réseau — l’app recolle sans tout casser  

---

## Fichiers utiles dans le repo

| Sujet | Fichier |
|--------|---------|
| Session, OTP, cycle de vie, validations device liées | `docs/mobile-auth-and-lifecycle.md` |
| Variables backend | `chrono_backend/.env.example` |
| Contrôles prod backend | `chrono_backend/src/config/envCheck.ts` |
| Apps Expo | `app_chrono/.env.example`, `driver_chrono/.env.example` |
| RLS | `supabase/RLS_POLICIES.sql` |

*Ancienne version très longue de ce guide :* `git log --oneline -- docs/ckprod.md` puis `git show <hash>:docs/ckprod.md`.
