/// <reference types="node" />
// Runs the app's API layer (src/api) against the local mock backend:
//   sh ../dev/mobile/run-local.sh start && npm run test:api [-- <token URL>]
// Only the auth strategy differs from the app (Node has no cookie jar).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { BotClient } from '../src/api/client';
import { Feed } from '../src/api/feed';
import { ManualCookieTokenAuth, parseConnection } from '../src/api/auth';
import { emptyChat, withHistory, applyFeed, rows, addPending, emptyRoom, withRoomPage, roomRows } from '../src/api/chatModel';
import type { FeedEvent } from '../src/api/types';
import { cardsFor, needsYou, roomWork, eventLabel, mentionQuery, insertMention, mentionCandidates } from '../src/api/cards';

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

// optimistic send: pending row shows at once, then is replaced by the server's copy
{
  const OPT = '乐观消息测试 ' + Date.now();
  let m = addPending(withHistory(emptyChat(), (await client.chat(bot.id)).items), OPT);
  assert.equal(rows(m).filter((x) => x.pending).length, 1);
  const f2 = events.length;
  await client.send(bot.sessionId ?? bot.id, OPT);
  for (let i = 0; i < 100 && !events.slice(f2).some((e) => e.event === 'stream' && e.data.phase === 'end'); i++) await sleep(100);
  for (const e of events.slice(f2)) m = applyFeed(m, bot.sessionId ?? bot.id, e);
  assert.equal(rows(m).filter((x) => x.pending).length, 0, 'pending reconciled by feed');
  assert.equal(rows(m).filter((x) => x.text === OPT).length, 1, 'no duplicate');
  log('optimistic message reconciled with feed, no duplicate');
}

// group chat page + usage + memory (read-only calls)
if (st.rooms?.length) {
  const p = await client.roomChat(st.rooms[0].id);
  const rm = withRoomPage(emptyRoom(), p);
  assert.ok(roomRows(rm).length > 0);
  log('room-chat rows =', roomRows(rm).length, 'running =', !!p.running);
}
const u = await client.usage(bot.id); assert.ok(u.day && typeof u.day.calls === 'number');
const mem = await client.memory(bot.id); assert.ok(Array.isArray(mem.entries));
log('usage-summary calls(24h) =', u.day.calls, '; memory entries =', mem.entries.length);


// ---- M2/M3: cards, group live, notices ----
const until = async (f: () => Promise<any>, ms = 15000) => { for (let i = 0; i < ms / 200; i++) { const v = await f(); if (v) return v; await sleep(200); } throw new Error('timeout'); };
const W = (await client.state()).bots.find((b) => b.name === 'Writer')!;
const tgt = { kind: 'bot' as const, id: W.id };
const nb = await client.notices(); assert.ok(nb.boot && typeof nb.seq === 'number');

// question answer
await client.send(W.sessionId ?? W.id, '卡片 1');
const q = (await until(async () => cardsFor(await client.state(), tgt).question))!;
assert.ok(needsYou(await client.state()).some((n) => n.kind === 'question'));
await client.answerQuestion(W.sessionId ?? W.id, q.id, { selected: [q.options[0].label] });
await until(async () => !cardsFor(await client.state(), tgt).question);
const hist = await until(async () => { const h = withHistory(emptyChat(), (await client.chat(W.id)).items); return rows(h).find((r) => r.kind === 'answer' && r.data?.answers?.[0]?.id === q.id); });
assert.deepEqual(hist.data.answers[0].selected, [q.options[0].label]);
log('question card → answer-question → settled answer row', q.question);

// view dismiss
await client.send(W.sessionId ?? W.id, '视图选项');
const v = (await until(async () => cardsFor(await client.state(), tgt).view))!;
await client.dismissView(W.sessionId ?? W.id);
await until(async () => !cardsFor(await client.state(), tgt).view);
log('view card', v.title, '→ dismiss-view clears it');

