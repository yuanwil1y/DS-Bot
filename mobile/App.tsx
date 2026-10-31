import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { PrefsProvider, usePrefs } from './src/prefs';
import { TeamPrefsProvider } from './src/teamPrefs';
import { useTheme } from './src/theme';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { HomeScreen, type ChatTarget } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { BotSettingsScreen, MemoryScreen, PanelScreen, UsageScreen } from './src/screens/Panel';
import { SettingsSheet } from './src/screens/SettingsSheet';
import { NewChatSheet } from './src/screens/NewChatSheet';
import { SchedulesScreen } from './src/screens/Schedules';
import { AvatarEditorScreen } from './src/screens/AvatarEditor';
import { SideChatScreen } from './src/screens/SideChat';
import { VoiceModeScreen } from './src/screens/VoiceMode';
import { STEPS, pokeAll, stopAppearanceTest, testSet, useAppearanceTest } from './src/appearanceTest'; // TEST-ONLY
import { Pressable, Text } from 'react-native';

// A tiny stack (home -> chat -> details) keeps native deps out; hardware back pops it.
type Route = { name: 'chat' | 'panel' | 'settings' | 'memory' | 'usage' | 'schedules' | 'avatar' | 'side' | 'voice'; target: ChatTarget; memId?: string; start?: string; chatId?: string };

function Root() {
  const theme = useTheme();
  const { client, restoring, state } = useStore();
  const [stack, setStack] = useState<Route[]>([]);
  const [settings, setSettings] = useState(false);
  const [newChat, setNewChat] = useState<'chat' | 'group' | null>(null);
  const push = (r: Route) => setStack((s) => [...s, r]);
  const pop = () => setStack((s) => s.slice(0, -1));
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (stack.length) { pop(); return true; } return false; });
    return () => sub.remove();
  }, [stack.length]);
  useEffect(() => { if (!client) setStack([]); }, [client]);
  const top = stack.at(-1);
  const bot = top?.target.kind === 'bot' ? state?.bots.find((b) => b.id === top.target.id) : undefined;
  const room = top?.target.kind === 'room' ? state?.rooms?.find((r) => r.id === top.target.id) : undefined;
  const open = (t: ChatTarget) => push({ name: 'chat', target: t });
  const schedules = (start?: string) => push({ name: 'schedules', target: { kind: 'bot', id: '' }, start });
  let body: React.ReactNode;
  if (restoring) body = <ActivityIndicator style={{ flex: 1 }} />;
  else if (!client) body = <ConnectScreen theme={theme} />;
  else if (top && (bot || room) && top.name === 'chat') body = <ChatScreen key={top.target.id} theme={theme} bot={bot} room={room} onBack={pop} onDetails={() => push({ name: 'panel', target: top.target })} onSchedule={() => schedules(top.target.id)} onSide={(chatId) => push({ name: 'side', target: top.target, chatId })} onVoice={() => push({ name: 'voice', target: top.target })} onOpenChat={open} />;
  else if (top?.name === 'schedules') body = <SchedulesScreen key={'sc' + (top.start ?? '')} theme={theme} start={top.start} onBack={pop} />;
  else if (top?.name === 'side' && bot && top.chatId) body = <SideChatScreen key={'s' + top.chatId} theme={theme} bot={bot} chatId={top.chatId} onBack={pop} />;
  else if (top?.name === 'voice' && bot) body = <VoiceModeScreen key={'v' + bot.id} theme={theme} bot={bot} onBack={pop} />;
  else if (top?.name === 'avatar' && bot) body = <AvatarEditorScreen key={'a' + bot.id} theme={theme} bot={bot} onBack={pop} />;
  else if (top?.name === 'usage') body = <UsageScreen theme={theme} onBack={pop} />;
  else if (top && (bot || room) && top.name === 'panel') body = <PanelScreen key={'p' + top.target.id} theme={theme} bot={bot} room={room} onClose={pop}
    onSettings={() => push({ name: 'settings', target: top.target })} onMemory={(id) => push({ name: 'memory', target: top.target, memId: id })}
    onOpenBot={(id) => open({ kind: 'bot', id })} onChat={() => open(top.target)} onSchedules={(start) => schedules(start)} onSide={(chatId) => push({ name: 'side', target: top.target, chatId })} />;
  else if (top && (bot || room) && top.name === 'settings') body = <BotSettingsScreen key={'s' + top.target.id} theme={theme} bot={bot} room={room} onBack={pop} onClose={() => setStack((s) => s.slice(0, -2))}
    onAvatar={() => push({ name: 'avatar', target: top.target })} onSchedules={(start) => schedules(start)}
    onMemory={(id) => push({ name: 'memory', target: top.target, memId: id })} onOpenBot={(id) => open({ kind: 'bot', id })} />;
  else if (top && (bot || room) && top.name === 'memory') body = <MemoryScreen key={'m' + top.target.id} theme={theme} id={top.memId ?? top.target.id} name={bot?.name ?? room?.name ?? ''} onBack={pop} />;
  else body = <HomeScreen theme={theme} onOpen={open} onAccount={() => setSettings(true)} onUsage={() => push({ name: 'usage', target: { kind: 'bot', id: '' } })} onNew={setNewChat} onSchedules={() => schedules()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {body}
      {/* TEST-ONLY: appearance self-test runner + overlay; remove before a real release. */}
      <AppearanceTestRunner stack={stack} setStack={setStack} closeSettings={() => setSettings(false)} />
      {client ? <SettingsSheet theme={theme} visible={settings} onClose={() => setSettings(false)} onOpenSettings={(t) => push({ name: 'settings', target: t })} /> : null}
      {client ? <NewChatSheet theme={theme} mode={newChat} onClose={() => setNewChat(null)} onOpen={(t: any) => t.settings ? setStack((s) => [...s, { name: 'chat', target: { kind: 'bot', id: t.id } }, { name: 'settings', target: { kind: 'bot', id: t.id } }]) : open(t)} /> : null}
    </SafeAreaView>
  );
}

