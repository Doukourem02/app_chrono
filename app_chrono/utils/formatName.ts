/** Email technique généré pour les comptes OTP (ne pas l’afficher comme identité). */
export function isSyntheticAuthEmail(email?: string | null): boolean {
  if (!email) return false;
  return (
    email.endsWith('@otp.chrono.local') ||
    email.endsWith('@otp.krono.local')
  );
}

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
  phone?: string | null;
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

  // Priorité 3: email réel (pas l’email technique OTP)
  if (user.email && !isSyntheticAuthEmail(user.email)) {
    return user.email;
  }

  // Priorité 4: téléphone
  const phone = user.phone?.trim();
  if (phone) {
    return phone;
  }

  if (user.email) {
    return user.email;
  }

  return fallback || 'Utilisateur';
}

