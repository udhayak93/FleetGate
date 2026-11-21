/**
 * Utility to format Indian vehicle registration numbers with auto-spacing.
 * Pattern: State (2 letters) + RTO (2 digits) + Series (1 or 2 letters) + Number (up to 4 digits)
 * Examples:
 *   "tn21bv1234" -> "TN 21 BV 1234"
 *   "tn21h1234"  -> "TN 21 H 1234"
 */
export function formatLorryNumber(value) {
  if (!value) return '';
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';

  let state = '';
  let rto = '';
  let series = '';
  let number = '';

  let i = 0;
  // 1. State code: up to 2 uppercase letters (e.g. TN, KA, MH)
  while (i < raw.length && state.length < 2) {
    if (/[A-Z]/.test(raw[i])) {
      state += raw[i];
    }
    i++;
  }

  // 2. RTO code: up to 2 digits (e.g. 21, 01, 69)
  while (i < raw.length && rto.length < 2) {
    if (/[0-9]/.test(raw[i])) {
      rto += raw[i];
    }
    i++;
  }

  // 3. Series: 1 or 2 uppercase letters (e.g. BV or H)
  // Stops as soon as a digit is encountered
  while (i < raw.length && series.length < 2) {
    if (/[A-Z]/.test(raw[i])) {
      series += raw[i];
      i++;
    } else {
      break;
    }
  }

  // 4. Vehicle number: up to 4 digits (e.g. 1234)
  while (i < raw.length && number.length < 4) {
    if (/[0-9]/.test(raw[i])) {
      number += raw[i];
    }
    i++;
  }

  return [state, rto, series, number].filter(Boolean).join(' ');
}

/**
 * Helper to get ordinal trip label: 1 -> "1st Trip", 2 -> "2nd Trip", 3 -> "3rd Trip", etc.
 */
export function getTripLabel(tripNumber) {
  const n = parseInt(tripNumber, 10);
  if (!n || n <= 1) return '1st Trip';
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st Trip`;
  if (j === 2 && k !== 12) return `${n}nd Trip`;
  if (j === 3 && k !== 13) return `${n}rd Trip`;
  return `${n}th Trip`;
}
