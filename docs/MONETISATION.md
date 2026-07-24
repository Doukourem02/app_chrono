# Monétisation KRONO — Documentation complète

> Fichier de référence unique sur tous les flux d'argent de la plateforme.
> Mis à jour : 2026-05-15

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Grille tarifaire de base](#2-grille-tarifaire-de-base)
3. [Options de vitesse (Speed Options)](#3-options-de-vitesse-speed-options)
4. [Tarification dynamique (niveau C)](#4-tarification-dynamique-niveau-c)
   - 4.1 Prime temps / trafic
   - 4.2 Facteur météo
   - 4.3 Facteur surge (forte demande)
   - 4.4 Facteur heure de pointe
   - 4.5 Facteur trafic Mapbox
   - 4.6 Plafond contextuel
5. [Supplément B2B](#5-supplément-b2b)
6. [Commission partenaire B2B](#6-commission-partenaire-b2b)
   - 6.1 Sans abonnement
   - 6.2 Avec abonnement (plans)
   - 6.3 Quota mensuel
   - 6.4 Ce que vend vraiment le forfait B2B
   - 6.5 Acquisition B2B : pourquoi payer Krono ?
7. [Rémunération des livreurs](#7-rémunération-des-livreurs)
   - 7.1 Principe : revenu Krono ≠ gain livreur
   - 7.2 Livreur externe avec moto personnelle
   - 7.3 Livreur équipé par une moto Krono
   - 7.4 B2B, tournées et hors-ligne
   - 7.5 Partenaire avec livreur de confiance
8. [Formule complète du prix final](#8-formule-complète-du-prix-final)
9. [Exemples chiffrés](#9-exemples-chiffrés)
10. [Décisions finales et implémentation](#10-décisions-finales-et-implémentation)
11. [Fichiers sources](#11-fichiers-sources)

---

## 1. Vue d'ensemble

KRONO génère ses revenus et rémunère les livreurs via plusieurs flux distincts. Il faut séparer **ce que le client paie**, **ce que Krono garde**, et **ce que le livreur gagne réellement**.

| Flux | Qui paie | Qui perçoit | Mécanisme |
|---|---|---|---|
| **Prix livraison client** | Client final ou partenaire B2B | KRONO | Tarif dynamique au km, puis partage entre livreur et Krono selon le type de livreur |
| **Abonnement B2B** | Partenaire | KRONO | Forfait mensuel Starter / Pro / Business |
| **Frais de service B2B** | Partenaire | KRONO | % ajouté au prix livraison selon plan et quota |
| **Mode gestion interne B2B** | Partenaire | KRONO | Le partenaire utilise son propre livreur, Krono vend la traçabilité, le portail et les preuves |
| **Commission livreur externe** | Livreur avec sa propre moto | KRONO | Prélèvement sur solde prépayé |
| **Part Krono sur moto Krono** | Incluse dans le prix livraison | KRONO | Reste après paiement de la part livreur |

Décision importante : un livreur peut générer du chiffre d'affaires pour Krono sans être salarié. Dans ce cas, il est payé **à la course**. Le salariat mensuel reste un modèle futur, pas le modèle de démarrage.

---

## 2. Grille tarifaire de base

Source : `krono_backend/src/services/priceCalculator.ts`

Seule la **moto** est active en production. Véhicule et cargo sont désactivés.

| Méthode | Forfait de base | Par km |
|---|---|---|
| `moto` | **500 FCFA** | **200 FCFA/km** |
| `vehicule` *(inactif)* | 800 FCFA | 300 FCFA/km |
| `cargo` *(inactif)* | 1 200 FCFA | 450 FCFA/km |

**Formule de base :**
```
lineSubtotalCfa = forfait + (distanceKm × perKm)
```

**Exemples moto :**
| Distance | Calcul | Prix base |
|---|---|---|
| 2 km | 500 + (2 × 200) | 900 FCFA |
| 5 km | 500 + (5 × 200) | 1 500 FCFA |
| 10 km | 500 + (10 × 200) | 2 500 FCFA |
| 15 km | 500 + (15 × 200) | 3 500 FCFA |

---

## 3. Options de vitesse (Speed Options)

Le `speedOptionId` remplace le forfait de base par un forfait spécifique.
Si aucun ID n'est passé, le **défaut** s'applique automatiquement.

**Défauts par méthode :**
- Moto → `express`
- Véhicule → `pickup_service`

**Grille des forfaits par option :**

| speedOptionId | Moto | Véhicule |
|---|---|---|
| `express` *(défaut moto)* | **400 FCFA** | — |
| `standard` | 350 FCFA | — |
| `scheduled` | 380 FCFA | — |
| `pickup_service` *(défaut véhicule)* | — | 700 FCFA |
| `full_service` | — | 1 000 FCFA |

> En pratique, une livraison moto express de 5 km = **400 + (5 × 200) = 1 400 FCFA** de base (et non 1 500 FCFA avec le forfait brut).

---

## 4. Tarification dynamique (niveau C)

Source : `krono_backend/src/services/dynamicPricing.ts`

Le prix de base est multiplié par un **facteur contextuel combiné**, plafonné à **×1.85**.

### 4.1 Prime temps / trafic

Si la durée route réelle (Mapbox) dépasse la durée théorique estimée, une prime par minute est ajoutée **avant** les facteurs contextuels.

**Taux par minute supplémentaire :**
| Méthode | FCFA/min |
|---|---|
| Moto | 12 FCFA |
| Véhicule | 15 FCFA |
| Cargo | 18 FCFA |

```
timePremiumCfa = max(0, minutesRéelles - minutesThéoriques) × tauxMinute
subtotalBeforeContext = lineSubtotal + timePremium
```

### 4.2 Facteur météo

Source : `krono_backend/src/services/openMeteoPricing.ts`

Interroge l'API **Open-Meteo** (sans clé, gratuite) en temps réel aux coordonnées du pickup.

| Condition | Facteur météo |
|---|---|
| Temps clair | ×1.00 |
| Bruine légère (code 51-57) | ×1.05 |
| Pluie modérée (code 61-67) | ×1.08 |
| Précipitations ≥ 0.8 mm | ×1.08 |
| Averses (code 80-86) | ×1.10 |
| Précipitations ≥ 3 mm | ×1.12 |
| Orage / grêle (code ≥ 95) | ×1.15 |

En cas d'échec API (timeout 2.2 s, réseau) : facteur = **1** (pas de majoration).

### 4.3 Facteur surge (forte demande)

Source : `krono_backend/src/services/surgePricing.ts`

Basé sur la tension live : **commandes en attente / livreurs connectés** (données socket temps réel).

```
ratio = pendingOrders / max(1, onlineDrivers)
bump  = min(0.55, ratio × 0.14)
surgeFactor = min(1.55, 1 + bump)
```

**Exemples :**
| Commandes en attente | Livreurs connectés | Ratio | Facteur surge |
|---|---|---|---|
| 0 | 4 | 0 | ×1.00 |
| 4 | 4 | 1.0 | ×1.14 |
| 10 | 4 | 2.5 | ×1.35 |
| 20 | 4 | 5.0 | ×1.55 (plafonné) |

### 4.4 Facteur heure de pointe

Heure locale Abidjan (UTC+0, pas de changement d'heure en Côte d'Ivoire).

| Plage horaire | Facteur |
|---|---|
| 7h–9h et 17h–20h (heures de pointe) | ×1.06 |
| 22h–5h (nuit) | ×1.04 |
| Reste de la journée | ×1.00 |

### 4.5 Facteur trafic Mapbox

Calculé à partir du rapport entre la durée route réelle et la durée "typique" fournie par Mapbox.

```
ratio = durationRéelle / durationTypique
raw   = 1 + (ratio - 1) × 0.45
trafficFactor = min(1.22, max(1, raw))
```

Si ratio ≤ 1 (trafic fluide) → facteur = 1.

### 4.6 Plafond contextuel

Tous les facteurs sont multipliés, puis plafonnés :

```
contextFactorRaw     = météo × surge × heure × trafic
contextFactorApplied = min(1.85, max(1, contextFactorRaw))
```

Le plafond **×1.85** protège le client d'une addition trop élevée en cas de conditions cumulées extrêmes.

---

## 5. Supplément B2B

Source : `krono_backend/src/services/dynamicPricing.ts`

Toute commande passée via un partenaire (`partner_id` présent) est considérée **B2B prioritaire** et bénéficie de services supplémentaires (QR code de livraison, portail partenaire, notification prioritaire des livreurs, etc.).

**Deux composantes B2B s'ajoutent au prix :**

| Composante | Valeur | Appliquée |
|---|---|---|
| Facteur priorité (`B2B_PRIORITY_FACTOR`) | ×1.15 | Avant l'arrondi, sur le subtotal × contexte |
| Supplément fixe (`B2B_FIXED_SURCHARGE_CFA`) | +99 FCFA | Après le facteur contextuel, flat (non amplifié) |

```
prixAvantArrondi = subtotalBeforeContext × contextFactorApplied × 1.15 + 99
totalCfa         = round25(prixAvantArrondi)
```

Le supplément fixe est **intentionnellement flat** : il n'est pas multiplié par la météo ou le surge. C'est un forfait service prévisible pour le partenaire.

**Impact concret (moto express, 5 km, conditions normales) :**
| | B2C | B2B |
|---|---|---|
| Base (express) | 1 400 FCFA | 1 400 FCFA |
| × facteur priorité | — | × 1.15 → 1 610 FCFA |
| + supplément fixe | — | +99 FCFA |
| **Total arrondi** | **1 400 FCFA** | **~1 725 FCFA** |

Soit environ **+23% par rapport au B2C** en conditions normales.

---

## 6. Commission partenaire B2B

Source : `krono_backend/src/services/b2bCommissionService.ts`

La commission est calculée **après** le prix dynamique et ajoutée au `finalPrice` retourné au partenaire. Elle est propre à chaque partenaire et à son plan d'abonnement.

### 6.1 Sans abonnement

Si le partenaire n'a pas d'abonnement actif (`is_active = true`, `payment_status = 'active'`), le taux est lu directement dans la table `partners.commission_rate`.

```
finalPrice = totalCfa + round(totalCfa × commission_rate)
type = 'no_subscription'
```

### 6.2 Avec abonnement (plans)

#### État technique actuel

Le backend actuel applique trois plans d'abonnement, avec deux paliers de taux chacun :

| Plan | Taux in-quota | Taux excess (hors quota) |
|---|---|---|
| `starter` | **3%** | Taux `excess_commission_rate` de la DB |
| `pro` | **2%** | Taux `excess_commission_rate` de la DB |
| `business` | **0%** | Taux `excess_commission_rate` de la DB |

- **In-quota** : le partenaire n'a pas encore dépassé son quota mensuel de commandes → taux préférentiel
- **Excess** : quota dépassé → `excess_commission_rate` défini dans `partner_subscriptions`

**Le taux in-quota = excess_commission_rate − 3%** (écart constant qui récompense le quota).

Point critique : cette grille actuelle crée un écart trop faible sur les petites courses. Sur une livraison à 1 725 FCFA, quelques points de pourcentage ne suffisent pas toujours à convaincre un partenaire de passer à Pro ou Business. Elle est donc considérée comme **ancienne grille technique**, à remplacer.

#### Grille commerciale cible validée

| Plan | In-quota | Hors quota | Lecture commerciale |
|---|---:|---:|---|
| Paiement à la course | 12% + 150 FCFA | idem | Test sans engagement, mais coût unitaire élevé |
| Starter | 8% + 100 FCFA | 12% + 100 FCFA | Petit volume, premier niveau structuré |
| Pro | 5% + 50 FCFA | 8% + 50 FCFA | Usage régulier, portail et équipe |
| Business | 0% | 5% | Fort volume, meilleur coût unitaire |

Simulation sur une course B2B à 1 725 FCFA, in-quota :

| Plan | Frais | Total payé |
|---|---:|---:|
| Paiement à la course | 357 FCFA | 2 082 FCFA |
| Starter | 238 FCFA | 1 963 FCFA |
| Pro | 136 FCFA | 1 861 FCFA |
| Business | 0 FCFA | 1 725 FCFA |

Cette version rend la différence plus visible, surtout sur les petites courses. C'est la grille à implémenter dans le backend, l'app client, l'admin et le portail partenaire.

### 6.3 Quota mensuel

Le quota est compté par mois calendaire (1er du mois). À chaque commande B2B créée avec succès, le compteur est incrémenté de manière **atomique** (upsert SQL sans race condition) :

```sql
INSERT INTO partner_usage (partner_id, month, deliveries_count)
VALUES ($1, $2, 1)
ON CONFLICT (partner_id, month)
DO UPDATE SET deliveries_count = partner_usage.deliveries_count + 1
```

**Exemple cible — partenaire plan Starter, quota 35 commandes :**

| Statut | Taux | Prix livraison | Commission | Prix final |
|---|---|---|---|---|
| 30ème commande (in-quota) | 8% + 100 | 1 725 FCFA | 238 FCFA | 1 963 FCFA |
| 36ème commande (hors quota) | 12% + 100 | 1 725 FCFA | 307 FCFA | 2 032 FCFA |

### 6.4 Ce que vend vraiment le forfait B2B

Le forfait B2B ne doit pas être présenté comme "payer pour payer plus cher". Il vend d'abord un **système de gestion de livraison**, puis seulement ensuite une réduction des frais de service.

Le partenaire paie toujours le transport quand Krono effectue la livraison. Le quota du forfait signifie : nombre de livraisons du mois où le partenaire bénéficie du taux B2B réduit. Il ne signifie pas "livraisons gratuites".

| Élément | Sans Krono | Avec Krono |
|---|---|---|
| Suivi client | Appels WhatsApp, captures, incertitude | Tracking, statuts, lien public, historique |
| Preuve de livraison | Dépend du livreur | QR code, code de livraison, preuve horodatée |
| Gestion livreurs | Informelle, difficile à contrôler | Livreurs dédiés, opt-in B2B, fallback automatique |
| Facturation | Carnet, Excel, conversations | Factures, quota, historique commandes |
| Litiges | Parole contre parole | Trace commande, heure, destinataire, preuve |
| Continuité service | Si le livreur perso est absent, tout bloque | Krono peut prendre le relais avec ses livreurs |

Donc la promesse commerciale n'est pas seulement "Krono livre". La promesse est :

> Krono transforme les livraisons du partenaire en activité traçable, pilotable et présentable au client final.

### 6.5 Acquisition B2B : pourquoi payer Krono ?

Problème terrain : beaucoup de commerçants à Abidjan livrent déjà avec leurs propres moyens. Ils peuvent payer 1 500 à 3 000 FCFA selon la commune, sans abonnement ni logiciel. Si Krono ajoute seulement un abonnement + une commission, l'intérêt n'est pas évident.

Il faut donc vendre Krono en trois portes d'entrée :

| Offre d'entrée | Cible | Ce que le partenaire comprend |
|---|---|---|
| **Découverte sans abonnement** | Petit e-commerce, volume irrégulier | Je paie à la course, je teste Krono sans engagement |
| **Gestion interne** | B2B avec son propre livreur | Je garde mon livreur, mais Krono me donne tracking, preuve, historique, portail |
| **Krono Backup** | B2B avec pics ou absence livreur | Si mon livreur est indisponible, Krono trouve un livreur et facture le transport |

Recommandation commerciale MVP :
- Offrir 14 à 30 jours d'essai portail pour les B2B sérieux.
- Offrir les frais de service sur les 10 premières livraisons, mais jamais le prix transport si Krono livre.
- Laisser le partenaire ajouter ou demander son propre livreur dédié.
- Mettre en avant le coût caché de son système actuel : appels, pertes, litiges, absence de preuve, client qui demande "mon colis est où ?".
- Vendre Starter comme "test structuré", Pro comme "gestion quotidienne", Business comme "fort volume + meilleure traçabilité + meilleur taux".

Point de cohérence produit : le backend actuel applique Starter **3%**, Pro **2%**, Business **0%** en quota. Certains écrans/docs affichent encore Starter **5%**, Pro **3%**, Business **2%**. La source de vérité finale devient la **grille commerciale cible validée** ci-dessus.

---

## 7. Rémunération des livreurs

Sources actuelles :
- `krono_backend/src/services/commissionService.ts` pour le modèle livreur externe prépayé
- `krono_backend/src/controllers/driverController.ts` et `driver_krono/app/(tabs)/revenus.tsx` pour l'affichage des gains
- modèle moto Krono : **décision produit à implémenter** (pas encore persistée comme gain net réel)

### 7.1 Principe : revenu Krono ≠ gain livreur

Le prix d'une livraison ne doit pas être confondu avec le revenu du livreur.

```
prix_course = montant payé par le client ou le partenaire
gain_livreur = part calculée selon le type de livreur
marge_krono_course = prix_course - gain_livreur
revenu_krono_total = marge_krono_course + abonnements_B2B + frais_service_B2B + commissions_livreurs_externes
```

Aujourd'hui, certains écrans additionnent encore le prix complet des commandes comme "gains" du livreur. C'est utile pour un brouillon opérationnel, mais ce n'est pas suffisant pour la comptabilité réelle. Il faudra stocker un vrai `driver_earning_cfa` par commande complétée.

### 7.2 Livreur externe avec moto personnelle

Ce modèle existe déjà dans le code.

Les livreurs partenaires alimentent un **solde prépayé** (`commission_balance`). À chaque livraison complétée, la commission est **déduite automatiquement** de ce solde via la fonction SQL `deduct_commission`.

**Blocage automatique :**
- Solde ≤ 0 → compte **suspendu**, plus de nouvelles commandes assignées
- Solde ≤ 1 000 FCFA → alerte "solde très faible"
- Solde ≤ 3 000 FCFA → alerte "solde faible"

**Taux de commission livreur actuel :** défini par `commission_rate` dans `commission_balance`, initialisé à **10%** par défaut à la création du profil.

Décision recommandée : passer le taux cible à **12%** pour rester acceptable pour les livreurs externes tout en améliorant légèrement la marge Krono. Le taux technique actuel de 10% peut rester temporairement pour le lancement, puis évoluer vers 12%.

```
commissionAmount = round(orderPrice × commissionRate)
driverNetEarning = orderPrice - commissionAmount
newBalance = balance - commissionAmount
```

Si le solde devient insuffisant : la livraison n'est **pas bloquée** (non-bloquant) mais le compte est suspendu pour les commandes suivantes.

**Exemple :**
- Course à 1 400 FCFA
- Commission Krono recommandée 12% = 168 FCFA
- Gain net économique du livreur = 1 232 FCFA
- Krono gagne 168 FCFA sur cette course via la commission livreur

### 7.3 Livreur équipé par une moto Krono

Ce modèle répond au cas de démarrage : Krono achète des motos, les confie à des travailleurs, mais ne verse pas encore de salaire mensuel fixe.

Le livreur équipé Krono est payé **à la course**, sur une part du prix livraison. Il ne recharge pas un solde commission comme le livreur externe ; au contraire, Krono lui doit une part de chaque livraison complétée.

**Hypothèse MVP recommandée :**

| Type de course | Base de calcul | Part livreur | Part Krono |
|---|---:|---:|---:|
| Livraison classique B2C | `totalCfa` | 35% | 65% |
| Livraison hors-ligne admin | `totalCfa` | 35% | 65% |
| B2B individuel | `serverPrice` avant frais de service B2B | 35% | 65% + frais B2B |
| Tournée B2B groupée | Somme des `serverPrice` des commandes du batch | 30% | 70% + frais B2B |

La part Krono sert à absorber : achat/amortissement moto, assurance, entretien lourd, support, risque d'impayé, outils, marge. La part livreur doit couvrir son effort de livraison et, selon la politique retenue, son carburant quotidien.

Le taux livreur est donc volontairement inférieur à la part Krono quand la moto appartient à Krono. Si le livreur vient avec sa propre moto, le modèle inverse s'applique : le livreur garde l'essentiel et Krono prélève seulement une commission.

**Option de démarrage conseillée :**
- Krono fournit la moto, les papiers et l'entretien lourd.
- Le livreur prend en charge le carburant courant avec sa part.
- Si Krono prend aussi en charge le carburant, la part livreur doit être plus basse ou un budget carburant doit être tracé séparément.

Formule :

```
payoutBase = prix transport partageable
driverEarning = round(payoutBase × driverShareRate)
kronoDeliveryMargin = payoutBase - driverEarning
```

Exemple B2C :

```
totalCfa = 1 400
driverShareRate = 35%
driverEarning = 490 FCFA
kronoDeliveryMargin = 910 FCFA
```

Exemple B2B Starter :

```
serverPrice = 1 725
fraisServiceB2B = 52
finalPricePartenaire = 1 777
driverEarning = round(1 725 × 35%) = 604 FCFA
kronoDeliveryMargin = 1 121 FCFA
revenuKronoSurCommande = 1 121 + 52 = 1 173 FCFA
```

Les abonnements B2B mensuels ne sont pas partagés avec le livreur. Ils rémunèrent l'accès au portail, le quota, la facturation, la priorité et le service partenaire.

Important : "Business = 0%" veut dire **0% de frais de service B2B ajouté à la course dans le quota**, pas "0 FCFA pour Krono". Krono conserve toujours sa part sur le prix transport, puis ajoute le revenu de l'abonnement mensuel.

### 7.4 B2B, tournées et hors-ligne

**B2B portail partenaire :** le livreur gagne de l'argent comme sur une course normale : une part du prix transport. L'abonnement Starter / Pro / Business et les frais de service B2B restent des revenus Krono.

**Tournées B2B groupées :** le livreur ne doit pas être payé comme s'il faisait un seul petit trajet. Le calcul doit partir de la somme des commandes du batch, avec un taux de partage dédié ou un minimum garanti par tournée. Exemple :

```
batchPayoutBase = somme(serverPrice des commandes du batch)
driverBatchEarning = round(batchPayoutBase × 30%)
```

**Hors-ligne / opérateur admin :** si la commande est créée par l'admin sans `partner_id`, elle doit être traitée comme une livraison classique pour la rémunération livreur. Si c'est une vraie commande B2B hors-ligne, il faut la rattacher à un `partner_id` pour appliquer abonnement, quota, frais B2B et reporting partenaire.

**Point produit à corriger :** dans le flux admin actuel, `isB2BOrder` marque la commande comme B2B pour l'affichage livreur, mais ne suffit pas à déclencher toute la logique abonnement/quota si aucun `partner_id` n'est rattaché.

### 7.5 Partenaire avec livreur de confiance

C'est un cas stratégique pour différencier Krono de Yango : le partenaire peut venir avec un livreur qu'il connaît déjà, qui a l'habitude de faire ses livraisons et en qui il a confiance.

Le terme "livreur personnel" ne veut pas forcément dire "salarié du partenaire payé hors Krono". Il peut simplement vouloir dire : livreur recommandé / habituel / prioritaire pour ce partenaire.

| Cas | Sens métier | Ce que paie le partenaire | Qui paie le livreur ? |
|---|---|---|---|
| **Livreur recommandé intégré Krono** | Le partenaire connaît le livreur, Krono le vérifie et le rattache au compte | Prix transport + frais B2B selon plan | Krono, via le modèle livreur correspondant |
| **Livreur payé hors Krono** | Le partenaire utilise Krono seulement comme outil de suivi/preuve | Abonnement + frais plateforme/preuve selon quota | Le partenaire, hors Krono |
| **Fallback Krono** | Le livreur recommandé est indisponible, Krono cherche un autre livreur | Prix transport + frais B2B selon plan | Krono, selon le livreur qui exécute |

Règle métier recommandée :
- Si la course est créée, suivie et encaissée dans Krono, le livreur qui exécute doit avoir une rémunération dans Krono, même s'il a été recommandé par le partenaire.
- Si ce livreur vient avec sa propre moto, il suit le modèle **livreur externe** : il garde l'essentiel de la course et Krono prélève une commission.
- Si Krono lui fournit une moto, il suit le modèle **moto Krono** : partage de revenus à la course.
- Si le partenaire paie réellement le livreur hors Krono, alors Krono ne vend pas le transport ; Krono vend seulement le portail, la preuve, le tracking et l'historique.

Formule livreur recommandé intégré Krono :

```
prixTransport = prix livraison payé dans Krono
gainLivreur = calculé selon son type (externe avec moto perso, ou moto Krono)
revenuKrono = marge transport + frais B2B + abonnement éventuel
```

Formule mode suivi seul, si le partenaire paie le livreur hors Krono :

```
prixTransportKrono = 0 si le livreur personnel exécute la livraison
fraisPlateforme = inclus dans le forfait jusqu'au quota, puis petit frais fixe ou % faible
revenuKrono = abonnement + fraisPlateforme éventuels
gainLivreurKrono = 0, car le livreur est payé par le partenaire
```

Ce mode peut être le meilleur argument commercial : "Gardez votre livreur de confiance, mais donnez à vos clients un suivi professionnel et gardez des preuves."

---

## 8. Formule complète du prix final

### Prix côté client (B2C)

```
1. lineSubtotal  = forfait(speedOption) + distanceKm × perKm
2. timePremium   = max(0, minutesRéelles - minutesThéo) × tauxMinute
3. subtotal      = lineSubtotal + timePremium
4. contextFactor = min(1.85, max(1, météo × surge × heure × trafic))
5. totalCfa      = round25(subtotal × contextFactor)
```

### Prix côté client (B2B)

```
1. lineSubtotal  = forfait(speedOption) + distanceKm × perKm
2. timePremium   = max(0, minutesRéelles - minutesThéo) × tauxMinute
3. subtotal      = lineSubtotal + timePremium
4. contextFactor = min(1.85, max(1, météo × surge × heure × trafic))
5. serverPrice   = round25(subtotal × contextFactor × 1.15 + 99)
6. commission    = round(serverPrice × tauxCommission)
7. finalPrice    = serverPrice + commission
```

> `round25` = arrondi au multiple de 25 FCFA le plus proche (arrondi psychologique).

### Payout livreur cible

```
1. payoutBase          = totalCfa B2C/hors-ligne, ou serverPrice B2B avant frais service
2. driverShareRate     = taux selon type livreur et type de course
3. driverEarningCfa    = round(payoutBase × driverShareRate)
4. kronoDeliveryMargin = payoutBase - driverEarningCfa
```

Pour un livreur externe avec moto personnelle, le modèle reste différent :

```
commissionAmount = round(orderPrice × commissionRate)
driverNetEarning = orderPrice - commissionAmount
```

### Wallet cash / mobile money

Le wallet livreur doit gérer deux sens d'argent différents.

**Paiement cash :**
```
client paie le livreur en espèces
livreur garde physiquement le cash
walletLivreur -= partKronoOuCommission
```

Exemple livreur externe, course 1 500 FCFA, commission Krono 12% :
```
client paie cash au livreur = 1 500
commission Krono = 180
gain net livreur = 1 320
walletLivreur = walletLivreur - 180
```

Exemple moto Krono, course 1 500 FCFA, part Krono 65% :
```
client paie cash au livreur = 1 500
gain livreur = 525
part Krono = 975
walletLivreur = walletLivreur - 975
```

**Paiement mobile money :**
```
client paie Krono dans l'app
Krono garde sa part
walletLivreur += gainLivreur
```

Exemple moto Krono, course 1 500 FCFA :
```
Krono encaisse = 1 500
Krono garde = 975
walletLivreur = walletLivreur + 525
```

---

## 9. Exemples chiffrés

**Scénario 1 — Client B2C, moto express, 5 km, conditions normales**
```
lineSubtotal  = 400 + (5 × 200) = 1 400 FCFA
timePremium   = 0 (pas de surplus de trafic)
contextFactor = 1.00
totalCfa      = round25(1 400) = 1 400 FCFA
```

**Scénario 2 — Client B2C, moto express, 5 km, heure de pointe + légère pluie**
```
lineSubtotal  = 1 400 FCFA
contextFactor = 1.06 (heure) × 1.08 (pluie) × 1.00 × 1.00 = 1.1448
totalCfa      = round25(1 400 × 1.1448) = round25(1 603) = 1 600 FCFA
```

**Scénario 3 — Partenaire B2B plan Starter cible in-quota, moto express, 5 km, conditions normales**
```
lineSubtotal  = 1 400 FCFA
contextFactor = 1.00
serverPrice   = round25(1 400 × 1.00 × 1.15 + 99) = round25(1 709) = 1 725 FCFA
commission    = round(1 725 × 0.08) + 100 = 238 FCFA
finalPrice    = 1 725 + 238 = 1 963 FCFA
```

**Scénario 4 — Partenaire B2B plan Business in-quota, moto express, 5 km, forte demande**
```
lineSubtotal  = 1 400 FCFA
surgeFactor   = 1.35 (10 commandes / 4 livreurs)
contextFactor = min(1.85, 1.35) = 1.35
serverPrice   = round25(1 400 × 1.35 × 1.15 + 99) = round25(2 273) = 2 275 FCFA
commission    = round(2 275 × 0.00) = 0 FCFA  ← Business = 0%
finalPrice    = 2 275 FCFA
```

**Scénario 5 — Livreur équipé Krono, course B2C à 1 400 FCFA**
```
payoutBase          = 1 400 FCFA
driverShareRate     = 35%
driverEarningCfa    = round(1 400 × 0.35) = 490 FCFA
kronoDeliveryMargin = 910 FCFA
```

**Scénario 6 — Livreur équipé Krono, B2B Starter cible à 1 963 FCFA final**
```
serverPrice         = 1 725 FCFA
commissionB2B       = 238 FCFA
finalPrice          = 1 963 FCFA
driverEarningCfa    = round(1 725 × 0.35) = 604 FCFA
kronoDeliveryMargin = 1 725 - 604 = 1 121 FCFA
revenuKronoTotal    = 1 121 + 238 = 1 359 FCFA
```

---

## 10. Décisions finales et implémentation

### Décisions métier actées

| Sujet | Décision |
|---|---|
| Livreur externe avec moto personnelle | Commission Krono cible **12%** |
| Livreur moto Krono, course solo | **35% livreur / 65% Krono** |
| Livreur moto Krono, tournée B2B | **30% livreur / 70% Krono** |
| B2B Business dans quota | **0% de frais B2B**, mais le prix transport reste payé |
| B2B avec livreur de confiance | Le livreur est payé par Krono si la course passe et est encaissée dans Krono |
| B2B suivi seul | Si le partenaire paie réellement le livreur hors Krono, Krono vend seulement portail, tracking, preuve, historique |
| Cash | Le livreur encaisse, son wallet doit la part Krono |
| Mobile money | Krono encaisse, puis crédite le gain livreur |

### À implémenter dans le produit

1. Ajouter un vrai calcul de gain livreur par commande :
```
driver_earning_cfa
krono_delivery_margin_cfa
b2b_fee_cfa
driver_payout_model
```

2. Séparer les modèles livreurs :
```
external_own_vehicle       -> commission 12%
krono_vehicle             -> 35% solo / 30% tournée
partner_trusted_external  -> commission 12% si moto personnelle
partner_paid_off_platform -> pas de payout Krono, seulement frais plateforme
```

3. Mettre à jour le wallet :
```
cash         -> débit de la part Krono
mobile_money -> crédit du gain livreur
```

4. Remplacer l'ancienne grille B2B dans le backend et les écrans :
```
pay_per_delivery = 12% + 150
starter          = 8% + 100 in-quota, 12% + 100 hors quota
pro              = 5% + 50 in-quota, 8% + 50 hors quota
business         = 0% in-quota, 5% hors quota
```

5. Corriger le flux admin B2B :
```
isB2BOrder seul = affichage
partner_id requis = abonnement, quota, frais B2B, reporting
```

6. Mettre à jour les libellés commerciaux :
```
Le quota réduit les frais B2B.
Le quota ne rend pas les livraisons gratuites.
```

### Conclusion

Le modèle final est cohérent si Krono garde ces règles :
- le transport est toujours payé quand Krono livre ;
- les forfaits B2B réduisent les frais de service, pas le prix transport ;
- les livreurs externes sont attractifs avec 12% de commission ;
- les motos Krono restent rentables avec une part Krono majoritaire ;
- le wallet devient le point central pour solder cash, mobile money et gains livreurs.

---

## 11. Fichiers sources

| Fichier | Rôle |
|---|---|
| `krono_backend/src/services/priceCalculator.ts` | Grille de base, forfaits, calcul `lineSubtotal` |
| `krono_backend/src/services/dynamicPricing.ts` | Facteurs contextuels, supplément B2B, formule finale |
| `krono_backend/src/services/openMeteoPricing.ts` | Facteur météo (API Open-Meteo) |
| `krono_backend/src/services/surgePricing.ts` | Facteur surge (tension live socket) |
| `krono_backend/src/services/b2bCommissionService.ts` | Commission partenaire B2B, gestion quota |
| `krono_backend/src/services/commissionService.ts` | Commission livreur partenaire (solde prépayé) |
| `krono_backend/src/controllers/driverController.ts` | Statistiques/gains livreur actuels (à faire évoluer vers gains nets) |
| `krono_backend/src/controllers/orderRecordController.ts` | Orchestration complète : calcul + création commande |

---

> **Constantes clés à retenir :**
> - `B2B_PRIORITY_FACTOR` = **1.15** (×15% sur le subtotal B2B)
> - `B2B_FIXED_SURCHARGE_CFA` = **99 FCFA** (forfait fixe B2B)
> - `MAX_CONTEXT_FACTOR` = **1.85** (plafond tous facteurs combinés)
> - Grille B2B cible = paiement à la course **12% + 150**, Starter **8% + 100**, Pro **5% + 50**, Business **0%** in-quota
> - Commission livreur partenaire = **10%** par défaut technique actuel, **12% cible**
> - Part livreur moto Krono cible = **35%** solo, **30%** tournée B2B groupée
