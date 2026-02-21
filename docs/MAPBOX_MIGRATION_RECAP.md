# Récapitulatif Migration Mapbox — Chrono

> Document de référence : stratégie des tokens, variables d'environnement, ce qui reste à faire.

---

## 1. Stratégie des tokens Mapbox

| Token | Usage | Où le stocker | Sécurité |
|-------|-------|---------------|----------|
| **Token public** (`pk.xxx`) | Carte, affichage | Front (admin, app, driver) | Peut fuiter — limiter les scopes dans la console Mapbox |
| **Token serveur** (`pk.xxx` ou `sk.xxx`) | Directions, Geocoding, Search | Backend uniquement `chrono_backend/.env` | Jamais exposé au client |

> **Note** : Un token `pk.` peut servir de token serveur tant qu'il reste dans le backend. Pour plus de sécurité, créez un token restreint (URL, scopes) dans la console Mapbox.

---

## 2. Ce qui reste à faire

### Build dev (driver_chrono)

- [ ] Vérifier que `eas build --profile development` ou `expo run:ios/android` fonctionne pour driver_chrono
- [ ] Mapbox ne fonctionne pas dans Expo Go

### Optionnel

- [ ] Cache Redis + rate-limit pour les appels Mapbox (chrono_backend)
- [ ] Faire passer les appels front par le backend (cache, rate-limit)

---

## 3. Variables d'environnement

### admin_chrono

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxxxx
```

### app_chrono (et driver_chrono)

```env
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxxxx
```

### chrono_backend

```env
# Mapbox - token serveur (jamais exposé au client)
MAPBOX_ACCESS_TOKEN=pk.xxxxx

# Google - fallback si Mapbox non configuré
GOOGLE_MAPS_API_KEY=...  # ou GOOGLE_API_KEY (optionnel)
```

---

## 4. Références

- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [Mapbox Search Box API](https://docs.mapbox.com/api/search/search-box/)
- [Mapbox Geocoding API v6](https://docs.mapbox.com/api/search/geocoding/)
- [@rnmapbox/maps - Install](https://rnmapbox.github.io/docs/install)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/api/)

---

*Dernière mise à jour : février 2026*
