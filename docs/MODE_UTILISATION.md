# Mode d’emploi — Les applications Krono

Ce document s’adresse aux **personnes qui utilisent** les outils Krono au quotidien (clients, livreurs, équipe bureau), **sans vocabulaire technique**.

---

## En bref : trois outils

| Outil | Qui l’utilise ? | À quoi ça sert ? |
|--------|------------------|-----------------|
| **Application client** (téléphone) | Personnes qui envoient ou reçoivent des colis | Commander une livraison, suivre la course, payer, gérer son compte |
| **Application livreur** (téléphone) | Livreurs | Recevoir les courses, se déplacer avec l’itinéraire, voir ses gains |
| **Espace administration** (ordinateur, navigateur web) | Équipe Krono | Superviser les commandes, les comptes, les litiges, les statistiques |

---

## Petit lexique des mots Krono

Cette section explique les mots qui peuvent apparaître dans les écrans. Les termes peuvent varier légèrement selon les mises à jour, mais l’idée reste la même.

| Mot affiché | Ce que ça veut dire simplement |
|------------|--------------------------------|
| **Commande / course / livraison / expédition** | Le service demandé : récupérer un colis à un endroit et le remettre à un autre endroit. |
| **Client / commanditaire** | La personne qui crée la livraison dans l’application ou par téléphone. |
| **Destinataire** | La personne qui reçoit le colis. Elle peut être différente de la personne qui commande. |
| **Livreur / chauffeur / coursier** | La personne qui effectue la livraison. Dans Krono, ces mots peuvent désigner le même rôle selon l’écran. |
| **Point de collecte / retrait / pickup** | L’endroit où le livreur doit récupérer le colis. |
| **Point de livraison / destination / dropoff** | L’endroit où le livreur doit remettre le colis. |
| **En attente / recherche livreur** | La commande est créée, Krono cherche un livreur disponible. |
| **Livreur assigné / accepté** | Un livreur a pris la course. |
| **En route pour récupérer** | Le livreur se dirige vers le point de collecte. |
| **Colis pris en charge** | Le livreur a récupéré le colis. |
| **En livraison** | Le livreur se dirige vers le destinataire. |
| **Colis livré / terminé** | La livraison est finie. |
| **Annulé** | La commande n’ira pas jusqu’au bout. |
| **Mode de livraison** | Le choix du service : par exemple **Express**, **Standard** ou **Programmée**. |
| **Méthode de livraison / type de véhicule** | Le moyen utilisé : actuellement la **moto** est le service principal ; voiture/cargo peuvent apparaître comme options futures ou réservées selon l’équipe. |
| **Livraison programmée** | Livraison prévue pour un créneau souhaité, par exemple “entre 10h et 12h”. |
| **Maintien de température / sac isotherme** | Option utile si le colis doit rester au frais ou au chaud. |
| **Distance / durée estimée** | Estimation du trajet. Si la route exacte n’est pas disponible, l’application peut utiliser une estimation moins précise. |
| **Frais d’urgence** | Supplément éventuel quand une livraison rapide ou prioritaire est choisie. |
| **Paiement partiel** | Paiement d’une partie du montant maintenant ; le reste doit être réglé ensuite. |
| **Reste à payer / reliquat / dette** | Montant encore dû après une commande, surtout en cas de paiement différé ou partiel. |
| **Crédit restant** | Montant disponible pour utiliser le paiement différé. |
| **Échéance** | Date limite pour régler une dette ou un paiement différé. |
| **Transaction** | Trace d’un paiement, d’un remboursement, d’un prélèvement ou d’une recharge. |
| **QR Code de livraison** | Code affiché côté client et scanné par le livreur comme preuve de remise du colis. Ce n’est pas un QR de paiement. |
| **Lien de suivi** | Lien web permettant de suivre une livraison sans installer l’application. |
| **Notifications push** | Messages envoyés par l’application sur le téléphone ou le navigateur. |
| **Mises à jour en direct limitées** | Message indiquant que le suivi temps réel est momentanément moins fiable, souvent à cause de la connexion. |
| **Détection automatique d’arrivée** | L’application reconnaît que le livreur est proche du point prévu et peut proposer l’étape suivante. |
| **B2B / professionnel** | Livraison créée pour une entreprise ou un client professionnel. |
| **Commande par téléphone / hors ligne** | Livraison créée par l’équipe Krono pour un client, souvent à partir d’un appel. Les adresses peuvent demander une vérification. |
| **Zone opérateur / zone approximative** | Zone choisie par l’équipe quand l’adresse exacte n’est pas encore assez précise. |
| **Litige / réclamation** | Problème déclaré sur une livraison ou un paiement, traité par le support. |
| **Solde commission** | Réserve d’argent d’un livreur partenaire pour les commissions Krono. |
| **Recharge** | Ajout d’argent sur le solde commission d’un livreur partenaire. |
| **Classement** | Rang des livreurs sur une période, selon les règles de performance choisies par Krono. |
| **Badge** | Récompense affichée après certains objectifs, par exemple première livraison ou excellent service. |
| **Dashboard / tableau de bord** | Écran de résumé pour voir rapidement l’activité et les chiffres importants. |
| **Indicateur / KPI** | Chiffre de suivi : livraisons, revenus, satisfaction, annulations, temps moyen, etc. |
| **Analytics / rapports** | Pages de statistiques et d’exports pour analyser l’activité. |

