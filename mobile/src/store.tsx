// App-wide connection state: client, live feed, bot state, unread/working.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { BotClient, Feed, NativeCookieTokenAuth, type BotState, type Connection, type FeedEvent, type FeedStatus } from './api';

const KEY = 'dsbot.connection.v1';
type Listener = (e: FeedEvent) => void;

type Ctx = {
  client: BotClient | null;
  state: BotState | null;
  status: FeedStatus;
  opens: number;
  restoring: boolean;
  unread: Record<string, number>;
  streaming: Record<string, boolean>;
  connect(conn: Connection): Promise<void>;
  disconnect(): Promise<void>;
  refresh(): Promise<void>;
  markRead(botId: string): void;
  subscribe(l: Listener): () => void;
  setOpenBot(id: string | null): void;
};
const C = createContext<Ctx | null>(null);
export const useStore = () => useContext(C)!;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<BotClient | null>(null);
  const [state, setState] = useState<BotState | null>(null);
  const [status, setStatus] = useState<FeedStatus>('closed');
  const [opens, setOpens] = useState(0);
  const [restoring, setRestoring] = useState(true);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [streaming, setStreaming] = useState<Record<string, boolean>>({});
  const feed = useRef<Feed | null>(null);
  const listeners = useRef(new Set<Listener>());
  const openBot = useRef<string | null>(null);
  const clientRef = useRef<BotClient | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const c = clientRef.current; if (!c) return;
    try { setState(await c.state()); } catch {}
  }, []);
  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => { refreshTimer.current = null; refresh(); }, 400);
  }, [refresh]);

  const onEvent = useCallback((e: FeedEvent) => {
    const d = e.data as any;
    if (e.event === 'revision' || e.event === 'hello') refreshSoon();
    if (e.event === 'stream' && d?.botId) setStreaming((s) => ({ ...s, [d.botId]: d.phase !== 'end' }));
    if (e.event === 'notice' && d?.kind === 'message' && d.botId && d.botId !== openBot.current)
      setUnread((u) => ({ ...u, [d.botId]: (u[d.botId] ?? 0) + 1 }));
    listeners.current.forEach((l) => l(e));
  }, [refreshSoon]);

  const start = useCallback(async (conn: Connection) => {
    const c = new BotClient(conn, new NativeCookieTokenAuth());
    await c.connect();
    feed.current?.stop();
    clientRef.current = c;
    setClient(c);
    setState(await c.state());
    const f = new Feed(conn, c.auth, onEvent, (s, n) => { setStatus(s); setOpens(n); });
    feed.current = f; f.start();
  }, [onEvent]);

  const connect = useCallback(async (conn: Connection) => {
    await start(conn);
    await SecureStore.setItemAsync(KEY, JSON.stringify(conn));
  }, [start]);

  const disconnect = useCallback(async () => {
    feed.current?.stop(); feed.current = null; clientRef.current = null;
    setClient(null); setState(null);
    await SecureStore.deleteItemAsync(KEY);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(KEY);
        if (saved) await start(JSON.parse(saved));
      } catch {} finally { setRestoring(false); }
    })();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { feed.current?.kick(); refresh(); } });
    return () => { sub.remove(); feed.current?.stop(); };
  }, [start, refresh]);

  const value: Ctx = {
    client, state, status, opens, restoring, unread, streaming, connect, disconnect, refresh,
    markRead: (id) => setUnread((u) => ({ ...u, [id]: 0 })),
    subscribe: (l) => { listeners.current.add(l); return () => { listeners.current.delete(l); }; },
    setOpenBot: (id) => { openBot.current = id; },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
