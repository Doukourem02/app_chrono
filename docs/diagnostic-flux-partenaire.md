# Diagnostic — Flux partenaire cassé

> Généré le 2026-05-03. Référence : `checklist-partenaire-b2b-abonnements.md` + `krono-reference-unique.md`.

---

## Symptôme

Peu importe le forfait choisi dans l'app, la soumission de demande partenaire ne produit aucun effet visible dans l'admin (plan reste "none", abonnement absent).

---

## Bug #1 — CRITIQUE : Plan jamais mis à jour si partenaire déjà existant

**Fichier** : `chrono_backend/src/controllers/partnerController.ts`, lignes 336–379

Si l'utilisateur a déjà un partenaire lié dans `partner_users` (ex : "DOUKOURE SHOP" actif), le backend dans `registerAsPartner` trouve le lien et retourne **immédiatement** `{ partner_id, status: 'active' }` sans jamais lire le `plan` envoyé. Le plan choisi dans l'app est jeté.

```typescript
if (currentStatus === 'active') {
  // ← retour immédiat, le plan passé dans req.body est ignoré
  await db().from('users').update({ is_business: true }).eq('id', userId);
  res.status(200).json({ success: true, data: { partner_id: existing.partner_id, status: 'active' } });
  return;
}
```

Même chose pour `pending` (lignes 347–355) : si l'utilisateur choisit un plan différent et re-soumet, le plan n'est jamais mis à jour en base.

---

## Bug #2 — CRITIQUE : Abonnement créé non actif à l'activation admin

**Fichier** : `chrono_backend/src/controllers/partnerController.ts`, lignes 520–533

Quand l'admin clique "Activer", `activatePartner` crée l'abonnement depuis le plan mais avec `is_active: false` et `payment_status: 'pending_payment'`. L'abonnement n'est donc **jamais actif** après l'activation. L'admin doit encore ouvrir la fiche et activer l'abonnement manuellement — étape invisible que personne ne fait.

---

## Bug #3 — CRITIQUE : Migrations 032 → 037 probablement non appliquées

Sans la migration `037`, le CHECK constraint sur `partners.status` ne contient pas `'inactive'`. Tout appel à `deregisterAsPartner` (toggle off) échoue silencieusement en base. Sans `032–035`, les tables `partner_users`, `partner_subscriptions`, etc. n'existent pas → toutes les requêtes rejettent en 500.

Les deux partenaires visibles dans l'admin ont `plan: none` → les plans choisis en app ne sont pas persistés (Bug #1 confirmé).

---

## Bug #4 — CRITIQUE : Toggle désactivation casse le statut admin

**Fichier** : `chrono_backend/src/controllers/partnerController.ts`, lignes 357–370

Quand `inactive → register` : le code remet directement `partners.status = 'active'` sans repasser par `pending`. C'est contraire à la checklist §0 bis. Et inversement quand l'admin désactive un partenaire en `inactive`, le toggle client le remet `active` sans validation admin.

---

## Bug #5 — MINEUR : `handleModeToggle` appelle `registerAsPartner` pour le mauvais cas

**Fichier** : `app_chrono/app/(tabs)/profile.tsx`, lignes 231–234

Quand l'utilisateur a déjà un `partner_id` et réallume le toggle, l'app appelle `registerAsPartner(user.company_name)` **sans plan**. Le backend traite ça comme une réactivation (OK pour l'agrément) mais l'appel est trompeur et fragile.

---

## Checklist de corrections

### Priorité 1 — Corrections bloquantes

- [ ] **MIGRATIONS** — Appliquer `032` → `037` dans Supabase SQL Editor (dans l'ordre).
  Migration `037` critique : ajoute `'inactive'` au CHECK constraint de `partners.status`.

- [ ] **BACKEND `registerAsPartner`** (`partnerController.ts` lignes 336–379)
  Si partenaire existant (`active` OU `pending`) ET `plan` fourni dans `req.body` :
  → mettre à jour `partners.plan` + `commission_rate` selon le plan choisi.
  → ne plus ignorer le plan envoyé par l'app.

- [ ] **BACKEND `activatePartner`** (`partnerController.ts` lignes 520–533)
  Créer l'abonnement avec `is_active: true` et `payment_status: 'active'` lors de l'activation manuelle admin.
  → l'admin active une seule fois, l'abonnement doit être opérationnel immédiatement.

### Priorité 2 — Comportement toggle

- [ ] **BACKEND `registerAsPartner` — cas `inactive`** (`partnerController.ts` lignes 357–370)
  Toggle ON d'un partenaire `inactive` → mettre uniquement `users.is_business = true`.
  Ne pas remettre `partners.status` à `'active'` directement (bypass admin).
  Distinguer : toggle mode business ≠ réactivation agrément.

- [ ] **BACKEND `deregisterAsPartner`** (`partnerController.ts` lignes 435–462)
  Toggle OFF → mettre uniquement `users.is_business = false`.
  Ne changer `partners.status` que si action explicite "quitter le programme".
  Actuellement : tout toggle off remet status `inactive` → force réactivation admin.

- [ ] **APP `profile.tsx` `handleModeToggle`** (lignes 231–234)
  Si `partner_id` existe + toggle ON → appel simple `PATCH is_business: true`.
  Ne pas appeler `registerAsPartner` (route d'inscription ≠ réactivation toggle).

### Priorité 3 — Admin et expérience

- [ ] **ADMIN liste partenaires** (`partners/page.tsx`)
  Ajouter filtre par statut (Tous / En attente / Actif / Inactif).
  Afficher le plan demandé avec badge "demandé" pour les partenaires en `pending` (logique déjà présente ligne 322).

- [ ] **ADMIN fiche partenaire — après activation**
  Vérifier que l'abonnement apparaît immédiatement actif après clic "Activer" (dépend correction Bug #2).

- [ ] **APP `business-onboarding.tsx`**
  Si l'API retourne `status: 'active'` avec un plan → afficher confirmation
  "Votre forfait [X] a été mis à jour" au lieu de rediriger silencieusement vers success.

- [ ] **BACKEND `validateUser` / `useAuthStore`**
  Synchroniser `partner_id` dans le store après `registerAsPartner` sans forcer le re-login
  (évite l'Alert "Compte non lié" dès l'accueil).

---

## Fichiers concernés

| Fichier | Bugs |
|---|---|
| `chrono_backend/src/controllers/partnerController.ts` | #1 #2 #4 #5 |
| `app_chrono/app/(tabs)/profile.tsx` | #5 |
| `app_chrono/app/(auth)/business-onboarding.tsx` | P3 |
| `admin_chrono/app/(dashboard)/partners/page.tsx` | P3 |
| `app_chrono/store/useAuthStore.ts` | P3 |
| Migrations Supabase `032` → `037` | #3 |

---

*Dernière mise à jour : 2026-05-03 — diagnostic initial.*
