# Checklist — portail partenaire & invitation

À cocher au fur et à mesure. Dernière mise à jour : alignement avec le flux « compte app existant + accès portail ».

---

## Portail partenaire & invitation

- [ ] **Déployer / redémarrer** le backend avec le code qui gère l’e-mail **déjà enregistré** côté Supabase Auth (liaison `partner_users` + lien magic / recovery au lieu d’échouer sur `inviteUserByEmail`).
- [ ] **Tester** « Inviter au portail » avec le **même** e-mail que sur l’app client → la requête doit **réussir** (plus de message *A user with this email address has already been registered*).
- [ ] **Supabase → Authentication → URL configuration** : ajouter l’URL de **`PARTNER_PORTAL_URL`** (ex. page de login du portail) dans **Redirect URLs** pour que les liens magic / recovery fonctionnent après clic.

---

## E-mails (lien portail envoyé par le backend Krono)

- [ ] Renseigner dans **`chrono_backend/.env`** : `EMAIL_USER`, `EMAIL_PASS`, idéalement `EMAIL_FROM_NAME` et `EMAIL_FROM_ADDRESS` (et `EMAIL_HOST` / `EMAIL_PORT` si ton fournisseur n’est pas Gmail par défaut).
- [ ] **Redémarrer** le backend après modification du `.env`.
- [ ] **Retester** l’invitation et vérifier la **réception** du mail avec le lien « Se connecter au portail ».

---

## Si SMTP Krono n’est pas configuré

- [ ] Vérifier dans **Supabase** que **« Mot de passe oublié »** sur la page de login du portail envoie bien un e-mail (SMTP / templates Auth côté Supabase).
- [ ] Communiquer aux partenaires : **URL du portail** + consigne d’utiliser **Mot de passe oublié** une fois l’accès portail ajouté (liaison `partner_users`).

---

## Données & parcours produit (optionnel)

- [ ] Décider si l’**e-mail portail** doit être **obligatoire** à l’étape forfait dans l’app (`business-onboarding`) — aujourd’hui le flux peut encore envoyer sans e-mail portail si `users.email` est vide et que le champ n’est pas validé.
- [ ] Si l’app a besoin de **`users.partner_id`** en base : ajouter une **migration SQL** et aligner avec `partner_users` (certaines bases n’ont pas encore cette colonne).

---

## Recette bout en bout

- [ ] **App** : parcours boutique (nom, forfait, e-mail portail si applicable) → demande **pending**.
- [ ] **Admin** : activation partenaire → vérifier l’**auto-liaison** / invitation si e-mail connu.
- [ ] **Admin** : « Inviter au portail » (ou renvoi) → accès OK.
- [ ] **Portail** : connexion → pages **dashboard / commandes / facturation** selon les besoins.

---

## Rappel utile

- Vider les tables **`partners`** / B2B en SQL **ne supprime pas** les utilisateurs **Authentication** Supabase. Les conflits « e-mail déjà utilisé » venaient d’**Auth**, pas seulement des lignes `partners`.
