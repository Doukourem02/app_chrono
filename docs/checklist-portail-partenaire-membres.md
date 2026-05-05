# Checklist - Portail partenaire - "2e membre" non voulu

## Contexte

- Lors de l'activation du portail partenaire (toggle business + forfait + boutique + email portail), un second membre apparait dans `Mon equipe`.
- Comportement attendu: tant que le proprietaire n'a pas invite explicitement un membre, l'equipe doit afficher 1 seul membre (le proprietaire reel).

## Diagnostic confirme (lecture seule)

- La page `Mon equipe` lit les membres depuis les lignes `partner_users`.
- Pendant l'activation partenaire, le backend peut rattacher automatiquement l'email portail comme `owner` dans `partner_users`.
- Ce rattachement auto cree un "faux" second membre sans invitation explicite.

## Regle metier a valider

- [ ] `Mon equipe` doit representer uniquement les membres explicitement rattaches par une action voulue (inscription proprietaire initiale ou invitation).
- [ ] `portal_email` ne doit pas creer un membre supplementaire automatiquement.
- [ ] Le compteur des membres doit rester coherent avec cette regle.

## Plan de correction (avant code)

- [ ] Modifier le flux d'activation pour ne plus inserer automatiquement un `partner_users` supplementaire via `portal_email`.
- [ ] Conserver l'envoi de lien d'acces portail si necessaire, mais sans rattachement membre automatique.
- [ ] Garder le mecanisme d'invitation manuelle comme unique voie d'ajout de membres.
- [ ] Verifier que l'affichage "Mon equipe" reste base sur les membres reels.

## Nettoyage des donnees existantes

- [ ] Identifier les partenaires ayant des `owner` dupliques non invites.
- [ ] Definir un critere de suppression securise des rattachements auto non voulus.
- [ ] Executer un nettoyage controle (script/migration) apres validation.

## Plan de tests

- [ ] Cas 1: Activation portail avec email portail different -> `Mon equipe` affiche 1 membre.
- [ ] Cas 2: Invitation manuelle depuis le portail -> `Mon equipe` passe de 1 a 2 membres.
- [ ] Cas 3: Reactivation business d'un partenaire existant -> aucun membre fantome ajoute.
- [ ] Cas 4: Compteur "X membres" coherent avec le tableau.

## Validation metier finale

- [ ] Captures avant/apres sur un partenaire de test.
- [ ] Confirmation produit: "aucun ajout de membre sans invitation explicite".
- [ ] Go explicite avant de deployer en production.

## Checklist - Incoherence "Plan actuel" vs "Abonnement actif"

### Contexte

- Constataion observee: l'admin voit `Plan actuel = Pro`, mais le portail partenaire affiche `Aucun abonnement actif`.
- Attendu: le plan visible et l'abonnement actif doivent rester synchronises.

### Diagnostic confirme (lecture seule)

- [ ] Cote admin, le KPI "Plan actuel" lit principalement `partners.plan`.
- [ ] Cote portail partenaire, la facturation lit `active_subscription` (ligne `partner_subscriptions` avec `is_active = true`).
- [ ] Si `partners.plan` est renseigne mais qu'aucune souscription active n'existe, l'UI portail affiche logiquement "Aucun abonnement actif".

### Regle metier a valider

- [ ] Definir la source de verite principale (recommande: `partner_subscriptions` actives).
- [ ] Imposer la coherence: un plan affiche comme actif doit toujours avoir une souscription active associee.
- [ ] Clarifier le cas "sans abonnement": plan `none` ou absence totale de souscription active.

### Plan de correction (avant code)

- [ ] Harmoniser la logique d'affichage entre ecran admin et portail partenaire.
- [ ] Eviter qu'un changement de `partners.plan` se fasse sans creation/activation de la souscription correspondante.
- [ ] Ajouter des garde-fous backend sur les flux d'activation/mise a jour de statut partenaire.
- [ ] Definir un fallback UI explicite si donnees temporairement incoherentes.

### Nettoyage des donnees existantes

- [ ] Identifier les partenaires avec `partners.plan` renseigne mais zero souscription active.
- [ ] Decider la correction par partenaire: soit creer/activer la bonne souscription, soit rebasculer le plan sur `none`.
- [ ] Executer un correctif de donnees controle (script SQL/backend) avec validation manuelle.

### Plan de tests

- [ ] Cas 1: partenaire avec plan choisi a l'inscription puis activation admin -> abonnement actif visible des 2 cotes.
- [ ] Cas 2: partenaire sans abonnement actif -> admin et portail affichent tous deux "Aucun" de facon coherente.
- [ ] Cas 3: changement de plan -> mise a jour consistente des KPI et de la section facturation.
- [ ] Cas 4: reactivation partenaire existant -> pas de desynchronisation plan/souscription.
