# Mode d'emploi Krono

Ce guide explique comment utiliser Krono, du point de vue de chaque personne qui touche la plateforme : le client qui envoie un colis, le chauffeur qui livre, le petit commerçant qui vend en ligne, l'entreprise partenaire abonnée, et l'équipe Krono qui supervise tout.

Krono, c'est 4 applications qui parlent entre elles en temps réel :

| Application | Pour qui | Rôle |
|---|---|---|
| **app_krono** | Client particulier et commerçant | Créer des livraisons, suivre le colis, payer |
| **driver_krono** | Chauffeur | Accepter des courses, livrer, être payé |
| **admin_krono** (espace admin) | Équipe Krono | Superviser toute la plateforme |
| **admin_krono** (espace partenaire) | Entreprise partenaire B2B | Passer des commandes, suivre le quota, facturer |

---

## 1. Les profils qui utilisent Krono

Krono sert 4 profils différents, avec la même application mobile pour les 3 premiers :

| Profil | Qui c'est | Volume | Où ça se passe |
|---|---|---|---|
| **Client particulier** | Monsieur/Madame tout le monde qui envoie un colis ponctuel | 1 commande à la fois | App client, mode standard |
| **Petit commerçant** | Boutique de quartier, vendeuse TikTok/Instagram | 5–20 livraisons/jour | App client, mode business activé |
| **Vendeur à volume** | Live-selling, promotion ponctuelle avec beaucoup de colis d'un coup | 20+ livraisons en une session | App client, mode business, tournée |
| **Entreprise partenaire** | Restaurant, pharmacie, chaîne de boutiques | Régulier et prévisible, avec abonnement | Portail web dédié + app pour ses commandes |

Un client peut passer de "particulier" à "commerçant" à tout moment depuis son profil : c'est un **réglage du compte**, pas un compte différent. C'est le même identifiant, le même historique.

### 1.1 Ce que Krono distingue vraiment (et ce qu'il ne distingue pas)

Ce tableau de 4 profils est un vocabulaire **produit/stratégie**, utile pour parler du marché. Mais techniquement, Krono ne reconnaît que **deux distinctions réelles** :

1. **`is_business`** : `false` (mode standard) ou `true` (mode business). C'est un simple réglage du compte, rien de plus.
2. **Rattachement à un partenaire** (`partner_id`, table `partners`) : absent, ou présent avec un forfait (Starter / Pro / Business / aucun).

**Conséquence importante : "Petit commerçant" et "Vendeur à volume" ne sont PAS deux comptes ou deux réglages différents.** C'est le **même compte business**, avec `is_business = true`. Krono ne demande jamais "es-tu un petit commerçant ou un vendeur à volume ?" — dès que le mode business est activé, les deux boutons **"Nouvelle Livraison"** et **"Tournée Lots"** apparaissent en même temps sur l'accueil (voir section 4.3). L'utilisateur choisit l'un ou l'autre selon son besoin du moment, pas selon une catégorie qui lui serait assignée.

**Seule "Entreprise partenaire" est une distinction réelle en base de données** : c'est une ligne dans la table `partners`, avec un forfait (Pro ou Business) qui donne accès au portail web. C'est ce rattachement — pas le volume de commandes — qui fait passer un compte de "commerçant en mode business" à "entreprise partenaire".

