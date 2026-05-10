# Monétisation KRONO — Documentation complète

> Fichier de référence unique sur tous les flux d'argent de la plateforme.
> Mis à jour : 2026-05-08

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
7. [Commission livreur](#7-commission-livreur)
   - 7.1 Livreur interne
   - 7.2 Livreur partenaire (prépayé)
8. [Formule complète du prix final](#8-formule-complète-du-prix-final)
9. [Exemples chiffrés](#9-exemples-chiffrés)
10. [Fichiers sources](#10-fichiers-sources)

---

## 1. Vue d'ensemble

KRONO génère ses revenus via **deux flux principaux** :

| Flux | Qui paie | Qui perçoit | Mécanisme |
|---|---|---|---|
| **Prix livraison client** | Client final (B2C ou B2B) | KRONO | Tarif dynamique au km |
| **Commission partenaire B2B** | Partenaire (entreprise) | KRONO | % ajouté au prix livraison |
| **Commission livreur partenaire** | Livreur partenaire | KRONO | Prélèvement sur solde prépayé |

Les livreurs **internes** KRONO ne paient pas de commission — ils sont salariés ou rémunérés autrement.

---

## 2. Grille tarifaire de base

Source : `chrono_backend/src/services/priceCalculator.ts`

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

Source : `chrono_backend/src/services/dynamicPricing.ts`

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

Source : `chrono_backend/src/services/openMeteoPricing.ts`

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

Source : `chrono_backend/src/services/surgePricing.ts`

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

Source : `chrono_backend/src/services/dynamicPricing.ts`

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

Source : `chrono_backend/src/services/b2bCommissionService.ts`

La commission est calculée **après** le prix dynamique et ajoutée au `finalPrice` retourné au partenaire. Elle est propre à chaque partenaire et à son plan d'abonnement.

### 6.1 Sans abonnement

Si le partenaire n'a pas d'abonnement actif (`is_active = true`, `payment_status = 'active'`), le taux est lu directement dans la table `partners.commission_rate`.

```
finalPrice = totalCfa + round(totalCfa × commission_rate)
type = 'no_subscription'
```

### 6.2 Avec abonnement (plans)

Trois plans d'abonnement, deux paliers de taux chacun :

| Plan | Taux in-quota | Taux excess (hors quota) |
|---|---|---|
| `starter` | **3%** | Taux `excess_commission_rate` de la DB |
| `pro` | **2%** | Taux `excess_commission_rate` de la DB |
| `business` | **0%** | Taux `excess_commission_rate` de la DB |

- **In-quota** : le partenaire n'a pas encore dépassé son quota mensuel de commandes → taux préférentiel
- **Excess** : quota dépassé → `excess_commission_rate` défini dans `partner_subscriptions`

**Le taux in-quota = excess_commission_rate − 3%** (écart constant qui récompense le quota).

### 6.3 Quota mensuel

Le quota est compté par mois calendaire (1er du mois). À chaque commande B2B créée avec succès, le compteur est incrémenté de manière **atomique** (upsert SQL sans race condition) :

```sql
INSERT INTO partner_usage (partner_id, month, deliveries_count)
VALUES ($1, $2, 1)
ON CONFLICT (partner_id, month)
DO UPDATE SET deliveries_count = partner_usage.deliveries_count + 1
```

**Exemple complet — partenaire plan Starter, excess à 6%, quota 100 commandes :**

| Statut | Taux | Prix livraison | Commission | Prix final |
|---|---|---|---|---|
| 50ème commande (in-quota) | 3% | 1 725 FCFA | 52 FCFA | 1 777 FCFA |
| 101ème commande (excess) | 6% | 1 725 FCFA | 104 FCFA | 1 829 FCFA |

---

## 7. Commission livreur

Source : `chrono_backend/src/services/commissionService.ts`

### 7.1 Livreur interne

- **Aucune commission** prélevée.
- Accès illimité aux commandes.
- Gestion salariale / externe à la plateforme.

### 7.2 Livreur partenaire (prépayé)

Les livreurs partenaires alimentent un **solde prépayé** (`commission_balance`). À chaque livraison complétée, la commission est **déduite automatiquement** de ce solde via la fonction SQL `deduct_commission`.

**Blocage automatique :**
- Solde ≤ 0 → compte **suspendu**, plus de nouvelles commandes assignées
- Solde ≤ 1 000 FCFA → alerte "solde très faible"
- Solde ≤ 3 000 FCFA → alerte "solde faible"

**Taux de commission livreur :** défini par `commission_rate` dans `commission_balance`, initialisé à **10%** par défaut à la création du profil.

```
commissionAmount = round(orderPrice × commissionRate)
newBalance = balance - commissionAmount
```

Si le solde devient insuffisant : la livraison n'est **pas bloquée** (non-bloquant) mais le compte est suspendu pour les commandes suivantes.

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

**Scénario 3 — Partenaire B2B plan Starter in-quota, moto express, 5 km, conditions normales**
```
lineSubtotal  = 1 400 FCFA
contextFactor = 1.00
serverPrice   = round25(1 400 × 1.00 × 1.15 + 99) = round25(1 709) = 1 725 FCFA
commission    = round(1 725 × 0.03) = 52 FCFA
finalPrice    = 1 725 + 52 = 1 777 FCFA
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

---

## 10. Fichiers sources

| Fichier | Rôle |
|---|---|
| `chrono_backend/src/services/priceCalculator.ts` | Grille de base, forfaits, calcul `lineSubtotal` |
| `chrono_backend/src/services/dynamicPricing.ts` | Facteurs contextuels, supplément B2B, formule finale |
| `chrono_backend/src/services/openMeteoPricing.ts` | Facteur météo (API Open-Meteo) |
| `chrono_backend/src/services/surgePricing.ts` | Facteur surge (tension live socket) |
| `chrono_backend/src/services/b2bCommissionService.ts` | Commission partenaire B2B, gestion quota |
| `chrono_backend/src/services/commissionService.ts` | Commission livreur partenaire (solde prépayé) |
| `chrono_backend/src/controllers/orderRecordController.ts` | Orchestration complète : calcul + création commande |

---

> **Constantes clés à retenir :**
> - `B2B_PRIORITY_FACTOR` = **1.15** (×15% sur le subtotal B2B)
> - `B2B_FIXED_SURCHARGE_CFA` = **99 FCFA** (forfait fixe B2B)
> - `MAX_CONTEXT_FACTOR` = **1.85** (plafond tous facteurs combinés)
> - Commission Starter in-quota = **3%**, Pro = **2%**, Business = **0%**
> - Commission livreur partenaire = **10%** par défaut
