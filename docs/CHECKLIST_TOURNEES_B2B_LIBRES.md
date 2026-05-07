# Checklist - Tournées B2B libres

## Avancement implémentation - 2026-05-07

- [x] `POST /api/batches` peut créer l'enveloppe de tournée et les livraisons enfants en un seul appel.
- [x] L'app business n'émet plus une création REST séparée par arrêt avant de créer le batch.
- [x] L'ordre optimisé est présenté comme `Ordre conseillé`, pas comme une contrainte.
- [x] L'écran chauffeur charge les consignes de chaque arrêt depuis les détails de livraison.
- [x] Chaque arrêt affiche un statut visible : `À faire`, `Livré`, `Annulé`.
- [x] Le compteur de tournée avance avec les arrêts `completed` et `cancelled`.
- [x] Un arrêt sans GPS affiche `GPS absent` et ouvre une navigation externe par adresse si possible.
- [x] La popup chauffeur annonce une seule offre : `Nouvelle tournée B2B - N livraisons`.
- [x] La navigation Mapbox reste mono-destination et revient à la liste après validation.
- [ ] Tests manuels terrain à exécuter sur simulateur/appareil avec 2 puis 5 arrêts.
- [ ] Revue admin/partenaire détaillée à compléter pour les écrans web de suivi/facturation.

## Vision Produit

Une tournée B2B groupée est un lot de plusieurs livraisons créées en une seule fois par le même owner : partenaire, professionnel ou compte business.

Côté chauffeur, ce lot doit rester simple : il accepte une seule tournée, puis il effectue les livraisons une par une, dans l'ordre qu'il choisit.

## Règle centrale

- [ ] Une tournée B2B = une seule offre chauffeur.
- [ ] Une tournée B2B = une seule acceptation.
- [ ] Une tournée B2B = plusieurs livraisons enfants liées au même owner.
- [ ] Les livraisons enfants ne déclenchent pas chacune une popup séparée.
- [ ] Le chauffeur n'est pas obligé de suivre un ordre imposé.
- [ ] L'ordre affiché peut être conseillé, mais jamais bloquant.
- [ ] Le chauffeur peut choisir l'arrêt le plus proche ou le plus logique selon le terrain.
- [ ] Chaque arrêt garde sa propre validation : QR, code manuel ou preuve alternative.
- [ ] La tournée se termine uniquement quand tous les arrêts sont `completed` ou `cancelled`.

## Différence avec plusieurs courses classiques

- [ ] Courses classiques : plusieurs commandes peuvent venir de plusieurs utilisateurs Krono différents.
- [ ] Tournée B2B : plusieurs commandes viennent du même owner, créées en un seul lot.
- [ ] Côté business : le lot est unique pour l'assignation, le suivi et la facturation.
- [ ] Côté chauffeur : le lot se comporte comme une liste de livraisons simples.

## UX Chauffeur

- [ ] Après acceptation, afficher l'écran de tournée avec tous les arrêts.
- [ ] Afficher le compteur global : `0/18`, `5/18`, etc.
- [ ] Afficher chaque arrêt avec statut : `À faire`, `Livré`, `Annulé`.
- [ ] Afficher un bouton `Naviguer` sur chaque arrêt disponible.
- [ ] Ne pas lancer automatiquement la navigation au prochain arrêt après validation.
- [ ] Après validation d'un arrêt, fermer la navigation et revenir à la liste.
- [ ] Mettre visuellement en avant les arrêts restants.
- [ ] Proposer un libellé du type `Ordre conseillé`, si un tri optimisé existe.
- [ ] Ne jamais afficher `Arrêt obligatoire` ou une formulation qui impose l'ordre.
- [ ] Autoriser le chauffeur à appeler le destinataire de chaque arrêt.
- [ ] Autoriser le chauffeur à consulter les consignes de chaque arrêt.
- [ ] Si un arrêt n'a pas de GPS, afficher `GPS absent` et proposer l'ouverture externe par adresse si possible.

## Navigation

- [ ] Pour une tournée groupée, Mapbox reçoit une seule destination à la fois.
- [ ] La navigation active correspond uniquement à l'arrêt sélectionné par le chauffeur.
- [ ] La navigation ne doit pas être multi-arrêts.
- [ ] La navigation ne doit pas passer automatiquement au prochain client.
- [ ] Si la même route `origine -> destination` est déjà active, ne pas redémarrer Mapbox.
- [ ] Si le chauffeur choisit un autre arrêt, fermer ou remplacer proprement la navigation active.
- [ ] À la validation d'un arrêt, démonter la navigation et revenir à la tournée.
- [ ] Le bouton retour depuis la navigation revient à la liste de tournée.
- [ ] Les annonces vocales doivent concerner seulement l'arrêt actif.

## Données