**Pourquoi le portail existe vraiment** : ce n'est pas seulement une question d'écran plus confortable pour une entreprise qui travaille depuis un bureau (même si c'est un vrai plus). La raison structurelle, c'est qu'un compte `is_business=true` dans l'app mobile appartient à **une seule personne, un seul login** — rien ne permet à 2 ou 3 personnes de se connecter séparément et de voir les mêmes commandes, le même quota, la même facturation. Dès qu'une entreprise a besoin que **plusieurs personnes** (plusieurs gérants) partagent un même compte et les mêmes données, elle doit passer par une fiche `partners` reliée à plusieurs comptes via `partner_users` — voir la simulation MedExpress plus bas. Et dans l'autre sens, un compte personnel ne peut être rattaché qu'à **un seul** partenaire à la fois (pas de "plusieurs entreprises gérées par un même compte").

#### Simulation — Fatou (petit commerçant *et* vendeuse à volume, même compte)

```
1. Fatou télécharge app_krono, s'inscrit, vérifie son OTP.
2. Onboarding : "Tu vends des colis à des clients ?" → elle répond "Oui, pour mon activité pro".
3. Elle saisit "Boutique Fatou Style" comme nom d'entreprise.
4. Elle choisit le forfait "Paiement à la course" (elle ne sait pas encore son volume) + entre son e-mail.
5. Elle appuie "Envoyer ma demande".

→ Dès cet instant (avant même qu'un admin Krono ne regarde le dossier), le backend a déjà :
  - mis is_business = true sur son compte,
  - créé une fiche dans la table `partners` ("Boutique Fatou Style", statut "pending"),
  - relié son compte à cette fiche.
  → Résultat immédiat : l'accueil de Fatou affiche "Nouvelle Livraison" ET "Tournée Lots",
    et les DEUX fonctionnent tout de suite, sans attendre l'admin.

Lundi (petit commerçant) : une cliente lui commande une robe.
  → Fatou tape "Nouvelle Livraison" → un seul colis, un seul destinataire. Ça marche.

Samedi soir (vendeuse à volume) : elle fait un live TikTok, 15 ventes en une heure.
  → Fatou tape "Tournée Lots" → ajoute ses 15 destinataires un par un → "Lancer la
    tournée". Ça marche aussi, tout de suite, sans validation admin préalable.

C'est la MÊME Fatou, le MÊME compte, le MÊME is_business=true toute la semaine.
Krono ne l'a jamais fait "changer de profil" entre lundi et samedi.

Ce que la validation admin change concrètement (pas si elle peut utiliser l'app,
mais combien ça lui coûte et ce qu'elle peut voir) :
  - Avant activation ("pending") : chaque livraison est facturée au taux par défaut
    (7 %, celui du "paiement à la course"), et il n'y a pas de portail web.
  - Après activation ("active") par un admin : si elle avait choisi Starter/Pro/Business,
    le taux réduit du forfait s'applique. Le portail web ne s'ouvre, en plus, que si
    le forfait est Pro ou Business (Starter reste app uniquement, voir section 6).
```

#### Simulation — MedExpress (entreprise partenaire, vraie distinction technique)

```
1. MedExpress a déjà des comptes app_krono en mode business chez ses 3 gérants
   (is_business=true chacun), sans lien entre eux.
2. Un admin Krono crée une fiche dans la table `partners` : "MedExpress",
   plan="pro", commission_rate calculée par le plan.
3. L'admin lie chaque gérant à cette fiche via `partner_users`
   (partner_id = MedExpress.id pour les 3).
4. Les 3 comptes se reconnectent → partner_id disponible → accès débloqué
   au portail web `/partner/MedExpress-id/dashboard` (Pro/Business uniquement).

→ Ici, la distinction est réelle : une ligne `partners`, un plan payant,
  un accès portail. Ce n'est plus juste un réglage `is_business` sur un
  compte individuel — c'est un contrat d'entreprise avec plusieurs comptes
  rattachés à la même fiche.
```

**Attention au sens de la relation** : c'est **plusieurs personnes → une seule entreprise**, jamais l'inverse. Krono ne permet pas à une personne de gérer plusieurs entreprises différentes depuis un seul compte — chaque compte personnel ne peut être lié qu'à un seul `partner_id` à la fois. Ce que MedExpress illustre, c'est uniquement le fait que plusieurs logins individuels (Moussa, Awa, Koffi) peuvent partager les mêmes commandes, le même quota et la même facturation, parce qu'ils sont tous rattachés à la même fiche.

---

## 2. Application client — utilisation de base

### 2.1 Créer une livraison simple

Depuis l'accueil, on appuie sur la carte **"Nouvelle Livraison"**. L'écran de création de course s'ouvre :

1. **"Où récupérer"** — adresse de collecte, saisie avec autocomplétion (suggestions d'adresses en temps réel).
2. **"Où livrer"** — adresse du destinataire, même autocomplétion.
3. **Choix du service** — actuellement, seule la **livraison à moto** est activée côté client (Voiture et Cargo apparaissent en grisé avec le message *"Pour l'instant, Krono propose uniquement la livraison à moto"*). Trois options de moto sont proposées :
   - **Express** — livraison rapide en ville (~15–20 min).
   - **Standard** — livraison optimisée au meilleur tarif (~25–30 min).
   - **Programmée** — on choisit un horaire à l'avance.
4. On appuie sur **"Choisir le type de course"**, puis on valide le prix affiché (base + distance + option choisie — jamais un prix caché).
5. Un **livreur est recherché** : l'écran affiche "Recherche" sans donner de temps tant qu'aucun chauffeur n'a accepté.

### 2.2 Suivre la livraison

Une fois un livreur trouvé, l'écran de suivi (et l'îlot dynamique / écran verrouillé sur iPhone) affiche toujours une information claire :

| Ce qui se passe | Ce que le client voit |
|---|---|
| Recherche d'un livreur | "Recherche livreur" |
| Livreur en route vers le point de collecte | "Prise en charge dans X min" |
| Livreur arrivé au point de collecte | "Livreur arrivé" |
| Colis récupéré, en route vers le destinataire | "Livraison dans X min" |
| Livreur arrivé chez le destinataire | "Livreur arrivé" |
| Colis remis | "Livraison terminée" |

Le client peut à tout moment **appeler ou envoyer un message** au livreur depuis l'écran de suivi. Un lien de suivi public (`/track/...`) peut aussi être partagé avec le destinataire, sans qu'il ait besoin de l'app.

### 2.3 Preuve de livraison (QR)

Chaque commande a son propre **QR code de remise** : ce n'est pas un QR de paiement, c'est une preuve que le colis a bien été remis. Au moment de la livraison, le chauffeur scanne ce QR (ou saisit un code à 6 chiffres si le scan est impossible). Si aucune des deux méthodes ne fonctionne, une preuve alternative encadrée est utilisée (photo + nom/signature du destinataire + position GPS + horodatage).

### 2.4 Payer sa livraison

Les moyens de paiement proposés dans l'app :

| Moyen | Disponibilité |
|---|---|
| **Orange Money** | Si configuré comme méthode enregistrée |
| **Wave** | Si configuré comme méthode enregistrée |
| **MTN Money** | Si configuré comme méthode enregistrée |
| **Espèces** | Toujours disponible |
| **Paiement différé** | Disponible selon éligibilité : un crédit mensuel plafonné (ex. montant maximum/mois et nombre d'utilisations max/mois) ; peut être temporairement indisponible avec un délai avant réactivation |

Le prix affiché avant validation reste le prix de référence de la course ; un supplément éventuel après validation est toujours expliqué et rattaché à la commande.

**Précision utile** : le paiement en espèces et le paiement différé sont pleinement opérationnels. Le paiement mobile money en ligne (Orange Money, Wave, MTN Money) est encore en cours d'intégration réelle côté serveur — un garde-fou technique bloque volontairement tout encaissement réel en production tant que l'intégration avec les opérateurs n'est pas finalisée.

### 2.5 Après la livraison

- **Note et avis** sur le chauffeur.
- **Historique des commandes** avec statuts détaillés, accessible depuis "Suivis de Colis" (mode standard).
- **Points de fidélité** et méthodes de paiement enregistrées pour les prochaines fois.
- **Messagerie** conservée avec le chauffeur en cas de litige ou question.

---

## 3. Application chauffeur — utilisation de base

### 3.1 Se mettre disponible

Le chauffeur bascule son statut **en ligne / hors ligne** depuis l'app. Tant qu'il est hors ligne, il ne reçoit aucune proposition de course.

### 3.2 Recevoir une course simple

Pour une commande classique (1 client, 1 livraison), le chauffeur reçoit une **popup d'acceptation** avec un délai de réponse (accepter ou décliner). S'il accepte :

1. Navigation guidée jusqu'au point de collecte.
2. Récupération du colis (vérification, puis passage au statut suivant).
3. Navigation jusqu'au destinataire.
4. Remise du colis validée par **scan QR**, **saisie du code**, ou **preuve alternative** si besoin.

### 3.3 Revenus et commission

- Le chauffeur voit ses **revenus** par période (jour / semaine / mois / tout), par type de véhicule, avec l'historique détaillé des commandes.
- Un **solde de commission** est affiché avec des alertes visuelles (vert / orange / rouge selon le niveau) quand le solde devient faible ou est suspendu.
- Le chauffeur peut recharger sa commission.
- **Gamification** : badges, classement, objectifs — pour valoriser l'activité sans infantiliser.

### 3.4 Notifications

Le chauffeur ne reçoit **jamais de notification push classique** pour une offre de course ou un changement de statut : tout passe par une connexion en temps réel (socket) tant que l'app est ouverte. Une notification push existe uniquement en secours, si le chauffeur est hors ligne au moment où une tournée B2B lui est proposée (voir section 5).

---

## 4. Passer en mode business (petit commerçant / vendeur à volume)

N'importe quel client peut activer le **mode business** depuis son profil, ou dès l'inscription. C'est un réglage personnel (`is_business`), distinct d'un contrat d'entreprise formel (voir section 6).

### 4.1 Étapes de l'activation

1. **Question** : *"Tu vends des colis à des clients ?"*
   - **"Oui, pour mon activité pro"** → passe à l'étape suivante.
   - **"Non, pour un usage perso"** → reste en mode standard, rien ne change.
2. **Nom de l'entreprise** — ce nom apparaîtra sur les commandes et factures (ex. "Boutique Fatou Style").
3. **Choix d'un forfait** (voir grille tarifaire ci-dessous) + **e-mail pour le portail partenaire**. Ce champ e-mail est demandé à **tout le monde**, quel que soit le forfait choisi — mais il ne sera réellement utilisé que si le forfait donne accès au portail (Pro ou Business) : c'est uniquement dans ce cas qu'un lien de connexion sera un jour envoyé à cette adresse. Sur Starter ou "Paiement à la course", l'e-mail est demandé mais ne servira à rien tant qu'aucun changement de forfait n'intervient. Message affiché : *"① Vous choisissez un forfait ② Un admin Krono valide votre demande ③ Vous recevez un lien d'accès au portail partenaire."*
4. La demande est envoyée. Elle est examinée par l'équipe Krono — **aucune facturation avant activation**.

Le mode business peut être coupé à tout moment depuis le profil, sans perdre l'agrément déjà obtenu auprès de Krono : le rebasculer en mode business ne redemande pas de validation si l'entreprise est déjà validée.

### 4.2 Grille tarifaire B2B

| Forfait | Prix mensuel | Livraisons incluses | Frais dans le quota | Frais au-delà du quota |
|---|---|---|---|---|
| **Paiement à la course** | Aucun abonnement | — | 7 % sur chaque livraison | Identique |
| **Starter** | 8 000 FCFA | 35 | 5 % | 6 % |
| **Pro** *(recommandé)* | 16 000 FCFA | 70 | 3 % | 5 % |
| **Business** | 29 000 FCFA | 110 | 2 % | 3 % |

Sans abonnement, chaque livraison est facturée à 7 % (le taux le plus élevé, pour inciter à prendre un forfait si le volume augmente). Seuls les forfaits **Pro** et **Business** donnent accès au portail web dédié (section 6) ; **Starter** reste utilisable uniquement depuis l'app mobile.

**À ne pas confondre** : cette grille décrit ce que Krono facture au commerçant pour utiliser la plateforme (un abonnement mensuel fixe et/ou un pourcentage prélevé sur chaque livraison). Ça n'a rien à voir avec le **moyen de paiement d'une livraison précise** (Orange Money, Wave, espèces, paiement différé — section 2.4), ni avec la façon dont le livreur est payé (section 3.3, indépendant du forfait de Fatou).

Concrètement, ce pourcentage s'ajoute au prix de base de la livraison plutôt que d'en être retranché : une livraison à 1 500 FCFA revient à 1 605 FCFA sur "Paiement à la course" (+7 %), ou à 1 575 FCFA sur Starter (+5 %). Ce montant est payé soit par le compte business de Fatou, soit par le destinataire si cette option a été choisie (section 2.4).

### 4.3 Ce que le mode business débloque dans l'app

Une fois activé, l'accueil affiche deux cartes au lieu des cartes standards :

- **"Nouvelle Livraison"** — envoyer un colis à un client, exactement le même parcours que la livraison simple décrite en section 2 (adresses, choix moto/service, paiement).
- **"Tournée Lots"** — envoyer plusieurs colis d'un coup à des destinataires différents (voir 4.4).

---

## 4.4 Créer une tournée groupée ("Tournée Lots")

C'est la fonctionnalité clé pour un vendeur qui doit livrer beaucoup de destinataires en une seule sortie (ex. après un live de vente). La création se fait en 4 étapes :

**Étape 1 — Destinataires**
- Une **adresse de départ** (pré-remplie avec la position actuelle, modifiable).
- On ajoute chaque destinataire un par un : **nom**, **téléphone**, **adresse de livraison** (autocomplétion obligatoire — il faut sélectionner une suggestion pour fixer le point GPS), une **note libre** facultative, et des **consignes prédéfinies** cochables ("Demander le code de livraison", "Appeler le client avant d'arriver").
- La liste des destinataires ajoutés s'affiche avec un numéro, en attendant de passer à l'étape suivante ("Suivant · N destinataire(s)").

**Étape 2 — Livreur attitré (facultatif)**
- **"Assignation automatique"** : Krono choisit le premier livreur disponible. C'est l'option par défaut.
- Ou choix d'un **livreur dédié** au compte (s'il en existe) : nom, téléphone, disponibilité affichée. Un livreur qui n'a pas activé les tournées B2B apparaît grisé avec la mention "tournées non activées".

**Étape 3 — Récapitulatif**
- Adresse de départ, livreur choisi, et la liste complète des livraisons.
- Bouton **"Lancer la tournée"**.

**Étape 4 — Tournée créée**
- Confirmation **"Tournée lancée !"** avec le nombre de livraisons et un identifiant de tournée.
- Un **ordre de passage conseillé** est affiché (calculé automatiquement pour minimiser la distance parcourue), mais ce n'est qu'une suggestion.

**Précision** : "Tournée Lots" fonctionne dès que l'onboarding business est terminé (voir section 1.1) — pas besoin d'attendre une validation admin. Le seul cas où le bouton "Lancer la tournée" ne produit aucun effet visible (aucun message d'erreur explicite) est un compte resté sans `partner_id` du tout, ce qui n'arrive normalement que si l'envoi de la demande de forfait a échoué (ex. coupure réseau pendant l'onboarding) — se reconnecter ou refaire la demande de forfait résout ce cas rare.

Ce qui se passe ensuite côté chauffeur est détaillé en section 5.

---

## 5. Comment une tournée B2B est livrée, côté chauffeur

C'est le point le plus important à bien comprendre : **une tournée de N livraisons génère une seule notification**, pas N popups séparées.

### 5.1 Réception de la tournée

- Le chauffeur reçoit un événement temps réel "nouvelle tournée" avec le nombre de livraisons (ex. *"Nouvelle tournée B2B – 18 livraisons à effectuer"*).
- Une popup propose **Accepter** ou **Refuser**.
- Si le chauffeur est hors ligne au moment de l'envoi, il reçoit à la place une **notification push classique** qui l'amène directement sur l'écran de la tournée à l'ouverture de l'app.
- S'il refuse, cette tournée précise ne lui sera pas reproposée dans la foulée.

### 5.2 Phase collecte (aller chercher tous les colis)

- Dès que la tournée est acceptée et chargée, la **navigation vers le point de collecte démarre automatiquement** — pas besoin d'appuyer sur un bouton "Je pars".
- À l'arrivée sur place (détectée automatiquement par GPS), un bouton apparaît : **"Tous les colis récupérés"**.
- En appuyant dessus, la collecte est confirmée pour l'ensemble de la tournée en une seule fois — pas colis par colis.
- Si la tournée n'a pas de coordonnées de collecte précises, le même bouton s'affiche directement, sans navigation automatique.

### 5.3 Phase livraison (stop par stop)

Une fois la collecte confirmée, l'écran de tournée affiche la **liste des arrêts**, dans l'ordre conseillé, avec une barre de progression ("X/Y arrêts traités").

Pour chaque arrêt, le chauffeur voit : le nom du destinataire, l'adresse, les consignes éventuelles, et un bouton **"Fiche"** pour consulter tous les détails (notes, mode de service, informations partenaire).

Trois actions possibles par arrêt :
- **Démarrer** — lance la navigation GPS vers ce destinataire précis.
- **Scanner QR** — scan du QR code de preuve de remise.
- **Entrer le code** — saisie manuelle d'un code à 6 chiffres si le scan est impossible.
- **Preuve alternative** — si ni le QR ni le code ne fonctionnent : une photo est prise + le nom/signature du destinataire est saisi.
- Un **appui long** sur "Preuve alternative" permet d'**annuler** cette livraison précise (avec confirmation).

Important : le chauffeur **choisit librement l'ordre** dans lequel il traite les arrêts — l'ordre conseillé n'est qu'une suggestion, jamais une contrainte. Une fois un arrêt validé, l'app propose automatiquement de naviguer vers l'arrêt suivant, mais le chauffeur peut choisir un autre arrêt à la place.

**Règle essentielle** : chaque livraison de la tournée doit avoir **sa propre preuve** — le fait d'accepter la tournée en bloc ne dispense jamais de valider individuellement chaque colis.

### 5.4 Fin de la tournée

Quand tous les arrêts sont traités (livrés ou annulés), l'écran affiche **"Tournée terminée !"** (ou *"Tournée partiellement terminée"* s'il y a eu des annulations), avec le décompte livrées/annulées, et un bouton **"Retour à l'accueil"**.

