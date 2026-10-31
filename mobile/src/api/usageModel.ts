// usage-page.js (0.2.4) labels and the overview/focus shaping, without the DOM.
// Dates are formatted by hand in the web's zh-CN shapes (Intl on the phone is partial).
import { DAY_MS, HOUR, HOUR_MS, MODEL, OWNER, RANGES, compact, dayKey, hourMs, percent, spanRange, summarize, tokensOf } from './usageData';
import { mix } from '../appearance';

export { RANGES, compact, percent, spanRange, dayKey, hourMs, DAY_MS };
export const HEAT_WEEKS = 53;
export const TOP_SERIES = 7;

export type UsageRow = [string, number, number, number, number, number, number, number, number];
export type UsageOwner = { key: string; kind: 'bot' | 'room' | 'agent' | 'other'; id?: string; name?: string; deleted?: boolean };
export type UsageModelInfo = { key: string; name?: string; model?: string; provider?: string; providerName?: string };
export type UsageView = { now: string; rows: UsageRow[]; owners: UsageOwner[]; models: UsageModelInfo[]; kinds: string[]; scanning?: boolean };
export type Range = { id: string; unit: 'hour' | 'day' | 'week' | 'month'; count: number; stride: number; from?: string; to?: string; days?: number; ends?: boolean };
export type Focus = { kind: 'owner' | 'model'; key: string } | null;

export const rangeLabel = (id: string) => (({ '24h': '24 小时', '7d': '7 天', '30d': '30 天', '12w': '12 周', '12m': '12 个月' }) as Record<string, string>)[id];
export const unitLabel = (unit: string) => (({ hour: '按小时', day: '按天', week: '按周', month: '按月' }) as Record<string, string>)[unit];
export const MODEL_INKS = ['deepseek', 'tangerine', 'green', 'violet', 'sky', 'rose', 'yellow', 'cyan', 'magenta', 'brown'];
export const PARTS: [string, number][] = [['output', 1], ['input', 0.6], ['cacheRead', 0.32]];
export const partLabel = (p: string) => (({ output: '输出', input: '输入', cacheRead: '缓存命中' }) as Record<string, string>)[p];

export const full = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const hitRate = (s: { cacheRead: number; input: number }) => percent(s.cacheRead, s.input + s.cacheRead);

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const u = (ms: number) => new Date(ms);
const yearOf = (ms: number) => u(ms).getUTCFullYear();
const md = (ms: number) => `${u(ms).getUTCMonth() + 1}月${u(ms).getUTCDate()}日`;
const ymd = (ms: number) => `${yearOf(ms)}年${md(ms)}`;
export const numDay = (ms: number) => `${u(ms).getUTCMonth() + 1}/${u(ms).getUTCDate()}`;
export const monthShort = (ms: number) => `${u(ms).getUTCMonth() + 1}月`;
export const yearMonth = (ms: number) => `${yearOf(ms)}年${u(ms).getUTCMonth() + 1}月`;
export const dayLong = (ms: number) => `${md(ms)}周${WEEK[u(ms).getUTCDay()]}`;
export const hourText = (ms: number) => `${String(u(ms).getUTCHours()).padStart(2, '0')}:00`;

