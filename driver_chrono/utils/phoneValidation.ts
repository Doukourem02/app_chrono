import { toE164CI } from './e164Phone';

export { toE164CI } from './e164Phone';

export function getPhoneValidationError(phone: string): string | null {
  if (!phone?.trim()) return null;
  if (toE164CI(phone) !== null) return null;
  return 'Numéro invalide.';
}
