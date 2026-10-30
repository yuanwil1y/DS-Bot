// Pure reducer for one private chat: history + feed events -> rendered rows.
// Shared by the app and the Node test.
import type { ChatItem, FeedEvent } from './types';

export type ChatRow = { key: string; kind: string; text: string; time?: number; streaming?: boolean };
export type ChatModel = { items: ChatItem[]; drafts: Record<string, string> };

export const emptyChat = (): ChatModel => ({ items: [], drafts: {} });

export function withHistory(m: ChatModel, items: ChatItem[]): ChatModel {
  return { ...m, items: mergeItems(items, m.items) };
}

function mergeItems(a: ChatItem[], b: ChatItem[]): ChatItem[] {
  const seen = new Map<string, ChatItem>();
  for (const i of [...a, ...b]) seen.set(i.seq != null ? `s${i.seq}` : `t${i.time}-${i.kind}-${i.text}`, i);
  return [...seen.values()].sort((x, y) => (x.seq ?? x.time ?? 0) - (y.seq ?? y.time ?? 0));
}

/** Apply a feed event if it belongs to this bot's private session. */
export function applyFeed(m: ChatModel, sessionId: string, e: FeedEvent): ChatModel {
  const d = e.data as any;
  if (!d || d.sessionId !== sessionId) return m;
  if (e.event === 'message' && d.item) {
    const drafts = d.item.kind === 'bot' ? {} : m.drafts;
    return { items: mergeItems(m.items, [d.item]), drafts };
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
    .filter((i) => i.text)
    .map((i, n) => ({ key: `i${i.seq ?? n}`, kind: i.kind, text: i.text ?? '', time: i.time }));
  for (const [id, text] of Object.entries(m.drafts)) out.push({ key: `d${id}`, kind: 'bot', text, streaming: true });
  return out;
}
