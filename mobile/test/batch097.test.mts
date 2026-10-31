/// <reference types="node" />
// 0.9.7: exchange viewer, secrets page, full usage page (web 0.2.4 parity).
//   npx tsx test/batch097.test.mts "<token URL>"
import assert from 'node:assert/strict';
import { BotClient } from '../src/api/client';
import { ManualCookieTokenAuth, parseConnection } from '../src/api/auth';
import { emptyChat, eventData, rows } from '../src/api/chatModel';
import { RANGES, spanRange, tokensOf } from '../src/api/usageData';
import { compareText, full, heat, hitRate, lastText, niceTop, focusOf, shape, spanText, rangeLabel } from '../src/api/usageModel';

const log = (...a: unknown[]) => console.log('  ✓', ...a);
let n = 0; const ok = (m: string) => { n++; log(m); };

// ---- usage-data.js / usage-page.js pure parts
const view: any = { now: '2026-10-31 14', kinds: ['chat'], owners: [{ key: 'bot:a', kind: 'bot', id: 'a', name: 'A' }, { key: 'other', kind: 'other' }],
  models: [{ key: 'm1', name: 'M1', provider: 'p' }],
  rows: [['2026-10-31 13', 0, 0, 0, 100, 50, 0, 10, 1], ['2026-10-30 09', 1, 0, 0, 20, 0, 0, 5, 1], ['2025-01-01 00', 0, 0, 0, 1, 0, 0, 1, 1]] };
assert.equal(tokensOf(view.rows[0]), 160);
assert.equal(full(1234567), '1,234,567'); assert.equal(hitRate({ cacheRead: 50, input: 50 }), '50');
assert.equal(niceTop(0) > 0, true); assert.ok(niceTop(87) >= 87);
assert.deepEqual(focusOf('owner:bot:a'), { kind: 'owner', key: 'bot:a' }); assert.equal(focusOf(null), null);
ok('tokensOf / full / hitRate / niceTop / focusOf');
const r7: any = RANGES.find((r: any) => r.id === '7d');
assert.equal(lastText(r7), '最近 7 天'); assert.ok(compareText(r7).startsWith('与再往前'));
assert.equal(rangeLabel('12w'), '12 周');
const span = spanRange('2026-10-01', '2026-10-10'); assert.equal(span.unit, 'day'); assert.equal(span.days, 10);
assert.ok(spanText('2026-10-01', '2026-10-10', 2026).includes('10'));
ok('ranges: 最近 N / spanRange unit+days / spanText');
const colors: any = { card: '#ffffff', text: '#000000', accent: '#3366ff', botPaint: () => '#ff0000', botName: (id: string) => (id === 'a' ? 'A' : undefined), botRole: () => '', ink: () => '#00ff00' };
const sh = shape(view, r7, 'bot', null, colors);
assert.equal(sh.columns.length, 7); assert.equal(sh.columns.reduce((s: number, c: any) => s + c.total, 0), 160 + 25);
assert.deepEqual(sh.series.map((s) => s.key), ['o0', 'rest']);
const shf = shape(view, r7, 'bot', { kind: 'owner', key: 'bot:a' }, colors);
assert.equal(shf.columns.reduce((s: number, c: any) => s + c.total, 0), 160); assert.equal(shf.tipSeries.length, 3);
assert.equal(shape(view, r7, 'model', null, colors).series[0].key, 'm0');
ok('shape: 7 day columns, bot series + 其他, focus narrows and tips by part, by model');
const h = heat(view, () => true);
assert.equal(h.weeks.length, 53); assert.equal(h.active, 2); assert.equal(h.summary, '近一年有 2 天在用');
assert.equal(h.weeks.flat().filter((d) => d.today).length, 1);
ok('heat: 53 weeks, out-of-year rows dropped, one today');

// ---- private-chat event rows (cells.js)
assert.deepEqual(eventData({ role: 'report', roomId: 'r1' }), { event: 'exchange', role: 'report', prefix: '群聊回复：', roomId: 'r1', fallback: '一个群聊' });
assert.equal(eventData({ role: 'stopped', botId: 'b' }).prefix, '叫停者：');
assert.equal(eventData({ role: 'reply', botId: 'b' }).prefix, '收到回复：');
assert.equal(eventData({ role: 'sent', botId: 'b' }).prefix, '收到消息：');
assert.equal(eventData({ role: 'sent', botId: 'b' }).fallback, '一个 Bot');
const cm: any = { ...emptyChat(), items: [{ id: 'e1', kind: 'event', role: 'reply', botId: 'b', name: 'B', time: 1 }, { id: 'e2', kind: 'event', time: 2 }] };
const rs = rows(cm);
assert.equal(rs.length, 1); assert.equal(rs[0].kind, 'event'); assert.equal(rs[0].data.event, 'exchange'); assert.equal(rs[0].data.fallback, 'B');
ok('event rows: 群聊回复/叫停者/收到回复/收到消息, kept in private chat');

// ---- live host
const url = process.argv[2]; assert.ok(url, 'token URL argv');
const client = new BotClient(parseConnection(url), new ManualCookieTokenAuth());
const st: any = await client.state();
const u = await client.usage();
assert.ok(typeof u.now === 'string' && Array.isArray(u.rows) && Array.isArray(u.owners) && Array.isArray(u.models));
shape(u, r7, 'bot', null, colors); heat(u, () => true);
ok(`usage: view {now, rows ${u.rows.length}, owners, models}; shape/heat accept it`);
const ex = await client.exchange(st.bots[0].id, 'nobody');
assert.deepEqual(ex, []);
await assert.rejects(client.exchangeText('no-such-id'));
ok('exchange unknown pair → [] / exchange-text unknown → rejects (bot/stale)');
const NAME = 'MOBILE_TEST_KEY';
await client.secretSet({ name: NAME, purpose: 'test', value: 'abcd1234', scope: 'all' });
let s = (await client.state() as any).secrets.find((x: any) => x.name === NAME);
assert.ok(s); assert.equal(s.scope, 'all'); assert.equal(s.purpose, 'test');
assert.ok(!JSON.stringify(await client.state()).includes('abcd1234'), 'value never in state');
await client.secretUpdate(NAME, { scope: [st.bots[0].id], purpose: 'p2' });
s = (await client.state() as any).secrets.find((x: any) => x.name === NAME);
assert.deepEqual(s.scope, [st.bots[0].id]); assert.equal(s.purpose, 'p2');
await client.secretSet({ name: NAME, value: 'zzzz9999' });
assert.ok(!JSON.stringify(await client.state()).includes('zzzz9999'));
await client.secretDelete(NAME);
assert.ok(!(await client.state() as any).secrets.some((x: any) => x.name === NAME));
await assert.rejects(client.secretDelete(NAME)); await assert.rejects(client.secretUpdate(NAME, { purpose: 'x' }));
ok('secrets: add / update scope+purpose / replace value / delete / unknown rejects; no value in state');
console.log(`batch097: ${n} passed`);
