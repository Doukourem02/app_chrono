# Krono — Audit du code incomplet

Ce fichier recense tous les bouts de code commencés mais jamais terminés.
Chaque ligne ici représente quelque chose que l'utilisateur peut toucher dans l'app
sans que ça fasse vraiment quoi que ce soit.

---

## Priorité 1 — Visible par l'utilisateur, ne fonctionne pas

### `app_chrono` — application client

| Feature | Fichier | Ligne | Symptôme |
|---|---|---|---|
| ~~Rembourser une dette différée~~ | ~~`app/profile/debts.tsx`~~ | ~~301~~ | ✅ Implémenté |
| Valider un code promo | `app/profile/promo-codes.tsx` | 25 | Formulaire présent, jamais envoyé à l'API |
| Changer la méthode de paiement par défaut | `app/profile/payment-methods.tsx` | 73 | Action ignorée, pas d'appel API |
| Supprimer une méthode de paiement | `app/profile/payment-methods.tsx` | 94 | Action ignorée, pas d'appel API |

### `driver_chrono` — application livreur

| Feature | Fichier | Ligne | Symptôme |
|---|---|---|---|
| Charger les méthodes de paiement | `app/profile/payments.tsx` | 25 | Page vide, aucune donnée chargée depuis l'API |
| Statistiques du livreur | `app/profile/statistics.tsx` | — | Page vide, placeholder uniquement |

---

## Priorité 2 — Backend incomplet

### `chrono_backend`

| Feature | Fichier | Ligne | Symptôme |
|---|---|---|---|
| Retrait commission via Mobile Money | `controllers/commissionController.ts` | 262 | Livreur partenaire ne peut pas retirer en Orange Money / Wave |
| URL de paiement Mobile Money | `controllers/commissionController.ts` | 291 | `paymentUrl` jamais retourné au client |
| Notification push "solde commission faible" | `services/commissionService.ts` | 226–232 | Alertes livreur jamais envoyées malgré la logique présente |

---

## Priorité 3 — Admin incomplet

### `admin_chrono`

| Feature | Fichier | Ligne | Symptôme |
|---|---|---|---|
| Vue mensuelle du planning | `app/(dashboard)/planning/page.tsx` | 571 | Texte "Vue mensuelle à venir" affiché à la place |
| Historique des livraisons d'un livreur | `app/(dashboard)/drivers/[driverId]/page.tsx` | 524 | Texte "à implémenter" affiché |
| Historique des évaluations d'un livreur | `app/(dashboard)/drivers/[driverId]/page.tsx` | 532 | Texte "à implémenter" affiché |
| Vue globale des interventions maintenance | `app/(dashboard)/maintenance/page.tsx` | 671 | Texte "Vue dédiée à venir" affiché |
| Synthèse budgétaire maintenance | `app/(dashboard)/maintenance/page.tsx` | 687 | Texte "Synthèse budgétaire à venir" affiché |
| Bouton chat dans le suivi de livraison | `components/tracking/DeliveryCard.tsx` | 362 | Bouton présent, aucune action au clic |

---

## Priorité 4 — Données manquantes en base

### `chrono_backend` — champs et tables jamais créés

| Donnée | Fichier | Ligne | Impact |
|---|---|---|---|
| Champ `last_login` sur `users` | `controllers/adminController.ts` | 3472 | La fiche admin d'un utilisateur affiche toujours `null` |
| Table `admin_actions` | `controllers/adminController.ts` | 3473 | Aucun historique des actions admin |
| Table `tickets` | `controllers/adminController.ts` | 3474 | Aucun suivi des interventions support |

---

## Priorité 5 — Documents légaux non rédigés

| Document | Fichier | Problème |
|---|---|---|
| CGU | `admin_chrono/app/legal/cgu/page.tsx` | Document générique "à adapter", pas encore rédigé pour Krono |
| Politique de confidentialité | `admin_chrono/app/legal/confidentialite/page.tsx` | Document générique "à compléter", non conforme en l'état |

> Ces deux documents sont requis pour la mise en ligne sur le Play Store et l'App Store.

---

## Ordre de traitement recommandé

1. **Remboursement différé** → déjà documenté dans `strategie-paiement-differe.md`
2. **Codes promo** → connecter l'écran existant à l'API admin (backend déjà présent)
3. **Méthodes de paiement client** → les routes backend existent, juste le front à brancher
4. **Méthodes de paiement livreur** → idem
5. **Retrait commission Mobile Money** → nécessite intégration Orange Money / Wave
6. **Notifications push commission** → logique déjà écrite, juste appeler `sendPushNotification`
7. **Historiques livreur dans l'admin** → requêtes SQL à écrire
8. **Documents légaux** → rédaction, hors code
