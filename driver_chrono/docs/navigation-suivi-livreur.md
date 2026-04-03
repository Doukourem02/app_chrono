# Navigation livreur : suivi du mouvement réel (test vs production)

Document de **cadrage** — pas d’implémentation obligatoire tant qu’une décision produit / technique n’a pas été prise. Il décrit **comment** les apps type Uber / Yango suivent le véhicule, **comment ça colle** avec Chrono (Mapbox), et **comment** tester quand le téléphone ne bouge pas.

---

## 1. Ce que tu veux obtenir

- **En production** : l’itinéraire affiché et les consignes (tournez à droite, etc.) doivent **coller au déplacement réel** du livreur sur la route, pas « avancer » tout seul pendant que le livreur est encore loin.
- **En test** : si **client et livreur sont sur le même téléphone** (ou simulateur), **sans déplacement physique**, le GPS ne change presque pas → la navigation « réelle » ne peut pas progresser comme en voiture. Il faut alors soit **bouger** (marche, véhicule), soit utiliser un **mode simulation** **uniquement pour les tests**.

Ces deux besoins ne sont pas contradicteurs : on sépare **mode test** (simulation possible) et **mode production** (GPS réel, pas de simulation de trajet).

---

## 2. La logique type Uber / Yango — ce n’est **pas** un seul algorithme

Les grandes apps combinent **plusieurs briques**. Ce qui suit est le **modèle de référence** ; les éditeurs (Mapbox, Google) implémentent des variantes propriétaires, mais **l’idée** est la même.

### 2.1 Map matching — la brique la plus visible (souvent HMM ou équivalent)

Le GPS renvoie des points **bruités** (P1, P2, P3…). On ne peut pas les coller naïvement sur la carte.

- Beaucoup de systèmes s’appuient sur des modèles de type **Hidden Markov Model (HMM)** (ou méthodes proches) pour répondre à : *« sur **quelle** route suis-je le plus probablement ? »*
- **Intuition** : pour chaque mesure, on score les candidats (segments de route proches) avec quelque chose comme :
  - probabilité d’être **sur** cette route compte tenu du point GPS ;
  - **cohérence** avec la direction / le segment précédent.
- **Effet** : correction des erreurs GPS, moins de « sauts » entre routes parallèles, base d’un **suivi fluide**.

### 2.2 Projection sur la route (linear referencing)

Une fois le segment / la route la plus probable choisie :

- On **projette** la position sur la **polyline** de l’itinéraire (comme un point sur une ligne A—B—C—D).
- On en déduit la **distance déjà parcourue** le long de la route (ex. AB + une portion de BC), donc :
  - distance restante ;
  - enchaînement des **prochaines manœuvres** ;
  - **timing** des annonces.

### 2.3 Lissage : cap / vitesse + filtrage (ex. filtre de Kalman)

Le brut GPS « tremble ». On combine souvent :

- mesures GPS ;
- **vitesse**, **cap** (gyro / boussole quand dispo) ;
- **prédiction** du mouvement entre deux fixes ;

dans un **filtre** (Kalman ou équivalent) pour une position **plus stable** et un mouvement **plus naturel** à l’écran.

### 2.4 Progression sur l’itinéraire

Avec une position « propre » sur la route :

- on suit la **progression** (ex. fraction parcourue / distance restante le long de la ligne de guidage) ;
- les **instructions** sont déclenchées selon des **seuils** (ex. annonce à X m, action à Y m).

### 2.5 Recalcul (rerouting)

Si l’écart à la route dépasse un **seuil** (changement de voie, raccourci, erreur) :

- nouveau calcul de chemin sur le **graphe routier** (famille **Dijkstra / A\*** selon les contraintes et le moteur) ;
- nouvelle polyline de guidage, puis retour au cycle matching + projection + lissage.

### 2.6 Chaîne « à chaque tick » (synthèse)

En simplifiant à l’extrême :

