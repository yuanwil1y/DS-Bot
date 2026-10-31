// TEST-ONLY: one-tap feature walkthrough (「功能自测（测试用）」 in account settings) for 0.9.5–0.9.10.
// Screens register named actions with useFT(); the runner in App.tsx calls them in order with a
// bottom step label. Nothing is saved to the server: forms are opened and cancelled, the 4s delete
// confirm is only armed (never confirmed), the dark/light pass and the demo chat are local overrides
// (appearanceTest testSet). A missing or failing step is logged and skipped, never thrown.
// REMOVE this file, its useFT() calls, the Settings row and the runner in App.tsx before a real release.
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

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
export const hasFT = (name: string) => reg.has(name);

type S = { running: boolean; label: string; log: string[]; long: boolean };
let s: S = { running: false, label: '', log: [], long: false };
const subs = new Set<() => void>();
const set = (p: Partial<S>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const useFeatureTest = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => s);
export const startFeatureTest = () => set({ running: true, label: '准备…', log: [], long: false });
export const stopFeatureTest = () => set({ running: false, label: '', long: false });
export const ftSet = set;
export const ftRunning = () => s.running;
export const ftLog = (line: string) => { console.log('[功能自测]', line); set({ log: [...s.log.slice(-30), line] }); };

/** Call a registered action, waiting up to `ms` for its screen to mount. Never throws. */
export async function act(name: string, ...args: any[]): Promise<any> {
  const until = Date.now() + 3000;
  while (!reg.has(name) && Date.now() < until) { if (!s.running) return undefined; await new Promise((r) => setTimeout(r, 100)); }
  const f = reg.get(name);
  if (!f) { ftLog(`跳过：${name} 不可用`); return undefined; }
  try { return await f(...args); } catch (e: any) { ftLog(`失败：${name} ${e?.message ?? e}`); return undefined; }
}

// A long Bot reply (past FOLD_HUGE, 20 000 chars: 520 lines ≈ 23 300) so 显示全部 / 收起 can be shown in the demo chat.
export const LONG_TEXT = Array.from({ length: 520 }, (_, i) => `第 ${i + 1} 行：这是功能自测用的长消息，用来演示「显示全部 · N 字」折叠和「收起」。`).join('\n');

/** Bottom step label. Rendered by the root view AND inside every Modal (Sheet, Menu, pickers), since
 * an Android Modal draws over the root. */
export function FTLabel({ onStop }: { onStop?: () => void }) {
  const t = useFeatureTest();
  if (!t.running) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 2000, elevation: 2000 }}>
      <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,.65)', borderRadius: 999, paddingVertical: 6, paddingLeft: 14, paddingRight: onStop ? 6 : 14, maxWidth: '94%' }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{t.label}</Text>
        {onStop ? <Text onPress={onStop} style={{ color: '#fff', fontSize: 13, fontWeight: '600', backgroundColor: '#e5484d', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, overflow: 'hidden' }}>停止</Text> : null}
      </View>
    </View>
  );
}

// ---- The walkthrough script --------------------------------------------------------------------
import * as Clipboard from 'expo-clipboard';
import { testSet } from './appearanceTest';
import { DURATIONS } from './api/toolsModel';
import { RANGES } from './api/usageData';

export type FTContext = {
  mainId: string;
  setStack(routes: any[]): void;
  openSettings(page: string | null): Promise<void>;
  closeSettings(): void;
};

