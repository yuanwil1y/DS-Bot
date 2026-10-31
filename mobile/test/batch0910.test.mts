// 0.9.10 back-navigation: every back (on-screen or hardware) pops exactly one level.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { backOne, sheetBack, innerBack } from '../src/nav';
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log('✓', name); };
const T = { kind: 'bot', id: 'b1' };
const r = (name: any, extra: any = {}) => ({ name, target: T, ...extra });

ok('settings sheet: 单项用量 → 全部用量 → 设置根 → close', () => {
  let s: any = { page: 'usage', usageFocus: 'x' };
  s = sheetBack(s); assert.deepEqual(s, { page: 'usage', usageFocus: null });
  s = sheetBack(s); assert.deepEqual(s, { page: null, usageFocus: null });
  assert.equal(sheetBack(s), 'close');
});
ok('settings sheet: every sub-page goes back to root, not closed', () => {
  for (const p of ['about', 'feedback', 'usage', 'secrets', 'connectors', 'capabilities', 'browser']) assert.deepEqual(sheetBack({ page: p, usageFocus: null }), { page: null, usageFocus: null });
});
ok('stack screens pop exactly one level', () => {
  const base = [r('chat'), r('panel')];
  for (const name of ['settings', 'memory', 'usage', 'schedules', 'avatar', 'side']) {
    const out = backOne([...base, r(name)]); assert.equal(out.stack.length, 2); assert.equal(out.reopenSheet, false);
  }
  assert.deepEqual(backOne([r('chat'), r('panel'), r('settings'), r('avatar')]).stack.map((x: any) => x.name), ['chat', 'panel', 'settings']);
});
ok('bot/group settings opened from the settings sheet return to the sheet', () => {
  const out = backOne([r('settings', { fromSheet: true })]); assert.equal(out.stack.length, 0); assert.equal(out.reopenSheet, true);
});
ok('memory 全部记忆 → 摘要 → pop; usage focus → all → pop', () => {
  const log: string[] = [];
  innerBack('entries', () => log.push('summary'), () => log.push('pop'));
  innerBack(null, () => log.push('summary'), () => log.push('pop'));
  assert.deepEqual(log, ['summary', 'pop']);
});
ok('code wiring: App back handler registered once (oldest), sheet opens settings with fromSheet, headers use onBack not onClose', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /hardwareBackPress[^\n]*\n\s*return \(\) => sub\.remove\(\);\n\s*\}, \[\]\);/);
  assert.match(app, /onOpenSettings=\{\(t\) => push\(\{ name: 'settings', target: t, fromSheet: true \}\)\}/);
  const ui = readFileSync(new URL('../src/components/ui.tsx', import.meta.url), 'utf8');
  assert.match(ui, /icon="back" onPress=\{onBack\}/); assert.match(ui, /onRequestClose=\{onBack \?\? onClose\}/);
  const panel = readFileSync(new URL('../src/screens/Panel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /onBack=\{page === 'entries' \? backToSummary : onBack\}/);
  assert.match(panel, /onBack=\{\(\) => \(focus \? setFocus\(null\) : onBack\(\)\)\}/);
  for (const f of ['Schedules', 'AvatarEditor', 'SideChat']) assert.match(readFileSync(new URL(`../src/screens/${f}.tsx`, import.meta.url), 'utf8'), /<PageHeader[^>]*onBack=\{onBack\}/);
});
console.log(`batch0910: ${n} passed`);
