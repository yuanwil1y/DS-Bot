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
  instructions?: string;
  workDir?: string;
  appliedModel?: string;
  effort?: string;
  permission?: string;
  pinned?: boolean;
  hidden?: boolean;
  createdAt?: number;
  private?: boolean;
};
export type Room = {
  pinned?: boolean;
  hidden?: boolean; id: string; name: string; named?: boolean; members?: string[]; admin?: string; mode?: string; notice?: string; preview?: string; createdAt?: number; workDir?: string; permission?: string; relayLimit?: number; paused?: string[] };
export type Effort = { id: string; name: string; description?: string };
export type Reasoning = { efforts: Effort[]; defaultEffort?: string };
export type Model = { ref: string; name: string; provider?: string; providerName?: string; reasoning?: Reasoning; needsKey?: boolean };
export type PermissionCatalog = { options: { value: string; name: string; description?: string }[]; defaultPreset?: string };
export type BotState = {
  revision: number;
  sideChats?: Record<string, import('./side').SideChat[]>;
  mainBotId?: string;
  bots: Bot[];
  rooms?: Room[];
  models?: Model[];
  permissions?: PermissionCatalog | null;
  defaultModel?: string;
  activity?: Record<string, unknown>;
  questions?: Record<string, Question>;
  views?: Record<string, ViewCard>;
  learning?: Record<string, any[]>;
  memoryNews?: Record<string, { at?: number }>;
  memory?: boolean;
  secretRequests?: Record<string, SecretRequest[]>;
  secrets?: { name: string; scope: 'all' | string[]; purpose?: string }[];
  work?: Work;
  [k: string]: unknown;
};
export type Hello = { api: number | null; plugin?: { name: string; version: string }; boot: string; seq: number; revision: number; capabilities: string[]; readOnly?: boolean };
export type ChatItem = { kind: 'user' | 'bot' | 'answer' | string; text?: string; time?: number; seq?: number; turn?: number; questions?: Question[]; answers?: any[]; views?: any[]; title?: string; view?: any; callId?: string | null; handoff?: { reason?: string; note?: string; outcome?: string } };
export type QOption = { label: string; description?: string } | string;
export type Question = { id: string; callId?: string; question: string; header?: string; detail?: string; options?: QOption[]; multiSelect?: boolean; allowCustom?: boolean; askedAt?: number };
export type SecretRequest = { id: string; callId?: string; sessionId?: string; kind: 'fill' | 'allow'; name: string; purpose?: string; status: string; scope?: 'all' | string[] };
export type ViewCard = { id: string; callId?: string; title?: string; view: any; askedAt?: number };
export type Approval = { id: string; sessionId: string; botId: string; roomId?: string; tool: string; reason?: string; detail?: { text?: string; code?: string }; at?: number; answerable?: boolean };
export type WorkEntry = { botId: string; since?: number; tool?: string; said?: string; note?: string };
export type Work = { bots?: Record<string, WorkEntry & { roomId?: string }>; rooms?: Record<string, WorkEntry[]>; approvals?: Approval[] };
export type Notice = { seq: number; kind: string; botId?: string; name?: string; roomId?: string; title?: string; sessionId?: string; text?: string; time?: number; proposalId?: string; reason?: string };
export type ChatPage = { sessionId: string; items: ChatItem[]; cursor: string | null };

export type FeedEvent =
  | { event: 'hello'; data: { revision: number; api: number; boot: string; seq: number } }
  | { event: 'message'; data: { botId: string; sessionId: string; item: ChatItem } }
  | { event: 'stream'; data: { botId: string; sessionId: string; attemptId: string; phase?: 'start' | 'end'; text?: string } }
  | { event: 'notice'; data: { seq: number; kind: string; botId?: string; sessionId?: string; name?: string; text?: string } }
  | { event: 'revision'; data: { revision: number } }
  | { event: 'live' | 'room' | string; data: any };
