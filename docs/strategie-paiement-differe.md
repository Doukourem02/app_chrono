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

```text
Limite mensuelle     : 5 000 FCFA
Limite annuelle      : 20 000 FCFA
Max utilisations     : 2 fois par mois
Délai entre deux uses : 7 jours minimum
Montant minimum      : 2 000 FCFA