---

## 6. Portail partenaire (entreprise B2B avec contrat formel)

### 6.1 Différence avec le "mode business"

Le mode business (section 4) est une simple déclaration personnelle dans l'app. Le **partenariat** est un contrat formel entre Krono et une entreprise, avec une fiche dédiée, un quota mensuel, une facturation automatique et — pour les forfaits **Pro** et **Business** uniquement — un accès à un **portail web**.

Le parcours normal : demande depuis l'app (section 4.1) → validation et activation par un admin Krono → un lien d'accès au portail est envoyé par e-mail à l'adresse renseignée à l'étape "forfait".

### 6.2 Se connecter au portail

Le lien reçu par e-mail permet la première connexion. Si l'e-mail n'a pas été reçu, l'option "Mot de passe oublié" sur la page de connexion du portail permet aussi de définir un mot de passe pour la première fois.

**Le portail est bloqué** (message explicite affiché) si :
- Le forfait est **Starter** ou **paiement à la course** — un message invite à passer à Pro ou Business.
- Le partenariat est **en attente de validation** par Krono.
- Le partenariat a été **désactivé ou suspendu** — contacter le support Krono.

### 6.3 Ce qu'on trouve dans le portail

- **Tableau de bord** — KPIs du jour, barre de quota mensuel ("Quota restant"), alerte si le quota est dépassé ("les courses supplémentaires sont facturées au taux excédent"), liste des commandes du jour.
- **Commandes** — filtrage par date et statut, création d'une nouvelle commande directement depuis le portail (avec choix "Assignation automatique" ou un livreur dédié).
- **Facturation** *(réservé au rôle propriétaire du compte)* — forfait en cours, quota, historique des factures mensuelles.
- **Équipe** *(réservé au rôle propriétaire)* — gestion des membres ayant accès au portail, invitations.

