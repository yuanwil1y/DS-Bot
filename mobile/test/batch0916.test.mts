// 0.9.16: no in-app test code at all; calendar fills the popover; no fixed-height TextInputs;
// KeyIcon centred; 总工作区 field is part of its row (no divider).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|json)$/.test(f) ? [p] : []; });
const files = [...walk('src'), 'App.tsx'];
const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
let n = 0; const ok = (m: string) => { n++; console.log('  ✓', m); };
for (const f of ['src/selfTest.tsx', 'src/featureTest.tsx', 'src/appearanceTest.tsx', 'src/demo.json']) assert.ok(!existsSync(f), f);
assert.doesNotMatch(all, /selfTest|SelfTest|featureTest|useFT\b|ftLog|FTLabel|LONG_TEXT|TEST-ONLY|测试用|短自测|title="测试"/);
ok('no in-app test code');
assert.doesNotMatch(readFileSync('src/screens/UsagePage.tsx', 'utf8'), /maxWidth: 252/);
ok('calendar month spans full width');
for (const f of files) {
  const L = readFileSync(f, 'utf8').split('\n');
  L.forEach((l, i) => { if (l.includes('<TextInput')) { const seg = L.slice(i, i + 4).join(' '); const end = seg.indexOf('/>'); assert.doesNotMatch(end > 0 ? seg.slice(0, end) : seg, /(?<![A-Za-z])height:\s*\d/, `${f}:${i + 1}`); } });
}
ok('no fixed-height TextInput');
assert.match(readFileSync('src/components/icons.extra.ts', 'utf8'), /key: '<svg[^']*<circle cx="6.5" cy="10" r="3.5"/);
ok('key icon centred');
assert.match(readFileSync('src/screens/SettingsSheet.tsx', 'utf8'), /<View>\s*<Row theme=\{theme\} label="总工作区"/);
ok('总工作区 field shares its row');
console.log(`batch0916: ${n} passed`);
