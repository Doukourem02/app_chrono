# Tarification dynamique côté client (météo, circulation, embouteillages)

Document de **cadrage** — pas d’implémentation imposée par ce fichier. Il répond à : *comment le système **sait** qu’il y a embouteillage ou qu’il pleut ?*, puis pose un **modèle de prix** type BASE × CONTEXTE, aligné avec une logique proche Uber / Yango, **adaptable à Chrono**.

---

## 1. Principe

- Un même trajet (distance / engin) peut **coûter plus ou moins** selon le **coût réel** : temps, difficulté (trafic, météo), **tension du marché** (demande vs livreurs disponibles).
- Ce n’est **pas** uniquement `distance × tarif_km` sans tenir compte du contexte.

**Philosophie** : le prix doit refléter autant que raisonnable le **coût réel du trajet** pour la plateforme et le livreur, tout en restant **acceptable** pour le client (plafonds, transparence).

---

## 2. Comment le système « sait » qu’il y a embouteillage ?

### 2.1 À grande échelle (Google, Waze, Uber…) — pour la culture

Deux familles de signaux se **combinent** souvent chez les géants :

1. **Données agrégées des téléphones** (position, vitesse, direction) sur le réseau routier → estimation de vitesses réelles par segment, comparées à une **vitesse / durée de référence** → indice du type `vitesse_normale / vitesse_réelle` (ex. indice élevé = congestion).
2. **Moteurs d’itinéraires** qui intègrent déjà ces modèles et exposent des **durées** « typiques » vs « actuelles ».

**Important** : Chrono **ne reconstruit pas** ce réseau mondial de bout en bout.

### 2.2 Ce que Chrono fait concrètement (réaliste pour toi)

👉 **Tu ne calcules pas toi-même** l’embouteillage sur toute la ville.

👉 Tu **consommes** un fournisseur qui a déjà fusionné cartes + historique + (souvent) données temps réel, par exemple :

- **Mapbox Directions API** ;
- ou **Google Routes API** (selon choix stack).

**Exemple de signal utile** (selon les champs exacts du fournisseur) :

- `duration` (ou durée « sans trafic » / de référence) ;
- `duration_in_traffic` (ou équivalent : durée avec conditions actuelles).

**Indice simple côté « lecture »** :

```text
indice_durée = duration_in_traffic / duration
```

- proche de **1** → parcours « normal » ;
- **> 1,3** → ralentissement notable ;
- **> 2** → congestion forte (ordre de grandeur, à calibrer).

👉 **Ton appli** : appelle l’API, récupère les durées, **interprète** avec **ta** règle de prix (voir §4).

---

## 3. Comment le système « sait » qu’il pleut ?

👉 **Source principale** : une **API météo** externe (ex. OpenWeather, autre), avec **latitude / longitude** (pickup, milieu de trajet, ou zone).

Réponse typique : conditions (`rain`, `storm`, …), précipitations sur 1h, etc.

**Décision métier** (exemples à calibrer) :

- pluie légère → faible impact ou 0 ;
- pluie forte → bonus livreur / difficulté ;
- orage / alerte → coefficient plus élevé, **toujours borné**.

Chrono **ne détecte pas** la pluie par capteur interne : elle **lit** l’API météo.

---

## 4. Synthèse « ce que l’app ne fait pas / fait »

| Question | Réponse |
|----------|---------|
| L’app calcule-t-elle le trafic comme Waze ? | **Non** — elle s’appuie sur **Mapbox / Google** (ou équivalent). |
| L’app détecte-t-elle la pluie seule ? | **Non** — **API météo**. |
| Où est ton « cerveau » ? | Dans la **logique de prix** : combiner durées, météo, demande, heure, **plafonds**. |

---

## 5. Modèle d’algorithme cible (Chrono) — BASE × CONTEXTE

Version **structurée** pour une implémentation future (backend recommandé comme source de vérité).

### 5.1 Forme globale

```text
prix = (coût_distance + coût_temps) × facteur_contexte
```

- **`coût_distance`** : la distance compte (carburant, usure, logique métier).
- **`coût_temps`** : le **temps** compte surtout pour refléter **trafic et ralentissements** via une durée **réaliste** (idéalement **avec trafic**).

### 5.2 Étape 1 — Coût de base

```text
coût_distance = distance_km × tarif_km(mode)
coût_temps   = durée_minutes × tarif_minute(mode)
prix_base    = coût_distance + coût_temps
```

- **`durée_minutes`** : idéalement issue de **`duration_in_traffic`** (ou équivalent), pas seulement d’une durée théorique sans congestion.
- **Effet** : dès cette étape, une partie du **trafic** est **déjà** dans le prix (via le temps), sans multiplier artificiellement par un gros coefficient « trafic » en double.

### 5.3 Étape 2 — Facteurs contextuels (multiplicatifs)

#### A. Facteur trafic « subtil » (éviter double comptage)

