# Guide : mettre PROJET_CHRONO en ligne (App Store, Play Store, backend sécurisé)

Ce document est pensé pour un **développeur qui maîtrise le code** mais découvre le **déploiement** et le vocabulaire « production ». Il couvre **tout le chemin** : ce qui se passe **avant**, **pendant** et **après** la mise en ligne, avec des **outils possibles** et des **suggestions** pour Chrono.

**Important** : « Mettre l’app sur les stores » n’est **qu’une partie** du travail. Les utilisateurs ont besoin d’un **backend** (API + WebSockets), d’une **base de données** (Supabase), et souvent d’un **site admin** (`admin_chrono`). Les binaires App Store / Play Store sont des **clients** qui parlent à cette infrastructure. Sans backend et URL stables, les apps en prod ne fonctionneront pas correctement.

### Deux avis (ChatGPT / autre) → un seul guide

Tu as eu raison de comparer deux sources : **plusieurs avis, c’est prudent**. Ce fichier est la **référence fusionnée** pour **PROJET_CHRONO** (`app_chrono`, `driver_chrono`, `chrono_backend`, `admin_chrono`).

**Pièges d’une checklist « générique » générée par IA** (à garder en tête pour n’importe quel modèle) :

- **Noms de projet faux** : un autre guide pouvait parler de « PHARMACIE-APP » alors que ton repo est **Chrono** — si tu suis aveuglément, tu te trompes de contexte.
- **Outils obsolètes** : par exemple **Freshping** a été arrêté ; pour l’uptime, préfère **UptimeRobot**, **Better Stack**, ou l’équivalent de ton hébergeur.
- **Cases cochées trop vite** : des ✅ sur « Sentry backend » alors que le code n’initialise pas encore Sentry = **faux sentiment de sécurité**. Ici on dit : vérifier dans le code ou considérer que c’est une **étape à faire**.

**Ce qui a été repris de l’autre checklist** (sans doublon inutile) : branche / release Git, **release channels** Expo, **TestFlight** et **test interne Play**, tableau d’outils élargi (Neon, Bitrise, agrégateurs de logs), boucle **feedback** après prod, **tags git** — voir les sections concernées ci-dessous.

---

## 0. Carte mentale : qu’est-ce que la « production » ?

| Tu penses… | En réalité |
|------------|------------|
| L’app est sur l’App Store / Play Store | Oui, mais c’est le **client**. Il doit pointer vers ton **API en HTTPS** (variable d’environnement type `EXPO_PUBLIC_API_URL` dans les builds de prod). |
| Docker / Kubernetes | Ce sont des **façons d’emballer et d’exécuter** ton backend sur des serveurs. **Tu n’es pas obligé** de les utiliser pour la première mise en ligne. Beaucoup de projets démarrent avec **PaaS** (Railway, Render, Fly.io) qui lancent ton Node **sans** que tu écrives de Dockerfile. |
| DevOps | En pratique ici : **héberger** le backend, **configurer** secrets et HTTPS, **brancher** la base, **publier** les apps, **surveiller** les erreurs. Pas besoin d’être expert K8s pour ça. |

### 0.1 Docker et Kubernetes — explication simple (sans jargon inutile)

**Docker** imagine une **boîte fermée** dans laquelle tu mets : la bonne version de Node, ton code, tes dépendances. Cette boîte se comporte **pareil** sur ton Mac, sur un serveur Linux, chez un hébergeur. C’est pratique quand tu veux que **tout le monde** lance exactement le même environnement. **Tu n’es pas obligé** d’utiliser Docker au début : Railway, Render ou Fly peuvent builder ton app **directement** depuis Git sans que tu écrives un `Dockerfile`.

**Kubernetes** (souvent abrégé **K8s**), c’est un système pour gérer **beaucoup** de boîtes (conteneurs) en parallèle : redémarrage auto, plusieurs copies pour la charge, zéro panne… C’est pensé pour des **équipes** et du **trafic important**. Pour **une première mise en ligne** d’un backend comme le tien, c’est **souvent trop** : courbe d’apprentissage forte, coût de temps élevé, complexité inutile tant que tu n’as pas besoin de répliquer l’API sur 10 machines.

**En résumé pour débuter** : PaaS (Railway / Render / Fly) **sans** Docker ni Kubernetes → tu te concentres sur **variables d’env**, **HTTPS**, **base**, **stores**. Docker peut venir **plus tard** si tu standardises le déploiement ; K8s seulement si ton usage le **justifie** vraiment.

**Stack Chrono (rappel)** :

