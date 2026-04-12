# Checklist production — Krono (backend)

Fichier associé : `.env.example`. Au démarrage en `NODE_ENV=production`, le serveur peut logger des **avertissements** qui renvoient ici.

---

## Commencer ici (ordre recommandé)

Fais les étapes **dans l’ordre**. Coche quand c’est fait.

> **Déjà en place ?** Si sur Render tu as déjà `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (et le reste côté Supabase), considère **A.5 comme fait** et ignore les lignes `SUPABASE_*` du tableau B. Il reste surtout à **valider** : `DATABASE_URL` (souvent distinct des clés API), **région / pause**, **pool** (`DB_POOL_*`), puis **Étape C**.

### Étape A — Supabase (5–10 min)

1. [ ] Ouvre ton projet : [Supabase Dashboard](https://supabase.com/dashboard) → ton projet.
2. [ ] **Région** : note la région du projet ; idéalement la **même** (ou proche) que ton service Render.
3. [ ] **Pause** : *Settings* → *General* → désactive la mise en pause si tu es sur une offre qui dort (sinon premières requêtes très lentes).
4. [ ] **Chaîne Postgres** (`DATABASE_URL` sur Render) : *Settings* → *Database* → *Connection string* → onglet **URI** ou **Transaction pooler** (souvent `*.pooler.supabase.com` port **6543** pour une app Node long-running). Copie l’URL ; remplace `[YOUR-PASSWORD]` par le mot de passe DB. **Ce n’est pas la même chose que la clé anon / service_role** : c’est l’URL JDBC/Postgres du serveur SQL.
5. [ ] **Clés API** (souvent déjà OK) : *Settings* → *API* → **Project URL** → `SUPABASE_URL` ; **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (jamais exposée au client). La **anon** sert au front / clients publics, pas au backend admin.

### Étape B — Render : variables d’environnement (10 min)

Ouvre ton **Web Service** → *Environment* → *Add* pour chaque ligne pertinente.


| Variable                      | Obligatoire pour                     | Où la valeur                                                 |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`                | Pool SQL, routes qui tapent Postgres | Étape A.4 (connection string **Database**, pas l’onglet API) |
| `SUPABASE_URL`                | Auth admin dashboard                 | Étape A.5 — *skip si déjà défini*                            |
| `SUPABASE_SERVICE_ROLE_KEY`   | Idem                                 | Étape A.5 — *skip si déjà défini*                            |
| `JWT_SECRET`                  | Auth app (≥ 32 car.)                 | Secret fort généré                                           |
| `ALLOWED_ORIGINS`             | CORS prod                            | URLs admin, app, driver séparées par `,`                     |
| `DB_POOL_MAX` / `DB_POOL_MIN` | Stabilité DB                         | Voir §1 ci-dessous                                           |
| `API_PUBLIC_URL`              | CORS Socket si besoin                | URL publique du backend (`https://…`)                        |


Puis **Save** → **Manual Deploy** (ou push) pour appliquer.

### Étape C — « Ça marche vraiment ? » (smoke test, 3 min)

**En une phrase :** après déploiement, tu vérifies que le serveur **démarre bien** et que **l’admin (ou l’app) arrive à parler au backend** sans erreur bloquante.

**C.1 — Le service tourne (Render)**  