function Keyed() { const { lang } = usePrefs(); return <Boundary where="界面"><Root key={lang} /></Boundary>; }

import { Boundary, installGlobalHandler } from './src/errors';
installGlobalHandler();

export default function App() {
  return <Boundary where="App"><SafeAreaProvider><PrefsProvider><StoreProvider><TeamPrefsProvider><View style={{ flex: 1 }}><Keyed /></View></TeamPrefsProvider></StoreProvider></PrefsProvider></SafeAreaProvider></Boundary>;
}

// TEST-ONLY appearance self-test (see src/appearanceTest.tsx). Remove before a real release.
function AppearanceTestRunner({ stack, setStack, closeSettings }: { stack: Route[]; setStack: React.Dispatch<React.SetStateAction<Route[]>>; closeSettings(): void }) {
  const test = useAppearanceTest();
  const { state, previews } = useStore();
  const latest = useRef({ state, previews }); latest.current = { state, previews };
  useEffect(() => {
    if (!test.running) return;
    let cancelled = false;
    const saved = stack;
    closeSettings();
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      const st = latest.current.state;
      const mainId = (st as any)?.mainBotId ?? st?.bots?.[0]?.id ?? '';
      // The chat with the longest messages we know of (longest preview); else the Main Bot.
      const cands: ChatTarget[] = [...(st?.bots ?? []).map((b) => ({ kind: 'bot', id: b.id }) as ChatTarget), ...(st?.rooms ?? []).map((r) => ({ kind: 'room', id: r.id }) as ChatTarget)];
      const len = (t: ChatTarget) => latest.current.previews[t.id]?.text?.length ?? 0;
      const chat = cands.sort((a, b) => len(b) - len(a))[0] ?? { kind: 'bot', id: mainId };
      await wait(800);
      for (const step of STEPS) {
        if (cancelled) return;
        testSet({ override: step.prefs, dark: step.dark, label: step.label });
        setStack(step.view === 'chat' ? [{ name: 'chat', target: chat }] : step.view === 'panel' ? [{ name: 'chat', target: { kind: 'bot', id: mainId } }, { name: 'panel', target: { kind: 'bot', id: mainId } }] : []);
        if (step.poke) { await wait(1500); if (!cancelled) pokeAll(); await wait(step.hold - 1500); } else await wait(step.hold);
      }
      if (cancelled) return;
      testSet({ override: null, dark: null, label: '测试完成' });
      setStack(saved);
      await wait(2500);
      if (!cancelled) stopAppearanceTest();
    })();
    return () => { cancelled = true; setStack(saved); };
  }, [test.running]);
  if (!test.running) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', zIndex: 1000, elevation: 1000 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,.78)', borderRadius: 999, paddingVertical: 6, paddingLeft: 14, paddingRight: 6 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{test.label}</Text>
        <Pressable onPress={stopAppearanceTest} style={{ backgroundColor: '#e5484d', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 }}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>停止</Text></Pressable>
      </View>
    </View>
  );
}
