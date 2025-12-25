# 🎨 Outils et Technologies pour les Animations

## 📋 Vue d'ensemble

Le projet utilise **2 systèmes d'animation différents** selon la plateforme :

- **Mobile** (app_chrono, driver_chrono) : `react-native-reanimated`
- **Web** (admin_chrono) : `framer-motion`

---

## 📦 Bibliothèques Principales

### 1. **framer-motion** (v12.23.24) - Web (Next.js)

**Rôle** : Bibliothèque principale pour les animations web dans le dashboard admin

**Pourquoi** :

- ✅ Animations performantes pour React/Next.js
- ✅ API simple et déclarative
- ✅ Support des gestes et interactions
- ✅ Optimisé pour le web

**Utilisation** : Dashboard admin (`admin_chrono`)

**Composants utilisés** :

- `motion.div` - Div animée
- `motion.button` - Bouton animé
- `AnimatePresence` - Animations d'entrée/sortie

**Props principales** :

- `initial` - État initial
- `animate` - État animé
- `transition` - Configuration de transition
- `whileHover` - Animation au survol
- `whileTap` - Animation au clic

**Installation** :

```bash
npm install framer-motion
```

**Exemple** :

```tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Contenu animé
</motion.div>;
```

---

### 2. **react-native-reanimated** (v4.1.1) - Mobile

**Rôle** : Bibliothèque principale pour toutes les animations

**Pourquoi** :

- ✅ Animations performantes sur le thread UI (60 FPS)
- ✅ Pas de blocage du thread JavaScript
- ✅ API moderne avec hooks (`useSharedValue`, `useAnimatedStyle`)

**Fonctions utilisées** :

- `withSpring` - Animations élastiques
- `withTiming` - Animations linéaires
- `withSequence` - Séquence d'animations
- `withDelay` - Délais
- `withRepeat` - Répétition infinie
- `interpolate` - Interpolation de valeurs

**Installation** :

```bash
npm install react-native-reanimated
```

**Configuration Babel** (`babel.config.js`) :

```javascript
module.exports = {
  plugins: [
    "react-native-reanimated/plugin", // ⚠️ Doit être en dernier
  ],
};
```

---

### 3. **expo-haptics** (v15.0.7) - Mobile uniquement

**Rôle** : Feedback haptique (vibration) pour les interactions

**Utilisation** : Dans `AnimatedButton` pour le feedback tactile

**Fonctions utilisées** :

- `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` - Vibration légère
- `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` - Vibration moyenne

**Installation** :

```bash
npm install expo-haptics
```

---

### 4. **react-native-gesture-handler** (v2.28.0) - Mobile uniquement

**Rôle** : Gestion des gestes (swipe, pan, etc.)

**Utilisation** : Dans `AnimatedBottomSheet` pour le swipe vers le bas

**Fonctions utilisées** :

- `Gesture.Pan()` - Geste de glissement
- `GestureDetector` - Composant wrapper

**Installation** :

```bash
npm install react-native-gesture-handler
```

**Configuration** : Importer au début de `App.tsx` ou `_layout.tsx`

```tsx
import "react-native-gesture-handler";
```

---

### 5. **@expo/vector-icons** (v15.0.3) - Mobile uniquement

**Rôle** : Icônes pour les animations

**Utilisation** : Icônes Ionicons dans plusieurs animations

- `SuccessAnimation` - checkmark
- `ErrorAnimation` - close
- `PullToRefreshIndicator` - refresh
- `FormValidationAnimation` - checkmark-circle / close-circle
- `TrackingMarker` - location

**Installation** :

```bash
npm install @expo/vector-icons
```

---

## 📋 Liste des 10 Animations

1. **AnimatedButton** - Bouton avec feedback haptique
2. **AnimatedCard** - Carte avec animation d'entrée
3. **ScreenTransition** - Transition d'écran
4. **AnimatedBottomSheet** - Bottom sheet avec swipe
5. **SuccessAnimation** - Animation de succès
6. **ErrorAnimation** - Animation d'erreur
7. **SkeletonLoader** - Placeholder de chargement
8. **PullToRefreshIndicator** - Indicateur pull-to-refresh
9. **FormValidationAnimation** - Validation de formulaire
10. **TrackingMarker** - Marqueur animé pour carte

---

## 🚀 Installation Rapide

### Pour Mobile (React Native)

```bash
npm install react-native-reanimated expo-haptics react-native-gesture-handler @expo/vector-icons
```

### Pour Web (Next.js)

```bash
npm install framer-motion
```

---

## 📁 Fichiers à Copier

```
components/animations/
├── AnimatedButton.tsx
├── AnimatedCard.tsx
├── AnimatedBottomSheet.tsx
├── ScreenTransition.tsx
├── SuccessAnimation.tsx
├── ErrorAnimation.tsx
├── SkeletonLoader.tsx
├── PullToRefresh.tsx
├── FormValidationAnimation.tsx
├── TrackingMarker.tsx
└── index.ts
```

---

## ⚙️ Configuration Minimale

### Pour Mobile (React Native)

**1. Babel** (`babel.config.js`) :

```javascript
module.exports = {
  plugins: [
    "react-native-reanimated/plugin", // ⚠️ Dernier plugin
  ],
};
```

**2. Entry Point** (`App.tsx` ou `_layout.tsx`) :

```tsx
import "react-native-gesture-handler";
```

**3. Utilisation** :

```tsx
import { AnimatedButton, AnimatedCard } from "./components/animations";
```

### Pour Web (Next.js)

**1. Installation** :

```bash
npm install framer-motion
```

**2. Utilisation** (déjà configuré, pas de config supplémentaire) :

```tsx
import { AnimatedButton, AnimatedCard } from "@/components/animations";
```

**Note** : Les composants web utilisent `framer-motion` au lieu de `react-native-reanimated`.

---

## 🎯 Résumé

### Par Plateforme

**Mobile (React Native)** :

- `react-native-reanimated` - Animations performantes
- `expo-haptics` - Feedback tactile
- `react-native-gesture-handler` - Gestes
- `@expo/vector-icons` - Icônes

**Web (Next.js)** :

- `framer-motion` - Animations web

### Composants

**10 composants d'animation** réutilisables :

- Même interface dans les 2 plateformes
- Implémentation différente (Reanimated vs Framer Motion)
- Disponibles dans : `app_chrono`, `driver_chrono`, `admin_chrono`
