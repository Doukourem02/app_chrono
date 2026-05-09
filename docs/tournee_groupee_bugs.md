# Tournée groupée — Bugs, contexte et plan de correction

_Rédigé le 2026-05-09 — basé sur les captures d'écran, logs Better Stack et analyse du code source._

---

## 1. Contexte et flux normal attendu

### Ce que la tournée groupée doit faire

1. Un partenaire crée un batch (tournée) avec N livraisons.
2. Le serveur envoie une offre (`batch-offer`) au livreur via socket.
3. Le livreur accepte → le serveur répond `batch-assigned` → l'app fait `router.push('/batch/${batchId}')`.
4. Le livreur voit la **liste des arrêts** (Image 1) : pour chaque arrêt il peut naviguer, scanner QR, entrer le code, ou faire une preuve alternative.
5. La navigation vers chaque arrêt est **séquentielle** : un arrêt à la fois, via `startNavigationToStop(stop)` dans `batch/[batchId].tsx`.
6. À l'arrivée (géofencing `onEnteredDropoffZone`), les boutons de validation apparaissent.
7. Une fois tous les arrêts traités → écran "Tournée terminée".

### Fichiers clés

| Fichier | Rôle |
|---|---|
| `driver_chrono/app/(tabs)/index.tsx` | Carte principale, navigation solo |
| `driver_chrono/app/batch/[batchId].tsx` | Écran liste + navigation batch |
| `driver_chrono/store/useBatchStore.ts` | État Zustand du batch actif |
| `driver_chrono/store/useOrderStore.ts` | État Zustand des commandes actives |
| `driver_chrono/services/orderSocketService.ts` | Gestion socket (batch-assigned, order:status:update, resync) |
| `driver_chrono/components/DriverOrderBottomSheet.tsx` | Bottom sheet carte principale |
| `driver_chrono/components/MapboxNavigationScreen.tsx` | Navigation Mapbox intégrée |

---

## 2. Les trois bugs identifiés

---

### Bug 1 — Impossible de revenir à la liste de la tournée

#### Symptôme (Image 1 → Image 2)
Après avoir accepté la tournée et vu la liste des arrêts (Image 1), si le livreur appuie sur "retour" ou navigue ailleurs, il arrive sur la **carte principale** (Image 2). Il n'y a **aucun bouton visible** pour revenir à la liste de tournée depuis la vue réduite du bottom sheet.

#### Cause racine
Le lien "Voir la tournée" existe dans le bottom sheet **étendu** uniquement (dans le bloc "Contexte B2B"), ce qui est trop enfoui :

```tsx
// driver_chrono/components/DriverOrderBottomSheet.tsx:539
{batchId ? (
  <TouchableOpacity
    style={styles.b2bBatchBtn}
    onPress={() => router.push(`/batch/${batchId}` as any)}
  >
    <Text>Voir la tournée</Text>
  </TouchableOpacity>
) : null}
```

En vue **réduite** (collapsed), le livreur ne voit que 3 boutons ronds (navigation, Je pars, annuler). Aucun accès direct à la liste de tournée.

#### Comment corriger
Ajouter un **bouton flottant persistant** sur la carte principale (`index.tsx`) dès que `activeBatch` est non-null :

```tsx
// driver_chrono/app/(tabs)/index.tsx
// Ajouter dans le JSX de retour, après la DriverMapView :

const activeBatch = useBatchStore((s) => s.activeBatch);

// Dans le return :
{activeBatch && !isNavigationActive && (
  <TouchableOpacity
    style={styles.batchReturnFab}
    onPress={() => router.push(`/batch/${activeBatch.id}` as any)}
    accessibilityLabel="Retour à la tournée groupée"
  >
    <Ionicons name="list-outline" size={18} color="#fff" />
    <Text style={styles.batchReturnFabText}>
      Tournée · {activeBatch.stops.filter(s => s.status === 'pending').length} restant(s)
    </Text>
  </TouchableOpacity>
)}

// Style à ajouter :
batchReturnFab: {
  position: 'absolute',
  top: 80,        // sous le StatusToggle
  alignSelf: 'center',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#7C3AED',
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 20,
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 6,
},
batchReturnFabText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 14,
},
```

---

### Bug 2 — Le bouton "voiture" au milieu de la carte (Image 2)

