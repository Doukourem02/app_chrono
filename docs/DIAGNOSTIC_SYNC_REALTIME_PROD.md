# Diagnostic : Synchronisation Temps Réel — Application Krono

**Date** : 30 avril 2026  
**Severité** : 🔴 CRITIQUE — Affecte UX global + data integrity  
**Scope** : app_chrono, admin_chrono, driver_chrono

**Version** : 2.0 — Production-Ready Architecture

---

## 1. Symptômes observés

### Tracker ID : KRLV-260430-FA73

Quand un livreur accepte une commande :

- ✅ Première image : "Livreur non assigné" (avant acceptation)
- ❌ Deuxième image : Les données du livreur n'apparaissent **PAS automatiquement**
- ⚠️ **Utilisateur doit rafraîchir manuellement** pour voir les mises à jour

**Impact** : Ce problème affecte **TOUTE l'application** (app_chrono, admin_chrono, driver_chrono)

---

## 2. Racine du problème : Pas de source de vérité unique

### Le vrai problème (pas juste technique)

Aujourd'hui tu as :

```text
Socket.IO         →  Source ? Non (peut échouer)
Supabase          →  Source ? Non (peut drop events)
Polling           →  Source ? Non (fallback seulement)
UI Local Cache    →  Source ? NON (cache = jamais source)
```text

**Résultat** : Aucun point unique de vérité → incohérences garanties

### Ce qui se passe réellement

```text
1. Backend assigne livreur → DB updated ✅
2. Backend émet Socket.IO ✅
3. App reçoit Socket → applique sans vérifier ❌
4. BUT : Si 4G latent ou socket perte
   → App affiche data stale
   → User voit "Recherche livreur" même si assigné
5. User F5 → refetch force → voir la vérité
```

---

## 3. Architecture solution : Single Source of Truth + Sync Engine

### 3.1 Principes production-ready

#### Règle 1 : Une seule source de vérité

```text
┌────────────────────────────┐
│  PostgreSQL (DB)           │
│  ← Seule vérité canonique  │
└────────────────────────────┘
│  REST API                  │
│  ← Clients refetch ici     │
│  ← Backend maître          │
└────────────────────────────┘
```

#### Règle 2 : Hiérarchie stricte des sources

```text
TIER 1 (Authoritative)
  REST API ← Backend serve data
     ↓
     └─→ Clients refetch après CHAQUE event

TIER 2 (Notifications)
  Socket.IO ← Déclenche refetch uniquement
     ├─ "order:assigned" → refetch order/:id
     ├─ "order:status:update" → refetch order/:id
     └─ JAMAIS apply sans refetch

TIER 3 (Optimisation)
  Supabase Realtime ← Apply optimistic
     ├─ Apply immédiatement pour UX
     └─ Refetch REST en background pour confirmer

TIER 4 (Fallback)
  Polling ← Filet de sécurité
     └─ Refetch toutes données actives 15-30s
```

#### Règle 3 : Réconciliation par timestamp

```typescript
// Pattern : REST API toujours gagne
reconcile(remoteData: Order): void {
  const local = this.store.get(remoteData.id)
  
  // Remote plus récent → remote gagne
  if (remoteData.updated_at > local.updated_at) {
    this.store.set(remoteData.id, remoteData)
    return
  }
  
  // Local plus récent → log warning, ignore remote
  if (remoteData.updated_at < local.updated_at) {
    logger.warn('Clock skew detected', {
      remote: remoteData.updated_at,
      local: local.updated_at,
    })
    return
  }
  
  // Sinon : identiques, pas d'action
}
```

### 3.2 Sync Engine (cœur du système)

**Responsabilité unique** : Orchestrer la réconciliation de TOUTES les sources