---

## Comment Krono calcule le prix d'une livraison

Le prix affiché au client au moment de commander est calculé **automatiquement** par le système, en temps réel. Il n'est jamais saisi à la main par l'équipe.

---

### Les grilles de base

Chaque livraison commence par un **forfait fixe** (coût de départ) auquel s'ajoute un **tarif par kilomètre** parcouru.

| Type de véhicule | Forfait de départ | Tarif par km |
|---|---|---|
| **Moto** | 350 – 400 FCFA | 200 FCFA / km |
| **Voiture** | 700 – 1 000 FCFA | 300 FCFA / km |
| **Cargo** | 1 200 FCFA | 450 FCFA / km |

Le forfait varie selon le **mode de livraison** choisi par le client (Express, Standard, Programmée). La voiture a deux niveaux selon le service demandé.

**Exemple — Moto Express, 5 km :**
> 400 FCFA (forfait) + 5 × 200 FCFA (distance) = **1 400 FCFA**

**Exemple — Voiture standard, 8 km :**
> 700 FCFA (forfait) + 8 × 300 FCFA (distance) = **3 100 FCFA**

---

### Les ajustements automatiques de contexte

En plus du prix de base, le système applique des **ajustements automatiques** selon la situation du moment. Ces ajustements ne sont **jamais visibles comme une ligne séparée** sur l'écran du client : ils sont déjà inclus dans le prix affiché.

| Situation | Ajustement |
|---|---|
| **Heure de pointe** (7h–9h ou 17h–20h) | + 6 % |
| **Nuit** (22h–5h) | + 4 % |
| **Forte demande** (beaucoup de commandes, peu de livreurs disponibles) | Variable, selon l'activité en temps réel |
| **Trafic chargé** (trajet réel plus long que prévu) | Jusqu'à + 22 % |
| **Mauvais temps** (pluie forte, orage) | Variable, selon les données météo |

Ces ajustements se **combinent** entre eux. Par exemple, une livraison en heure de pointe sous la pluie avec du trafic sera plus élevée qu'une livraison en journée calme.

**Le prix ne peut jamais dépasser 1,85 fois le prix de base**, quelle que soit la situation. C'est un plafond de protection pour le client.

---

### L'arrondi final

Le prix calculé est toujours **arrondi au multiple de 25 FCFA le plus proche**. Cela évite les prix inégaux comme 1 413 ou 1 387 FCFA, et donne des montants propres à payer en espèces ou en mobile money.

**Exemples d'arrondis :**

