// "需要你处理" + recent notices. Open items come from state (they clear when answered);
// the history is the server's notice list, filled from the feed.
import React, { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { needsYou, noticeTarget, type Notice } from '../api';
import { Avatar } from '../components/Avatar';
import { RoundButton } from '../components/ui';
import { useStore } from '../store';
import { shortTime } from '../i18n';
import type { Theme } from '../theme';
import type { ChatTarget } from './HomeScreen';

const KIND: Record<string, string> = { question: '提问', view: '视图', approval: '等你批准', learning: '想学技能', browser: '交给你浏览器', message: '私聊', group: '群聊', done: '做完了' };

export function NoticesScreen({ theme, onBack, onOpen }: { theme: Theme; onBack(): void; onOpen(t: ChatTarget): void }) {
  const { state, notices } = useStore();
  const byId = useMemo(() => Object.fromEntries((state?.bots ?? []).map((b) => [b.id, b])), [state?.bots]);
  const rooms = useMemo(() => Object.fromEntries((state?.rooms ?? []).map((r) => [r.id, r])), [state?.rooms]);
  const needs = needsYou(state);
  type Row = { key: string; head?: string; botId?: string; title: string; text: string; time?: number; target?: ChatTarget | null; hot?: boolean };
  const data: Row[] = [
    { key: 'h1', head: needs.length ? `需要你处理 · ${needs.length}` : '没有需要你处理的事', title: '', text: '' },
    ...needs.map((n) => ({ key: n.key, botId: n.botId, title: `${byId[n.botId]?.name ?? ''}${n.target.kind === 'room' ? ` · ${rooms[n.target.id]?.name ?? '群聊'}` : ''} · ${KIND[n.kind]}`, text: n.text, time: n.time, target: n.target as ChatTarget, hot: true })),
    { key: 'h2', head: '最近提醒', title: '', text: '' },
    ...notices.map((n: Notice) => ({ key: `n${n.seq}`, botId: n.botId, title: `${n.name ?? ''}${n.title ? ` · ${n.title}` : ''} · ${KIND[n.kind] ?? n.kind}`, text: n.text ?? '', time: n.time, target: noticeTarget(n) as ChatTarget | null })),
  ];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label="返回" />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginLeft: 14 }}>提醒</Text>
      </View>
      <FlatList data={data} keyExtractor={(r) => r.key} renderItem={({ item }) => item.head != null
        ? <Text style={{ color: theme.sub, fontSize: 13, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>{item.head}</Text>
        : (
          <Pressable disabled={!item.target} onPress={() => item.target && onOpen(item.target)} android_ripple={{ color: theme.card }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 }}>
            {item.botId && byId[item.botId] ? <Avatar bot={byId[item.botId]} size={40} ring={theme.bg} /> : <View style={{ width: 40 }} />}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row' }}>
                <Text numberOfLines={1} style={{ flex: 1, color: item.hot ? '#f5a623' : theme.text, fontSize: 15, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: theme.faint, fontSize: 13, marginLeft: 8 }}>{shortTime(item.time)}</Text>
              </View>
              <Text numberOfLines={2} style={{ color: theme.sub, fontSize: 14, marginTop: 2 }}>{item.text}</Text>
            </View>
          </Pressable>
        )} />
    </View>
  );
}