```typescript
class OrderSyncEngine {
  private store: OrderStore
  private api: OrderApiService
  private logger: Logger

  // ✅ Socket notification → déclenche refetch
  onSocketOrderAssigned(event: SocketEvent): void {
    const orderId = event.data.id
    logger.info('Socket: order assigned', { orderId })
    
    // Apply optimistic pour UX immédiate
    this.store.optimisticUpdate({
      id: orderId,
      driver_id: event.data.driver_id,
      updated_at: Date.now(),
    })
    
    // MAIS : refetch immédiatement pour confirmer
    this.refetchOrder(orderId)
  }

  // ✅ Supabase event → apply + refetch
  onSupabaseOrderUpdated(payload: RealtimePayload): void {
    const orderId = payload.new.id
    logger.info('Supabase: order updated', { orderId })
    
    // Apply optimistic
    this.store.optimisticUpdate(payload.new)
    
    // Refetch pour confirmer (évite events perdus)
    this.refetchOrder(orderId)
  }

  // ✅ Polling tick → refetch brutal (reconcilie tout)
  async onPollingTick(): Promise<void> {
    const activeOrderIds = this.store.getActiveOrderIds()
    logger.debug('Polling tick', { count: activeOrderIds.length })
    
    const freshData = await this.api.getOrdersByIds(activeOrderIds)
    
    // Replace (pas merge) → DB gagne toujours
    this.store.replace(freshData)
  }

  // ✅ Private : orchestrateur central
  private async refetchOrder(orderId: string): Promise<void> {
    try {
      const freshData = await this.api.getOrder(orderId)
      
      // Réconcilier : API gagne
      const local = this.store.get(orderId)
      if (freshData.updated_at > local.updated_at) {
        this.store.set(orderId, freshData)
        logger.debug('Order reconciled', { orderId })
      }
    } catch (err) {
      logger.error('Refetch failed', { orderId, err })
      // UI garde version optimistic, retry au polling
    }
  }
}
```

### 3.3 Architecture complète (visuelle)

```text
┌─────────────────────────────────────────────────────────┐
│                  UI LAYER                               │
│  (affiche state du store)                               │
└──────────────────────┬──────────────────────────────────┘
                       │ (read)
                       ↓
┌─────────────────────────────────────────────────────────┐
│              ORDER STORE (Cache local)                  │
│  ├─ orders: Map<id, Order>                              │
│  └─ updatedAt: timestamp                                │
│                                                          │
│  ❌ Jamais source de vérité                             │
│  ✅ Toujours réconciliée avec API                       │
└──────────────────────────────────────────────────────────┘
          ↑         ↑           ↑           ↑
          │         │           │           │
    (reconcile)     │           │           │
          │      (apply)   (replace)   (optimistic)
          │         │           │           │
┌─────────────────────────────────────────────────────────┐
│           ORDER SYNC ENGINE (Orchestrator)             │
│  ├─ onSocketOrderAssigned()                             │
│  ├─ onSupabaseOrderUpdated()                            │
│  ├─ onPollingTick()                                     │
│  └─ refetchOrder() [central reconciliation]             │
└─────────────┬─────────────┬──────────────┬──────────────┘
              │             │              │
        Socket.IO    Supabase Realtime   Polling
        (triggers)   (optimise)          (fallback)
              │             │              │
              └─────┬───────┴──────┬───────┘
                    │              │
                ┌───┴──────────────┴───┐
                ↓                      ↓
          REST API          (All refetches)
          (Master)          (Backend maître)
                ↓
            PostgreSQL
         (Source of truth)
```

---

## 4. Implémentation par app (New Pattern)

### App_chrono (Phase 1)

**Fichiers** :

- `app_chrono/hooks/useOrderSyncEngine.ts` (NEW — Core)
- `app_chrono/store/orderStore.ts` (modify)
- `app_chrono/services/userOrderSocketService.ts` (modify)

**Implémentation** :

```typescript
// useOrderSyncEngine.ts
export function useOrderSyncEngine() {
  const store = useOrderStore()
  const api = useOrderApi()
  const socket = useUserOrderSocket()

  // Socket triggers refetch (ne pas appliquer aveuglément)
  useEffect(() => {
    const unsubscribe = socket.on('order:assigned', (event) => {
      // ✅ Refetch immédiatement
      api.getOrder(event.id).then(data => store.set(data))
    })
    return unsubscribe
  }, [socket, api, store])

  // Polling fallback
  useEffect(() => {
    const interval = setInterval(async () => {
      const activeOrderIds = store.getActiveOrderIds()
      if (activeOrderIds.length === 0) return
      
      const data = await api.getOrdersByIds(activeOrderIds)
      store.replace(data)  // Replace, pas merge
    }, 10000)  // 10 secondes
    
    return () => clearInterval(interval)
  }, [api, store])

  return { store, refetch: api.getOrder }
}
```

**Bénéfice** :

- ✅ User voit updates immédiatement (Socket trigger)
- ✅ Robust si Socket échoue (polling)
- ✅ Données toujours correctes (API maître)

---

### Admin_chrono (Phase 2)

