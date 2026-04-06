# Prod Chrono — checklist (`ckprod`)

**§2 Avant prod : terminé pour ce projet.**

---

## 3. Phase PENDANT la production (premier déploiement et publication)

Objectif : sécurité et comptes → données → validation réelle → **légal** → bêta stores → **soumission** → confort (monitoring).

*Infra déjà en place :* API `https://api.kro-no-delivery.com` (Render), admin `https://admin.kro-no-delivery.com` (Vercel), DNS, `ALLOWED_ORIGINS`, secrets EAS, builds **iOS** prod — ne pas refaire sauf incident.

*EAS / TestFlight — piège fréquent :* le build **production** sur les serveurs Expo **ne lit pas** ton `.env` local. L’environnement **production** du projet (`eas env:list` → production) doit contenir **toutes** les variables `EXPO_PUBLIC_*` utiles (API, socket, **Supabase**, **Mapbox `pk.`**, légal, Sentry…), comme dans `app_chrono/.env` / `driver_chrono/.env`. Sinon **`expo run:ios`** peut marcher alors que **TestFlight** plante ou se comporte mal. Création : `eas env:create --environment production --name NOM --value "…" --type string --visibility plaintext` ou `sensitive` + `--non-interactive` (le flag `--type` n’accepte que `string` / `file` ; la confidentialité = `--visibility`).

### 3.1 Checklist *(ordre recommandé)*

**A — Urgent (avant tout le reste si concerné)**

- [ ] Révoquer l’ancien token Mapbox **sk** s’il a pu fuiter.
- [ ] Retirer / ignorer la zone Cloudflare **kronodelivery.com** si elle est inutile (évite confusion DNS).
- [ ] Vérifier la **facturation Vercel** si tu as reçu une alerte (évite coupure admin plus tard).

**B — Données prod** *(skip si §2 déjà validé de bout en bout)*

- [ ] **Supabase prod** : migrations à jour, **RLS** cohérente, **backups** actifs.

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

### 4.1 Habitudes de sécurité

- Ne pas committer de secrets ; faire tourner les clés si fuite suspectée.
- Ne pas exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
- Après chaque **grosse feature** base / API : revue rapide **RLS** + routes protégées.

### 4.2 Monitoring

- Consulter **Sentry** (pics d’erreurs après une release).
- Lire les **logs** du PaaS en cas d’incident.
- Optionnel : **uptime** (UptimeRobot, Better Stack, etc.) sur `https://api.kro-no-delivery.com/health/live` — vérifier que le service est encore maintenu avant de t’y fier.

### 4.3 Données

- Vérifier périodiquement que les **backups** Supabase sont actifs.
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

---

## Fichiers utiles dans le repo

| Sujet | Fichier |
|--------|---------|
| Qualité app (session, push, robustesse) | `docs/app-quality-checklist.md` |
| Variables backend | `chrono_backend/.env.example` |
| Contrôles prod backend | `chrono_backend/src/config/envCheck.ts` |
| Apps Expo | `app_chrono/.env.example`, `driver_chrono/.env.example` |
| RLS | `supabase/RLS_POLICIES.sql` |

*Ancienne version très longue de ce guide :* `git log --oneline -- docs/ckprod.md` puis `git show <hash>:docs/ckprod.md`.
