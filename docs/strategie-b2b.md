# Krono — Stratégie de monétisation B2B

Ce document est le blueprint de référence pour tout le développement B2B de Krono.
On ne code rien sans que ce fichier le décrive d'abord.

---

## 1. Principe fondamental

Krono doit s'adapter au workflow du commerçant, et non l'inverse.
Le problème n'est pas le device (mobile vs ordinateur). Le problème est la **friction** pour créer et gérer des commandes.

> Si Krono impose "utilise notre système" → échec
> Si Krono dit "continue comme tu fais déjà, mais en mieux" → adoption massive

---

## 2. Les 4 profils d'utilisateurs

### Profil 0 — Client particulier (B2C, existant)

- Particulier qui commande une livraison pour lui-même
- Ouvre `app_chrono`, une commande à la fois, paie immédiatement
- Rien ne change

### Profil 1 — Petit commerçant mobile

- Revendeur, boutique de quartier, petit commerçant informel
- Tout se passe sur téléphone uniquement
- Faible volume : 5 à 20 commandes par jour
- Pas de structure formelle : **pas d'abonnement obligatoire** au départ
- Veut de la simplicité absolue

**Paiement (harmonisé avec le reste du système)**

- **Commandes pour ses clients** : paiement sur le **compte business** du commerçant — **immédiat** (carte / mobile money selon dispositif existant) ou **différé** (`deferred`) si le profil / partenaire y est éligible, comme pour le B2B déjà en place
- **Commande pour lui-même** (voir §4) : même règles que Profil 0 si l'utilisateur bascule en contexte « perso » — typiquement **paiement immédiat** à la commande

**Commission**

