// App-wide connection state: client, live feed, bot state, unread/working.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { BotClient, Feed, noteMemoryNews, resetMemoryNews, NativeCookieTokenAuth, type BotState, type Connection, type FeedEvent, type FeedStatus, type Notice } from './api';

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
  waiting: Record<string, boolean>;
  previews: Record<string, { text: string; time?: number; who?: string }>;
  notices: Notice[];
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
  const [waiting, setWaiting] = useState<Record<string, boolean>>({});
  const [previews, setPreviews] = useState<Ctx['previews']>({});
  const [notices, setNotices] = useState<Notice[]>([]);
  const cursor = useRef<{ boot?: string; seq?: number }>({});
  const feed = useRef<Feed | null>(null);
  const listeners = useRef(new Set<Listener>());
  const openBot = useRef<string | null>(null);
  const clientRef = useRef<BotClient | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Note memory news as each state lands, even while no chat shows it.
  useEffect(() => { if (state) noteMemoryNews(state.memoryNews); }, [state]);
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
    if (e.event === 'revision' || e.event === 'hello' || e.event === 'live') refreshSoon();
    if (e.event === 'hello' && d) {
      // Reconnect: fill notices missed while offline (reset = server restarted or overflowed).
      const c = clientRef.current, prev = cursor.current;
      if (c && prev.boot) c.notices(prev.boot, prev.seq).then((r) => {
        cursor.current = { boot: r.boot, seq: r.seq };
        if (r.reset) { setNotices(r.notices.slice(-100).reverse()); return; }
        r.notices.forEach((n) => onNotice(n));
      }).catch(() => {});
      else cursor.current = { boot: d.boot, seq: d.seq };
    }
    if (e.event === 'stream' && d?.botId) setStreaming((s) => ({ ...s, [d.botId]: d.phase !== 'end' }));
    if (e.event === 'message' && d?.botId && d.item?.text)
      setPreviews((p) => ({ ...p, [d.botId]: { text: d.item.text, time: d.item.time ?? Date.now(), who: d.item.kind === 'user' ? 'me' : undefined } }));
    if (e.event === 'room' && d?.roomId) { setPreviews((p) => ({ ...p, [d.roomId]: { ...(p[d.roomId] ?? { text: '' }), time: Date.now() } })); refreshSoon(); }
    if (e.event === 'notice' && d) onNotice(d as Notice);
    listeners.current.forEach((l) => l(e));
  }, [refreshSoon]);

  const onNotice = (d: Notice) => {
    {
      if (d.seq != null) cursor.current = { ...cursor.current, seq: Math.max(cursor.current.seq ?? 0, d.seq) };
      setNotices((l) => (l.some((x) => x.seq === d.seq) ? l : [d, ...l].slice(0, 100)));
      if (d.kind !== 'message' && d.kind !== 'group') refreshSoon();
      const id = d.kind === 'group' && d.roomId ? d.roomId : d.botId;
      if (id && id !== openBot.current && (d.kind === 'message' || d.kind === 'group'))
        setUnread((u) => ({ ...u, [id]: (u[id] ?? 0) + 1 }));
      if (id && ['learning', 'browser'].includes(d.kind)) setWaiting((w) => ({ ...w, [d.roomId ?? id]: true }));
    }
  };

  // Last line of every chat for the home list (bots: chat page; groups: room-chat page).
  const loadPreviews = useCallback(async (c: BotClient, st: BotState) => {
    const out: Ctx['previews'] = {};
    await Promise.all([
      ...st.bots.map(async (b) => { try { const p = await c.chat(b.id); const i = [...p.items].reverse().find((x) => x.text); if (i) out[b.id] = { text: i.text!, time: i.time, who: i.kind === 'user' ? 'me' : undefined }; } catch {} }),
      ...(st.rooms ?? []).map(async (r) => { try { const p = await c.roomChat(r.id); const i = [...p.items].reverse().find((x: any) => x.text && x.kind !== 'event'); if (i) out[r.id] = { text: i.text, time: i.time, who: i.kind === 'user' ? 'me' : i.name }; } catch {} }),
    ]);
    setPreviews((p) => ({ ...out, ...Object.fromEntries(Object.entries(p).filter(([k, v]) => (v.time ?? 0) > (out[k]?.time ?? 0) && v.text)) }));
  }, []);

  const start = useCallback(async (conn: Connection) => {
    const c = new BotClient(conn, new NativeCookieTokenAuth());
    await c.connect();
    feed.current?.stop();
    clientRef.current = c;
    setClient(c);
    const st = await c.state();
    setState(st);
    loadPreviews(c, st);
    c.notices().then((r) => { cursor.current = { boot: r.boot, seq: r.seq }; setNotices(r.notices.slice(-100).reverse()); }).catch(() => {});
    const f = new Feed(conn, c.auth, onEvent, (s, n) => { setStatus(s); setOpens(n); });
    feed.current = f; f.start();
  }, [onEvent, loadPreviews]);

  const connect = useCallback(async (conn: Connection) => {
    await start(conn);
    await SecureStore.setItemAsync(KEY, JSON.stringify(conn));
  }, [start]);

  const disconnect = useCallback(async () => {
    feed.current?.stop(); feed.current = null; clientRef.current = null;
    resetMemoryNews(); setClient(null); setState(null); setPreviews({}); setUnread({}); setNotices([]); cursor.current = {};
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
    client, state, status, opens, restoring, unread, streaming, waiting, previews, notices, connect, disconnect, refresh,
    markRead: (id) => { setUnread((u) => ({ ...u, [id]: 0 })); setWaiting((w) => ({ ...w, [id]: false })); },
    subscribe: (l) => { listeners.current.add(l); return () => { listeners.current.delete(l); }; },
    setOpenBot: (id) => { openBot.current = id; },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
