/**
 * Décode le payload JWT (sans vérifier la signature) — id/role après refresh.
 */
export function decodeAccessTokenPayload(
  token: string
): { id?: string; role?: string; type?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const json = JSON.parse(atob(b64));
    return json as { id?: string; role?: string; type?: string };
  } catch {
    return null;
  }
}
