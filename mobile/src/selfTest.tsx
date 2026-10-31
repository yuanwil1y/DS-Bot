// TEST-ONLY: 「短自测（测试用）」 in account settings, about 1 minute, for screen recording the
// 0.9.12 items not yet seen on the phone. Screens register named actions with useFT(); the runner in
// App.tsx calls runSelfTest with a bottom step label and a 停止 button. A missing or failing step is
// logged and skipped. The temp skill `selftest-temp` and secret `SELFTEST_TEMP` it creates are deleted
// in `finally`, even on failure or stop. The long message is local only (never sent).
// REMOVE this file, its useFT() calls, the Settings row and the runner in App.tsx before a formal release.
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import type { BotClient } from './api/client';
import { blank, capabilityPayload } from './api/toolsModel';

type Fn = (...a: any[]) => any;
const reg = new Map<string, Fn>();
/** Register a named action while the component is mounted (newest registration wins). */
export function useFT(name: string, fn: Fn) {
  const r = useRef(fn); r.current = fn;
  useEffect(() => {
    const f: Fn = (...a) => r.current(...a);
    reg.set(name, f);
    return () => { if (reg.get(name) === f) reg.delete(name); };
  }, [name]);
}

type S = { running: boolean; label: string; log: string[]; long: boolean };
let s: S = { running: false, label: '', log: [], long: false };
const subs = new Set<() => void>();
const set = (p: Partial<S>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const useSelfTest = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => s);
export const startSelfTest = () => set({ running: true, label: '准备…', log: [], long: false });
export const stopSelfTest = () => set({ running: false, label: '', long: false });
export const stSet = set;
export const ftLog = (line: string) => { console.log('[短自测]', line); set({ log: [...s.log.slice(-30), line] }); };

/** Call a registered action, waiting up to 3s for its screen to mount. Never throws. */
export async function act(name: string, ...args: any[]): Promise<any> {
  const until = Date.now() + 3000;
  while (!reg.has(name) && Date.now() < until) { if (!s.running) return undefined; await new Promise((r) => setTimeout(r, 100)); }
  const f = reg.get(name);
  if (!f) { ftLog(`跳过：${name} 不可用`); return undefined; }
  try { return await f(...args); } catch (e: any) { ftLog(`失败：${name} ${e?.message ?? e}`); return undefined; }
}

// Local-only long Bot reply (past FOLD_HUGE 20 000 chars: 520 lines ≈ 23 300) for 显示全部 / 收起.
export const LONG_TEXT = Array.from({ length: 520 }, (_, i) => `第 ${i + 1} 行：这是短自测用的长消息，用来演示「显示全部 · N 字」折叠和「收起」。`).join('\n');
export const TEMP_SKILL = 'selftest-temp';
export const TEMP_SECRET = 'SELFTEST_TEMP';

/** Bottom step label (+ 停止). Rendered by the root view and inside the settings Sheet's Modal. */
export function FTLabel({ onStop }: { onStop?: () => void }) {
  const t = useSelfTest();
  if (!t.running) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 2000, elevation: 2000 }}>
      <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,.65)', borderRadius: 999, paddingVertical: 6, paddingLeft: 14, paddingRight: 6, maxWidth: '94%' }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{t.label}</Text>
        <Text onPress={onStop ?? stopSelfTest} style={{ color: '#fff', fontSize: 13, fontWeight: '600', backgroundColor: '#e5484d', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, overflow: 'hidden' }}>停止</Text>
      </View>
    </View>
  );
}

export type STContext = {
  client: BotClient;
  mainId: string;
  refresh(): Promise<unknown>;
  has(kind: 'capability' | 'secret', name: string): boolean;
  setStack(routes: any[]): void;
  openSettings(page: string | null): Promise<void>;
  closeSettings(): void;
};

