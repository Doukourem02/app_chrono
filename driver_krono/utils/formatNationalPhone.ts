/** Affichage type « 00 00 0 00000 » sur 10 chiffres nationaux (CI). */
export function formatNationalIvorian(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  const a = d.slice(0, 2);
  const b = d.slice(2, 4);
  const c = d.slice(4, 5);
  const e = d.slice(5, 10);
  const parts: string[] = [];
  if (a) parts.push(a);
  if (b) parts.push(b);
  if (c) parts.push(c);
  if (e) parts.push(e);
  return parts.join(' ');
}

export function parseNationalIvorianInput(text: string): string {
  let raw = text.replace(/\D/g, '');
  if (raw.startsWith('225')) raw = raw.slice(3);
  return raw.slice(0, 10);
}
