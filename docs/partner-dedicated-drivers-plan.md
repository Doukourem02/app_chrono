# Plan - Livreurs dedies B2B

## Objectif

Mettre en place un vrai parcours pour savoir clairement si un partenaire B2B a un ou plusieurs livreurs dedies, les gerer depuis l'admin, puis les prioriser lors de la creation de commandes ou de tournees.

Aujourd'hui, le code sait deja lire `partner_drivers`, mais il manque l'interface et les routes de gestion. Resultat : cote portail partenaire, le bloc "Prioriser un livreur dedie" peut s'afficher, mais la liste reste vide si personne n'a rattache de livreur au partenaire.

## Definitions produit

- Livreur B2B opt-in : livreur qui a active "recevoir les commandes B2B" dans l'app livreur. Champ technique : `driver_profiles.accepts_b2b_orders`.
- Livreur dedie partenaire : livreur explicitement rattache a un partenaire precis. Table technique : `partner_drivers`.
- Assignation automatique B2B : le systeme notifie les livreurs disponibles qui acceptent le B2B, avec matching/priorite interne/equilibre.
- Priorisation livreur dedie : pour une commande d'un partenaire, Krono propose d'abord le livreur dedie selectionne, puis retombe en automatique si besoin.

## Solution proposee

Ajouter une section "Livreurs dedies" dans la fiche admin d'un partenaire.

Le principe produit a retenir :

- le partenaire sait souvent mieux que Krono quel livreur il veut dedier ;
- le partenaire peut donc demander, proposer ou identifier un livreur dedie ;
- seul l'admin Krono valide et rattache officiellement le livreur au partenaire.

On implemente donc 3 cas d'usage complementaires.

### Cas 1 - Le partenaire connait deja le livreur

Le partenaire connait le livreur par son nom, son telephone, ou parce qu'il travaille deja avec lui hors Krono.

Parcours :

1. Le partenaire transmet les informations a Krono, via WhatsApp, telephone, mail ou formulaire.
2. L'admin recherche le livreur dans Krono.
3. L'admin verifie que le livreur existe et qu'il peut recevoir des commandes B2B.
4. L'admin rattache le livreur au partenaire.

Ce cas permet de demarrer rapidement, meme si le partenaire n'a qu'une information partielle comme le nom du livreur.

### Cas 2 - Le partenaire a connu le livreur via Krono

Le partenaire ne connait pas forcement le telephone du livreur, mais il se souvient d'une livraison ou d'un livreur rencontre via Krono.

Parcours :

1. Depuis l'historique ou le detail d'une commande, le partenaire clique sur une action du type "Demander ce livreur comme livreur dedie".
2. Krono cree une demande de rattachement avec le contexte de la commande.
3. L'admin voit la demande, identifie le livreur concerne, puis valide ou refuse.
4. Si la demande est validee, le livreur est rattache au partenaire.

Ce cas evite au partenaire de devoir connaitre les informations completes du livreur.

### Cas 3 - Le partenaire veut un livreur dedie mais ne sait pas qui choisir

Le partenaire veut un livreur dedie, mais il n'a personne en tete.

Parcours :

1. Le partenaire clique sur une action du type "Demander un livreur dedie".
2. Il peut ajouter un commentaire optionnel sur ses besoins : zone, horaires, volume, habitudes.
3. L'admin Krono choisit un livreur adapte.
4. L'admin rattache ce livreur au partenaire.

Ce cas permet a Krono de proposer un livreur dedie meme quand le partenaire n'a pas encore de preference.

L'admin pourra :

- voir les livreurs dedies du partenaire ;
- ajouter un livreur existant ;
- retirer un livreur ;
- definir un livreur par defaut ;
- voir si le livreur accepte les commandes B2B ;
- voir son statut online/disponible.

Le portail partenaire ne doit pas rattacher directement des livreurs. Il doit permettre de faire une demande, puis proposer uniquement les livreurs deja valides et configures par Krono.

Phrase front a utiliser dans la section livreur dedie :

> "Livreur dédié : Krono propose d’abord la commande au livreur sélectionné pour ce partenaire. Si aucun livreur dédié n’est disponible, l’assignation automatique prend le relais."

Phrase front possible pour la demande :

