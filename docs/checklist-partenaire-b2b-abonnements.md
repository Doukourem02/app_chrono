# Checklist — Parcours partenaire B2B, abonnements et commissions

Document de suivi pour aligner produit, app, admin et backend sur la vision validée : **mettre en avant les forfaits (3 types d’abonnement)** avant toute logique de commission imposée ; **ne pas attribuer d’abonnement ni de taux “par défaut”** sans choix explicite du partenaire ; traiter la **commission comme ce qui est prélevé sur les livraisons** dans le cadre du forfait choisi.

---

## Scénario retenu (répartition téléphone / admin)

**Téléphone (partenaire)** — tout est saisi côté app :

- [ ] Parcours d’information (comparatif 3 forfaits + « comment ça marche »).
- [ ] **Choix explicite du type de forfait** (Starter / Pro / Business — ou branche « plus tard / commercial » si produit le prévoit).
- [ ] **E-mail pour le portail partenaire** : prérempli avec l’e-mail du compte, **modifiable** par le partenaire (ex. adresse pro).
- [ ] Autres champs déjà prévus dans le parcours (ex. nom du business, validations légales / récap plan).

**Admin** — rôle limité :

- [ ] **Activation** du partenaire (passage `pending` → `active` ou équivalent une fois la demande jugée recevable).
- [ ] **Envoi du lien du portail** à l’e-mail fourni par le partenaire depuis le téléphone (invitation Supabase / flux existant).
- [ ] Option garde-fou : **corriger l’e-mail** avant envoi si erreur évidente (sans refaire tout le parcours côté admin).

**À ne plus faire** : créer en parallèle un second partenaire pour la même personne (admin + app) — voir section « Unicité ».

---

## Principes (référence)

- [ ] Un **partenaire** = acteur identifié (volume / livraisons récurrentes) ; la valeur pour la plateforme passe par la **fidélisation au forfait**, pas par l’imposition d’un pourcentage “en douce”.
- [ ] **Forfait / abonnement** : ce que le partenaire **choisit** après avoir compris les avantages (Starter / Pro / Business).
- [ ] **Commission** : ce qui est **prélevé sur les livraisons** selon les règles du plan souscrit (in-quota, hors quota, etc.) — à **ne pas confondre** avec le “prix du forfait” dans la communication utilisateur.
- [ ] **Aucun abonnement** ne doit être considéré comme souscrit **sans action explicite** du partenaire (coche / validation).
- [ ] **Aucun taux de commission** ne doit être enregistré comme “accord partenaire” **sans transparence** (écran explicite ou confirmation après lecture des conditions du plan).
- [ ] **Un seul partenaire logique par utilisateur** : le parcours **prioritaire** est création depuis l’app ; l’admin **n’ajoute pas** les infos métier (forfait, mail portail) — il **active** et **envoie le lien**.
- [ ] **Agrément admin = une seule fois** : une fois le partenaire créé et **accepté** par l’admin (activation + lien portail), le client ne doit **pas** remettre le dossier en « attente d’activation » à chaque coup de toggle. L’admin **ne réactive pas** le partenaire à chaque fois que le client coupe le mode business.

---

## 0 bis. Toggle « mode business » (app) vs statut côté admin

**Problème actuel (à corriger)** : en coupant le toggle, l’app appelle `deregisterAsPartner`, qui met `partners.status` à `inactive` ; au rallumage, `registerAsPartner` repasse un partenaire `inactive` en `pending` → l’admin doit **réactiver** à nouveau. Fichiers concernés : `app_chrono/app/(tabs)/profile.tsx` (`handleModeToggle`), `chrono_backend/src/controllers/partnerController.ts` (`deregisterAsPartner`, branche `inactive` de `registerAsPartner`).

**Règle produit retenue**

- [ ] **Deux notions distinctes** :
  - **Agrément / compte partenaire** (`partners.status` ou équivalent) : `pending` → **`active` une fois** après décision admin (hors suspension fraude, impayé, etc. — cas d’exception produit à lister si besoin).
  - **Mode business à l’usage** (ex. `users.is_business` ou champ dédié) : le client **active / désactive** à volonté **sans** changer l’agrément ni exiger une nouvelle action « Activer » admin.
- [ ] **Côté admin**, la liste peut refléter ce que vous voulez voir au quotidien :
  - soit **statut agrément** (reste « Actif » une fois approuvé) ;
  - soit **colonne additionnelle** « Mode business (app) » = on / off selon le toggle client, **indépendante** du bouton d’activation initiale.
