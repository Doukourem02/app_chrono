# Supabase Auth email templates

Templates personnalises pour le portail web partenaire Krono.

Flux gardes actifs cote portail :

- `Invite user` : invitation controlee par l'admin ou le owner partenaire.
- `Magic link` : connexion sans mot de passe pour les utilisateurs deja invites.

Le login magic link doit rester configure avec `shouldCreateUser: false` cote client pour eviter l'inscription libre.

Le logo utilise l'URL publique `https://admin.kro-no-delivery.com/assets/chrono.png`.

Pour pousser ces templates dans Supabase :

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase:auth-emails
```

Le script deduit `SUPABASE_PROJECT_REF` depuis `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL` si la variable n'est pas fournie.
