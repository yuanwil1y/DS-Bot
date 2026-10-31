// Team appearance prefs (ds-bot web `state.prefs`): read from server state, written with
// `set-prefs`, cached in SecureStore only to paint the first frame (web: localStorage boot cache).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useStore } from './store';
import { applyPrefs, resolvePrefs } from './appearance';
const KEY = 'dsbot.teamPrefs.v1';
type Raw = Record<string, unknown>;
type Ctx = { prefs: Raw; resolved: ReturnType<typeof resolvePrefs>; readOnly: boolean; set(patch: Raw): Promise<void> };
const C = createContext<Ctx>({ prefs: {}, resolved: resolvePrefs({}), readOnly: true, set: async () => {} });
export const useTeamPrefs = () => useContext(C);
export function TeamPrefsProvider({ children }: { children: React.ReactNode }) {
  const { client, state, refresh } = useStore();
  const [cache, setCache] = useState<Raw>({});
  const [pending, setPending] = useState<Raw | null>(null);
  useEffect(() => { SecureStore.getItemAsync(KEY).then((s) => { if (s) setCache(JSON.parse(s)); }).catch(() => {}); }, []);
  const server = (state as any)?.prefs as Raw | undefined;
  useEffect(() => { if (server) { setCache(server); setPending(null); SecureStore.setItemAsync(KEY, JSON.stringify(server)).catch(() => {}); } }, [JSON.stringify(server ?? null)]);
  const prefs = pending ?? server ?? cache;
  const readOnly = !client || !!state?.readOnly;
  const set = useCallback(async (patch: Raw) => {
    if (!client || state?.readOnly) return;
    setPending((p) => applyPrefs(p ?? server ?? cache, patch));
    try { await client.call<any>('set-prefs', patch); } catch (e) { setPending(null); throw e; } finally { refresh(); }
  }, [client, state?.readOnly, server, cache, refresh]);
  const value = useMemo(() => ({ prefs, resolved: resolvePrefs(prefs), readOnly, set }), [prefs, readOnly, set]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