- Sans abonnement actif : **Axe 1** — `partners.commission_rate` (cible documentaire **15 à 25 %**), aligné sur le petit volume
- Avec abonnement (s'il souscrit plus tard) : règles **Axe 2** et section **Commission dans le quota** (§8)

**Limites**

- Pas de quota plateforme imposé au Profil 1 par défaut ; les garde-fous sont **opérationnels** (anti-fraude, plafonds de différé si activé) et **commerciaux** (évolution vers Profil 2 / 3 si le volume explose)

### Profil 2 — Vendeur à volume (vendeuse TikTok, live)

- Fait des lives TikTok, collecte 20+ commandes d'un coup
- Un ou **plusieurs livreurs attitrés** (voir table `partner_drivers`, §7) — relation persistante, pas seulement le `driver_id` figé sur une tournée
- A besoin de créer une tournée entière en une session
- Tout se passe sur téléphone

### Profil 3 — B2B professionnel structuré

- Restaurant, pharmacie, boutique organisée
- Travaille depuis un ordinateur ou une tablette au comptoir
- Volume régulier et prévisible
- Prêt à payer un abonnement mensuel
- Veut un portail avec historique, quota, facturation

---

## 3. Les interfaces — qui utilise quoi

app_chrono      → Profil 0 (client B2C)
                → Profil 1 (petit commerçant, mode business)
                → Profil 2 (vendeur volume, mode tournée)

driver_chrono   → livreurs (inchangé, menus différents selon driver_type)

admin_chrono
  └── (admin)   → équipe Krono uniquement — jamais exposé aux partenaires
  └── (partner) → Profil 3, portail web (Phase 1 — même projet, layout séparé)

partner_chrono  → Profil 3, portail web indépendant (Phase 2 — si ça grossit)

### Règle absolue

L'admin Krono et le portail partenaire ne se mélangent jamais.
Un partenaire ne voit jamais : les autres partenaires, les livreurs et leurs commissions, les finances globales de Krono, les clients des autres.

---

## 4. Comptes et contexte d'utilisation (critique)

**Un seul compte utilisateur**, avec un **mode d'utilisation** (contexte) — pas deux comptes « particulier » / « commerçant » figés à vie.

- **Contexte client** : commandes pour soi (Profil 0), flux B2C habituel
- **Contexte business** : commandes pour ses clients, livraisons multiples, options B2B (différé, livreurs attitrés, tournées, etc.)

**Règles**

- Un **commerçant peut aussi commander pour lui-même** : il bascule en contexte client (ou équivalent UX) ; l'interface et les règles de paiement **s'adaptent au contexte**, pas à « un second compte »
- L'onboarding peut demander **« tu vends aussi des colis à des clients ? »** pour activer le mode business et les champs associés — ce n'est pas un verrou définitif : l'utilisateur reste une seule identité
- L'app affiche les parcours pertinents selon le **contexte actif** (création de commande perso vs commande client / tournée)

| Critère | Contexte client | Contexte business |
| --- | --- | --- |
| Nombre de commandes | Une à la fois (typique) | Plusieurs, pour ses propres clients |
| Qui paie | Lui, immédiatement (typique) | Son compte business ; différé possible si éligible |
| Les destinataires | Lui ou un proche | Ses clients |
| Livreur | Dispatch automatique | Livreur(s) attitré(s) possible(s) ; sinon dispatch |

---

## 5. Mode tournée — Profil 2 (vendeuse TikTok)

### Côté vendeuse dans `app_chrono`

Elle ouvre le mode tournée après son live :

1. Elle entre les commandes une par une (nom, adresse, téléphone, notes)
2. Elle choisit un **livreur attitré** parmi ceux liés à son compte (`partner_drivers`, défaut possible)
3. L'app propose un ordre de livraison optimisé (voir §11 — promesse produit liée à une implémentation technique explicite)
4. Elle envoie toute la tournée d'un coup

### Côté livreur dans `driver_chrono`

Il reçoit la tournée groupée — pas 18 notifications séparées. Il voit :

```text
Tournée Mariama Boutique — 18 livraisons
────────────────────────────────────────

1. Fatoumata Diallo
   Téléphone : 622 xx xx xx
   Adresse : Kipé, Rue 12, Maison bleue portail noir
   Notes : Colis fragile, appeler avant d'arriver

2. Moussa Camara
   Téléphone : 628 xx xx xx
   Adresse : Ratoma, près du marché central
   Notes : —

3. ...
────────────────────────────────────────
Itinéraire optimisé — 18 arrêts

→ Démarrer la tournée
```

Il valide chaque livraison une par une. La vendeuse voit en temps réel lesquelles sont livrées.

---

## 6. Portail partenaire — Profil 3

Accessible sur `partner.krono.com` depuis ordinateur ou tablette.

### Ce que le manager voit

```text
partner.krono.com
├── Tableau de bord     → commandes du jour, quota restant du mois
├── Créer une commande  → formulaire complet
└── Mes commandes       → historique + suivi en temps réel
```

### Ce que le propriétaire (owner) voit en plus

```text
├── Facturation         → abonnement actif, usage du mois, factures passées
├── Mon équipe          → liste des managers, inviter un nouveau
└── Clés API            → générer / révoquer (Phase 2)
```

### Ce qu'ils ne voient jamais

- Les autres partenaires
- Les livreurs et leurs commissions
- Les finances globales de Krono
- Les clients des autres partenaires

---

## 7. Modèle de données — 8 tables nouvelles + évolution `orders`

Formulation exacte : **8 tables à créer** + **modification de `orders`** (ajout `partner_id`).

Les livreurs attitrés ne sont plus implicites via seul `delivery_batches.driver_id` : la relation persistante commerçant ↔ livreur est portée par **`partner_drivers`** (le `driver_id` sur une tournée reste le **snapshot** d'exécution pour la batch).

### Table `partners` — l'entreprise partenaire

```sql
CREATE TABLE partners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  plan              TEXT DEFAULT 'none',        -- 'none' | 'starter' | 'pro' | 'business'
  status            TEXT DEFAULT 'active',      -- 'active' | 'suspended' | 'pending'
  commission_rate   DECIMAL DEFAULT 0.20,
  created_at        TIMESTAMPTZ DEFAULT now(),
  notes             TEXT
);
```

### Table `partner_users` — les employés autorisés

```sql
CREATE TABLE partner_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT DEFAULT 'manager',          -- 'owner' | 'manager'
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, user_id)
);
```

### Table `partner_drivers` — livreurs attitrés (relation persistante)

```sql
CREATE TABLE partner_drivers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_default     BOOLEAN DEFAULT false,         -- livreur proposé par défaut en tournée
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, driver_user_id)
);
```

Un commerçant peut avoir **plusieurs** livreurs attitrés ; l'UI choisit parmi eux (ou le défaut).

### Table `partner_subscriptions` — l'abonnement (évolutif)

`ends_at` **obligatoire** dès le MVP peut gêner renouvellements et annulations. Modèle prévu évolutif :

- **Phase 1** : période claire `starts_at` / `ends_at` + statuts de paiement (voir §8)
- **Évolutions** : renouvellement tacite ou automatique, `cancelled_at`, `next_renewal_at` (ou équivalent), `ends_at` nullable si « actif jusqu'à résiliation »

```sql
CREATE TABLE partner_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id              UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  plan                    TEXT NOT NULL,
  monthly_price           INTEGER NOT NULL,     -- en FCFA
  included_orders         INTEGER,              -- NULL = illimité
  excess_commission_rate  DECIMAL NOT NULL,
  starts_at               TIMESTAMPTZ NOT NULL,
  ends_at                 TIMESTAMPTZ,          -- nullable si politique « sans fin fixe » + cancelled_at
  cancelled_at            TIMESTAMPTZ,          -- résiliation
  next_renewal_at         TIMESTAMPTZ,          -- optionnel : échéance renouvellement auto (futur)
  payment_status          TEXT NOT NULL DEFAULT 'pending_payment',
                            -- 'trial' | 'pending_payment' | 'active' | 'past_due' | 'cancelled'
  is_active               BOOLEAN DEFAULT false, -- true seulement quand droits réels (ex. après validation admin Phase 1)
  created_at              TIMESTAMPTZ DEFAULT now()
);
```

**Règle** : en Phase 1, `is_active = true` après validation admin une fois le paiement manuel constaté ; `trial` peut activer des droits limités selon politique produit (à trancher avant implémentation).

### Table `partner_usage` — compteur mensuel de courses

```sql
CREATE TABLE partner_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  month             DATE NOT NULL,              -- ex : 2026-05-01
  deliveries_count  INTEGER DEFAULT 0,
  UNIQUE(partner_id, month)
);
```

### Table `partner_invoices` — factures B2B générées

> ⚠️ Nommée `partner_invoices` (et non `invoices`) car la table `invoices` est déjà utilisée pour les factures par livraison.

Une ligne de facture côté métier : **une facture mensuelle = forfait d'abonnement du mois + lignes de dépassement éventuelles** (commissions sur courses au-delà du quota). Pas de double facturation : ce qui est **déjà prélevé ou facturé en temps réel** (ex. commission à la course hors abonnement) doit être **exclu** ou **rapproché** explicitement dans la même période — voir §8 « Facturation ».

```sql
CREATE TABLE partner_invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,                -- en FCFA — total dû pour la période (abonnement + ajustements)
  status       TEXT DEFAULT 'pending',          -- 'pending' | 'paid' | 'overdue'
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

**Évolution** : lignes de facture détaillées (`partner_invoice_lines`) si besoin de ventilation abonnement / dépassement / ajustements en compta.

### Table `delivery_batches` — les tournées

```sql
CREATE TABLE delivery_batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID REFERENCES partners(id),
  user_id      UUID REFERENCES users(id),       -- pour les Profil 1/2 via app_chrono
  driver_id    UUID REFERENCES users(id),       -- livreur exécutant cette tournée (snapshot)
  status       TEXT DEFAULT 'pending',          -- 'pending' | 'in_progress' | 'completed'
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### Table `batch_orders` — les commandes d'une tournée

```sql
CREATE TABLE batch_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID NOT NULL REFERENCES delivery_batches(id) ON DELETE CASCADE,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,                -- ordre de livraison optimisé
  UNIQUE(batch_id, order_id)
);
```

### Lien avec la table `orders` existante

```sql
ALTER TABLE orders ADD COLUMN partner_id UUID REFERENCES partners(id);
```

- `partner_id IS NULL` → commande B2C normale
- `partner_id IS NOT NULL` → commande B2B rattachée à un partenaire
- Le flag `is_b2b_order` existant est conservé pendant la migration

---

## 8. Axes de monétisation

### Axe 1 — Commission à la course (socle, J0)

Commission de **15 à 25%** par livraison. Zéro engagement.

### Axe 2 — Abonnement mensuel (SaaS, J0)

|Formule|Prix/mois|Courses incluses|Commission excédent|
|-------|---------|----------------|-------------------|
|Starter|15 000 FCFA|50 courses|20%|
|Pro|40 000 FCFA|200 courses|15%|
|Business|100 000 FCFA|illimité|10%|

#### Paiement abonnement — Phase 1 vs scale

**Phase 1 (MVP)** : paiement **manuel** (Orange Money / Wave / virement) + **validation admin** pour activer l'abonnement. Statuts intermédiaires dans `partner_subscriptions.payment_status` :

- `trial` — période d'essai si offre produit (droits à définir)
- `pending_payment` — en attente de preuve / encaissement
- `active` — droits pleins une fois validé
- `past_due` / `cancelled` — évolutions comptables

**Au-delà de la Phase 1 (roadmap)** : passage à **paiement récurrent automatisé** (intégration prestataire, prélèvement, relances) ; le flux manuel reste éventuellement secours ou grands comptes.

#### Flux de paiement (Phase 1)

```text
Partenaire choisit son forfait
        ↓
Paiement manuel (OM / Wave / virement) → payment_status = pending_payment
        ↓
Admin Krono confirme → payment_status = active, is_active = true
        ↓
Commandes créées → partner_usage.deliveries_count++
        ↓
Si quota dépassé → excess_commission_rate appliqué (sur les courses excédentaires)
        ↓
Fin de mois → génération invoice (abonnement + dépassements, voir ci-dessous)
```

#### Facturation mensuelle (clarification critique)

**Une facture pour une période** (`period_start` → `period_end`) représente typiquement :

1. **Le montant de l'abonnement** du forfait (`monthly_price`)
2. **Plus** tout **ajustement** dû au **dépassement de quota** (commissions `excess_commission_rate` sur les courses au-delà du quota inclus)

**Séparation des concepts**

| Concept | Rôle |
| --- | --- |
| Abonnement | Forfait mensuel récurrent (prix du plan) |
| Usage (`partner_usage`) | Compteur de courses dans le mois — sert au quota |
| Commission temps réel | Courses hors forfait ou sans abonnement : Axe 1 ou taux excédent |
| Facture (`invoices`) | **Synthèse** période : ce que le partenaire **doit encore payer** ou qui **clôt** la période — **sans doublon** avec ce qui a déjà été encaissé en flux (règles compta à figer dans le spec billing) |

**Garantie** : une course ne doit pas être **facturée deux fois** (ex. commission déjà appliquée en ligne + reprise pleine sur facture) ; si commission déjà prélevée, la facture ne reprend que **solde** abonnement / pénalités / régularisations.

#### Logique de commission à chaque commande B2B

```text
1. Récupérer le partenaire via orders.partner_id
2. Vérifier partner_subscriptions avec payment_status = active et is_active ce mois
3a. Abonnement actif + quota non dépassé  → commission plateforme documentaire « dans le quota » (voir encadré ci-dessous)
3b. Abonnement actif + quota dépassé      → excess_commission_rate
3c. Pas d'abonnement actif                → partners.commission_rate (Axe 1)
4. Enregistrer / mettre à jour partner_usage et traces de facturation
```

**Commission dans le quota — décision business (validation obligatoire)**

- **Option A — SaaS pur** : abonnement actif + quota non dépassé ⇒ **0 %** commission plateforme sur la course ; le revenu est le forfait
- **Option B — Commission minimale** : même cas ⇒ **3 à 5 %** (ou palier fixe) pour préserver la marge unitaire

**Décision validée :**

| Plan | Commission dans le quota |
| --- | --- |
| Starter (15 000 FCFA / 50 courses) | **3 %** (Option B) |
| Pro (40 000 FCFA / 200 courses) | **3 %** (Option B) |
| Business (100 000 FCFA / illimité) | **0 %** (Option A) |

Logique : le forfait Business couvre entièrement le coût variable ; sur Starter/Pro, 3 % préserve la marge unitaire sans pénaliser le partenaire.

### Axe 3 — API d'intégration (Phase 2, 6 mois)

Grandes enseignes intègrent Krono dans leur SI via API.
Nécessite : `partner_api_keys`, middleware auth, webhooks signés.

### Axe 4 — Marque blanche (Phase 3, 12 mois)

Krono gère la livraison, le partenaire garde sa marque.

### Axe 5 — Flotte dédiée Enterprise (Phase 3)

Chauffeurs dédiés assignés à un seul partenaire. Forfait hebdomadaire ou mensuel.

### Axe 6 — Publicité et données agrégées (après volume atteint)

Partenaires premium mis en avant. Insights analytiques vendus.

---

## 9. Comportement du dispatch B2B

Déjà implémenté, à conserver :

- GPS optionnel (contrairement au B2C)
- Tous les livreurs disponibles notifiés
- Livreurs **internes** prioritaires sur commandes B2B
- Paiement **différé** (`deferred`) disponible
- Si livreur attitré défini (`partner_drivers` + choix pour la course ou tournée) → assignation directe, pas de dispatch large

---

## 10. Migration depuis l'existant

Les commandes B2B actuelles ont `is_b2b_order = true` sans `partner_id`.

1. Créer les **8 tables** (dont `partner_drivers`)
2. Ajouter `orders.partner_id` (nullable, pas de rupture)
3. Créer manuellement les entrées `partners` pour les partenaires existants
4. Renseigner `partner_drivers` pour les couples commerçant / livreur déjà connus (si données disponibles)
5. `UPDATE orders SET partner_id = ? WHERE ...` pour rattacher l'historique
6. `is_b2b_order` reste pendant la transition

---

## 11. Roadmap

### Phase 1 — Lancement (J0)

- [ ] Créer les **8 tables** en base + `orders.partner_id`
- [ ] Migration des partenaires existants + `partner_drivers` si applicable
- [ ] Compte unique + **contexte** client / business dans `app_chrono` (pas de double compte figé)
- [ ] Mode business dans `app_chrono` (Profil 1) — paiement / commission alignés §2
- [ ] Mode tournée + livreurs attitrés persistants + choix à l'envoi (Profil 2)
- [ ] **Optimisation d'itinéraire** : implémenter au minimum un **algo simple** (ex. ordre par distance euclidienne / haversine entre adresses géocodées) **ou** appel **Directions** (Google) / **OSRM** selon contraintes coût et licence — objectif : ne pas promettre « optimisé » sans livrable technique
- [ ] Mettre à jour `NewB2BShippingModal` pour renseigner `partner_id`
- [ ] Page admin : créer / gérer un partenaire
- [ ] Page admin : activer un abonnement (`pending_payment` → `active`)
- [ ] Logique de décompte quota + commission (option A ou B validée §8) à chaque commande B2B
- [ ] Génération de facture mensuelle (abonnement + dépassements, sans double facturation)
- [ ] Portail `/partner` dans `admin_chrono` : tableau de bord + créer commande + mes commandes

### Phase 1 bis / Phase 2 — Monétisation scale

- [ ] Paiement abonnement **récurrent / automatisé** (préférences prestataires locaux)
- [ ] Affinage `partner_subscriptions` : renouvellement auto, `cancelled_at`, politique `ends_at` nullable

### Phase 2 — 6 mois après lancement

- [ ] Portail partenaire : Facturation + Équipe
- [ ] Table `partner_api_keys`
- [ ] Endpoint `POST /api/partner/orders` (Axe 3)
- [ ] Webhooks signés avec retries
- [ ] WhatsApp bot pour création de commande rapide

### Phase 3 — 12 mois et au-delà

- [ ] Marque blanche (Axe 4)
- [ ] Flotte dédiée Enterprise (Axe 5)
- [ ] Publicité et analytics (Axe 6)
- [ ] Séparation `partner_chrono` en app indépendante si nécessaire

---

## 12. Adaptation `driver_chrono` au contexte B2B — ✅ Implémenté (2026-05-03)

Le livreur avait déjà le flag `isB2BOrder` et l'écran `/batch/[batchId]`, mais était aveugle au partenaire, à sa position dans la tournée et aux livreurs attitrés. Voici ce qui a été ajouté.

### Types TypeScript — `store/useOrderStore.ts`

Champs ajoutés à `OrderRequest` :

```typescript
partner_id?: string;
partner_name?: string;
batch_id?: string;
batch_position?: number;
batch_total?: number;
```

### Mapping — `utils/mapAdminOrderFlags.ts`

`mapAdminOrderFlags()` extrait désormais ces 5 champs depuis la racine du payload socket (et `_chrono_admin` pour `partner_id`). Le mapping s'applique automatiquement dans `addPendingOrder` et `addOrder`.

### Store tournées — `store/useBatchStore.ts`

Champs ajoutés à `ActiveBatch` :

```typescript
partner_id?: string;
partner_name?: string;
status?: 'pending' | 'in_progress' | 'completed';
created_at?: string;
```

### Socket `batch-assigned` — `services/orderSocketService.ts`

Payload étendu :
```typescript
{ batchId: string; ordersCount: number; partner_id?: string; partner_name?: string; status?: string }
```
`partner_id` et `partner_name` sont passés à `setActiveBatch()`.

### Composants UI

| Composant | Ce qui a été ajouté |
|---|---|
| `AdminOrderInfo.tsx` | Affiche "Partenaire : X" et "Livraison Y/Z de la tournée" si champs présents |
| `OrderRequestPopup.tsx` | Popup d'acceptation : interface locale étendue, props transmises à `AdminOrderInfo` |
| `DriverOrderBottomSheet.tsx` | Section "Contexte B2B" dans l'onglet détails : partenaire, position tournée, bouton "Voir la tournée" |
| `app/batch/[batchId].tsx` | Header affiche `partner_name` si présent, sinon "Tournée B2B" |

### Résultat

**Avant :**
```
[Popup] Commande B2B — Jean Dupont — 2500 FCFA
← livreur ne sait pas pour qui
```

**Après :**
```
[Popup] Partenaire : Resto Chez Maman
        Livraison 2/5 de la tournée
        Jean Dupont — 2500 FCFA
```

---

## 13. Feature séparée — Commissionnaire (hors B2B)

**Hors périmètre B2B** : pas de mélange avec logique produit, pricing ou tables `partners` / abonnements ci-dessus.

Feature **B2C** à documenter dans un **fichier dédié** (parcours, pricing, avance de fonds).

Résumé métier : le livreur agit à la place du client (courses, achats ponctuels) — ce n'est pas une livraison classique point A → point B avec colis déjà prêt.

Questions à traiter dans ce doc séparé : qui avance l'argent, plafond budget, article indisponible, assurance / litiges.
