import { FTLabel } from '../featureTest'; // TEST-ONLY
// exchange.js ExchangeDialog (0.2.4): what two Bots said to each other, as a bottom sheet.
// Polls `exchange` every 2 s (8 s in the background) and redraws only on a change.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { Markdown } from './Markdown';
import { FoldMarkdown } from './Fold';
import { FOLD_AT, stripLongNote } from '../api/fold';
import { colorOf } from '../avatar/characters';
import { inkTextHex } from '../appearance';
import { useStore } from '../store';
import type { Theme } from '../theme';

export type ExchangeEntry = { id: string; from: string; to: string; text: string; time: number; length?: number };

const clock = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
/** text.js dayLabel in zh-CN: 今天 14:05 / 10月30日周五 14:05. */
export function dayLabel(ms: number, now = new Date()) {
  const d = new Date(ms);
  return d.toDateString() === now.toDateString() ? `今天 ${clock(ms)}` : `${d.getMonth() + 1}月${d.getDate()}日周${WEEK[d.getDay()]} ${clock(ms)}`;
}
/** Which entries draw a day label: more than 30 minutes after the one before. */
export const dayBreaks = (entries: { time: number }[]) => { let last = 0; return entries.map((e) => { const show = e.time - last > 30 * 60 * 1000; last = e.time; return show; }); };

export function ExchangeSheet({ theme, pair, onClose }: { theme: Theme; pair: [string, string] | null; onClose(): void }) {
  const { client, state } = useStore();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<ExchangeEntry[] | null>(null);
  const log = useRef<any>(null);
  const atEnd = useRef(true);
  useEffect(() => {
    if (!pair || !client) return;
    let stop = false; let timer: any; let seen: string | null = null;
    atEnd.current = true; setEntries(null);
    const load = async () => {
      const result = await client.exchange(pair[0], pair[1]).catch(() => []);
      if (stop) return;
      const key = JSON.stringify(result ?? []);
      if (key !== seen) { seen = key; setEntries(result ?? []); }
      timer = setTimeout(load, AppState.currentState === 'active' ? 2000 : 8000);
    };
    void load();
    return () => { stop = true; clearTimeout(timer); };
  }, [pair?.[0], pair?.[1], client]);
  const byId = Object.fromEntries((state?.bots ?? []).map((b) => [b.id, b]));
  const left = pair ? byId[pair[0]] : undefined;
  const right = pair ? byId[pair[1]] : undefined;
  const breaks = entries ? dayBreaks(entries) : [];
  const hint = (text: string) => <Text style={{ color: theme.faint, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>{text}</Text>;
  return <Modal visible={!!pair} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
    <View accessibilityLabel="Bot 间对话" style={{ maxHeight: '85%', backgroundColor: theme.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: insets.bottom + 12 }}>
      <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder }}>
          {left ? <Avatar bot={left} size={22} badge={false} /> : null}<Text style={{ color: theme.text, fontSize: 14 }}>{left?.name ?? '?'}</Text>
          <Text style={{ color: theme.sub, fontSize: 14 }}>⇄</Text>
          {right ? <Avatar bot={right} size={22} badge={false} /> : null}<Text style={{ color: theme.text, fontSize: 14 }}>{right?.name ?? '?'}</Text>
        </View>
      </View>
      <ScrollView ref={log} accessibilityLabel="Bot 间对话记录" style={{ paddingHorizontal: 16 }}
        onContentSizeChange={() => { if (atEnd.current) log.current?.scrollToEnd({ animated: false }); }}
        onScroll={(e) => { const n = e.nativeEvent; atEnd.current = n.contentSize.height - n.contentOffset.y - n.layoutMeasurement.height < 2; }} scrollEventThrottle={64}>
        {entries === null ? hint('加载中…') : entries.length === 0 ? hint('还没有消息') : entries.map((entry, at) => {
          const bot: any = byId[entry.from] ?? { id: entry.from, name: '你', color: 'gray' };
          const whole = entry.length === undefined ? undefined : { length: entry.length, load: () => client!.exchangeText(entry.id).catch(() => undefined) };
          return <View key={entry.id}>
            {breaks[at] ? <Text style={{ color: theme.faint, fontSize: 12, textAlign: 'center', marginVertical: 10 }}>{dayLabel(entry.time)}</Text> : null}
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: inkTextHex(colorOf(bot), theme.dark), fontSize: 12, fontWeight: '600', marginLeft: 30, marginBottom: 2 }}>{bot.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <View style={{ width: 30 }}><Avatar bot={bot} size={22} badge={false} /></View>
                <View style={{ flexShrink: 1, backgroundColor: theme.bubbleBot, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <FoldMarkdown theme={theme} text={stripLongNote(entry.text)} limit={FOLD_AT} whole={whole} render={(x) => <Markdown text={x} color={theme.text} codeBg={theme.code} size={14} />} />
                </View>
              </View>
            </View>
          </View>;
        })}
      </ScrollView>
      <View style={{ alignItems: 'center', paddingTop: 12 }}>
        <Pressable onPress={onClose} style={({ pressed }) => ({ height: 34, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center', backgroundColor: theme.cardHi, opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: theme.text, fontSize: 14 }}>关闭</Text>
        </Pressable>
      </View>
    </View>
    <FTLabel />
  </Modal>;
}
