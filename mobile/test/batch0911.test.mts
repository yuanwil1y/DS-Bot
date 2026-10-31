// 0.9.11 header button colours: icon ≥4.5:1 on fill, ring ≥1.5:1 on page bg, every theme × mode.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { palette, THEME_IDS } from '../src/appearance';
const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let n = 0;
for (const id of THEME_IDS) for (const dark of [false, true]) {
  const t: any = palette({ theme: id }, dark);
  const icon = cr(t.text, t.roundFill), ring = cr(t.roundBorder, t.bg), fill = cr(t.roundFill, t.bg);
  console.log(`✓ ${id}/${dark ? 'dark' : 'light'} bg ${t.bg} fill ${t.roundFill} ring ${t.roundBorder} icon ${icon.toFixed(1)}:1 ring ${ring.toFixed(2)}:1 fill ${fill.toFixed(2)}:1`);
  assert.ok(icon >= 4.5); assert.ok(ring >= 1.5); n++;
}
const ui = readFileSync(new URL('../src/components/ui.tsx', import.meta.url), 'utf8');
assert.match(ui, /iconXml\(xml, color\)/); n++; console.log('✓ Icon inlines currentColor');
console.log(`batch0911: ${n} passed`);