> "Vous souhaitez un livreur dédié ? Envoyez une demande à Krono. Notre équipe vérifie le livreur et l’ajoute à votre compte si tout est conforme."

## Checklist implementation

### 1. Verifier le modele de donnees

- [ ] Confirmer que la table `partner_drivers` existe en prod/staging.
- [ ] Confirmer les colonnes minimales :
  - [ ] `id`
  - [ ] `partner_id`
  - [ ] `driver_user_id`
  - [ ] `is_default`
  - [ ] `created_at`
- [ ] Ajouter ou verifier une contrainte unique `(partner_id, driver_user_id)`.
- [ ] Ajouter ou verifier une FK vers `partners(id)`.
- [ ] Ajouter ou verifier une FK vers `users(id)` pour `driver_user_id`.
- [ ] Decider la regle `is_default` : un seul livreur par defaut par partenaire.

### 2. Backend admin

- [ ] Ajouter une route admin pour lister les livreurs dedies d'un partenaire.
  - Route possible : `GET /api/partners/:id/drivers`
  - Existe deja pour lecture, a securiser/valider selon besoin admin.
- [ ] Ajouter une route pour rattacher un livreur.
  - Route proposee : `POST /api/partners/:id/drivers`
  - Body : `{ "driver_user_id": "...", "is_default": false }`
- [ ] Ajouter une route pour retirer un livreur.
  - Route proposee : `DELETE /api/partners/:id/drivers/:driverUserId`
- [ ] Ajouter une route pour definir le livreur par defaut.
  - Route proposee : `PATCH /api/partners/:id/drivers/:driverUserId/default`
- [ ] Lors de l'ajout, refuser les users qui ne sont pas `role = driver`.
- [ ] Lors de l'ajout, retourner un warning si `accepts_b2b_orders = false`.
- [ ] Lors du passage en default, remettre les autres lignes du partenaire a `is_default = false`.

### 3. Admin web

- [ ] Dans `admin_chrono/app/(dashboard)/partners/[id]/page.tsx`, ajouter un onglet ou bloc "Livreurs dedies".
- [ ] Afficher la liste :
  - [ ] nom/prenom ;
  - [ ] telephone ;
  - [ ] online/disponible ;
  - [ ] accepte B2B oui/non ;
  - [ ] badge "par defaut".
- [ ] Ajouter une recherche de livreurs existants.
- [ ] Permettre "Ajouter au partenaire".
- [ ] Permettre "Definir par defaut".
- [ ] Permettre "Retirer".
- [ ] Afficher un message clair si aucun livreur dedie n'est configure.
- [ ] Afficher les demandes de livreur dedie en attente pour ce partenaire.
- [ ] Permettre a l'admin de valider une demande en rattachant un livreur existant.
- [ ] Permettre a l'admin de refuser une demande avec un motif optionnel.

### 4. Portail partenaire

- [ ] Garder le rattachement final en lecture seule cote portail : le partenaire ne peut pas rattacher directement un livreur.
- [ ] Ajouter une action "Demander un livreur dedie".
- [ ] Ajouter un formulaire de demande avec :
  - [ ] nom du livreur si connu ;
  - [ ] telephone du livreur si connu ;
  - [ ] commentaire optionnel ;
  - [ ] type de demande : livreur connu, livreur rencontre via Krono, demande generale.
- [ ] Depuis l'historique ou le detail d'une commande, permettre "Demander ce livreur comme livreur dedie".
- [ ] Sur la creation de commande, afficher :
  - [ ] "Assignation automatique" ;
  - [ ] les livreurs dedies configurés ;
  - [ ] les livreurs non B2B en disabled avec un libelle clair.
- [ ] Si aucun livreur dedie n'est configure, expliquer que la commande partira aux livreurs B2B disponibles.
- [ ] Si aucun livreur dedie n'est configure, proposer au partenaire de faire une demande.
- [ ] Ne jamais laisser croire que le partenaire active lui-meme la reception B2B des livreurs ou rattache directement un livreur.

### 4 bis. Demandes de livreur dedie

