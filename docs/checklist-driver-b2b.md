# Checklist — Adaptation Driver Chrono au B2B

Créée le 2026-05-03. À compléter avant le lancement Phase 1.

---

## Contexte

L'app livreur reconnaît déjà le flag `isB2BOrder` et possède un écran tournée (`/batch/[batchId]`).
Mais elle est aveugle au partenaire, à la position dans la tournée, et aux livreurs attitrés.
Ce fichier liste tout ce qu'il faut corriger.

---

## A. Types TypeScript

**Fichier : `store/useOrderStore.ts`**

Ajouter dans l'interface `OrderRequest` :

```typescript
partner_id?: string;
partner_name?: string;
batch_id?: string;
batch_position?: number;
batch_total?: number;
```

---

## B. Mapping des données reçues

**Fichier : `utils/mapAdminOrderFlags.ts`**

La fonction ne retourne que `isB2BOrder`. Ajouter l'extraction de :

```typescript
partner_id   // depuis order.partner_id ou order.chrono_admin?.partner_id
batch_id     // depuis order.batch_id
batch_position // depuis order.batch_position
batch_total  // depuis order.batch_total
```

Renommer ou étendre la fonction en `mapB2BOrderContext()` ou ajouter un second retour.

---

## C. Store des tournées

**Fichier : `store/useBatchStore.ts`**

Ajouter dans l'interface `ActiveBatch` :

```typescript
partner_id?: string;
partner_name?: string;
status?: 'pending' | 'in_progress' | 'completed';
created_at?: string;
```

---

## D. Socket — payload `batch-assigned`

**Fichier : `services/orderSocketService.ts`**

Changer le type du payload reçu :

```typescript
// Avant
{ batchId: string; ordersCount: number }

// Après
{ batchId: string; ordersCount: number; partner_id?: string; partner_name?: string; status?: string }
```

Et passer `partner_id`, `partner_name` dans `setActiveBatch()`.

---

## E. Socket — payload `new-order-request`

**Fichier : `services/orderSocketService.ts`**

Vérifier que quand une commande B2B individuelle arrive, les champs suivants sont bien passés dans `addPendingOrder()` :
- `partner_id`
- `partner_name`
- `batch_id` (si elle fait partie d'une tournée)
- `batch_position`
- `batch_total`

---

## F. Composants UI

### F1. `components/AdminOrderInfo.tsx`

- [ ] Afficher le nom du partenaire si `partner_name` présent :
  ```
  Partenaire : Resto Chez Maman
  ```
- [ ] Afficher la position si `batch_id` présent :
  ```
  Livraison 2/5 de la tournée
  ```

### F2. `components/DriverOrderBottomSheet.tsx`

- [ ] Ajouter une section "Contexte B2B" visible quand `isB2BOrder = true` :
  - Nom du partenaire
  - Position dans la tournée (si `batch_id`)
  - Bouton "Voir la tournée" → `/batch/[batch_id]`

### F3. `components/OrderRequestPopup.tsx`

- [ ] Afficher dans la popup d'acceptation :
  - Partenaire (si `partner_name`)
  - "Tournée X/Y" (si `batch_position` + `batch_total`)

### F4. `app/batch/[batchId].tsx`

- [ ] Afficher `partner_name` dans le header à la place de "Tournée B2B"
- [ ] Afficher les notes du partenaire si présentes

---

## G. API Backend à vérifier

Avant d'implémenter le frontend, confirmer que ces endpoints retournent bien les champs :

- [ ] `GET /api/batches/:batchId` → inclut `partner_id`, `partner_name`
- [ ] `GET /api/orders/:orderId` (resync) → inclut `partner_id`, `batch_id`, `batch_position`
- [ ] Socket `new-order-request` → payload inclut `partner_id`, `batch_id`, `batch_position`, `batch_total`
- [ ] Socket `batch-assigned` → payload inclut `partner_id`, `partner_name`

---

## Ordre de priorité recommandé

1. **G — Vérifier le backend d'abord** (inutile de mapper des champs que le backend n'envoie pas)
2. **A — Types** (base de tout)
3. **B — Mapping** (extraction des données)
4. **C + D — Stores + Socket** (données disponibles dans l'app)
5. **F — UI** (affichage final)

---

## Résultat attendu

**Avant :**
```
[Popup] Commande B2B — Jean Dupont — 2500 FCFA
← livreur ne sait pas pour qui
```

**Après :**
```
[Popup] Partenaire : Resto Chez Maman
        Livraison 2/5 de la tournée
        Jean Dupont — 2500 FCFA
```
