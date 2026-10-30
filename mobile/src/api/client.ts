import type { AuthStrategy, Connection } from './auth';
import type { ApiResult, BotState, ChatPage, Hello, Notice } from './types';

export class ApiCallError extends Error {
  constructor(public code: string, message: string, public status = 200) { super(message); }
}

/** POST /api/bot {endpoint, payload} -> {ok, value|error}. Re-authorizes once on 401/403. */
export class BotClient {
  hello: Hello | null = null;
  constructor(public conn: Connection, public auth: AuthStrategy) {}

  async connect(): Promise<Hello> {
    await this.auth.establish(this.conn);
    const h = await this.call<Hello>('hello', { client: { name: 'ds-bot-mobile', version: '0.5.0', platform: 'android' }, api: [1] });
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
  roomChat(roomId: string, cursor?: string) { return this.call<{ roomId: string; items: any[]; cursor: string | null; running?: boolean; speaking?: unknown }>('room-chat', cursor ? { roomId, cursor } : { roomId }); }
  usage(botId: string) { return this.call<any>('usage-summary', { botId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }
  memory(botId: string) { return this.call<any>('memory-view', { botId }); }
  memoryAdd(botId: string, text: string, room = false) { return this.call<any>('memory-add', room ? { roomId: botId, text } : { botId, text }); }
  createBot(p: { name: string; role?: string; model?: string }) { return this.call<any>('create-bot', p); }
  createRoom(members: string[], admin?: string, name?: string) { return this.call<any>('create-room', { members, ...(admin ? { admin } : {}), ...(name ? { name } : {}) }); }
  updateBot(id: string, p: Record<string, unknown>) { return this.call<any>('update-bot', { id, ...p }); }
  // Same endpoints the web UI's model, folder, group and memory menus call.
  efforts(ref: string) { return this.call<{ efforts: { id: string; name: string }[]; defaultEffort?: string }>('efforts', { ref }); }
  refreshModels() { return this.call<{ modelsKey: string }>('models', {}); }
  folders() { return this.call<{ team: string | null; picker: string | null; folders: { path: string; title: string }[] }>('folders', {}); }
  folderList(path?: string) { return this.call<{ path: string; crumbs?: { path: string }[]; entries?: { name: string; path: string; hidden?: boolean }[]; truncated?: boolean }>('folder-list', path ? { path } : {}); }
  updateRoom(id: string, p: Record<string, unknown>) { return this.call<any>('update-room', { id, ...p }); }
  memoryView(id: string, flags: { summarize?: boolean; regenerate?: boolean } = {}, room = false) { return this.call<any>('memory-view', { ...(room ? { roomId: id } : { botId: id }), ...flags }); }
  answerQuestion(sessionId: string, questionId: string, answer: { selected: string[]; custom?: string }) { return this.call<any>('answer-question', { sessionId, questionId, answer: { selected: answer.selected, custom: answer.custom ?? '' } }); }
  dismissQuestion(sessionId: string) { return this.call<any>('dismiss-question', { sessionId }); }
  viewReply(sessionId: string, viewId: string, action: string, values: object) { return this.call<any>('view-reply', { sessionId, viewId, action, values }); }
  dismissView(sessionId: string) { return this.call<any>('dismiss-view', { sessionId }); }
  approvalAnswer(id: string, choice: 'allow' | 'reject') { return this.call<any>('approval-answer', { id, choice }); }
  stopMemberWork(roomId: string, botId: string) { return this.call<boolean>('stop-member-work', { roomId, botId }); }
  stopRoomWork(roomId: string) { return this.call<boolean>('stop-room-work', { roomId }); }
  roomProgress(roomId: string) { return this.call<{ callId: string; replies: unknown[]; speaking?: string | string[] }[]>('room-progress', { roomId }); }
  notices(boot?: string, since?: number) { return this.call<{ boot: string; seq: number; reset: boolean; notices: Notice[] }>('notices', { ...(boot ? { boot } : {}), ...(since != null ? { since } : {}) }); }
  send(sessionId: string, text: string) { return this.call<boolean>('send', { sessionId, text }); }
}
