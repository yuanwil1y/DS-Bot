import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Bot } from './src/api';
import { StoreProvider, useStore } from './src/store';
import { useTheme } from './src/theme';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { BotListScreen } from './src/screens/BotListScreen';
import { ChatScreen } from './src/screens/ChatScreen';

function Root() {
  const theme = useTheme();
  const { client, restoring, state } = useStore();
  const [chatId, setChatId] = useState<string | null>(null);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (chatId) { setChatId(null); return true; } return false; });
    return () => sub.remove();
  }, [chatId]);
  useEffect(() => { if (!client) setChatId(null); }, [client]);
  const bot: Bot | undefined = state?.bots.find((b) => b.id === chatId);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {restoring ? <ActivityIndicator style={{ flex: 1 }} />
        : !client ? <ConnectScreen theme={theme} />
        : bot ? <ChatScreen key={bot.id} theme={theme} bot={bot} onBack={() => setChatId(null)} />
        : <BotListScreen theme={theme} onOpen={(b) => setChatId(b.id)} />}
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><StoreProvider><View style={{ flex: 1 }}><Root /></View></StoreProvider></SafeAreaProvider>;
}
