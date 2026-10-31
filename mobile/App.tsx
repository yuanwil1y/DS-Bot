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
import { backOne, type NavRoute } from './src/nav';

// A tiny stack (home -> chat -> details) keeps native deps out; hardware back pops it.
type Route = NavRoute<ChatTarget>;

function Root() {
  const theme = useTheme();
  const { client, restoring, state } = useStore();
  const [stack, setStack] = useState<Route[]>([]);
  const [settings, setSettings] = useState(false);
  const [settingsStart, setSettingsStart] = useState<'connectors' | undefined>(undefined);
  const [newChat, setNewChat] = useState<'chat' | 'group' | null>(null);
  const push = (r: Route) => setStack((s) => [...s, r]);
  const stackRef = useRef(stack); stackRef.current = stack;
  // One level up; a screen opened from the settings sheet returns to the sheet (web: "Back to Bots").
  const pop = () => { const r = backOne(stackRef.current); setStack(r.stack); if (r.reopenSheet) { setSettingsStart(undefined); setSettings(true); } };
  // Registered ONCE at mount so it is the OLDEST handler: RN calls the newest first, so each screen's
  // PageHeader handler (inner levels such as 全部记忆→摘要, 单项用量→全部用量) runs before this fallback.
  // (0.9.10 bug: re-registering on every stack change made this the newest and skipped inner levels.)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (stackRef.current.length) { pop(); return true; } return false; });
    return () => sub.remove();
  }, []);
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
  else if (top && (bot || room) && top.name === 'settings') body = <BotSettingsScreen key={'s' + top.target.id} theme={theme} bot={bot} room={room} onBack={pop} backLabel={top.fromSheet ? (room ? '返回群聊' : '返回 Bot') : undefined} onClose={() => (top.fromSheet ? pop() : setStack((s) => s.slice(0, -2)))}
    onAvatar={() => push({ name: 'avatar', target: top.target })} onSchedules={(start) => schedules(start)}
    onMemory={(id) => push({ name: 'memory', target: top.target, memId: id })} onOpenBot={(id) => open({ kind: 'bot', id })} />;
  else if (top && (bot || room) && top.name === 'memory') body = <MemoryScreen key={'m' + top.target.id} theme={theme} id={top.memId ?? top.target.id} name={bot?.name ?? room?.name ?? ''} onBack={pop} />;
  else body = <HomeScreen theme={theme} onOpen={open} onAccount={() => { setSettingsStart(undefined); setSettings(true); }} onConnectors={() => { setSettingsStart('connectors'); setSettings(true); }} onUsage={() => push({ name: 'usage', target: { kind: 'bot', id: '' } })} onNew={setNewChat} onSchedules={() => schedules()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {body}
      {client ? <SettingsSheet theme={theme} visible={settings} startPage={settingsStart} onClose={() => setSettings(false)} onOpenSettings={(t) => push({ name: 'settings', target: t, fromSheet: true })} /> : null}
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

