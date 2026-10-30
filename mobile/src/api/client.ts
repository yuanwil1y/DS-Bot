import type { AuthStrategy, Connection } from './auth';
import type { ApiResult, BotState, ChatPage, Hello } from './types';

export class ApiCallError extends Error {
  constructor(public code: string, message: string, public status = 200) { super(message); }
}

/** POST /api/bot {endpoint, payload} -> {ok, value|error}. Re-authorizes once on 401/403. */
export class BotClient {
  constructor(public conn: Connection, public auth: AuthStrategy) {}

  async connect(): Promise<Hello> {
    await this.auth.establish(this.conn);
    const h = await this.call<Hello>('hello', { client: { name: 'ds-bot-mobile', version: '0.1.0', platform: 'android' }, api: [1] });
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
  send(sessionId: string, text: string) { return this.call<boolean>('send', { sessionId, text }); }
}