- `chrono_backend` — API Node (Express + Socket.IO).
- `admin_chrono` — Next.js (dashboard).
- `app_chrono` / `driver_chrono` — apps **Expo** (client / livreur).
- **Supabase** — Auth + Postgres (+ souvent hébergé chez Supabase, pas sur ton VPS).

---

## 1. Outils : à quoi ils servent (et suggestion pour débuter)

Tu peux **choisir** selon budget, confort et pays. Ci-dessous : rôle + exemples.

### 1.1 Héberger le backend Node (`chrono_backend`)

| Option | Description | Quand c’est pertinent |
|--------|-------------|------------------------|
| **Railway**, **Render**, **Fly.io** | Tu connectes le repo Git, ils buildent et exposent une URL HTTPS. Variables d’environnement dans leur interface. | **Très bon point de départ** : peu de DevOps, SSL inclus. |
| **DigitalOcean App Platform**, **Heroku** (payant) | Même idée : PaaS. | Alternative si tu préfères ces marques. |
| **VPS** (DigitalOcean Droplet, OVH, Hetzner…) + **nginx** | Tu installes Node toi-même, tu configures le reverse proxy et Let’s Encrypt. | Plus de contrôle, plus de temps et de risques d’erreur au début. |
| **Docker** | Image qui contient ton app + Node ; tu la lances n’importe où (VPS, certains PaaS). | Utile quand tu veux **reproduire** le même environnement partout ; pas obligatoire au jour 1 sur Railway/Render. |
| **Kubernetes** | Orchestre **beaucoup** de conteneurs, haute dispo, auto-scaling. | **Hors scope** pour une première mise en ligne de ce type de projet ; à envisager plus tard si le trafic et l’équipe le justifient. |

**Suggestion** : commence par **Railway** ou **Render** (ou **Fly.io**) pour `chrono_backend` : moins de friction que VPS + Docker pour un premier déploiement.

### 1.2 Base de données et Auth

| Option | Rôle |
|--------|------|
| **Supabase** (déjà dans le projet) | Postgres managé, Auth, parfois stockage. Tu crées un projet **prod** séparé du dev si possible. |
| **Backups / PITR** | Dans le dashboard Supabase : activer sauvegardes (et point-in-time recovery si offert sur ton plan). |

**Suggestion** : une instance Supabase **dédiée production** (pas la même que les tests destructifs).

### 1.3 Admin web (`admin_chrono`)

| Option | Description |
|--------|-------------|
| **Vercel**, **Netlify**, **Cloudflare Pages** | Build Next.js depuis Git, HTTPS, domaine custom. |
| **Même PaaS que le backend** | Possible si tu buildes Next en mode standalone ou via un monorepo ; un peu plus technique. |

**Suggestion** : **Vercel** pour `admin_chrono` est très courant et simple pour Next.js.

### 1.4 Apps mobiles (Expo)

| Outil | Rôle |
|-------|------|
| **EAS (Expo Application Services)** | `eas build` pour générer les fichiers **.ipa** (iOS) et **.aab** / **.apk** (Android) ; **EAS Submit** pour envoyer aux stores. |
| **App Store Connect** | Compte développeur Apple (~99 €/an), fiche app, review. |
| **Google Play Console** | Compte développeur (frais unique modique), fiche app, review. |

**Suggestion** : suis la doc officielle Expo « EAS Build » et « Submit » ; fixe les **variables d’env de prod** dans `eas.json` / secrets EAS pour l’URL API.

### 1.5 DNS, HTTPS, protection frontale

| Outil | Rôle |
|-------|------|
| **Cloudflare** (gratuit possible) | DNS, proxy, SSL, parfois WAF léger. Utile si ton domaine pointe vers plusieurs services. |
| **Let’s Encrypt** | Certificats TLS gratuits (souvent gérés par l’hébergeur ou nginx). |

### 1.6 Erreurs et logs

| Outil | Rôle |
|-------|------|
| **Sentry** | Crashs et erreurs côté **mobile** et **serveur**. |
| **Logs du PaaS** | Souvent suffisant au début (Railway/Render affichent stdout). |

### 1.7 CI (optionnel mais utile)

| Outil | Rôle |
|-------|------|
| **GitHub Actions** | Déjà présent dans le repo (`.github/workflows/ci.yml`) pour tester le backend ; tu peux étendre plus tard (build EAS en CI). |
| **Bitrise**, **Codemagic** | Alternatives pour CI mobile si un jour tu automatises les builds hors EAS en local. |

