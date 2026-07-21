# Plan d'integration - Onboarding et chargements animes

Objectif : remplacer uniquement les attentes visibles par des petites scenes animees Krono, sans alourdir les boutons ni casser les skeletons utiles.

## Etat actuel

- `app_chrono` : application client Expo. Elle a deja `react-native-reanimated`, des composants dans `app_chrono/components/animations/`, et un `LoadingOverlay` centralisable. Pas de Lottie installe.
- `driver_chrono` : application livreur Expo. Meme base d'animations que le client dans `driver_chrono/components/animations/`. Pas de Lottie installe.
- `admin_chrono` : dashboard Next.js. Il utilise deja `framer-motion`, `SkeletonLoader` et des assets publics dans `admin_chrono/public/assets/`. Pas de Lottie installe.
- `chrono_backend` : hors scope pour cette idee.

## Decision recommandee

Creer un composant par app, avec la meme API :

- `app_chrono/components/animations/KronoLoadingScene.tsx`
- `driver_chrono/components/animations/KronoLoadingScene.tsx`
- `admin_chrono/components/animations/KronoLoadingScene.tsx`

API conseillee :

```ts
type KronoLoadingVariant =
  | 'app-start'
  | 'map'
  | 'search-driver'
  | 'order'
  | 'payment'
  | 'route'
  | 'qr'
  | 'messages'
  | 'dashboard'
  | 'tracking';
```

Ajouter ensuite l'export dans :

- `app_chrono/components/animations/index.ts`
- `driver_chrono/components/animations/index.ts`
- `admin_chrono/components/animations/index.ts`

## Assets a prevoir

### Expo client et livreur

Creer :

- `app_chrono/assets/animations/`
- `driver_chrono/assets/animations/`

Noms proposes :

- `client-app-start.json`
- `client-map-loading.json`
- `client-search-driver.json`
- `client-order-loading.json`
- `driver-app-start.json`
- `driver-route-loading.json`
- `driver-qr-processing.json`
- `driver-earnings-loading.json`

### Admin Next.js

Creer :

- `admin_chrono/public/animations/`

Noms proposes :

- `admin-dashboard-loading.json`
- `admin-tracking-loading.json`
- `admin-order-loading.json`
- `public-tracking-loading.json`

## Dependances possibles

Option A, la plus propre pour des personnages animes :

- `app_chrono` : installer `lottie-react-native`
- `driver_chrono` : installer `lottie-react-native`
- `admin_chrono` : installer `lottie-react`

Option B, sans nouvelle dependance :

- Expo : animer les images existantes (`deliveryman.png`, `moto.png`, `biker.png`) avec `react-native-reanimated`.
- Admin : animer `public/assets/deliveryman.png` avec `framer-motion`.

Option A donne le rendu le plus premium. Option B est plus rapide et plus legere.

## Ou les mettre exactement

### 1. `app_chrono` - priorite haute

1. Demarrage / verification de session

- Fichier : `app_chrono/app/index.tsx`
- Ligne actuelle : `100`, ecran blanc volontaire.
- Action future : remplacer le `<View />` blanc par `KronoLoadingScene variant="app-start" message="Ouverture de Krono..." fullScreen`.
- Pourquoi : c'est le premier contact utilisateur.

2. Overlay global de chargement

- Fichier : `app_chrono/components/LoadingOverlay.tsx`
- Lignes actuelles : `20-24`, `ActivityIndicator` + message.
- Action future : remplacer le spinner par `KronoLoadingScene`, en gardant la `Modal`.
- Pourquoi : ce composant peut servir partout sans repasser sur chaque ecran.

3. Recherche d'un livreur

- Fichier : `app_chrono/components/DriverSearchBottomSheet.tsx`
- Lignes actuelles : `372-405`, carte flottante de recherche avec timer/progress bar.
- Action future : ajouter une petite scene `client-search-driver` au-dessus ou a gauche du titre, sans supprimer le timer ni le bouton Annuler.
- Pourquoi : c'est l'attente la plus emotionnelle cote client.

4. Chargement de la carte

- Fichier : `app_chrono/app/(tabs)/map.tsx`
- Lignes actuelles : `1230-1234`, texte "Chargement de la carte...".
- Action future : afficher `KronoLoadingScene variant="map" message="Preparation de la carte..."`.

5. Chargement du suivi commande

- Fichier : `app_chrono/app/order-tracking/[orderId].tsx`
- Lignes actuelles : `543-561`, icone sablier + texte.
- Action future : remplacer le sablier par `KronoLoadingScene variant="order" message="Chargement de la commande..."`.

6. Chargement des listes importantes

- Fichier : `app_chrono/components/ShipmentList.tsx`
- Lignes actuelles : `801-809`, skeleton de commandes.
- Action future : garder les skeletons, ajouter une petite animation compacte en haut si le chargement depasse environ 700 ms.

7. Ecrans profil avec attente pleine zone

- `app_chrono/app/profile/payment-methods.tsx` lignes `121-125`
- `app_chrono/app/profile/transactions.tsx` lignes `221-224`
- `app_chrono/app/profile/ratings.tsx` lignes `76-78`
- `app_chrono/app/profile/debts.tsx` lignes `135-136`
- Action future : remplacer les `ActivityIndicator size="large"` par `KronoLoadingScene` compact.

