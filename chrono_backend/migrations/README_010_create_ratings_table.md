# Migration 010 - Table ratings

## 📋 Description
Cette migration crée la table `ratings` pour permettre aux clients d'évaluer les livreurs après chaque livraison complétée.

## 🚀 Instructions d'exécution

### Étape 1 : Accéder à Supabase SQL Editor
1. Allez sur votre projet Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur **"SQL Editor"** dans le menu de gauche

### Étape 2 : Exécuter la migration
1. Copiez tout le contenu du fichier `010_create_ratings_table.sql`
2. Collez-le dans l'éditeur SQL de Supabase
3. Cliquez sur **"Run"** ou appuyez sur `Ctrl+Enter` (Windows/Linux) ou `Cmd+Enter` (Mac)

### Étape 3 : Vérifier que la migration a réussi
Exécutez cette requête pour vérifier que la table existe :

```sql
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ratings'
ORDER BY ordinal_position;
```

Vous devriez voir les colonnes suivantes :
- `id` (uuid)
- `order_id` (uuid)
- `user_id` (uuid)
- `driver_id` (uuid)
- `rating` (integer)
- `comment` (text)
- `timeliness_rating` (integer)
- `professionalism_rating` (integer)
- `communication_rating` (integer)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### Étape 4 : Vérifier les politiques RLS
Exécutez cette requête pour vérifier les politiques RLS :

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'ratings';
```

Vous devriez voir 5 politiques :
1. Users can insert own ratings
2. Users can view own ratings
3. Users can update own ratings
4. Drivers can view ratings about them
5. Service role can do all operations

## ⚠️ Notes importantes

- Le backend utilise le **service role key**, ce qui permet de bypasser RLS automatiquement
- Les politiques RLS sont nécessaires si vous voulez que les utilisateurs accèdent directement à la table via Supabase Client
- La politique "Service role can do all operations" garantit que le backend peut toujours insérer/mettre à jour les évaluations

## 🔧 En cas de problème

Si vous rencontrez des erreurs :
1. Vérifiez que les tables `orders` et `users` existent
2. Vérifiez que vous avez les permissions nécessaires (admin/service role)
3. Vérifiez les logs dans la console Supabase

