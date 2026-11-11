/** Display and input helpers. The server is the source of truth for every real calculation. */

function group(whole: number, indian: boolean): string {
  const digits = Math.abs(whole).toString();
  if (indian) {
    if (digits.length <= 3) return digits;
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${rest},${last3}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export function formatPaise(paise: number | null | undefined, currency = 'INR'): string {
  if (typeof paise !== 'number' || isNaN(paise) || !isFinite(paise)) {
    paise = 0;
  }
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${sign}${symbol}${group(whole, currency === 'INR')}.${frac}`;
}

/** "1200", "1200.5" -> paise. Returns null if invalid or more than 2 decimals. */
export function parseAmountToPaise(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  const paise = parseInt(w, 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
  return paise > 0 ? paise : null;
}

/** Preview only: leftover paise go to the first people, like the server does. */
export function previewShares(totalPaise: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalPaise / count);
  const rem = totalPaise % count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}
