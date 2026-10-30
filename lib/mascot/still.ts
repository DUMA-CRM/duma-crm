import { BotEngine } from './engine/engine';
import { EXPRESSION_BY_ID, type ExpressionId } from './engine/expressions';
import { DEMI_VIEWBOX, RAYON } from './engine/repere';
import { SHAPE_BY_ID } from './engine/skins';
import { POSES } from './engine/states';

/**
 * The mascot at rest as a standalone SVG string — the same engine frame
 * components/ai/Mascot.tsx draws, with real colours in place of CSS
 * variables, for places that cannot run React or read the theme: a share
 * card drawn on the server, an email.
 *
 * Body, eyes and notch only — the idle pose carries no arcs or particles.
 */
export function mascotSvg({
  size,
  ink = '#235347',
  eye = '#fffcf7',
  expression = 'attentif',
}: {
  size: number;
  ink?: string;
  eye?: string;
  expression?: ExpressionId;
}) {
  const profile = SHAPE_BY_ID.get('hexagone')?.radii;
  // As Mascot.tsx: a little circle blended in, six soft corners.
  const radii = profile ? profile.map((radius) => radius * 0.78 + 0.22) : null;
  const frame = new BotEngine(RAYON, 'idle', radii, EXPRESSION_BY_ID.get(expression) ?? null).sample(POSES.idle);
  const box = DEMI_VIEWBOX * 2;

  const eyes = frame.eyes.map((e) => `<path d="${e.d}" transform="${e.matrix}" opacity="${e.alpha}" fill="#000"/>`).join('');
  const notch = frame.notch ? `<circle cx="${frame.notch.x}" cy="${frame.notch.y}" r="${frame.notch.r}" fill="#000"/>` : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${box} ${box}">` +
    `<defs><mask id="m" maskUnits="userSpaceOnUse" x="${-DEMI_VIEWBOX}" y="${-DEMI_VIEWBOX}" width="${box}" height="${box}">` +
    `<path d="${frame.bodyPath}" fill="#fff"/>${eyes}${notch}</mask></defs>` +
    `<path d="${frame.bodyPath}" fill="${eye}"/>` +
    `<rect x="${-DEMI_VIEWBOX}" y="${-DEMI_VIEWBOX}" width="${box}" height="${box}" fill="${ink}" mask="url(#m)"/>` +
    `</svg>`
  );
}
