// 0.5.1: group settings logic (谁来回答 shown mode) and a stalled request failing instead of hanging.
import assert from 'node:assert/strict';
import http from 'node:http';
import { shownMode } from '../src/api/cards';
import { BotClient } from '../src/api/client';
import { parseLocal, timingText } from '../src/api/schedules';
import { characterXml, ringXml, PICKER_SHAPES, CHARACTER_COLORS, lookOf } from '../src/avatar/mark';

// 0.7.0 side chat helpers
import { parseSideLine, sideQuery, sideTitle, sideFailure, withPending, sideHostText } from '../src/api/side';
assert.deepEqual(parseSideLine('/side 进展？'), { args: '进展？', bare: false });
assert.equal(parseSideLine('/side')!.bare, true);
assert.equal(parseSideLine('/sidechat hi'), null); assert.equal(parseSideLine('/Side hi'), null); assert.equal(parseSideLine('hi'), null);
assert.ok(sideQuery('/') && sideQuery('/si') && sideQuery('/SIDE')); assert.ok(!sideQuery('/x') && !sideQuery('/side q') && !sideQuery('si'));
assert.equal(sideTitle({ id: 'a', botId: 'b', entries: [] }), '侧边对话');
assert.equal(sideTitle({ id: 'a', botId: 'b', entries: [{ id: '1', question: ' 问题 ', status: 'done' }] }), '问题');
assert.equal(sideFailure({ id: '1', question: 'q', status: 'failed' }), '没能答上。');
assert.equal(sideFailure({ id: '1', question: 'q', status: 'failed', error: 'Wait for the answer, or cancel it.' }), '等它答完，或者先取消。');
assert.equal(sideHostText('other'), 'other');
const pend = [{ id: 'pending:1', question: 'q2', status: 'answering' as const }];
assert.equal(withPending({ id: 'c', botId: 'b', entries: [{ id: 'x', question: 'q1', status: 'done' }] }, pend).length, 2);
assert.equal(withPending({ id: 'c', botId: 'b', entries: [{ id: 'y', question: 'q2', status: 'answering' }] }, pend).length, 1, 'server copy replaces optimistic');
console.log('  ✓ side chat: /side parse, popup match, title, failure text, optimistic merge');

// 0.6.0 pure helpers
assert.equal(new Date(parseLocal('2026-11-01 08:30')).getHours(), 8);
assert.throws(() => parseLocal('明天'));
assert.equal(timingText({ kind: 'daily', time: '08:30:00' } as any).includes('08:30'), true);
for (const s of PICKER_SHAPES as string[]) for (const d of [false, true]) {
  const x = characterXml(s, (CHARACTER_COLORS as string[])[0], d);
  assert.ok(x.startsWith('<svg') && !x.includes('var('), s);
  assert.ok(ringXml(s, '#fff').startsWith('<svg'));
}
const lk = lookOf({ id: 'abc' }); assert.ok(lk.shape && lk.color);
console.log('  ✓ schedules parse/timing, avatar marks for', (PICKER_SHAPES as string[]).length, 'shapes');

const bots = [{ id: 'chief' }, { id: 'writer' }];
const room = { members: ['chief', 'writer'], admin: 'chief' };
assert.equal(shownMode({ ...room, mode: 'everyone' }, bots), 'everyone');
assert.equal(shownMode({ ...room, mode: 'admin' }, bots), 'admin');
assert.equal(shownMode({ ...room }, bots), 'admin');
assert.equal(shownMode({ ...room, admin: undefined, mode: 'admin' } as any, bots), 'everyone');
assert.equal(shownMode({ ...room, admin: 'gone', mode: 'admin' }, bots), 'everyone');
console.log('  ✓ shownMode: admin / everyone / no admin');

const server = http.createServer(() => { /* never answers, like a dead tunnel */ });
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as any).port;
const c = new BotClient({ baseUrl: `http://127.0.0.1:${port}`, token: 'x' } as any, { headers: () => ({}), establish: async () => {} } as any);
c.timeoutMs = 300;
const t0 = Date.now();
await assert.rejects(c.updateRoom('r', { mode: 'admin' }), (e: any) => e.code === 'client/timeout');
assert.ok(Date.now() - t0 < 3000);
console.log('  ✓ stalled update-room times out with an error');
server.closeAllConnections(); server.close();
console.log('ALL PASS');
