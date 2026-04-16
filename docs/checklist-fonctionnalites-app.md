# Checklist — fonctionnalités qu’on peut encore mettre en place (Chrono)

Référence courte pour tout ce qui **n’est pas** la checklist prod de `ckprod.md`.  
Objectif : savoir **quoi** peut être ajouté sans confondre avec ce qui existe déjà (push distant, navigation depuis la notif, `expo-linking`, Mapbox, Sentry, schéma `appchrono://`, analytics admin/backend, etc.).

---

## Live Activities & Dynamic Island (iOS) — expérience type Yango

Les apps comme **Yango** affichent une **course en cours** dans l’**îlot Dynamique** et sur l’écran de verrouillage : ce n’est pas un écran React Native ; c’est **ActivityKit** (Live Activity) rendue par iOS. L’app **démarre**, **met à jour** et **termine** l’activité ; le backend peut aussi pousser des mises à jour via **APNs** (Live Activity push).

### Prérequis & stack

- [ ] **iOS 16.1+** ciblé ; **pas Expo Go** — build avec **EAS** / dev client / prebuild.
- [ ] Activer **Live Activities** dans le projet (ex. `NSSupportsLiveActivities`, entitlements Xcode).
- [ ] Choisir une approche : **`expo-widgets` (alpha)** + **Expo UI** (`@expo/ui` → SwiftUI), ou lib type **`expo-live-activity`**, ou **module Swift** + **expo-apple-targets** — toutes impliquent une **extension** et du **pont natif** depuis le JS.

### Données & cycle de vie (métier livraison)

- [ ] Définir un **modèle d’attributs** ActivityKit (ex. ETA restante, libellé véhicule, plaque, progression 0–1, statut lisible).
- [ ] **Démarrer** l’activité au bon moment (ex. chauffeur assigné / course acceptée — aligner sur les statuts `order` / sockets).
- [ ] **Mettre à jour** à chaque changement pertinent (ETA, statut, avancement sur la « ligne ») — sans sur-solliciter ActivityKit.
- [ ] **Terminer** l’activité à la livraison, annulation ou timeout produit.
- [ ] (Optionnel) **Mises à jour push** depuis le backend pour rester à jour **sans** rouvrir l’app (tokens Live Activity, payload APNs conforme Apple).

### Mise en page (slots) — viser le rendu « pro »

- [ ] **Dynamic Island — compact** : zone « leading » + « trailing » (petit texte / icône).
- [ ] **Dynamic Island — minimal** : point ou icône quand plusieurs activités.
- [ ] **Dynamic Island — expanded** : zones **leading**, **center**, **trailing**, **bottom** (ex. marque, **« X min left »**, **véhicule + plaque**, **barre de progression** avec icône voiture / arrivée).
- [ ] **Bannière écran de verrouillage** : même histoire de course, cohérente avec l’îlot.
- [ ] **Images** : limites Apple (taille, cache) ; vérifier support Expo UI / widgets si besoin d’illustration véhicule.

### Qualité & UX

- [ ] Cohérence **texte / branding** (ex. « Krono ») avec l’app.
- [ ] Deep link : tap sur la Live Activity → **même écran** que `clientPushService` / suivi commande (`order-tracking`).
- [ ] Gestion des cas limites : **plusieurs commandes** (quelle activité afficher ?), **app tuée**, **permissions**.

---

## Suivi en cours — Android (pas d’îlot)

- [ ] **Notification ongoing** riche (style course en cours) : chaîne dédiée, priorité, actions « Voir / Contacter ».
- [ ] **Barre de progression** ou texte mis à jour (comme l’équivalent fonctionnel du bas de l’îlot iOS).
- [ ] **Foreground service** si la politique Play Store / métier l’exige pour la géoloc ou le suivi continu — à valider juridique + batterie.

---

## Notifications

- [ ] **Notifications locales planifiées** (rappels, récaps) : `expo-notifications` — pas de `scheduleNotification` dans le repo aujourd’hui ; à ajouter si le produit le veut (permissions, annulation quand la commande change).
- [ ] **Catégories / actions sur la notif** (ex. « Voir », « Ignorer ») — iOS / Android.
- [ ] **Réglages dans l’app** : granularité (statuts commande, messages, marketing le cas échéant).
- [ ] **Cohérence** avec les Live Activities : ne pas doubler inutilement le même message (produit décide).

---

## Widgets & système

- [ ] **Widgets écran d’accueil** (prochaine course, statut) : `expo-widgets` / extension — distinct des Live Activities (widgets = « check-in », Live Activity = « en cours »).
- [ ] **Raccourcis** : Siri Shortcuts / App Shortcuts Android (ex. « Nouvelle course », « Mode en ligne »).

---

## Liens & découverte

- [ ] **Universal Links / App Links** (`https://…` → ouvre l’app sur le bon écran) : compléter domaines associés + fichiers hébergés (`apple-app-site-association`, `assetlinks.json`) et routes `expo-router` alignées.
- [ ] **Liens de partage** (SMS / WhatsApp) vers suivi ou parrainage — si produit.

---

## Expérience utilisateur « app mature »

- [ ] **Internationalisation** : l’admin a une couche i18n ; prévoir un système i18n côté apps client / chauffeur si plusieurs langues.
- [ ] **Accessibilité** : labels VoiceOver / TalkBack, tailles dynamiques, contrastes — audit ciblé sur les écrans sensibles.
- [ ] **Mode hors ligne explicite** : message + file d’attente / retry sur les actions critiques.

---

## Mesure & confiance

- [ ] **Analytics produit sur mobile** : `app_chrono/utils/analytics.ts` définit des événements ; brancher un fournisseur (ou pipeline maison) et valider confidentialité / CGU.
- [ ] **Sentry** : code présent — compléter variables EAS + tests d’erreur (voir `ckprod.md` §3.1 bis).

---

## Engagement & conformité (optionnel selon juridiction)

- [ ] **Centre de confidentialité** / export / suppression de compte si exigé.
- [ ] **Préférences** email / SMS / push centralisées.

---

## Métier livraison

- [ ] **Arrière-plan** : affiner `expo-task-manager` / géoloc selon OS (batterie, permission « toujours »).
- [ ] **PSP / paiements réels** : surtout backend quand les accords sont là — voir `krono-reference-unique.md` §5.

---

*À mettre à jour quand une case est traitée ou abandonnée.*
