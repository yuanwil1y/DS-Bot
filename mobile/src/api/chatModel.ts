// Pure reducer for one private chat: history + feed events -> rendered rows.
// Shared by the app and the Node test.
import type { ChatItem, FeedEvent } from './types';
import { eventLabel } from './cards';

export type ChatRow = { key: string; kind: string; text: string; turn?: number; seq?: number; data?: any; time?: number; streaming?: boolean; pending?: boolean; failed?: boolean; name?: string; botId?: string };
export type Pending = { key: string; text: string; time: number; failed?: boolean };
export type ChatModel = { items: ChatItem[]; drafts: Record<string, string>; pending?: Pending[] };

export const emptyChat = (): ChatModel => ({ items: [], drafts: {} });

export function withHistory(m: ChatModel, items: ChatItem[]): ChatModel {
  return reconcile({ ...m, items: mergeItems(items, m.items) });
}

/** Optimistic: show the user's message before the server echoes it. */
export function addPending(m: ChatModel, text: string, time = Date.now()): ChatModel {
  return { ...m, pending: [...(m.pending ?? []), { key: `p${time}-${Math.random().toString(36).slice(2, 7)}`, text, time }] };
}
export function failPending(m: ChatModel, key: string): ChatModel {
  return { ...m, pending: (m.pending ?? []).map((p) => (p.key === key ? { ...p, failed: true } : p)) };
}
export function dropPending(m: ChatModel, key: string): ChatModel {
  return { ...m, pending: (m.pending ?? []).filter((p) => p.key !== key) };
}
/** Drop pending messages the server now has (same text, a user item at/after send time - 60s clock skew). */
function reconcile(m: ChatModel): ChatModel {
  if (!m.pending?.length) return m;
  const used = new Set<ChatItem>();
  const pending = m.pending.filter((p) => {
    const hit = m.items.find((i) => !used.has(i) && (i.kind === 'user') && i.text?.trim() === p.text.trim() && (i.time ?? Infinity) >= p.time - 60_000);
    if (hit) { used.add(hit); return false; }
    return true;
  });
  return pending.length === m.pending.length ? m : { ...m, pending };
}

function mergeItems(a: ChatItem[], b: ChatItem[]): ChatItem[] {
  const seen = new Map<string, ChatItem>();
  for (const i of [...a, ...b]) seen.set(i.seq != null ? `s${i.seq}-${i.kind}-${i.answers?.[0]?.id ?? ''}` : `t${i.time}-${i.kind}-${i.text ?? i.callId ?? ''}`, i);
  return [...seen.values()].sort((x, y) => (x.seq ?? x.time ?? 0) - (y.seq ?? y.time ?? 0));
}

/** Apply a feed event if it belongs to this bot's private session. */
export function applyFeed(m: ChatModel, sessionId: string, e: FeedEvent): ChatModel {
  const d = e.data as any;
  if (!d || d.sessionId !== sessionId) return m;
  if (e.event === 'message' && d.item) {
    const drafts = d.item.kind === 'bot' ? {} : m.drafts;
    return reconcile({ ...m, items: mergeItems(m.items, [d.item]), drafts });
  }
  if (e.event === 'stream') {
    const drafts = { ...m.drafts };
    if (d.phase === 'start') drafts[d.attemptId] = '';
    else if (d.phase === 'end') delete drafts[d.attemptId];
    else if (typeof d.text === 'string') drafts[d.attemptId] = (drafts[d.attemptId] ?? '') + d.text;
    return { ...m, drafts };
  }
  return m;
}

export function rows(m: ChatModel): ChatRow[] {
  const out: ChatRow[] = m.items
    .filter((i) => i.text || (i.kind === 'view' && i.view !== undefined) || (i.kind === 'answer' && (i.questions?.length || i.views?.length || i.handoff)))
    // An answer to a question, a view or a browser handoff draws its settled card (widget-cell.js AnsweredReply).
    .map((i, n) => ({ key: `i${i.seq ?? n}-${n}`, kind: i.kind, text: i.text ?? '', time: i.time, turn: i.turn, seq: i.seq,
      ...(i.kind === 'view' ? { data: { title: i.title ?? '', view: i.view } }
        : i.kind === 'answer' && i.views?.length ? { data: { views: i.views, answers: i.answers ?? [] } }
        : i.kind === 'answer' && i.handoff ? { data: { handoff: i.handoff } }
          : i.kind === 'answer' && i.questions?.length ? { data: { questions: i.questions, answers: i.answers ?? [] } }
            : i.kind === 'bot' && i.reasoning ? { data: { reasoning: i.reasoning, ms: i.ms } } : {}) }));
  for (const p of m.pending ?? []) out.push({ key: p.key, kind: 'user', text: p.text, time: p.time, pending: true, failed: p.failed });
  for (const [id, text] of Object.entries(m.drafts)) out.push({ key: `d${id}`, kind: 'bot', text, streaming: true });
  return out;
}

