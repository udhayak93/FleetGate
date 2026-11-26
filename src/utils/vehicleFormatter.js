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

/**
 * Standard Trip Color Scheme:
 * Trip 1 – Blue
 * Trip 2 – Green
 * Trip 3 – Purple
 * Trip 4 – Orange
 * Trip 5 (and above) – Teal
 */
export const TRIP_COLORS = {
  1: {
    name: 'Blue',
    label: '1st Trip',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/70',
    cardBg: 'bg-blue-50/50 dark:bg-blue-950/30',
    rgb: [37, 99, 235],
    textRgb: [29, 78, 216]
  },
  2: {
    name: 'Green',
    label: '2nd Trip',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/70',
    cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/30',
    rgb: [16, 185, 129],
    textRgb: [4, 120, 87]
  },
  3: {
    name: 'Purple',
    label: '3rd Trip',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/70',
    cardBg: 'bg-purple-50/50 dark:bg-purple-950/30',
    rgb: [147, 51, 234],
    textRgb: [126, 34, 206]
  },
  4: {
    name: 'Orange',
    label: '4th Trip',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/80',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800/70',
    cardBg: 'bg-orange-50/50 dark:bg-orange-950/30',
    rgb: [249, 115, 22],
    textRgb: [194, 65, 12]
  },
  5: {
    name: 'Teal',
    label: '5+ Trips',
    badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800/70',
    cardBg: 'bg-teal-50/50 dark:bg-teal-950/30',
    rgb: [20, 184, 166],
    textRgb: [15, 118, 110]
  }
};

/**
 * Returns color configuration object for any trip number
 */
export function getTripColorConfig(tripNumber) {
  const n = parseInt(tripNumber, 10);
  if (!n || n <= 1) return TRIP_COLORS[1];
  if (n === 2) return TRIP_COLORS[2];
  if (n === 3) return TRIP_COLORS[3];
  if (n === 4) return TRIP_COLORS[4];
  return TRIP_COLORS[5];
}

/**
 * Returns consistent Tailwind badge class string for trip number
 */
export function getTripBadgeStyle(tripNumber) {
  const config = getTripColorConfig(tripNumber);
  return `px-2 py-0.5 rounded text-[10px] font-mono font-extrabold tracking-tight border ${config.badge}`;
}
