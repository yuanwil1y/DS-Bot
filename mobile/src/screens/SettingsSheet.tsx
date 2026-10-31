// Account button -> settings sheet (Grok settings style).
import { UsagePage } from './UsagePage';
import { SecretsPage } from './SecretsPage';
import React, { useEffect, useState } from 'react';
import { clearLastError, loadLastError, type LastError } from '../errors';
import { Text, ToastAndroid } from 'react-native';
import type { ChatTarget } from './HomeScreen';
import { Group, Row, Sheet } from '../components/ui';
import { AppearanceGroup, MotionGroup } from '../components/Appearance';
import { FolderField } from '../components/Pickers';
import { View } from 'react-native';
import { NA_MOBILE } from '../components/Menu';
import { BrowserPage, CapabilitiesPage, ConnectorsPage } from './ToolPages';
import { sheetBack } from '../nav';
import { AboutPage, FeedbackPage, KeptPrivateSection } from './AboutFeedback';
import { usePrefs } from '../prefs';
import { useStore } from '../store';
import { t } from '../i18n';
import type { Theme } from '../theme';

import { startAppearanceTest } from '../appearanceTest'; // TEST-ONLY
import { startFeatureTest, useFT } from '../featureTest'; // TEST-ONLY
import { APP_VERSION } from '../version';
export { APP_VERSION };