- [ ] **Désactivation toggle** : mettre à jour **uniquement** le flag « je n’utilise pas le mode pro pour l’instant » (UI + commandes B2B éventuellement bloquées) ; **ne pas** appeler la même logique que « sortie du programme partenaire » sauf action explicite « quitter le programme partenaire » (si ce flux existe).
- [ ] **Réactivation toggle** : réactiver le mode business dans l’app **sans** repasser par `pending` ni redemander l’activation admin (sauf si le compte partenaire a été **suspendu** par l’admin pour autre raison).
- [ ] **Portail / middleware** (`verifyPartnerUser`, etc.) : distinguer « partenaire non approuvé » vs « partenaire approuvé mais mode business off » pour ne pas demander à l’admin de « réactiver » dans le second cas.

---

## 1. Expérience mobile / app (parcours “Je suis professionnel”)

- [ ] Après le profil “professionnel”, afficher un **écran comparatif** des **3 abonnements** (avantages clairs : quota, prix mensuel, ce qui se passe sur les courses in / hors quota).
- [ ] Enchaîner sur un **menu ou écran “Comment ça marche”** (étapes : choix du forfait sur le téléphone → attente validation admin → activation → e-mail avec lien portail).
- [ ] Le partenaire ne peut **pas valider** sans avoir **sélectionné le type de forfait** (et sans **e-mail portail** renseigné — au minimum prérempli et validable).
- [ ] **Pas de passage** à l’état “business actif” complet si le parcours d’information + choix (ou sortie contrôlée) n’est pas respecté.
- [ ] Libellés UI : privilégier **forfait / abonnement** ; réservé “commission sur livraisons” aux explications techniques ou au récap légal si besoin.
- [ ] Persister côté backend les champs nécessaires à l’admin : **plan demandé**, **e-mail portail**, statut `pending` jusqu’à activation.

---

## 2. Admin / back-office

- [ ] Liste partenaires : afficher le **forfait choisi sur le téléphone** et l’**e-mail portail** en attente d’invitation (plus de “Plan: none” trompeur une fois le flux implémenté).
- [ ] Liste / détail : distinguer visuellement **commission = règles du plan choisi** (dérivé ou doc) vs anciens **défauts techniques** le temps de la migration données.
- [ ] Action **Activer** : déclenche **uniquement** validation + **envoi du lien portail** (et création souscription / rattachements selon règles métier), **sans** refaire la saisie du forfait ni de l’e-mail (sauf correction optionnelle de l’e-mail avant envoi).
- [ ] **Création “Nouveau partenaire” depuis l’admin** : à redéfinir — soit **réservé** aux cas sans compte app (B2B pur back-office), soit **interdit** si un `partner_users` existe déjà pour l’utilisateur, soit **rattachement** à une demande existante pour éviter les doublons (ex. DM + DOUKOURE SHOP).
- [ ] **Suppression / fusion en admin** : **constat actuel** — pas de bouton « Supprimer » sur la liste ni la fiche partenaire ; pas d’endpoint `DELETE /api/partners/:id` (`partnerRoutes.ts` + `adminApiService`). Pour les doublons (ancien vs nouveau modèle), nettoyage **manuel en base** jusqu’à implémentation : **suppression contrôlée** (règles FK : `partner_users`, commandes, souscriptions, factures) **ou** **fusion** guidée (conserver un `partner_id`, réaffecter les lignes liées).
- [ ] Vérifier cohérence avec les **3 plans** documentés (prix, quotas, taux in-quota / excédent) et l’historique métier (doc `krono-reference-unique.md` si toujours à jour).

---

## 3. Backend — corrections à prévoir (constat actuel)

Référence code actuelle : création partenaire auto avec `commission_rate: 0.20` ; admin `commission_rate ?? 0.20` ; `computeB2BCommission` avec repli `?? 0.20` sans abonnement.

