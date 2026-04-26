# Krono — Stratégie du paiement différé

Ce document décrit le fonctionnement complet du paiement différé :
ce qui existe, ce qui manque, et comment compléter le système.

---

## 1. C'est quoi le paiement différé dans Krono

Le client passe une commande sans payer immédiatement.
Krono lui fait confiance jusqu'à un certain montant.
Il rembourse après, depuis l'app.

Ce n'est **pas** un wallet rechargé à l'avance.
C'est un **crédit Krono** accordé au client.

---

## 2. Ce qui existe déjà dans le code

### Les limites actuelles

```
Limite mensuelle     : 5 000 FCFA
Limite annuelle      : 20 000 FCFA
Max utilisations     : 2 fois par mois
Délai entre deux uses : 7 jours minimum
Montant minimum      : 2 000 FCFA
```

### Les restrictions en cas de retard

```
1 retard dans les 30 jours   → limite réduite à 3 000 FCFA/mois
2 retards dans les 90 jours  → limite réduite à 2 000 FCFA/mois
3 retards ou plus            → bloqué 3 mois, différé inaccessible
```

### Ce qui est implémenté

- Création du différé → `payment_status = 'delayed'`
- Vérification des limites avant d'autoriser le différé
- Calcul de la dette en cours (`totalDue`, `totalRemaining`)
- Affichage de la dette dans la fiche client côté admin
- Routes : `GET /deferred/limits` et `GET /deferred/debts`

### Ce qui manque — le vrai problème

**Il n'existe aucun mécanisme de remboursement.**

Le système sait qui doit combien. Mais il n'y a aucun moyen pour le client
de rembourser depuis l'app, et aucun endpoint pour clôturer la dette.

---

## 3. Le cycle de vie complet du différé (tel qu'il devrait être)

```
Client passe commande → choisit "Différé"
        ↓
Système vérifie : limite disponible ? délai respecté ?
        ↓
OUI → commande créée, payment_status = 'delayed'
        ↓
Livraison effectuée
        ↓
Client voit sa dette dans app_chrono
        ↓
Client rembourse via Orange Money / Wave
        ↓
payment_status = 'paid' → dette effacée → limites restaurées
```

---

## 4. Le flux de remboursement à implémenter (côté client)

### Ce que le client voit dans `app_chrono`

Un bandeau ou une section visible dès qu'il a une dette en cours :

```
┌─────────────────────────────────────────┐
│  Vous avez une dette en cours           │
│  Montant dû : 3 500 FCFA               │
│                                         │
│  [Rembourser maintenant]                │
└─────────────────────────────────────────┘
```

Tant qu'il a une dette non remboursée, il ne peut pas réutiliser le différé
sur sa prochaine commande. Il peut toujours commander en payant cash,
Orange Money ou Wave — juste le différé est bloqué.

### Étapes du remboursement

```
1. Client clique "Rembourser maintenant"
2. Il voit le récapitulatif : quelle commande, quel montant
3. Il choisit Orange Money ou Wave
4. Il confirme le paiement
5. Le système reçoit la confirmation
6. payment_status → 'paid'
7. Ses limites différé sont restaurées
8. Confirmation affichée : "Dette remboursée, différé à nouveau disponible"
```

---

## 5. Ce qu'il faut coder

### Backend

- [ ] Endpoint `POST /api/payments/deferred/repay`
  - Paramètres : `transaction_id`, `payment_method` (orange_money | wave)
  - Vérifie que la transaction appartient bien au client
  - Met à jour `payment_status = 'paid'`
  - Retourne confirmation

- [ ] Logique de vérification au moment de repay :
  - Montant exact ou partiel ?
  - Que se passe-t-il si le paiement mobile money échoue ?

### Frontend `app_chrono`

- [ ] Écran "Mes dettes" : liste des transactions `delayed` non remboursées
- [ ] Bandeau d'alerte visible sur l'accueil si dette en cours
- [ ] Bouton "Rembourser" → flow de paiement Orange Money / Wave
- [ ] Confirmation visuelle après remboursement réussi

---

## 6. Questions à trancher

### Le remboursement est-il total ou partiel ?

**Option A — Remboursement total uniquement**
Le client rembourse tout d'un coup. Simple, sans ambiguïté.

**Option B — Remboursement partiel autorisé**
Le client peut payer en plusieurs fois. Plus flexible mais plus complexe
(il faut suivre `remaining_amount` par transaction).

Recommandation : commencer par l'Option A. Le différé est limité à 5 000 FCFA,
c'est un montant raisonnable à rembourser en une fois.

### Que se passe-t-il si le paiement mobile money échoue ?

- La dette reste `delayed`
- Le client voit un message d'erreur et peut réessayer
- Aucun changement de statut tant que le paiement n'est pas confirmé

### Les limites se restaurent-elles immédiatement après remboursement ?

Oui — dès que `payment_status = 'paid'`, le client récupère sa disponibilité
différé pour la période restante du mois.

Mais attention : même remboursé, l'utilisation mensuelle est comptabilisée.
Exemple : si le client a remboursé une utilisation de 3 000 FCFA ce mois-ci,
il lui reste 2 000 FCFA de crédit disponible (et non 5 000 FCFA).
C'est voulu — sinon il peut utiliser 5 000 FCFA, rembourser, réutiliser 5 000 FCFA...

---

## 7. Roadmap

### Phase 1 — Remboursement client depuis l'app (priorité)

- [x] Endpoint `POST /api/payments/deferred/repay`
- [x] Écran "Mes dettes" dans `app_chrono` (existait, bouton branché)
- [x] Flow de paiement Orange Money / Wave pour remboursement
- [ ] Bandeau alerte dette en cours sur l'accueil

### Phase 2 — Amélioration

- [ ] Notification push : rappel de dette si pas remboursée sous 7 jours
- [ ] Historique complet des différés dans le profil client
- [ ] Page admin enrichie : vue globale de toutes les dettes en cours
