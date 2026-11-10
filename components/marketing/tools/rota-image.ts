import { absoluteUrl } from '@/lib/marketing/site';
import { type RotaPerson, type RotaSummary, formatHours, formatRotaMoney, shiftSpan, weekDays } from '@/lib/utils/rota-builder';

/**
 * The rota builder's "Download image": the week drawn straight onto a canvas
 * from the rota itself and saved as a PNG — no screenshot library, and the
 * same picture whatever the page's theme. Browser only.
 */

/** Light-theme values of the role tones (app/globals.css), so the image never depends on the viewer's theme. */
export const ROLE_HEX = ['#2b7355', '#505fb8', '#b84e2d', '#8a5b02', '#235347'] as const;

const INK = '#0a0a0a';
const INK_2 = '#5f6b66';
const INK_3 = '#9aa29e';
const LINE = '#e6e5e1';
const GROUND = '#faf9f6';

const PAD = 40;
const NAME_COL = 170;
const DAY_COL = 118;
const TOTAL_COL = 110;
const ROW = 54;
const HEAD = 46;

export type RotaImageInput = {
  title: string;
  weekStart: string;
  currency: string;
  people: readonly RotaPerson[];
  summary: RotaSummary;
  /** Each person's tone index into ROLE_HEX, by role. */
  toneOf: (person: RotaPerson) => number;
};

export async function downloadRotaImage(input: RotaImageInput): Promise<void> {
  const canvas = await drawRota(input);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be created.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rota-${input.weekStart || 'week'}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function drawRota({ title, weekStart, currency, people, summary, toneOf }: RotaImageInput): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const days = weekDays(weekStart);
  const money = (minor: number) => formatRotaMoney(minor, currency);
  const gridWidth = NAME_COL + DAY_COL * days.length + TOTAL_COL;
  const width = PAD * 2 + gridWidth;
  const top = PAD + 74;
  const rows = Math.max(people.length, 1);
  const height = top + HEAD + ROW * rows + HEAD + 92;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the image.');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';
  const text = (value: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = 'left') => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  };
  const rule = (y: number) => {
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD, y, gridWidth, 1);
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Title and the week.
  text(title.trim() || 'Rota', PAD, PAD + 14, 26, INK, 600);
  text(`Week of ${days[0].long} – ${days[6].date}`, PAD, PAD + 48, 15, INK_2);

  // Day headers.
  ctx.fillStyle = GROUND;
  ctx.fillRect(PAD, top, gridWidth, HEAD);
  days.forEach((day, index) => {
    const x = PAD + NAME_COL + DAY_COL * index + DAY_COL / 2;
    text(day.short.toUpperCase(), x, top + 16, 11, INK_3, 600, 'center');
    text(day.date, x, top + 32, 13, INK_2, 500, 'center');
  });
  text('TOTAL', PAD + gridWidth - 14, top + HEAD / 2, 11, INK_3, 600, 'right');
  rule(top + HEAD);

  // One row per person.
  people.forEach((person, row) => {
    const y = top + HEAD + ROW * row;
    const hex = ROLE_HEX[toneOf(person) % ROLE_HEX.length];
    text(person.name.trim() || 'Unnamed', PAD + 14, y + (person.role.trim() ? 20 : ROW / 2), 15, INK, 600);
    if (person.role.trim()) text(person.role.trim(), PAD + 14, y + 37, 12, INK_2);

    person.shifts.forEach((shift, day) => {
      const span = shift && shiftSpan(shift);
      if (!span || !shift) return;
      const x = PAD + NAME_COL + DAY_COL * day + 6;
      ctx.beginPath();
      ctx.roundRect(x, y + 8, DAY_COL - 12, ROW - 16, 6);
      ctx.fillStyle = `${hex}1f`;
      ctx.fill();
      ctx.strokeStyle = `${hex}55`;
      ctx.lineWidth = 1;
      ctx.stroke();
      text(`${shift.start}–${shift.end}`, x + (DAY_COL - 12) / 2, y + 22, 13, hex, 600, 'center');
      text(
        shift.breakMinutes > 0 ? `${shift.breakMinutes}m break` : 'no break',
        x + (DAY_COL - 12) / 2,
        y + 38,
        10.5,
        INK_2,
        400,
        'center',
      );
    });

    const totals = summary.people.find((p) => p.id === person.id);
    text(formatHours(totals?.paidMinutes ?? 0), PAD + gridWidth - 14, y + 20, 14, INK, 600, 'right');
    if (totals?.costPence !== null && totals?.costPence !== undefined) {
      text(money(totals.costPence), PAD + gridWidth - 14, y + 37, 12, INK_2, 400, 'right');
    }
    rule(y + ROW);
  });

  // Day totals.
  const foot = top + HEAD + ROW * rows;
  ctx.fillStyle = GROUND;
  ctx.fillRect(PAD, foot + 1, gridWidth, HEAD);
  text('Hours', PAD + 14, foot + HEAD / 2, 13, INK_2, 500);
  summary.days.forEach((day, index) => {
    text(
      day.paidMinutes ? formatHours(day.paidMinutes) : '–',
      PAD + NAME_COL + DAY_COL * index + DAY_COL / 2,
      foot + HEAD / 2,
      13,
      INK_2,
      500,
      'center',
    );
  });
  text(formatHours(summary.paidMinutes), PAD + gridWidth - 14, foot + HEAD / 2, 14, INK, 600, 'right');

  // The week's figures, and where it came from.
  const facts = [
    `${formatHours(summary.paidMinutes)} paid`,
    ...(summary.costPence > 0 ? [`${money(summary.costPence)} staff cost`] : []),
    ...(summary.labourPct !== null ? [`${summary.labourPct.toFixed(1)}% of expected sales`] : []),
  ];
  text(facts.join('  ·  '), PAD, foot + HEAD + 34, 14, INK, 500);
  text(
    `Made with the free rota builder at ${absoluteUrl('/tools/rota-builder').replace(/^https?:\/\//, '')}`,
    PAD,
    foot + HEAD + 62,
    12,
    INK_3,
  );

  return canvas;
}