export async function runFeatureTest(c: FTContext) {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let n = 0;
  /** One visible state: label it, do it, hold it. Errors are logged, never thrown. */
  const step = async (label: string, run: () => unknown, hold = 2500) => {
    if (!s.running) throw new Error('stopped');
    n += 1; set({ label: `${String(n).padStart(2, '0')} ${label}` });
    try { await run(); } catch (e: any) { ftLog(`失败：${label} ${e?.message ?? e}`); }
    await wait(hold);
  };
  const nop = () => {};

  // 1 · 账户菜单 + 连接器
  c.setStack([]);
  await step('首页', nop, 1500);
  await step('账户菜单：图标、「移动端暂未实现」提示', () => act('home.acct', true), 3000);
  await step('账户菜单 → 连接器', async () => { await act('home.acct', false); await wait(300); await c.openSettings('connectors'); }, 2500);
  await step('连接器：打开 token 表单（不提交）', () => act('conn.open'), 3000);
  await step('连接器：取消', () => act('conn.cancel'), 2000);

  // 2 · 能力（只打开表单、显示 JSON 错误，从不保存）
  await step('能力页', () => act('settings.page', 'capabilities'), 2500);
  await step('添加能力 · 技能', () => act('cap.form', { kind: 'skill', name: 'selftest-temp' }), 2500);
  await step('添加能力 · 本地 MCP（本地命令）', () => act('cap.form', { kind: 'mcp', transport: 'stdio', name: 'selftest-temp', command: 'npx' }), 2500);
  await step('本地 MCP：环境变量填无效 JSON', () => act('cap.patch', { envText: '{ bad json' }), 2000);
  await step('本地 MCP：点「添加能力」→ JSON 错误（未保存）', () => act('cap.invalid'), 3000);
  await step('添加能力 · HTTP MCP', () => act('cap.form', { kind: 'mcp', transport: 'streamable-http', name: 'selftest-temp', url: 'https://example.com/mcp' }), 2500);
  await step('HTTP MCP：请求头无效 JSON → 错误（未保存）', async () => { await act('cap.patch', { headersText: '{ oops' }); await wait(200); await act('cap.invalid'); }, 3000);
  await step('添加能力 · 能力包', () => act('cap.form', { kind: 'pack', name: 'selftest-temp' }), 2500);
  await step('取消表单', () => act('cap.form', null), 1500);
  await step('删除：第一次点 →「再点一次删除。」（4 秒后自动复原，不会删除）', async () => { await act('sheet.scroll', 'end'); await act('cap.arm'); }, 5000);
  await step('删除按钮已复原', () => act('sheet.scroll', 0), 1500);

  // 3 · 浏览器授权（四个时限，不添加）
  await step('浏览器页', () => act('settings.page', 'browser'), 2500);
  await act('sheet.scroll', 'end');
  for (const [k, l] of DURATIONS) await step(`浏览器：时限「${l}」`, () => act('browser.duration', k), 1800);
  await step('浏览器：恢复「1 小时」（未添加授权）', () => act('browser.duration', 'hour'), 1500);

  // 4 · 用量
  await step('用量页', () => act('settings.page', 'usage'), 3000);
  for (const r of RANGES as any[]) await step(`用量：范围 ${r.id}`, () => act('usage.range', r.id), 2000);
  await step('用量：按模型', () => act('usage.by', 'model'), 2500);
  await step('用量：按 Bot', () => act('usage.by', 'bot'), 2000);
  await step('用量：点柱子 → 提示', () => act('usage.tip', true), 3000);
  await step('用量：关闭提示', () => act('usage.tip', false), 1200);
  await step('用量：自定义范围（日历）', () => act('usage.range', 'custom'), 3000);
  await step('用量：收起日历', () => act('usage.range', 'custom'), 1200);
  await step('用量：活跃度热力图（滚到最早）', async () => { await act('sheet.scroll', 'end'); await wait(400); await act('usage.heat', 'start'); }, 2500);
  await step('用量：热力图滚回最近', () => act('usage.heat', 'end'), 2000);
  await step('用量：单个 Bot 详情', async () => { await act('sheet.scroll', 0); await act('usage.focus'); }, 3000);
  await step('返回 → 全部用量', () => act('sheet.back'), 2500);
  await act('usage.range', '7d');

  // 5 · 密钥（不保存）
  await step('密钥页', () => act('settings.page', 'secrets'), 2500);
  await step('密钥：展开第一行', () => act('secrets.expand', true), 2500);
  await step('密钥：收起', () => act('secrets.expand', false), 1200);
  await step('密钥：添加表单（不保存）', () => act('secrets.add', true), 3000);
  await step('密钥：取消', () => act('secrets.add', false), 1500);

  // 6 · 反馈 / 关于
  await step('反馈页', () => act('settings.page', 'feedback'), 3000);
  await step('关于页', () => act('settings.page', 'about'), 2000);
  await step('关于：检查更新', () => act('about.check'), 4000);
  await step('关闭设置', () => c.closeSettings(), 1500);

  // 7 · 私聊：交接记录（真实数据，有才显示）
  c.setStack([{ name: 'chat', target: { kind: 'bot', id: c.mainId } }]);
  await step('主 Bot 私聊（真实记录）', nop, 2500);
  let ex = false;
  await step('交接记录（exchange）弹窗', async () => { ex = !!(await act('chat.exchange', true)); }, 3500);
  if (ex) await step('关闭交接记录', () => act('chat.exchange', false), 1500);

  // 8 · 回复工具栏（本地演示对话，从不发送）
  const clip = await Clipboard.getStringAsync().catch(() => null);
  testSet({ demo: c.mainId }); set({ long: true });
  await step('演示对话（本地，不发送）', nop, 2000);
  await step('点 Bot 气泡 → 工具栏', () => act('chat.tools', true), 2500);
  await step('工具栏：表情面板', () => act('tools.react'), 2500);
  await step('添加反应 👍', async () => { await act('tools.close'); await act('chat.react', '👍'); }, 2500);
  await step('再点 👍 → 移除反应', () => act('chat.react', '👍'), 2500);
  await step('回复 → 输入框出现引用', () => act('chat.reply'), 3000);
  await step('清空输入框', () => act('chat.clear'), 1500);
  await step('工具栏：更多', async () => { await act('chat.tools', true); await wait(300); await act('tools.more'); }, 2500);
  await step('更多 → 复制（✓）', () => act('tools.copy'), 1200);
  await step('更多菜单里的「下载」（不点：会弹出系统分享）', () => act('tools.more'), 3000);
  await step('关闭菜单', async () => { await act('tools.close'); await act('chat.tools', false); }, 1200);
  await step('长消息：折叠（显示全部 · N 字）', () => act('chat.long'), 3000);
  await step('长消息：显示全部', () => act('fold.toggle'), 3000);
  await step('长消息：收起', async () => { await act('fold.toggle'); await wait(200); await act('chat.long'); }, 2500);
  set({ long: false }); testSet({ demo: null });
  if (clip !== null) await Clipboard.setStringAsync(clip).catch(() => {});

  // 9 · 定时任务（不创建）
  c.setStack([{ name: 'schedules', target: { kind: 'bot', id: '' } }]);
  await step('自动化任务', nop, 2500);
  if (await act('sched.available')) {
    await step('新建任务表单', () => act('sched.add', true), 2500);
    await step('一次：日期按钮', () => act('sched.kind', 'at'), 2000);
    await step('一次：系统日期选择器（自动关闭）', () => act('sched.pickDate'), 3000);
    await act('sched.dismiss', 'date'); await wait(500);
    await step('一次：系统时间选择器（自动关闭）', () => act('sched.pickClock'), 3000);
    await act('sched.dismiss', 'time'); await wait(500);
    await step('每天：时间按钮', () => act('sched.kind', 'daily'), 2000);
    await step('每天：系统时间选择器（自动关闭）', () => act('sched.pickTime'), 3000);
    await act('sched.dismiss', 'time'); await wait(500);
    await step('取消（未创建）', () => act('sched.add', false), 1500);
  } else await step('自动化任务未开启：跳过表单', nop, 2000);

  // 10 · 页头返回：两级
  c.setStack([{ name: 'usage', target: { kind: 'bot', id: '' } }]);
  await step('用量（第 1 级）', nop, 3000);
  await step('单个 Bot 详情（第 2 级）', () => act('usage.focus'), 3000);
  await step('返回 ← 回到全部用量', () => act('header.back'), 2500);
  await step('返回 ← 回到首页', () => act('header.back'), 2500);

  // 11 · 深浅色页头
  for (const dark of [true, false]) {
    const m = dark ? '深色' : '浅色';
    testSet({ dark });
    c.setStack([{ name: 'schedules', target: { kind: 'bot', id: '' } }]);
    await step(`${m}：二级页面页头（返回箭头）`, nop, 2500);
    await step(`${m}：设置子页页头`, () => c.openSettings('connectors'), 2500);
    await step(`${m}：设置首页（✕）`, () => act('settings.page', null), 2000);
    c.closeSettings(); await wait(400);
  }
  testSet({ dark: null });
}
