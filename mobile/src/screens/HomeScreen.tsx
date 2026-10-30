// Grok-style home: top account + '+' buttons, Main Bot centered, bots/groups list (no search, nothing at the bottom).
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { Bot, Room } from '../api';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { Badge, RoundButton, StatusDot } from '../components/ui';
import { Menu } from '../components/Menu';
import { useStore } from '../store';
import { shortTime, t } from '../i18n';
import type { Theme } from '../theme';

export type ChatTarget = { kind: 'bot'; id: string } | { kind: 'room'; id: string };
type Item = { key: string; target: ChatTarget; name: string; preview: string; time?: number; bot?: Bot; members?: Bot[]; unread: number; working: boolean; waiting: boolean; main?: boolean };

export function HomeScreen({ theme, onOpen, onAccount, onNew, onUsage }: { theme: Theme; onOpen(t: ChatTarget): void; onAccount(): void; onUsage(): void; onNew(mode: "chat" | "group"): void }) {
  const { state, status, unread, streaming, waiting, previews, refresh, client } = useStore();
  const q = '';
  const [acct, setAcct] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const bots = state?.bots ?? [];
  const main = bots.find((b) => b.id === state?.mainBotId) ?? bots[0];
  const activity = (state?.activity ?? {}) as Record<string, unknown>;

  const items = useMemo<Item[]>(() => {
    const byId = Object.fromEntries(bots.map((b) => [b.id, b]));
    const list: Item[] = [
      ...bots.map((b) => {
        const p = previews[b.id];
        return { key: b.id, target: { kind: 'bot', id: b.id } as ChatTarget, name: b.name, bot: b, main: b.id === main?.id, preview: p ? (p.who === 'me' ? `${t.you}：` : '') + p.text : b.role ?? '', time: p?.time ?? b.createdAt, unread: unread[b.id] ?? 0, working: !!streaming[b.id] || b.id in activity || (b.sessionId ?? '') in activity, waiting: !!waiting[b.id] };
      }),
      ...((state?.rooms ?? []) as Room[]).map((r) => {
        const p = previews[r.id];
        const text = r.preview ?? (p ? (p.who && p.who !== 'me' ? `${p.who}：` : p.who === 'me' ? `${t.you}：` : '') + p.text : '');
        return { key: r.id, target: { kind: 'room', id: r.id } as ChatTarget, name: r.name, members: (r.members ?? []).map((id) => byId[id]).filter(Boolean), preview: text, time: p?.time ?? r.createdAt, unread: unread[r.id] ?? 0, working: r.id in activity, waiting: !!waiting[r.id] };
      }),
    ];
    const w = q.trim().toLowerCase();
    return list
      .filter((i) => !w || i.name.toLowerCase().includes(w) || (i.bot?.role ?? '').toLowerCase().includes(w) || i.preview.toLowerCase().includes(w))
      .sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  }, [bots, state?.rooms, previews, unread, streaming, waiting, activity, q, main?.id]);

  const header = main && !q ? (
    <Pressable onPress={() => onOpen({ kind: 'bot', id: main.id })} style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 28 }}>
      <Avatar bot={main} size={112} star ring={theme.bg} working={!!streaming[main.id]} />
      <Text style={{ color: theme.sub, fontSize: 16, marginTop: 10 }}>{main.name}</Text>
    </Pressable>
  ) : <View style={{ height: 8 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Pressable onPress={() => setAcct(true)} accessibilityLabel="账户" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder, alignItems: 'center', justifyContent: 'center' }}>
          {main ? <Avatar bot={main} size={34} ring={theme.fill} /> : null}
          <View style={{ position: 'absolute', right: 0, top: 0 }}><StatusDot theme={theme} status={status} /></View>
        </Pressable>
        <RoundButton theme={theme} icon="plus" onPress={() => onNew('chat')} label="新建" />
      </View>
      <FlashList
        data={items}
        keyExtractor={(i) => i.key}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={{ color: theme.sub, textAlign: 'center', marginTop: 40 }}>{q ? t.noMatch : t.noBots}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item.target)} android_ripple={{ color: theme.card }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13 }}>
            {item.bot ? <Avatar bot={item.bot} size={52} working={item.working} star={item.main} ring={theme.bg} /> : <GroupAvatar members={item.members ?? []} size={52} working={item.working} ring={theme.bg} />}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ color: theme.faint, fontSize: 14, marginLeft: 8 }}>{shortTime(item.time)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: item.waiting ? '#f5a623' : theme.sub, fontSize: 15 }}>{item.waiting ? t.waiting : item.working ? `${t.working}…` : item.preview}</Text>
                <View style={{ marginLeft: 8 }}><Badge n={item.unread} theme={theme} /></View>
              </View>
            </View>
          </Pressable>
        )}
      />
      <Menu theme={theme} visible={acct} onClose={() => setAcct(false)} top={64} left={16} items={[
        { label: '用量', onPress: onUsage }, { label: '连接器' }, { label: '自动化任务' }, { label: 'Bot 设置', onPress: onAccount }, { label: '切换经典 Agent 模式', sep: true },
      ]} />
    </View>
  );
}
