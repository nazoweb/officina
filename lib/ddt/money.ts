import { UserFacingError } from '../user-errors';
export function decimalInput(raw: string, decimals: number, label: string): string {
  let value = raw.trim().replace(/EUR/gi, '').replace(/[€\s]/g, '');
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.');
  if (!new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(value)) throw new UserFacingError(`${label}: inserisci un numero valido con al massimo ${decimals} decimali.`);
  const [whole, fraction = ''] = value.split('.');
  return `${BigInt(whole)}${fraction ? '.' + fraction : ''}`;
}
function scaled(value: string, decimals: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
}
export function lineCents(quantity: string, price: string, discount: string): bigint {
  const q = scaled(decimalInput(quantity, 3, 'Quantità/ore'), 3);
  const p = scaled(decimalInput(price, 2, 'Prezzo'), 2);
  const d = scaled(decimalInput(discount || '0', 2, 'Sconto'), 2);
  if (q <= 0n) throw new UserFacingError('La quantità o le ore devono essere maggiori di zero.');
  if (d > 10000n) throw new UserFacingError('Lo sconto deve essere tra 0 e 100.');
  const numerator = q * p * (10000n - d);
  return (numerator + 5000000n) / 10000000n;
}
export function centsDecimal(cents: bigint) { return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`; }
export function money(value: string | number) {
  const canonical = String(value);
  const [whole, fraction = ''] = canonical.split('.');
  return `${new Intl.NumberFormat('it-IT').format(BigInt(whole || '0'))},${fraction.padEnd(2, '0').slice(0, 2)} €`;
}
