import React from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import type { Bot } from '../api';
import { Avatar } from '../components/Avatar';
import { Header } from '../components/Header';
import { useStore } from '../store';
import { t } from '../i18n';
import type { Theme } from '../theme';

export function BotListScreen({ theme, onOpen }: { theme: Theme; onOpen: (b: Bot) => void }) {
  const { state, status, unread, streaming, refresh, disconnect, client } = useStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const activity = state?.activity ?? {};
  const bots = state?.bots ?? [];
  return (
    <View style={{ flex: 1 }}>
      <Header theme={theme} title={t.bots} subtitle={`${client?.conn.baseUrl ?? ''} · ${status === 'open' ? t.online : t.offline}`}
        right={<Pressable onPress={disconnect} style={{ padding: 10 }}><Text style={{ color: theme.accent }}>{t.disconnect}</Text></Pressable>} />
      <FlatList
        data={bots}
        keyExtractor={(b) => b.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={{ color: theme.sub, textAlign: 'center', marginTop: 40 }}>{t.noBots}</Text>}
        renderItem={({ item }) => {
          const working = !!streaming[item.id] || item.id in activity || (item.sessionId ?? '') in activity;
          const n = unread[item.id] ?? 0;
          return (
            <Pressable onPress={() => onOpen(item)} android_ripple={{ color: theme.border }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <Avatar bot={item} working={working} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 13, marginTop: 2 }}>{working ? t.working : item.role ?? ''}</Text>
              </View>
              {n > 0 ? <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{n > 99 ? '99+' : n}</Text></View> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
