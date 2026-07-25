# Infrastructure & fiabilité — constats et pistes

Ce fichier documente 3 lacunes de fiabilité identifiées le 2026-07-25 en faisant un état des lieux honnête du projet (pas des technologies manquantes — le choix de ne pas utiliser Docker/Kubernetes/Prisma à ce stade est délibéré et justifié vu l'échelle actuelle). Les deux premiers points ont depuis fait leurs preuves en conditions réelles (voir "Preuve concrète" dans chaque section) ; le troisième reste théorique.

---

## 1. Pas de CD, déploiement 100% manuel

- **Constat** : `.github/workflows/ci.yml` fait tourner build/tests/lint/audit, mais aucun job ne déploie. Le déploiement de `admin_krono` passe entièrement par le dashboard Vercel, à la main.
- **Preuve concrète (2026-07-25)** : une session complète a été perdue à déboguer exactement ce type de problème — mauvais Root Directory Vercel (`admin_chrono` vs `admin_krono`), un "Redeploy" qui a repris un vieux commit au lieu du dernier, puis un rollback manuel antérieur qui bloquait `admin.kro-no-delivery.com` sur une version périmée malgré des builds réussis. Un pipeline de déploiement scripté (ou au moins une checklist automatisée de vérification post-déploiement) aurait évité tout ça.
- **Piste** : soit un vrai step de déploiement dans `ci.yml` (via Vercel CLI/API token), soit a minima un script de vérification post-déploiement (curl sur les routes clés, comparaison du commit déployé vs `HEAD`).

## 2. Aucun test end-to-end, seulement unitaire/intégration

- **Constat** : tous les tests (`krono_backend` : 53 fichiers, `admin_krono` : 5, `app_krono`/`driver_krono` : 1 chacun) sont unitaires ou d'intégration ciblée. Aucun test ne simule le vrai parcours utilisateur de bout en bout à travers plusieurs systèmes.
- **Preuve concrète (2026-07-25)** : le bug du code promo. La logique de validation/application avait été construite sur la route REST (`orderRecordController.ts`), entièrement testée et verte. Mais l'app cliente crée en réalité ses commandes via **REST puis Socket.IO** pour la même commande (`userOrderSocketService.ts`) — le handler Socket.IO (`orderSocket.ts`) ignorait complètement le code promo. Tous les tests unitaires passaient parce que chacun testait sa brique isolément ; aucun ne suivait le vrai enchaînement client → REST → Socket.IO.
- **Piste** : un test d'intégration qui simule le vrai flux client (au moins REST + Socket.IO enchaînés) pour les parcours critiques (création de commande, paiement), pas juste chaque endpoint séparément.

## 3. Aucun garde-fou automatisé sur les migrations

- **Constat** : les migrations sont des fichiers `.sql` numérotés manuellement dans `krono_backend/migrations/`, sans outil dédié (pas de Prisma Migrate/node-pg-migrate).
- **Preuve concrète (2026-07-25)** : un `.gitignore` mal réglé (`*.sql` ignoré en bloc avec des exceptions ajoutées une par une, oubliées à partir d'un certain point) a fait que **29 migrations sur 50 n'étaient jamais suivies par git**, découvert par hasard en travaillant sur autre chose, pas détecté par un contrôle quelconque.
- **Piste** : un check simple en CI — comparer la liste des fichiers `migrations/*.sql` sur disque avec `git ls-files migrations/` et échouer si un fichier manque au suivi git.

---

**Statut** : lacunes documentées, aucune n'est corrigée à ce stade (hors du `.gitignore` migrations, corrigé le 2026-07-25 dans la même session). Décision d'implémentation à prendre par l'utilisateur.
