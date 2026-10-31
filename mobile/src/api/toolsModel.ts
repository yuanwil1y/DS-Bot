// Pure parts of ds-bot 0.2.4 browser-settings.js, connectors.js and capability-settings.js.
export const ACTIONS: [string, string][] = [['post', '发布'], ['upload', '上传'], ['download', '下载'], ['delete', '删除']];
export const DURATIONS: [string, string][] = [['hour', '1 小时'], ['today', '今天'], ['week', '7 天'], ['permanent', '永久']];
export type Grant = { site: string; kinds: string[]; until?: number };
export const expired = (g: Grant, now = Date.now()) => Number.isFinite(g.until) && (g.until as number) <= now;
export function siteValue(value: string) {
  return value.trim().toLowerCase().replace(/^[a-z][a-z\d+.-]*:\/\//, '').split(/[/?#]/, 1)[0].replace(/:\d+$/, '') || '*';
}
const p2 = (n: number) => String(n).padStart(2, '0');
/** zh-CN { dateStyle: 'medium', timeStyle: 'short' }: 2026年10月31日 21:36 */
export const mediumTime = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export function grantTime(g: Grant, now = Date.now()) {
  if (!Number.isFinite(g.until)) return '永久';
  if ((g.until as number) <= now) return '已过期';
  return `截至 ${mediumTime(g.until as number)}`;
}
export const grantKinds = (g: Grant) => (g.kinds.includes('*') ? ['全部四项'] : ACTIONS.filter(([k]) => g.kinds.includes(k)).map(([, l]) => l));
export function untilOf(duration: string, now = Date.now()) {
  if (duration === 'hour') return now + 60 * 60 * 1000;
  if (duration === 'today') { const end = new Date(now); end.setHours(23, 59, 59, 999); return end.getTime(); }
  if (duration === 'week') return now + 7 * 24 * 60 * 60 * 1000;
  return undefined;
}
export function newGrant(site: string, kinds: string[], duration: string, now = Date.now()): Grant {
  const until = untilOf(duration, now);
  return { site: siteValue(site), kinds: [...kinds], ...(until !== undefined ? { until } : {}) };
}
export const addGrants = (cur: Grant[] | undefined, g: Grant, now = Date.now()) => [...(cur ?? []).filter((x) => !expired(x, now)), g];
export function removeGrants(cur: Grant[] | undefined, index: number, now = Date.now()) {
  const next = (cur ?? []).filter((g, at) => at !== index && !expired(g, now));
  return next.length ? next : null;
}

export const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
const ABOUT: Record<string, string> = { github: '仓库、issue 和 PR' };
export function connectorStatus(c: { id: string; state: string; error?: string; account?: string }) {
  if (c.state === 'connecting') return '正在连接…';
  if (c.state === 'error') return `连接失败：${c.error ?? ''}`;
  if (c.state === 'ready') return c.account ? `已连接：${c.account}` : '已连接';
  return ABOUT[c.id] ?? '';
}

export type Draft = { name: string; kind: string; description: string; transport: string; command: string; argsText: string; envText: string; url: string; headersText: string; content: string; items: string[]; originalName?: string };
export const blank = (): Draft => ({ name: '', kind: 'mcp', description: '', transport: 'stdio', command: '', argsText: '', envText: '{}', url: '', headersText: '{}', content: '', items: [] });
export function parseMap(text: string, label: string) {
  let value: any;
  try { value = JSON.parse(text || '{}'); } catch { throw new Error(`${label}必须是有效的 JSON。`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}必须是 JSON 对象。`);
  return value;
}
/** CapabilityForm submit: the capability-save payload, or throws the web's JSON error. */
export function capabilityPayload(d: Draft) {
  const p: any = { name: d.name.trim(), kind: d.kind, description: d.description };
  if (d.kind === 'mcp' && d.transport === 'stdio') { p.transport = 'stdio'; p.command = d.command; p.args = d.argsText.split('\n').filter((l) => l !== ''); p.env = parseMap(d.envText, '环境变量'); }
  else if (d.kind === 'mcp') { p.transport = 'streamable-http'; p.url = d.url; p.headers = parseMap(d.headersText, '请求头'); }
  else if (d.kind === 'skill') p.content = d.content;
  else p.items = d.items;
  return p;
}
export const editDraft = (item: any): Draft => ({ ...blank(), ...item, originalName: item.name, argsText: (item.args ?? []).join('\n'), envText: JSON.stringify(item.env ?? {}, null, 2), headersText: JSON.stringify(item.headers ?? {}, null, 2), items: [...(item.items ?? [])] });
export function capabilitySecondary(item: any) {
  const detail = item.kind === 'pack' ? `能力包: ${(item.items ?? []).join(', ') || '没有项目'}` : item.kind === 'mcp' ? (item.transport === 'stdio' ? '本地命令' : 'HTTP 服务') : '技能';
  return item.kind === 'pack' ? [item.description, (item.items ?? []).join(', ') || '没有项目'].filter(Boolean).join(' · ') : item.description || detail;
}
export const sortCapabilities = (list: any[] | undefined) => [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name));
