import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration Supabase
const SUPABASE_URL = 'https://gglpozefhtzgakivvfxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbHBvemVmaHR6Z2FraXZ2ZnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjU3MDIsImV4cCI6MjA3NzM0MTcwMn0.QCiz2A-vCkdAoB9sIE7v3XpPOXgeyqUXSWPSjFmC2m8';

// Pour les migrations, nous aurions besoin de la service_role key
// Mais pour les tests, nous utiliserons l'anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDriverProfilesTable() {
  console.log('🔍 Test de la table driver_profiles...');
  
  try {
    // Tester si la table existe en essayant de récupérer des données
    const { data, error } = await supabase
      .from('driver_profiles')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Erreur table driver_profiles:', error);
      console.log('📝 La table driver_profiles doit être créée manuellement dans Supabase Dashboard');
      console.log('📍 Aller sur: https://gglpozefhtzgakivvfxm.supabase.co');
      console.log('📍 Section: Database > SQL Editor');
      console.log('📍 Exécuter le script: migrations/005_create_driver_profiles.sql');
      return false;
    }
    
    console.log('✅ Table driver_profiles existe:', data?.length || 0, 'chauffeurs trouvés');
    
    // Tester l'insertion d'un chauffeur test
    const testDriver = {
      user_id: crypto.randomUUID(),
      first_name: 'Test',
      last_name: 'Driver',
      email: 'test.driver@chrono.com',
      vehicle_type: 'moto',
      is_online: true,
      is_available: true,
      current_latitude: 5.3165,
      current_longitude: -4.0266,
      rating: 4.5
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('driver_profiles')
      .insert(testDriver)
      .select();
      
    if (insertError) {
      console.error('❌ Erreur insertion test:', insertError);
      return false;
    }
    
    console.log('✅ Insertion test réussie:', insertData);
    
    // Nettoyer le test
    await supabase
      .from('driver_profiles')
      .delete()
      .eq('email', 'test.driver@chrono.com');
      
    console.log('🧹 Nettoyage effectué');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return false;
  }
}

async function createDriverProfilesTable() {
  console.log('🚀 Tentative de création de la table driver_profiles...');
  
  // Lire le fichier SQL de migration
  const migrationPath = path.join(__dirname, 'migrations', '005_create_driver_profiles.sql');
  
  try {
    const sqlScript = fs.readFileSync(migrationPath, 'utf8');
    console.log('📝 Script SQL lu:', sqlScript.length, 'caractères');
    
    // Note: Pour exécuter du SQL brut, nous aurions besoin de la service_role key
    // Avec l'anon key, nous sommes limités aux opérations CRUD basiques
    console.log('⚠️  Pour créer la table, utilisez le Supabase Dashboard:');
    console.log('1. Aller sur https://gglpozefhtzgakivvfxm.supabase.co');
    console.log('2. Database > SQL Editor');
    console.log('3. Coller et exécuter le script migrations/005_create_driver_profiles.sql');
    
  } catch (error) {
    console.error('❌ Erreur lecture migration:', error);
  }
}

// Exécuter les tests
async function main() {
  console.log('🎯 Test de la base de données Supabase');
  console.log('🔗 URL:', SUPABASE_URL);
  
  const tableExists = await testDriverProfilesTable();
  
  if (!tableExists) {
    await createDriverProfilesTable();
  }
  
  console.log('✨ Test terminé');
}

main().catch(console.error);