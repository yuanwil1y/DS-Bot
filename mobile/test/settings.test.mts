// 0.5.1: group settings logic (谁来回答 shown mode) and a stalled request failing instead of hanging.
import assert from 'node:assert/strict';
import http from 'node:http';
import { shownMode } from '../src/api/cards';
import { BotClient } from '../src/api/client';

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
