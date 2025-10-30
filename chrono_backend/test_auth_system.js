// Test du nouveau système d'authentification adapté à Supabase
// À exécuter après la migration PostgreSQL

const testSupabaseAuthSystem = async () => {
    const testUser = {
        email: "test.client@example.com",
        phone: "+33123456789",
        role: "client"
    };

    try {
        console.log("🚀 Test du système d'authentification Supabase adapté");
        console.log("=" .repeat(60));

        // 1. Test envoi OTP avec les nouvelles routes
        console.log("🔄 Test envoi OTP...");
        const otpResponse = await fetch('http://localhost:3001/api/auth-supabase/send-registration-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const otpResult = await otpResponse.json();
        console.log("📤 OTP Response:", otpResult);

        if (otpResult.success) {
            console.log("✅ OTP envoyé avec succès !");
            
            // 2. Instructions pour vérifier dans Supabase
            console.log("\n📊 Vérifications à faire dans Supabase :");
            console.log("1. SQL Editor → Exécutez la migration '003_adapt_to_existing_users.sql'");
            console.log("2. Puis vérifiez la table auth.users :");
            console.log("   SELECT id, email, phone, user_role, status FROM auth.users WHERE email = 'test.client@example.com';");
            
            // 3. Simulation vérification OTP
            console.log("\n🔐 Pour tester la vérification OTP :");
            console.log("Remplacez '123456' par le vrai OTP et décommentez le code ci-dessous :");
            
            /*
            const verifyResponse = await fetch('http://localhost:3001/api/auth-supabase/verify-registration-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testUser.email,
                    phone: testUser.phone,
                    otp: "123456", // Remplacez par le vrai OTP
                    role: testUser.role,
                    password: "test123456" // Mot de passe optionnel
                })
            });
            
            const verifyResult = await verifyResponse.json();
            console.log("✅ Verify Response:", verifyResult);
            
            if (verifyResult.success) {
                console.log("\n🎉 Utilisateur créé avec succès !");
                console.log("📋 Données utilisateur:", verifyResult.data.user);
                console.log("👤 Profil créé:", verifyResult.data.profile);
                
                // 4. Test récupération utilisateur
                const userId = verifyResult.data.user.id;
                const getUserResponse = await fetch(`http://localhost:3001/api/auth-supabase/user/${userId}`);
                const getUserResult = await getUserResponse.json();
                console.log("👤 Récupération utilisateur:", getUserResult);
            }
            */
            
        } else {
            console.log("❌ Erreur envoi OTP:", otpResult);
        }
        
    } catch (error) {
        console.error("❌ Erreur:", error);
    }
};

// Tests pour différents rôles
const testAllRoles = async () => {
    const roles = ['client', 'driver', 'partner'];
    
    for (const role of roles) {
        console.log(`\n🧪 Test pour le rôle: ${role.toUpperCase()}`);
        console.log("-".repeat(40));
        
        const testUser = {
            email: `test.${role}@example.com`,
            phone: `+3312345678${roles.indexOf(role)}`,
            role: role
        };
        
        try {
            const response = await fetch('http://localhost:3001/api/auth-supabase/send-registration-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testUser)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ ${role}: OTP envoyé avec succès`);
            } else {
                console.log(`❌ ${role}: Erreur -`, result.message);
            }
            
        } catch (error) {
            console.log(`❌ ${role}: Erreur réseau -`, error.message);
        }
    }
};

console.log(`
🎯 GUIDE D'UTILISATION :

1️⃣ MIGRATION BASE DE DONNÉES :
   - Connectez-vous à Supabase SQL Editor
   - Exécutez le fichier: migrations/003_adapt_to_existing_users.sql

2️⃣ DÉMARRAGE SERVEUR :
   - cd chrono_backend
   - npm run dev

3️⃣ TESTS :
   - Décommentez testSupabaseAuthSystem() pour tester
   - Ou décommentez testAllRoles() pour tester tous les rôles

4️⃣ VÉRIFICATIONS :
   - Vérifiez que les utilisateurs apparaissent dans auth.users
   - Vérifiez que les profils sont créés dans les tables client_profiles, driver_profiles, partner_profiles

🚀 Routes disponibles :
   - POST /api/auth-supabase/send-registration-otp
   - POST /api/auth-supabase/verify-registration-otp
   - GET /api/auth-supabase/user/:userId
`);

// Décommentez pour tester :
// testSupabaseAuthSystem();
// testAllRoles();