- [ ] Prevoir une table ou un modele de demande de rattachement.
- [ ] Champs possibles :
  - [ ] `id`
  - [ ] `partner_id`
  - [ ] `request_type` : `known_driver`, `previous_krono_driver`, `general_request`
  - [ ] `driver_name`
  - [ ] `driver_phone`
  - [ ] `source_order_id`
  - [ ] `comment`
  - [ ] `status` : `pending`, `approved`, `rejected`
  - [ ] `reviewed_by_admin_id`
  - [ ] `review_note`
  - [ ] `created_at`
  - [ ] `reviewed_at`
- [ ] Ajouter une route portail pour creer une demande.
- [ ] Ajouter une route admin pour lister les demandes.
- [ ] Ajouter une route admin pour valider/refuser une demande.
- [ ] Lors de la validation, rattacher le livreur via `partner_drivers`.

### 5. Dispatch commande

- [ ] Confirmer le comportement souhaite :
  - Option A : priorite douce, le livreur dedie passe en premier puis fallback automatique.
  - Option B : assignation stricte, seul le livreur dedie recoit d'abord la commande pendant X secondes.
- [ ] Aligner la doc avec le code actuel.
- [ ] Verifier `notifyDriversForOrder` :
  - [ ] filtre d'abord les livreurs `accepts_b2b_orders = true` ;
  - [ ] priorise `preferred_driver_id` si present ;
  - [ ] fallback automatique si pas de livreur dedie disponible.
- [ ] Ajouter un log clair quand un `preferred_driver_id` est utilise.

### 6. Tournees B2B

- [ ] Verifier que `BatchShippingBottomSheet` utilise la meme logique de selection.
- [ ] Verifier que `batchController` assigne correctement une tournee au livreur dedie.
- [ ] Prevoir le meme affichage "Assignation automatique" vs "Livreur dedie".

### 7. Tests et validation

- [ ] Test backend : ajout d'un livreur dedie.
- [ ] Test backend : ajout impossible si user non driver.
- [ ] Test backend : un seul `is_default = true` par partenaire.
- [ ] Test portail : partenaire sans livreur dedie.
- [ ] Test portail : partenaire avec livreur dedie B2B active.
- [ ] Test portail : partenaire avec livreur dedie B2B desactive.
- [ ] Test dispatch : commande avec `preferred_driver_id`.
- [ ] Test dispatch : fallback quand le livreur dedie est offline.

## Decision produit recommandee

Je recommande l'Option A : priorite douce.

Pourquoi :

- elle garde la promesse "livreur dedie prioritaire" ;
- elle evite de bloquer une commande si le livreur dedie est offline ;
- elle correspond au fonctionnement actuel du backend ;
- elle reste simple a expliquer au partenaire : "on propose d'abord votre livreur dedie, sinon Krono trouve automatiquement un autre livreur B2B disponible."

## Parcours cible

1. Le partenaire demande un livreur dedie :
   - soit avec un nom ou un telephone ;
   - soit depuis une ancienne commande Krono ;
   - soit sans livreur precis.
2. L'admin ouvre la demande dans l'admin.
3. L'admin identifie ou choisit un livreur Krono.
4. L'admin verifie que le livreur existe et accepte les commandes B2B.
5. L'admin rattache le livreur au partenaire.
6. Optionnel : il le marque "par defaut".
7. Le partenaire cree une commande depuis le portail.
8. Le portail affiche ce livreur dans "Prioriser un livreur dedie".
9. Si le partenaire le selectionne, la commande part avec `preferred_driver_id`.
10. Le backend priorise ce livreur, puis retombe en automatique si necessaire.

## Points a clarifier avant dev complet

- Est-ce qu'un meme livreur peut etre dedie a plusieurs partenaires ?
- Est-ce que le partenaire peut voir le telephone du livreur dedie ?
- Est-ce que le partenaire peut choisir le livreur pour chaque commande, ou seulement utiliser le livreur par defaut ?
- Est-ce que Krono veut une assignation stricte pour certains partenaires premium ?
- Est-ce que les livreurs internes doivent rester prioritaires meme devant un livreur dedie ?
- Est-ce qu'une demande de livreur dedie doit notifier l'admin par email/WhatsApp ou seulement apparaitre dans l'admin ?
- Est-ce qu'un partenaire peut demander plusieurs livreurs dedies en meme temps ?
