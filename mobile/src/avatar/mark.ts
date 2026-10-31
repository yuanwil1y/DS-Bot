// The web's BotMark markup (mark.js characterMarkup), with the ink CSS vars resolved
// to the light/dark hex the web theme gives them, so react-native-svg can draw it.
import { INKS as INKS0, GRADIENTS as GRADIENTS0 } from './inks';
import { CHARACTERS, CHARACTER_COLORS, PICKER_SHAPES, PICKER_COLUMNS, SHAPES as SHAPES0, bodyOf, holes, lookOf, maskBox, shapeOf, hasShape } from './characters';

const INKS: Record<string, string[]> = INKS0;
const GRADIENTS: Record<string, [number, string][]> = GRADIENTS0 as any;
const SHAPES: Record<string, any> = SHAPES0;
export { CHARACTERS, CHARACTER_COLORS, PICKER_SHAPES, PICKER_COLUMNS, GRADIENTS, INKS, lookOf, shapeOf, hasShape };
export type Look = { shape: string; color: string; image?: string };

const resolve = (markup: string, dark: boolean) =>
  markup.replace(/var\(--bt-ink-([a-z]+)\)/g, (_m, name) => (INKS[name] ?? INKS.gray)[dark ? 1 : 0]);
const eye = ([cx, cy, w, h, tilt]: number[]) => `<g transform="translate(${cx} ${cy}) rotate(${tilt})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w / 2}" fill="#000"/></g>`;
const cache = new Map<string, string>();

export function characterXml(shape: string, color: string, dark: boolean): string {
  const key = `${shape}|${color}|${dark}`;
  let xml = cache.get(key);
  if (xml) return xml;
  const def = shapeOf(shape);
  const stops = GRADIENTS[color];
  const grad = stops ? `<linearGradient id="mg" gradientUnits="userSpaceOnUse" x1="18" y1="10" x2="78" y2="92">${stops.map(([o, v]: [number, string]) => `<stop offset="${o}" stop-color="${v}"/>`).join('')}</linearGradient>` : '';
  const fill = stops ? 'url(#mg)' : `var(--bt-ink-${INKS[color] ? color : 'gray'})`;
  const body = `<g mask="url(#mm)">${bodyOf(def, /^#[0-9a-f]{6}$/i.test(color) ? color : fill)}</g>`;
  xml = resolve(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${def.size} ${def.size}"><defs>${grad}<mask id="mm" ${maskBox(def.size)}>${holes(def, def.eyes.map(eye).join(''))}</mask></defs>${def.wrap ? `<g transform="${def.wrap}">${body}</g>` : body}</svg>`, dark);
  cache.set(key, xml);
  return xml;
}

/** The selection ring: the silhouette's outline, drawn a little outside it. */
export function ringXml(shape: string, stroke: string): string {
  const def = shapeOf(shape);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 ${def.size + 16} ${def.size + 16}"><g fill="none" stroke="${stroke}" stroke-width="5" stroke-linejoin="round">${bodyOf(def, 'none', true).replace(/fill="none"/g, '')}</g></svg>`;
}
export const shapeLabel = (id: string) => SHAPES[id]?.label ?? id;
export const swatch = (color: string, dark: boolean) => (GRADIENTS[color] ? GRADIENTS[color][1][1] : (INKS[color] ?? INKS.gray)[dark ? 1 : 0]);

/** characterXml with the .bt-eyes group and each .bt-eye rect transformed (an animation frame). */
export function animatedXml(shape: string, color: string, dark: boolean, eyesTf: string, eyeTf: (e: number[]) => string): string {
  const def = shapeOf(shape);
  const stops = GRADIENTS[color];
  const grad = stops ? `<linearGradient id="mg" gradientUnits="userSpaceOnUse" x1="18" y1="10" x2="78" y2="92">${stops.map(([o, v]: [number, string]) => `<stop offset="${o}" stop-color="${v}"/>`).join('')}</linearGradient>` : '';
  const fill = stops ? 'url(#mg)' : `var(--bt-ink-${INKS[color] ? color : 'gray'})`;
  const body = `<g mask="url(#mm)">${bodyOf(def, /^#[0-9a-f]{6}$/i.test(color) ? color : fill)}</g>`;
  const eyes = def.eyes.map((e: number[]) => { const [cx, cy, w, h, tilt] = e; const tf = eyeTf(e); return `<g transform="translate(${cx} ${cy}) rotate(${tilt})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w / 2}" fill="#000"${tf ? ` transform="${tf}"` : ''}/></g>`; }).join('');
  return resolve(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${def.size} ${def.size}"><defs>${grad}<mask id="mm" ${maskBox(def.size)}>${holes(def, eyesTf ? `<g transform="${eyesTf}">${eyes}</g>` : eyes)}</mask></defs>${def.wrap ? `<g transform="${def.wrap}">${body}</g>` : body}</svg>`, dark);
}
