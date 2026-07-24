/**
 * Script pour créer le bucket "avatars" dans Supabase Storage
 * 
 * Usage:
 * 1. Assurez-vous d'avoir un fichier .env.local avec vos credentials Supabase
 * 2. Exécutez: npm run create-avatars-bucket
 * 
 * OU utilisez directement avec les variables d'environnement:
 * SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-avatars-bucket.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Erreur: Variables d\'environnement manquantes')
  console.log('\nCréez un fichier .env.local avec:')
  console.log('NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase')
  console.log('SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key')
  console.log('\nObtenez la SERVICE_ROLE_KEY depuis: Supabase Dashboard → Settings → API')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAvatarsBucket() {
  try {
    console.log('\nCréation du bucket "avatars" dans Supabase Storage...\n')

    // Vérifier si le bucket existe déjà
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()

    if (listError) {
      console.error('Erreur lors de la vérification des buckets:', listError.message)
      process.exit(1)
    }

    const existingBucket = buckets?.find(bucket => bucket.name === 'avatars')

    if (existingBucket) {
      console.log('Le bucket "avatars" existe déjà!')
      console.log(`   ID: ${existingBucket.id}`)
      console.log(`   Créé le: ${existingBucket.created_at}`)
      console.log(`   Public: ${existingBucket.public ? 'Oui' : 'Non'}`)
      
      // Vérifier et mettre à jour les paramètres si nécessaire
      if (!existingBucket.public) {
        console.log('\nLe bucket n\'est pas public. Mise à jour...')
        // Note: La mise à jour des paramètres du bucket nécessite l'API REST directement
        console.log('Pour rendre le bucket public, allez dans Supabase Dashboard → Storage → avatars → Settings')
      }
      
      return
    }

    // Créer le bucket
    const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket('avatars', {
      public: true, // Rendre le bucket public pour accéder aux avatars
      fileSizeLimit: 52428800, // 50MB en bytes
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    })

    if (createError) {
      console.error('Erreur lors de la création du bucket:', createError.message)
      
      // Si l'erreur indique que le bucket existe déjà (peut arriver avec un timing)
      if (createError.message.includes('already exists') || createError.message.includes('duplicate')) {
        console.log('Le bucket existe déjà (créé entre-temps)')
        return
      }
      
      process.exit(1)
    }

    console.log('Bucket "avatars" créé avec succès!')
    console.log(`   ID: ${newBucket?.id || 'N/A'}`)
    console.log(`   Public: Oui`)
    console.log(`   Taille max par fichier: 50MB`)
    console.log(`   Types MIME autorisés: image/jpeg, image/png, image/gif, image/webp`)
    
    console.log('\nConfiguration des politiques RLS (Row Level Security)...')
    console.log('Pour permettre l\'upload aux utilisateurs authentifiés, configurez les politiques RLS dans Supabase Dashboard → Storage → avatars → Policies')
    console.log('\n   Exemple de politique pour l\'upload:')
    console.log('   - Policy name: "Allow authenticated users to upload avatars"')
    console.log('   - Allowed operation: INSERT')
    console.log('   - Target roles: authenticated')
    console.log('   - Policy definition: (bucket_id = \'avatars\')')
    
    console.log('\n   Exemple de politique pour la lecture:')
    console.log('   - Policy name: "Allow public read access"')
    console.log('   - Allowed operation: SELECT')
    console.log('   - Target roles: public')
    console.log('   - Policy definition: (bucket_id = \'avatars\')')

  } catch (error) {
    console.error('Erreur inattendue:', error.message)
    process.exit(1)
  }
}

createAvatarsBucket()
  .then(() => {
    console.log('\nTerminé!\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Erreur fatale:', error)
    process.exit(1)
  })

