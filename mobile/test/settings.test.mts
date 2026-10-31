// 0.5.1: group settings logic (谁来回答 shown mode) and a stalled request failing instead of hanging.
import assert from 'node:assert/strict';
import http from 'node:http';
import { shownMode } from '../src/api/cards';
import { BotClient } from '../src/api/client';
import { parseLocal, timingText } from '../src/api/schedules';
import { characterXml, ringXml, PICKER_SHAPES, CHARACTER_COLORS, lookOf } from '../src/avatar/mark';

// 0.8.0 voice helpers
import { applyPrefs, resolvePrefs, palette, accentInk, bubbleMax, leadBubbleMax, userMax, flatMax } from '../src/appearance';
import { sample, bezier, botState, toolState, plan, progress, pathBox, bodyBox, svgTransform, fidgetOf, ANIMS } from '../src/avatar/motion';
import { animatedXml } from '../src/avatar/mark';
import { plainSpeech, dictationErrorNote, VOICE } from '../src/api/voice';
assert.equal(plainSpeech('你好 **世界**'), '你好 世界');
assert.equal(plainSpeech('见 [文档](http://x)'), '见 文档');
assert.equal(plainSpeech('```\ncode\n```\nok'), 'ok');
assert.equal(dictationErrorNote('not-allowed'), VOICE.micBlocked);
assert.equal(dictationErrorNote('no-speech'), '');
assert.equal(VOICE.dictate, '听写');
assert.equal(VOICE.listening, '在听');
console.log('  ✓ voice: plainSpeech, error notes, zh labels');

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

// appearance prefs (host set-prefs validation, resolvers, palette, widths)
assert.deepEqual(applyPrefs({}, { theme: 'paper', accent: '#ABCDEF', motion: 'lively', layout: 'flat', width: 60, flatWidth: 90, thinking: true }), { theme: 'paper', accent: '#abcdef', motion: 'lively', layout: 'flat', width: 60, flatWidth: 90, thinking: true });
assert.deepEqual(applyPrefs({ motion: 'quiet', width: 60, accent: '#111111', layout: 'flat', thinking: true }, { motion: 'normal', width: 80, accent: '', layout: 'bubble', thinking: false }), {});
assert.deepEqual(applyPrefs({ width: 60 }, { width: 49, flatWidth: 62.5, accent: 'red', motion: 'wild', theme: 'Bad!' }), { width: 60 });
assert.deepEqual(resolvePrefs({ theme: 'nope' }), { theme: 'deepseek', accent: undefined, motion: 'normal', layout: 'bubble', width: 80, flatWidth: 100, thinking: false });
for (const d of [false, true]) { const pl: any = palette({}, d); for (const k of ['bg', 'text', 'accent', 'accentText', 'bubbleMe', 'userText']) assert.ok(typeof pl[k] === 'string' && pl[k].length > 3, k); }
assert.equal((palette({ accent: '#ff0000' }, false) as any).accent.toLowerCase(), '#ff0000');
assert.equal(accentInk('#ffffff') === '#ffffff', false); assert.equal(accentInk('#000000'), '#ffffff');
assert.equal(bubbleMax(400, 80), 318); assert.equal(bubbleMax(400, 100), 318); assert.equal(bubbleMax(400, 50), 200);
assert.equal(leadBubbleMax(400, 80), 326); assert.equal(userMax(400, 80), 320); assert.equal(flatMax(400, 90), 360);
console.log('  ✓ appearance: set-prefs validation, resolvers, palette, widths');

