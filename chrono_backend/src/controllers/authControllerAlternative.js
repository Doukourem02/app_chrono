// ✅ ALTERNATIVE : Fonction d'inscription avec auth publique
// À utiliser si l'admin createUser ne fonctionne pas

const registerUserWithPublicAuth = async (req, res) => {
  try {
    const { email, password, phone, role = 'client' } = req.body;

    console.log(`📝 Inscription utilisateur PUBLIC : ${email} avec rôle ${role}`);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // Vérifier si l'utilisateur existe déjà dans PostgreSQL
    const client = await pool.connect();
    try {
      const checkQuery = `SELECT * FROM users WHERE email = $1`;
      const existingUser = await client.query(checkQuery, [email]);
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Un utilisateur avec cet email existe déjà'
        });
      }
    } finally {
      client.release();
    }

    // ✅ INSCRIPTION PUBLIQUE Supabase
    console.log("⏳ Inscription publique Supabase Auth...");
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          role: role,
          phone: phone
        }
      }
    });

    if (authError) {
      console.log("❌ Erreur Supabase Auth:", authError);
      return res.status(400).json({
        success: false,
        message: `Erreur inscription : ${authError.message}`,
        details: authError
      });
    }

    if (!authUser.user) {
      return res.status(400).json({
        success: false,
        message: "Échec de création utilisateur"
      });
    }

    console.log("✅ Compte Supabase créé ! ID:", authUser.user.id);

    // ✅ AJOUTER dans PostgreSQL
    console.log("⏳ Ajout dans votre table PostgreSQL users...");
    
    const client2 = await pool.connect();
    try {
      const insertQuery = `
        INSERT INTO users (id, email, phone, role, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const result = await client2.query(insertQuery, [
        authUser.user.id,
        email,
        phone,
        role
      ]);

      console.log("✅ Utilisateur ajouté dans PostgreSQL !");

      res.status(201).json({
        success: true,
        message: "Utilisateur créé avec succès !",
        data: {
          user: result.rows[0],
          supabase_user: authUser.user,
          session: authUser.session
        }
      });

    } finally {
      client2.release();
    }

  } catch (error) {
    console.error("❌ Erreur générale:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'inscription",
      error: error.message
    });
  }
};

export {
  registerUserWithPostgreSQL,
  registerUserWithPublicAuth,
  loginUserWithPostgreSQL,
  checkUserInPostgreSQL,
  getAllUsersFromPostgreSQL
};