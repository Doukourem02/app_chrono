# Checklist — Icône livreur PNG sur la carte `/track`

Aujourd’hui la page de suivi public utilise **déjà** des marqueurs par défaut : pastilles colorées (retrait / livraison) et, pour le livreur, le fichier **`admin_chrono/public/assets/track-driver-marker.svg`** (flèche orientée vers le nord, la rotation cap / direction s’applique dessus). **Aucune action obligatoire** tant que tu n’as pas les PNG.

Quand tu auras les visuels livreur, suis cette liste pour basculer sur tes assets sans toucher au code métier.

## Avant de remplacer

- [ ] Les PNG (ou un seul sprite « vue du dessus ») sont dessinés **vers le haut = nord** ; sinon la rotation GPS ne correspondra pas à la route.
- [ ] Migration cap livreur appliquée en prod si ce n’est pas déjà fait : `driver_profiles.heading_degrees` (`008_driver_profiles_heading_degrees.sql` ou script équivalent).

## Hébergement de l’image

- [ ] Choisir **une** de ces options :
  - [ ] **URL absolue** : héberger le PNG (CDN, bucket public, dossier statique) et noter l’URL HTTPS finale.
  - [ ] **Fichier dans le front** : copier le PNG dans `admin_chrono/public/` (ex. `public/assets/track-driver.png`) et utiliser le chemin **`/assets/track-driver.png`** dans la variable ci‑dessous.

## Configuration `admin_chrono` (Vercel / .env)

- [ ] Définir **`NEXT_PUBLIC_TRACK_DRIVER_ICON_URL`** avec l’URL ou le chemin public (ex. `https://…/livreur.png` ou `/assets/track-driver.png`).
- [ ] Redéployer l’admin après modification des variables d’environnement.
- [ ] Vider le cache navigateur ou test navigation privée si l’ancienne icône reste affichée.

## Vérifications sur `/track/{token}`

- [ ] Le marqueur livreur affiche le **nouveau** visuel.
- [ ] En course, le marqueur **bouge** de façon fluide entre deux rafraîchissements API.
- [ ] Le marqueur **pivote** dans le sens du déplacement (ou du cap GPS si disponible).

## Optionnel — plusieurs résolutions

- [ ] Si tu prévois `@2x` / `@3x` : soit un PNG unique assez grand (`object-fit: contain` est déjà utilisé), soit plus tard une évolution du code pour choisir l’URL selon `devicePixelRatio` (non implémenté par défaut).

## Référence code

- Composant carte : `admin_chrono/components/track/PublicTrackMap.tsx` (`trackDriverIconUrl()`, `buildDriverMarkerShell()`).
- SVG par défaut : `admin_chrono/public/assets/track-driver-marker.svg` (tu peux le remplacer par un autre SVG temporaire sans variable d’env).
