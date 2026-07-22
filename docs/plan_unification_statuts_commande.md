# Plan — Unification des statuts de commande (#10 de audit_krono.md)

Statut : **document de planification, rien n'est implémenté**. À valider avant de lancer l'exécution.

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

## 7. Questions ouvertes pour toi

- Confirmer que `on_hold` et `assigned` (admin_chrono) sont bien des reliquats à supprimer et pas une fonctionnalité prévue mais jamais branchée.
- Le statut `draft` et `searching_driver` de l'enum DB : sont-ils réellement utilisés quelque part (créés mais jamais lus par un des fronts) ? Ni `app_chrono` ni `driver_chrono` ni `admin_chrono` ne les mentionnent actuellement.
- Priorité : veut-on traiter ça en une seule passe sur les 4 apps, ou app par app à des moments différents ?
