/// <reference types="node" />
// 0.9.6: fold / file-text, About, Feedback, kept-private, avatar refs (web 0.2.4 parity).
//   npx tsx test/batch096.test.mts "<token URL>"
import assert from 'node:assert/strict';
import { BotClient } from '../src/api/client';
import { ManualCookieTokenAuth, parseConnection } from '../src/api/auth';
import { foldPreview, foldView, stripLongNote, FOLD_AT, FOLD_HUGE } from '../src/api/fold';
import { issueUrl, whenText, starCount, botHint, dshHint, failureLabel, WHAT_MAX } from '../src/api/aboutModel';
import { emptyRoom, withRoomPage, roomRows } from '../src/api/chatModel';

const log = (...a: unknown[]) => console.log('  ✓', ...a);
let n = 0; const ok = (m: string) => { n++; log(m); };

// ---- fold.js
const long = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
assert.equal(foldPreview('short'), null);
assert.equal(foldPreview(long)!.split('\n').length, 10);
assert.equal(foldPreview(long, FOLD_HUGE), null);
assert.equal(foldPreview('```js\n' + 'x\n'.repeat(40))!.endsWith('\n```'), true);
ok('foldPreview: 25 lines / 10-line preview / FOLD_HUGE / open fence closed');
let v = foldView(long, { open: false });
assert.equal(v.more, `显示全部 · ${long.length} 字`); assert.equal(v.folded, true);
v = foldView(long, { open: true }); assert.equal(v.shown, long); assert.equal(v.less, true);
assert.equal(foldView(long, { open: false }, { live: true }).more, undefined);
ok('foldView: 显示全部 · N 字 / 收起 / never while streaming');
const whole = { length: 5000 };
v = foldView('start only', { open: false }, { whole }); assert.equal(v.more, '显示全部 · 5,000 字');
v = foldView('start only', { open: true, read: { text: 'x'.repeat(5000), whole: true } }, { whole }); assert.equal(v.shown.length, 5000); assert.equal(v.note, null);
v = foldView('start only', { open: true, read: { text: 'x'.repeat(3000), whole: false } }, { whole }); assert.equal(v.note, '只显示前 3,000 字');
v = foldView('start only', { open: true, read: { whole: false } }, { whole }); assert.equal(v.note, '这里只保留了这条消息的开头');
assert.equal(stripLongNote('[A long message: 5000 characters. The rest is in the file.]\nhello'), 'hello');
ok('whole: a cut post always folds, loads file-text, notes partial reads; stripLongNote');
const rm = withRoomPage(emptyRoom(), { items: [{ id: '1', kind: 'bot', text: 'hi', whole: { length: 9000, file: { attachmentId: 'a' } } }] });
assert.deepEqual(roomRows(rm)[0].data?.whole, { length: 9000, file: { attachmentId: 'a' } });
ok('room-chat whole {length,file} reaches the row');

// ---- diagnostics.js / about.js
const big = issueUrl('https://github.com/x/y/issues/new', { what: 'Broke\nmore', diagnostics: 'facts\n\n' + 'e'.repeat(9000) });
assert.equal(big.inline, false); assert.ok(big.url.length <= 7000); assert.ok(big.url.includes('title=Broke'));
const small = issueUrl('https://github.com/x/y/issues/new', { what: 'a b', diagnostics: 'd' });
assert.equal(small.inline, true); assert.equal(small.url, 'https://github.com/x/y/issues/new?template=bug.yml&title=a+b&what=a+b&diagnostics=d');
assert.equal(issueUrl('u', { what: 'x'.repeat(5000), diagnostics: '' }).url.length < 2200, true);
ok('issueUrl: inline / too long keeps the facts / WHAT_MAX ' + WHAT_MAX);
const now = new Date(2026, 9, 31, 15, 0);
assert.equal(whenText(new Date(2026, 9, 31, 9, 5).getTime(), now), '09:05');
assert.equal(whenText(new Date(2026, 9, 2, 21, 7).getTime(), now), '10月2日 21:07');
assert.equal(starCount(1234), '1234'); assert.equal(starCount(12345), '1.2万');
assert.equal(failureLabel('AUTH', 'x'), 'API 密钥无效'); assert.equal(failureLabel(undefined, 'boom'), 'boom');
assert.equal(botHint({ available: true, latest: '0.3.0' }), 'DS Bot 0.3.0 可以更新');
assert.equal(botHint({ source: 'path' }), '从本地文件夹安装，请在那里更新。');
assert.equal(botHint({}), null);
assert.equal(dshHint({ current: '1.2' }, false), '版本 1.2');
ok('whenText / starCount / failureLabel / botHint / dshHint');