| Calculé | Affiché |
|---|---|
| 1 411 FCFA | **1 400 FCFA** |
| 1 438 FCFA | **1 425 FCFA** |
| 1 462 FCFA | **1 475 FCFA** |

---

### Simulations concrètes — Moto, 5 km

| Situation | Prix affiché |
|---|---|
| Journée normale | **1 400 FCFA** |
| Heure de pointe | **1 475 FCFA** |
| Forte demande (×1.3) | **1 825 FCFA** |
| Trafic + heure de pointe | **1 725 FCFA** |
| Tout combiné (plafonné) | **2 600 FCFA** |

---

### Ce que le client voit

Le client voit **un seul prix** dans l'application, déjà calculé avec tous les ajustements inclus. Il n'y a pas de surprise après la commande : le montant affiché avant de valider est le montant final qui sera prélevé.

---

### Ce que Krono ne fait pas

- Le prix **n'est pas négocié** avec le livreur : le livreur ne voit pas le détail du calcul.
- Il n'y a **pas de prix différent selon le quartier** (aucune zone tarifaire pour l'instant) : seule la distance compte.
- Il n'y a **pas de minimum de commande** pour l'instant : même une courte livraison est acceptée au prix calculé.

---

## Application client (sur téléphone)

### Première utilisation

- Création de compte, confirmation du numéro de téléphone si demandé, et complétez votre profil si l’application vous le propose.

### Écran d’accueil

- **Nouvelle livraison** : ouvre la carte pour indiquer où prendre le colis et où le livrer, choisir le type de véhicule, voir le prix, puis valider.
- **Suivi de colis** : accès à l’historique et au suivi des commandes en cours.
- **Expédition actuelle** : rappel de la livraison en cours, si vous en avez une.

### Carte (commande d’une livraison)

- Vous placez les adresses de **collecte** et de **livraison**, vous choisissez le **mode de transport** (moto, voiture, etc., selon ce que l’équipe a activé).
- Aujourd’hui, le service principal côté client est la **livraison à moto** ; si d’autres choix apparaissent mais sont indiqués **bientôt disponible**, cela veut dire qu’ils ne sont pas encore ouverts au public.
- Vous choisissez aussi le **mode de livraison** quand il est proposé :
  - **Express** : livraison rapide en ville.
  - **Standard** : livraison classique, généralement plus économique.
  - **Programmée** : livraison prévue pour un horaire ou un créneau souhaité.
- Vous renseignez le **téléphone du destinataire** (souvent obligatoire) ; vous pouvez le **choisir dans vos contacts** si l’application vous le propose.
- Vous pouvez ajouter des **précisions** (notes pour le livreur, message pour le destinataire, **livraison programmée** à une date ou un créneau, options comme le sac isotherme, selon les réglages).
- Vous pouvez ajouter des **photos du colis** si l’application le propose : elles aident le livreur et le support à identifier le colis.
- Le prix peut afficher un **coût estimé**, une **distance**, un **temps estimé**, un **prix de base**, un tarif au kilomètre et parfois des **frais d’urgence**. Le montant final dépend des règles activées par l’équipe Krono.
- **Qui paie ?** (choix important, dans le récapitulatif de commande)  
  - **Moi (client)** : c’est vous qui réglerez la course. Vous choisissez la **méthode de paiement** (Orange Money, Wave, autre mobile money, **espèces**, **paiement différé**, etc. — selon ce qui est proposé).  
  - **Le destinataire** : il paiera **à la livraison**. S’il **a un compte** Krono, il pourra notamment utiliser le **paiement différé** ; s’il **n’en a pas**, il devra payer **en une fois** (par exemple espèces ou paiement mobile au moment de la livraison), sans différé.
- **Paiement partiel** : lorsque **vous** payez en tant que client, l’application peut proposer de ne payer qu’**une partie** du montant tout de suite ; le **reste** est indiqué et suit les règles du mode de paiement choisi.
- Ensuite vous validez la commande ; le **paiement immédiat** ou l’étape de paiement (selon le cas) s’affiche quand c’est nécessaire — voir aussi la section **Paiement différé** ci-dessous.
- Tant que vous êtes sur la carte plein écran, le menu du bas peut être masqué pour laisser place à la carte.

