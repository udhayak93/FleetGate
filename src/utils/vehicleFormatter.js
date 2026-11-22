/**
 * Strict Lorry Number Formatter:
 * Enforces Indian registration format strictly (PAN card style):
 * 1. State: strictly 'TN' (autofilled)
 * 2. RTO: strictly 2 digits (e.g. '20', '21')
 * 3. Series: strictly 1 or 2 alphabets (letters only, e.g. 'H', 'BV')
 * 4. Number: strictly up to 4 digits (e.g. '4231')
 */
export function formatStrictLorryNumber(value) {
  if (!value) return 'TN ';
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return 'TN ';

  let rest = raw;
  if (rest.startsWith('TN')) {
    rest = rest.slice(2);
  }

  let rto = '';
  let series = '';
  let number = '';
  let i = 0;

  // 1. RTO code: strictly up to 2 DIGITS
  while (i < rest.length && rto.length < 2) {
    if (/[0-9]/.test(rest[i])) {
      rto += rest[i];
    }
    i++;
  }

  // 2. Series: strictly 1 or 2 ALPHABETS (must be letters, not digits)
  // Only accept letters once RTO has reached 2 digits
  if (rto.length === 2) {
    while (i < rest.length && series.length < 2) {
      if (/[A-Z]/.test(rest[i])) {
        series += rest[i];
        i++;
      } else {
        break;
      }
    }
  }

  // 3. Vehicle number: strictly up to 4 DIGITS
  // Only accept digits once at least 1 alphabet is present in series
  if (series.length >= 1) {
    while (i < rest.length && number.length < 4) {
      if (/[0-9]/.test(rest[i])) {
        number += rest[i];
      }
      i++;
    }
  }

  const parts = ['TN', rto, series, number].filter(Boolean);
  return parts.join(' ');
}

/**
 * Validates if the lorry plate strictly matches:
 * TN + 2 digits + 1 or 2 letters + 4 digits
 * e.g. "TN 20 BV 4231" or "TN 21 H 1234"
 */
export function isValidLorryNumber(value) {
  if (!value) return false;
  return /^TN \d{2} [A-Z]{1,2} \d{4}$/.test(value.trim());
}

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