// motion (web keyframes)
const near = (a: number, b: number, e = 1e-3) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
near(bezier([0.42, 0, 0.58, 1])(0.5), 0.5); near(bezier([0.42, 0, 0.58, 1])(0.25), 0.1291, 2e-3); near(bezier([0.3, 0.7, 0.4, 1])(0.5), 0.86888, 1e-4);
near(sample('bob', 0.3).ty, -0.04); near(sample('bob', 0.3).rot, -5); near(sample('bob', 0.65).rot, 4); near(sample('bob', 0.65).ty, 0); near(sample('bob', 1).rot, 0);
near(sample('blink', 0.46).sy, 0.03); near(sample('blink', 0.48).sy, 1.06); near(sample('blink', 0.2).sy, 1);
near(sample('blinkIdle', 0.322).sy, 0.03); near(sample('blinkIdle', 0.734).sy, 1.06);
near(sample('poke', 0.55).rot, 360); near(sample('poke', 0.55).ty, -0.16); near(sample('poke', 0.78).sx, 1.08);
near(sample('done', 0.133).sx, 1.12); near(sample('done', 0.8).sx, 1);
near(sample('roll', 0.25).ty, 0.09); near(sample('roll', 0.125).tx, 0.06); // linear
near(sample('fidgetLook', 0.06).tx, -0.14);
for (const [n, a] of Object.entries(ANIMS)) { const z = sample(n, 0), o = sample(n, 1); for (const k of ['tx', 'ty', 'sx', 'sy'] as const) near(z[k], o[k]); }
assert.equal(botState(true, 'searching', false), 'searching'); assert.equal(botState(true, 'waiting', true), 'working'); assert.equal(botState(true, { tool: 'x' }, false), 'working');
assert.equal(botState(false, 'thinking', true), 'alert'); assert.equal(botState(false, 'waiting', false), 'waiting'); assert.equal(botState(false, 'thinking', false), 'idle');
assert.equal(toolState('message_bot'), 'sending'); assert.equal(toolState('web_search'), 'searching'); assert.equal(toolState('read_file'), 'searching'); assert.equal(toolState('bash'), 'working');
const P = (o: any) => plan({ shape: 'whale', motion: 'normal', live: true, id: 'b1', ...o });
assert.equal(P({ state: 'working' }).body!.anim, 'bob'); assert.equal(P({ state: 'working' }).eye!.anim, 'blink');
assert.equal(P({ state: 'working', shape: 'star' }).body!.anim, 'wiggle'); assert.equal(P({ state: 'working', shape: 'star' }).body!.origin, 'center');
assert.equal(P({ state: 'working', shape: 'moon' }).body!.anim, 'squash');
assert.equal(P({ state: 'thinking' }).eyes!.anim, 'squint'); assert.equal(P({ state: 'searching' }).eyes!.anim, 'scan');
assert.equal(P({ state: 'waiting' }).body!.anim, 'sway'); assert.equal(P({ state: 'orbit' }).eyes!.anim, 'roll');
assert.equal(P({ state: 'alert' }).body!.iterations, 2); assert.equal(P({ state: 'alert', motion: 'lively', live: false }).body!.iterations, Infinity);
assert.equal(P({ state: 'done' }).body!.iterations, 1); assert.equal(P({ state: 'idle' }).body, null); assert.equal(P({ state: 'idle' }).eye, null);
const L = P({ state: 'idle', motion: 'lively' }); assert.equal(L.eye!.anim, 'blinkIdle'); assert.ok(L.eye!.delay <= 0 && L.eye!.delay > -5000);
assert.equal(P({ state: 'idle', motion: 'lively', live: false }).eye, null);
assert.ok(['hop', 'sway', 'stretch', 'look'].includes(fidgetOf('b1')));
assert.equal(P({ state: 'working', poked: true }).body!.anim, 'poke'); assert.equal(P({ state: 'working', poked: true }).body!.origin, 'poke');
assert.equal(P({ state: 'working', poked: true, motion: 'quiet' }).body!.anim, 'bob');
assert.equal(P({ state: 'alert', image: true }).body!.anim, 'hop'); assert.equal(P({ state: 'thinking', image: true }).body!.anim, 'bob'); assert.equal(P({ state: 'idle', image: true }).body, null);
assert.equal(progress({ anim: 'hop', origin: 'bottom', iterations: 2, delay: 0 }, 2700), null); near(progress({ anim: 'blinkIdle', origin: 'center', iterations: Infinity, delay: -1000 }, 500)!, 0.3);
const bx = pathBox('M10 10l5 0 0 5zM2 3h1v-1'); assert.deepEqual(bx, { x0: 2, y0: 2, x1: 15, y1: 15 });
for (const s of PICKER_SHAPES as string[]) { const b = bodyBox(s); assert.ok(b.w > 30 && b.w <= 100 && b.h > 30 && b.h <= 100 && b.x >= 0 && b.y >= 0, s); }
assert.equal(svgTransform({ tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 }, { x: 0, y: 0, w: 10, h: 10 }, 0.5, 1), '');
assert.equal(svgTransform({ tx: 0, ty: -0.1, rot: 0, sx: 1, sy: 1 }, { x: 0, y: 0, w: 10, h: 10 }, 0.5, 1), 'translate(5 9) rotate(0) scale(1 1) translate(-5 -10)');
const ax = animatedXml('whale', (CHARACTER_COLORS as string[])[0], false, 'translate(1 1)', () => 'scale(1 .5)');
assert.ok(ax.includes('<g transform="translate(1 1)">') && ax.includes('transform="scale(1 .5)"') && !ax.includes('var('));
console.log('  ✓ motion: keyframes, easing, botState/toolState, cascade plan, fill-box');

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