- [ ] **`registerAsPartner`** : accepter et stocker depuis l’app le **forfait choisi** et l’**e-mail portail** ; ne plus fixer **silencieusement** `commission_rate: 0.20` ; aligner commission / souscription sur le **plan demandé** (ou état explicite jusqu’à activation).
- [ ] **`createPartner` (admin)** : ne pas appliquer **20 % par défaut** si non renseigné ; exiger le taux / le plan ou utiliser un état “à configurer”.
- [ ] **`b2bCommissionService`** : repli `partner?.commission_rate ?? 0.20` — à revoir pour **ne pas facturer / calculer** sur un défaut implicite sans plan (erreur explicite, 0, ou blocage commande B2B selon décision).
- [ ] **`deregisterAsPartner` / toggle off** : ne plus utiliser pour le simple toggle une mise à `partners.status = 'inactive'` qui force une réactivation admin ; prévoir **désinscription programme** séparée si métier le demande.
- [ ] **`registerAsPartner`** : si partenaire déjà **`active`** (agréé), le toggle « on » ne doit **pas** recréer ni repasser en `pending` ; aligner avec §0 bis.
- [ ] Ancienne logique **réactivation `inactive` → `pending`** : à **supplanter** par la distinction agrément vs mode business (§0 bis) ; ne conserver `pending` + re-demande admin **que** pour vraie réadhésion / révision dossier si produit le prévoit.
- [ ] **`activatePartner`** (ou flux fusionné) : à l’activation, appliquer le **plan déjà choisi sur le téléphone** (création / mise à jour `partner_subscriptions` ou équivalent) + **invitation portail** sur l’e-mail saisi app ; **pas** de choix de forfait côté admin dans le scénario standard.
- [ ] Création / mise à jour **`partner_subscriptions`** : **après** choix partenaire sur le téléphone ; **effective** (facturation / quota) selon règles (ex. à l’activation admin et/ou paiement — à trancher produit).
- [ ] **Suppression (API)** : exposer un `DELETE` (ou désactivation définitive + archivage) **sécurisé admin** avec gestion des FK / fusion, aligné sur la case §2 « Suppression / fusion ».

---

## 4. Données & états

- [ ] Modèle de données : statut partenaire vs statut abonnement (ex. `pending` avec **plan demandé** + **portal_email** persistés, `active` avec souscription alignée sur ce plan) ; **séparer** statut agrément partenaire du **flag mode business** utilisateur (toggle app).
- [ ] **Unicité** : un utilisateur → **un** partenaire lié (`partner_users`) ; empêcher ou fusionner les doublons admin + app.
- [ ] Éviter les lignes `partners` avec un taux qui **contredit** l’absence de plan choisi.
- [ ] Migrations éventuelles : valeurs existantes “20 % par défaut” à **recenser** (script ou note) pour correction manuelle ou migration de données.

---

## 5. Communication & conformité

- [ ] Texte court sur l’app : ce que le partenaire **accepte** en cochant un plan (récap commission sur livraisons selon plan).
- [ ] Cohérence avec facturation / factures partenaire (`partner_invoices`, jobs) une fois le plan réellement actif.

---

## 6. Tests / recette (à cocher après implémentation)

- [ ] Nouveau partenaire : parcours complet jusqu’au choix de plan sans 20 % “fantôme” en admin.
- [ ] Toggle business off puis on (partenaire déjà agréé) : **aucune** remise en `pending`, **aucune** nouvelle activation admin requise.
- [ ] Vraie réadhésion / changement de dossier (si flux prévu) : re-demande nom + **re-choix plan** uniquement dans ce cas, pas à chaque toggle.
- [ ] Commande B2B avec partenaire sans plan : comportement attendu (blocage vs taux 0 avec log) validé.
- [ ] Admin active un `pending` : **forfait et e-mail** issus du téléphone visibles ; envoi lien portail OK ; commission dérivée du plan (plus de 20 % fantôme).
- [ ] Impossible de recréer un second partenaire pour le même compte utilisateur sans passer par une règle de fusion explicite.
- [ ] Après ajout delete/fusion admin : doublon supprimé ou fusionné sans orphelins en base.

---

## Notes de contexte (interne)

- Les trois plans tarifaires et taux associés sont déjà décrits côté doc / code (`starter` / `pro` / `business`, quotas, commissions in-quota et excédent). La checklist **ne fige pas les chiffres** ici pour limiter la duplication ; mettre à jour ce fichier si les montants changent.
- Fichiers déjà identifiés pour les corrections : `chrono_backend/src/controllers/partnerController.ts`, `chrono_backend/src/routes/partnerRoutes.ts`, `chrono_backend/src/services/b2bCommissionService.ts`, `app_chrono/app/(tabs)/profile.tsx` (`handleModeToggle`, `deregisterAsPartner`), `chrono_backend/src/middleware/verifyPartnerUser.ts`, `admin_chrono/app/(dashboard)/partners/page.tsx` et `[id]/page.tsx`, `admin_chrono/lib/adminApiService.ts`, flux `invitePartnerUser` / activation.

---

*Dernière mise à jour : §2 gestion admin — absence delete/fusion (constat + tâches) ; §6 recette ; chemins admin/API.*