Un partenaire ne voit jamais les autres partenaires, ni les livreurs et leurs commissions, ni les finances globales de Krono.

### 6.4 Livreurs dédiés

Une entreprise partenaire peut demander à Krono un ou plusieurs **livreurs attitrés**. Krono propose d'abord la commande à ce livreur ; s'il n'est pas disponible, l'assignation automatique prend le relais. Le rattachement d'un livreur à un partenaire reste toujours une action effectuée par l'équipe Krono, jamais directement par le partenaire.

### 6.5 Facturation mensuelle

Le 1er de chaque mois, une facture est générée automatiquement pour chaque partenaire actif : le montant du forfait, plus un éventuel surplus si le quota a été dépassé ce mois-là.

---

## 7. Les différents types de livraison Krono (récapitulatif)

| Type | Qui la crée | Ce qui la distingue |
|---|---|---|
| **En ligne classique** | Client particulier depuis l'app | Parcours standard : adresses, moto, paiement |
| **Hors-ligne / opérateur** | Équipe Krono (téléphone, sans app) | Commande saisie manuellement côté admin |
| **Téléphonique** | Équipe Krono, coordonnées approximatives | Variante de la commande hors-ligne |
| **B2B planning** | Commerçant en mode business ou partenaire | Rattachée à une entreprise, badge visible côté chauffeur |
| **Tournée (batch)** | Commerçant (mode business) ou partenaire, ou admin | Plusieurs livraisons regroupées en une sortie, une seule notification chauffeur |

