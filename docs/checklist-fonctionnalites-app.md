# Actions à exécuter — Chrono

Ce fichier est la **seule liste de travail active**.
Le reste doit rester dans `docs/krono-reference-unique.md`, qui sert de mémoire du projet.

Règle de travail :

- On commence par les priorités hautes.
- On termine un bloc avant d’ouvrir un nouveau chantier.
- Quand un bloc est fini, on coche ici.
- On n’ajoute pas de nouveau fichier `.md` pour une tâche temporaire.

---

## Ordre recommandé

1. **P0 — Stabiliser le Dynamic Island iOS sur appareil réel**
2. **P1 — Verrouiller les cas limites Live Activity**
3. **P2 — Cohérence notifications + APNs Live Activity**
4. **P3 — Améliorer Android ongoing notification**
5. **P4 — Notifications périodiques intelligentes**
6. **P5 — Widgets écran d’accueil**
7. **P6 — Expérience attractive & rétention**
8. **P7 — Validations prod / TestFlight**
9. **P8 — Fondations app mature : i18n, accessibilité, analytics, offline**
10. **Backlog plus tard : raccourcis, PSP, confidentialité avancée**

---

## Déjà livré — Dynamic Island / Live Activity iOS

- [x] Projet iOS compatible Live Activities : target iOS `16.2`, EAS/dev client, pas Expo Go.
- [x] `NSSupportsLiveActivities` activé et cible `ExpoWidgetsTarget` configurée.
- [x] Approche choisie : `expo-widgets` + `@expo/ui` + patch natif `patch-package`.
- [x] Modèle `OrderTrackingLiveProps` : ETA, statut, progression, véhicule, plaque, avatar, téléphone, pending, biker.
- [x] Démarrage dès `pending` pour afficher la recherche de livreur.
- [x] Mise à jour sur statuts / ETA / progression / position livreur.
- [x] Fin de l’activité quand la commande est terminée, annulée, ou hors suivi.
- [x] Compact Dynamic Island : icône véhicule + `Recherche` ou temps restant.
- [x] Minimal Dynamic Island configuré, sans texte parasite `ETA`.
- [x] Expanded Dynamic Island : branding violet, texte FR, véhicule, plaque, avatar, progression, biker.
- [x] Écran verrouillé cohérent avec l’îlot : fond translucide, avatar, progression alignée.
- [x] Cache natif avatar + cache image biker pour éviter les images manquantes.
- [x] Deep link Live Activity vers `appchrono://order-tracking/{orderId}`.
- [x] Android : notification persistante de foreground service déjà en place côté client pendant une commande active en arrière-plan.
- [x] Android : notification persistante de foreground service déjà en place côté chauffeur pour le suivi de position.

---

## P0 — Stabiliser iOS réel

Objectif : valider ce qui existe déjà avant d’ajouter APNs ou Android.

- [ ] Rebuild iOS propre après les derniers changements `expo-widgets`.
- [ ] Installer sur iPhone réel via EAS / TestFlight / dev client.
- [ ] Tester l’état `pending` : compact affiche icône voiture + `Recherche`, sans ETA.
- [ ] Tester l’état accepté : `Prise en charge dans X min`, avatar livreur, véhicule, plaque.
- [ ] Tester l’état vers pickup / récupération colis.
- [ ] Tester l’état livraison : texte `Livraison dans X min` ou `En livraison`.
- [ ] Tester fin propre : `completed`, `cancelled`, aucun livreur.
- [ ] Vérifier les 4 vues : compact, minimal, expanded, écran verrouillé.
- [ ] Vérifier tap Live Activity vers `order-tracking`.
- [ ] Capturer un screenshot de référence par état validé.

---

## P1 — Cas limites Live Activity

Objectif : éviter les doublons, les activités mortes et les comportements flous.

