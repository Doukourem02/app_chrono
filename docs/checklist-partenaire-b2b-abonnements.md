# Checklist — Parcours partenaire B2B, abonnements et commissions

Document de suivi pour aligner produit, app, admin et backend sur la vision validée : **mettre en avant les forfaits (3 types d’abonnement)** avant toute logique de commission imposée ; **ne pas attribuer d’abonnement ni de taux “par défaut”** sans choix explicite du partenaire ; traiter la **commission comme ce qui est prélevé sur les livraisons** dans le cadre du forfait choisi.

---

## Grille tarifaire de référence (version finale — à appliquer partout)

**Avant intégration** : remplacer chaque fourchette par **un seul nombre** (facturation + app + admin).

| Plan | Abonnement (FCFA/mois) | Quota livraisons / mois | Commission **dans** le quota | Commission **au-delà** |
|------|------------------------|-------------------------|------------------------------|---------------------------|
| **Sans forfait** | 0 | — (chaque course) | **6 % ou 7 %** (à trancher) | = même taux |
| **Starter** | 8 000 | 35 | **5 %** | **7 %** |
| **Pro** (recommandé) | 16 000 | 70 | **3 %** | **5 %** |
| **Business** | 29 000 | 110 | **1,5 % ou 2 %** (à trancher) | **3 % ou 4 %** (à trancher) |

- [ ] Trancher et noter ici les **4 valeurs uniques** retenues : sans forfait ___ % ; Business in-quota ___ % ; Business excédent ___ %.
- [ ] Mettre à jour **`krono-reference-unique.md`** (ou doc tarifaire unique) avec cette grille + une phrase « **l’abonnement réduit la commission** sur les courses dans le quota par rapport au paiement à la course ».
- [ ] Aligner **`partnerController.ts`** (`PLAN_DEFAULTS`, `PAY_PER_DELIVERY_COMMISSION_RATE`) sur les montants, quotas et `excess_commission_rate`.
- [ ] Aligner **`b2bCommissionService.ts`** (`QUOTA_COMMISSION` + défaut si plan inconnu) sur les taux **dans le quota** par plan.
- [ ] Vérifier **`partnerInvoiceJob.ts`** (forfait + excédent volume) avec les **nouveaux quotas** (Business = **110** inclus, plus `null` / « illimité » contradictoire).
- [ ] Aligner **`app_chrono` / `business-onboarding.tsx`** : cartes, prix FCFA, bullets, **aucune** promesse « illimité » incompatible avec un excédent chiffré.
- [ ] Aligner **admin** : `partners/page.tsx` (`PLAN_COMMISSION` ou équivalent), `partners/[id]/page.tsx` (`PLAN_DEFAULTS`), portail **`partner/.../billing/page.tsx`** (`PLAN_DETAILS` / affichage quota + taux).
- [ ] Recette : un partenaire par plan → taux calculés / affichés **identiques** sur app, admin, portail et logs commission.

---

## Produit & UX — corrections identifiées (parcours forfaits)

*(Les tâches **rédactionnelles** détaillées — audit global, glossaire, admin, doc — sont dans la section suivante **« Copywriting & cohérence textuelle »**.)*

- [ ] **Business** : ne plus afficher **« livraisons illimitées »** en contradiction avec un **dépassement de quota** ; rester sur **quota chiffré** (ex. 110) + taux au-delà.
- [ ] **Pédagogie forfait** : une courte phrase du type « **L’abonnement baisse la commission** sur les livraisons dans votre quota par rapport au **paiement à la course** » (sous-titre ou encart).
- [ ] **Sans forfait** : libellé plus neutre (ex. **« Paiement à la course »**), clé API `none` inchangée si besoin.
- [ ] **Validation admin** : texte aligné sur le réel — ex. **accès / usage avec statut « en attente »** + validation en arrière-plan, sans laisser croire que **rien** n’est possible avant l’admin si ce n’est pas le cas (à caler avec le produit).
- [ ] **E-mail portail** : ne pas laisser un préremplissage type `*@otp.chrono.local` sans explication ; placeholder pro + aide, ou masquage si e-mail compte = technique.
- [ ] **Bouton « Envoyer ma demande »** désactivé : message explicite si **aucun forfait sélectionné** (et erreur saisie si règles e-mail renforcées).
- [ ] **Header** : raccourcir le paragraphe d’intro si trop long ; garder le détail dans « Comment ça marche » ou lien conditions.
- [ ] **Guidage** : pastille **« Recommandé »** sur **Pro** ; une ligne **« Idéal pour… »** par palier (optionnel mais fort impact).
- [ ] **(Plus tard)** Simulateur « estimation mensuelle » — hors scope minimal ; noter en backlog.