### 1.8 Autres outils souvent cités (au cas où tu élargis)

| Besoin | Exemples | Note pour Chrono |
|--------|----------|-------------------|
| Postgres autre que Supabase | **Neon**, **RDS**, Postgres managé | Possible si tu quittes Supabase ; aujourd’hui le projet est calé **Supabase**. |
| Paiements internationaux | **Stripe**, **PayPal** | Utiles si tu ajoutes des cartes ; **Orange Money / Wave** restent ton contexte local. |
| Logs centralisés (quand tu scales) | **Datadog**, **Axiom**, **Papertrail**, **Logflare** | Optionnel au début ; les logs du PaaS suffisent souvent. |
| Secrets d’entreprise | **AWS Secrets Manager**, **GCP Secret Manager**, **Vault** | Pour grosses équipes ; en solo, les **variables d’environnement** du PaaS suffisent. |
| Uptime | **UptimeRobot**, **Better Stack**, ping sur `GET /health` | Éviter les services **fermés** ou non maintenus ; vérifier avant de s’inscrire. |

---

## 2. Phase AVANT la production (préparation)

Objectif : quand tu appuies sur « déployer » ou « build store », tu n’as plus à improviser les secrets ni la base.

### 2.0 Git et organisation (optionnel mais propre)

- **Repo propre** : pas de secrets dans l’historique ; `.env` ignorés (déjà dans `.gitignore`).
- **Branche `release` ou `production`** : certains équipes figent ce qui part en prod sur une branche dédiée ; d’autres taguent `main`. Choisis une **règle d’équipe** et tiens-la.
- **Migrations versionnées** : les fichiers SQL du repo **sont** ta source de vérité ; ne modifie jamais une migration **déjà appliquée** en prod sans savoir ce que tu fais (préfère une **nouvelle** migration).
- **Tags git** (`v1.0.0`, etc.) : utiles pour savoir **quel code** correspond à **quel build** store ; à aligner avec les versions affichées dans App Store Connect / Play Console.

### 2.1 Secrets et Git

**À faire**

1. Générer un **`JWT_SECRET`** long et aléatoire (≥ 32 caractères), **unique** par environnement (dev ≠ prod).
   - Exemple : `openssl rand -base64 48` (terminal macOS/Linux).
2. **Ne jamais** committer les fichiers `.env` avec de vraies valeurs. Le dépôt utilise `.gitignore` pour `.env` et `.env.local` ; vérifie qu’aucun secret n’a été poussé par erreur dans l’historique récent. Si oui : **rotation** des clés concernées.
3. **`SUPABASE_SERVICE_ROLE_KEY`** : uniquement sur le **serveur backend** (variables d’environnement de Railway/Render/VPS). **Jamais** dans `EXPO_PUBLIC_*` : cette clé contourne la RLS, elle serait visible dans l’app compilée.

**Référence** : `chrono_backend/.env.example` et `chrono_backend/src/config/envCheck.ts` (ce qui est **bloquant** en prod : notamment `JWT_SECRET`, `ALLOWED_ORIGINS`).

### 2.2 Réseau (CORS + HTTPS) — à préparer sur le papier

**À décider avant le premier déploiement backend en `NODE_ENV=production`**

1. **`ALLOWED_ORIGINS`** : liste séparée par des virgules des **origines** autorisées à appeler l’API depuis un navigateur (admin Next.js).
   - Exemple : `https://admin.tondomaine.com` (pas `*` en prod).
   - Les apps mobiles ne passent pas par CORS de la même façon que le navigateur, mais l’**admin** oui.
2. **HTTPS** : l’URL publique du backend doit être en `https://`. Les PaaS le font souvent automatiquement.
3. **`FORCE_HTTPS` / `PROXY_ENABLED`** : si ton hébergeur est **derrière un reverse proxy** (cas fréquent), `PROXY_ENABLED=true` aide Express à comprendre le schéma réel (`X-Forwarded-Proto`). Aligner avec la doc de ton hébergeur et les avertissements de `envCheck.ts`.

### 2.3 Base de données (migrations + RLS)

**À faire**

1. **Migrations** : appliquer sur la base **production** les scripts du repo dans un ordre cohérent (`chrono_backend/migrations/`, fichiers `supabase/`, migrations admin si besoin). Ne pas mélanger dev et prod.
2. **RLS** : relire `supabase/RLS_POLICIES.sql` et toute politique liée aux tables métier. **Tester** avec un compte **client** et un compte **livreur** : aucun ne doit lire les données privées de l’autre.
3. **Backups** : dans Supabase (ou hébergeur Postgres), activer les **sauvegardes automatiques** et le **PITR** si disponible sur ton plan.

