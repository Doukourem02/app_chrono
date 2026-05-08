# Plan — Tournées B2B groupées

> Chaque tournée = une seule offre, une seule acceptation, N livraisons indépendantes.
> Chaque arrêt a son propre destinataire, son propre statut, sa propre preuve.
> Le livreur choisit son ordre — l'ordre affiché est conseillé, jamais imposé.

---

## Ce qui est déjà fait

- [x] `POST /api/batches` crée la tournée et toutes les livraisons enfants en un seul appel
- [x] L'app business ne crée plus une commande séparée par arrêt avant de créer le batch
- [x] L'ordre optimisé est affiché comme `Ordre conseillé`, pas comme contrainte
- [x] L'écran livreur charge les consignes de chaque arrêt depuis les détails de livraison
- [x] Chaque arrêt affiche un statut visible : `À faire`, `Livré`, `Annulé`
- [x] Le compteur de tournée avance avec les arrêts `completed` et `cancelled`
- [x] Un arrêt sans GPS affiche `GPS absent` et ouvre une navigation externe par adresse
- [x] La popup livreur annonce une seule offre : `Nouvelle tournée B2B - N livraisons`
- [x] La navigation Mapbox est mono-destination et revient à la liste après validation

---

## 🔴 Bugs bloquants

### 1. Navigation qui se ferme immédiatement — loop "conduisez vers le nord"
**Fichiers :** `driver_chrono/components/MapboxNavigationScreen.tsx` + `driver_chrono/app/batch/[batchId].tsx`

**Cause :** `onCancelNavigation` du SDK Mapbox est câblé directement sur `stopNavigation()`. Le SDK fire cet événement pour des raisons internes (recalcul de route, état natif parasite) — pas uniquement quand le livreur appuie sur Retour. Résultat : la navigation se ferme seule, le livreur revient sur la liste, recommence, et le cycle se répète.

- [x] Ajouter un `cancelledByUserRef` dans BatchScreen — seul le bouton Retour le passe à `true`
- [x] Dans `onCancelNavigation`, ne fermer la nav que si `cancelledByUserRef.current === true`, sinon logger et ignorer
- [ ] Tester : lancer la navigation, ne pas toucher Retour → la nav doit rester ouverte

---

### 2. Race condition `mute` — Mapbox parle avant d'être muté, puis se réinitialise
**Fichier :** `driver_chrono/app/batch/[batchId].tsx` — `startNavigationToStop` + `speakWithMapboxMuted`

**Cause :** `startNavigationToStop` appelle `speakWithMapboxMuted(...)` qui set `mapboxVoiceMuted = true` via `setState`. Mais le composant Mapbox monte d'abord avec `mute=false` (état initial), parle ("conduisez vers le nord"), puis reçoit `mute=true` au re-render suivant. Ce changement de prop sur un composant natif peut le réinitialiser et déclencher `onCancelNavigation`.

- [x] Set `mapboxVoiceMuted = true` AVANT `setNavigationStop` — Mapbox doit monter déjà muté
- [x] Remettre `mute=false` uniquement dans le callback `onDone` du speech
- [ ] Tester : lancer la navigation → on entend uniquement la voix custom, pas Mapbox au démarrage

---

### 3. `navigationOrigin` figée — GPS imprécis au démarrage
**Fichier :** `driver_chrono/app/batch/[batchId].tsx` — `startNavigationToStop` ligne 121

`navigationOrigin` est calculée une seule fois avec `accuracy: Balanced`. Si le GPS était froid ou imprécis, la route part d'un point incorrect.

- [x] Passer `accuracy: High` dans `getCurrentPositionAsync` pour l'origine de navigation
- [x] Ou : ne passer que la destination à Mapbox et laisser le SDK utiliser le GPS temps réel

---

### 4. Numéro d'arrêt incohérent — badge vs voix vs bannière
**Fichier :** `driver_chrono/app/batch/[batchId].tsx` ligne 464

- Badge sur la carte stop : `idx + 1` (index du tableau JavaScript)
- Voix et bannière navigation : `stop.position` (ordre optimisé du backend)
- Ces deux valeurs divergent si les stops sont triés autrement dans l'UI

- [x] Remplacer `{idx + 1}` par `{stop.position}` dans le badge de chaque carte stop

---

## 🟡 Flux à corriger

### 5. Pas de suggestion vers le prochain arrêt après validation
**Fichier :** `driver_chrono/app/batch/[batchId].tsx` — `finalizeProofDelivery`

Après validation d'un arrêt, le livreur revient sur la liste sans prompt. Il doit identifier et appuyer manuellement sur le prochain.

- [x] Après `updateStop(..., 'completed')`, trouver le prochain stop `pending` par `position` croissante
- [x] Afficher un bouton ou une alerte : `Naviguer vers l'arrêt suivant ?` (sans forcer)

---

### 6. Pas de statut `partial` sur le batch
**Fichiers :** `driver_chrono/app/batch/[batchId].tsx` + `chrono_backend/src/controllers/batchController.ts` — `validateBatchOrder`

Si certains arrêts sont annulés et d'autres livrés, la tournée clôture sans distinction.

