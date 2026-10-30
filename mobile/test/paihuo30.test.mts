// Regression for the 0.4.0 crash on `派活 30`: room-chat / room-progress send `speaking` as a
// single botId string; the chat header did `speaking.map(...)` -> TypeError -> app closed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyRoom, withRoomPage, roomRows, speakingList } from '../src/api/chatModel';
import { roomWork, needsCount, cardsFor, eventLabel } from '../src/api/cards';
const fx = JSON.parse(readFileSync(new URL('./fixtures/paihuo30.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(fx.bots.map((b: any) => [b.id, b]));
assert.deepEqual(speakingList('a'), ['a']); assert.deepEqual(speakingList(['a', ['b']]), ['a', 'b']);
assert.deepEqual(speakingList(undefined), []); assert.deepEqual(speakingList({}), []);
let sawSpeaking = false;
for (const snap of fx.snaps) {
  const m = withRoomPage(emptyRoom(), snap.rc);
  assert.ok(Array.isArray(m.speaking));
  if (m.speaking!.length) sawSpeaking = true;
  // the exact expressions ChatScreen renders
  const sub = (m.speaking?.length ? m.speaking.map((s) => byId[s]?.name ?? s).join('、') + ' · ' : '') + '工作中';
  assert.equal(typeof sub, 'string');
  const list = roomRows(m);
  for (const r of list) { assert.equal(typeof r.text, 'string', `row ${r.key}`); assert.equal(typeof r.key, 'string'); }
  assert.equal(new Set(list.map((r) => r.key)).size, list.length, 'unique keys');
  (m.speaking ?? []).filter((b) => !list.some((r) => r.streaming && r.botId === b)).forEach((b) => assert.equal(typeof `${byId[b]?.name ?? 'Bot'} 正在输入…`, 'string'));
  const prog = speakingList(snap.prog.map((x: any) => x.speaking));
  assert.ok(prog.every((x) => typeof x === 'string'));
  const st = { bots: fx.bots, rooms: [fx.room], work: snap.work } as any;
  for (const w of roomWork(st, fx.room.id)) { assert.ok(w.state === 'work' || w.state === 'ask'); assert.ok(w.doing == null || typeof w.doing === 'string'); }
  needsCount(st); cardsFor(st, { kind: 'room', id: fx.room.id });
  for (const i of snap.rc.items) if (i.kind === 'event') assert.equal(typeof eventLabel(i), 'string');
}
assert.ok(sawSpeaking, 'fixture covers the speaking state');
console.log('  ✓ 派活 30 captured payloads render safely (speaking string normalized)');