---

## 8. Espace admin Krono (équipe interne uniquement)

Réservé à l'équipe Krono — jamais accessible aux partenaires. Il permet de superviser toute la plateforme :

- **Tableau de bord** — KPIs, revenus, livraisons en temps réel.
- **Tracking live** — suivi de tous les chauffeurs et livraisons en cours sur une carte.
- **Commandes** — vue et gestion de toutes les commandes de la plateforme.
- **Utilisateurs / Chauffeurs** — création, recherche, statut, solde de commission, recharge/suspension.
- **Partenaires B2B** — création de fiches partenaires, activation, abonnements, livreurs dédiés, factures.
- **Flotte** — véhicules, carburant, maintenance, documents réglementaires.
- **Finances** — transactions, commissions, statistiques financières.
- **Messagerie, évaluations, codes promo, réclamations, rapports exportables.**

---

## 9. Notifications — ce qu'il faut savoir

- **Client / destinataire** : notification par l'app si un compte Krono existe, sinon par SMS ou WhatsApp selon la configuration, avec un lien de suivi.
- **Chauffeur** : jamais de notification push pour une offre ou un statut tant que l'app est connectée — tout passe par une connexion temps réel ; la push n'intervient qu'en secours si le chauffeur est hors ligne à la réception d'une tournée.
- **Code de livraison B2B** : à l'acceptation d'une tournée, chaque destinataire reçoit son code de réception individuel (par push si compte Krono, sinon par WhatsApp avec repli SMS).
- **Admin Krono** : les événements (commande créée, assignée, annulée, statut mis à jour) apparaissent dans le tableau de bord — pas de notification push.