- [ ] `delivery_batches` représente l'enveloppe de la tournée.
- [ ] `batch_orders` relie la tournée aux commandes enfants.
- [ ] Chaque commande enfant conserve son propre `orderId`.
- [ ] Chaque commande enfant conserve son propre destinataire.
- [ ] Chaque commande enfant conserve son propre statut.
- [ ] Chaque commande enfant conserve ses propres coordonnées GPS.
- [ ] Chaque commande enfant conserve sa propre preuve de livraison.
- [ ] Le même owner doit être traçable sur la tournée : `partner_id` ou `user_id`.
- [ ] Pour un grand B2B, rattacher la tournée au `partner_id`.
- [ ] Pour un petit B2B app-only, rattacher la tournée au `user_id` si aucun `partner_id` n'existe.

## Backend

- [ ] `POST /api/batches` crée la tournée et toutes les commandes enfants.
- [ ] Le backend peut calculer un ordre conseillé.
- [ ] L'ordre conseillé doit être stocké comme aide, pas comme contrainte métier.
- [ ] `accept-batch` assigne la tournée au livreur.
- [ ] L'acceptation doit être idempotente pour éviter double clic ou double événement socket.
- [ ] `GET /api/batches/:id` retourne tous les arrêts, y compris les arrêts déjà livrés ou annulés.
- [ ] `PATCH /api/batches/:batchId/orders/:orderId` valide uniquement l'arrêt choisi.
- [ ] Le backend vérifie que l'arrêt appartient bien à la tournée.
- [ ] Le backend vérifie que la tournée appartient bien au livreur assigné.
- [ ] Le backend ne doit pas refuser une validation parce que des arrêts précédents sont encore `pending`.
- [ ] Le backend clôture la tournée quand tous les arrêts sont `completed` ou `cancelled`.

## Socket et notifications

- [ ] Envoyer une seule notification `batch-assigned` pour la tournée.
- [ ] Ne pas envoyer `new-order-request` pour chaque commande enfant.
- [ ] Dédupliquer les popups par `batchId`.
- [ ] Afficher un texte clair : `Nouvelle tournée B2B - 18 livraisons`.
- [ ] Après acceptation, ouvrir l'écran `/batch/[batchId]`.
- [ ] Si la tournée est déjà assignée au même livreur, ouvrir la tournée sans erreur.
- [ ] Si la tournée est assignée à un autre livreur, afficher une indisponibilité.

## Admin et partenaire

- [ ] Lors de la création, afficher que la tournée contient plusieurs livraisons.
- [ ] Afficher le owner : partenaire, professionnel ou compte business.
- [ ] Afficher le nombre total d'arrêts.
- [ ] Afficher l'ordre conseillé si disponible.
- [ ] Ne pas présenter l'ordre conseillé comme obligatoire.
- [ ] Permettre de vérifier les coordonnées GPS de chaque destinataire.
- [ ] Prévenir clairement si certains arrêts n'ont pas de coordonnées GPS.

## Critères d'acceptation

- [ ] Un chauffeur peut accepter une tournée de 18 livraisons en une seule fois.
- [ ] Le chauffeur peut livrer l'arrêt 7 avant l'arrêt 1.
- [ ] Le chauffeur peut livrer l'arrêt le plus proche sans blocage.
- [ ] La validation d'un arrêt ne valide pas les autres.
- [ ] La validation d'un arrêt ne lance pas automatiquement le suivant.
- [ ] Un arrêt livré disparaît des actions principales ou passe en état `Livré`.
- [ ] Les arrêts restants restent disponibles dans n'importe quel ordre.
- [ ] La navigation Mapbox ne boucle pas sur `Lancement de la navigation`.
- [ ] La navigation Mapbox ne répète pas l'instruction initiale à chaque update.
- [ ] La tournée passe `completed` quand toutes les livraisons sont terminées ou annulées.

## Tests manuels obligatoires

- [ ] Créer une tournée avec 2 arrêts.
- [ ] Accepter la tournée côté chauffeur.
- [ ] Lancer la navigation vers l'arrêt 2 avant l'arrêt 1.
- [ ] Revenir à la liste sans valider.
- [ ] Lancer la navigation vers l'arrêt 1.
- [ ] Valider l'arrêt 1 par QR.
- [ ] Vérifier que l'arrêt 2 reste `À faire`.
- [ ] Valider l'arrêt 2 par code manuel.
- [ ] Vérifier que la tournée passe terminée.
- [ ] Refaire le test avec un arrêt sans GPS.
- [ ] Refaire le test avec 5 arrêts en choisissant un ordre différent de l'ordre affiché.

## Points de vigilance

- [ ] Ne pas confondre ordre conseillé et ordre obligatoire.
- [ ] Ne pas transformer la tournée B2B en navigation multi-stops.
- [ ] Ne pas faire dépendre la validation d'un arrêt de la validation des arrêts précédents.
- [ ] Ne pas émettre plusieurs popups chauffeur pour une même tournée.
- [ ] Ne pas relancer Mapbox quand la destination active n'a pas changé.
- [ ] Ne pas oublier que 18 livraisons peuvent venir du même owner en un seul coup.