### Suivi d’une commande

- Carte avec la position du livreur quand c’est disponible, étapes de la course, possibilité d’**évaluer** le livreur en fin de service et d’**échanger des messages** avec lui selon les cas.
- **Partager le suivi** : vous pouvez envoyer au destinataire un **lien** pour qu’il suive la course dans le navigateur **sans installer l’application** (le lien doit être celui fourni par Krono ; sinon demandez à l’équipe que l’adresse web officielle soit bien configurée).
- **QR Code de livraison** : pour certaines commandes, l’application peut afficher un QR code à montrer au livreur au moment de la remise. Il sert de **preuve de livraison** et peut expirer après un délai ; si c’est le cas, rouvrez l’écran QR pour en obtenir un à jour.
- **Notifications** : vous pouvez recevoir des alertes quand un livreur accepte, quand le colis est récupéré, quand la livraison avance, quand un message arrive ou quand un paiement demande une action.
- Si un message indique que les **mises à jour en direct sont temporairement limitées**, ouvrez de nouveau l’application ou vérifiez la connexion. La commande existe toujours ; seul le suivi instantané peut être moins fluide.
- Sur **iPhone** (versions récentes), un **résumé de la livraison** peut aussi s’afficher sur l’**écran verrouillé** ou dans l’**îlot dynamique**, pour suivre la course sans ouvrir l’app (selon le modèle et les réglages du téléphone).

### Profil et compte

- Photo de profil, coordonnées, **adresses enregistrées**, **moyens de paiement**, **commandes passées**, **Mes dettes** (détail du **paiement différé** et des échéances), **historique des transactions**, **évaluations** reçues ou données, **confidentialité** et **à propos**, **paramètres** (notifications, sons, position), **aide et support**.
- Indications sur vos **commandes réalisées**, le **reste à payer** (montant encore dû), et vos **points de fidélité** (règles affichées dans l’application).
- **Codes promo** : si l’équipe vous communique un code, l’endroit pour le saisir peut être prévu dans l’application (selon les mises à jour du service).
- **Support** : en cas de problème sur une commande, un paiement, une adresse ou un compte, utilisez l’écran d’aide/support ou la conversation prévue dans l’application.

### Litiges et réclamations (client)

- Depuis l’écran **Historique des transactions**, chaque transaction peut faire l’objet d’une **réclamation** directement dans l’application.
- Le client choisit le **type de litige** (remboursement demandé, problème de paiement, problème de service, autre), rédige une description, et peut joindre des pièces si nécessaire.
- Une fois soumis, le litige est visible et traitable par l’équipe depuis l’espace administration.

### Rappel pour noter le livreur

- Après une livraison, si le client n’a pas encore donné son avis, l’application peut envoyer un **rappel** pour noter le livreur.
- Le client peut accepter de noter ou **désactiver ce rappel** directement depuis la notification ou l’écran de notation.
- Le système évite d’envoyer plusieurs rappels trop rapprochés pour ne pas être intrusif.

---

## Paiement différé (clients) — mode d’emploi

Le **paiement différé**, c’est : **régler la course plus tard**, dans le cadre d’un **crédit** avec des **règles de sécurité** (plafonds, échéances). Ce n’est pas proposé à tout le monde ni pour toutes les situations : l’application **vérifie** au moment du paiement si vous pouvez l’utiliser.

### Quand apparaît-il ?

- Lors du **paiement d’une commande**, quand **vous êtes le client qui paie**. Vous choisissez la méthode **paiement différé** parmi les options (Orange Money, Wave, espèces, différé, etc., selon ce qui est disponible pour votre compte).
- Si le **destinataire** paie à la place et qu’il **n’a pas de compte** Krono, le **paiement différé** n’est **pas** proposé pour ce cas.

