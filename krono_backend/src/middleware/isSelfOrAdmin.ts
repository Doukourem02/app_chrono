interface AuthedUser {
  id: string;
  role?: string;
}

/**
 * Prédicat partagé : un utilisateur peut accéder à une ressource si c'est
 * la sienne (`user.id === targetId`) ou s'il est admin/super_admin.
 * Factorise la clause dupliquée dans deliveryController, driverController
 * et batchController (audit 2026-07-23).
 */
export function isSelfOrAdmin(user: AuthedUser | undefined, targetId: string | undefined | null): boolean {
  if (!user) return false;
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  return isAdmin || user.id === targetId;
}
