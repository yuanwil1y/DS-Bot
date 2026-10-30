// Grok-style chat for a Bot's private chat or a group chat: floating header, cards, pill composer.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Pressable, Share, Text, TextInput, View } from 'react-native';
import {
  addPending, applyFeed, dropPending, emptyChat, emptyRoom, failPending, roomRows, rows, withHistory, withRoomPage,
  type Bot, type ChatModel, type ChatRow, type Room, type RoomModel,
} from '../api';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { Markdown } from '../components/Markdown';
import { Icon, RoundButton } from '../components/ui';
import { useStore } from '../store';
import { fmt, t } from '../i18n';
import type { Theme } from '../theme';

type Props = { theme: Theme; bot?: Bot; room?: Room; onBack(): void; onDetails(): void };

export function ChatScreen({ theme, bot, room, onBack, onDetails }: Props) {
  const { client, subscribe, markRead, setOpenBot, status, opens, streaming, state } = useStore();
  const id = (bot?.id ?? room?.id)!;
  const sessionId = bot ? bot.sessionId ?? bot.id : room!.id;
  const [model, setModel] = useState<ChatModel>(emptyChat);
  const [rmodel, setRModel] = useState<RoomModel>(emptyRoom);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState(false);
  const roomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const byId = useMemo(() => Object.fromEntries((state?.bots ?? []).map((b) => [b.id, b])), [state?.bots]);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      if (bot) { const p = await client.chat(bot.id); setModel((m) => withHistory(m, p.items)); setCursor((c) => c ?? p.cursor); }
      else { const p = await client.roomChat(room!.id); setRModel((m) => withRoomPage(m, p)); setCursor((c) => c ?? p.cursor); }
      setErr('');
    } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setLoading(false); }
  }, [client, id]);

  useEffect(() => { setOpenBot(id); markRead(id); return () => setOpenBot(null); }, [id]);
  useEffect(() => subscribe((e) => {
    if (bot) setModel((m) => applyFeed(m, sessionId, e));
    else if (e.event === 'room' && (e.data as any)?.roomId === id && !roomTimer.current)
      roomTimer.current = setTimeout(() => { roomTimer.current = null; load(); }, 150);
  }), [sessionId, load]);
  // (Re)load on open and after every feed reconnect, to fill gaps.
  useEffect(() => { load(); }, [load, opens]);
  // Groups: while a turn runs, poll the first page as a safety net for live rows.
  useEffect(() => { if (bot || !rmodel.running) return; const h = setInterval(load, 2500); return () => clearInterval(h); }, [rmodel.running, load]);

  async function older() {
    if (!client || !cursor) return;
    try {
      if (bot) { const p = await client.chat(bot.id, cursor); setModel((m) => withHistory(m, p.items)); setCursor(p.cursor); }
      else { const p = await client.roomChat(room!.id, cursor); setRModel((m) => withRoomPage(m, p, false)); setCursor(p.cursor); }
    } catch {}
  }
  async function deliver(s: string, key: string) {
    try { await client!.send(sessionId, s); if (!bot) load(); }
    catch (e: any) {
      setErr(String(e?.message ?? e));
      if (bot) setModel((m) => failPending(m, key)); else setRModel((m) => ({ ...m, pending: m.pending.map((p) => (p.key === key ? { ...p, failed: true } : p)) }));
    }
  }
  function send() {
    const s = text.trim(); if (!s || !client) return;
    setText(''); setErr('');
    if (bot) { const m = addPending(model, s); setModel(m); deliver(s, m.pending!.at(-1)!.key); }
    else { const m = addPending({ items: [], drafts: {}, pending: rmodel.pending }, s); setRModel((r) => ({ ...r, pending: m.pending! })); deliver(s, m.pending!.at(-1)!.key); }
  }
  function retry(r: ChatRow) {
    if (bot) setModel((m) => dropPending(m, r.key)); else setRModel((m) => ({ ...m, pending: m.pending.filter((p) => p.key !== r.key) }));
    setText(r.text);
  }

  const list = useMemo(() => (bot ? rows(model) : roomRows(rmodel)), [bot, model, rmodel]);
  const data = useMemo(() => [...list].reverse(), [list]);
  async function share() {
    setMenu(false);
    const md = list.filter((r) => !r.pending).map((r) => `**${r.kind === 'user' ? t.you : r.name ?? bot?.name ?? ''}**\n\n${r.text}`).join('\n\n---\n\n');
    Share.share({ message: md, title: bot?.name ?? room?.name }).catch(() => {});
  }
  const busy = bot ? !!streaming[bot.id] || Object.keys(model.drafts).length > 0 : !!rmodel.running;
  const members = room ? (room.members ?? []).map((m) => byId[m]).filter(Boolean) : [];
  const name = bot?.name ?? room?.name ?? '';
  const sub = status !== 'open' ? t.offline : busy ? (rmodel.speaking?.length ? rmodel.speaking.map((s) => byId[s]?.name ?? s).join('、') + ' · ' : '') + t.working : '';

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: theme.bg }}>
      {loading ? <ActivityIndicator style={{ marginTop: 120 }} color={theme.sub} /> : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 76 }}
          onEndReached={older}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={{ color: theme.sub, textAlign: 'center', marginTop: 40, transform: [{ scaleY: -1 }] }}>{t.empty}</Text>}
          renderItem={({ item, index }) => {
            const me = item.kind === 'user' || item.kind === 'answer';
            const prev = data[index + 1];
            const speaker = !me && room && item.botId ? byId[item.botId] : undefined;
            const showName = !!room && !me && (prev?.botId !== item.botId || prev?.kind === 'user');
            if (me) return (
              <Pressable disabled={!item.failed} onPress={() => retry(item)} style={{ alignSelf: 'flex-end', maxWidth: '85%', marginVertical: 5, opacity: item.pending && !item.failed ? 0.65 : 1 }}>
                <View style={{ backgroundColor: theme.bubbleMe, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 }}>
                  <Text selectable style={{ color: theme.text, fontSize: 17, lineHeight: 25 }}>{item.text}</Text>
                </View>
                {item.failed ? <Text style={{ color: theme.danger, fontSize: 12, marginTop: 4, textAlign: 'right' }}>{t.failed}</Text> : null}
              </Pressable>
            );
            return (
              <View style={{ marginVertical: 5 }}>
                {showName ? <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginLeft: 4 }}>
                  {speaker ? <Avatar bot={speaker} size={20} /> : null}
                  <Text style={{ color: theme.sub, fontSize: 13, marginLeft: 6 }}>{item.name ?? speaker?.name}</Text>
                </View> : null}
                <View style={{ backgroundColor: theme.bubbleBot, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, alignSelf: 'stretch' }}>
                  <Markdown text={item.text + (item.streaming ? ' ▍' : '')} color={theme.text} codeBg={theme.code} size={17} />
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Floating header: back, centered pill (opens details), more. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label={t.back} />
        <Pressable onPress={onDetails} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 23, paddingLeft: 6, paddingRight: 16, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder, opacity: pressed ? 0.7 : 1, maxWidth: '62%' })}>
          {bot ? <Avatar bot={bot} size={34} ring={theme.fill} /> : <GroupAvatar members={members} size={34} ring={theme.fill} />}
          <View style={{ marginLeft: 8, flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>{name}</Text>
            {sub ? <Text numberOfLines={1} style={{ color: status !== 'open' ? '#f5a623' : theme.sub, fontSize: 11 }}>{sub}</Text> : null}
          </View>
        </Pressable>
        <RoundButton theme={theme} icon="more" onPress={() => setMenu(true)} label={t.more} />
      </View>

      {err ? <Text numberOfLines={2} style={{ color: theme.danger, paddingHorizontal: 20, fontSize: 13 }}>{err}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 52, borderRadius: 26, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder, paddingLeft: 18, paddingRight: 5, paddingVertical: 5 }}>
          <TextInput value={text} onChangeText={setText} placeholder={fmt(t.askBot, { name })} placeholderTextColor={theme.sub} multiline
            style={{ flex: 1, maxHeight: 150, color: theme.text, fontSize: 17, paddingVertical: 8 }} />
          <Pressable onPress={send} disabled={!text.trim()} accessibilityLabel={t.send} style={{ width: 42, height: 42, borderRadius: 21, marginLeft: 6, backgroundColor: text.trim() ? theme.accent : theme.cardHi, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" color={text.trim() ? theme.accentText : theme.sub} size={20} />
          </Pressable>
        </View>
      </View>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable onPress={() => setMenu(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ position: 'absolute', right: 16, top: 64, backgroundColor: theme.cardHi, borderRadius: 18, minWidth: 200, overflow: 'hidden' }}>
            {[{ l: t.details, f: () => { setMenu(false); onDetails(); } }, { l: t.share, f: share }].map((o) => (
              <Pressable key={o.l} onPress={o.f} android_ripple={{ color: theme.fill }} style={{ paddingHorizontal: 18, paddingVertical: 15 }}><Text style={{ color: theme.text, fontSize: 16 }}>{o.l}</Text></Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