export function spanText(from: string, to: string, thisYear = new Date().getFullYear()) {
  const start = hourMs(from); const end = hourMs(to);
  const f = yearOf(start) !== thisYear || yearOf(end) !== thisYear ? ymd : md;
  return from === to ? f(start) : `${f(start)} – ${f(end)}`;
}
export const daysText = (n: number) => `${n} 天`;
export const lastText = (r: Range) => (r.from ? spanText(r.from, r.to!) : `最近 ${rangeLabel(r.id)}`);
export const compareText = (r: Range) => (!r.from ? `与再往前 ${rangeLabel(r.id)} 相比` : r.days === 1 ? '与前一天相比' : `与再往前 ${r.days} 天相比`);
export function tickOf(r: Range, b: { start: number }) {
  if (r.unit === 'hour') return (r.days ?? 0) > 1 && u(b.start).getUTCHours() === 0 ? numDay(b.start) : hourText(b.start);
  if (r.unit === 'month') return monthShort(b.start);
  return numDay(b.start);
}
export function titleOf(r: Range, b: { start: number; end?: number }) {
  if (r.unit === 'hour') return `${md(b.start)} ${hourText(b.start)}–${hourText(b.start + HOUR_MS)}`;
  if (r.unit === 'day') return dayLong(b.start);
  if (r.unit === 'week') return spanText(dayKey(b.start), dayKey((b.end ?? b.start + 7 * DAY_MS) - DAY_MS));
  if (b.end && (u(b.start).getUTCDate() !== 1 || u(b.end).getUTCDate() !== 1)) return spanText(dayKey(b.start), dayKey(b.end - DAY_MS));
  return yearMonth(b.start);
}
export function kindLabel(kind: string, botFocus: boolean) {
  const labels: Record<string, string> = { chat: botFocus ? '单聊' : '对话', group: '群聊', compaction: '压缩与交接', image: '识图', memory: '记忆', 'session-title': '标题', btw: '侧边对话', side: '侧边对话', other: '其他' };
  return labels[kind] ?? kind;
}
export const niceTop = (max: number) => {
  if (!(max > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * step).find((v) => v >= max)!;
};
export const focusOf = (id?: string | null): Focus => (typeof id !== 'string' ? null
  : id.startsWith('model:') ? { kind: 'model', key: id.slice(6) } : id.startsWith('owner:') ? { kind: 'owner', key: id.slice(6) } : null);

/** color-mix(in srgb, paint 88*s%, card) — the web's soften(). */
export const soften = (paint: string, card: string, s = 1) => mix(paint, Math.round(88 * s) / 100, card);

export type Face = { kind: string; name: string; sub: string; paint: string; id?: string };
export type Colors = { card: string; text: string; accent: string; botPaint(id: string | undefined): string; botName(id: string | undefined): string | undefined; botRole(id: string | undefined): string; ink(name: string): string };

export function ownerFace(o: UsageOwner, c: Colors): Face {
  const rest = mix(c.text, 0.3, c.card);
  if (o.kind === 'bot') {
    const name = c.botName(o.id) || o.name || '已删除的 Bot';
    const role = c.botRole(o.id).trim();
    return { kind: 'bot', id: o.id, name, sub: o.deleted ? '已删除' : role.toLowerCase() === name.toLowerCase() ? '' : role, paint: c.botPaint(o.id) };
  }
  if (o.kind === 'room') return { kind: 'room', id: o.id, name: o.name || '已删除的群聊', sub: o.deleted ? '已删除' : '群聊', paint: rest };
  if (o.kind === 'agent') return { kind: 'agent', id: o.id, name: o.name || 'DSH Agent', sub: o.deleted ? '已删除' : '', paint: rest };
  return { kind: 'other', name: '其他', sub: '', paint: rest };
}

/** The page's data for a range, `by`, and focus: usage-page.js UsagePage's useMemo. */
export function shape(view: UsageView, range: Range, by: 'bot' | 'model', focus: Focus, c: Colors) {
  const restPaint = mix(c.text, 0.3, c.card);
  const morePaint = mix(c.text, 0.16, c.card);
  const faces = view.owners.map((o) => ownerFace(o, c));
  const lifetime = new Map<number, number>();
  for (const row of view.rows) lifetime.set(row[MODEL] as any, (lifetime.get(row[MODEL] as any) ?? 0) + tokensOf(row));
  const modelPaint = new Map([...lifetime].sort((a, b) => b[1] - a[1]).map(([m], rank) => [m, c.ink(MODEL_INKS[rank % MODEL_INKS.length])]));
  const models: Face[] = view.models.map((m, at) => ({ kind: 'model', name: m.name || m.model || '未知模型', sub: m.providerName ?? m.provider ?? '', paint: modelPaint.get(at) ?? restPaint }));
  const ownerAt = focus?.kind === 'owner' ? view.owners.findIndex((o) => o.key === focus.key) : -1;
  const modelAt = focus?.kind === 'model' ? view.models.findIndex((m) => m.key === focus.key) : -1;
  const isBot = (at: number) => ['bot', 'agent'].includes(view.owners[at]?.kind);
  const all = (summarize as any)(view, range, undefined, (row: any) => (by === 'bot' ? (isBot(row[OWNER]) ? `o${row[OWNER]}` : 'rest') : `m${row[MODEL]}`));
  const keep = ownerAt >= 0 ? (row: any) => row[OWNER] === ownerAt : modelAt >= 0 ? (row: any) => row[MODEL] === modelAt : () => true;
  const face = ownerAt >= 0 ? faces[ownerAt] : modelAt >= 0 ? models[modelAt] : null;
  const part = face ? (summarize as any)(view, range, keep) : all;
  const activeDays = new Set<string>();
  let first = view.now;
  for (const row of view.rows) {
    if (row[HOUR] < first) first = row[HOUR];
    if (keep(row) && tokensOf(row) > 0) activeDays.add(row[HOUR].slice(0, 10));
  }
  const ranked = (map: Map<any, any>) => [...map].filter(([, s]) => s.total > 0).sort((a, b) => b[1].total - a[1].total) as [number, any][];
  let series: { key: string; name: string; paint: string; fill?: string; pick?: Focus }[];
  if (face) series = [{ key: 'all', name: face.name, paint: face.paint, fill: soften(face.paint, c.card) }];
  else {
    if (by === 'bot') {
      const bots = ranked(all.owners).filter(([at]) => isBot(at));
      series = bots.slice(0, TOP_SERIES).map(([at]) => ({ key: `o${at}`, name: faces[at].name, paint: faces[at].paint, pick: { kind: 'owner', key: view.owners[at].key } }));
      if (bots.length > TOP_SERIES) series.push({ key: 'more', name: '其余 Bot', paint: morePaint });
      if (ranked(all.owners).some(([at]) => !isBot(at))) series.push({ key: 'rest', name: '其他', paint: restPaint });
    } else {
      const used = ranked(all.models);
      series = used.slice(0, TOP_SERIES).map(([at]) => ({ key: `m${at}`, name: models[at].name, paint: models[at].paint, pick: { kind: 'model', key: view.models[at].key } }));
      if (used.length > TOP_SERIES) series.push({ key: 'more', name: '其余模型', paint: morePaint });
    }
    const repeats = new Map<string, number>();
    for (const e of series) { const seen = repeats.get(e.paint) ?? 0; repeats.set(e.paint, seen + 1); e.fill = soften(e.paint, c.card, [1, 0.6, 0.36][seen % 3]); }
  }
  const tipSeries = face ? PARTS.map(([key, s]) => ({ key, name: partLabel(key), fill: soften(face.paint, c.card, s) })) : series;
  const fillOf = new Map(series.map((e) => [e.key, e.fill!]));
  const shownKeys = new Set(series.map((e) => e.key));
  const columns = part.buckets.map((b: any) => {
    const parts: [string, number][] = face ? [['all', b.sum.total]]
      : series.map((e) => [e.key, e.key === 'more' ? [...b.stacks].filter(([k]: any) => k !== 'rest' && !shownKeys.has(k)).reduce((s: number, [, v]: any) => s + v, 0) : b.stacks.get(e.key) ?? 0]);
    const tip = face ? PARTS.map(([k]) => [k, b.sum[k]] as [string, number]) : parts;
    return { key: b.key, tick: tickOf(range, b), title: titleOf(range, b), total: b.sum.total as number, parts, tip };
  });
  return { faces, models, ownerAt, modelAt, face, keep, all, part, series, tipSeries, fillOf, columns, ranked, isBot, activeDays, first };
}

/** Heat: each day of the last 53 weeks (Monday first), level 0–4 as the web's sqrt scale. */
export function heat(view: UsageView, keep: (row: any) => boolean) {
  const today = hourMs(`${view.now.slice(0, 10)} 00`);
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;
  const first = monday - (HEAT_WEEKS - 1) * 7 * DAY_MS;
  const from = dayKey(first);
  const daily = new Map<string, number>();
  for (const row of view.rows) {
    const day = row[HOUR].slice(0, 10);
    if (day >= from && keep(row)) daily.set(day, (daily.get(day) ?? 0) + tokensOf(row));
  }
  const most = Math.max(0, ...daily.values());
  const weeks: { ms: number; value: number; level: number; future: boolean; today: boolean }[][] = [];
  const months: { week: number; label: string }[] = [];
  for (let w = 0; w < HEAT_WEEKS; w += 1) {
    const mon = first + w * 7 * DAY_MS;
    if (w > 0 && new Date(mon).getUTCMonth() !== new Date(mon - 7 * DAY_MS).getUTCMonth()) months.push({ week: w, label: monthShort(mon) });
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const ms = mon + d * DAY_MS;
      const value = daily.get(dayKey(ms)) ?? 0;
      days.push({ ms, value, level: value > 0 ? Math.max(1, Math.ceil(4 * Math.sqrt(value / most))) : 0, future: ms > today, today: ms === today });
    }
    weeks.push(days);
  }
  const active = [...daily.values()].filter((v) => v > 0).length;
  return { weeks, months, active, summary: active === 1 ? '近一年有 1 天在用' : `近一年有 ${active} 天在用` };
}
export const HEAT_LEVELS = [0.3, 0.52, 0.76, 1];
export { tokensOf };
