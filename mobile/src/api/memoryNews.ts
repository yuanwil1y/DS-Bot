// index.js noteMemoryNews / text.js latestMemoryChange: per Bot, its latest memory
// change and `seen`, when this app first saw it (0 for a change from before it opened).
export type MemoryNews = Record<string, { at?: number; seen: number }>;
let key: string | undefined;
let news: MemoryNews = {};
export function noteMemoryNews(next: Record<string, { at?: number }> | undefined, now = Date.now()): MemoryNews {
  const k = JSON.stringify(next ?? {});
  if (k === key) return news;
  const opening = key === undefined;
  key = k;
  news = Object.fromEntries(Object.entries(next ?? {}).map(([id, e]) => [id, news[id]?.at === e.at ? news[id] : { ...e, seen: opening ? 0 : now }]));
  return news;
}
export function resetMemoryNews() { key = undefined; news = {}; }
export const memoryNews = () => news;
export function latestMemoryChange(map: MemoryNews, ids: string[]) {
  const at = (id: string | null) => (id && map?.[id]?.seen ? map[id].at ?? 0 : 0);
  return ids.reduce<string | null>((best, id) => (at(id) > at(best) ? id : best), ids[0] ?? null);
}
export const MEMORY_NOTICE_MS = 3_200;
