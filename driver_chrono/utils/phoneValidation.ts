import { toE164CI } from './e164Phone';

export { toE164CI } from './e164Phone';

export function getPhoneValidationError(phone: string): string | null {
  if (!phone?.trim()) return null;
  if (toE164CI(phone) !== null) return null;
  return 'Format attendu : +2250504343424 (mobile 01, 05 ou 07 + 8 chiffres).';
}