**GPS brut → map matching (ex. logique HMM) → projection sur la polyline → filtrage / lissage → progression → seuils d’instructions → rerouting si hors route.**

C’est ce qui donne l’impression que l’app « suit exactement » le livreur : ce n’est pas la magie d’une seule formule, c’est **cette enchaînement**.

---

## 3. Est-ce que ça colle avec ce qui est écrit pour Chrono ? **Oui**

Le fichier initial parlait de **snap to route**, **progression**, **off-route rerouting** : c’est **exactement** la même **logique fonctionnelle**, exprimée en moins de détails mathématiques.

| Idée Uber / Yango (ci-dessus) | Version courte (doc précédent) |
|-------------------------------|----------------------------------|
| Map matching (HMM, etc.) | « Snap to route » / accrochage à la route |
| Projection sur la polyline | Progression le long de la ligne de guidage |
| Kalman / lissage | (non nommé avant) — fait partie du moteur natif |
| Seuils d’instructions | Arrivée / annonces à distance |
| Rerouting (A\*, etc.) | Recalcul quand hors itinéraire |

**Conclusion** : la description « Uber / Yango » que tu as collée **n’est pas en contradiction** avec le doc ; elle **précise** ce qu’il y a **sous le capot**.

---

## 4. Ce que Chrono utilise concrètement — tu n’as pas à coder HMM / Kalman / A\*

L’app livreur s’appuie sur **Mapbox Navigation** (`@fleetbase/react-native-mapbox-navigation` → SDK natif Mapbox).

- C’est **Mapbox** qui embarque la chaîne **map matching, progression, rerouting, timing des instructions**, etc. (implémentation propriétaire, pas forcément documentée ligne à ligne comme HMM public).
- **React / ton code métier** ne refait pas cette pile : tu fournis **origine / destination**, tu reçois **événements** (progression, arrivée, erreurs).

### 4.1 Rôle des props `origin` / `destination`

- Surtout pour le **premier** calcul d’itinéraire et les **recalculs** quand la session est (re)créée ou quand la destination change (ex. pickup → dropoff).
- Une fois la session lancée, le **déplacement du curseur / de la progression** vient du **flux de localisation du SDK**, pas d’un `setState` React à chaque seconde.

### 4.2 Simulation (`shouldSimulateRoute`)

- **`false` (production)** : pas de trajet simulé — le moteur s’aligne sur le **GPS réel** (donc sans mouvement réel, peu de progression : normal).
- **`true`** : utile **simulateur / tests sans bouger** ; à **ne pas** activer pour un livreur réel sur route.

---

## 5. Pourquoi en test « même téléphone » ça bloque sans bouger

- Avec **`shouldSimulateRoute = false`** et GPS figé, le comportement attendu est : **pas** de faux avancement.
- Pour un scénario **E2E sans déplacement** : simulation **dev**, **deux téléphones**, ou **position simulée** (Xcode / Android).

---

## 6. Ce qu’on pourra « mettre en place » plus tard (ordre à venir)

| Sujet | Idée |
|--------|------|
| **Production** | `shouldSimulateRoute={false}` explicite, éventuellement garde-fous en build release. |
| **Dev / démo** | Flag pour activer la simulation **uniquement** en test. |
| **Pickup → dropoff** | Cohérence du recalcul natif (`reEmbedWithNewDestination`, etc.). |
| **Arrivée trop tôt** | Ajuster seuils SDK si possible + **géofencing** métier déjà dans l’app. |

---

## 7. Résumé

- **Oui** : la logique HMM + projection + lissage + seuils + rerouting **colle** avec ce que fait une navigation pro ; le texte initial était une **version courte** de la même chose.
- **Chrono** : **Mapbox Navigation SDK** porte cette complexité ; **pas** besoin d’implémenter ces algorithmes dans ton code React.
- **Prod** = GPS réel + pas de simulation ; **test sans bouger** = simulation ou outils de localisation fictive.

Ce fichier reste la **référence** pour les évolutions produit ; l’ordre d’implémentation viendra quand tu le décideras.
