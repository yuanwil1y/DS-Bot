// Pure helpers from about.js / feedback.js / diagnostics.js (ds-bot 0.2.4), zh strings
// from the web's i18n.js.
export const WHAT_MAX = 2000;
const URL_LIMIT = 7000;
const PASTE_NOTE = 'DS Bot copied the diagnostics to the clipboard. Paste them here.';
const REST_NOTE = 'The recent errors do not fit in the link. DS Bot copied the diagnostics to the clipboard: paste them below this line.';

export function issueUrl(base: string, { what = '', diagnostics }: { what?: string; diagnostics: string }) {
  const text = what.trim().slice(0, WHAT_MAX);
  const title = text.split('\n')[0].slice(0, 80);
  const q = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, '+')}`).join('&');
  const build = (body: string) => `${base}?${q({ template: 'bug.yml', ...(title ? { title } : {}), ...(text ? { what: text } : {}), diagnostics: body })}`;
  const full = build(diagnostics);
  if (full.length <= URL_LIMIT) return { url: full, inline: true };
  const facts = build(`${diagnostics.split('\n\n')[0]}\n\n${REST_NOTE}`);
  return { url: facts.length <= URL_LIMIT ? facts : build(PASTE_NOTE), inline: false };
}

const FAILURES: Record<string, string> = {
  AUTH: 'API 密钥无效', QUOTA: '账户额度已用尽', ACCOUNT_QUOTA: '账户额度已用尽', RATE_LIMIT: '模型请求太频繁',
  CONTEXT_WINDOW_EXCEEDED: '对话太长，超出模型上限', INVALID_REQUEST: '模型服务拒绝了请求', SERVER: '模型服务出错',
  TIMEOUT: '模型响应超时', TRANSPORT: '连不上模型服务', SESSION: '它的群聊会话打不开', SESSION_RESET: '它的群聊会话打不开，下次会换一个新的',
};
export const failureLabel = (code?: string, message?: string) => (code && FAILURES[code]) || message || code || '未知错误';

const pad = (n: number) => String(n).padStart(2, '0');
export function whenText(time: number | string, now = new Date()) {
  const d = new Date(time);
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return now.toDateString() === d.toDateString() ? clock : `${d.getMonth() + 1}月${d.getDate()}日 ${clock}`;
}
// Intl compact in zh-CN: 1234 -> 1234, 12345 -> 1.2万.
export function starCount(n: number) {
  if (n < 10_000) return String(n);
  if (n < 100_000_000) return `${+(n / 10_000).toFixed(1)}万`;
  return `${+(n / 100_000_000).toFixed(1)}亿`;
}

export function botHint(u: any): string | null {
  if (u.phase === 'installing') return '正在更新 DS Bot…';
  if (u.phase === 'installed') return `重启 DSH 后开始使用 DS Bot ${u.installed ?? u.latest}。`;
  if (u.phase === 'updated') return `DS Bot ${u.installed ?? u.latest} 已安装。`;
  if (u.phase === 'failed') return `更新没有完成：${u.error ?? ''}`;
  if (u.available) return `DS Bot ${u.latest} 可以更新`;
  if (u.source === 'app') return '随 DeepSeek Bot 应用一起更新。';
  if (u.enabled === false) return '已关闭更新检查。';
  if (u.source === 'path') return '从本地文件夹安装，请在那里更新。';
  if (!u.checkedAt) return null;
  if (!u.latest && u.source !== 'registry') return '这种安装方式不提供更新。';
  return `${u.latest ? '已是最新版本' : '没能检查更新。'} · 检查于 ${whenText(u.checkedAt)}`;
}
export function dshHint(d: any, shown: boolean): string {
  if (d.phase === 'installing') return '正在更新 DSH…';
  if (d.phase === 'installed') return `重启 DSH 后开始使用 DSH ${d.installed ?? d.verified}。`;
  if (d.phase === 'failed') return `更新没有完成：${d.error ?? ''}`;
  if (d.available === false && d.blockedBy) return `先更新 DS Bot ${d.blockedBy}。`;
  if (shown) return `DSH ${d.verified} 可以更新`;
  return `版本 ${d.current}`;
}

// index.js: the web asks update-check (fresh: false) as soon as it starts and keeps the
// answer, so About shows the version, Star and links on entry. The phone does the same
// on connect; About reads this copy first.
export const aboutCache: { update: any; stars: number | null } = { update: null, stars: null };
export function prefetchUpdate(c: { updateCheck(fresh?: boolean): Promise<any> }) {
  return c.updateCheck(false).then((u) => { if (u) aboutCache.update = u; return u; }, () => null);
}
