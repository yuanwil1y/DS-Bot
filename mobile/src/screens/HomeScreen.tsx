// Grok-style home: top account + '+' buttons, Main Bot centered, bots/groups list (no search, nothing at the bottom).
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { needsCount, type Bot, type Room } from '../api';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { RoundButton, StatusDot } from '../components/ui';
import * as Clipboard from 'expo-clipboard';
import { Menu } from '../components/Menu';
import { useStore } from '../store';
import { t } from '../i18n';
import { workLine, workPhrase, type Doing } from '../api/work';
import type { Theme } from '../theme';

export type ChatTarget = { kind: 'bot'; id: string } | { kind: 'room'; id: string };
type Item = { key: string; target: ChatTarget; name: string; preview: string; time?: number; bot?: Bot; members?: Bot[]; unread: number; working: boolean; waiting: boolean; needs?: number; main?: boolean; pinned?: boolean };

export function HomeScreen({ theme, onOpen, onAccount, onNew, onUsage, onSchedules }: { theme: Theme; onOpen(t: ChatTarget): void; onAccount(): void; onUsage(): void; onSchedules(): void; onNew(mode: "chat" | "group"): void }) {
  const { state, status, unread, streaming, previews, refresh } = useStore();
  const needs = useMemo(() => needsCount(state), [state]);
  const needTotal = Object.values(needs).reduce((a, b) => a + b, 0);
  const [acct, setAcct] = useState(false);
  // context-menu.js: 复制对话 ID copies the Bot's current session id (or the group id).
  const [ctx, setCtx] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const bots = state?.bots ?? [];
  const main = bots.find((b) => b.id === state?.mainBotId) ?? bots[0];
  const activity = (state?.activity ?? {}) as Record<string, unknown>;

  // web sidebar.js TeamSidebar/BotRow/RoomRow: Main Bot on top (not in the list),
  // then pinned first, then most recently updated; hidden rows drop out; the preview
  // line is what the Bot is doing, where it works, who it waits for, or the last turn.
  const items = useMemo<Item[]>(() => {
    const byId = Object.fromEntries(bots.map((b) => [b.id, b]));
    const roomsById = Object.fromEntries(((state?.rooms ?? []) as Room[]).map((r) => [r.id, r]));
    const work = (state?.work ?? {}) as any;
    const groupsOf = (id: string) => Object.entries((work.rooms ?? {}) as Record<string, any[]>).flatMap(([roomId, es]) => es.filter((e) => e.botId === id).map((e) => ({ roomId, ...e })));
    const waitsFor = (id: string, b: Bot) => {
      const w = (work.waiting?.[id] ?? b.waiting) as any;
      const names = [...(w?.bots ?? []).map((x: string) => byId[x]?.name), ...(w?.rooms ?? []).map((x: string) => roomsById[x]?.name)].filter(Boolean);
      return names.length ? `等 ${names.join('、')} 交回` : '';
    };
    const list: Item[] = [
      ...bots.filter((b) => b.id !== main?.id && !b.hidden).map((b) => {
        const p = previews[b.id];
        const running = !!streaming[b.id];
        const doing = activity[b.id] as Doing;
        const groups = groupsOf(b.id);
        const away = !running && groups.length > 0;
        const line = running && doing ? `${workPhrase(doing)}…`
          : away ? workLine(roomsById[groups[0].roomId]?.name ?? '一个群聊', groups[0], groups.length - 1)
            : (!running && !needs[b.id] && doing === 'waiting' ? waitsFor(b.id, b) : '') || (p?.text ?? '').replace(/\s+/g, ' ').trim();
        return { key: b.id, target: { kind: 'bot', id: b.id } as ChatTarget, name: b.name, bot: b, pinned: !!b.pinned, preview: line, time: p?.time ?? b.createdAt, unread: unread[b.id] ?? 0, working: running || away, waiting: !!needs[b.id], needs: needs[b.id] ?? 0 };
      }),
      ...((state?.rooms ?? []) as Room[]).filter((r) => !(r as any).hidden).map((r) => {
        const p = previews[r.id];
        const members = (work.rooms?.[r.id] ?? []) as any[];
        const first = byId[members[0]?.botId];
        const line = first ? workLine(first.name, members[0], members.length - 1) : (r.preview?.replace(/\s+/g, ' ').trim() || (p?.text ?? '').replace(/\s+/g, ' ').trim());
        return { key: r.id, target: { kind: 'room', id: r.id } as ChatTarget, name: r.name, pinned: !!(r as any).pinned, members: (r.members ?? []).map((id) => byId[id]).filter(Boolean), preview: line, time: p?.time ?? r.createdAt, unread: unread[r.id] ?? 0, working: members.length > 0, waiting: !!needs[r.id], needs: needs[r.id] ?? 0 };
      }),
    ];
    return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.time ?? 0) - (a.time ?? 0));
  }, [bots, state?.rooms, state?.work, previews, unread, streaming, activity, main?.id, needs]);

  const header = main ? (
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
        <View style={{ flexDirection: 'row' }}>
          <RoundButton theme={theme} icon="plus" onPress={() => onNew('chat')} label="新建" />
        </View>
      </View>
      <FlashList
        data={items}
        keyExtractor={(i) => i.key}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={{ color: theme.sub, textAlign: 'center', marginTop: 40 }}>{t.noBots}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item.target)} onLongPress={() => setCtx(item.bot ? item.bot.sessionId ?? item.bot.id : item.target.id)} android_ripple={{ color: theme.card }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13 }}>
            {item.bot ? <Avatar bot={item.bot} size={52} working={item.working} star={item.main} ring={theme.bg} /> : <GroupAvatar members={item.members ?? []} size={52} working={item.working} ring={theme.bg} />}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text numberOfLines={1} style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>{item.name}{item.pinned ? '  📌' : ''}</Text>
              {item.preview ? <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 15, marginTop: 4 }}>{item.preview}</Text> : null}
            </View>
            {item.waiting ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f5a623', marginLeft: 8 }} />
              : item.unread > 0 ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.badge, marginLeft: 8 }} /> : null}
          </Pressable>
        )}
      />
      <Menu theme={theme} visible={ctx !== null} onClose={() => setCtx(null)} items={[{ label: '复制对话 ID', onPress: () => { Clipboard.setStringAsync(ctx ?? ''); setCtx(null); } }]} />
      <Menu theme={theme} visible={acct} onClose={() => setAcct(false)} top={64} left={16} items={[
        { label: '用量', onPress: onUsage }, { label: '连接器' }, { label: '自动化任务', onPress: onSchedules }, { label: 'Bot 设置', onPress: onAccount }, { label: '切换经典 Agent 模式', sep: true },
      ]} />
    </View>
  );
}
