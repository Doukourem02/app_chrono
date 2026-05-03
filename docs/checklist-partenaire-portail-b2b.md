# Checklist — portail partenaire B2B

- [ ] **Passer tous les `partner_users` en `owner` et n’accepter que `owner` côté API** — pour un seul modèle d’accès web et éviter un rôle `manager` encore en base alors qu’on ne veut plus le produit ainsi.

- [ ] **Retirer la logique « manager » dans le layout et la page Mon équipe** (menu, textes, invitation « manager ») — pour que l’UI colle au même modèle et ne suggère pas un accès restreint imposé par Krono.

- [ ] **Aligner les types TypeScript (`role`, `invitePartnerUser`, etc.)** — pour éviter incohérences et bugs entre front et réalité des données.

- [ ] **Vérifier ou implémenter `POST /api/partners/:id/users/invite` (ou retirer l’appel)** — le front l’utilise pour l’équipe ; sans route valide, la fonctionnalité est inutile ou cassée.

- [ ] **Revue courte des droits admin Krono vs portail partenaire** — pour qu’un compte partenaire ne puisse pas déclencher des actions réservées à l’équipe Krono.

- [ ] **Une phrase côté doc / FAQ partenaire : qui est invité au portail = leur choix** — pour clarifier la responsabilité sans alourdir le produit.
