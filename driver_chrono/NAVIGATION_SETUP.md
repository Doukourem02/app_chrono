# Navigation professionnelle Mapbox (style Yango)

Guide pour activer la navigation intégrée avec guidage vocal dans l'app livreur Chrono.

## Option A — Tout aligner en MapboxMaps v10 (implémenté)

Pour faire coexister Fleetbase (Navigation v2) + @rnmapbox/maps, on force **MapboxMaps v10** partout :

| Package | MapboxMaps |
|---------|------------|
| `@fleetbase/react-native-mapbox-navigation` | ~> 10.12.1 |
| `@rnmapbox/maps` (forcé) | ~> 10.12.1 |

**Configuration appliquée** :
- `app.config.js` : plugin `@rnmapbox/maps` avec `RNMapboxMapsVersion: "10.12.1"`
- `ios/Podfile` : `$RNMapboxMapsVersion = '~> 10.12.1'` + hooks `$RNMBNAV`
- Package Fleetbase installé depuis [GitHub](https://github.com/fleetbase/react-native-mapbox-navigation) (tarball) pour le code natif

⚠️ MapboxMaps v10 est déprécié. Planifier une migration vers v11/Navigation v3 plus tard.

## Fonctionnalités (si Mapbox Navigation activé)

- **Guidage vocal** (Amazon Polly, 20+ langues)
- **Instructions tour-à-tour** (comme sur l'image de référence)
- **Reroutage trafic** en temps réel (55+ pays)
- **Style 3D** professionnel jour/nuit
- **Navigation en arrière-plan** (écran verrouillé)

## Prérequis Mapbox

1. Créez un compte sur [Mapbox](https://account.mapbox.com/)
2. **Token public** : [Tokens](https://account.mapbox.com/access-tokens/) → copiez le token par défaut ou créez-en un
3. **Token secret** : Créez un token avec la scope `Downloads:Read` (pour télécharger les SDK natifs)

## Installation (Option A)

```bash
cd driver_chrono
# Installer depuis GitHub (code natif inclus) — le package npm n'inclut pas ios/android
npm install "https://github.com/fleetbase/react-native-mapbox-navigation/archive/refs/heads/main.tar.gz"
```

**Token secret Mapbox obligatoire** : Créez `~/.netrc` avec un token scope `Downloads:Read` :

```
machine api.mapbox.com
login mapbox
password VOTRE_TOKEN_SECRET_ICI
```

Sans ce token, `pod install` échouera avec une erreur 401 lors du téléchargement de MapboxNavigationNative.

## Configuration iOS

### 1. Prébuild (si projet Expo)

```bash
npx expo prebuild
```

### 2. Info.plist

Ajoutez dans `ios/driver_chrono/Info.plist` :

```xml
<key>MBXAccessToken</key>
<string>VOTRE_TOKEN_PUBLIC_MAPBOX</string>
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>location</string>
</array>
```

### 3. Bridging Header (Swift)

Si le projet n'a pas de bridging header :
- Xcode → File → New → File → Swift File (nommez "Dummy")
- Sélectionnez "Create Bridging Header" quand demandé

### 4. Build Settings

- `Don't Dead-strip Inits and Terms` = YES
- `Dead Code Stripping` = YES
- Retirez `$(TOOLCHAIN_DIR)/usr/lib/swift-5.0/$(PLATFORM_NAME)` des Library Search Paths si présent

### 5. Token secret (.netrc)

Créez `~/.netrc` (dans votre dossier utilisateur) :

```
machine api.mapbox.com
login mapbox
password VOTRE_TOKEN_SECRET_ICI
```

### 6. Podfile

> ⚠️ Exécutez d'abord `npx expo prebuild` pour générer le dossier `ios/`.

Dans `ios/Podfile`, ajoutez en haut (après les autres `require`) :

```ruby
$RNMBNAV = require('../node_modules/@fleetbase/react-native-mapbox-navigation/scripts/react_native_mapbox_navigation_pods.rb')
```

Puis dans le bloc `target` principal :

```ruby
pre_install do |installer|
  $RNMBNAV.pre_install(installer)
end

post_install do |installer|
  $RNMBNAV.post_install(installer)
end
```

### 7. Pod install

```bash
cd ios && pod install && cd ..
```

## Configuration Android

### 1. gradle.properties

Ajoutez dans `android/gradle.properties` :

```
MAPBOX_DOWNLOADS_TOKEN=VOTRE_TOKEN_SECRET_ICI
```

### 2. build.gradle (project)

Dans `allprojects { repositories { ... } }`, ajoutez :

```groovy
maven {
    url 'https://api.mapbox.com/downloads/v2/releases/maven'
    authentication { basic(BasicAuthentication) }
    credentials {
        username = "mapbox"
        password = project.properties['MAPBOX_DOWNLOADS_TOKEN'] ?: ""
    }
}
```

### 3. AndroidManifest.xml

Dans `android/app/src/main/AndroidManifest.xml`, sous `<application>` :

```xml
<meta-data
    android:name="MAPBOX_ACCESS_TOKEN"
    android:value="VOTRE_TOKEN_PUBLIC_ICI" />
```

## Utilisation dans l'app

Quand le livreur accepte une commande :
1. **Phase 1** : Navigation vers le point de collecte (récupérer le colis)
2. Le livreur marque "Colis pris en charge"
3. **Phase 2** : Navigation vers la destination de livraison

Le bouton "Démarrer la navigation" ouvre l'écran de navigation full-screen avec guidage vocal.

## Coûts Mapbox

- [Tarification Mapbox](https://www.mapbox.com/pricing/)
- Navigation : facturation par session
- 50 000 chargements de carte gratuits/mois
- Vérifiez les quotas pour la production

## Dépannage

### Checklist diagnostic ("ça ne se passe pas comme prévu")

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Écran "Navigation non configurée" | Package non chargé ou `require()` échoue | Vérifier `yarn list @fleetbase/react-native-mapbox-navigation`, redémarrer Metro |
| Carte vide / crash au lancement | Tokens Mapbox non configurés | Vérifier `MBXAccessToken` dans Info.plist (iOS) et `MAPBOX_ACCESS_TOKEN` dans AndroidManifest |
| Ouvre Google Maps au lieu de Mapbox | `onStartNavigation` non passé (destination null) | Vérifier que pickup/dropoff ont des `coordinates` valides selon le statut |
| Pas de voix / instructions | UIBackgroundModes manquant | Ajouter `audio` et `location` dans Info.plist |
| Erreur pod install | Token secret manquant | Créer `~/.netrc` avec le token secret (scope Downloads:Read) |
| Erreur "multiple commands produce" | Conflit CocoaPods | Ajouter `install! 'cocoapods', :disable_input_output_paths => true` en haut du Podfile |

### Étapes obligatoires (Expo)

1. **Prébuild** : `npx expo prebuild --clean` pour régénérer `ios/` et `android/` (le plugin @rnmapbox/maps applique RNMapboxMapsVersion)
2. **Configurer** : Suivre les sections iOS et Android ci-dessus (Info.plist, .netrc, Podfile)
3. **Pods** : `cd ios && pod install`
4. **Rebuild** : `npx expo run:ios` ou `npx expo run:android` (pas Expo Go)

> ⚠️ **Expo Go ne supporte pas** les modules natifs comme Mapbox Navigation. Utilisez un development build.

### Patches automatiques

**postinstall (npm)** : `scripts/apply-mapbox-navigation-patch.js` copie `MapboxNavigationView.swift` patché pour activer la navigation turn-by-turn complète (bannière instructions, ligne bleue, vitesse, style 3D). Le package Fleetbase d’origine n’affiche que la carte sans calculer la route.

**post_install (Podfile)** :

1. **ViewAnnotationManager.swift** (MapboxMaps) – correctif Xcode 16 / Swift 6 (`compactMapValues`)
2. **RNMBXModelLayer, RNMBXModels, RNMBXNativeUserLocation, RNMBXStyle** (@rnmapbox/maps) – APIs v11-only wrappées en `#if RNMBX_11`
3. **Expression.swift** (MapboxNavigation) – désambiguïsation `MapboxMaps.Expression`
4. **UIImage.swift** (MapboxNavigation) – fallback pour assets manquants (évite crash `locationImage` / ResumeButton)
5. **RouteVoiceController.swift** (MapboxNavigation) – fallback pour asset `reroute-sound` manquant (évite crash à l’init)

> Après `npm install`, exécutez `node scripts/apply-mapbox-navigation-patch.js` (ou `npm run postinstall`), puis `cd ios && pod install`.

### Autres

- **Erreur "multiple commands produce"** : Ajoutez `install! 'cocoapods', :disable_input_output_paths => true` en haut du Podfile
- **Conflit MapboxMaps 10 vs 11** : `@fleetbase/react-native-mapbox-navigation` et `@rnmapbox/maps` sont incompatibles (voir section en haut)
- **Voice ne marche pas** : Vérifiez UIBackgroundModes `audio` et `location`
