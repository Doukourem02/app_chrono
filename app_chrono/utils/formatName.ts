/**
 * Formate le nom d'un utilisateur à partir de first_name, last_name ou email
 * @param user - Objet avec first_name, last_name, email (optionnels)
 * @param fallback - Texte de fallback si aucun nom n'est disponible (par défaut: email ou 'Utilisateur')
 * @returns Le nom formaté
 */
export function formatUserName(user?: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  name?: string | null;
}, fallback?: string): string {
  if (!user) {
    return fallback || 'Utilisateur';
  }

  // Priorité 1: first_name + last_name
  if (user.first_name || user.last_name) {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) {
      return fullName;
    }
  }

  // Priorité 2: name (si disponible)
  if (user.name) {
    return user.name;
  }

  // Priorité 3: email
  if (user.email) {
    return user.email;
  }

  // Fallback final
  return fallback || 'Utilisateur';
}

