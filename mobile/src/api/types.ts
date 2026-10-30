// Shapes of the DS Bot mobile client API (docs/plans/2026-10-24-mobile-api.md).
export type ApiError = { code: string; message: string; details?: unknown };
export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export type Avatar = { shape?: string; image?: string; imageRef?: string };
export type Bot = {
  id: string;
  name: string;
  role?: string;
  color?: string;
  avatar?: Avatar;
  model?: string;
  waiting?: unknown;
  sessionId?: string;
};
export type BotState = {
  revision: number;
  mainBotId?: string;
  bots: Bot[];
  rooms?: { id: string; name: string }[];
  activity?: Record<string, unknown>;
  [k: string]: unknown;
};
export type Hello = { api: number | null; boot: string; seq: number; revision: number; capabilities: string[]; readOnly?: boolean };
export type ChatItem = { kind: 'user' | 'bot' | 'answer' | string; text?: string; time?: number; seq?: number; turn?: number };
export type ChatPage = { sessionId: string; items: ChatItem[]; cursor: string | null };

export type FeedEvent =
  | { event: 'hello'; data: { revision: number; api: number; boot: string; seq: number } }
  | { event: 'message'; data: { botId: string; sessionId: string; item: ChatItem } }
  | { event: 'stream'; data: { botId: string; sessionId: string; attemptId: string; phase?: 'start' | 'end'; text?: string } }
  | { event: 'notice'; data: { seq: number; kind: string; botId?: string; sessionId?: string; name?: string; text?: string } }
  | { event: 'revision'; data: { revision: number } }
  | { event: 'live' | 'room' | string; data: any };
