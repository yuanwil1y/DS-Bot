// Live feed over the Remote WebSocket (/api/remote.mux, stream endpoint dsBot/feed).
// Chosen over SSE because React Native's fetch cannot stream a response body; RN's
// WebSocket is native (OkHttp) and sends the cookie jar's cookie on Android.
import type { AuthStrategy, Connection } from './auth';
import type { FeedEvent } from './types';

export type FeedStatus = 'connecting' | 'open' | 'closed';
type WSCtor = new (url: string, protocols?: string | string[] | null, options?: any) => WebSocket;

export class Feed {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  status: FeedStatus = 'closed';

  constructor(
    private conn: Connection,
    private auth: AuthStrategy,
    private onEvent: (e: FeedEvent) => void,
    private onStatus: (s: FeedStatus, opened: number) => void = () => {},
    private WS: WSCtor = WebSocket as unknown as WSCtor,
  ) {}

  private opens = 0;
  start() { this.stopped = false; this.open(); }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
    this.set('closed');
  }
  /** Reconnect now (e.g. app came to foreground). */
  kick() { if (!this.stopped && this.status === 'closed') { if (this.timer) clearTimeout(this.timer); this.open(); } }

  private set(s: FeedStatus) { this.status = s; this.onStatus(s, this.opens); }

  private open() {
    this.set('connecting');
    const url = this.conn.baseUrl.replace(/^http/, 'ws') + '/api/remote.mux';
    const headers = this.auth.headers();
    // RN accepts (url, protocols, {headers}); Node/undici accepts (url, {headers}).
    const ws = Object.keys(headers).length
      ? new (this.WS as any)(url, { headers })
      : new this.WS(url);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'open', streamId: 'feed', endpoint: 'dsBot/feed', payload: { args: {} } }));
    };
    ws.onmessage = (m: MessageEvent) => {
      let msg: any;
      try { msg = JSON.parse(typeof m.data === 'string' ? m.data : String(m.data)); } catch { return; }
      if (msg.type === 'item' && msg.value?.event) {
        if (msg.value.event === 'hello') { this.attempt = 0; this.opens++; this.set('open'); }
        this.onEvent(msg.value as FeedEvent);
      } else if (msg.type === 'error' || msg.type === 'end' || msg.type === 'close') {
        ws.close();
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.set('closed');
      if (this.stopped) return;
      // Exponential backoff with jitter: 1s, 2s, 4s … 30s.
      const delay = Math.min(30_000, 1000 * 2 ** this.attempt++) * (0.75 + Math.random() * 0.5);
      // Credentials may have expired; re-run the auth step before reconnecting.
      this.timer = setTimeout(() => {
        this.auth.establish(this.conn).catch(() => {}).finally(() => { if (!this.stopped) this.open(); });
      }, delay);
    };
  }

}