const TITLES = { about: '关于 DS Bot', feedback: '反馈', usage: '用量', secrets: '密钥', connectors: '连接器', capabilities: '能力', browser: '浏览器' } as const;
export function SettingsSheet({ theme, visible, onClose, onOpenSettings, startPage }: { theme: Theme; visible: boolean; onClose(): void; onOpenSettings?(t: ChatTarget): void; startPage?: 'connectors' }) {
  const { client, status, state, disconnect, refresh } = useStore();
  // settings.js MainBotsSection / BotsPage / GroupsPage.
  const bots = state?.bots ?? [];
  const rooms = state?.rooms ?? [];
  const byId = Object.fromEntries(bots.map((b) => [b.id, b]));
  const mainIds: string[] = (state as any)?.mainBotIds ?? (state?.mainBotId ? [state.mainBotId] : []);
  const mains = mainIds.map((id) => byId[id]).filter(Boolean);
  const [first, ...others] = mains;
  const candidates = bots.filter((b) => !mainIds.includes(b.id));
  const [choosing, setChoosing] = useState<null | 'first' | 'add'>(null);
  const setMain = (p: Record<string, unknown>) => client!.call('set-main', p).then(refresh, (e: any) => ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT));
  const openSettings = (t: ChatTarget) => { onClose(); onOpenSettings?.(t); };
  const prefs = usePrefs();
  const [page, setPage] = useState<null | 'about' | 'feedback' | 'usage' | 'secrets' | 'connectors' | 'capabilities' | 'browser'>(null);
  const [usageFocus, setUsageFocus] = useState<string | null>(null);
  useFT('settings.page', (p: typeof page) => setPage(p)); // TEST-ONLY
  useEffect(() => { if (page !== 'usage') setUsageFocus(null); }, [page]);
  // team-actions.js openConnectors(): the account menu opens settings straight on 连接器.
  useEffect(() => { setPage(visible ? startPage ?? null : null); }, [visible, startPage]);
  const [lastErr, setLastErr] = useState<LastError | null>(null);
  useEffect(() => { if (visible) loadLastError().then(setLastErr); }, [visible]);
  const host = client?.conn.baseUrl.replace(/^https?:\/\//, '') ?? '';
  const cycle = <T extends string>(v: T, all: T[]) => all[(all.indexOf(v) + 1) % all.length];
  const label = (v: string) => (v === 'auto' ? t.auto : v === 'zh' ? '简体中文' : v === 'en' ? 'English' : v === 'dark' ? t.dark : t.light);
  const back = () => { const n = sheetBack({ page, usageFocus }); if (n === 'close') onClose(); else { setUsageFocus(n.usageFocus); setPage(n.page as typeof page); } };
  return (
    <Sheet theme={theme} visible={visible} onClose={onClose} title={page ? TITLES[page] : undefined} onBack={page ? back : undefined} backLabel={page === 'usage' && usageFocus ? '全部用量' : '返回设置'}>
      {page ? <>
        {page === 'about' ? <AboutPage theme={theme} onFeedback={() => setPage('feedback')} />
          : page === 'usage' ? <UsagePage theme={theme} focusId={usageFocus} onFocus={setUsageFocus} />
          : page === 'secrets' ? <SecretsPage theme={theme} />
          : page === 'connectors' ? <ConnectorsPage theme={theme} />
          : page === 'capabilities' ? <CapabilitiesPage theme={theme} />
          : page === 'browser' ? <BrowserPage theme={theme} /> : <FeedbackPage theme={theme} />}
      </> : <>
      <Group theme={theme} style={{ marginTop: 4 }}>
        <Row theme={theme} label={t.appName} caption={host} value={status === 'open' ? t.online : t.offline} />
        <Row theme={theme} label={t.plugin} value={client?.hello?.plugin?.version ?? '—'} />
        {state?.readOnly ? <Row theme={theme} label={t.readOnly} value="✓" /> : null}
      </Group>
      <Group theme={theme}>
        <Row theme={theme} label={t.language} value={label(prefs.lang)} onPress={() => prefs.set({ lang: cycle<typeof prefs.lang>(prefs.lang, ['auto', 'zh', 'en']) })} />
        <Row theme={theme} label="深浅色" caption="本设备的深色/浅色（网页由 DSH 外壳决定）。" value={label(prefs.theme)} onPress={() => prefs.set({ theme: cycle<typeof prefs.theme>(prefs.theme, ['dark', 'light', 'auto']) })} />
      </Group>
      {!state?.readOnly ? <Group theme={theme} title="主 Bot">
        <Row theme={theme} label="主 Bot" value={first?.name ?? '选择一个 Bot…'} caption={first ? `排在侧栏最上面。选另一个 Bot 就会把主 Bot 交给它，${first.name} 随之不再是主 Bot。` : undefined} onPress={() => setChoosing(choosing === 'first' ? null : 'first')} />
        {choosing === 'first' ? bots.filter((b) => b.id !== first?.id).map((b) => <Row key={b.id} theme={theme} label={`  ${b.name}`} chevron={false} onPress={() => { setChoosing(null); setMain({ id: b.id, main: true, ...(first ? { replace: first.id } : {}) }); }} />) : null}
        {others.map((b) => <React.Fragment key={b.id}>
          <Row theme={theme} label={b.name} caption="也是主 Bot。" chevron={false} />
          <Row theme={theme} label="  移到最前" chevron={false} onPress={() => setMain({ id: b.id, main: true, primary: true })} />
          <Row theme={theme} label="  取消主 Bot" chevron={false} onPress={() => setMain({ id: b.id, main: false })} />
        </React.Fragment>)}
        {candidates.length ? <Row theme={theme} label="添加主 Bot" caption="主 Bot 可以创建和修改 Bot，并管理所有群聊。" onPress={() => setChoosing(choosing === 'add' ? null : 'add')} /> : null}
        {choosing === 'add' ? candidates.map((b) => <Row key={b.id} theme={theme} label={`  ${b.name}`} chevron={false} onPress={() => { setChoosing(null); setMain({ id: b.id, main: true }); }} />) : null}
      </Group> : null}
      <Group theme={theme} title={`Bot · ${bots.length}`}>
        {bots.map((b) => <Row key={b.id} theme={theme} label={b.name} value={[b.role, mainIds.includes(b.id) ? '主 Bot' : '', b.hidden && !mainIds.includes(b.id) ? '已隐藏' : ''].filter(Boolean).join(' · ')} onPress={() => openSettings({ kind: 'bot', id: b.id })} />)}
      </Group>
      <KeptPrivateSection theme={theme} />
      <MotionGroup theme={theme} />
      <Group theme={theme} title={`群聊 · ${rooms.length}`}>
        {rooms.length === 0 ? <Row theme={theme} label="还没有群聊。" caption="在群聊里，几个 Bot 和你一起做一件事。" /> : rooms.map((r) => <Row key={r.id} theme={theme} label={r.name} value={[`${(r.members ?? []).length} 位成员`, r.admin && byId[r.admin] ? `★ ${byId[r.admin].name}` : '', r.hidden ? '已隐藏' : ''].filter(Boolean).join(' · ')} onPress={() => openSettings({ kind: 'room', id: r.id })} />)}
      </Group>
      <Group theme={theme} title="设置页面">
        <Row theme={theme} label="模型" value={NA_MOBILE} chevron={false} />
        <Row theme={theme} label="连接器" onPress={() => setPage('connectors')} />
        <Row theme={theme} label="能力" onPress={() => setPage('capabilities')} />
        <Row theme={theme} label="浏览器" onPress={() => setPage('browser')} />
        <Row theme={theme} label="用量" onPress={() => setPage('usage')} />
        <Row theme={theme} label="密钥" onPress={() => setPage('secrets')} />
        <Row theme={theme} label="反馈" onPress={() => setPage('feedback')} />
        <Row theme={theme} label="关于 DS Bot" onPress={() => setPage('about')} />
      </Group>
      <AppearanceGroup theme={theme} />
      <Group theme={theme} title="模式">
        <Row theme={theme} label="经典 Agent 模式" value={NA_MOBILE} chevron={false} />
      </Group>
      <Locations theme={theme} />
      <Group theme={theme}>
        <Row theme={theme} label={t.disconnect} danger chevron={false} onPress={() => { onClose(); disconnect(); }} />
      </Group>
      <Group theme={theme}>
        <Row theme={theme} label="最近一次错误" value={lastErr ? new Date(lastErr.time).toLocaleString() : '无'} chevron={false} onPress={lastErr ? () => { clearLastError(); setLastErr(null); } : undefined} />
        {lastErr ? <Text selectable style={{ color: '#ff6b6b', fontSize: 12, padding: 12 }}>{`[${lastErr.where}] ${lastErr.message}\n${lastErr.stack ?? ''}`.slice(0, 1200)}{'\n（点上面一行清除）'}</Text> : null}
      </Group>
      <Text style={{ color: theme.faint, textAlign: 'center', marginTop: 24 }}>{t.appVersion} {APP_VERSION}</Text>
      {/* TEST-ONLY: appearance self-test for screen recording; remove before a real release. */}
      <Group theme={theme} title="测试">
        <Row theme={theme} label="外观自动测试（测试用）" caption="自动切换各外观组合，便于录屏对照网页；仅本机临时生效，结束或停止后恢复" onPress={() => { onClose(); startAppearanceTest(); }} />
        <Row theme={theme} label="功能自测（测试用）" caption="自动走一遍 0.9.5–0.9.10 的新功能（菜单、连接器、能力、浏览器、用量、密钥、反馈、关于、回复工具栏、定时任务、返回、深浅色），便于录屏；不保存任何东西，结束后恢复" onPress={() => { onClose(); startFeatureTest(); }} />
      </Group>
      </>}
    </Sheet>
  );
}

// settings.js LocationsSection: the team workspace (数据位置 is the desktop app's only).
function Locations({ theme }: { theme: Theme }) {
  const { client } = useStore();
  const [team, setTeam] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  useEffect(() => { client?.folders().then((i) => setTeam(i?.team ?? null)).catch(() => {}); }, [client]);
  const pick = (path: string) => {
    if (moving) return Promise.resolve();
    setMoving(true);
    return client!.call<any>('team-workspace', { path }).then((a) => setTeam(a?.team ?? path)).finally(() => setMoving(false));
  };
  return <Group theme={theme} title="位置">
    <Row theme={theme} label="总工作区" caption="没有单独设置文件夹的 Bot 在这里工作。" chevron={false} />
    {team === null ? null : <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}><FolderField theme={theme} team value={team} disabled={moving} onPick={pick} /></View>}
  </Group>;
}