// ---- Group chat (room-chat pages; items keyed by id, live rows replaced in place).
export type RoomItem = { id: string; kind: 'user' | 'bot' | 'event' | string; text?: string; time?: number; botId?: string; name?: string; color?: string; event?: string; live?: boolean; code?: string; names?: string[]; count?: number; whole?: { length: number; file: unknown } };
export type RoomModel = { items: RoomItem[]; pending: Pending[]; running?: boolean; speaking?: string[] };
export const emptyRoom = (): RoomModel => ({ items: [], pending: [] });
/** Server sends `speaking` as one botId string (room-chat, room-progress), sometimes an array or nothing. */
export function speakingList(v: unknown): string[] {
  if (typeof v === 'string') return v ? [v] : [];
  if (Array.isArray(v)) return v.flatMap(speakingList);
  return [];
}
export function withRoomPage(m: RoomModel, page: { items: RoomItem[]; running?: boolean; speaking?: unknown }, latest = true): RoomModel {
  const map = new Map<string, RoomItem>();
  // A fresh latest page replaces earlier live rows of the running turn.
  for (const i of m.items) if (!(latest && i.live)) map.set(i.id, i);
  for (const i of page.items) map.set(i.id, i);
  const items = [...map.values()].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  const used = new Set<RoomItem>();
  const pending = m.pending.filter((p) => {
    const hit = items.find((i) => !used.has(i) && i.kind === 'user' && i.text?.trim() === p.text.trim() && (i.time ?? Infinity) >= p.time - 60_000);
    if (hit) { used.add(hit); return false; }
    return true;
  });
  return latest ? { items, pending, running: page.running, speaking: speakingList(page.speaking) } : { ...m, items, pending };
}
export function roomRows(m: RoomModel): ChatRow[] {
  const out: ChatRow[] = m.items.filter((i) => i.kind === 'event' || i.text).map((i) => (i.kind === 'event'
    ? { key: i.id, kind: 'event', text: eventLabel(i), time: i.time, name: i.name, botId: i.botId, data: { event: i.event } }
    : { key: i.id, kind: i.kind, text: i.text ?? '', time: i.time, name: i.name, botId: i.botId, streaming: i.live, ...(i.whole ? { data: { whole: i.whole } } : {}) }));
  for (const p of m.pending) out.push({ key: p.key, kind: 'user', text: p.text, time: p.time, pending: true, failed: p.failed });
  return out;
}

// btw-model.js owningTurn/dockCards/tailCards + learning-card-model.js proposalPlacement,
// on the rows the chat page carries (`turn`, `seq`, `time`). A turn spans from just after
// the previous turn's last seq to its own last seq; the newest turn is open while the Bot
// runs. Cards a closed turn owns go after that turn's last row; the rest stay in the dock.
type Span = { turn: number; start: number; end: number; endTime: number; last: string; closed: boolean };
export function turnSpans(list: ChatRow[], running: boolean): Span[] {
  const by = new Map<number, Span>();
  for (const r of list) {
    if (typeof r.turn !== 'number' || r.pending || r.streaming) continue;
    const s = by.get(r.turn) ?? { turn: r.turn, start: -Infinity, end: -Infinity, endTime: -Infinity, last: r.key, closed: true };
    if (typeof r.seq === 'number' && r.seq >= s.end) { s.end = r.seq; s.last = r.key; } else if (typeof r.seq !== 'number') s.last = r.key;
    if (typeof r.time === 'number') s.endTime = Math.max(s.endTime, r.time);
    by.set(r.turn, s);
  }
  const spans = [...by.values()].sort((a, b) => a.end - b.end);
  spans.forEach((s, n) => { s.start = n === 0 ? -Infinity : spans[n - 1].end + 1; });
  if (running && spans.length) spans[spans.length - 1].closed = false;
  return spans;
}
const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : v && typeof v === 'object' && Number.isFinite(v.seq) ? v.seq : undefined);
export function btwOwner(card: any, spans: Span[]): Span | undefined {
  const turn = Number.isInteger(card?.turn) ? card.turn : Number.isInteger(card?.atTurn) ? card.atTurn : undefined;
  if (turn !== undefined) return spans.find((s) => s.turn === turn);
  const at = num(card?.anchorSeq) ?? num(card?.atSeq);
  if (at === undefined) return undefined;
  return spans.find((s) => at >= s.start && at <= s.end) ?? (num(card?.anchorSeq) === undefined ? [...spans].reverse().find((s) => s.start <= at) : undefined);
}
export function learningOwner(p: any, spans: Span[]): Span | undefined {
  if (!Number.isFinite(p?.at)) return undefined;
  const closed = spans.filter((s) => s.closed && Number.isFinite(s.endTime));
  const later = (a: Span, b?: Span) => !b || a.endTime > b.endTime || (a.endTime === b.endTime && a.turn > b.turn);
  let latest: Span | undefined; let before: Span | undefined;
  for (const s of closed) { if (later(s, latest)) latest = s; if (s.endTime <= p.at && later(s, before)) before = s; }
  return before ?? latest;
}
export function placeCards<B, L>(list: ChatRow[], running: boolean, btw: B[], learning: L[]) {
  const spans = turnSpans(list, running);
  const tails: Record<string, { btw: B[]; learning: L[] }> = {};
  const dock = { btw: [] as B[], learning: [] as L[] };
  const at = (key: string) => (tails[key] ??= { btw: [], learning: [] });
  for (const c of btw) { const o = btwOwner(c, spans); if (o && o.closed) at(o.last).btw.push(c); else dock.btw.push(c); }
  for (const p of learning) { const o = learningOwner(p, spans); if (o) at(o.last).learning.push(p); else dock.learning.push(p); }
  return { tails, dock };
}