8. A ne pas transformer en gros personnage

- `app_chrono/app/(auth)/complete-profile.tsx` lignes `121-122`
- `app_chrono/app/(auth)/business-onboarding.tsx` lignes `216-217`
- `app_chrono/components/NewB2BShippingModal.tsx` lignes `239-240`
- Action future : garder un petit indicateur dans les boutons. Une animation personnage dans un bouton ferait trop lourd.

### 2. `driver_chrono` - priorite haute

1. Demarrage / verification de session

- Fichier : `driver_chrono/app/index.tsx`
- Ligne actuelle : `124`, ecran blanc volontaire.
- Action future : remplacer le `<View />` blanc par `KronoLoadingScene variant="app-start" message="Preparation de votre espace livreur..." fullScreen`.

2. Chargement de tournee

- Fichier : `driver_chrono/app/batch/[batchId].tsx`
- Lignes actuelles : `559-563`, spinner + "Chargement de la tournee...".
- Action future : remplacer par `KronoLoadingScene variant="route" message="Preparation de la tournee..."`.
- Pourquoi : tres bon endroit pour montrer un livreur qui organise les colis.

3. QR code

- Fichier : `driver_chrono/components/QRCodeScanner.tsx`
- Lignes actuelles : `84-90`, chargement permissions camera.
- Lignes actuelles : `147-151`, traitement QR code.
- Action future : utiliser `variant="qr"` pour le traitement, et garder un etat plus sobre pour la permission.

4. Revenus et commission

- `driver_chrono/app/(tabs)/revenus.tsx` lignes `229-248`
- `driver_chrono/app/commission/index.tsx` lignes `170-173`
- Action future : utiliser `variant="payment"` ou `driver-earnings-loading`, compact.

5. Profil livreur

- `driver_chrono/app/profile/payments.tsx` lignes `76-79`
- `driver_chrono/app/profile/statistics.tsx` lignes `109-112`
- Action future : remplacer par `KronoLoadingScene` compact.

6. Messages, badges, classement

- `driver_chrono/app/messages/[conversationId].tsx` lignes `208-210`
- `driver_chrono/components/LeaderboardCard.tsx` lignes `49-53`
- `driver_chrono/components/BadgesDisplay.tsx` lignes `55-59`
- Action future : animation tres petite ou skeleton simple. Pas prioritaire.

7. A ne pas transformer en gros personnage

- Spinners dans boutons de sauvegarde profil, upload documents, acceptation/refus de commande.
- Raison : ce sont des micro-attentes, il faut garder la reaction rapide.

### 3. `admin_chrono` - priorite moyenne

1. Layout admin protege

- Fichier : `admin_chrono/app/(dashboard)/layout.tsx`
- Lignes actuelles : `102-117`, deux skeletons plein ecran.
- Action future : remplacer par `KronoLoadingScene variant="dashboard" message="Chargement du cockpit..." fullScreen`.

2. Login admin et partenaire

- `admin_chrono/app/login/page.tsx` lignes `28-38`
- `admin_chrono/app/partner/login/page.tsx` lignes `41-44`
- Action future : remplacer le texte seul par une animation compacte avec logo/bonhomme.

3. Suivi public

- Fichier : `admin_chrono/app/track/[token]/page.tsx`
- Lignes actuelles : `165-171`, spinner sur carte publique.
- Action future : tres bon endroit pour `variant="tracking"` avec livreur en approche.

4. Layout partenaire

- Fichier : `admin_chrono/app/(partner)/partner/[partnerId]/layout.tsx`
- Lignes actuelles : `79-83`, skeleton plein ecran.
- Action future : `variant="dashboard"` compact.

5. Pages data lourdes

- `admin_chrono/app/(dashboard)/orders/page.tsx` lignes `485-499`
- `admin_chrono/app/(dashboard)/tracking/page.tsx` lignes `435-440`
- `admin_chrono/app/(partner)/partner/[partnerId]/orders/[orderId]/tracking/page.tsx` lignes `471-475`
- Action future : garder les skeletons pour la structure, ajouter une animation compacte seulement si l'attente depasse environ 700 ms.

## Ordre d'implementation conseille

1. Creer les composants `KronoLoadingScene` dans les trois apps.
2. Ajouter les dossiers d'assets d'animation.
3. Brancher d'abord :
   - `app_chrono/app/index.tsx`
   - `app_chrono/components/LoadingOverlay.tsx`
   - `app_chrono/components/DriverSearchBottomSheet.tsx`
   - `driver_chrono/app/index.tsx`
   - `driver_chrono/app/batch/[batchId].tsx`
   - `driver_chrono/components/QRCodeScanner.tsx`
   - `admin_chrono/app/(dashboard)/layout.tsx`
   - `admin_chrono/app/track/[token]/page.tsx`
4. Ensuite seulement, remplacer les chargements secondaires.

## Regles UX

- Garder les spinners dans les boutons.
- Garder les skeletons quand ils representent la future structure d'une liste ou d'un tableau.
- Utiliser les personnages pour les attentes qui prennent de la place : demarrage, carte, suivi, recherche livreur, tournee, QR, dashboard.
- Ne pas bloquer les actions utiles : les boutons "Annuler", "Retour" et "Reessayer" doivent rester visibles.
- Prevoir une version reduite si l'utilisateur active la reduction des animations.

