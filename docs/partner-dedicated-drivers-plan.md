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

L'admin pourra :

- voir les livreurs dedies du partenaire ;
- ajouter un livreur existant ;
- retirer un livreur ;
- definir un livreur par defaut ;
- voir si le livreur accepte les commandes B2B ;
- voir son statut online/disponible.

Le portail partenaire ne doit pas servir a rattacher des livreurs. Il doit seulement proposer les livreurs deja configures par Krono.

Phrase front a utiliser dans la section livreur dedie :

> "Livreur dédié : Krono propose d’abord la commande au livreur sélectionné pour ce partenaire. Si aucun livreur dédié n’est disponible, l’assignation automatique prend le relais."

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

### 4. Portail partenaire

- [ ] Garder le portail en lecture seule sur les livreurs dedies.
- [ ] Sur la creation de commande, afficher :
  - [ ] "Assignation automatique" ;
  - [ ] les livreurs dedies configurés ;
  - [ ] les livreurs non B2B en disabled avec un libelle clair.
- [ ] Si aucun livreur dedie n'est configure, expliquer que la commande partira aux livreurs B2B disponibles.
- [ ] Ne jamais laisser croire que le partenaire active lui-meme la reception B2B des livreurs.

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

1. L'admin ouvre la fiche partenaire.
2. Il va dans "Livreurs dedies".
3. Il recherche un livreur Krono.
4. Il l'ajoute au partenaire.
5. Optionnel : il le marque "par defaut".
6. Le partenaire cree une commande depuis le portail.
7. Le portail affiche ce livreur dans "Prioriser un livreur dedie".
8. Si le partenaire le selectionne, la commande part avec `preferred_driver_id`.
9. Le backend priorise ce livreur, puis retombe en automatique si necessaire.

## Points a clarifier avant dev complet

- Est-ce qu'un meme livreur peut etre dedie a plusieurs partenaires ?
- Est-ce que le partenaire peut voir le telephone du livreur dedie ?
- Est-ce que le partenaire peut choisir le livreur pour chaque commande, ou seulement utiliser le livreur par defaut ?
- Est-ce que Krono veut une assignation stricte pour certains partenaires premium ?
- Est-ce que les livreurs internes doivent rester prioritaires meme devant un livreur dedie ?
