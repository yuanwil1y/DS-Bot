// Grok-style chat for a Bot's private chat or a group chat: floating header, cards, pill composer.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Pressable, Share, Text, TextInput, ToastAndroid, View } from 'react-native';
import {
  cardsFor, insertMention, mentionCandidates, mentionQuery, roomWork,
  addPending, speakingList, applyFeed, dropPending, emptyChat, emptyRoom, failPending, roomRows, rows, withHistory, withRoomPage,
  type Bot, type ChatModel, type ChatRow, type Room, type RoomModel,
} from '../api';
import { Menu } from '../components/Menu';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { Markdown } from '../components/Markdown';
import { Boundary } from '../errors';
import { ApprovalCard, QuestionCard, SettledQuestion, ViewCardView } from '../components/Cards';
import { Icon, RoundButton } from '../components/ui';
import { useStore } from '../store';
import { fmt, t } from '../i18n';
import type { Theme } from '../theme';

type Props = { theme: Theme; bot?: Bot; room?: Room; onBack(): void; onDetails(): void };

export function ChatScreen({ theme, bot, room, onBack, onDetails }: Props) {
  const { client, subscribe, markRead, setOpenBot, status, opens, streaming, state, refresh } = useStore();
  const id = (bot?.id ?? room?.id)!;
  const sessionId = bot ? bot.sessionId ?? bot.id : room!.id;
  const [model, setModel] = useState<ChatModel>(emptyChat);
  const [rmodel, setRModel] = useState<RoomModel>(emptyRoom);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState(false);
  const setNa = (what: string) => ToastAndroid.show(`${what}：暂不支持`, ToastAndroid.SHORT);
  const [stopping, setStopping] = useState(false);
  const stopRound = () => { if (!client || !room) return; setStopping(true); client.stopRoomWork(room.id).then(() => { refresh(); load(); }).catch(onErr).finally(() => setStopping(false)); };
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
  const progTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useCallback(() => {
    if (!client || bot || progTimer.current) return;
    progTimer.current = setTimeout(() => {
      progTimer.current = null;
      client.roomProgress(room!.id).then((p) => setRModel((m) => ({ ...m, running: p.length > 0 || m.running, speaking: speakingList(p.map((x) => x.speaking)) }))).catch(() => {});
    }, 300);
  }, [client, id]);
  // Live: private chats apply message/stream; groups re-read the first page on each
  // `room` event (new row, round start/end) and ask room-progress on `live` ticks.
  useEffect(() => subscribe((e) => {
    if (bot) setModel((m) => applyFeed(m, sessionId, e));
    else if (e.event === 'room' && (e.data as any)?.roomId === id && !roomTimer.current)
      roomTimer.current = setTimeout(() => { roomTimer.current = null; load(); }, 150);
    else if (e.event === 'live') progress();
  }), [sessionId, load, progress]);
  // (Re)load on open and after every feed reconnect, to fill gaps.
  useEffect(() => { load(); }, [load, opens]);

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

  const target = bot ? { kind: 'bot' as const, id: bot.id } : { kind: 'room' as const, id: room!.id };
  const cards = useMemo(() => cardsFor(state, target), [state, id]);
  const work = useMemo(() => (room ? roomWork(state, room.id) : []), [state, id]);
  const onErr = (e: any) => setErr(String(e?.message ?? e));
  const after = () => { refresh(); load(); };
  const mq = room ? mentionQuery(text) : null;
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
          style={{ flex: 1, marginTop: 62 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 }}
          onEndReached={older}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Boundary where="卡片" inline resetKey={state}><View>
            {(rmodel.speaking ?? []).filter((b) => !list.some((r) => r.streaming && r.botId === b)).map((b) => (
              <View key={b} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, marginLeft: 4 }}>
                {byId[b] ? <Avatar bot={byId[b]} size={20} working /> : null}
                <Text style={{ color: theme.sub, fontSize: 13, marginLeft: 6 }}>{`${byId[b]?.name ?? 'Bot'} 正在输入…`}</Text>
              </View>))}
            {cards.question ? <QuestionCard key={cards.question.id} theme={theme} q={cards.question} onError={onErr}
              onAnswer={(a) => client!.answerQuestion(cards.sessionId, cards.question!.id, a).then(after)} onDismiss={() => client!.dismissQuestion(cards.sessionId).then(after)} /> : null}
            {cards.view ? <ViewCardView key={cards.view.id} theme={theme} v={cards.view} onError={onErr}
              onReply={(act, vals) => client!.viewReply(cards.sessionId, cards.view!.id, act, vals).then(after)} onDismiss={() => client!.dismissView(cards.sessionId).then(after)} /> : null}
            {cards.approvals.map((a) => <ApprovalCard key={a.id} theme={theme} a={a} botName={byId[a.botId]?.name ?? 'Bot'} onError={onErr} onAnswer={(c) => client!.approvalAnswer(a.id, c).then(after)} />)}
          </View></Boundary>}
          ListEmptyComponent={<Text style={{ color: theme.sub, textAlign: 'center', marginTop: 40, transform: [{ scaleY: -1 }] }}>{t.empty}</Text>}
          renderItem={(p) => <Boundary where="消息" inline resetKey={p.item}>{(({ item, index }: { item: ChatRow; index: number }) => {
            if (item.kind === 'event') return <Text style={{ color: theme.sub, fontSize: 13, textAlign: 'center', marginVertical: 6 }}>{item.text}</Text>;
            if (item.kind === 'answer' && item.data) return <View style={{ alignSelf: 'flex-end', width: '88%' }}>{item.data.questions.map((q: any) => <SettledQuestion key={q.id} theme={theme} q={q} answer={item.data.answers.find((x: any) => x.id === q.id)} />)}</View>;
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
          })(p)}</Boundary>}
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
        <View style={{ width: 46 }} />
      </View>

      {work.length ? (
        <Pressable onPress={onDetails} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: 16, paddingHorizontal: 12, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder, marginBottom: 4, maxWidth: '90%' }}>
          {work.slice(0, 3).map((w) => byId[w.botId] ? <Avatar key={w.botId} bot={byId[w.botId]} size={20} ring={theme.fill} /> : null)}
          <Text numberOfLines={1} style={{ color: work.some((w) => w.state === 'ask') ? '#f0b84a' : theme.sub, fontSize: 13, marginLeft: 6, flexShrink: 1 }}>
            {[work.filter((w) => w.state === 'ask').length ? `${work.filter((w) => w.state === 'ask').map((w) => byId[w.botId]?.name).join('、')} 等你批准` : '',
              work.filter((w) => w.state === 'work').length ? `${work.filter((w) => w.state === 'work').map((w) => byId[w.botId]?.name).join('、')} 正在干活…` : ''].filter(Boolean).join(' · ')}
          </Text>
        </Pressable>
      ) : null}
      {mq != null ? (
        <View style={{ marginHorizontal: 14, borderRadius: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.fillBorder, maxHeight: 240, overflow: 'hidden' }}>
          {[...mentionCandidates(members, mq), ...('all'.includes(mq.toLowerCase()) ? [{ id: '@all', name: 'all' }] : [])].map((m: any) => (
            <Pressable key={m.id} onPress={() => setText((s) => insertMention(s, m.name))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: pressed ? theme.cardHi : 'transparent' })}>
              {byId[m.id] ? <Avatar bot={byId[m.id]} size={26} ring={theme.card} /> : <View style={{ width: 26 }} />}
              <Text style={{ color: theme.text, fontSize: 16, marginLeft: 10 }}>{m.id === '@all' ? '@all（所有成员）' : m.name}</Text>
              {m.id === room?.admin ? <Text style={{ color: theme.sub, fontSize: 11, marginLeft: 6 }}>管理员</Text> : null}
            </Pressable>))}
        </View>
      ) : null}
      {err ? <Text numberOfLines={2} style={{ color: theme.danger, paddingHorizontal: 20, fontSize: 13 }}>{err}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 52, borderRadius: 26, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder, paddingLeft: 5, paddingRight: 5, paddingVertical: 5 }}>
          <Pressable onPress={() => setMenu(true)} accessibilityLabel="添加" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" color={theme.text} size={20} />
          </Pressable>
          <TextInput value={text} onChangeText={setText} placeholder={`给 ${name} 发消息`} placeholderTextColor={theme.sub} multiline
            style={{ flex: 1, maxHeight: 150, color: theme.text, fontSize: 17, paddingVertical: 8, marginLeft: 10 }} />
          {text.trim() ? (
            <Pressable onPress={send} accessibilityLabel={t.send} style={{ width: 42, height: 42, borderRadius: 21, marginLeft: 6, backgroundColor: '#4d6bfe', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" color="#fff" size={20} />
            </Pressable>
          ) : room && rmodel.running ? (
            <Pressable onPress={stopRound} disabled={stopping} accessibilityLabel="停止" style={{ width: 42, height: 42, borderRadius: 21, marginLeft: 6, backgroundColor: theme.text, alignItems: 'center', justifyContent: 'center', opacity: stopping ? 0.5 : 1 }}>
              <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: theme.bg }} />
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => setNa('听写')} accessibilityLabel="听写" style={{ width: 42, height: 42, borderRadius: 21, marginLeft: 6, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="mic" color={theme.sub} size={16} />
              </Pressable>
              <Pressable onPress={() => setNa('语音对话')} accessibilityLabel="开始语音对话" style={{ width: 42, height: 42, borderRadius: 21, marginLeft: 6, backgroundColor: '#4d6bfe', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>⦙⦙</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <Menu theme={theme} visible={menu} onClose={() => setMenu(false)} bottom={80} items={[{ label: '添加文件' }, { label: '引用对话' }, { label: '定时任务' }]} />
    </KeyboardAvoidingView>
  );
}
