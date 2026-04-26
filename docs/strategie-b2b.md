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
- Pas de structure formelle, pas d'abonnement au départ
- Veut de la simplicité absolue

### Profil 2 — Vendeur à volume (vendeuse TikTok, live)

- Fait des lives TikTok, collecte 20+ commandes d'un coup
- A **un seul livreur attitré** qu'il connaît personnellement
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

```
app_chrono      → Profil 0 (client B2C)
                → Profil 1 (petit commerçant, mode business)
                → Profil 2 (vendeur volume, mode tournée)

driver_chrono   → livreurs (inchangé, menus différents selon driver_type)

admin_chrono
  └── (admin)   → équipe Krono uniquement — jamais exposé aux partenaires
  └── (partner) → Profil 3, portail web (Phase 1 — même projet, layout séparé)

partner_chrono  → Profil 3, portail web indépendant (Phase 2 — si ça grossit)
```

### Règle absolue

L'admin Krono et le portail partenaire ne se mélangent jamais.
Un partenaire ne voit jamais : les autres partenaires, les livreurs et leurs commissions, les finances globales de Krono, les clients des autres.

---

## 4. Inscription — la distinction se fait une seule fois

À l'inscription dans `app_chrono`, l'utilisateur choisit **une fois pour toutes** :

```
"Je suis un particulier"   → compte client (Profil 0)
"Je suis commerçant"       → compte business (Profil 1 ou 2)
```

Après ça, l'app sait qui il est et lui montre directement la bonne interface.
Le commerçant ne voit plus jamais cette question.

| | Particulier | Commerçant |
|---|---|---|
| Nombre de commandes | Une à la fois | Plusieurs, pour ses propres clients |
| Qui paie | Lui, immédiatement | Son compte business, différé possible |
| Les destinataires | Quelqu'un à qui il envoie | Ses clients à lui |
| Livreur | Dispatch automatique | Peut avoir un livreur attitré |

---

## 5. Mode tournée — Profil 2 (vendeuse TikTok)

### Côté vendeuse dans `app_chrono`

Elle ouvre le mode tournée après son live :
1. Elle entre les commandes une par une (nom, adresse, téléphone, notes)
2. Elle sélectionne son livreur attitré (lié à son compte)
3. L'app propose un ordre de livraison optimisé
4. Elle envoie toute la tournée d'un coup

### Côté livreur dans `driver_chrono`

Il reçoit la tournée groupée — pas 18 notifications séparées. Il voit :

```
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

```
partner.krono.com
├── Tableau de bord     → commandes du jour, quota restant du mois
├── Créer une commande  → formulaire complet
└── Mes commandes       → historique + suivi en temps réel
```

### Ce que le propriétaire (owner) voit en plus

```
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

## 7. Modèle de données — les 7 tables à créer

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

### Table `partner_subscriptions` — l'abonnement actif

```sql
CREATE TABLE partner_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id              UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  plan                    TEXT NOT NULL,
  monthly_price           INTEGER NOT NULL,     -- en FCFA
  included_orders         INTEGER,              -- NULL = illimité
  excess_commission_rate  DECIMAL NOT NULL,
  starts_at               TIMESTAMPTZ NOT NULL,
  ends_at                 TIMESTAMPTZ NOT NULL,
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now()
);
```

### Table `partner_usage` — compteur mensuel de courses

```sql
CREATE TABLE partner_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  month             DATE NOT NULL,              -- ex : 2025-05-01
  deliveries_count  INTEGER DEFAULT 0,
  UNIQUE(partner_id, month)
);
```

### Table `invoices` — factures générées

```sql
CREATE TABLE invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,                -- en FCFA
  status       TEXT DEFAULT 'pending',          -- 'pending' | 'paid' | 'overdue'
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### Table `delivery_batches` — les tournées

```sql
CREATE TABLE delivery_batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID REFERENCES partners(id),
  user_id      UUID REFERENCES users(id),       -- pour les Profil 1/2 via app_chrono
  driver_id    UUID REFERENCES users(id),       -- livreur attitré assigné
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

| Formule  | Prix/mois    | Courses incluses | Commission excédent |
|----------|--------------|-----------------|---------------------|
| Starter  | 15 000 FCFA  | 50 courses      | 20%                 |
| Pro      | 40 000 FCFA  | 200 courses     | 15%                 |
| Business | 100 000 FCFA | illimité        | 10%                 |

#### Flux de paiement

```
Partenaire choisit son forfait
        ↓
Paiement via Orange Money / Wave / virement
        ↓
Admin Krono confirme → partner_subscriptions (is_active = true)
        ↓
Commandes créées → partner_usage.deliveries_count++
        ↓
Si quota dépassé → excess_commission_rate appliqué
        ↓
Fin de mois → génération invoice
```

#### Logique de facturation à chaque commande B2B

```
1. Récupérer le partenaire via orders.partner_id
2. Vérifier partner_subscriptions actif ce mois
3a. Abonnement actif + quota non dépassé  → 0% commission, incrémenter usage
3b. Abonnement actif + quota dépassé      → excess_commission_rate
3c. Pas d'abonnement                      → partners.commission_rate (Axe 1)
4. Enregistrer dans partner_usage
```

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
- Si livreur attitré défini → assignation directe, pas de dispatch

---

## 10. Migration depuis l'existant

Les commandes B2B actuelles ont `is_b2b_order = true` sans `partner_id`.

1. Créer les 7 tables
2. Ajouter `orders.partner_id` (nullable, pas de rupture)
3. Créer manuellement les entrées `partners` pour les partenaires existants
4. `UPDATE orders SET partner_id = ? WHERE ...` pour rattacher l'historique
5. `is_b2b_order` reste pendant la transition

---

## 11. Roadmap

### Phase 1 — Lancement (J0)

- [ ] Créer les 7 tables en base
- [ ] Ajouter `orders.partner_id`
- [ ] Migration des partenaires existants
- [ ] Inscription "particulier / commerçant" dans `app_chrono`
- [ ] Mode business dans `app_chrono` (Profil 1)
- [ ] Mode tournée + livreur attitré dans `app_chrono` (Profil 2)
- [ ] Mettre à jour `NewB2BShippingModal` pour renseigner `partner_id`
- [ ] Page admin : créer / gérer un partenaire
- [ ] Page admin : activer un abonnement
- [ ] Logique de décompte quota à chaque commande B2B
- [ ] Génération de facture mensuelle
- [ ] Portail `/partner` dans `admin_chrono` : tableau de bord + créer commande + mes commandes

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

## 12. Feature séparée — Commissionnaire (hors B2B)

Feature B2C à documenter séparément.
Le livreur agit à la place du client : va acheter un médicament, faire les courses au marché.
Ce n'est pas une livraison classique (point A → point B avec colis existant).
Questions à résoudre : qui avance l'argent des achats, budget maximum, que faire si article indisponible.
