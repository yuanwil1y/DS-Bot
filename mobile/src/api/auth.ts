// How a connection gets authorized. Today: the DSH launch token, exchanged for the
// dsh-auth-* cookie. Later an Authelia (passkey) step can be added as another strategy
// that runs before/around this one; the client only depends on this interface.
export type Connection = { baseUrl: string; token: string };

export interface AuthStrategy {
  /** Obtain/refresh credentials. Throws if the server refuses. */
  establish(conn: Connection): Promise<void>;
  /** Extra headers for HTTP and WebSocket requests ({} when a native cookie jar handles it). */
  headers(): Record<string, string>;
}

export function tokenUrl(conn: Connection): string {
  return `${conn.baseUrl}/?token=${encodeURIComponent(conn.token)}`;
}

/** Accepts "https://host[:port]/?token=XYZ" or a base URL + separate token. */
export function parseConnection(input: string, token = ''): Connection {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  const u = new URL(s);
  const t = token.trim() || u.searchParams.get('token') || '';
  return { baseUrl: `${u.protocol}//${u.host}`, token: t };
}

/**
 * React Native (Android): fetch follows the 303 and OkHttp's cookie jar
 * (ForwardingCookieHandler, persisted by Android CookieManager) keeps the HttpOnly
 * cookie. Later fetch and WebSocket calls to the same host:port send it automatically.
 */
export class NativeCookieTokenAuth implements AuthStrategy {
  async establish(conn: Connection) {
    const res = await fetch(tokenUrl(conn), { credentials: 'include' });
    if (res.status >= 400) throw new Error(`token rejected (HTTP ${res.status})`);
  }
  headers() { return {}; }
}

/** Node / tests: no cookie jar, so read Set-Cookie from the 303 and send it ourselves. */
export class ManualCookieTokenAuth implements AuthStrategy {
  private cookie = '';
  async establish(conn: Connection) {
    const res = await fetch(tokenUrl(conn), { redirect: 'manual' });
    const list: string[] = (res.headers as any).getSetCookie?.() ?? [];
    this.cookie = list.map((c) => c.split(';')[0]).filter((c) => c.startsWith('dsh-auth-')).join('; ');
    if (!this.cookie) throw new Error(`token rejected (HTTP ${res.status})`);
  }
  headers(): Record<string, string> { return this.cookie ? { cookie: this.cookie } : {}; }
}
