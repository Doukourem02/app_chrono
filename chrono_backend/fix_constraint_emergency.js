import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Configuration PostgreSQL pour Supabase
const pool = new Pool({
  host: 'db.gglpozefhtzgakivvfxm.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'TJWycbE36g_*kk', // Mot de passe pgAdmin
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Connexion à PostgreSQL Supabase...');
    
    // 1. Vérifier les contraintes existantes
    console.log('\n1️⃣ Vérification des contraintes sur table users...');
    const constraintsQuery = `
      SELECT 
          conname AS constraint_name,
          contype AS constraint_type,
          pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass;
    `;
    
    const constraintsResult = await client.query(constraintsQuery);
    console.log('📋 Contraintes trouvées:');
    constraintsResult.rows.forEach(row => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type}): ${row.constraint_definition}`);
    });
    
    // 2. Supprimer la contrainte problématique
    console.log('\n2️⃣ Suppression de la contrainte users_id_fkey...');
    const dropConstraintQuery = `
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;
    `;
    
    await client.query(dropConstraintQuery);
    console.log('✅ Contrainte users_id_fkey supprimée avec succès !');
    
    // 3. Vérifier que la contrainte a bien été supprimée
    console.log('\n3️⃣ Vérification après suppression...');
    const verifyResult = await client.query(constraintsQuery);
    console.log('📋 Contraintes restantes:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type}): ${row.constraint_definition}`);
    });
    
    // 4. Test d'insertion pour confirmer que ça marche
    console.log('\n4️⃣ Test d\'insertion...');
    const testId = '550e8400-e29b-41d4-a716-446655440000';
    const testEmail = 'test-constraint-fix@example.com';
    
    const insertQuery = `
      INSERT INTO users (id, email, phone, role, created_at) 
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
    `;
    
    const insertResult = await client.query(insertQuery, [testId, testEmail, '+1234567890', 'client']);
    console.log('✅ Test d\'insertion réussi:', insertResult.rows[0]);
    
    // 5. Nettoyer le test
    await client.query('DELETE FROM users WHERE email = $1', [testEmail]);
    console.log('🧹 Test nettoyé');
    
    console.log('\n🎉 CONTRAINTE CORRIGÉE AVEC SUCCÈS !');
    console.log('Tu peux maintenant tester l\'authentification dans l\'app.');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécuter le script
fixConstraint().catch(console.error);