### Ce que vous devez savoir (règles générales)

- **Plafonds** : un montant maximum **par mois** et **par an** peut s’appliquer ; le montant de la course ne doit pas dépasser le **crédit restant** du mois.
- **Nombre d’utilisations** : vous ne pouvez utiliser le paiement différé qu’un **nombre limité de fois par mois**.
- **Période d’attente** : après plusieurs utilisations, l’application peut imposer **quelques jours d’attente** avant une nouvelle utilisation.
- **Retards** : si vous **ne respectez pas les dates limites** pour payer ce que vous devez, des **restrictions** peuvent s’appliquer (par exemple blocage temporaire du paiement différé après plusieurs retards).
- **Montant minimum** : une commande trop peu élevée peut ne pas être éligible au différé.

Si une règle n’est pas respectée, l’application affiche un **message clair** (crédit insuffisant, limite atteinte, compte temporairement bloqué, etc.) au lieu de valider le paiement.

### Où suivre ce que vous devez encore payer ?

- Écran **« Mes dettes »** : vous y voyez  
  - l’**utilisation de votre crédit** (mois et année),  
  - la **liste des dettes** liées aux commandes,  
  - pour chaque dette : **montant**, **date limite**, **état** (à jour, échéance proche, en retard).  
- Vous pouvez aussi y être orienté depuis le flux de paiement (par exemple bouton du type **« Voir mes dettes »**) lorsque c’est pertinent.
- Sur votre **profil**, le **« Reste à payer »** résume d’un coup d’œil ce qu’il vous reste à régler.

### Après avoir choisi le paiement différé

- Contrairement à un paiement mobile immédiat, **aucune opération de téléphone** n’est nécessaire au moment de la commande : la dette est **enregistrée** avec une **échéance**.
- Pensez à **régler avant la date limite** pour éviter les retards et les blocages éventuels.

---

## Application livreur (sur téléphone)

### Connexion et profil

- Même logique de compte que pour un outil professionnel : connexion, puis complétez les informations demandées.
- Vous indiquez si vous êtes **livreur interne** (salarié / équipe Krono) ou **partenaire** (indépendant) ; ce choix peut être modifié depuis le profil si l’application vous y autorise. Les **partenaires** peuvent avoir un parcours d’**inscription** ou de **vérification** supplémentaire selon les règles de l’équipe.
- **Véhicule** : renseignements sur ce que vous utilisez pour les courses.

### Carte principale (accueil livreur)

- Vous passez **en ligne** ou **hors ligne** : seulement en ligne vous pouvez recevoir des demandes de courses. La position est utilisée pour vous attribuer des livraisons et afficher l’itinéraire ; les autorisations de localisation (y compris en arrière-plan quand vous travaillez) peuvent être demandées.
- Vous voyez les **demandes entrantes**, vos **courses en cours**, un **aperçu du jour** (livraisons, gains).
- **Navigation** : lancement du guidage pas à pas vers le point de collecte puis vers la livraison (voix ou indications à l’écran selon les réglages).
- **Départ** : quand une course est acceptée, le bouton du type **Je pars** indique que vous commencez réellement le trajet vers le point de collecte.
- **Détection d’arrivée** : l’application peut détecter automatiquement que vous êtes arrivé près du point de collecte ou du point de livraison. Si l’adresse est imprécise, appelez le client ou l’opérateur.
- **Scanner QR** : à l’arrivée, le livreur peut scanner le **QR Code de livraison** du client. Cela confirme la remise du colis et aide le support en cas de contestation.
- **Notes et consignes** : certaines courses affichent des notes de l’opérateur, des consignes client, un créneau souhaité, un message pour le destinataire ou une option de maintien de température.
- **Commande hors ligne / téléphone / B2B** : certains badges indiquent qu’une course a été créée par l’équipe ou pour un professionnel. Les points GPS peuvent être moins précis ; vérifiez les informations affichées avant de partir.
- **Zone opérateur** : quand un point de collecte est approximatif, l’app peut afficher une zone au lieu d’une adresse parfaitement précise.
- **Plusieurs courses** : si plusieurs commandes sont actives, l’application peut afficher un indicateur ou une liste pour passer d’une course à l’autre.
- **Messagerie** : échanges avec le client ou l’équipe selon les cas ; **notifications** sur le téléphone lorsque de nouvelles courses ou messages arrivent (selon vos réglages).
- Consignes **sécurité** ou **type de véhicule** peuvent être rappelées par l’application (ex. avant de rouler).
- Si un bandeau indique que les **mises à jour en direct sont limitées**, gardez l’application ouverte et vérifiez votre connexion ; les informations peuvent se resynchroniser après quelques instants.

