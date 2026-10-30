/// <reference types="node" />
// Runs the app's API layer (src/api) against the local mock backend:
//   sh ../dev/mobile/run-local.sh start && npm run test:api [-- <token URL>]
// Only the auth strategy differs from the app (Node has no cookie jar).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { BotClient } from '../src/api/client';
import { Feed } from '../src/api/feed';
import { ManualCookieTokenAuth, parseConnection } from '../src/api/auth';
import { emptyChat, withHistory, applyFeed, rows } from '../src/api/chatModel';
import type { FeedEvent } from '../src/api/types';

const url = process.argv[2] ?? readFileSync('/tmp/dsh-mobile/web.log', 'utf8').match(/http:\/\/[\d.:]+\/\?token=\S+/g)?.at(-1);
assert.ok(url, 'no token URL');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log('  ✓', ...a);

const conn = parseConnection(url);
const auth = new ManualCookieTokenAuth();
const client = new BotClient(conn, auth);

// bad token is rejected
await assert.rejects(new BotClient({ ...conn, token: 'wrong' }, new ManualCookieTokenAuth()).connect());
log('bad token rejected');

const hello = await client.connect();
assert.equal(hello.api, 1);
log('connect + hello api=1, caps', hello.capabilities.length);

const events: FeedEvent[] = [];
const statuses: string[] = [];
const feed = new Feed(conn, auth, (e) => events.push(e), (s) => statuses.push(s));
feed.start();
for (let i = 0; i < 50 && !events.some((e) => e.event === 'hello'); i++) await sleep(100);
assert.ok(events.some((e) => e.event === 'hello'), 'feed hello');
log('feed (Remote WS) open, hello received');

const st = await client.state();
assert.ok(st.bots.length > 0);
const bot = st.bots.find((b) => b.name === 'Writer') ?? st.bots[0];
log('state: bots =', st.bots.map((b) => b.name).join(', '));

let model = withHistory(emptyChat(), (await client.chat(bot.id)).items);
const before = model.items.length;
log('chat history items =', before);

const from = events.length;
const sawDraft: string[] = [];
await client.send(bot.sessionId ?? bot.id, '你好，测试流式回复');
for (let i = 0; i < 200; i++) {
  await sleep(100);
  let m = withHistory(emptyChat(), model.items);
  for (const e of events.slice(from)) { m = applyFeed(m, bot.id, e); const d = rows(m).find((r) => r.streaming); if (d?.text) sawDraft.push(d.text); }
  if (events.slice(from).some((e) => e.event === 'stream' && e.data.phase === 'end')) { model = m; break; }
}
const kinds = [...new Set(events.slice(from).map((e) => e.event))];
assert.ok(kinds.includes('stream'), 'stream events');
assert.ok(sawDraft.length > 0, 'draft text rendered while streaming');
const r = rows(model);
assert.equal(r.at(-1)?.kind, 'bot');
assert.equal(r.at(-2)?.text, '你好，测试流式回复');
assert.ok(!r.some((x) => x.streaming), 'draft replaced by final message');
log('send -> feed', kinds.join('/'), '-> streamed draft', JSON.stringify(sawDraft.at(-1)).slice(0, 40), '-> final', JSON.stringify(r.at(-1)?.text).slice(0, 40));

// history agrees with the live model
const after = await client.chat(bot.id);
assert.equal(after.items.at(-1)?.text, r.at(-1)?.text);
log('chat reload matches live view');

// reconnect: kill the socket, feed must come back by itself
const opens = statuses.filter((s) => s === 'open').length;
(feed as any).ws.close();
for (let i = 0; i < 80 && statuses.filter((s) => s === 'open').length === opens; i++) await sleep(100);
assert.ok(statuses.filter((s) => s === 'open').length > opens, 'reconnected');
log('feed reconnects after drop; statuses', statuses.join('>'));

feed.stop();
console.log('ALL PASS');
process.exit(0);
