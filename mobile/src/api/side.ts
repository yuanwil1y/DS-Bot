// Side chats (web side-model.js / side-chat.js, ds-bot 0.2.4): pure helpers and zh wording.
export type SideEntry = { id: string; question: string; answer?: string; status: 'answering' | 'done' | 'failed' | 'cancelled'; error?: string | { message?: string }; createdAt?: number; finishedAt?: number };
export type SideChat = { id: string; botId: string; createdAt?: number; updatedAt?: number; entries: SideEntry[] };

export const SIDE = {
  title: '侧边对话',
  close: '关闭侧边对话',
  hint: '不打断当前工作，顺便问一句',
  placeholder: '问问目前做到哪了',
  answering: '正在回答…',
  note: '基于目前已有进展的回答，没有执行任何操作',
  cancel: '取消',
  cancelLabel: '取消这次旁路提问',
  cancelled: '已取消',
  failed: '没能答上。',
  group: '侧边对话只在 Bot 的私聊里可用。',
  empty: '在 /side 后面写上问题。',
};

const HOST: Record<string, string> = {
  'Write a question.': '写上问题。',
  'Write a question after /side.': SIDE.empty,
  "Side chat is only available in a Bot's private chat.": SIDE.group,
  'Wait for the answer, or cancel it.': '等它答完，或者先取消。',
  'This side chat is no longer here.': '这个侧边对话已经不在了。',
  'This side question is no longer here.': '这个侧边提问已经不在了。',
  'This Bot has not called a model yet. Send a normal message first.': '这个 Bot 还没有调用过模型，请先正常发一条消息。',
};
export const sideHostText = (s: string) => HOST[s.trim()] ?? s;

export const sideChatsOf = (state: any, botId?: string): SideChat[] => {
  const v = botId ? state?.sideChats?.[botId] : undefined;
  return Array.isArray(v) ? v : [];
};
export const sideTitle = (chat?: SideChat) => chat?.entries?.[0]?.question?.trim() || SIDE.title;
export function sideFailure(e: SideEntry) {
  const raw = typeof e.error === 'string' ? e.error : e.error?.message;
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s ? sideHostText(s) : SIDE.failed;
}
// `/side` leading token, or null. `/sidechat` is ordinary text; case-sensitive.
export function parseSideLine(line: string) {
  const s = String(line ?? '').trim();
  if (!s.startsWith('/')) return null;
  const gap = s.search(/\s/);
  if ((gap === -1 ? s : s.slice(0, gap)) !== '/side') return null;
  const args = gap === -1 ? '' : s.slice(gap + 1);
  return { args, bare: args.trim() === '' };
}
// The `/` popup offers `side` while the typed head is a prefix of it.
export function sideQuery(text: string): boolean {
  if (!text.startsWith('/') || /\s/.test(text)) return false;
  const head = text.slice(1).toLowerCase();
  return head === '' || 'side'.startsWith(head);
}
// Server entries plus questions still in flight on this device (optimistic), deduped by id.
export function withPending(chat: SideChat | undefined, pending: SideEntry[]): SideEntry[] {
  const list = chat?.entries ?? [];
  const ids = new Set(list.map((e) => e.id));
  const qs = new Set(list.map((e) => e.question));
  return [...list, ...pending.filter((p) => !ids.has(p.id) && !qs.has(p.question))];
}
