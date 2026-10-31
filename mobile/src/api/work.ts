// web cells.js workPhrase/toolActivity labels (zh), used by list previews and work lines.
const TOOL_PHRASES: [RegExp, string][] = [
  [/web_?search|search_?web/i, '上网搜索'],
  [/fetch|browse|browser|web/i, '阅读网页'],
  [/shell|bash|pwsh|powershell|exec|command|terminal/i, '运行命令'],
  [/^(read|view|cat)\b|read_/i, '打开文件'],
  [/grep|glob|list_dir|^ls$|find|search/i, '查找文件'],
  [/write|edit|patch|apply|replace/i, '写入修改'],
  [/image|photo|draw/i, '处理图片'],
];
const FIXED: Record<string, string> = {
  list_secrets: '查看密钥', ask_user_question: '等你回答', message_bot: '询问其他 Bot', stop_bot: '叫停其他 Bot',
  create_bot: '创建 一个 Bot', update_bot: '更新 一个 Bot', list_bots: '查看团队', read_group_chat: '阅读 一个群聊',
  read_own_chat: '翻看聊天记录', remember: '正在记下', forget: '正在更新记忆', recall: '正在查看记忆',
  create_group: '创建群聊', update_group: '更新群聊', delete_group: '删除群聊', post_to_group: '在群里发言',
};
export type Doing = { tool?: string; said?: string; note?: string; target?: string; switching?: boolean; folder?: boolean } | string | undefined | null;
export function workPhrase(doing: Doing): string {
  const d = typeof doing === 'string' ? { tool: doing } : doing ?? {};
  if (d.switching) return d.folder === true ? '正在切换工作文件夹' : '整理记忆，换到新对话';
  const own = (d.said || d.note)?.replace(/[\s.。…]+$/u, '');
  if (own) return own;
  if (!d.tool) return '想一想';
  const label = FIXED[d.tool] ?? TOOL_PHRASES.find(([p]) => p.test(d.tool!))?.[1] ?? '在做了';
  return d.target ? `${label} · ${d.target}` : label;
}
export const workLine = (lead: string, doing: Doing, more: number) => `${lead} · ${workPhrase(doing)}…${more > 0 ? ` +${more}` : ''}`;
export const PHRASES = { thinking: ['想一想', '权衡一下', '理一下思路', '梳理细节'], working: ['在做了', '正在处理', '推进中', '处理中', '有进展了'] };
export function elapsedLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  return `${hours > 0 ? `${hours}h ` : ''}${total >= 60 ? `${Math.floor(total / 60) % 60}m ` : ''}${total % 60}s`;
}

// web member-status.js memberWork / busyMembers / summaryText / dockModel.
export type MemberEntry = { id: string; approvals: any[]; doing: any; here: boolean; state: 'ask' | 'work' | 'idle' };
export function memberWork(room: { id: string; members?: string[] }, work: any = {}): MemberEntry[] {
  const here: any[] = work?.rooms?.[room.id] ?? [];
  return (room.members ?? []).map((id) => {
    const approvals = (work?.approvals ?? []).filter((a: any) => a.botId === id);
    const local = here.find((e) => e.botId === id);
    const doing = local ? { ...local, roomId: room.id } : work?.bots?.[id];
    return { id, approvals, doing, here: local !== undefined, state: approvals.length > 0 ? 'ask' : doing ? 'work' : 'idle' };
  });
}
export function busyMembers(room: any, work: any, byId: Record<string, any>) {
  const busy = memberWork(room, work).filter((e) => e.state !== 'idle' && byId[e.id]);
  return [...busy.filter((e) => e.state === 'ask'), ...busy.filter((e) => e.state === 'work')].map((e) => ({ ...e, bot: byId[e.id] }));
}
export function summaryText(busy: (MemberEntry & { bot: any })[]) {
  const asks = busy.filter((e) => e.state === 'ask');
  const workers = busy.filter((e) => e.state === 'work');
  const n = asks.slice(0, 2).map((e) => e.bot.name);
  const waiting = asks.length === 0 ? '' : asks.length === 1 ? `${n[0]} 等你批准` : asks.length === 2 ? `${n[0]}、${n[1]} 等你批准` : `${n[0]}、${n[1]} 等 ${asks.length} 个等你批准`;
  const first = workers[0];
  const doing = first ? `${first.bot.name} · ${workPhrase(first.doing)}…${workers.length > 1 ? ` +${workers.length - 1}` : ''}` : '';
  return { waiting, doing };
}
export type Dock = { open: { details?: string; session?: string }; faces: { id: string; ask: boolean }[]; waiting: string; doing: string };
export function dockModel(sessionId: string, byId: Record<string, any>, rooms: any[], work: any = {}): Dock | null {
  const room = rooms.find((r) => r.id === sessionId);
  if (room) {
    // The round's current speaker is left out: its round shows it.
    const busy = busyMembers(room, work, byId).filter((e) => !(e.state === 'work' && e.here && e.doing?.speaking === true));
    if (!busy.length) return null;
    return { open: { details: room.id }, faces: busy.slice(0, 3).map((e) => ({ id: e.id, ask: e.state === 'ask' })), ...summaryText(busy) };
  }
  const bot = byId[sessionId];
  if (!bot || (work?.bots?.[bot.id] !== undefined && work.bots[bot.id].roomId === undefined)) return null;
  const groups = Object.entries(work?.rooms ?? {}).flatMap(([roomId, entries]: [string, any]) => {
    const entry = entries.find((x: any) => x.botId === bot.id); const r = rooms.find((x) => x.id === roomId);
    return entry && r ? [{ room: r, doing: entry }] : [];
  });
  if (!groups.length) return null;
  const [g] = groups;
  return { open: { session: g.room.id }, faces: [{ id: bot.id, ask: false }], waiting: '', doing: `在 ${g.room.name} · ${workPhrase(g.doing)}…${groups.length > 1 ? ` +${groups.length - 1}` : ''}` };
}
