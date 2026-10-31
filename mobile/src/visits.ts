// index.js beginVisit / leaveVisits on the phone: when each conversation was last left,
// kept on this device. A visit compares what arrived against it.
import * as SecureStore from 'expo-secure-store';

const keyOf = (id: string) => `seen.${id.replace(/[^A-Za-z0-9._-]/g, '_')}`;
export const loadSeen = (id: string) => SecureStore.getItemAsync(keyOf(id)).then((s) => (s && Number.isFinite(Number(s)) ? Number(s) : null), () => null);
export const leaveVisit = (id: string) => { SecureStore.setItemAsync(keyOf(id), String(Date.now())).catch(() => {}); };
export type Visit = { seen: number | null; entered: number };
// cells.js unseenSince.
export const unseenSince = (v: Visit | null, time?: number) => !!v && typeof v.seen === 'number' && typeof time === 'number' && time > v.seen && time <= v.entered;
// The rows (oldest first) since the last visit: the divider sits before the first, and
// the count is the replies that began after it (one per run of non-user rows).
export function unreadOf<R extends { key: string; kind: string; time?: number; pending?: boolean; streaming?: boolean }>(rows: R[], v: Visit | null) {
  let first: string | null = null; let count = 0; let inRun = false;
  for (const r of rows) {
    const fresh = !r.pending && !r.streaming && unseenSince(v, r.time);
    if (fresh && first === null) first = r.key;
    if (fresh && r.kind !== 'user' && r.kind !== 'answer') { if (!inRun) count += 1; inRun = true; } else if (r.kind === 'user') inRun = false;
  }
  return { first, count };
}
