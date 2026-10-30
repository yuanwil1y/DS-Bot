import type { AuthStrategy, Connection } from './auth';
import type { ApiResult, BotState, ChatPage, Hello } from './types';

export class ApiCallError extends Error {
  constructor(public code: string, message: string, public status = 200) { super(message); }
}

/** POST /api/bot {endpoint, payload} -> {ok, value|error}. Re-authorizes once on 401/403. */
export class BotClient {
  hello: Hello | null = null;
  constructor(public conn: Connection, public auth: AuthStrategy) {}

  async connect(): Promise<Hello> {
    await this.auth.establish(this.conn);
    const h = await this.call<Hello>('hello', { client: { name: 'ds-bot-mobile', version: '0.2.0', platform: 'android' }, api: [1] });
    this.hello = h;
    if (h.api !== 1) throw new ApiCallError('client/api', 'server does not speak mobile API v1');
    return h;
  }

  async call<T>(endpoint: string, payload: object = {}, retry = true): Promise<T> {
    const res = await fetch(`${this.conn.baseUrl}/api/bot`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...this.auth.headers() },
      body: JSON.stringify({ endpoint, payload }),
    });
    if ((res.status === 401 || res.status === 403) && retry) {
      await this.auth.establish(this.conn);
      return this.call<T>(endpoint, payload, false);
    }
    const text = await res.text();
    let body: ApiResult<T>;
    try { body = JSON.parse(text); } catch {
      // e.g. an auth proxy login page; a future auth strategy hooks in here.
      throw new ApiCallError('client/not-json', `HTTP ${res.status}: unexpected response`, res.status);
    }
    if (!body.ok) throw new ApiCallError(body.error?.code ?? 'unknown', body.error?.message ?? 'error', res.status);
    return body.value;
  }

  state() { return this.call<BotState>('state'); }
  chat(botId: string, cursor?: string) { return this.call<ChatPage>('chat', cursor ? { botId, cursor } : { botId }); }
  roomChat(roomId: string, cursor?: string) { return this.call<{ roomId: string; items: any[]; cursor: string | null; running?: boolean; speaking?: string[] }>('room-chat', cursor ? { roomId, cursor } : { roomId }); }
  usage(botId: string) { return this.call<any>('usage-summary', { botId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }
  memory(botId: string) { return this.call<any>('memory-view', { botId }); }
  memoryAdd(botId: string, text: string) { return this.call<any>('memory-add', { botId, text }); }
  createBot(p: { name: string; role?: string; model?: string }) { return this.call<any>('create-bot', p); }
  createRoom(members: string[], admin?: string, name?: string) { return this.call<any>('create-room', { members, ...(admin ? { admin } : {}), ...(name ? { name } : {}) }); }
  updateBot(id: string, p: { name?: string; role?: string; instructions?: string }) { return this.call<any>('update-bot', { id, ...p }); }
  send(sessionId: string, text: string) { return this.call<boolean>('send', { sessionId, text }); }
}