### 2.4 Paiements (préparation)

1. Lister les moyens réellement activés (Orange Money, Wave, espèces, différé, etc.).
2. Prévoir des **tests à petits montants** en conditions proches de la prod (comptes sandbox si le fournisseur les fournit).
3. Si **webhooks** : URL **HTTPS** publique, secret partagé, logique **idempotente** (traiter deux fois le même événement ne doit pas créditer deux fois).

### 2.5 Stores et légal (préparation contenu)

1. Rédiger ou faire rédiger **CGU** et **politique de confidentialité** ; les héberger sur une URL stable (`https://tondomaine.com/legal/...` ou page Notion publique en dernier recours).
2. Prévoir de remplacer dans le code les `Alert` « Lien à configurer » dans `app_chrono` et `driver_chrono` `(auth)/index.tsx` par `Linking.openURL('https://...')`.
3. Aligner le texte avec `app_chrono/app/profile/privacy.tsx` (une seule vérité, pas deux politiques contradictoires).
4. Noter pour les questionnaires App Store / Play : **localisation** (dont arrière-plan si utilisé), **Mapbox** (clé publique seulement côté app), mentions données personnelles.

### 2.6 Observabilité (préparation)

1. Créer un compte **Sentry**, un projet par plateforme ou un seul projet avec tags.
2. Prévoir où coller le DSN côté Expo (`EXPO_PUBLIC_SENTRY_DSN` ou `app.config` → `extra`).
3. Backend : vérifier si `chrono_backend` initialise Sentry au démarrage (dépendance `@sentry/node` dans `package.json`) ; sinon c’est une amélioration post-MVP — au minimum les logs du PaaS.
4. Healthcheck : le backend expose déjà **`GET /health`** (et variantes sous `/health` — voir `chrono_backend/src/routes/healthRoutes.ts`). Tu pourras l’utiliser si un load balancer ou un uptime monitor le demande.

### 2.7 Auth (revue code — avant go-live)

1. Passer en revue les routes **admin**, **commandes**, **sockets** : middleware JWT, `verifyAdminSupabase`, usage de la clé service uniquement côté serveur.
2. S’assurer qu’aucune route sensible n’est exposée sans garde par erreur.

### 2.8 Tests manuels (checklist avant « jour J »)

- **Client** : inscription → commande → paiement → suivi.
- **Livreur** : en ligne → offre → acceptation → navigation → statuts jusqu’à la fin.
- **Admin** : login → commandes / livreurs.
- **Annulation / litige** : au moins un scénario.
- **Sockets** : couper le réseau ~10 s, rétablir : reconnexion correcte ?

---

## 3. Phase PENDANT la production (premier déploiement et publication)

Objectif : services en ligne, apps buildées avec les **bonnes URLs**, soumission stores.

### 3.1 Ordre suggéré des opérations

1. **Supabase prod** : projet créé, migrations appliquées, RLS vérifiée, backups activés.
2. **Backend** : déployer `chrono_backend` sur le PaaS choisi ; renseigner **toutes** les variables d’environnement (copie depuis `.env.example` adaptée). Vérifier `GET https://ton-api/health`.
3. **Admin** : déployer `admin_chrono` sur Vercel (ou équivalent) ; variable `NEXT_PUBLIC_...` pointant vers l’API si besoin.
4. **DNS** : faire pointer `api.tondomaine.com`, `admin.tondomaine.com` vers les bonnes cibles (CNAME fournis par Vercel / Railway / Cloudflare).
5. **Mettre à jour `ALLOWED_ORIGINS`** avec l’URL **réelle** de l’admin (redéployer le backend si nécessaire).
6. **Expo / EAS** : configurer les **secrets** ou `extra` pour l’URL API **production** ; définir un **profil** `production` dans `eas.json` si besoin ; utiliser un **release channel** (ou la stratégie EAS moderne équivalente) pour séparer **preview** et **prod**.
7. **Tests avant review store** : **TestFlight** (iOS) et **piste de test interne / fermée** sur Google Play pour valider le binaire **réel** avec l’API prod, avant d’ouvrir au public.
8. **Soumission** : App Store Connect + Play Console (captures, textes, confidentialité, âge, etc.).

### 3.2 Docker et Kubernetes à cette phase

- **Docker** : seulement si ton hébergeur ou **toi** choisissez cette méthode (image Node + `npm run build` + `node dist/...`). Les PaaS peuvent build depuis le `package.json` sans Dockerfile.
- **Kubernetes** : **inutile** pour cette étape dans la grande majorité des cas.