- Va sur [dashboard.render.com](https://dashboard.render.com) → ton service **Krono / chrono-backend**.  
- Le statut doit être **Live** (vert), pas « Failed » ou « Build failed ».

**C.2 — Les logs au démarrage**  

- Même page → onglet **Logs**.  
- Fais défiler depuis le **dernier redémarrage** (après deploy).  
- Tu dois voir passer des lignes du genre :  
  - `Validation des variables d'environnement réussie`  
  - `Pool PostgreSQL initialisé` (parfois après un message « essai 1/4 » — c’est normal).
- Si tu vois surtout `Test de connexion PostgreSQL échoué après tous les essais` en boucle, ce n’est **pas** OK : la base ne répond pas comme il faut.

**C.3 — L’admin charge une page (pas besoin de jargon « route »)**  

- Ouvre ton **site admin** (celui que tu utilises déjà au quotidien).  
- **Connecte-toi** comme d’habitude.  
- Ouvre une page qui affiche des **données** (tableau de bord, liste de commandes, etc.).  
- Si la page **se charge** sans page blanche d’erreur ni message du type « erreur serveur » partout, c’est bon pour cette partie.  
*(Tu n’as pas besoin d’ouvrir Postman ni de connaître le nom exact de l’URL API : utiliser l’admin suffit.)*

**C.4 — Temps réel (optionnel mais utile)**  

- Si ton admin ou l’**app chauffeur** utilise le chat / la carte en direct : ouvre-la et regarde si ça **reste connecté** (pas d’erreur rouge évidente dans la console du navigateur, F12 → Console).  
- Si tu n’utilises pas ça, tu peux sauter cette case.

Checklist courte :

1. [ ] Render : statut **Live**.
2. [ ] Logs : `Validation…` puis `Pool PostgreSQL initialisé` (pas échec DB en boucle).
3. [ ] Admin : connexion + une page avec données qui s’affiche.
4. [ ] (Optionnel) App / admin temps réel sans erreur évidente.

### Étape D — Monitoring + alertes + scale (optionnel mais recommandé)

**Ordre conseillé :** D.1 → D.2 → D.3 (tu peux t’arrêter après D.1 si tu veux aller vite).

**D.1 — Sentry (`SENTRY_DSN`) — erreurs en production**  

- Va sur [sentry.io](https://sentry.io) → crée un compte / projet → choisis **Node.js**.  
- Copie le **DSN** (une URL du type `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`).  
- **Render** → ton service → *Environment* → **Add** : nom `SENTRY_DSN`, valeur = le DSN → **Save** → redeploy.  
- Après redeploy, les logs doivent dire que **Sentry est initialisé** (plus le warning « non configuré »).  
- Test : déclenche une erreur 500 volontaire en dev, ou attends une vraie erreur : elle doit apparaître dans Sentry.

**D.2 — Slack (`SLACK_WEBHOOK_URL`) — notifications équipe**  

- Dans Slack : une chaîne → *Intégrations* / *Incoming Webhooks* (selon ton workspace) → crée un webhook → copie l’URL `https://hooks.slack.com/services/...`.  
- **Render** → `SLACK_WEBHOOK_URL` = cette URL → Save → redeploy.  
- Utile seulement si ton code envoie déjà des messages via `slackNotifier` (sinon tu n’auras pas grand-chose à voir tant qu’aucun événement n’appelle le webhook).

**D.3 — Redis (`REDIS_URL`) — plusieurs instances Render + Socket.IO**  

- **Tu n’en as pas besoin** tant que tu n’as qu’**une seule** instance du backend (ton cas actuel avec `WEB_CONCURRENCY=1` sur une machine).  
- Dès que tu **dupliques** le service ou que tu mets **plus d’un process** qui sert Socket.IO derrière le même domaine : crée un Redis managé (ex. [Upstash](https://upstash.com), Redis sur Render, Redis Cloud).  
- Copie l’URL (`redis://…` ou `rediss://…` si TLS).  
- **Render** → `REDIS_URL` → Save → redeploy.  
- Logs attendus : `**Socket.IO Redis Adapter activé`** (au lieu du seul mode standalone).

Checklist courte :

1. [ ] D.1 `SENTRY_DSN` sur Render + redeploy + message Sentry OK dans les logs.
2. [ ] D.2 `SLACK_WEBHOOK_URL` (si tu veux les notifs Slack).
3. [ ] D.3 `REDIS_URL` (uniquement avant / en même temps que le scale multi-instance).

---

## 1. Base de données (PostgreSQL / Supabase)

- `**DATABASE_URL**` : URL correcte (souvent **pooler** `*.pooler.supabase.com` port **6543** pour beaucoup de workloads serveur — vérifier la doc Supabase pour ton cas).
- **Région** : la base et l’app Render sont dans des régions **proches** (latence + timeouts).
- **Pause projet** : sur offre gratuite, désactiver la pause ou accepter des lenteurs au réveil.
- **Limite de connexions** : aligner le pool sur ton plan Supabase.
  - `DB_POOL_MAX` : ex. **10–15** sur petit plan ; monter avec Pro/Team si besoin.
  - `DB_POOL_MIN` : **0** ou **1** si tu as peu de connexions disponibles (évite d’ouvrir 2 connexions permanentes au boot).
- **Timeouts boot** (déjà gérés dans le code avec valeurs par défaut) :
  - `DB_POOL_CONNECTION_TIMEOUT` (ms) — défaut code **25000** ; surcharger sur Render si besoin.
  - Optionnel : `DB_POOL_VERIFY_ATTEMPTS`, `DB_POOL_VERIFY_RETRY_DELAY_MS` (voir `.env.example`).

---

## 2. Scalabilité temps réel (Socket.IO)

- **Une seule instance** Render : le mode sans Redis peut suffire temporairement.
- **Plusieurs instances** (scale horizontal) : configurer `**REDIS_URL`** (ex. Redis managé : Upstash, Render Redis, Redis Cloud) avec **TLS** si fourni (`rediss://...`).
- Vérifier dans les logs après déploiement : `Socket.IO Redis Adapter activé` (et non seulement « standalone »).

---

## 3. Observabilité et alertes

- `**SENTRY_DSN`** : erreurs 5xx et exceptions tracées (déjà câblé dans `server.ts`).
- `**SLACK_WEBHOOK_URL**` : notifications ops (si utilisé par `slackNotifier`).
- Logs Render : rétention et recherche sur `warn` / `error`.

---

## 4. Sécurité et auth admin

- `**SUPABASE_URL**` + `**SUPABASE_SERVICE_ROLE_KEY**` : présents en prod pour l’admin dashboard.
- Ne pas activer `**ALLOW_ADMIN_JWT_FALLBACK**` en prod sauf cas exceptionnel documenté.

---

## 5. HTTP / CORS / sockets

- `**ALLOWED_ORIGINS**` : domaines admin + app + driver (séparés par des virgules).
- `**API_PUBLIC_URL**` (ou `RENDER_EXTERNAL_URL` auto) : si les clients envoient un `Origin` vers l’API.

---

## 6. Après chaque déploiement (smoke test)

- Health : le service écoute (Render « Live »).
- Logs : `Pool PostgreSQL initialisé` (éventuellement après 1–3 essais).
- Endpoint admin protégé : pas d’erreur 500 systématique sur une route simple.
- Socket : un client se connecte (app chauffeur ou admin).

---

## 7. Montée en charge (quand le trafic augmente)

- Mesurer CPU / mémoire Render et latence API.
- Tableau de bord Supabase : connexions, requêtes lentes.
- Ajuster `DB_POOL_MAX` / instances / Redis selon les mesures — pas « au feeling ».

---

## Étapes suivantes (après A → D de base)

Tu as fini l’**emballage prod** (DB, Render, smoke test, Sentry, Slack). La suite n’est plus une liste unique : ça dépend de tes objectifs.

### Maintenant (récurrent, peu de temps)

- [ ] Après **chaque déploiement** : refaire un mini **§6** (Live, logs Postgres OK, admin qui charge).
- [ ] **1× par semaine** (ou après incident) : jeter un œil à **Sentry** et au canal **Slack** d’alertes.
- [ ] Vérifier que le **webhook Slack** exposé par erreur a bien été **régénéré** et que seule la nouvelle URL est sur Render.

### Quand tu veux monter en charge ou ajouter une instance

- [ ] **§7** : regarder CPU / RAM Render et l’onglet **Database** / requêtes sur Supabase.
- [ ] **D.3** : configurer **`REDIS_URL`** *avant* ou *en même temps* que tu passes à **plusieurs instances** (sinon Socket.IO ne sera pas cohérent entre machines).

### Optionnel (plus tard)

- [ ] Logs centralisés : `BETTER_STACK_SOURCE_TOKEN` / `LOGTAIL_SOURCE_TOKEN` (voir `.env.example`) si tu veux tout chercher hors Render.
- [ ] **Sauvegardes / plan Supabase** : politique de rétention et exports selon ton risque métier.
- [ ] **Sécurité** : rotation des secrets (`JWT_SECRET`, clés API), revue des **ALLOWED_ORIGINS** quand tu ajoutes un nouveau front.