// ---- live endpoints
const url = process.argv[2]; assert.ok(url, 'token URL argv');
const client = new BotClient(parseConnection(url), new ManualCookieTokenAuth());
await client.connect();
const u = await client.updateCheck(false);
assert.equal(typeof u, 'object'); assert.ok('dsh' in u);
ok(`update-check: current=${u.current ?? '—'} source=${u.source ?? '—'}`);
const stars = await client.repoStars().catch((e: any) => e);
assert.ok(stars === null || Number.isInteger(stars) || stars instanceof Error);
ok(`repo-stars answered (${stars instanceof Error ? 'error: ' + stars.message : stars})`);
const d = await client.diagnostics({ client: { surface: 'DS Bot Android test' }, clientErrors: [{ time: Date.now(), level: 'error', text: 'test: boom' }] });
assert.equal(typeof d.markdown, 'string'); assert.ok(typeof d.issuesUrl === 'string' && d.issuesUrl.startsWith('https://')); assert.ok(Array.isArray(d.entries)); assert.equal(typeof d.total, 'number');
ok(`diagnostics: markdown ${d.markdown.length} chars, total ${d.total}`);
assert.equal(typeof await client.diagnosticsLog(), 'string');
assert.equal(await client.diagnosticsClear(), true);
assert.equal((await client.diagnostics({ client: {}, clientErrors: [] })).total, 0);
ok('diagnostics-log / diagnostics-clear');
await assert.rejects(client.fileText({}), (e: any) => e.code === 'bot/invalid');
ok('file-text without a file: bot/invalid');
const st: any = await client.state();
for (const b of st.bots) assert.ok(b.avatar?.image === undefined || typeof b.avatar.imageRef === 'string');
const a = await client.avatar(st.bots[0].id);
assert.equal(a.botId, st.bots[0].id); assert.ok(a.ref === null || /^[0-9a-f]{16}$/.test(a.ref));
assert.ok(Array.isArray(st.privateArchives));
ok(`state avatars:'ref' + avatar (ref ${a.ref}); privateArchives ${st.privateArchives.length}`);
await assert.rejects(client.privateRelease('no-such-id'), (e: any) => e.code === 'bot/refused');
ok('private-release of an unknown id: bot/refused');
// A photo goes by reference and is read once, then served from the client cache.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const bot0 = st.bots[0];
await client.updateBot(bot0.id, { avatar: { ...(bot0.avatar ?? {}), image: PNG } }).catch((e: any) => e);
let calls = 0; const orig = client.avatar.bind(client); client.avatar = (id: string) => { calls++; return orig(id); };
const s1: any = await client.state(); const s2: any = await client.state();
const b1 = s1.bots.find((b: any) => b.id === bot0.id);
if (typeof b1.avatar?.imageRef === 'string') {
  assert.equal(b1.avatar.image, PNG); assert.equal(s2.bots.find((b: any) => b.id === bot0.id).avatar.image, PNG); assert.equal(calls, 1);
  ok(`avatar cache: ref ${b1.avatar.imageRef}, image read once over two state calls`);
} else ok('avatar cache: host kept no photo (skipped)');
console.log(`batch096: ${n} passed`);
