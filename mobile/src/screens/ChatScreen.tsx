// Grok-style chat for a Bot's private chat or a group chat: floating header, cards, pill composer.
import { BtwCard } from '../components/BtwCard';
import { LearningCard } from '../components/LearningCard';
import { SIDE, parseSideLine, sideHostText, sideQuery } from '../api/side';
import { VOICE } from '../api/voice';
import { useDictation } from '../hooks/useDictation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, Share, Text, TextInput, ToastAndroid, View } from 'react-native';
import {
  cardsFor, insertMention, mentionCandidates, mentionQuery,
  addPending, speakingList, applyFeed, dropPending, emptyChat, emptyRoom, failPending, roomRows, rows, placeCards, withHistory, withRoomPage,
  type Bot, type ChatModel, type ChatRow, type Room, type RoomModel,
  latestMemoryChange, MEMORY_NOTICE_MS, noteMemoryNews,
} from '../api';
import { Menu } from '../components/Menu';
import * as Clipboard from 'expo-clipboard';
import { ActivityRow } from '../components/ActivityRow';
import { dockModel, workPhrase } from '../api/work';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { botState } from '../avatar/motion';
import { needsCount } from '../api/cards';
import { Markdown } from '../components/Markdown';
import { Boundary } from '../errors';
import { leaveVisit, loadSeen, unreadOf, type Visit } from '../visits';
import { AnsweredView, ShownView, PendingHandoffStub, ApprovalCard, QuestionCard, SecretCard, SettledHandoff, SettledQuestion, ViewCardView } from '../components/Cards';
import { Icon, RoundButton } from '../components/ui';
import { useStore } from '../store';
import { fmt, t } from '../i18n';
import type { Theme } from '../theme';
import { useTeamPrefs } from '../teamPrefs';
import { DEMO_ITEMS, useAppearanceTest } from '../appearanceTest';
import { bubbleMax, flatMax, inkTextHex, leadBubbleMax, userMax } from '../appearance';

type Props = { theme: Theme; bot?: Bot; room?: Room; onBack(): void; onDetails(): void; onSchedule(): void; onSide(chatId: string): void; onVoice(): void; onOpenChat(t: { kind: 'bot' | 'room'; id: string }): void };