### Demande entrante — comment ça se passe

- Quand une course est disponible et correspond à votre zone, une **alerte s’affiche** avec les informations essentielles : adresses de collecte et de livraison, distance, gain estimé, consignes particulières.
- Vous avez un **délai limité** (généralement entre 10 et 30 secondes) pour **accepter ou refuser**. Si vous ne répondez pas, la demande passe à un autre livreur disponible.
- Une fois acceptée, la course apparaît dans votre liste de courses actives.

### Revenus

- Historique des gains par période (jour, semaine, mois, ou vue large), avec le détail des courses terminées.
- Un **graphique** montre l’évolution des gains jour par jour sur la période choisie.
- Pour les livreurs **partenaires**, un **solde commission** peut apparaître. Si le solde est trop faible ou épuisé, il peut être nécessaire de **recharger** avant de recevoir de nouvelles courses.
- Les livreurs **internes** n’ont généralement pas la même logique de commission prépayée que les partenaires.

### Commission (livreurs partenaires uniquement)

- Les livreurs partenaires fonctionnent avec un **compte prépayé** : une somme minimum doit être disponible pour pouvoir recevoir des courses.
- À chaque livraison terminée, une **part est déduite** automatiquement de ce solde (commission Krono).
- Si le solde tombe trop bas, le compte peut **ne plus recevoir de nouvelles demandes** jusqu’à une recharge.
- La recharge se fait depuis l’application ou via l’équipe Krono.
- L’historique montre chaque mouvement : **recharge**, **déduction** (après livraison), **remboursement** éventuel.

### Profil livreur

- Statistiques : nombre de livraisons, gains cumulés, **note moyenne**, taux d’acceptation des courses.
- Les **partenaires** ont en plus un accès aux **gains / commission** (compte prépayé, recharges, mouvements).
- **Classement et badges** : l’application affiche un classement de la semaine/du mois et des badges obtenus :
  - Première livraison
  - 10, 50, 100, 500 livraisons cumulées
  - Excellence (note élevée sur une période)
  - Livreur du mois
  Ces éléments servent au suivi de performance et à la motivation.
- **Véhicule** : gardez les informations du véhicule à jour. Même si plusieurs types peuvent exister dans le projet, la flotte ouverte peut être limitée à la moto selon la période.
- **Support livreur** : utilisez l’aide/support pour signaler un problème de compte, de course, de paiement, de navigation ou de QR code.

---

## Espace administration (sur ordinateur)

Réservé à **l’équipe Krono** (connexion sécurisée).

