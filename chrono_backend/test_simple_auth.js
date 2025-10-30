// 🎯 TEST SIMPLE : Vérifier que les utilisateurs vont bien dans PostgreSQL

const testSimpleAuth = async () => {
    console.log("🚀 TEST DE LA SOLUTION SIMPLE");
    console.log("=" .repeat(50));

    // 👤 Données de test
    const testUser = {
        email: "test.simple@example.com",
        password: "motdepasse123",
        phone: "+33123456789",
        role: "client"
    };

    try {
        // ✅ TEST 1 : Inscription utilisateur
        console.log("📝 TEST 1 : Inscription utilisateur...");
        const registerResponse = await fetch('http://localhost:3001/api/auth-simple/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });

        const registerResult = await registerResponse.json();
        console.log("📊 Résultat inscription:", registerResult);

        if (registerResult.success) {
            console.log("✅ SUCCÈS ! Utilisateur créé dans Supabase ET PostgreSQL");
            
            // ✅ TEST 2 : Vérifier que l'utilisateur est dans PostgreSQL
            console.log("\n🔍 TEST 2 : Vérification dans PostgreSQL...");
            const checkResponse = await fetch(`http://localhost:3001/api/auth-simple/check/${testUser.email}`);
            const checkResult = await checkResponse.json();
            console.log("📊 Vérification PostgreSQL:", checkResult);

            if (checkResult.success) {
                console.log("✅ PARFAIT ! L'utilisateur est bien dans PostgreSQL !");
            } else {
                console.log("❌ PROBLÈME : L'utilisateur n'est PAS dans PostgreSQL");
            }

            // ✅ TEST 3 : Voir tous les utilisateurs PostgreSQL
            console.log("\n📋 TEST 3 : Liste tous les utilisateurs PostgreSQL...");
            const usersResponse = await fetch('http://localhost:3001/api/auth-simple/users');
            const usersResult = await usersResponse.json();
            console.log("📊 Utilisateurs PostgreSQL:", usersResult);

        } else {
            console.log("❌ ÉCHEC inscription:", registerResult.message);
        }

    } catch (error) {
        console.error("❌ Erreur de test:", error.message);
    }
};

console.log(`
🎯 GUIDE UTILISATION SIMPLE :

✅ CE QUE FAIT LA SOLUTION :
   - Quand un utilisateur s'inscrit → il va dans Supabase Auth
   - EN MÊME TEMPS → il va AUSSI dans votre table PostgreSQL users
   - Résultat : l'utilisateur existe dans les DEUX endroits !

🚀 COMMENT TESTER :
   1. Démarrez votre serveur : npm run dev
   2. Décommentez la ligne ci-dessous pour tester
   3. Vérifiez dans Supabase → Table users → Vous verrez le nouvel utilisateur !

📡 ROUTES DISPONIBLES :
   - POST /api/auth-simple/register  → Inscription (Supabase + PostgreSQL)
   - GET /api/auth-simple/check/:email → Vérifier si dans PostgreSQL  
   - GET /api/auth-simple/users → Voir tous les utilisateurs PostgreSQL

🔧 POUR VOTRE FRONTEND :
   Remplacez votre route d'inscription actuelle par :
   /api/auth-simple/register

✨ C'EST TOUT ! Plus besoin de fichiers compliqués.
`);

// 🚀 Décommentez pour tester :
// testSimpleAuth();