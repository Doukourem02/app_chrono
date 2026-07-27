# Krono — Roadmap produit (post-lancement)

Ce fichier liste les évolutions prévues **après le lancement**, pas prioritaires aujourd'hui — aucune de ces features n'est en cours de construction. Contenu déplacé depuis `docs/taches.md` le 2026-07-27 pour ne pas mélanger le backlog immédiat avec la vision long terme.

---

## Feature Commissionnaire (B2C, hors périmètre B2B)

Concept distinct du B2B classique : le livreur agit à la place du client (courses, achats ponctuels) plutôt que de livrer un colis déjà prêt point A → point B. Aucun code n'existe. Documentation détaillée à écrire dans `docs/commissionnaire.md` une fois les décisions prises — pas prioritaire pour l'instant.

Esquisse de discussion du 2026-07-27, à affiner plus tard, pas encore une décision finale :
- **Flux envisagé** : la cliente poste une annonce (tâche + budget achat + rémunération proposée) ; un livreur voit l'annonce (comme une commande classique) et accepte/décline ; le livreur va chez la cliente, **reçoit le cash de l'achat en main propre** (pas d'avance Krono, pas d'escrow — réglé pour une course de 100 000 FCFA) ; fait la course ; revient ; la cliente le paie pour le service **après** la course.
- **Commission envisagée** : uniquement sur la rémunération du service (traitée comme un prix de course normal), jamais sur l'argent de l'achat qui n'est qu'un pass-through cliente → livreur.
- **Point bloquant identifié, pas résolu** : rien n'empêche le livreur de fuir avec le cash de l'achat remis en main propre — mécanisme de confiance/vérification à définir (ex. réserver cette feature aux livreurs déjà notés/vérifiés) avant tout code.
- Reste aussi à décider : plafond budget achat, vérification de l'achat (reçu ?), gestion des litiges.

## Phase 1bis / Phase 2 — Monétisation scale

- **Paiement abonnement récurrent / automatisé** (prestataires locaux : OM, Wave, MTN) — aujourd'hui un partenaire paie son abonnement manuellement ; ça automatiserait le renouvellement via mobile money.
- **Renouvellement auto `partner_subscriptions`** (`cancelled_at`, politique `ends_at` nullable) — l'abonnement se relance seul à échéance au lieu que quelqu'un le refasse à la main.

## Phase 2 — ~6 mois après lancement

- **Portail partenaire : Facturation + Équipe (self-service)** — le partenaire gère lui-même sa facturation et son équipe, sans passer par Krono.
- **Table `partner_api_keys`** + **Endpoint `POST /api/partner/orders`** (Axe 3) — un partenaire pourrait créer des commandes depuis son propre système (caisse, site web) au lieu de taper manuellement dans l'app/portail.
- **Webhooks signés avec retries** — le système du partenaire est notifié automatiquement des changements de statut d'une commande.
- **WhatsApp bot pour création de commande rapide** — créer une commande en discutant avec un bot WhatsApp, sans ouvrir l'app.

## Phase 3 — ~12 mois et au-delà

- **Marque blanche** (Axe 4) — un partenaire peut habiller l'app à ses propres couleurs/nom.
- **Flotte dédiée Enterprise** (Axe 5) — des livreurs réservés à un seul gros client.
- **Publicité et analytics** (Axe 6) — espace pub et statistiques avancées.
- **Séparation `partner_chrono` en app indépendante** si nécessaire.
