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
import { DetailScreen } from './src/screens/DetailScreen';
import { SettingsSheet } from './src/screens/SettingsSheet';
import { NewChatSheet } from './src/screens/NewChatSheet';

// A tiny stack (home -> chat -> details) keeps native deps out; hardware back pops it.
type Route = { name: 'chat' | 'detail'; target: ChatTarget };

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
  let body: React.ReactNode;
  if (restoring) body = <ActivityIndicator style={{ flex: 1 }} />;
  else if (!client) body = <ConnectScreen theme={theme} />;
  else if (top && (bot || room) && top.name === 'chat') body = <ChatScreen key={top.target.id} theme={theme} bot={bot} room={room} onBack={pop} onDetails={() => push({ name: 'detail', target: top.target })} />;
  else if (top && (bot || room)) body = <DetailScreen key={'d' + top.target.id} theme={theme} bot={bot} room={room} onBack={pop} onOpenBot={(id) => open({ kind: 'bot', id })} />;
  else body = <HomeScreen theme={theme} onOpen={open} onAccount={() => setSettings(true)} onNew={setNewChat} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {body}
      {client ? <SettingsSheet theme={theme} visible={settings} onClose={() => setSettings(false)} /> : null}
      {client ? <NewChatSheet theme={theme} mode={newChat} onClose={() => setNewChat(null)} onOpen={open} /> : null}
    </SafeAreaView>
  );
}

function Keyed() { const { lang } = usePrefs(); return <Root key={lang} />; }

export default function App() {
  return <SafeAreaProvider><PrefsProvider><StoreProvider><View style={{ flex: 1 }}><Keyed /></View></StoreProvider></PrefsProvider></SafeAreaProvider>;
}