export const HOLD = 2500;
/** The 7 items; each visible state holds HOLD ms (≈ 1 minute in total). */
export async function runSelfTest(c: STContext) {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let n = 0;
  const step = async (label: string, run: () => unknown, hold = HOLD) => {
    if (!s.running) throw new Error('stopped');
    n += 1; set({ label: `${String(n).padStart(2, '0')} ${label}` });
    try { await run(); } catch (e: any) { ftLog(`失败：${label} ${e?.message ?? e}`); }
    await wait(hold);
  };
  const guard = async (f: () => Promise<void>) => { try { await f(); } catch (e: any) { if (e?.message === 'stopped') throw e; ftLog(`跳过：${e?.message ?? e}`); } };

  // 1 关于：进页即有数据（不点检查更新）
  await guard(async () => {
    await step('关于：进页即显示版本与更新', () => c.openSettings('about'), 3000);
  });
  // 2-3 用量：12 个月横轴；自定义日历
  await guard(async () => {
    await step('用量：12 个月横轴（11月…10月）', async () => { await act('settings.page', 'usage'); await wait(500); await act('usage.range', '12m'); }, 3000);
    await step('用量：自定义 → 日历弹层', () => act('usage.range', 'custom'));
    await step('用量：关闭日历', () => act('usage.range', 'custom'), 1200);
    await act('usage.range', '7d');
  });
  // 5 能力：临时技能 → 两次点删除（真的删掉）
  await guard(async () => {
    try {
      await step('能力：创建临时技能 selftest-temp', async () => {
        await act('settings.page', 'capabilities');
        await c.client.capabilitySave(capabilityPayload({ ...blank(), kind: 'skill', name: TEMP_SKILL, description: '短自测临时技能，会自动删除', content: '短自测临时技能。' }));
        await c.refresh();
      });
      await step('能力：第一次点删除 →「再点一次删除。」', () => act('cap.delete', TEMP_SKILL), 2000);
      await step('能力：再点一次 → 已删除，列表为空', () => act('cap.delete', TEMP_SKILL));
    } finally {
      await c.refresh().catch(() => {});
      if (c.has('capability', TEMP_SKILL)) await c.client.capabilityDelete(TEMP_SKILL).then(() => c.refresh()).catch((e) => ftLog(`清理失败：${e?.message ?? e}`));
    }
  });
  // 6 密钥：临时密钥 → 展开 → 删除
  await guard(async () => {
    try {
      await step('密钥：添加临时密钥 SELFTEST_TEMP（假值）', async () => {
        await act('settings.page', 'secrets');
        await c.client.secretSet({ name: TEMP_SECRET, purpose: '短自测临时密钥，会自动删除', value: 'selftest-dummy-value', scope: 'all' });
        await c.refresh();
      });
      await step('密钥：展开这一行', () => act('secrets.expand', TEMP_SECRET));
      await step('密钥：删除 → 列表为空', async () => { await act('secrets.expand', null); await c.client.secretDelete(TEMP_SECRET); await c.refresh(); });
    } finally {
      await c.refresh().catch(() => {});
      if (c.has('secret', TEMP_SECRET)) await c.client.secretDelete(TEMP_SECRET).then(() => c.refresh()).catch((e) => ftLog(`清理失败：${e?.message ?? e}`));
    }
  });
  c.closeSettings(); await wait(400);
  // 4 定时任务：新建表单 + 键盘
  await guard(async () => {
    c.setStack([{ name: 'schedules', target: { kind: 'bot', id: '' } }]);
    await wait(800);
    if (!(await act('sched.available'))) { await step('定时任务未开启：跳过', () => {}, 1500); return; }
    await step('新建任务：标题自动聚焦，键盘弹出', () => act('sched.add', true));
    await step('键盘仍在：「什么时候」可见', () => act('sched.end'), 3000);
    await step('取消（未创建）', () => act('sched.add', false), 1200);
  });
  // 7 长消息折叠（本地，不发送）
  await guard(async () => {
    c.setStack([{ name: 'chat', target: { kind: 'bot', id: c.mainId } }]);
    set({ long: true });
    await wait(800);
    await step('长消息（本地，不发送）：折叠「显示全部 · N 字」', () => act('chat.long'), 3000);
    await step('显示全部', () => act('fold.toggle'), 3000);
    await step('收起', async () => { await act('fold.toggle'); await wait(200); await act('chat.long'); });
  });
  set({ long: false });
}
