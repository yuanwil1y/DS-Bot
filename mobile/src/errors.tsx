// Crash containment: boundaries render an inline error instead of closing the app,
// and the last JS error is saved (SecureStore) so Settings can show it.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'dsbot.lastError';
export type LastError = { time: number; where: string; message: string; stack?: string };
let last: LastError | null = null;
export function recordError(where: string, e: unknown) {
  const err = e as any;
  last = { time: Date.now(), where, message: String(err?.message ?? err).slice(0, 500), stack: String(err?.stack ?? '').slice(0, 1500) };
  SecureStore.setItemAsync(KEY, JSON.stringify(last)).catch(() => {});
}
export async function loadLastError(): Promise<LastError | null> {
  if (last) return last;
  try { const s = await SecureStore.getItemAsync(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function clearLastError() { last = null; SecureStore.deleteItemAsync(KEY).catch(() => {}); }

let installed = false;
export function installGlobalHandler() {
  const EU = (globalThis as any).ErrorUtils;
  if (installed || !EU?.setGlobalHandler) return;
  installed = true;
  const prev = EU.getGlobalHandler?.();
  EU.setGlobalHandler((e: unknown, fatal?: boolean) => {
    recordError(fatal ? 'fatal' : 'js', e);
    // Fatal errors still go to RN's default handler (it would close the app); boundaries catch render errors first.
    if (!fatal) return;
    prev?.(e, fatal);
  });
}

type P = { children: React.ReactNode; where: string; inline?: boolean; color?: string; resetKey?: unknown };
export class Boundary extends React.Component<P, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { recordError(this.props.where, err); }
  componentDidUpdate(p: P) { if (this.state.err && p.resetKey !== this.props.resetKey) this.setState({ err: null }); }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = `${this.props.where} 出错：${this.state.err.message}`;
    if (this.props.inline) return <Text style={{ color: '#ff6b6b', fontSize: 13, marginVertical: 4 }}>{msg}</Text>;
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 10 }}>页面出错了</Text>
        <Text selectable style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 20 }}>{msg}</Text>
        <Pressable onPress={() => this.setState({ err: null })} style={{ paddingHorizontal: 20, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>重试</Text>
        </Pressable>
      </View>
    );
  }
}
