# Krono — Amélioration UX app client (simplification pour faible alphabétisation)

Document de réflexion, **rien n'est encore décidé ni implémenté**. Périmètre : uniquement `app_krono` (app client final), pas admin/portail partenaire/tournées.

Contexte : fort taux d'analphabétisme dans le marché cible. Objectif — qu'une personne qui ne lit pas ou lit difficilement le français puisse commander une livraison sans aide, en s'appuyant sur des icônes/pictogrammes plutôt que du texte. Inspiration : maquette montrée par l'utilisateur (écran "Send Parcel" très épuré — From/To, poids/dimensions en pictos, prix en gros, un seul bouton d'action).

---

## 1. État actuel — comment on commande sur Krono aujourd'hui

Flux principal dans `app/(tabs)/map.tsx`, orchestré par plusieurs bottom sheets empilés :

1. **`DeliveryBottomSheet`** — saisie des adresses (départ/arrivée).
2. **`DeliveryMethodBottomSheet`** (1348 lignes) — choix du mode de livraison :
   - 3 méthodes proposées (Moto / Cargo / Voiture), mais **seule Moto est activée pour le client** (`clientDeliveryMethods.ts` — Cargo et Voiture existent dans le code mais `enabledForClient: false`).
   - Pour Moto : 3 sous-options à lire (Express / Standard / Programmée), chacune avec nom + description + prix + durée.
   - Accordéon "Option pour votre colis" (switch sac isotherme).
   - **2 champs de texte libre** : message coursier (`courierNote`), message destinataire (`recipientMessage`).
   - Si "Programmée" choisie : **3e champ texte libre** pour le créneau souhaité (`scheduledSlotNote`) — pas de sélecteur date/heure structuré (cf. `logique_livraison.md` section 6, refonte déjà actée mais pas codée).
3. **Confirmation** puis **`PaymentBottomSheet`** — choix parmi 5 méthodes (Orange Money, Wave, MTN Money, Espèces, Paiement différé), liste icône + nom, un seul écran.
4. **`DriverSearchBottomSheet`** — recherche livreur, puis suivi.

Adresses : `MapboxAddressAutocomplete.tsx` — saisie texte avec autocomplétion, pas de sélection carte pure en entrée principale. Adresses enregistrées avec labels courts ("Maison", "Bureau") déjà réutilisables.

**Constat** : au moins 5 écrans/bottom sheets successifs, plusieurs champs de texte libre à lire et remplir, beaucoup de libellés à comprendre (Express vs Standard vs Programmée, description de chaque option). Chaque texte libre est un point de blocage potentiel pour quelqu'un qui lit mal.

**Bonnes pratiques déjà en place, réutilisables** :
- Icônes Ionicons systématiques à côté de chaque option.
- Gros boutons de méthode avec image (`largeImage`).
- Badges courts ("Populaire", "Confort") plutôt que des phrases.
- Adresses enregistrées avec libellés courts.

---

## 2. Types de livraison disponibles côté client (rappel)

Un seul mode réellement actif pour le client aujourd'hui : **Moto**, avec 3 vitesses :
- **Express** — 400 FCFA, 15-20 min.
- **Standard** — 350 FCFA, 25-30 min.
- **Programmée** — 380 FCFA, créneau texte libre (pas encore une vraie date/heure, cf. section 6 de `logique_livraison.md`).

Cargo et Voiture existent dans le code mais sont désactivés pour le client (`unavailableMessage` affiché à la place).

---

## 3. Pistes d'amélioration (à discuter, aucune tranchée)

### A. Réduire le texte, augmenter le pictogramme
- Remplacer les descriptions longues des options (Express/Standard/Programmée) par une icône + un mot + un prix + un délai visuel (ex. horloge qui se remplit), sans phrase descriptive.
- Les 2-3 champs de texte libre (message coursier, message destinataire, créneau) sont le plus gros risque : soit les rendre optionnels et discrets, soit les remplacer par des choix pré-remplis en icônes ("Appeler à l'arrivée" / "Déposer devant la porte" / "Remettre en main propre") plutôt que taper du texte.

### B. Guidage vocal / audio
- Ajouter des instructions audio courtes à chaque étape clé (ex. bouton haut-parleur qui lit à voix haute "Où récupérer le colis ?"). Existe dans d'autres apps grand public en Afrique de l'Ouest pour ce type de public.

### C. Simplifier le choix du point A / point B
- Actuellement basé sur saisie texte + autocomplétion. Explorer un tap direct sur la carte comme méthode principale (moins de lecture), avec la recherche texte en option secondaire pour ceux qui savent lire.
- Renforcer les adresses enregistrées avec pictogrammes (maison, boutique) au lieu de texte pur.

### D. Réduire le nombre d'écrans
- Fusionner ce qui peut l'être (ex. méthode + options en un seul écran à choix visuel plutôt que 2 étapes) pour raccourcir le parcours.
- Un flux "commande rapide" par défaut (Standard, adresse enregistrée principale, paiement par défaut) en 1-2 taps, avec la possibilité d'aller plus loin pour les utilisateurs à l'aise.

### E. Prix et délai toujours visibles en gros caractères
- Comme dans la maquette de référence : montant en gros, gros bouton d'action unique, peu de choix simultanés à l'écran.

### F. Paiement
- Déjà relativement simple (icônes + nom, un seul écran) — probablement pas la priorité.

### G. Programmée — dépend de la refonte déjà actée
- Le champ "créneau" en texte libre doit de toute façon être remplacé par un vrai sélecteur structuré (décision déjà prise dans `logique_livraison.md` section 6) — l'occasion de le faire avec un sélecteur visuel simple (icônes matin/après-midi/soir) plutôt qu'un date picker classique.

---

## 4. Prochaines étapes possibles

- Trancher l'ambition : retouches ciblées (moins de texte, mêmes écrans) vs refonte plus radicale de l'écran de commande.
- Prioriser 1-2 pistes plutôt que tout attaquer en même temps.
- Rien à coder tant que ce n'est pas demandé explicitement.