- [ ] Décider la règle si plusieurs commandes sont actives : commande sélectionnée, plus récente, ou priorité statut.
- [ ] Vérifier qu’une seule Live Activity client reste active pour la commande suivie.
- [ ] Tester fermeture manuelle de la Live Activity par iOS / utilisateur.
- [ ] Tester retour app premier plan après activité fermée.
- [ ] Prévoir fallback si Live Activities est désactivé dans Réglages iOS.
- [ ] Documenter clairement : app tuée = updates locales impossibles sans APNs Live Activity.
- [ ] Vérifier qu’aucune activité orpheline ne reste après annulation / livraison.

---

## P2 — Notifications + APNs Live Activity

Objectif : mettre à jour l’îlot même app fermée, sans spammer avec des notifications classiques.

### Cohérence notifications

- [ ] Créer une table de décision : statut → Live Activity seule / push classique / les deux.
- [ ] Ne pas envoyer une push classique identique à une info déjà visible dans la Live Activity.
- [ ] Garder les push classiques pour les événements critiques : annulation, aucun livreur, message livreur, problème paiement.
- [ ] Utiliser les push classiques comme fallback si Live Activity absente, refusée ou fermée.

### APNs Live Activity

- [ ] Récupérer le push token ActivityKit côté app client.
- [ ] Associer ce token à `order_id` + `user_id`.
- [ ] Créer la persistance backend des tokens Live Activity.
- [ ] Envoyer depuis le backend des payloads APNs ActivityKit : statut, ETA, progression.
- [ ] Gérer les erreurs APNs : token expiré, activité terminée, permission refusée.
- [ ] Tester update Dynamic Island avec app client en arrière-plan.
- [ ] Tester update Dynamic Island avec app client fermée.

---

## P3 — Améliorer Android ongoing notification

Objectif : partir de la notification Android déjà en place et la rendre plus produit.

- [x] Base client : `startClientBackgroundAlignment` démarre une notification foreground service `Krono — suivi de commande`.
- [x] Base chauffeur : `startDriverBackgroundLocation` démarre une notification foreground service `Krono Pro — suivi actif`.
- [ ] Créer si nécessaire une chaîne Android dédiée au suivi commande, distincte du canal push `default`.
- [ ] Enrichir le texte Android avec le statut réel : recherche, prise en charge, livraison, terminé.
- [ ] Ajouter ETA ou progression quand Android le permet proprement.
- [ ] Ajouter action `Voir` vers `order-tracking`.
- [ ] Étudier action `Contacter` si téléphone livreur disponible.
- [ ] Vérifier arrêt automatique si la commande passe `completed`, `cancelled` ou timeout pendant que l’app reste en arrière-plan.

---

## P4 — Notifications périodiques intelligentes

Objectif : rendre l’app présente au bon moment, sans harceler l’utilisateur.

### Rappels client

- [ ] Définir les cas autorisés : commande non finalisée, dette/reliquat, rappel de note livreur, récap livraison.
- [ ] Ajouter des notifications locales planifiées avec `expo-notifications` seulement quand elles apportent une vraie valeur.
- [ ] Annuler automatiquement les rappels quand la commande change de statut ou est terminée.
- [ ] Éviter les doublons avec push backend, Live Activity et Android foreground service.
- [ ] Ajouter une préférence utilisateur pour désactiver rappels / récaps non critiques.

### Rappels chauffeur

- [ ] Rappel si le livreur est en ligne mais inactif depuis longtemps, seulement si produit valide.
- [ ] Rappel de recharge commission si solde faible ou insuffisant.
- [ ] Rappel de mission acceptée si pickup approche et que l’app est en arrière-plan.
- [ ] Annuler les rappels dès que le livreur agit ou que la commande change.

### Récaps utiles

- [ ] Client : récap hebdomadaire léger des livraisons si l’utilisateur accepte ce type de notification.
- [ ] Chauffeur : récap journalier ou hebdomadaire revenus / livraisons.
- [ ] Ne jamais envoyer de notification périodique marketing sans réglage clair.

---

## P5 — Widgets écran d’accueil

