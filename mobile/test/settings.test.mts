// 0.5.1: group settings logic (谁来回答 shown mode) and a stalled request failing instead of hanging.
import assert from 'node:assert/strict';
import http from 'node:http';
import { shownMode } from '../src/api/cards';
import { BotClient } from '../src/api/client';
import { parseLocal, timingText } from '../src/api/schedules';
import { characterXml, ringXml, PICKER_SHAPES, CHARACTER_COLORS, lookOf } from '../src/avatar/mark';

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