---

## Copywriting & cohérence textuelle — refonte (obligatoire avec la nouvelle grille)

**Constat (captures actuelles type onboarding forfaits)** : textes **désalignés** avec la grille finale — ex. **15k / 40k / 100k**, **20 %** sans forfait, **illimité + 0 % + 10 %** Business, intro longue, étapes « admin valide » sans nuancer l’accès, e-mail technique visible. Même après correction des **chiffres**, les **formulations** peuvent rester fausses ou contradictoires : cette section impose une **repasse transverse** sur **tous** les libellés.

### Audit & périmètre

- [ ] **Inventaire des chaînes** : lister (grep / doc) tous les textes visibles partenaire B2B — **`app_chrono`** (`business-onboarding.tsx`, `success.tsx`, profil / mode business, erreurs réseau), **`admin_chrono`** (liste + fiche partenaire + modales + **`partner/.../billing`**), **messages API** (`message` renvoyés au client), **e-mails / templates** (invitation portail, reset, etc.).
- [ ] **Alignement chiffres + mots** : chaque écran doit dire la **même chose** que le tableau « Grille tarifaire de référence » (prix, quotas, **dans le quota** / **au-delà**, sans forfait = **un** taux unique retenu).
- [ ] **Glossaire produit** (une page ou bloc en tête de doc interne) : définitions stables — ex. **« Quota mensuel »** = nombre de livraisons où s’applique le taux réduit ; **« Au-delà du quota »** = taux majoré ; **« Abonnement »** = montant FCFA / mois ; **« Paiement à la course »** = pas d’abonnement, commission sur **chaque** livraison. **Ne pas** mélanger **capacité**, **excédent**, **dépassement** sans la même définition partout.
- [ ] **Cohérence tutoiement / vouvoiement** : choisir **une** règle sur tout le parcours « Je suis pro » (aujourd’hui mélange possible entre étapes) et l’appliquer.
- [ ] **Ton & promesses** : pas de superlatifs faux (**illimité**, **0 %** si ce n’est plus le modèle) ; pas de « ajustable avec Krono » sans dire **ce qui est figé dans l’app** vs **ce qui est contrat**.

### Contenu par bloc d’écran (checklist fine)

- [ ] **Titre + sous-titre** de l’écran forfaits : phrase courte + **une** phrase pédagogique (« l’abonnement réduit la commission dans le quota vs paiement à la course ») ; retirer le paragraphe trop long si redondant avec les cartes.
- [ ] **Carte par plan** : titre, prix **FCFA/mois**, **3 lignes** alignées modèle mental — (1) quota inclus, (2) % dans le quota, (3) % au-delà ; **Business** = **toujours** un quota chiffré (ex. 110), jamais « illimité » contradictoire.
- [ ] **Carte « sans forfait / paiement à la course »** : une ligne claire sur le **taux unique** (après tranche 6–7 %) + « pas d’abonnement » + **pour qui** (volume faible / test).
- [ ] **Bloc « Comment ça marche ? »** : étapes **factuelles** (ce qui se passe dans l’app vs ce que fait l’admin vs e-mail portail) — recâbler le texte si le produit autorise un usage **avant** validation complète.
- [ ] **Champ e-mail portail** : label + aide + placeholder **pro** ; pas d’affichage brut d’adresse technique type `*.chrono.local` sans cadre « compte de test ».
- [ ] **Bouton principal + états** : libellé clair ; si désactivé → **message visible** (ex. « Choisissez un forfait ») ; texte de bas de page (facturation / activation) **aligné** avec la réalité juridique et produit.
- [ ] **Écran succès / profil** : pas de mention d’anciens plans ou taux ; messages après envoi de demande **cohérents** avec statut `pending` / `active`.

### Admin, portail, doc