- **Tableau de bord** : vue d’ensemble de l’activité (livraisons, chiffres clés) sur la période choisie.
- **Suivi en direct** : liste des courses et carte pour voir où en est chaque livraison.
- **Commandes** : toutes les commandes, filtres par situation (en cours, terminées, annulées, etc.), détail d’une commande.
- **Messages** : conversations avec clients ou livreurs.
- **Analyses et rapports** : statistiques, export de tableaux pour le suivi interne.
- **Finances** : d’un côté les **transactions clients**, de l’autre les **commissions livreurs** (deux vues liées au menu Finances).
- **Utilisateurs et livreurs** : fiches détaillées (pour un client, on peut notamment voir l’historique des **paiements différés** : payé, restant, détail des opérations).
- **Performance / classement** : suivi motivant pour les équipes (classements par période, zone, etc.).
- **Rapports avancés** : en plus des statistiques générales, des rapports détaillés sont disponibles sur plusieurs angles :
  - **Livraisons** : volume, distance moyenne, durée, taux d’annulation, par zone ou par période
  - **Revenus** : répartition par livreur, par client, par méthode de paiement
  - **Clients** : activité, segmentation, fidélité
  - **Livreurs** : performance, note, taux d’acceptation
  - **Paiements** : transactions réussies, échouées, litiges, retards paiement différé
  Tous ces rapports peuvent être **exportés** (tableur, CSV) pour un traitement externe.
- **Maintenance** : suivi complet des véhicules de la flotte :
  - Historique des entretiens (date, type, coût)
  - Logs de carburant (date, montant, quantité)
  - Documents par véhicule (licence, assurance, contrôle technique) avec **dates d’expiration** et alertes automatiques si un document arrive à échéance
  - Kilométrage logué après chaque livraison
  - Budget par véhicule
- **Planning** : organisation des livraisons **professionnelles**, **B2B** ou **prises par téléphone** ; lors de la création d’une course, l’équipe peut choisir le **mode de paiement** (espèces, mobile money, **paiement différé** pour un client entreprise, etc.).
- **Saisie admin / téléphone / hors ligne** : l’équipe peut créer une commande pour un client qui appelle. Dans ce cas, il faut soigner l’adresse, le téléphone, les notes pour le livreur et, si besoin, préciser une zone approximative.
- **Zones de collecte approximatives** : utiles quand le point exact n’est pas encore connu. Elles doivent rester assez claires pour que le livreur sache qui appeler ou où se rapprocher.
- **Codes promo** : création et gestion des offres.
- **Litiges** : traitement des litiges et fil **support** associé.
- **Paramètres** : langue de l’interface, thème clair ou sombre, préférences d’affichage.
- **Notifications admin** : l’espace web peut afficher des alertes d’activité, de message, de commande ou d’anomalie selon les réglages.
- **Recherche globale** : la barre de recherche peut aider à retrouver rapidement une commande, un client ou un livreur.
- **Exports / rapports** : certaines vues peuvent être exportées pour le suivi interne, les finances ou les analyses.
- **Lien de suivi pour un tiers** : page web publique où l’on suit une course avec un **lien** (sans compte), utile pour partager le suivi avec un destinataire.

---

## Comment Krono informe les destinataires sans compte

Quand le destinataire d'un colis **n'a pas de compte Krono**, il peut quand même être informé de l'avancement de sa livraison :

- **SMS ou WhatsApp** : un message peut lui être envoyé automatiquement avec les informations clés (livreur en route, livraison imminente, etc.), selon ce que l'équipe a activé.
- **Lien de suivi public** : un lien unique est généré pour chaque commande. Ce lien s'ouvre dans un navigateur web, **sans aucune installation** d'application. Le destinataire voit l'adresse de livraison, le statut en cours et le temps estimé.
- **Notifications depuis le navigateur** : si le destinataire accepte les notifications sur la page de suivi, il peut recevoir des alertes directement sur son téléphone ou ordinateur, même sans compte Krono.

---

## Prévision de la demande (pour les livreurs)

Le système analyse les livraisons passées (sur les 30 derniers jours) pour prévoir où et quand la demande sera la plus forte :

- **Heures de pointe** par zone et par jour de la semaine
- **Zones chaudes** : zones où les commandes s'accumulent à un moment donné
- **Recommandations** : si un livreur cherche où se positionner pour avoir plus de courses, le système peut lui suggérer les zones les plus actives du moment

Ces informations sont accessibles dans l'application livreur et dans l'espace admin.

---

## Optimisation des livraisons multiples

Quand un livreur doit effectuer **plusieurs livraisons à la suite**, le système peut calculer automatiquement l'**ordre de passage le plus rapide** :