---

## 10. Questions fréquentes

**Je suis commerçant, j'ai activé le mode business mais un bouton ne fonctionne pas.**
"Nouvelle Livraison" et "Tournée Lots" fonctionnent tous les deux dès la fin de l'onboarding business (dès l'étape "forfait" validée), sans attendre de validation admin — voir section 1.1. Si vraiment aucun des deux ne répond, c'est probablement que la demande de forfait n'a jamais abouti côté serveur (coupure réseau pendant l'inscription) : se reconnecter, ou refaire la demande de forfait depuis le profil. Ce que la validation admin change, ce n'est pas si les boutons marchent, mais le **taux de commission appliqué** (taux réduit du forfait une fois validé, sinon taux par défaut 7 %) et l'**accès au portail web** (Pro/Business uniquement, voir section 6).

**Je suis chauffeur et je ne reçois pas les tournées.**
Vérifier que l'app est bien connectée (statut en ligne) — les tournées passent en temps réel tant que la connexion est active ; sinon une notification de secours doit arriver à l'ouverture de l'app.

**Le QR code ne scanne pas.**
Utiliser la saisie manuelle du code à 6 chiffres affiché côté destinataire, ou la preuve alternative (photo + signature) si aucune des deux méthodes ne fonctionne.

**Je veux passer d'un forfait à un autre.**
Cela se fait en refaisant la demande de forfait depuis l'app (section 4.1) ; la demande est de nouveau examinée par l'équipe Krono avant application.
