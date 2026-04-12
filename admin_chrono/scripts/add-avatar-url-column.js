/**
 * Script pour ajouter la colonne avatar_url à la table users
 * 
 * Usage:
 * node scripts/add-avatar-url-column.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erreur: Variables d\'environnement manquantes')
  console.log('\n📝 Assurez-vous d\'avoir dans .env.local:')
  console.log('NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase')
  console.log('SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addAvatarUrlColumn() {
  try {
    console.log('\n📝 Ajout de la colonne avatar_url à la table users...\n')

    // Exécuter la requête SQL pour ajouter la colonne
    // Note: RPC exec_sql peut ne pas exister, on utilise une approche alternative ci-dessous
    await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;'
    }).catch(() => {
      // Ignorer l'erreur si RPC n'existe pas, on utilisera l'approche alternative
    })

    // Si RPC n'existe pas, utiliser une approche alternative
    // On va simplement vérifier si la colonne existe en essayant de la sélectionner
    const { error: selectError } = await supabaseAdmin
      .from('users')
      .select('avatar_url')
      .limit(1)

    if (selectError) {
      if (selectError.message.includes('avatar_url') || selectError.message.includes('column')) {
        console.log('⚠️  La colonne avatar_url n\'existe pas.')
        console.log('\n💡 Veuillez exécuter manuellement ce script SQL dans Supabase SQL Editor:\n')
        console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;')
        console.log('\n📝 Instructions:')
        console.log('1. Allez sur Supabase Dashboard → SQL Editor')
        console.log('2. Cliquez sur "New query"')
        console.log('3. Collez le script SQL ci-dessus')
        console.log('4. Cliquez sur "Run"\n')
        process.exit(1)
      } else {
        console.error('❌ Erreur lors de la vérification:', selectError.message)
        process.exit(1)
      }
    } else {
      console.log('✅ La colonne avatar_url existe déjà ou a été ajoutée avec succès!')
      console.log('\n✨ Vous pouvez maintenant uploader votre photo de profil.\n')
    }
  } catch (error) {
    console.error('❌ Erreur inattendue:', error.message)
    console.log('\n💡 Veuillez exécuter manuellement ce script SQL dans Supabase SQL Editor:\n')
    console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;')
    console.log('\n📝 Instructions:')
    console.log('1. Allez sur Supabase Dashboard → SQL Editor')
    console.log('2. Cliquez sur "New query"')
    console.log('3. Collez le script SQL ci-dessus')
    console.log('4. Cliquez sur "Run"\n')
    process.exit(1)
  }
}

addAvatarUrlColumn()

