# Composants d'Animations (Web)

Cette bibliothèque de composants d'animations utilise `framer-motion` pour créer des expériences utilisateur fluides et engageantes dans l'application web Next.js.

## Installation

Les dépendances sont déjà installées :
- `framer-motion` - Bibliothèque d'animations pour React

## Composants disponibles

### 1. AnimatedButton
Bouton avec animations de hover et click.

```tsx
import { AnimatedButton } from '@/components/animations'

<AnimatedButton
  onClick={() => console.log('Pressed')}
  variant="primary" // 'primary' | 'secondary' | 'outline'
>
  Cliquez-moi
</AnimatedButton>
```

**Props:**
- `onClick`: Fonction appelée au clic
- `variant`: Style du bouton ('primary', 'secondary', 'outline')
- `disabled`: Désactive le bouton
- `style`: Styles personnalisés (React.CSSProperties)

### 2. AnimatedCard
Carte avec animation d'apparition en cascade.

```tsx
import { AnimatedCard } from '@/components/animations'

<AnimatedCard index={0} delay={0} onClick={() => {}}>
  <div>Contenu de la carte</div>
</AnimatedCard>
```

**Props:**
- `index`: Index pour l'animation en cascade (défaut: 0)
- `delay`: Délai avant l'animation en ms (défaut: 0)
- `onClick`: Fonction optionnelle pour rendre la carte cliquable
- `style`: Styles personnalisés

### 3. SkeletonLoader
Indicateur de chargement avec effet shimmer.

```tsx
import { SkeletonLoader } from '@/components/animations'

<SkeletonLoader width="100%" height={180} borderRadius={22} />
```

**Props:**
- `width`: Largeur (nombre ou string)
- `height`: Hauteur en pixels (défaut: 20)
- `borderRadius`: Rayon des bordures (défaut: 8)
- `style`: Styles personnalisés

### 4. SuccessAnimation
Animation de succès avec icône de validation.

```tsx
import { SuccessAnimation } from '@/components/animations'

<SuccessAnimation
  size={80}
  color="#10B981"
  onAnimationComplete={() => console.log('Animation terminée')}
/>
```

**Props:**
- `size`: Taille de l'animation (défaut: 80)
- `color`: Couleur de fond (défaut: '#10B981')
- `onAnimationComplete`: Callback appelé à la fin de l'animation

### 5. ErrorAnimation
Animation d'erreur avec icône de fermeture.

```tsx
import { ErrorAnimation } from '@/components/animations'

<ErrorAnimation
  size={80}
  color="#EF4444"
  onAnimationComplete={() => console.log('Animation terminée')}
/>
```

**Props:**
- `size`: Taille de l'animation (défaut: 80)
- `color`: Couleur de fond (défaut: '#EF4444')
- `onAnimationComplete`: Callback appelé à la fin de l'animation

### 6. ScreenTransition
Transition fluide entre écrans.

```tsx
import { ScreenTransition } from '@/components/animations'

<ScreenTransition direction="fade" duration={0.4}>
  <div>Contenu de l'écran</div>
</ScreenTransition>
```

**Props:**
- `direction`: Direction de la transition ('left', 'right', 'up', 'down', 'fade')
- `duration`: Durée de l'animation en secondes (défaut: 0.3)
- `style`: Styles personnalisés

### 7. AnimatedBottomSheet
Bottom sheet avec animations spring et gestes de drag.

```tsx
import { AnimatedBottomSheet } from '@/components/animations'

<AnimatedBottomSheet
  visible={isVisible}
  onClose={() => setIsVisible(false)}
  height={400}
>
  <div>Contenu du bottom sheet</div>
</AnimatedBottomSheet>
```

**Props:**
- `visible`: Contrôle la visibilité
- `onClose`: Fonction appelée lors de la fermeture
- `height`: Hauteur du bottom sheet (défaut: 400)
- `style`: Styles personnalisés

### 8. FormValidationAnimation
Animation de validation de formulaire.

```tsx
import { FormValidationAnimation } from '@/components/animations'

<FormValidationAnimation
  isValid={emailIsValid}
  message="Email valide"
  show={showValidation}
/>
```

**Props:**
- `isValid`: État de validation (true/false)
- `message`: Message à afficher
- `show`: Contrôle la visibilité (défaut: true)

### 9. TrackingMarker
Marqueur animé pour le tracking en temps réel sur les cartes.

```tsx
import { TrackingMarker } from '@/components/animations'

<TrackingMarker
  latitude={48.8566}
  longitude={2.3522}
  color="#8B5CF6"
  size={40}
/>
```

**Props:**
- `latitude`: Latitude (optionnel, pour référence future)
- `longitude`: Longitude (optionnel, pour référence future)
- `color`: Couleur du marqueur (défaut: '#8B5CF6')
- `size`: Taille du marqueur en pixels (défaut: 40)

### 10. PullToRefreshIndicator
Indicateur de pull-to-refresh animé.

```tsx
import { PullToRefreshIndicator } from '@/components/animations'

<PullToRefreshIndicator
  progress={refreshProgress}
  refreshing={isRefreshing}
/>
```

**Props:**
- `progress`: Progression du pull (0-1)
- `refreshing`: État de rafraîchissement (true/false)

## Exemples d'utilisation

### Liste avec animations en cascade

```tsx
{items.map((item, index) => (
  <AnimatedCard key={item.id} index={index} delay={0}>
    <ItemCard item={item} />
  </AnimatedCard>
))}
```

### Écran avec transition

```tsx
<ScreenTransition direction="fade" duration={0.4}>
  <div>
    {/* Contenu de l'écran */}
  </div>
</ScreenTransition>
```

### Bouton avec feedback

```tsx
<AnimatedButton
  onClick={handleSubmit}
  variant="primary"
>
  Soumettre
</AnimatedButton>
```

## Notes techniques

- Toutes les animations utilisent `framer-motion` pour des performances optimales
- Les animations sont optimisées pour fonctionner à 60 FPS
- Les composants sont compatibles avec Next.js et React 19
- Tous les composants sont marqués avec `'use client'` pour le client-side rendering

## Performance

- Les animations sont exécutées sur le thread principal avec optimisations GPU
- Utilisation de `AnimatePresence` pour les animations d'entrée/sortie
- Les animations spring sont configurées pour être fluides et naturelles
- Support du drag & drop natif pour les composants interactifs

