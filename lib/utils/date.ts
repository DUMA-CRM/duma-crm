const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DATE_INPUT_MASK = '__/__/____';
const DATE_INPUT_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9];

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isoToDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value.slice(0, 10));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return validDate(year, month, day) ? new Date(year, month - 1, day) : null;
}

export function formatDate(value?: string | Date | null, fallback = '—'): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : ISO_DATE.test(value.slice(0, 10)) ? isoToDate(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatDateTime(value?: string | Date | null, fallback = '—'): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${formatDate(date)}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function parseDisplayDate(value: string): string | null {
  const match = DISPLAY_DATE.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  if (!validDate(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatIsoForInput(value?: string | null): string {
  return value ? formatDate(value, '') : '';
}

export function maskDateInput(value?: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, DATE_INPUT_POSITIONS.length);
  const masked = DATE_INPUT_MASK.split('');
  digits.split('').forEach((digit, index) => {
    masked[DATE_INPUT_POSITIONS[index]] = digit;
  });
  return masked.join('');
}
