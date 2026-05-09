# Checklist qualité — viser 8,5 / 10 → 9 / 10

Ce document prolonge l’analyse globale du monorepo : actions concrètes pour renforcer **tests**, **CI**, **reproductibilité**, **sécurité / prod** et **cohérence documentaire**.

Utiliser les cases `- [ ]` comme suivi (cocher dans l’éditeur ou via PR).

---

## 1. Documentation alignée avec le code

- [ ] Mettre à jour le `README.md` racine : retirer ou préciser « tests automatisés à venir » — indiquer que **`chrono_backend`** a déjà une suite Jest (unit + intégration) et où elle vit (`chrono_backend/tests/`).
- [ ] Ajouter une section courte « État des tests » par paquet : `chrono_backend` / `admin_chrono` / `app_chrono` / `driver_chrono` (commandes `npm test`, pré-requis éventuels).
- [ ] Vérifier que les chemins et noms (`PROJET_CHRONO` vs dossier réel) sont cohérents dans tout le README.
- [ ] Compléter **Licence** et **Auteurs / remerciements** dans le README (ou fichier `LICENSE` dédié).

---

## 2. Tests — backend (consolider le niveau déjà bon)

- [ ] Mesurer la couverture : `npm run test:coverage` dans `chrono_backend/` ; fixer un **seuil minimal** (ex. branches/lines) dans Jest ou CI et documenter le choix.
- [ ] Réduire le mélange **`.js` / `.ts`** dans les tests : migrer progressivement `*.test.js` vers TypeScript pour typage et cohérence avec `tsc`.
- [ ] S’assurer que les tests d’intégration CI reflètent les migrations nécessaires (schéma minimal ou script `migrate` avant tests si pertinent).
- [ ] Ajouter au moins un test de « smoke » sur une route critique non encore couverte (auth refresh, paiement mock, etc.) si des trous apparaissent dans la couverture.

---

## 3. Tests — admin (`admin_chrono`)

- [ ] Choisir l’outil : **Vitest** ou **Jest** + **React Testing Library** pour composants et hooks isolés.
- [ ] Ajouter `npm test` (et éventuellement `npm run test:ci`) dans `admin_chrono/package.json`.
- [ ] Écrire **5–10 tests** à forte valeur : hook/API client (mock fetch), composant tableau ou carte avec données fictives, garde d’auth basique.
- [ ] Mock stable pour `NEXT_PUBLIC_*` dans les tests (pas de vraies URLs sensibles).

---

## 4. Tests — apps Expo (`app_chrono`, `driver_chrono`)

- [ ] Créer au minimum des dossiers `__tests__/` avec :
  - tests ** purs utilitaires** (`utils/`, format téléphone, validation) ;
  - **un** test par app sur un hook ou service critique (ex. refresh token, parsing réponse API) avec mocks.
- [ ] Documenter dans chaque README local : `npm test` et limitations (pas de E2E obligatoire au début).
- [ ] (Optionnel plus tard) **Maestro** ou **Detox** pour un flux smoke E2E sur build dev — à traiter après les tests unitaires utilitaires.

---

## 5. CI/CD — durcir sans casser les flux Expo

- [ ] **Backend** : faire échouer la CI si `npm test` ou `tsc --noEmit` échoue (déjà le cas ; vérifier qu’aucune étape critique n’a `continue-on-error: true` sans raison).
- [ ] **admin_chrono** : retirer `continue-on-error` sur **lint**, **tsc** et **build** une fois les erreurs corrigées ; garder le build obligatoire sur PR.
- [ ] **app_chrono / driver_chrono** :  
  - [ ] Activer **lint obligatoire** (`npm run lint`) quand le projet est clean.  
  - [ ] Activer **`tsc --noEmit`** obligatoire si `tsconfig` est strict et sans erreurs.  
  - [ ] Pour le **build natif EAS**, rester hors CI PR si trop long ; éventuellement workflow dédié sur `main` ou tags.
- [ ] Publier l’artefact **coverage** backend (déjà uploadé) et ajouter un badge ou lien dans le README (optionnel).

---

## 6. Base de données et reproductibilité

- [ ] Inventorier toutes les migrations : celles dans `chrono_backend/migrations/` **et** celles appliquées uniquement dans Supabase ; décider d’une **source de vérité**.
- [ ] Si tout doit vivre dans le repo : exporter ou recréer les migrations manquantes pour que **`DATABASE_URL` vide + scripts** reproduisent un schéma minimal de test.
- [ ] Mettre à jour `chrono_backend/migrations/README.md` avec l’**ordre d’exécution** exact et les dépendances (extensions Postgres, RLS, etc.).
- [ ] Documenter une procédure « nouveau dev » : clone → `.env` → migrations → seed minimal (même fictif) → backend démarre.

---

## 7. Sécurité et secrets

- [ ] Vérifier que **TruffleHog** en CI signale bien les faux positifs documentés et qu’aucune clé réelle n’est dans l’historique Git (rotation si doute).
- [ ] Confirmer que les fichiers `*firebase-adminsdk*.json` et `google-services.json` ne sont **jamais** commités ; ajouter une note dans le README sur leur placement local uniquement.
- [ ] Passer en revue **CORS**, **rate limiting** et routes admin : auth systématique + tests négatifs (401/403).
- [ ] `npm audit` : traiter les vulnérabilités **high/critical** sur les dépendances directes ; documenter les exceptions temporaires.

---

## 8. Observabilité et exploitation (prod)

- [ ] Checklist déploiement : variables d’environnement par environnement (staging / prod), **Sentry** DSN, niveaux de logs.
- [ ] Alertes minimales (erreurs 5xx, latence API, déconnexions Socket.IO anormales) — même simples au début.
- [ ] Document runbook : backup (`backup:*`), restore (`recovery:*`), qui appeler, où sont les logs.
- [ ] Redis en prod : documenter la bascule adapter Socket.IO et les tests de charge légers (optionnel).

---

## 9. Qualité monorepo (optionnel mais utile)

- [ ] Introduire **npm workspaces** ou **pnpm workspaces** à la racine pour une commande du type `npm run test --workspaces` (sans tout casser des scripts existants).
- [ ] Harmoniser **versions Node** entre README (≥18), CI (18) et `engines` des `package.json` (ex. app en 20.x) — choisir une version **unique documentée**.
- [ ] Ajouter un script racine `npm run lint:all` / `npm run test:backend` pour les contributeurs.

---

## Critères de « terminé » pour viser 8,5–9

- [ ] README reflète fidèlement **tests + CI** par paquet.
- [ ] CI **verte** sur PR : backend test + build admin sans `continue-on-error` sur les étapes clés ; mobile au minimum **lint** (+ **tsc** si applicable).
- [ ] Schéma DB **reproductible** ou procédure documentée sans ambiguïté.
- [ ] Couverture backend mesurée avec seuil ou rapport lisible ; front avec une **base** de tests non nulle.
- [ ] Pas de secrets dans Git ; vulnérabilités critiques traitées ou suivies avec justification.

Une fois la majorité des cases cochées, une nouvelle revue globale peut recaler la note ; l’objectif **9** suppose surtout **homogénéité** (front + CI + DB) en plus du bon niveau backend déjà présent.
