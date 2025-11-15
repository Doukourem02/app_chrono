# Types et Helpers - Guide d'utilisation

Ce dossier contient des types et helpers réutilisables pour éviter les erreurs TypeScript répétitives.

## 🎯 Problème résolu

Avant, chaque fois qu'on modifiait du code, on devait :
- Typer manuellement chaque callback Socket.IO
- Typer manuellement chaque tableau retourné par une API
- Répéter les mêmes assertions de type partout

**Maintenant**, on utilise des helpers qui font ça automatiquement.

## 📦 Socket.IO (`types/socket.ts`)

### Avant ❌
```typescript
const unsubscribe = adminSocketService.on('driver:online', (data: unknown) => {
  const typedData = data as OnlineDriver
  // utiliser typedData...
})
```

### Après ✅
```typescript
import { createSocketHandler } from '@/types/socket'

const unsubscribe = adminSocketService.on(
  'driver:online',
  createSocketHandler('driver:online', (data) => {
    // data est déjà typé comme OnlineDriver !
    console.log(data.userId) // ✅ Pas d'erreur TypeScript
  })
)
```

## 📡 API Responses (`types/api.ts`)

### Avant ❌
```typescript
const result = await adminApiService.getOrders()
const orders: Order[] = (result.data as Order[]) || []
orders.map((order: Order) => { ... })
```

### Après ✅
```typescript
import { asApiArray } from '@/types/api'

const result = await adminApiService.getOrders()
const orders = asApiArray<Order>(result) // ✅ Déjà typé !
orders.map((order) => { ... }) // ✅ TypeScript infère le type
```

## 🔧 Helpers disponibles

### `asArray<T>(data, fallback?)`
Type un tableau de manière sûre.
```typescript
const items = asArray<MyType>(apiResponse.data, [])
```

### `asType<T>(data, fallback?)`
Type un objet de manière sûre.
```typescript
const item = asType<MyType>(apiResponse.data)
```

### `asApiArray<T>(response, fallback?)`
Type un tableau depuis une réponse API complète.
```typescript
const items = asApiArray<MyType>(apiResponse)
```

### `createSocketHandler<T>(event, handler)`
Crée un handler Socket.IO typé.
```typescript
const handler = createSocketHandler('driver:online', (data) => {
  // data est automatiquement typé selon l'événement
})
```

## 📝 Checklist pour éviter les erreurs

Quand tu modifies du code qui utilise :
- ✅ **Socket.IO** → Utilise `createSocketHandler`
- ✅ **Réponses API avec tableaux** → Utilise `asApiArray`
- ✅ **Données `unknown`** → Utilise `asType` ou `asArray`
- ✅ **Refs dans `useMemo`** → Utilise `useState` à la place

## 🚀 Migration progressive

Tu n'as pas besoin de tout migrer d'un coup. Utilise ces helpers :
1. Quand tu modifies du code existant
2. Quand tu crées de nouveaux composants
3. Quand tu vois une erreur TypeScript liée au typage