Objectif : donner une présence utile à Krono même quand l’app n’est pas ouverte.

### Widget client

- [ ] Petit widget : statut de la commande active ou dernière livraison.
- [ ] Moyen widget : ETA, statut, bouton d’ouverture vers `order-tracking`.
- [ ] État sans commande : raccourci nouvelle livraison + message discret.
- [ ] Ne pas afficher d’informations sensibles si le téléphone est verrouillé, selon les limites iOS/Android.

### Widget chauffeur

- [ ] Petit widget : état en ligne / hors ligne.
- [ ] Moyen widget : course active, pickup/dropoff simplifié, revenus du jour.
- [ ] Raccourci vers l’écran principal chauffeur.

### Contraintes techniques

- [ ] Décider si on réutilise `expo-widgets` ou si on garde les widgets plus tard selon stabilité.
- [ ] Définir les données minimales stockées en App Group / équivalent Android.
- [ ] Prévoir des états vides élégants pour éviter un widget inutile.

---

## P6 — Expérience attractive & rétention

Objectif : rendre l’application plus agréable, mémorable et motivante, sans gadget inutile.

- [ ] Onboarding plus premium : expliquer suivi live, notifications, sécurité, paiement.
- [ ] Écran commande terminée plus travaillé : résumé, note livreur, partage, nouvelle livraison.
- [ ] Historique commandes plus vivant : filtres, badges de statut, recherche.
- [ ] Micro-interactions utiles : confirmation création commande, pickup proche, livraison terminée.
- [ ] Gamification légère côté chauffeur : badges, objectifs journaliers, progression revenus.
- [ ] Centre de préférences : notifications, langue, confidentialité, thème si besoin.
- [ ] Support rassurant : accès rapide aide / litige / remboursement selon statut commande.

---

## P7 — Validations prod / TestFlight

Objectif : éviter qu’un build TestFlight marche moins bien que le local.

- [ ] Vérifier variables EAS production : API, socket, Supabase, Mapbox, légal, Sentry.
- [ ] Tester OTP réel sur device.
- [ ] Tester login puis arrière-plan puis retour : session conservée.
- [ ] Tuer l’app puis relancer : session conservée si refresh token valide.
- [ ] Tester création commande client + acceptation livreur sur appareils réels.
- [ ] Tester temps réel après retour au premier plan.
- [ ] Tester Sentry mobile avec une erreur volontaire.
- [ ] Vérifier API prod : `/health` et `/health/live`.
- [ ] Vérifier pages CGU / confidentialité et URLs EAS.

---

## P8 — Fondations app mature

Objectif : solidifier l’expérience globale après le suivi commande.

- [ ] Internationalisation client / chauffeur si plusieurs langues.
- [ ] Accessibilité : VoiceOver / TalkBack, tailles dynamiques, contrastes.
- [ ] Mode hors ligne explicite : messages, retry, file d’attente actions critiques.
- [ ] Analytics produit mobile : brancher fournisseur ou pipeline maison.
- [ ] Réglages notifications dans l’app : statuts, messages, marketing si besoin.
- [ ] Universal Links / App Links : liens `https://...` qui ouvrent l’app au bon écran.
- [ ] Politique de version minimale : quoi faire si l’API change et qu’une app trop ancienne tourne encore.
- [ ] Tests automatiques ciblés : auth, refresh token, création commande, statut commande.

---

## Backlog plus tard

- [ ] Raccourcis Siri / Android shortcuts.
- [ ] Centre confidentialité : export / suppression compte.
- [ ] Préférences email / SMS / push centralisées.
- [ ] PSP / paiements réels : Orange Money, Wave, MTN, agrégateur.
- [ ] Paiement du reliquat / différé complet.
- [ ] Durcissement QR : scan obligatoire avant `completed` si décision produit.

---

## Référence

Toutes les explications longues, cartes de fichiers, règles produit et rappels prod sont dans :

- `docs/krono-reference-unique.md`