### 3.3 Ce que tu dois voir quand c’est bon

- L’admin charge sans erreur CORS (sinon corriger `ALLOWED_ORIGINS`).
- Les apps installées depuis un build **production** créent des commandes et reçoivent des événements temps réel (sockets).
- Sentry reçoit une erreur de test si tu en déclenches une (optionnel mais rassurant).

---

## 4. Phase APRÈS la production (exploitation continue)

Ce ne sont pas des « comportements vagues » : ce sont des **habitudes** et des **contrôles** ponctuels.

### 4.1 Habitudes de sécurité

- Ne pas committer de secrets ; faire tourner les clés si fuite suspectée.
- Ne pas exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
- Après chaque **grosse feature** touchant la base ou l’API : revue rapide RLS + routes protégées.

### 4.2 Monitoring

- Consulter **Sentry** (pics d’erreurs après une release).
- Lire les **logs** du PaaS en cas de incident.
- Optionnel : **uptime** (UptimeRobot, Better Stack, etc.) sur `https://ton-api/health` — ne pas s’appuyer sur des services d’uptime **discontinués** ; vérifier qu’ils sont encore actifs.

### 4.3 Données

- Vérifier périodiquement que les **backups** Supabase sont actifs (notification email du fournisseur).
- Avant migrations destructives en prod : **export** ou snapshot si possible.

### 4.4 Stores

- Mettre à jour les **textes légaux** et les URLs si la politique change.
- Incrémenter les **versions** build (Expo / native) pour chaque soumission.

### 4.5 Retours utilisateurs et cycles de release

- **Feedback** : formulaire, email support, ou intégration plus tard (Sentry + commentaires store).
- **Bugs critiques** : corriger, rebuild EAS, resoumettre ; documenter ce qui était cassé.
- **Cohérence version** : garder une correspondance claire entre **tag git** / branche release et **build number** store pour pouvoir déboguer (« quelle version chez l’utilisateur ? »).

### 4.6 Évolution technique (quand tu grandis)

- **Rate limiting** sur l’API si exposition publique forte.
- **Plusieurs instances** du backend : alors Socket.IO peut exiger **sticky sessions** ou **Redis adapter** — sujet avancé, pas nécessaire au premier utilisateur.
- **CI** : faire échouer le build sur vulnérabilités critiques (`npm audit`) si tu veux durcir.

---

## 5. Roadmap produit (optionnel, souvent en dernier)

Ces sujets **n’empêchent pas** une première mise en ligne si le produit actuel te suffit :

- Navigation livreur « niveau Uber » : `driver_chrono/docs/navigation-suivi-livreur.md`.
- Tarification dynamique météo / trafic : `app_chrono/docs/tarification-dynamique-meteo-trafic.md`.

---

## 6. Synthèse « minimum vital » vs « sérieux »

| Niveau | Inclut |
|--------|--------|
| **Beta / pilote restreint** | Backend + Supabase stables, HTTPS, secrets OK, migrations + RLS de base testées, un parcours paiement réel testé, builds Expo pointant sur la bonne API ; idéalement **TestFlight** + **Play test interne** avant le grand public. |
| **Stores + utilisateurs payants** | Tout ce qui précède + **CGU / confidentialité réelles**, **Sentry** configuré (mobile au minimum ; backend si initialisé), **backups** activés, parcours E2E documentés, pas de placeholder légal dans l’auth. |

---

## 7. Rappel des variables critiques (backend)

À recopier depuis `chrono_backend/.env.example` vers l’interface de ton hébergeur, en adaptant :

- `NODE_ENV=production`
- `JWT_SECRET` (≥ 32 caractères, aléatoire)
- `ALLOWED_ORIGINS` (origines exactes HTTPS)
- `DATABASE_URL` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (prod)
- `FORCE_HTTPS` / `PROXY_ENABLED` selon ton hébergeur
- SMS (Twilio ou Vonage) si tu utilises l’OTP par SMS
- `SENTRY_DSN` si tu actives Sentry côté serveur
- URL Redis si tu l’utilises en prod

Les apps Expo : uniquement des clés **publiques** et l’URL de l’API en `EXPO_PUBLIC_*` où c’est prévu dans ton projet.

---

*Document rédigé pour PROJET_CHRONO — à ajuster avec tes domaines, hébergeurs et juridiction réels. Pour un audit légal ou de sécurité formel, faire appel à un professionnel.*