// notices since boot/seq
const ns = await client.notices(nb.boot, nb.seq);
assert.equal(ns.reset, false); assert.ok(ns.notices.length > 0 && ns.notices.every((n) => n.seq > nb.seq));
assert.equal((await client.notices('stale-boot', 0)).reset, true);
log('notices catch-up:', ns.notices.map((n) => n.kind).join(','), '; stale boot → reset');

// group: live room events + approval answer + stop member work
const room = (await client.state()).rooms!.find((r) => (r.members ?? []).includes(W.id))!;
const ev0 = events.length;
await client.send(room.id, '@Writer 提权');
const ap = (await until(async () => cardsFor(await client.state(), { kind: 'room', id: room.id }).approvals[0]))!;
assert.equal(ap.botId, W.id);
assert.ok(roomWork(await client.state(), room.id).some((w) => w.botId === W.id && w.state === 'ask'));
assert.ok(events.slice(ev0).some((e) => e.event === 'room' && (e.data as any)?.roomId === room.id), 'room feed event');
await client.approvalAnswer(ap.id, 'allow');
await until(async () => !cardsFor(await client.state(), { kind: 'room', id: room.id }).approvals.length);
await assert.rejects(client.approvalAnswer(ap.id, 'allow'));
log('group approval card → allow; re-answer rejected');
const rr = await until(async () => { const p = await client.roomChat(room.id); return !p.running && roomRows(withRoomPage(emptyRoom(), p)).filter((r) => r.kind === 'event').length ? p : null; }, 30000);
log('room event rows:', roomRows(withRoomPage(emptyRoom(), rr)).filter((r) => r.kind === 'event').slice(-3).map((r) => r.text).join(' | '));

await client.send(room.id, '派活 30');
await until(async () => roomWork(await client.state(), room.id).some((w) => w.botId === W.id && w.state === 'work'), 20000);
assert.ok(events.slice(ev0).some((e) => e.event === 'live'), 'live feed events');
assert.equal(await client.stopMemberWork(room.id, W.id), true);
await until(async () => !roomWork(await client.state(), room.id).some((w) => w.botId === W.id), 15000);
log('派活 → member working → stop-member-work → idle');
const ev1 = events.length;
await client.send(room.id, `派活 30 #${Date.now()}`);
await until(async () => roomWork(await client.state(), room.id).some((w) => w.botId === W.id && w.state === 'work'), 20000);
assert.equal(await client.stopRoomWork(room.id), true);
await until(async () => !roomWork(await client.state(), room.id).length, 15000);
assert.ok(events.slice(ev1).some((e) => e.event === 'room' && (e.data as any)?.roomId === room.id), 'room feed after stop');
const sp = await until(async () => { const p = await client.roomChat(room.id); return roomRows(withRoomPage(emptyRoom(), p)).some((r) => r.kind === 'event' && /停下了/.test(r.text ?? '')) ? p : null; }, 15000);
assert.ok(sp, 'stopped event row');
log('派活 → stop-room-work → idle; feed:', roomRows(withRoomPage(emptyRoom(), sp)).filter((r) => r.kind === 'event').slice(-1).map((r) => r.text).join(''));

// pure helpers
assert.equal(mentionQuery('hi @Wr'), 'Wr'); assert.equal(mentionQuery('hi'), null);
assert.equal(insertMention('hi @Wr', 'Writer'), 'hi @Writer ');
assert.equal(mentionCandidates([{ id: 'a', name: 'Writer' }, { id: 'b', name: 'Main' }] as any, 'wr').length, 1);
assert.equal(eventLabel({ event: 'done', name: 'X' } as any), 'X 做完了');
log('cards helpers ok');

// reconnect: kill the socket, feed must come back by itself
const opens = statuses.filter((s) => s === 'open').length;
(feed as any).ws.close();
for (let i = 0; i < 80 && statuses.filter((s) => s === 'open').length === opens; i++) await sleep(100);
assert.ok(statuses.filter((s) => s === 'open').length > opens, 'reconnected');
log('feed reconnects after drop; statuses', statuses.join('>'));

feed.stop();
console.log('ALL PASS');
process.exit(0);