#### Symptôme
Sur la carte principale (Image 2), le bottom sheet réduit affiche 3 boutons ronds :
- Violet (navigation) → ouvrir la navigation Mapbox
- **Bleu/voiture → "Je pars"** (passage à status `enroute`)
- Rouge → annuler la course

Le livreur ne sait pas ce que fait le bouton du milieu. Et surtout, **il ne devrait pas apparaître** pour une commande batch.

#### Cause racine — double problème

**Côté frontend :** Le filtre `!o.batch_id` dans `currentOrder` (ligne 205 de `index.tsx`) est supposé exclure les commandes batch de la carte principale :

```typescript
// driver_chrono/app/(tabs)/index.tsx:203
const currentOrder = useOrderStore((s) => {
  const validActiveOrders = s.activeOrders.filter(o =>
    o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'declined' && !o.batch_id
  );
  ...
});
```

Mais ce filtre ne marche que si le champ `batch_id` est présent dans l'objet ordre. Or l'event `order:status:update` **peut arriver sans `batch_id`** dans son payload.

Le garde secondaire (ligne 347 de `orderSocketService.ts`) utilise `activeBatchStopIds` :

```typescript
// driver_chrono/services/orderSocketService.ts:347
const activeBatchStopIds = useBatchStore.getState().activeBatch?.stops.map(s => s.orderId) ?? [];
if (order.batch_id || activeBatchStopIds.includes(order.id)) { ... }
```

Ce garde fonctionne **seulement si `activeBatch` est en mémoire**. Après une reconnexion socket ou un crash partiel de l'app, `activeBatch` peut être null → le garde échoue → la commande batch atterrit dans `activeOrders` → le bottom sheet de la carte principale la montre → le bouton "Je pars" apparaît.

**Côté backend :** Le serveur envoie `order:status:update` sans systématiquement inclure `batch_id`, ce qui prive le frontend de la donnée nécessaire au filtrage.

#### Comment corriger

**Fix 1 — Backend (prioritaire)** : Toujours inclure `batch_id` dans les payloads `order:status:update` pour les commandes appartenant à un batch.

**Fix 2 — Frontend guard renforcé** : Si `activeBatch` est présent, bloquer la navigation automatique sur la carte principale quel que soit `batch_id` :

```typescript
// driver_chrono/app/(tabs)/index.tsx — dans le useEffect d'auto-nav (ligne ~499)
// Ajouter AVANT les guards existants :

const activeBatch = useBatchStore.getState().activeBatch;
// Si un batch est actif, ne jamais démarrer la nav principale (même si batch_id absent du payload)
if (activeBatch) return;
```

**Fix 3 — Cacher le bouton "Je pars" dans le bottom sheet si batch actif** :

```tsx
// driver_chrono/components/DriverOrderBottomSheet.tsx
// Ajouter une prop isBatchOrder ou récupérer depuis useBatchStore

const activeBatchStopIds = useBatchStore(s => s.activeBatch?.stops.map(s => s.orderId) ?? []);
const isBatchStop = activeBatchStopIds.includes(currentOrder?.id ?? '');

// Dans availableActions : ne pas inclure 'enroute' si c'est un stop batch
if (status === 'accepted' && !isBatchStop) {
  actions.push({ id: 'enroute', label: 'Je pars', ... });
}
```

---

### Bug 3 — Bloqué sur "Lancement de la navigation..." (Images 3 & 4)

#### Symptôme
Après avoir appuyé "Je pars" (ou depuis la batch screen), l'écran affiche un spinner + "Lancement de la navigation..." et **reste bloqué indéfiniment**. Le livreur ne peut ni avancer ni revenir.

#### Localisation du code

Le texte et l'overlay viennent de `index.tsx` ligne 1524 :

```tsx
// driver_chrono/app/(tabs)/index.tsx:1524
{((!phase1MountReady && (currentOrder?.status === 'accepted' || ...)) || showRecalcOverlay) && (
  <View style={styles.recalcOverlay}>
    <ActivityIndicator size="large" color="#fff" />
    <Text>{showRecalcOverlay ? "Recalcul..." : "Lancement de la navigation..."}</Text>
  </View>
)}
```

L'overlay s'affiche quand `isNavigationActive = true` ET `phase1MountReady = false`.

#### Race condition — mécanisme exact

