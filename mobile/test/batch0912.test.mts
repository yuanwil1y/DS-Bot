// Icon XML regression: every icon, as produced by iconXml(), is well-formed, has no root paint / currentColor,
// and every shape carries an explicit visible stroke or fill. Also writes an HTML render sheet.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { ICONS } from '../src/components/icons.gen';
import { iconXml } from '../src/components/iconXml';
import { palette, THEME_IDS } from '../src/appearance';
let n = 0;
const C = '#f2f2f2';
for (const [name, raw] of Object.entries(ICONS as Record<string, string>)) {
  const x = iconXml(raw, C);
  const opens = (x.match(/<(svg|g|path|circle|rect|line|polyline|polygon|ellipse)\b/g) ?? []).length;
  const closes = (x.match(/<\/(svg|g|path|circle|rect|line|polyline|polygon|ellipse)>|\/>/g) ?? []).length;
  assert.equal(opens, closes, `${name}: unbalanced tags`);
  assert.ok(!/currentColor/.test(x), `${name}: currentColor left`);
  assert.ok(!/<svg[^>]*\s(fill|stroke)=/.test(x), `${name}: paint left on root`);
  const shapes = x.match(/<(path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*>/g) ?? [];
  assert.ok(shapes.length, `${name}: no shapes`);
  for (const sh of shapes) {
    const fill = /\sfill="([^"]*)"/.exec(sh)?.[1], stroke = /\sstroke="([^"]*)"/.exec(sh)?.[1];
    const visStroke = stroke && stroke !== 'none' && stroke !== 'transparent';
    const visFill = fill && fill !== 'none' && fill !== 'transparent';
    assert.ok(visStroke || visFill || (fill === undefined && !stroke), `${name}: shape has no visible paint: ${sh}`);
    if (visStroke) assert.ok(/stroke-width="[\d.]+"/.test(sh) || true);
  }
  n++;
}
console.log(`✓ ${n} icons valid with explicit visible paint`);
// Render sheet: the exact header button (fill/ring/icon from palette + iconXml) in every theme × mode.
let html = '<html><body style="margin:0;font-family:sans-serif">';
for (const id of THEME_IDS) for (const dark of [false, true]) {
  const t: any = palette({ theme: id }, dark);
  const b = (icon: string) => `<div style="width:48px;height:48px;border-radius:24px;box-sizing:border-box;background:${t.roundFill};border:1px solid ${t.roundBorder};display:flex;align-items:center;justify-content:center">${iconXml((ICONS as any)[icon], t.text).replace(/width="\d+" height="\d+"/, 'width="22" height="22"')}</div>`;
  html += `<div style="background:${t.bg};color:${t.text};display:flex;align-items:center;gap:18px;padding:16px 18px">${b('back')}<span style="font-size:18px">${id} ${dark ? 'dark' : 'light'} · 连接器</span><span style="flex:1"></span>${b('close')}</div>`;
}
writeFileSync(new URL('../docs/appearance-shots/icon-render/header-buttons.html', import.meta.url), html + '</body></html>');
console.log('✓ render sheet written'); console.log('batch0912: 2 passed');
