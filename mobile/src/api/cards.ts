// Pure helpers for cards (question / view / approval), "needs you" items, member work,
// group events and @mentions. Shared by the app and the Node test.
import type { Approval, BotState, Notice, Question, ViewCard, WorkEntry } from './types';

export type Target = { kind: 'bot' | 'room'; id: string };
export type Cards = { sessionId: string; question?: Question; view?: ViewCard; approvals: Approval[] };

const sessionOf = (st: BotState, t: Target) => (t.kind === 'bot' ? st.bots.find((b) => b.id === t.id)?.sessionId ?? t.id : t.id);

/** Open cards for one chat. Private: the Bot's question/view and approvals outside groups; group: approvals of its members there. */
export function cardsFor(st: BotState | null, t: Target): Cards {
  if (!st) return { sessionId: t.id, approvals: [] };
  const sid = sessionOf(st, t);
  const question = st.questions?.[sid] ?? st.questions?.[t.id] ?? undefined;
  const view = st.views?.[sid] ?? st.views?.[t.id] ?? undefined;
  const approvals = (st.work?.approvals ?? []).filter((a) => (t.kind === 'room' ? a.roomId === t.id : !a.roomId && a.botId === t.id));
  return { sessionId: st.questions?.[sid] || st.views?.[sid] ? sid : t.id, question: question || undefined, view: view || undefined, approvals };
}

export type Need = { key: string; kind: 'question' | 'view' | 'approval'; target: Target; botId: string; text: string; time?: number };

/** Everything waiting on the user right now, newest first (derived from state, so it clears itself). */
export function needsYou(st: BotState | null): Need[] {
  if (!st) return [];
  const out: Need[] = [];
  const botOf = (sid: string) => st.bots.find((b) => b.id === sid || b.sessionId === sid);
  const roomOf = (sid: string) => st.rooms?.find((r) => r.id === sid);
  const where = (sid: string): { target: Target; botId: string } | null => {
    const b = botOf(sid); if (b) return { target: { kind: 'bot', id: b.id }, botId: b.id };
    const r = roomOf(sid); if (r) return { target: { kind: 'room', id: r.id }, botId: r.admin ?? '' };
    return null;
  };
  for (const [sid, q] of Object.entries(st.questions ?? {})) { const w = q && where(sid); if (w) out.push({ key: `q${q.id}`, kind: 'question', ...w, text: q.question, time: q.askedAt }); }
  for (const [sid, v] of Object.entries(st.views ?? {})) { const w = v && where(sid); if (w) out.push({ key: `v${v.id}`, kind: 'view', ...w, text: v.title ?? '', time: v.askedAt }); }
  for (const a of st.work?.approvals ?? []) out.push({ key: `a${a.id}`, kind: 'approval', target: a.roomId ? { kind: 'room', id: a.roomId } : { kind: 'bot', id: a.botId }, botId: a.botId, text: a.detail?.text || a.tool, time: a.at });
  return out.sort((x, y) => (y.time ?? 0) - (x.time ?? 0));
}
/** Count of waiting items per chat id (home list badges). */
export function needsCount(st: BotState | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of needsYou(st)) out[n.target.id] = (out[n.target.id] ?? 0) + 1;
  return out;
}

export type MemberWork = { botId: string; state: 'work' | 'ask'; since?: number; doing?: string; approvals: Approval[] };
/** Members at work (or waiting for approval) in a group. */
export function roomWork(st: BotState | null, roomId: string): MemberWork[] {
  if (!st) return [];
  const map = new Map<string, MemberWork>();
  for (const w of (st.work?.rooms?.[roomId] ?? []) as WorkEntry[]) map.set(w.botId, { botId: w.botId, state: 'work', since: w.since, doing: w.note || w.tool, approvals: [] });
  for (const a of st.work?.approvals ?? []) if (a.roomId === roomId) {
    const m = map.get(a.botId) ?? { botId: a.botId, state: 'ask' as const, approvals: [] };
    m.state = 'ask'; m.approvals.push(a); map.set(a.botId, m);
  }
  return [...map.values()];
}

/** Web UI wording (zh) for a group event row. */
export function eventLabel(e: { event?: string; name?: string; text?: string; count?: number; names?: string[]; code?: string }): string {
  const n = e.name ?? 'Bot';
  switch (e.event) {
    case 'working': return `${n} 开始做了`;
    case 'approval': return `${n} 停下来等你批准`;
    case 'done': return `${n} 做完了`;
    case 'stopped': return `你停下了 ${n} 的工作`;
    case 'failed': return `${n} 没能回答：${e.text || e.code || '出错'}`;
    case 'missed': return `${n} 没有及时回答`;
    case 'lookup': return e.text ? `${n} 查了自己的私聊：“${e.text}”` : `${n} 查了自己的私聊`;
    case 'resumed': return `${n} 被重启打断，已接着做`;
    case 'cut': return `${n} 又被重启打断，停下了`;
    case 'admin-passed': return `${n} 没有回答也没有点名，用 @名字 叫一位成员`;
    case 'paused': return `Bot 之间已接力 ${e.count ?? ''} 次，先停下了。还在等：${(e.names ?? []).join('、')}`;
    case 'schedule': return e.text ? `定时任务：${e.text}` : '定时任务';
    default: return e.text ?? e.event ?? '';
  }
}

/** The "@query" being typed at the end of the composer text, or null. */
export function mentionQuery(text: string): string | null {
  const m = /(^|\s)@([^\s@]*)$/.exec(text);
  return m ? m[2] : null;
}
export function insertMention(text: string, name: string): string {
  return text.replace(/(^|\s)@([^\s@]*)$/, (_, pre) => `${pre}@${name} `);
}
export function mentionCandidates<T extends { name: string }>(members: T[], q: string): T[] {
  const w = q.toLowerCase();
  return members.filter((m) => m.name.toLowerCase().includes(w));
}

/** Notices worth a badge/notification (others are informational). */
export const NEEDS_KINDS = ['question', 'view', 'approval', 'learning', 'browser'];
export function noticeTarget(n: Notice): Target | null {
  if (n.roomId) return { kind: 'room', id: n.roomId };
  return n.botId ? { kind: 'bot', id: n.botId } : null;
}

// group-settings.js: the shown mode is room.mode when the admin is a member Bot, else everyone.
export function shownMode(room: Pick<import('./types').Room, 'admin' | 'mode' | 'members'>, bots: Pick<import('./types').Bot, 'id'>[]): 'admin' | 'everyone' {
  const hasAdmin = !!room.admin && bots.some((b) => b.id === room.admin) && (room.members ?? []).includes(room.admin);
  return hasAdmin ? (room.mode === 'everyone' ? 'everyone' : 'admin') : 'everyone';
}
