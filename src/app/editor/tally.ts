const TALLY_ONE = '\u{1D377}';
const TALLY_FIVE = '\u{1D378}';

const bengaliDigits: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export const MAX_TALLY_COUNT = 200;

export const parseTallyCount = (value: string): number | null => {
  const normalized = value
    .replace(/[০-৯]/g, (digit) => bengaliDigits[digit] ?? digit)
    .trim();

  if (!normalized || !/^\d+$/.test(normalized)) return null;

  const count = Number(normalized);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
};

export const buildTallyMarks = (count: number): string => {
  if (!Number.isFinite(count) || count < 1) return '';

  const groups: string[] = [];
  let remaining = Math.floor(count);

  while (remaining >= 5) {
    groups.push(TALLY_FIVE);
    remaining -= 5;
  }

  if (remaining > 0) {
    groups.push(TALLY_ONE.repeat(remaining));
  }

  return groups.join(' ');
};