- [ ] **Admin** : libellés colonnes, filtres, modales création / abonnement — **même vocabulaire** que l’app ; tooltips ou aide si un champ dérive du plan.
- [ ] **Portail partenaire (billing)** : intitulés « Taux in-quota / excédent / courses incluses » — chiffres issus de la **souscription** ou de la grille doc, pas d’anciennes constantes UI.
- [ ] **`krono-reference-unique.md`** et **`diagnostic-flux-partenaire.md`** : supprimer toute phrase qui **contredit** la grille finale ou les écrans ; une seule narration tarifaire.
- [ ] **Relecture finale** : orthographe, « FCFA », format des pourcentages (espace avant % si règle FR), accessibilité (contraste texte secondaire sur cartes).

### Recette (copy)

- [ ] **Parcours lecture seule** : quelqu’un qui ne connaît pas Krono lit les écrans **sans** voir de contradiction entre titre, cartes, encart vert et pied de page.
- [ ] **Cross-check** : comparer **capture à capture** (ou Figma) app ↔ admin ↔ portail pour les **quatre** plans.

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

- [ ] Reprendre **tous les textes** de ce parcours selon la section **« Copywriting & cohérence textuelle »** (pas seulement les nombres).
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
- [ ] Vérifier cohérence avec la **grille tarifaire de référence** (section en tête) et `krono-reference-unique.md` ; supprimer les anciens montants (15k / 40k / 100k, 3 % / 0 % Business, etc.) partout où ils traînent.

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

- [ ] Texte court sur l’app : ce que le partenaire **accepte** en cochant un plan (récap commission sur livraisons selon plan) — **même formulation** que la section **Copywriting** (pas un récap légal différent des cartes).
- [ ] Cohérence avec facturation / factures partenaire (`partner_invoices`, jobs) une fois le plan réellement actif.
- [ ] Conditions générales / mentions légales (si existantes) : mettre à jour les **montants et %** en même temps que l’app.

---

## 6. Tests / recette (à cocher après implémentation)

- [ ] **Recette copy** : critères de la section **« Copywriting & cohérence textuelle »** (parcours lecture seule + cross-check app / admin / portail).
- [ ] Nouveau partenaire : parcours complet jusqu’au choix de plan sans 20 % “fantôme” en admin.
- [ ] Toggle business off puis on (partenaire déjà agréé) : **aucune** remise en `pending`, **aucune** nouvelle activation admin requise.
- [ ] Vraie réadhésion / changement de dossier (si flux prévu) : re-demande nom + **re-choix plan** uniquement dans ce cas, pas à chaque toggle.
- [ ] Commande B2B avec partenaire sans plan : comportement attendu (blocage vs taux 0 avec log) validé.
- [ ] Admin active un `pending` : **forfait et e-mail** issus du téléphone visibles ; envoi lien portail OK ; commission dérivée du plan (plus de 20 % fantôme).
- [ ] Impossible de recréer un second partenaire pour le même compte utilisateur sans passer par une règle de fusion explicite.
- [ ] Après ajout delete/fusion admin : doublon supprimé ou fusionné sans orphelins en base.

---

## Notes de contexte (interne)

- Les **chiffres officiels** partenaire B2B sont ceux du **tableau « Grille tarifaire de référence »** en tête de ce fichier ; toute évolution passe par ce tableau puis propagation **app + admin + backend + doc** dans la même série de commits / release.
- Fichiers déjà identifiés pour les corrections : `chrono_backend/src/controllers/partnerController.ts`, `chrono_backend/src/routes/partnerRoutes.ts`, `chrono_backend/src/services/b2bCommissionService.ts`, `app_chrono/app/(tabs)/profile.tsx` (`handleModeToggle`, `deregisterAsPartner`), `chrono_backend/src/middleware/verifyPartnerUser.ts`, `admin_chrono/app/(dashboard)/partners/page.tsx` et `[id]/page.tsx`, `admin_chrono/lib/adminApiService.ts`, flux `invitePartnerUser` / activation ; **copy** : `app_chrono/app/(auth)/business-onboarding.tsx`, `app_chrono/app/(auth)/success.tsx`, `admin_chrono/app/(partner)/partner/[partnerId]/billing/page.tsx`, `docs/krono-reference-unique.md`, `docs/diagnostic-flux-partenaire.md`.

---

*Dernière mise à jour : section **Copywriting & cohérence textuelle** (refonte transverse + recette copy) ; fichiers copy listés en note ; grille + produit/UX inchangés en substance.*
