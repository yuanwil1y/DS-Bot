// Device preferences (language, theme), kept in SecureStore.
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setLang } from './i18n';
export type Prefs = { lang: 'auto' | 'zh' | 'en'; theme: 'auto' | 'dark' | 'light' };
const KEY = 'dsbot.prefs.v1';
const D: Prefs = { lang: 'auto', theme: 'dark' };
const C = createContext<Prefs & { set(p: Partial<Prefs>): void }>({ ...D, set: () => {} });
export const usePrefs = () => useContext(C);
export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<Prefs>(D);
  useEffect(() => { SecureStore.getItemAsync(KEY).then((s) => { if (s) { const v = { ...D, ...JSON.parse(s) }; setLang(v.lang); setP(v); } }).catch(() => {}); }, []);
  const set = (q: Partial<Prefs>) => setP((cur) => { const v = { ...cur, ...q }; setLang(v.lang); SecureStore.setItemAsync(KEY, JSON.stringify(v)).catch(() => {}); return v; });
  return <C.Provider value={{ ...p, set }}>{children}</C.Provider>;
}
