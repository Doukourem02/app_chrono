# Plan — Unification des statuts de commande (#10 de audit_krono.md)

Statut : **implémenté le 2026-07-22.**

## 0. Ce qui a été fait (résumé)

Investigation approfondie avant modification : le risque initialement identifié (`app_chrono/app/summary.tsx` comparant le statut à des valeurs absentes de l'enum DB) s'est révélé être un **faux problème** — cet écran (`/summary`) et son store associé (`useShipmentStore`) ne sont référencés par aucune navigation dans l'app (`router.push`/`href`), c'est du code mort inatteignable. Le vrai type utilisé en production côté app_chrono (`store/useOrderStore.ts`) avait déjà les bonnes valeurs.

Décision sur les 11 valeurs de l'enum DB : **9 retenues comme canon applicatif** (`pending, accepted, enroute, in_progress, picked_up, delivering, completed, declined, cancelled`). `draft` et `searching_driver` existent dans l'enum Postgres mais aucun code (backend ou front, vérifié par grep) ne les produit ni ne les consomme actuellement — les ajouter partout aurait été de la validation pour un cas qui ne peut pas arriver. Elles restent documentées ici si jamais elles doivent être activées plus tard.

Changements effectués :
- `chrono_backend/src/types/index.ts` : `OrderStatus` étendu de 7 à 9 valeurs (ajout `in_progress`, `delivering`, qui existaient déjà en DB depuis la migration 031 mais manquaient du type TS).
- `admin_chrono/types/index.ts` : `Order.status` corrigé sur les 9 valeurs canoniques (typo `canceled`→`cancelled` corrigée, `assigned`/`delivered`/`on_hold` retirés — aucun n'était utilisé nulle part, ce type n'est importé par aucun fichier).
- `driver_chrono/types/index.ts` (nouveau fichier, point #15) : `OrderStatus`/`OrderRequest` extraits de `store/useOrderStore.ts` vers un dossier `types/` dédié, comme les 3 autres apps. Le store réexporte les deux types pour ne casser aucun des 6 imports existants ailleurs dans l'app.
- `app_chrono` : **aucun changement** — le type réellement utilisé (`store/useOrderStore.ts`) avait déjà les 9 bonnes valeurs. Le vieux type `ShipmentStatus`/`Shipment` dans `types/index.ts` reste en l'état (code mort, voir section 8).

Type-check (`tsc --noEmit`) et suites de tests passés sans régression sur les 3 projets touchés (backend, admin_chrono, driver_chrono).

---

## Contenu original du plan (avant investigation)

## 1. Constat

Chaque app a sa propre définition du statut de commande, et aucune ne correspond exactement à la réalité de la base.

## 2. Vérité terrain (vérifiée en base, projet Supabase `chrono_delivery`)

Requête exécutée : `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'order_status'::regtype ORDER BY enumsortorder;`

L'enum Postgres `order_status` contient **11 valeurs** :
```
draft, pending, searching_driver, accepted, picked_up, enroute,
completed, cancelled, declined, delivering, in_progress
```

Distribution réelle actuelle (`SELECT status, COUNT(*) FROM orders GROUP BY status`) : uniquement `cancelled` (362) et `completed` (307) — logique, ce sont les seuls statuts *terminaux* qui persistent, les statuts transitoires (`pending`, `accepted`, `enroute`...) ne se voient que sur des commandes en cours.

**Aucune des 4 définitions applicatives ne couvre ces 11 valeurs.** Même le type `OrderStatus` du backend (`chrono_backend/src/types/index.ts:40`) est obsolète : il liste 7 valeurs et n'a pas été mis à jour depuis la migration `031_add_delivering_in_progress_statuses.sql` qui a ajouté `delivering` et `in_progress` à l'enum DB.

## 3. État des lieux par app

| App | Fichier | Valeurs déclarées | Usage réel dans la logique |
| --- | --- | --- | --- |
| Backend | `chrono_backend/src/types/index.ts:40` | `pending, accepted, enroute, picked_up, completed, declined, cancelled` (7/11, obsolète) | Type source, mais le vrai contrat est l'enum DB, pas ce type TS |
| admin_chrono | `admin_chrono/types/index.ts:3-4` | `pending, assigned, in_progress, delivered, canceled, on_hold` | **Code mort** — `on_hold` et `assigned` n'apparaissent nulle part ailleurs dans le code (vérifié par grep), le type `Order` ne semble importé nulle part |
| app_chrono | `app_chrono/types/index.ts:15,55,82,84` (`ShipmentStatus`) | `pending, confirmed, in_progress, delivered, cancelled` | **Utilisé en vrai** dans `app_chrono/app/summary.tsx:33-45` (switch sur `confirmed`/`delivered` pour couleur/libellé) — à risque si l'API renvoie les valeurs DB réelles (`accepted`/`completed`), le switch tomberait dans un cas par défaut |
| driver_chrono | `driver_chrono/store/useOrderStore.ts:56` | `pending, accepted, declined, in_progress, enroute, picked_up, delivering, completed, cancelled` (9/11, le plus proche de la vérité DB) | Utilisé, pas de dossier `types/` dédié (point #15) |

## 4. Risque concret identifié

`app_chrono/app/summary.tsx` affiche potentiellement un statut/couleur par défaut incorrect pour les commandes livrées ou confirmées, si le backend renvoie bien les valeurs DB (`completed`, `accepted`) et pas les valeurs locales attendues (`delivered`, `confirmed`). **À vérifier en priorité avant tout renommage** : tracer d'où vient concrètement la valeur `status` reçue par `app_chrono` (réponse API directe vs transformation locale).

## 5. Proposition

1. Adopter l'enum DB (`order_status`, 11 valeurs) comme **unique source de vérité**.
2. Mettre à jour `chrono_backend/src/types/index.ts` pour refléter les 11 valeurs réelles (actuellement 7/11 — dérive silencieuse depuis la migration 031).
3. Dans chaque app front, remplacer le type local par les valeurs DB, avec une table de correspondance affichage (libellé humain par statut), séparée du statut technique — ça évite de mélanger "valeur métier" et "texte à afficher" comme le fait actuellement `app_chrono/types/index.ts` (`confirmed: 'Confirmée'`).
4. Supprimer les valeurs mortes une fois confirmées inutilisées (`on_hold`, `assigned` côté admin_chrono — semble être un ancien brouillon de type jamais branché).
5. Corriger la faute de frappe `canceled` → `cancelled` (admin_chrono) au passage.

## 6. Étapes d'exécution proposées (à valider avant de lancer)

1. **Cartographie complète** : grep exhaustif de chaque valeur de statut (les 11 + les valeurs locales actuelles) dans les 4 projets, pas seulement les déclarations de type — pour trouver tous les endroits qui comparent/affichent un statut.
2. **Vérifier le chemin réel API → app_chrono** pour confirmer ou infirmer le risque du point 4.
3. Mettre à jour le type backend en premier (source de vérité), sans changer de comportement.
4. Mettre à jour chaque app front une par une, avec tests manuels du flux de suivi de commande à chaque étape (statut affiché correctement à chaque transition pending → accepted → enroute/picked_up → delivering → completed, et cancelled/declined).
5. Ajouter un dossier `types/` centralisé dans `driver_chrono` (point #15) à cette occasion.

## 7. Questions ouvertes — tranchées le 2026-07-22

- `on_hold`/`assigned` (admin_chrono) : confirmés reliquats sans usage réel (grep exhaustif, seule occurrence = la déclaration de type elle-même) → retirés.
- `draft`/`searching_driver` (enum DB) : confirmés non produits par le backend actuel (`draft` trouvé une fois dans le code mais sur `invoices.status`, une autre table sans rapport) → exclus du type applicatif, juste documentés ici en section 0.
- Priorité : tout fait en une seule passe (backend + admin_chrono + driver_chrono ; app_chrono n'avait rien à changer).

## 8. Dette technique identifiée mais non traitée (hors périmètre #10)

`app_chrono/types/index.ts` (`ShipmentStatus`, interface `Shipment`) et `app_chrono/store/useShipmentStore.ts` forment un système de statut parallèle à `store/useOrderStore.ts`, utilisé uniquement par l'écran `app/summary.tsx` — lui-même inatteignable (aucune navigation ne pointe dessus). Candidat à suppression complète dans un futur nettoyage de code mort, mais ce n'est pas une correction de sécurité/cohérence : à ne faire que sur demande explicite, car supprimer un écran est une décision produit, pas juste technique.