```
État initial : isNavigationActive=false, phase1MountReady=false

1. Livreur appuie "Je pars" → status passe à "enroute"
2. useEffect auto-nav (ligne 499) détecte le changement :
   - setIsNavigationActive(true)       ← overlay s'affiche
   - setPhase1MountReady(false)
   - InteractionManager.runAfterInteractions(
       () => setTimeout(() => setPhase1MountReady(true), 400)
     )
   - setTimeout(() => setPhase1MountReady(true), 2000)  ← fallback

3. Socket se reconnecte (logs : 4-5 reconnexions en 90s)
4. resync-order-state reçu : 0 pending, 0 active
   → Le backend ne track pas les commandes batch dans le resync standard
   → activeOrders se vide → currentOrder devient null
   → useEffect ligne 596 se déclenche :
       if (!currentOrder?.id) { setPhase1MountReady(false); }  ← RE-RESET

5. Nouvel order:status:update arrive → commande réapparaît dans activeOrders
6. useEffect auto-nav redémarre → retour à l'étape 2

→ Boucle infinie : phase1MountReady ne reste jamais à true assez longtemps
  pour que MapboxNavigationScreen monte correctement.
```

#### Confirmation par les logs Better Stack

```
12:15:27 [driver-reconnect] Resync envoyé: 0 pending, 0 active
12:15:28 🔴 Client déconnecté
12:15:53 [driver-reconnect] Resync envoyé: 0 pending, 0 active
12:15:55 🟢 Client connecté
12:15:56 [driver-reconnect] Resync envoyé: 0 pending, 0 active
12:17:44 [socket-disconnect] Livreur retiré du cache mémoire (90s)
```

Le livreur fait 4 cycles connect/disconnect pendant que la navigation essaie de démarrer.

#### Comment corriger

**Fix 1 — Escape hatch : bouton de sortie si bloqué > 4s**

```tsx
// driver_chrono/app/(tabs)/index.tsx
// Ajouter un state :
const [navStuckSince, setNavStuckSince] = useState<number | null>(null);

// useEffect pour détecter le blocage :
useEffect(() => {
  if (isNavigationActive && !phase1MountReady) {
    setNavStuckSince(Date.now());
  } else {
    setNavStuckSince(null);
  }
}, [isNavigationActive, phase1MountReady]);

useEffect(() => {
  if (!navStuckSince) return;
  const t = setTimeout(() => {
    // Après 4s bloqué → afficher le bouton de sortie
    setShowNavStuckEscape(true);
  }, 4000);
  return () => clearTimeout(t);
}, [navStuckSince]);

// Dans le JSX de l'overlay :
{((!phase1MountReady && ...) || showRecalcOverlay) && (
  <View style={styles.recalcOverlay}>
    <ActivityIndicator size="large" color="#fff" />
    <Text>{...}</Text>
    {showNavStuckEscape && (
      <TouchableOpacity
        style={styles.navStuckEscapeBtn}
        onPress={() => resetNavigationUi(true)}
      >
        <Text style={styles.navStuckEscapeText}>Annuler</Text>
      </TouchableOpacity>
    )}
  </View>
)}
```

**Fix 2 — Stabiliser `phase1MountReady` contre les resync**

Le reset à `false` ligne 596 est trop agressif. Le corriger :

```typescript
// driver_chrono/app/(tabs)/index.tsx:596
// AVANT :
useEffect(() => {
  if (!currentOrder?.id) {
    setPhase1MountReady(false);
  }
}, [currentOrder?.id]);

// APRÈS : ne reset que si navigation pas encore active
useEffect(() => {
  if (!currentOrder?.id && !isNavigationActive) {
    setPhase1MountReady(false);
  }
}, [currentOrder?.id, isNavigationActive]);
```

**Fix 3 — Backend : inclure les commandes batch dans le resync**

Le backend doit envoyer les commandes batch (même sous forme minimale) dans `resync-order-state` pour que l'app sache qu'elles existent après reconnexion. Alternative : persister `activeBatch` côté frontend (Zustand + AsyncStorage) pour survivre aux reconnexions.

---

## 3. Architecture de la navigation séquentielle — État des lieux et recommandations

### Ce qui fonctionne déjà bien

La navigation séquentielle est correctement implémentée dans `batch/[batchId].tsx` :

