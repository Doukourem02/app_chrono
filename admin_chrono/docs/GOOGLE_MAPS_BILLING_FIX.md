# Guide de résolution : Erreurs Google Maps

## Erreurs possibles

### 1. BillingNotEnabledMapError
Vous voyez l'erreur `BillingNotEnabledMapError` même si vous avez déjà configuré un compte de facturation Google Cloud.

### 2. DeletedApiProjectMapError
Vous voyez l'erreur `DeletedApiProjectMapError` - cela signifie que le projet Google Cloud associé à votre clé API a été supprimé ou désactivé.

---

## Résolution : BillingNotEnabledMapError

## Solutions étape par étape

### 1. Vérifier que les APIs sont activées

Les APIs suivantes **doivent être activées** dans votre projet Google Cloud :

1. **Maps JavaScript API** (obligatoire)
2. **Places API** (obligatoire)
3. **Geocoding API** (recommandé)

**Comment activer :**
1. Allez sur [Google Cloud Console - APIs](https://console.cloud.google.com/google/maps-apis/apis)
2. Sélectionnez votre projet
3. Pour chaque API, cliquez sur "ENABLE" si elle n'est pas déjà activée

### 2. Vérifier que le projet est lié au compte de facturation

1. Allez sur [Google Cloud Console - Billing](https://console.cloud.google.com/billing)
2. Sélectionnez votre projet dans le menu déroulant en haut
3. Vérifiez que le compte de facturation est bien associé au projet
4. Si ce n'est pas le cas :
   - Cliquez sur "LINK A BILLING ACCOUNT"
   - Sélectionnez votre compte de facturation
   - Confirmez la liaison

### 3. Vérifier la clé API

1. Allez sur [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Trouvez votre clé API
3. Vérifiez que :
   - La clé API est **active** (pas désactivée)
   - Les **restrictions d'application** autorisent votre domaine/IP
   - Les **restrictions d'API** incluent :
     - Maps JavaScript API
     - Places API
     - Geocoding API (si utilisé)

### 4. Vérifier la configuration dans votre application

Vérifiez que votre fichier `.env.local` contient bien la bonne clé API :

```bash
NEXT_PUBLIC_GOOGLE_API_KEY=votre_cle_api_ici
```

**Important :** Après avoir modifié `.env.local`, vous devez **redémarrer votre serveur de développement**.

### 5. Vérifier les quotas et limites

1. Allez sur [Google Cloud Console - APIs & Services - Quotas](https://console.cloud.google.com/apis/api/maps-backend.googleapis.com/quotas)
2. Vérifiez que vous n'avez pas atteint les limites de requêtes
3. Google Maps offre un crédit gratuit de **$200 par mois**

### 6. Délai de propagation

Après avoir activé la facturation ou les APIs, il peut y avoir un délai de **quelques minutes** avant que les changements prennent effet.

## Vérification rapide

Pour vérifier rapidement si votre configuration est correcte :

1. ✅ Compte de facturation actif et lié au projet
2. ✅ Maps JavaScript API activée
3. ✅ Places API activée
4. ✅ Clé API valide et active
5. ✅ Restrictions d'API correctement configurées
6. ✅ Variable d'environnement `NEXT_PUBLIC_GOOGLE_API_KEY` définie
7. ✅ Serveur redémarré après modification de `.env.local`

## Liens utiles

- [Activer les APIs Maps](https://console.cloud.google.com/google/maps-apis/apis)
- [Gérer la facturation](https://console.cloud.google.com/billing)
- [Gérer les clés API](https://console.cloud.google.com/apis/credentials)
- [Documentation Google Maps](https://developers.google.com/maps/documentation/javascript)
- [Prix Google Maps](https://mapsplatform.google.com/pricing/)

---

## Résolution : DeletedApiProjectMapError

Si vous voyez l'erreur `DeletedApiProjectMapError`, cela signifie que le projet Google Cloud associé à votre clé API a été supprimé ou désactivé.

### Solution : Créer un nouveau projet et une nouvelle clé API

1. **Créer un nouveau projet Google Cloud :**
   - Allez sur [Google Cloud Console - Créer un projet](https://console.cloud.google.com/projectcreate)
   - Créez un nouveau projet ou sélectionnez un projet existant
   - Notez le nom et l'ID du projet

2. **Activer les APIs nécessaires :**
   - Maps JavaScript API
   - Places API
   - Geocoding API (optionnel mais recommandé)

3. **Lier le projet à un compte de facturation :**
   - Assurez-vous que votre projet est lié à un compte de facturation actif

4. **Créer une nouvelle clé API :**
   - Allez dans "APIs & Services" → "Credentials"
   - Cliquez sur "Create Credentials" → "API Key"
   - Copiez la nouvelle clé API
   - Configurez les restrictions d'API (Maps JavaScript API, Places API)
   - Configurez les restrictions d'application (domaines autorisés)

5. **Mettre à jour votre fichier .env.local :**
   ```bash
   NEXT_PUBLIC_GOOGLE_API_KEY=votre_nouvelle_cle_api_ici
   ```

6. **Redémarrer le serveur de développement :**
   - Après avoir modifié `.env.local`, redémarrez votre serveur Next.js

### Restauration d'un projet supprimé

Si vous avez accidentellement supprimé votre projet, vous pouvez essayer de le restaurer dans les 30 jours via [les paramètres IAM](https://console.cloud.google.com/iam-admin/settings).

---

## Support

Si le problème persiste après avoir suivi toutes ces étapes :

1. Vérifiez les logs de la console du navigateur pour plus de détails
2. Vérifiez les logs de Google Cloud Console pour voir les erreurs d'API
3. Contactez le support Google Cloud si nécessaire

## Note importante

Google Maps offre un crédit gratuit de **$200 par mois**. Vous ne serez facturé que si vous dépassez ce crédit mensuel. Pour la plupart des applications avec un usage modéré, ce crédit gratuit est suffisant.

