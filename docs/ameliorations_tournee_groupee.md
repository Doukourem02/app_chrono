# Améliorations — Tournée groupée (flux livreur)

## 1. Supprimer l'écran intermédiaire "Point de collecte"
L'écran actuel (icône + adresse + 2 boutons) doit disparaître.  
Cet espace est réservé à la liste des commandes de la tournée.

## 2. Navigation automatique au démarrage
Dès que le livreur accepte la tournée, la navigation vers le point de collecte démarre automatiquement.  
Annonce vocale au démarrage : **"Commande groupée prise en charge, nous pouvons entamer la course."**

## 3. Bouton de collecte via geofencing uniquement
Le bouton de collecte n'apparaît **que** quand le geofencing détecte l'arrivée au point de collecte.  
Pas de bouton manuel accessible avant.

## 4. Style du bouton de collecte dans la navigation
- Bouton violet, positionné directement sur la carte (en bas ou en haut)
- **Pas de fond blanc** derrière le bouton (le fond blanc cache les infos de la carte)
- Juste le bouton, seul, flottant sur la map

## 5. Synchronisation ETA — Dynamic Island
Le Dynamic Island affiche un ETA désynchronisé (ex. "5 min" alors que la nav montre "3 min").

**Cause :** Dans `batch/[batchId].tsx`, `handlePickupRouteProgressChange` et `handleRouteProgressChange` ne mettent à jour ni `lastEtaMinutes` ni `latestNavigationProgressRef` — contrairement aux livraisons classiques dans `index.tsx` (lignes 768-778) qui synchronisent ces valeurs à chaque tick Mapbox.

**Fix :** S'inspirer du pattern de `index.tsx` : à chaque `durationRemaining` reçu de Mapbox dans la tournée, mettre à jour le batch store avec l'ETA courant, et faire lire cette valeur par le composant du Dynamic Island dans `index.tsx`.

## 6. Libellé du bouton
À définir (en attente de validation).

## 6. Langue de la navigation Mapbox
Les instructions Mapbox s'affichent en anglais ("Adjust Volume to Hear Instructions").  
La navigation doit être en **français** — l'app est utilisée en Côte d'Ivoire.

## 7. Supprimer l'alerte "Arrêt suivant"
Après validation d'une livraison, l'Alert "Naviguer vers X ?" doit être supprimée.  
Le livreur sait qu'il doit enchaîner les arrêts — pas besoin de confirmation.

## 8. Retour à l'accueil après tournée terminée
Quand le livreur clique "Retour à l'accueil" depuis l'écran de fin de tournée :
- La map doit revenir à son état normal (sans tracé de tournée)
- Le bouton "Tournée · 0 restant(s)" en haut de la map doit disparaître — s'il n'y a pas de tournée active, il ne doit pas s'afficher
- Le store de la tournée doit être vidé/réinitialisé
