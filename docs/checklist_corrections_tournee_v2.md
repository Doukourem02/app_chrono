# Checklist corrections — Tournée groupée (round 2)

## [ ] 1. Bouton "Tous les colis récupérés" — position trop basse
**Constat :** Le bouton flottant violet couvre les infos ETA en bas de la carte (durée restante, heure d'arrivée).  
**Attendu :** Remonter le bouton suffisamment haut pour ne pas cacher l'ETA Mapbox. L'ETA doit rester lisible en dessous.

---

## [ ] 2. Bandeau "Adjust Volume to Hear Instructions" — toujours en anglais
**Constat :** Malgré l'ajout de `language="fr"` et `locale="fr"` sur le composant natif, ce bandeau système de Mapbox s'affiche en anglais.  
**Attendu :** Instructions et bannières système en français.  
**Piste :** Ce message vient peut-être d'un niveau plus bas du SDK Mapbox (config globale `mapbox.language` ou initialisation dans `mapboxInit.ts`) — à investiguer.

---

## [ ] 3. Map non nettoyée après fin de tournée (0 restant)
**Constat :** Après que le livreur revient à l'accueil, deux problèmes persistent :  
- Le FAB "Tournée · 0 restant(s)" reste visible.  
- Les marqueurs/tracés de la tournée restent affichés sur la carte.  

**Cause probable :**  
- Le `clearBatch()` est appelé uniquement sur le bouton "Retour à l'accueil" (écran `allDone`). Si le livreur revient via la flèche back ou un autre chemin, le store n'est pas vidé.  
- Les marqueurs sur la carte dans `DriverMapView` lisent peut-être `activeBatch` ou ses stops directement — même après vidage du store, la route affichée pourrait venir d'un état local (`animatedRoute` ou autre).  

**Attendu :** Dès que la tournée est terminée (0 stops pending + tous traités), le store est vidé, le FAB disparaît, la carte revient à son état normal (aucun tracé de tournée).

---

## [ ] 4. Notification push code de livraison — format + ouverture auto QR

### Contexte
Dans une tournée B2B, chaque destinataire Krono reçoit une notification push avec son code de validation. Le format actuel est trop technique pour le contexte ivoirien.

### Ce qui existe déjà (rien à créer)
- `app_chrono/components/QRCodeDisplay.tsx` — modal QR code + code numérique, complet
- `app_chrono/services/clientPushService.ts` — listener de tap sur notif, navigue vers `/order-tracking/{orderId}`
- Le type `delivery_proof_code` est déjà géré dans le listener
- Scheme deep link `appchrono://` configuré dans `app.config.js`

### Changement 1 — Format de la notification (côté backend)
**Actuel :**
- Titre : `"Code de réception Krono"`
- Corps : `"Votre code de réception est 786220. Montrez le QR ou le code au livreur."`

**Attendu (Option C validée) :**
- Titre : `"Code de livraison : {code}"` — le code visible sans ouvrir la notif
- Corps : `"Votre livreur Krono est en chemin. Montrez ce code à la réception."`
- Le payload doit inclure `code` dans `data` : `{ type: "delivery_proof_code", orderId: "xxx", code: "786220" }`

### Changement 2 — Ouverture automatique du QR au tap (côté app_chrono)
**Actuel :** tap notif → écran tracking → client doit appuyer sur "Afficher le QR code" manuellement.

**Attendu :** tap notif → écran tracking → modal QR s'ouvre **automatiquement**.

**Implémentation :**
1. Dans `clientPushService.ts`, ajouter `?openQR=1` à la navigation pour le type `delivery_proof_code` :
   ```
   /order-tracking/{orderId}?openQR=1
   ```
2. Dans `app_chrono/components/TrackingBottomSheet.tsx` (ou l'écran order-tracking), détecter le param `openQR` et déclencher l'ouverture automatique de `QRCodeDisplay`.
