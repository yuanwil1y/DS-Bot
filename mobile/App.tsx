import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { PrefsProvider, usePrefs } from './src/prefs';
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

// A tiny stack (home -> chat -> details) keeps native deps out; hardware back pops it.
type Route = { name: 'chat' | 'panel' | 'settings' | 'memory' | 'usage' | 'schedules' | 'avatar' | 'side'; target: ChatTarget; memId?: string; start?: string; chatId?: string };

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
  else if (top && (bot || room) && top.name === 'chat') body = <ChatScreen key={top.target.id} theme={theme} bot={bot} room={room} onBack={pop} onDetails={() => push({ name: 'panel', target: top.target })} onSchedule={() => schedules(top.target.id)} onSide={(chatId) => push({ name: 'side', target: top.target, chatId })} />;
  else if (top?.name === 'schedules') body = <SchedulesScreen key={'sc' + (top.start ?? '')} theme={theme} start={top.start} onBack={pop} />;
  else if (top?.name === 'side' && bot && top.chatId) body = <SideChatScreen key={'s' + top.chatId} theme={theme} bot={bot} chatId={top.chatId} onBack={pop} />;
  else if (top?.name === 'avatar' && bot) body = <AvatarEditorScreen key={'a' + bot.id} theme={theme} bot={bot} onBack={pop} />;
  else if (top?.name === 'usage') body = <UsageScreen theme={theme} onBack={pop} />;
  else if (top && (bot || room) && top.name === 'panel') body = <PanelScreen key={'p' + top.target.id} theme={theme} bot={bot} room={room} onClose={pop}
    onSettings={() => push({ name: 'settings', target: top.target })} onMemory={(id) => push({ name: 'memory', target: top.target, memId: id })}
    onOpenBot={(id) => push({ name: 'panel', target: { kind: 'bot', id } })} onChat={() => open(top.target)} onSchedules={(start) => schedules(start)} onSide={(chatId) => push({ name: 'side', target: top.target, chatId })} />;
  else if (top && (bot || room) && top.name === 'settings') body = <BotSettingsScreen key={'s' + top.target.id} theme={theme} bot={bot} room={room} onBack={pop} onClose={() => setStack((s) => s.slice(0, -2))}
    onAvatar={() => push({ name: 'avatar', target: top.target })} onSchedules={(start) => schedules(start)} />;
  else if (top && (bot || room) && top.name === 'memory') body = <MemoryScreen key={'m' + top.target.id} theme={theme} id={top.memId ?? top.target.id} name={bot?.name ?? room?.name ?? ''} onBack={pop} />;
  else body = <HomeScreen theme={theme} onOpen={open} onAccount={() => setSettings(true)} onUsage={() => push({ name: 'usage', target: { kind: 'bot', id: '' } })} onNew={setNewChat} onSchedules={() => schedules()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {body}
      {client ? <SettingsSheet theme={theme} visible={settings} onClose={() => setSettings(false)} /> : null}
      {client ? <NewChatSheet theme={theme} mode={newChat} onClose={() => setNewChat(null)} onOpen={open} /> : null}
    </SafeAreaView>
  );
}

function Keyed() { const { lang } = usePrefs(); return <Boundary where="界面"><Root key={lang} /></Boundary>; }

import { Boundary, installGlobalHandler } from './src/errors';
installGlobalHandler();

export default function App() {
  return <Boundary where="App"><SafeAreaProvider><PrefsProvider><StoreProvider><View style={{ flex: 1 }}><Keyed /></View></StoreProvider></PrefsProvider></SafeAreaProvider></Boundary>;
}