**Fichiers** :

- `admin_chrono/hooks/useDeliveriesSyncEngine.ts` (NEW)
- `admin_chrono/hooks/useDeliveriesTracking.ts` (refactor)

**Logique** :

```typescript
// useDeliveriesSyncEngine.ts
export function useDeliveriesSyncEngine() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const adminSocket = useAdminSocket()
  const api = useAdminApi()

  // Socket notification → refetch
  useEffect(() => {
    const unsubscribe = adminSocket.on('order:status:update', (event) => {
      api.getOrder(event.id).then(data => {
        setDeliveries(prev => {
          const idx = prev.findIndex(d => d.id === data.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = data
            return updated
          }
          return prev
        })
      })
    })
    return unsubscribe
  }, [adminSocket, api])

  // Polling : refetch toutes les 20s
  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await api.getOngoingDeliveries()
      setDeliveries(data)  // Replace
    }, 20000)
    
    return () => clearInterval(interval)
  }, [api])

  return { deliveries }
}
```

---

### Driver_chrono (Phase 3)

**Fichiers** :

- `driver_chrono/store/useOrderStore.ts` (add sync)
- `driver_chrono/hooks/useOrderAssignmentSync.ts` (NEW)

---

## 5. Checklist implémentation

### ✅ Phase 1 : app_chrono

- [ ] Créer `hooks/useOrderSyncEngine.ts`
  - Socket → refetch pattern
  - Polling fallback 10s
  - Store reconciliation

- [ ] Modifier `store/orderStore.ts`
  - Add `replace()` method (polling)
  - Add `reconcile()` logic (timestamps)

- [ ] Test : user voit updates sans F5

### ✅ Phase 2 : admin_chrono

- [ ] Créer `hooks/useDeliveriesSyncEngine.ts`
  - Central orchestrator
  - Socket + polling

- [ ] Refactor `useDeliveriesTracking.ts`
  - Use new engine
  - Remove 3.5s timeout

- [ ] Test : dashboard live updates

### ✅ Phase 3 : driver_chrono

- [ ] Add sync engine à `useOrderStore`
- [ ] Polling 15s sur ses commandes

---

## 6. Avantages du pattern (vs ancien)

| Critère | Ancien | Nouveau |
| --- | --- | --- |
| **Source de vérité** | ❌ Floue (Socket/Supabase) | ✅ Clair (API REST) |
| **Réconciliation** | ❌ Aucune | ✅ Timestamp-based |
| **Fallback robuste** | ❌ 3.5s timeout | ✅ 10-30s polling |
| **Cohérence multi-app** | ❌ Non garantie | ✅ Centralisée |
| **Data integrity** | ❌ Risqué | ✅ Garanti |
| **Complexité** | ✅ Simple | ⚠️ Medium (vaut le coup) |

---

## 7. Estimation

| Phase | Effort | Durée | Risque |
| --- | --- | --- | --- |
| **SyncEngine core** | 2h | Hooks + reconciliation | Basse |
| **app_chrono** | 3-4h | Integration | Basse |
| **admin_chrono** | 2-3h | Refactor | Basse |
| **driver_chrono** | 2-3h | Integration | Basse |
| **Testing** | 4-6h | E2E, network sim | Moyenne |
| **Total** | — | **15-20h** | — |

**Gain** : Solution + robuste + performante qu'avant

---

## 8. Risques & Mitigation

| Risque | Cause | Mitigation |
| --- | --- | --- |
| Polling trop agressif | 10s sur 100 users | Rate limit API, cache responses |
| Clock skew entre clients/backend | Horloge systèmes | Toujours backend remporte |
| API slow → lag UX | Refetch après chaque event | Optimistic apply immédiat |
| Socket + Supabase + Polling échouent | Double network failure | UI garde cache, affiche "last known" |

---

## 9. Conclusion

### Le changement clé

**Avant** : "comment avoir plus d'events en temps réel ?"
**Après** : "comment garantir que le state UI = state DB ?"

La vraie solution n'est pas plus de realtime, c'est une **stratégie de synchronisation** centralisée avec une source de vérité unique.

### Niveau production

✅ Single source of truth (REST API)  
✅ Clear reconciliation logic (timestamps)  
✅ Fallback robuste (polling)  
✅ Multi-app coherence (SyncEngine)  
✅ Backend-driven (backend maître)

Ça, c'est du **niveau senior**.
