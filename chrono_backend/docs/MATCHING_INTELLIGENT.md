# 🎯 Matching ÉQUITABLE - Documentation

## Vue d'ensemble

Le **Matching Équitable** garantit que **TOUS les livreurs disponibles** reçoivent des commandes de manière équitable. La priorité d'envoi est basée uniquement sur les **notes (ratings)** des livreurs.

## Principe d'Équité TOTALE

✅ **TOUS les livreurs reçoivent la commande** : Pas de sélection, pas de limite  
✅ **Priorité basée sur les notes** : Les livreurs avec meilleures notes sont envoyés en premier  
✅ **Bonus équité** : Les livreurs moins sollicités récemment reçoivent un bonus de priorité  
✅ **Pas de discrimination** : Tous les livreurs ont des chances égales  

## Fonctionnement

### Algorithme de Priorité SIMPLE

Le score de priorité est calculé selon **2 critères uniquement** :

| Critère | Poids | Description |
|---------|-------|-------------|
| **Notes (Rating)** | 70% | Note moyenne donnée par les clients (0-5) |
| **Équité** | 30% | Bonus pour les livreurs moins sollicités récemment |

### Calcul du Score de Priorité

```typescript
priorityScore = (ratingScore × 0.7) + (fairnessScore × 0.3)
```

- **Rating** : Note moyenne normalisée (0-5 → 0-1) × 70%
- **Équité** : Bonus pour livreurs moins sollicités × 30%

### Score d'Équité

Le score d'équité favorise les livreurs moins sollicités :
- **Livreur avec 0 commande récente** : Score max (1.0)
- **Livreur avec < 50% de la moyenne** : Score max (1.0)
- **Livreur avec > 200% de la moyenne** : Score min (0.0)
- **Interpolation linéaire** entre ces valeurs

### Distribution des Commandes

- **TOUS les livreurs disponibles** reçoivent la commande (pas de limite)
- La commande est envoyée séquentiellement dans l'ordre de priorité :
  1. Livreur avec meilleure note + bonus équité
  2. Livreur avec bonne note + bonus équité
  3. ... et ainsi de suite pour TOUS les livreurs
- Si aucun n'accepte, la commande reste en `pending`
- **Équité garantie** : Tous les livreurs ont des chances égales

## Avantages

✅ **ÉQUITÉ TOTALE** : TOUS les livreurs reçoivent des commandes (pas de sélection)  
✅ **Pas de discrimination** : Aucun livreur n'est exclu  
✅ **Priorité simple** : Basée uniquement sur les notes (facile à comprendre)  
✅ **Rotation automatique** : Les livreurs moins sollicités reçoivent un bonus de priorité  
✅ **Chances égales** : Tous les livreurs ont la même opportunité de recevoir des commandes  
✅ **Transparence** : Système simple et compréhensible  

## Configuration

### Activation/Désactivation

Par défaut, le matching intelligent est **activé**. Pour le désactiver :

```bash
# Dans .env
USE_INTELLIGENT_MATCHING=false
```

### Debug

Pour voir les scores calculés en temps réel :

```bash
# Dans .env
DEBUG_SOCKETS=true
```

Les logs afficheront :
- Le score de chaque livreur
- Les détails du calcul (distance, acceptance, rating, load)
- Les top 3 sélectionnés

## Exemple de Logs

```
[OrderMatchingService] 🎯 Calcul priorité ÉQUITABLE pour 8 livreurs (TOUS recevront la commande)
[OrderMatchingService] abc123...: priority=0.756, rating=4.8/5, recent=5 commandes, distance=2.3km
[OrderMatchingService] def456...: priority=0.842, rating=4.6/5, recent=1 commandes, distance=4.1km (BONUS ÉQUITÉ)
[OrderMatchingService] ghi789...: priority=0.789, rating=4.5/5, recent=0 commandes, distance=5.2km (BONUS ÉQUITÉ)
[OrderMatchingService] ✅ TOUS les 8 livreurs recevront la commande (triés par priorité):
  1. def456...: priority=0.842, rating=4.6/5, recent=1 commandes (BONUS ÉQUITÉ)
  2. ghi789...: priority=0.789, rating=4.5/5, recent=0 commandes (BONUS ÉQUITÉ)
  3. abc123...: priority=0.756, rating=4.8/5, recent=5 commandes
  ... (tous les 8 livreurs)
```

## Fichiers Modifiés

1. **`src/utils/orderMatchingService.ts`** (nouveau)
   - Service de matching intelligent
   - Calcul des scores
   - Récupération des stats livreurs

2. **`src/sockets/orderSocket.ts`** (modifié)
   - Intégration du matching dans `notifyDriversForOrder`
   - Intégration du matching dans `create-order`
   - Fallback sur tri par distance si erreur

## Tests

Pour tester le matching intelligent :

1. **Créer plusieurs livreurs** avec différents profils :
   - Livreur proche mais faible rating
   - Livreur loin mais excellent rating
   - Livreur avec beaucoup de commandes actives

2. **Créer une commande** et observer les logs

3. **Vérifier** que les top 3 sont bien sélectionnés selon le score

## Prochaines Améliorations

- [ ] Ajustement dynamique des poids selon le contexte
- [ ] Prise en compte des préférences livreurs (zones préférées)
- [ ] Machine Learning pour optimiser les poids
- [ ] Cache des stats livreurs pour performance

---

**Date d'implémentation** : 2025-01-XX  
**Version** : 1.0  
**Statut** : ✅ Actif par défaut