- **Un seul `navigationStop` actif à la fois** (`useState<BatchStop | null>`)
- **Géofencing par arrêt** : `useGeofencing` sur `navigationStop.coordinates`
- **Restauration après retour d'arrière-plan** : `navigationStopOrderId` persisté dans `useBatchStore`
- **Proposition arrêt suivant** après validation : `Alert.alert('Arrêt suivant', ...)`

### Ce qui pose problème

Le **conflit entre deux systèmes de navigation** :

```
batch/[batchId].tsx    ←→    (tabs)/index.tsx
  MapboxNavigationScreen      MapboxNavigationScreen
  géofencing batch            géofencing solo
  useBatchStore               useOrderStore + navigationSession
```

Quand les gardes échouent (batch_id absent, activeBatch null), les deux écrans essaient de naviguer pour le même ordre → conflit → blocage.

### Règle d'architecture à appliquer

**Un seul système de navigation à la fois.** Quand `activeBatch` est non-null :
- La carte principale (`index.tsx`) doit être en mode **lecture seule** pour les commandes batch
- `isNavigationActive` ne doit jamais passer à `true` dans `index.tsx` si un batch est actif
- La navigation est entièrement déléguée à `batch/[batchId].tsx`

Ajouter ce guard en haut du `useEffect` auto-nav :

```typescript
// driver_chrono/app/(tabs)/index.tsx — useEffect ligne ~499
useEffect(() => {
  if (!currentOrder) { ... return; }
  if (currentOrder.batch_id) return;                              // guard 1 : batch_id présent
  const activeBatch = useBatchStore.getState().activeBatch;
  if (activeBatch) return;                                        // guard 2 : batch actif en mémoire (sans batch_id)
  if (activeBatch?.stops.some(s => s.orderId === currentOrder.id)) return; // guard 3 : déjà là
  ...
}, [...]);
```

### Schéma de flux cible

```
Livreur accepte batch
        ↓
router.push('/batch/${batchId}')
        ↓
BatchScreen — liste des arrêts
        ↓
Livreur tape "Naviguer" sur arrêt N
        ↓
startNavigationToStop(stop)
  → setNavigationStop(stop)
  → setNavigationOrigin(driverLocation)
        ↓
MapboxNavigationScreen (full screen dans BatchScreen)
  → géofencing → onEnteredDropoffZone → showArrivalActions
        ↓
Livreur valide (QR / code / photo)
  → validateBatchOrder() → updateStop(orderId, 'completed')
  → stopNavigation()
  → Alert "Arrêt suivant ?"
        ↓
Répéter pour arrêt N+1
        ↓
Tous terminés → router.replace('/(tabs)')
```

La carte principale (`index.tsx`) reste **visible en arrière-plan** (map) mais **ne déclenche aucune navigation automatique** tant que `activeBatch` est actif.

---

## 4. Récapitulatif — Ordre de priorité des corrections

| Priorité | Bug | Fix | Risque |
|---|---|---|---|
| 🔴 P0 | Nav bloquée indéfiniment (Bug 3) | Escape hatch 4s + reset `phase1MountReady` corrigé | Faible |
| 🔴 P0 | Guard auto-nav contre les batchs actifs (Bug 3) | Ajouter `if (activeBatch) return;` | Faible |
| 🟠 P1 | Bouton retour vers la tournée (Bug 1) | FAB flottant sur la carte principale | Faible |
| 🟠 P1 | Bouton "Je pars" ne doit pas apparaître (Bug 2) | Cacher si stop batch | Faible |
| 🟡 P2 | Backend : `batch_id` dans `order:status:update` | Modifier payload serveur | Moyen |
| 🟡 P2 | Backend : batch orders dans resync | Ajouter au resync OU persister `activeBatch` | Moyen |

---

## 5. Fichiers à modifier

### Frontend — `driver_chrono`

- `app/(tabs)/index.tsx` — guard auto-nav, escape hatch, FAB retour tournée, fix reset phase1MountReady
- `components/DriverOrderBottomSheet.tsx` — masquer "Je pars" pour stops batch
- `store/useBatchStore.ts` — optionnel : ajouter persistance AsyncStorage pour `activeBatch`

### Backend — `chrono_backend`

- Handler `order:status:update` → toujours inclure `batch_id` si l'ordre appartient à un batch
- Handler `driver-reconnect` / `resync-order-state` → inclure les commandes batch actives du driver (ou leur identifiant batchId) pour restaurer `activeBatch` côté client