export function ChatScreen({ theme, bot, room, onBack, onDetails, onSchedule, onSide, onVoice, onOpenChat }: Props) {
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
  // web cells.js / user-message.js: a message's Copy writes its text to the clipboard.
  const [copyOf, setCopyOf] = useState<string | null>(null);
  const copyText = (s: string) => { setCopyOf(null); Clipboard.setStringAsync(s).then(() => ToastAndroid.show('已复制', ToastAndroid.SHORT)).catch(() => {}); };
  const dictation = useDictation((chunk, final) => {
    if (final) setText((v) => (v ? (v.endsWith(' ') || v.endsWith('\n') ? v : v + ' ') : '') + chunk);
  });
  const toggleDictate = () => {
    if (dictation.listening) dictation.stop();
    else void dictation.start();
  };
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
    const s = text.trim(); if (!s || !client || demo) return; // demo: never sent
    const side = parseSideLine(s);
    if (side) {
      // `/side` never becomes a normal send: a refusal keeps the draft.
      if (!bot) { setErr(SIDE.group); return; }
      if (side.bare) { setErr(SIDE.empty); return; }
      setErr(''); setText('');
      client.sideAsk(bot.id, side.args.trim(), undefined, true).then((v) => { refresh(); onSide(v.chatId); },
        (e: any) => { setText((v) => (v === '' ? s : v)); setErr(sideHostText(String(e?.message ?? e))); });
      return;
    }
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
  const dock = useMemo(() => dockModel(id, byId, state?.rooms ?? [], state?.work), [state, id, byId]);
  const onErr = (e: any) => setErr(String(e?.message ?? e));
  const after = () => { refresh(); load(); };
  const mq = room ? mentionQuery(text) : null;
  // TEST-ONLY: during the appearance self-test this chat shows the fixed local demo conversation.
  const demo = useAppearanceTest().demo === bot?.id && !!bot;
  const list = useMemo(() => (demo ? rows(withHistory(emptyChat(), DEMO_ITEMS)) : bot ? rows(model) : roomRows(rmodel)), [demo, bot, model, rmodel]);
  const data = useMemo(() => [...list].reverse(), [list]);
  async function share() {
    setMenu(false);
    const md = list.filter((r) => !r.pending).map((r) => `**${r.kind === 'user' ? t.you : r.name ?? bot?.name ?? ''}**\n\n${r.text}`).join('\n\n---\n\n');
    Share.share({ message: md, title: bot?.name ?? room?.name }).catch(() => {});
  }
  const botRunning = !!bot && (!!streaming[bot.id] || Object.keys(model.drafts).length > 0);
  const runAt = useRef(0);
  const running = bot ? botRunning : !!rmodel.running;
  if (!running) runAt.current = 0; else if (runAt.current === 0) runAt.current = (bot && (state?.work as any)?.bots?.[bot.id]?.since) || Date.now();
  const members = room ? (room.members ?? []).map((m) => byId[m]).filter(Boolean) : [];
  const name = bot?.name ?? room?.name ?? '';
  const sub = status !== 'open' ? t.offline : '';
  // header.js useMemoryNotice: the pill says 记忆已更新 for 3.2 s after a change lands.
  const memIds = bot ? [bot.id] : room ? [room.id, ...(room.members ?? [])] : [];
  const news = noteMemoryNews(state?.memoryNews);
  const seen = Math.max(0, ...memIds.map((m) => news[m]?.seen ?? 0));
  const [memShown, setMemShown] = useState(false);
  useEffect(() => {
    const left = seen + MEMORY_NOTICE_MS - Date.now();
    setMemShown(seen > 0 && left > 0);
    if (seen === 0 || left <= 0) return undefined;
    const timer = setTimeout(() => setMemShown(false), left);
    return () => clearTimeout(timer);
  }, [seen]);
  const memChanged = latestMemoryChange(news, memIds);
  const memoryNotice = memShown && memChanged !== null && state?.memory !== false;
  // header.js NewMessagePills (down): replies that land while scrolled up.
  const replies = list.reduce((n, r) => n + (r.kind !== 'user' && r.kind !== 'answer' && r.kind !== 'event' && !r.pending && !r.streaming ? 1 : 0), 0);
  const [unpinned, setUnpinned] = useState(false);
  const [release, setRelease] = useState<{ base: number | null; dismissed: boolean }>({ base: null, dismissed: false });
  useEffect(() => { setRelease({ base: unpinned ? replies : null, dismissed: false }); }, [unpinned]);
  const fresh = release.base === null ? 0 : replies - release.base;
  const showDown = unpinned && fresh > 0 && !release.dismissed;
  const listRef = useRef<FlatList<ChatRow>>(null);
  const [colW, setColW] = useState(0);
  const look = useTeamPrefs().resolved;
  // index.js beginVisit/endVisit + cells.js NewDivider + header.js "N 条新消息 ↑".
  const [visit, setVisit] = useState<Visit | null>(null);
  useEffect(() => {
    let live = true; const entered = Date.now();
    const made: any = bot ?? room;
    loadSeen(id).then((seen) => { if (live) setVisit({ seen: seen ?? (made?.createdBy && Number.isFinite(made?.createdAt) ? made.createdAt : null), entered }); });
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') leaveVisit(id); });
    return () => { live = false; sub.remove(); leaveVisit(id); };
  }, [id]);
  const unread = useMemo(() => unreadOf(list, visit), [list, visit]);
  const dividerAt = unread.first === null ? -1 : data.findIndex((r) => r.key === unread.first);
  const [above, setAbove] = useState({ seen: false, dismissed: false, out: false });
  useEffect(() => { setAbove({ seen: false, dismissed: false, out: false }); }, [id, unread.first]);
  const onViewable = useRef((_: any) => {});
  onViewable.current = ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (dividerAt < 0) return;
    const idx = viewableItems.map((v) => v.index ?? -1);
    if (idx.includes(dividerAt)) setAbove((a) => (a.seen ? a : { ...a, seen: true, out: false }));
    else if (idx.length && Math.max(...idx) < dividerAt) setAbove((a) => (a.out ? a : { ...a, out: true }));
  };
  const viewableCb = useRef((info: any) => onViewable.current(info)).current;
  // btw.js BtwTurnTail / learning-card.js LearningTurnTail: cards sit after the turn that owns them.
  const placed = useMemo(() => placeCards(list, botRunning,
    bot ? (((state as any)?.btwCards?.[bot.id] ?? []) as any[]).filter((c) => c?.partId === (bot.sessionId ?? bot.id)) : [],
    bot ? ((state?.learning?.[bot.id] ?? []) as any[]) : []), [list, botRunning, state, bot?.id]);
  const btwView = (c: any) => <BtwCard key={c.id} theme={theme} card={c} onDelete={() => client!.call<any>('btw-delete', { sessionId: c.partId, cardId: c.id }).then(async (r) => { await after(); return r; })} />;
  const learnView = (p: any) => <LearningCard key={p.id} theme={theme} proposal={p} onAnswer={(approve) => client!.learningAnswer(p.id, approve).then(after)} />;
  const showUp = dividerAt >= 0 && above.out && !above.seen && !above.dismissed;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* The empty state sits outside the inverted list: an inverted FlatList flips
          ListEmptyComponent too (both axes on Android), so it rendered mirrored. */}
      {!loading && !data.length ? <View pointerEvents="none" style={{ position: 'absolute', top: 62 + 40, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: theme.sub, textAlign: 'center' }}>{t.empty}</Text>
      </View> : null}
      {loading && !demo ? <ActivityIndicator style={{ marginTop: 120 }} color={theme.sub} /> : (
        <FlatList
          inverted
          ref={listRef}
          onScroll={(e) => { const up = e.nativeEvent.contentOffset.y > 120; if (up !== unpinned) setUnpinned(up); }}
          scrollEventThrottle={100}
          onViewableItemsChanged={viewableCb}
          onScrollToIndexFailed={(e) => listRef.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: true })}
          data={data}
          keyExtractor={(r) => r.key}
          style={{ flex: 1, marginTop: 62 }}
          onLayout={(e) => setColW(e.nativeEvent.layout.width - 28)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 }}
          onEndReached={older}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Boundary where="卡片" inline resetKey={state}><View>
            {bot ? <ActivityRow theme={theme} bot={bot} visible={botRunning && !list.some((r) => r.streaming && r.text)} tool={(state?.work as any)?.bots?.[bot.id]} at={runAt.current} />
              : <ActivityRow theme={theme} mark={<GroupAvatar members={members} size={28} ring={theme.bg} />} visible={!!rmodel.running && !(rmodel.speaking ?? []).length && !list.some((r) => r.streaming && r.text)} at={runAt.current} />}
            {(rmodel.speaking ?? []).filter((b) => !list.some((r) => r.streaming && r.botId === b)).map((b) => { const w = (state?.work as any)?.bots?.[b]; return byId[b] ? (
              <View key={b} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, marginLeft: 4 }}>
                <Avatar bot={byId[b]} size={22} working />
                <Text style={{ color: theme.sub, fontSize: 13, marginLeft: 6 }}>{w?.tool ? `${byId[b].name} · ${workPhrase(w)}…` : `${byId[b].name} 正在输入…`}</Text>
              </View>) : null; })}
            {bot && (state?.work as any)?.bots?.[bot.id]?.tool === 'browser_handoff' ? <PendingHandoffStub theme={theme} /> : null}
            {placed.dock.btw.map(btwView)}
            {placed.dock.learning.map(learnView)}
            {bot ? (cards.secrets ?? []).map((r) => <SecretCard key={JSON.stringify([cards.sessionId, r.id, r.kind])} theme={theme} bot={bot} bots={state?.bots ?? []} request={r} saved={(state?.secrets ?? []).find((x) => x.name === r.name)}
              onSet={(value, scope) => client!.secretSet({ requestId: r.id, value, scope }).then(after)} onAllow={() => client!.secretAllow(r.id).then(after)} onCancel={() => client!.secretCancel(r.id).then(after)} />) : null}
            {cards.question ? <QuestionCard key={cards.question.id} theme={theme} q={cards.question} onError={onErr}
              onAnswer={(a) => client!.answerQuestion(cards.sessionId, cards.question!.id, a).then(after)} onDismiss={() => client!.dismissQuestion(cards.sessionId).then(after)} /> : null}
            {cards.view ? <ViewCardView key={cards.view.id} theme={theme} v={cards.view} onError={onErr}
              onReply={(act, vals) => client!.viewReply(cards.sessionId, cards.view!.id, act, vals).then(after)} onDismiss={() => client!.dismissView(cards.sessionId).then(after)} /> : null}
            {cards.approvals.map((a) => <ApprovalCard key={a.id} theme={theme} a={a} botName={byId[a.botId]?.name ?? 'Bot'} onError={onErr} onAnswer={(c) => client!.approvalAnswer(a.id, c).then(after)} />)}
          </View></Boundary>}
          renderItem={(p) => <Boundary where="消息" inline resetKey={p.item}>{p.item.key === unread.first ? <NewDivider theme={theme} /> : null}{(({ item, index }: { item: ChatRow; index: number }) => {
            if (item.kind === 'event') {
              const ev = item.data?.event;
              if (ev === 'working' || ev === 'approval') return <Pressable onPress={onDetails} style={{ flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginVertical: 6 }}>{item.botId && byId[item.botId] ? <Avatar bot={byId[item.botId]} size={16} /> : null}<Text style={{ color: theme.sub, fontSize: 13, marginLeft: 5 }}>{item.text}</Text></Pressable>;
              return <View style={{ alignItems: 'center', marginVertical: 6 }}><Text style={{ color: ev === 'failed' ? theme.danger : theme.sub, fontSize: 13, textAlign: 'center' }}>{item.text}</Text>
                {ev === 'paused' && room?.paused?.length ? <Pressable onPress={() => client!.continueRoom(room.id).then(refresh).catch(onErr)} style={{ marginTop: 6, paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: theme.cardHi, justifyContent: 'center' }}><Text style={{ color: theme.text, fontSize: 13 }}>继续</Text></Pressable> : null}</View>;
            }
            if (item.kind === 'view' && item.data) return <View style={{ alignSelf: 'stretch', marginVertical: 4 }}><ShownView theme={theme} title={item.data.title} view={item.data.view} /></View>;
            if (item.kind === 'answer' && item.data?.views) return <View style={{ alignSelf: 'flex-end', width: '88%' }}><AnsweredView theme={theme} views={item.data.views} answers={item.data.answers} /></View>;
            if (item.kind === 'answer' && item.data?.handoff) return <View style={{ alignSelf: 'flex-end', width: '88%' }}><SettledHandoff theme={theme} handoff={item.data.handoff} /></View>;
            if (item.kind === 'answer' && item.data) return <View style={{ alignSelf: 'flex-end', width: '88%' }}>{item.data.questions.map((q: any) => <SettledQuestion key={q.id} theme={theme} q={q} answer={item.data.answers.find((x: any) => x.id === q.id)} />)}</View>;
            const me = item.kind === 'user' || item.kind === 'answer';
            const prev = data[index + 1];
            const next = index > 0 ? data[index - 1] : undefined;
            const isBot = (r?: ChatRow) => !!r && r.kind !== 'user' && r.kind !== 'answer' && r.kind !== 'event' && r.kind !== 'view';
            const same = (r?: ChatRow) => !!r && (me ? r.kind === 'user' : isBot(r) && r.botId === item.botId);
            const first = !same(prev); const last = !same(next);
            const speaker = me ? undefined : (item.botId ? byId[item.botId] : undefined) ?? (room ? undefined : bot ?? undefined);
            const col = Math.max(0, colW);
            // styles.js: grouped bubbles round their inner corners to 6px.
            const corners = me
              ? { borderTopRightRadius: first ? 18 : 6, borderBottomRightRadius: last ? 18 : 6 }
              : { borderTopLeftRadius: first ? 18 : 6, borderBottomLeftRadius: last ? 18 : 6 };
            if (me) return (
              <Pressable onLongPress={item.pending ? undefined : () => setCopyOf(item.text)} onPress={item.failed ? () => retry(item) : undefined} style={{ alignSelf: 'flex-end', maxWidth: col ? userMax(col, look.width) : '80%', marginTop: first ? 10 : 4, opacity: item.pending && !item.failed ? 0.65 : 1 }}>
                <View style={{ backgroundColor: theme.bubbleMe, borderRadius: 18, ...corners, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text selectable style={{ color: theme.userText, fontSize: 14, lineHeight: 24 }}>{item.text}</Text>
                </View>
                {item.failed ? <Text style={{ color: theme.danger, fontSize: 12, marginTop: 4, textAlign: 'right' }}>{t.failed}</Text> : null}
              </Pressable>
            );
            const flat = look.layout === 'flat';
            const lead = !!room; // cells.js: group rows carry the speaker's avatar (data-lead)
            const name = item.name ?? speaker?.name ?? 'Bot';
            const when = item.time ? new Date(item.time).toTimeString().slice(0, 5) : '';
            const md = <Markdown text={item.text + (item.streaming ? ' ▍' : '')} color={theme.text} codeBg={theme.code} size={14} />;
            const think = look.thinking && item.data?.reasoning ? <ThinkingRow theme={theme} text={item.data.reasoning} ms={item.data.ms} /> : null;
            const body = md;
            if (flat) return (
              <Pressable onLongPress={item.streaming ? undefined : () => setCopyOf(item.text)} style={{ marginTop: first ? 16 : 10, maxWidth: col ? flatMax(col, look.flatWidth) : '100%' }}>
                {first ? <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 22, marginBottom: 4 }}>
                  {speaker ? <View style={{ marginRight: 8 }}><Avatar bot={speaker} size={22} /></View> : null}
                  <Text style={{ color: theme.text, fontSize: 13, lineHeight: 22, fontWeight: '600' }}>{name}</Text>
                  {when ? <Text style={{ color: theme.sub, fontSize: 11, marginLeft: 6 }}>{when}</Text> : null}
                </View> : null}
                {think}
                {body}
              </Pressable>
            );
            const max = col ? (lead ? leadBubbleMax(col, look.width) : bubbleMax(col, look.width)) : '80%';
            return (
              <Pressable onLongPress={item.streaming ? undefined : () => setCopyOf(item.text)} style={{ marginTop: first ? (room ? 16 : 10) : 4, alignSelf: 'flex-start', maxWidth: max }}>
                {lead && first ? <View style={{ flexDirection: 'row', alignItems: 'baseline', marginLeft: 42, marginBottom: 4 }}>
                  <Text style={{ color: inkTextHex(speaker?.color ?? 'gray', theme.dark), fontSize: 12, lineHeight: 16, fontWeight: '500' }}>{name}</Text>
                  {when ? <Text style={{ color: theme.sub, fontSize: 11, marginLeft: 6 }}>{when}</Text> : null}
                </View> : null}
                {think}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {lead ? <View style={{ width: 22, marginRight: 8 }}>{last && speaker ? <Avatar bot={speaker} size={22} /> : null}</View> : null}
                  <View style={{ flexShrink: 1, backgroundColor: theme.bubbleBot, borderRadius: 18, ...corners, paddingHorizontal: 12, paddingVertical: 7 }}>{body}</View>
                </View>
              </Pressable>
            );
          })(p)}{placed.tails[p.item.key] ? <View>{placed.tails[p.item.key].btw.map(btwView)}{placed.tails[p.item.key].learning.map(learnView)}</View> : null}</Boundary>}
        />
      )}

      {/* Floating header: back, centered pill (opens details), more. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label={t.back} size={36} />
        <Pressable onPress={onDetails} accessibilityLabel={memoryNotice ? `记忆已更新，打开 ${byId[memChanged!]?.name ?? name} 的记忆` : '查看对话详情'} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 40, borderRadius: 20, paddingLeft: 7.5, paddingRight: 13.5, paddingVertical: 7.5, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.fillBorder, opacity: pressed ? 0.7 : 1, maxWidth: '62%' })}>
          {bot ? <Avatar bot={bot} size={24} ring={theme.bg} live badge={false} state={botState(botRunning, (state?.activity as any)?.[bot.id], !!needsCount(state)[bot.id])} /> : <GroupAvatar members={members} size={24} ring={theme.bg} />}
          <View style={{ marginLeft: 8, flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{name}</Text>
            {memoryNotice ? <Text numberOfLines={1} accessibilityLiveRegion="polite" style={{ color: theme.sub, fontSize: 11 }}>🧠 记忆已更新</Text> : null}
            {sub ? <Text numberOfLines={1} style={{ color: status !== 'open' ? '#f5a623' : theme.sub, fontSize: 11 }}>{sub}</Text> : null}
          </View>
        </Pressable>
        <View style={{ width: 36 }} />
      </View>

      {showUp ? (
        <View style={{ position: 'absolute', top: 62 + 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: 17, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.fillBorder }}>
          <Pressable onPress={() => { setAbove((a) => ({ ...a, seen: true })); listRef.current?.scrollToIndex({ index: dividerAt, viewPosition: 0.8, animated: true }); }} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 6, height: 34 }}>
            <Text style={{ color: theme.text, fontSize: 13 }}>↑ {unread.count === 1 ? '1 条新消息' : unread.count > 0 ? `${unread.count} 条新消息` : '新消息'}</Text>
          </Pressable>
          <Pressable onPress={() => setAbove((a) => ({ ...a, dismissed: true }))} accessibilityLabel="关闭新消息提示" hitSlop={8} style={{ paddingLeft: 4, paddingRight: 12, height: 34, justifyContent: 'center' }}><Text style={{ color: theme.sub, fontSize: 13 }}>✕</Text></Pressable>
        </View>
      ) : null}
      {showDown ? (
        <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: 17, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.fillBorder, marginBottom: 8 }}>
          <Pressable onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 6, height: 34 }}>
            <Text style={{ color: theme.text, fontSize: 13 }}>↓ {fresh === 1 ? '1 条新消息' : `${fresh} 条新消息`}</Text>
          </Pressable>
          <Pressable onPress={() => setRelease((r) => ({ ...r, dismissed: true }))} accessibilityLabel="关闭新消息提示" hitSlop={8} style={{ paddingLeft: 4, paddingRight: 12, height: 34, justifyContent: 'center' }}><Text style={{ color: theme.sub, fontSize: 13 }}>✕</Text></Pressable>
        </View>
      ) : null}
      {dock ? (
        <Pressable onPress={() => (dock.open.details ? onDetails() : onOpenChat({ kind: 'room', id: dock.open.session! }))} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: 16, paddingLeft: 6, paddingRight: 13, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder, marginBottom: 8, maxWidth: '90%' }}>
          {dock.faces.map((f, i) => byId[f.id] ? <View key={f.id} style={{ marginLeft: i ? -5 : 0 }}><Avatar bot={byId[f.id]} size={20} ring={theme.fill} />{f.ask ? <View style={{ position: 'absolute', right: -1, bottom: -1, width: 7, height: 7, borderRadius: 4, backgroundColor: '#e3a008' }} /> : null}</View> : null)}
          <Text numberOfLines={1} style={{ fontSize: 13, marginLeft: 8, flexShrink: 1 }}>
            {dock.waiting ? <Text style={{ color: '#f0b84a' }}>{dock.waiting}</Text> : null}
            {dock.waiting && dock.doing ? <Text style={{ color: theme.faint }}>{' · '}</Text> : null}
            {dock.doing ? <Text style={{ color: theme.sub }}>{dock.doing}</Text> : null}
          </Text>
        </Pressable>
      ) : null}
      {bot && sideQuery(text) ? (
        <View style={{ marginHorizontal: 14, borderRadius: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.fillBorder, overflow: 'hidden' }}>
          <Pressable onPress={() => setText('/side ')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: pressed ? theme.cardHi : 'transparent' })}>
            <Text style={{ color: theme.text, fontSize: 16 }}>side</Text>
            <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 14, marginLeft: 10, flex: 1 }}>{SIDE.hint}</Text>
          </Pressable>
        </View>
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
      {dictation.note ? <Text numberOfLines={1} style={{ color: theme.danger, paddingHorizontal: 20, fontSize: 12 }}>{dictation.note}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 16, paddingRight: 11, paddingBottom: 13 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 45, borderRadius: 22, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.composerBorder, padding: 7.5 }}>
          <Pressable onPress={() => setMenu(true)} accessibilityLabel="添加" style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.tool, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" color={theme.sub} size={14} />
          </Pressable>
          <TextInput value={text} onChangeText={setText} placeholder={`给 ${name} 发消息`} placeholderTextColor={theme.faint} multiline
            style={{ flex: 1, maxHeight: 150, color: theme.text, fontSize: 16, lineHeight: 24, paddingVertical: 2, paddingHorizontal: 8, marginVertical: 0 }} />
          <Pressable onPress={toggleDictate} accessibilityLabel={dictation.listening ? VOICE.stopDictate : VOICE.dictate}
            style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: dictation.listening ? '#ff3e51' : theme.tool, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" color={dictation.listening ? '#fff' : theme.sub} size={16} />
          </Pressable>
          {text.trim() ? (
            <Pressable onPress={send} accessibilityLabel={t.send} style={{ width: 28, height: 28, borderRadius: 14, marginLeft: 8, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" color={theme.accentText} size={16} />
            </Pressable>
          ) : bot ? (
            <Pressable onPress={onVoice} accessibilityLabel={VOICE.startVoice}
              style={{ width: 28, height: 28, borderRadius: 14, marginLeft: 8, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="voice" color={theme.accentText} size={18} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Menu theme={theme} visible={copyOf !== null} onClose={() => setCopyOf(null)} bottom={80} items={[{ label: '复制', onPress: () => copyText(copyOf ?? '') }]} />
      <Menu theme={theme} visible={menu} onClose={() => setMenu(false)} bottom={80} items={[{ label: '定时任务', onPress: onSchedule }]} />
    </KeyboardAvoidingView>
  );
}

// cells.js NewDivider: a line with 新 before the first row since the last visit.
function NewDivider({ theme }: { theme: Theme }) {
  return <View accessibilityRole="none" accessibilityLabel="新消息" style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: theme.accent, opacity: 0.2 }} />
    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '500', marginHorizontal: 8 }}>新</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: theme.accent, opacity: 0.2 }} />
  </View>;
}

// web cells.js Reasoning (.bt-think): a closed <details> 「思考过程 · Ns」; tap opens the text
// (13/18 ink-2, 2px line-2 left rule, padding-left 10, five lines then scrolls).
function ThinkingRow({ theme, text, ms }: { theme: Theme; text: string; ms?: number }) {
  const [open, setOpen] = useState(false);
  const secs = ms !== undefined ? Math.floor(Math.max(1000, ms) / 1000) : null;
  const label = secs === null ? '' : ` · ${secs >= 60 ? `${Math.floor(secs / 60)}m ` : ''}${secs % 60}s`;
  return (
    <View style={{ marginTop: 2, marginBottom: 4 }}>
      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={6}><Text style={{ color: theme.sub, fontSize: 13, lineHeight: 18 }}>思考过程{label}</Text></Pressable>
      {open ? <ScrollView nestedScrollEnabled style={{ marginTop: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: theme.border, maxHeight: 90 }}>
        <Text selectable style={{ color: theme.sub, fontSize: 13, lineHeight: 18 }}>{text}</Text>
      </ScrollView> : null}
    </View>
  );
}
