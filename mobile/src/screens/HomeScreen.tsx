// Home = the web's phone drawer (sidebar.js wide list): brand + search/new, Main Bot tile, rows, account at the foot.
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { botState, type MarkState } from '../avatar/motion';
import { needsCount, type Bot, type Room } from '../api';
import { Avatar, GroupAvatar, Mark } from '../components/Avatar';
import { MAIN_LOOK } from '../avatar/characters';
import { Icon, RoundButton, StatusDot } from '../components/ui';
import * as Clipboard from 'expo-clipboard';
import { Menu } from '../components/Menu';
import { useStore } from '../store';
import { t } from '../i18n';
import { workLine, workPhrase, type Doing } from '../api/work';
import type { Theme } from '../theme';

export type ChatTarget = { kind: 'bot'; id: string } | { kind: 'room'; id: string };
type Item = { key: string; target: ChatTarget; name: string; preview: string; time?: number; bot?: Bot; members?: Bot[]; unread: number; working: boolean; waiting: boolean; needs?: number; main?: boolean; pinned?: boolean; state?: MarkState };

export function HomeScreen({ theme, onOpen, onAccount, onNew, onUsage, onSchedules }: { theme: Theme; onOpen(t: ChatTarget): void; onAccount(): void; onUsage(): void; onSchedules(): void; onNew(mode: "chat" | "group"): void }) {
  const { state, status, unread, streaming, previews, refresh } = useStore();
  const needs = useMemo(() => needsCount(state), [state]);
  const needTotal = Object.values(needs).reduce((a, b) => a + b, 0);
  const [acct, setAcct] = useState(false);
  const [soon, setSoon] = useState(false);
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
        return { key: b.id, target: { kind: 'bot', id: b.id } as ChatTarget, name: b.name, bot: b, pinned: !!b.pinned, preview: line, time: p?.time ?? b.createdAt, unread: unread[b.id] ?? 0, working: running || away, waiting: !!needs[b.id], needs: needs[b.id] ?? 0, state: botState(running || away, doing, !!needs[b.id]) };
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

  // sidebar.js wide list (the phone drawer): .bt-tile for the Main Bot (60px mark, 13/18 name,
  // role chip), then .bt-row rows (36px mark, 14/20 name, 13/18 preview, 8px unread dot).
  const header = main ? (
    <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 15 }}>
      <Pressable onPress={() => onOpen({ kind: 'bot', id: main.id })} style={({ pressed }) => ({ width: 95, alignItems: 'center', gap: 4, paddingTop: 6, paddingHorizontal: 8, paddingBottom: 4, borderRadius: 12, backgroundColor: pressed ? theme.active : 'transparent' })}>
        <Avatar bot={main} size={60} star ring={theme.sidebar} live state={botState(!!streaming[main.id], activity[main.id], !!needs[main.id])} />
        <Text numberOfLines={1} style={{ color: theme.text, fontSize: 13, lineHeight: 18, maxWidth: 84 }}>{main.name}</Text>
        {main.role ? <View style={{ paddingVertical: 1, paddingHorizontal: 4, borderRadius: 4, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.hover }}><Text numberOfLines={1} style={{ color: theme.sub, fontSize: 11, lineHeight: 16 }}>{main.role}</Text></View> : null}
      </Pressable>
    </View>
  ) : <View style={{ height: 8 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.sidebar, paddingHorizontal: 12, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 6, paddingRight: 8, marginRight: 'auto' }}>
          <Mark look={MAIN_LOOK as any} size={22} />
          <Text style={{ color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.15 }}>DS Bot</Text>
          <StatusDot theme={theme} status={status} />
        </View>
        <RoundButton theme={theme} icon="search" onPress={() => setSoon(true)} label="搜索" />
        <RoundButton theme={theme} icon="plus" onPress={() => onNew('chat')} label="新建…" />
      </View>
      <View style={{ flex: 1, marginRight: -12 }}>
      <FlashList
        data={items}
        keyExtractor={(i) => i.key}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingRight: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={{ color: theme.sub, textAlign: 'center', marginTop: 40, fontSize: 13 }}>{t.noBots}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item.target)} onLongPress={() => setCtx(item.bot ? item.bot.sessionId ?? item.bot.id : item.target.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, padding: 8, marginBottom: 3, borderRadius: 10, backgroundColor: pressed ? theme.hover : 'transparent' })}>
            {item.bot ? <Avatar bot={item.bot} size={36} state={item.state} live star={item.main} ring={theme.sidebar} /> : <GroupAvatar members={item.members ?? []} size={36} ring={theme.sidebar} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, lineHeight: 20, flexShrink: 1 }}>{item.name}</Text>
                {item.pinned ? <Icon name="pin" color={theme.text} /> : null}
              </View>
              {item.preview ? <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 13, lineHeight: 18 }}>{item.preview}</Text> : null}
            </View>
            {!item.bot && item.waiting ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.star, marginRight: 2 }} />
              : item.unread > 0 ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginRight: 2 }} /> : null}
          </Pressable>
        )}
      />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 8 }}>
        <Pressable onPress={() => setAcct(true)} accessibilityLabel="账户" style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: pressed ? theme.youHi : theme.you, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' })}>
          <Mark look={MAIN_LOOK as any} size={24} />
        </Pressable>
      </View>
      <Menu theme={theme} visible={soon} onClose={() => setSoon(false)} top={56} left={150} items={[{ label: '搜索：移动端暂未实现' }]} />
      <Menu theme={theme} visible={ctx !== null} onClose={() => setCtx(null)} items={[{ label: '复制对话 ID', onPress: () => { Clipboard.setStringAsync(ctx ?? ''); setCtx(null); } }]} />
      <Menu theme={theme} visible={acct} onClose={() => setAcct(false)} bottom={56} left={12} items={[
        { label: '用量', onPress: onUsage }, { label: '连接器' }, { label: '自动化任务', onPress: onSchedules }, { label: 'Bot 设置', onPress: onAccount }, { label: '切换经典 Agent 模式', sep: true },
      ]} />
    </View>
  );
}