Plutôt que `prix × gros_coeff_trafic` en plus du temps déjà gonflé, une approche cohérente :

```text
indice_trafic = durée_avec_trafic / durée_sans_trafic   (ou duration_in_traffic / duration)
facteur_trafic = clamp(indice_trafic, 1, 1.3)   -- exemple : petit boost seulement si anormal
```

Les bornes **1** et **1,3** sont **exemples** ; à ajuster en prod.

#### B. Facteur météo

À partir de l’API météo (seuils à définir), par exemple :

- pluie forte → **+10 %** (`× 1,10`) ;
- orage / conditions critiques → **+15 %** (`× 1,15`) ;
- sinon → `× 1`.

#### C. Facteur demande (surge) — important

Mesure du type :

```text
ratio = demandes_en_cours / livreurs_disponibles   (ou variante zone + engin)
```

Puis un **facteur_demande** croissant avec la tension (exemples) :

- ratio faible → `1` ;
- tension moyenne → entre `1` et `1,5` ;
- forte tension → jusqu’à `2` (ou plafonné avec le global §5.4).

C’est le levier **marché** (comme le surge Uber / Yango), **distinct** du pur trafic routier.

#### D. Facteur horaire

- heures de pointe → ex. **+10 %** ;
- nuit → ex. **+5 %** ;
- sinon → `1`.

*(À calibrer selon ton marché Abidjan / légal / communication client.)*

### 5.4 Fusion et sécurité (plafond global)

```text
facteur_contexte = facteur_demande × facteur_trafic × facteur_meteo × facteur_horaire
facteur_contexte = min(facteur_contexte, 2)   -- ou autre plafond produit
```

**Pourquoi** : éviter la perception d’**arnaque** et le rejet utilisateur si tout se cumule sans limite.

### 5.5 Formule finale rappel

```text
prix = (distance × tarif_km + durée_min × tarif_min) × facteur_contexte_plafonné
```

Elle modélise à la fois :

1. **Coût réel** (distance + temps, le temps captant déjà beaucoup du trafic) ;
2. **Difficulté** (météo, léger ajustement trafic si besoin) ;
3. **Marché** (demande vs offre).

---

## 6. Alignement avec la première version courte de ce document

La **v1** du fichier parlait surtout de « corréler le prix à la durée / trafic » et de **coefficients plafonnés** — c’est **compatible** avec le modèle ci-dessus.

| V1 (court) | Modèle détaillé (§5) |
|------------|----------------------|
| Durée avec trafic | Dans **`coût_temps`** + éventuellement **`facteur_trafic`** borné |
| Météo | **`facteur_meteo`** |
| Heure de pointe | **`facteur_horaire`** |
| Plafond | **`facteur_contexte ≤ 2`** (explicite) |
| *(manquait)* | **`facteur_demande` (surge)** — ajouté ici |

👉 Donc : **oui, on est alignés** ; ce document **enrichit** la v1 avec la **question “comment on sait”** (§2–3) et une **formule opérationnelle** (§5).

---

## 7. Exemple chiffré (illustratif)

- **Cas base** : 5 km, 10 min (durées cohérentes avec tarifs) → ex. **2000 FCFA** (à recalculer avec tes `tarif_km` / `tarif_min` réels).

- **Cas tendu** :  
  `facteur_trafic = 1,2`, `facteur_meteo = 1,1`, `facteur_demande = 1,5`  
  → `facteur_contexte = 1,2 × 1,1 × 1,5 = 1,98` (sous plafond 2).

- **Prix** ≈ `prix_base × 1,98` → ex. **~3960 FCFA** si la base était 2000.

---

## 8. Chaîne actuelle Chrono (rappel technique)

- Aujourd’hui : estimation / commande via **Mapbox** (app), **`createOrderRecord`**, socket **`create-order`**, backend **`calculatePrice`** / **`estimateDuration`**.
- Évolution : injecter **durée trafic**, **météo**, **métriques demande/offre**, persister les **paramètres** sur la commande (transparence, support, analytics).

---

## 9. Prochaines étapes (quand tu donneras l’ordre)

1. Choisir **fournisseur** itinéraire (déjà Mapbox côté app ?) et champs exacts `duration` / trafic.
2. Choisir **API météo** + grille de seuils.
3. Définir **comment mesurer** demande / livreurs disponibles (zone, engin, fenêtre temps).
4. Implémenter **backend** d’abord, puis UI client (estimation, libellés « trafic / météo / forte demande »).
5. Tests + **plafond** validé produit / juridique.

---

## 10. Lien avec le document livreur

- **`driver_chrono/docs/navigation-suivi-livreur.md`** : guidage réel sur la route.
- **Ce fichier** : **prix** cohérent avec **durée réelle** (trafic) et **contexte** (météo, marché).

Les durées « avec trafic » utilisées pour la **tarification** peuvent être les **mêmes familles de données** que celles qui rendent l’**ETA** crédible pour le client.