- Il prend en compte la position du livreur, les points de collecte et les points de livraison.
- La règle fondamentale est respectée : **on collecte un colis avant de le livrer** (jamais l'inverse).
- Les livraisons prioritaires sont traitées en premier.
- Le résultat est une liste ordonnée pickup → dropoff pour chaque commande, optimisée pour minimiser le trajet total.

---

## Notifications automatiques envoyées par Krono

En dehors des alertes déclenchées par les actions de l'utilisateur (commande acceptée, colis récupéré, etc.), Krono peut envoyer des **notifications programmées** pour informer ou encourager :

**Côté client :**
- Rappel pour passer une nouvelle commande si le client n'a pas commandé depuis un moment
- Rappel pour noter le livreur après une livraison

**Côté livreur :**
- Alerte quand des commandes attendent dans une zone proche
- Encouragement à se mettre en ligne quand la demande est forte dans sa zone
- Rappel si le livreur est hors ligne depuis un certain temps alors que des courses sont disponibles

Ces notifications respectent une **fenêtre horaire** (par exemple uniquement entre 10h et 20h) et un **délai minimum entre deux messages** pour ne pas être intrusif.

---

## Petits problèmes fréquents et bons réflexes

- **Adresse introuvable ou imprécise** : complétez avec un repère, un numéro de téléphone, une note et, si nécessaire, une zone approximative.
- **Position du livreur qui ne bouge plus** : vérifiez la connexion, les permissions de localisation et rouvrez l’application. Le suivi peut reprendre après resynchronisation.
- **Paiement mobile qui ne part pas** : vérifiez le numéro, le réseau mobile et le solde du compte de paiement.
- **Paiement différé refusé** : consultez le message affiché ; il peut s’agir d’un plafond atteint, d’un crédit insuffisant, d’un retard ou d’un montant non éligible.
- **QR code expiré ou invalide** : le client doit rouvrir l’écran du QR code ; le livreur doit scanner le QR correspondant à la bonne commande.
- **Commande B2B ou par téléphone avec GPS incomplet** : le livreur doit appeler le client ou l’équipe avant de perdre du temps sur la route.
- **Litige après livraison** : ouvrir une réclamation avec le numéro de commande, les messages, les photos du colis si disponibles et le détail du paiement.
- **Livreur partenaire qui ne reçoit plus de courses** : vérifier le solde commission — s'il est insuffisant, une recharge est nécessaire avant de pouvoir accepter de nouvelles demandes.
- **Destinataire qui n'a pas reçu le lien de suivi** : vérifier que son numéro de téléphone est bien renseigné dans la commande ; le lien peut être renvoyé depuis l'espace admin.
- **Document véhicule expiré** : l'espace admin affiche une alerte sur les documents arrivant à échéance ; pensez à les renouveler avant expiration pour éviter un blocage.

---

## En résumé

- **Client** : commander sur la carte, payer (y compris **plus tard** avec le **paiement différé** si autorisé), suivre le colis, consulter **Mes dettes** et le **reste à payer**.
- **Livreur** : se mettre en ligne, accepter et effectuer les courses avec guidage, suivre les consignes, scanner le QR si demandé, consulter ses revenus et sa note.
- **Équipe** : piloter l’ensemble depuis l’espace web, y compris les finances et le suivi des paiements différés côté clients.

*Pour l’installation technique réservée aux développeurs (serveurs, mises à jour), voir la documentation technique du projet.*

---

## Note pour maintenir ce guide à jour

Un même oubli que pour le **paiement différé** peut arriver pour d’autres parcours : **qui paie** (client ou destinataire), **paiement partiel**, **partage du lien de suivi**, **livraison programmée**, **codes promo**, **compte partenaire livreur**, **création de course B2B avec paiement différé** côté bureau, etc. Dès qu’une nouvelle option apparaît dans l’application, il est utile de **reparcourir les écrans** ou la **liste des fonctionnalités produit** pour compléter ce document.