- [x] Backend : passer le batch en `partial` quand ≥ 1 `cancelled` et ≥ 1 `completed` au moment de la clôture
- [x] Frontend : afficher `Tournée partiellement terminée — X livrées, Y annulées` dans l'écran de fin

---

### 7. État de navigation perdu si l'app passe en arrière-plan
**Fichier :** `driver_chrono/app/batch/[batchId].tsx`

`navigationStop` et `navigationOrigin` sont du state React local. Si l'app est mise en background et que le composant se démonte, la navigation active est perdue.

- [x] Persister `navigationStop` dans `useBatchStore` (Zustand)
- [x] À la remontée du composant, restaurer `navigationStop` depuis le store et relancer la nav

---

### 8. `loadBatch` peut boucler — dépendance instable
**Fichier :** `driver_chrono/app/batch/[batchId].tsx` lignes 195–200

```tsx
useEffect(() => {
  if (!batch || batch.stops.length === 0) void loadBatch();
}, [batch, loadBatch]); // loadBatch dépend de setActiveBatch
```

Si Zustand retourne une nouvelle référence de `setActiveBatch` entre renders, `loadBatch` change de référence → l'effet se relance inutilement.

- [x] Extraire `setActiveBatch` du store en dehors du `useCallback` ou stabiliser via `useRef`

---

## 🟢 UX livreur

### 9. Carte stop active non surlignée pendant la navigation
Quand la navigation est active sur un arrêt, seul le bouton affiche `En navigation`. La carte est visuellement identique aux autres.

- [x] Appliquer un style distinct (bordure colorée, fond différent) sur la carte de l'arrêt en cours de navigation

### 10. Chevauchement voix : speech custom + Mapbox en même temps
Lié au bug #2 — fix déjà décrit. Vérifier en plus que le prop `mute` silence bien les instructions turn-by-turn, pas uniquement le recalcul.

- [ ] Voir fix #2
- [ ] Valider que `mute=true` silence toutes les instructions Mapbox (pas juste le recalcul de route)

### 11. Annulation par appui long non découvrable
`onLongPress` sur le bouton `Preuve alternative` annule la livraison, mais rien dans l'UI ne l'indique.

- [x] Ajouter un label discret sous le bouton : `Appui long pour annuler`
- [x] Ou déplacer l'annulation dans un menu séparé accessible depuis la carte stop

### 12. Compteur de stops restants absent pendant la navigation plein écran
La bannière nav affiche `Arrêt X/Y` et l'adresse mais pas combien de stops sont encore `pending`.

- [x] Ajouter dans la bannière : `X restants` en plus du numéro d'arrêt

---

## 🔵 Backend

### 13. Commission non stockée à la création de la commande
**Fichier :** `chrono_backend/src/services/b2bCommissionService.ts` + `chrono_backend/src/controllers/batchController.ts`

`computeB2BCommission` existe mais n'est pas appelé à la création. Le taux n'est pas stocké sur la commande. Si le quota change entre création et facturation, le taux calculé sera faux.

- [x] Appeler `computeB2BCommission(partnerId)` dans `createBatchChildOrder`
- [x] Stocker `commission_rate` + `commission_type` (`in_quota` / `excess`) sur la commande au moment de la création

### 14. Grille de commission à confirmer
**Fichier :** `chrono_backend/src/services/b2bCommissionService.ts` lignes 6–10

| | Code actuel (2026-05-04) | Décision validée (2026-05-02) |
|---|---|---|
| starter | 5% | 3% |
| pro | 3% | 3% |
| business | 2% | 0% |

- [x] Confirmer quelle grille est active et corriger le code ou la mémoire projet

### 15. Création batch non atomique — rollback manuel fragile
**Fichier :** `chrono_backend/src/controllers/batchController.ts` lignes 370–462

Commandes enfants créées une par une → `delivery_batch` → `batch_orders`, trois étapes séparées sans transaction DB. Un crash entre deux étapes laisse des commandes orphelines.

- [x] Envelopper toute la création dans une transaction PostgreSQL via `pool.query('BEGIN')` / `COMMIT` / `ROLLBACK`

---

## Tests manuels obligatoires

- [ ] Créer une tournée avec 2 arrêts — accepter côté livreur
- [ ] Lancer la navigation vers l'arrêt 2 avant l'arrêt 1 — vérifier que ça fonctionne
- [ ] Revenir à la liste sans valider — vérifier que l'arrêt reste `À faire`
- [ ] Lancer la navigation vers l'arrêt 1 — **vérifier que la nav ne se ferme pas seule**
- [ ] Valider l'arrêt 1 par QR — vérifier que l'arrêt 2 reste `À faire`
- [ ] Valider l'arrêt 2 par code manuel — vérifier que la tournée passe terminée
- [ ] Mettre l'app en arrière-plan pendant la navigation — revenir — vérifier que la nav reprend
- [ ] Refaire le test avec un arrêt sans GPS
- [ ] Refaire le test avec 5 arrêts en ordre différent de l'ordre affiché
- [ ] Annuler 1 arrêt sur 3 — vérifier que la tournée passe en `partial`
