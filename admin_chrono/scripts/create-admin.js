/**
 * Script pour créer un utilisateur admin dans Supabase
 * 
 * Usage:
 * 1. Créez un fichier .env.local avec vos credentials Supabase
 * 2. Exécutez: node scripts/create-admin.js
 * 
 * OU utilisez directement avec les variables d'environnement:
 * SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erreur: Variables d\'environnement manquantes')
  console.log('\n📝 Créez un fichier .env.local avec:')
  console.log('NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase')
  console.log('SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key')
  console.log('\n💡 Obtenez la SERVICE_ROLE_KEY depuis: Supabase Dashboard → Settings → API')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdmin() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (query) => new Promise((resolve) => readline.question(query, resolve))

  try {
    console.log('\n🔐 Création d\'un utilisateur admin\n')
    
    const email = await question('📧 Email: ')
    const password = await question('🔑 Mot de passe: ')
    
    if (!email || !password) {
      console.error('❌ Email et mot de passe requis')
      readline.close()
      process.exit(1)
    }

    console.log('\n⏳ Création de l\'utilisateur dans Supabase Auth...')

    // Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      console.error('❌ Erreur lors de la création:', authError.message)
      readline.close()
      process.exit(1)
    }

    const userId = authData.user.id
    console.log('✅ Utilisateur créé dans Auth avec ID:', userId)

    // Ajouter dans la table users avec rôle admin
    console.log('⏳ Ajout dans la table users avec rôle admin...')
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: userId,
          email,
          role: 'admin',
          status: 'active',
          email_verified: true,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (userError) {
      console.error('❌ Erreur lors de l\'ajout dans users:', userError.message)
      console.log('\n⚠️  L\'utilisateur a été créé dans Auth mais pas dans users.')
      console.log('💡 Vous pouvez l\'ajouter manuellement via SQL Editor:')
      console.log(`\nINSERT INTO users (id, email, role, status, email_verified, created_at)`)
      console.log(`VALUES ('${userId}', '${email}', 'admin', 'active', true, NOW());`)
      readline.close()
      process.exit(1)
    }

    console.log('✅ Utilisateur ajouté dans la table users!')
    console.log('\n🎉 Compte admin créé avec succès!')
    console.log('\n📋 Informations de connexion:')
    console.log(`   Email: ${email}`)
    console.log(`   Mot de passe: ${password}`)
    console.log(`   Rôle: admin`)
    console.log('\n🔗 Vous pouvez maintenant vous connecter sur http://localhost:3000/login')

  } catch (error) {
    console.error('❌ Erreur:', error.message)
  } finally {
    readline.close()
  }
}

createAdmin()

