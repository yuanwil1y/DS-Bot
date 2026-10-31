// 侧边对话 (web side-chat.js SideChatView), as a sub-page of the Bot's details.
// Answers land on the team state (sideChats) when done; until then the entry shows 正在回答… + 取消.
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Bot } from '../api';
import { SIDE, sideChatsOf, sideFailure, sideHostText, sideTitle, withPending, type SideEntry } from '../api/side';
import { Markdown } from '../components/Markdown';
import { RoundButton } from '../components/ui';
import { useStore } from '../store';
import type { Theme } from '../theme';

function Entry({ theme, entry, cancelled, onCancel }: { theme: Theme; entry: SideEntry; cancelled: boolean; onCancel(): void }) {
  const [cancelling, setCancelling] = useState(false);
  const status = cancelled || entry.status === 'cancelled' ? 'cancelled' : entry.status;
  const cancel = () => {
    if (cancelling || status !== 'answering') return;
    setCancelling(true);
    onCancel();
    // Keep the pressed look briefly; parent owns the optimistic 已取消.
    setTimeout(() => setCancelling(false), 400);
  };
  const answer = typeof entry.answer === 'string' ? entry.answer : '';
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ maxWidth: '85%', backgroundColor: theme.bubbleMe, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ color: theme.text, fontSize: 15 }}>{entry.question}</Text>
        </View>
      </View>
      <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
        {status === 'answering' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ color: theme.sub, fontSize: 15 }}>{SIDE.answering}</Text>
            <Pressable disabled={cancelling} onPress={cancel} accessibilityLabel={SIDE.cancelLabel} hitSlop={14}
              style={{ paddingHorizontal: 14, minHeight: 36, minWidth: 56, borderRadius: 18, backgroundColor: theme.cardHi, justifyContent: 'center', alignItems: 'center', opacity: cancelling ? 0.5 : 1 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{SIDE.cancel}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {status === 'cancelled' ? <Text style={{ color: theme.sub, fontSize: 13 }}>{SIDE.cancelled}</Text> : null}
            {status === 'failed' ? <Text style={{ color: theme.danger, fontSize: 13 }}>{sideFailure(entry)}</Text> : null}
            {status === 'done' && answer ? <Markdown text={answer} color={theme.text} codeBg={theme.code} size={15} /> : null}
          </>
        )}
      </View>
    </View>
  );
}

export function SideChatScreen({ theme, bot, chatId, onBack }: { theme: Theme; bot: Bot; chatId: string; onBack(): void }) {
  const { client, state, refresh } = useStore();
  const chat = sideChatsOf(state, bot.id).find((c) => c.id === chatId);
  const [pending, setPending] = useState<SideEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [fail, setFail] = useState<string | null>(null);
  // Optimistic cancels (by entry id or pending: key) so 「已取消」 shows before the revision lands.
  const [cancelled, setCancelled] = useState<Record<string, true>>({});
  const cancelQueued = useRef<Set<string>>(new Set());
  const seen = useRef(false);
  const scroll = useRef<any>(null);
  const entries = withPending(chat, pending);
  const busy = entries.some((e) => (cancelled[e.id] ? false : e.status === 'answering'));
  useEffect(() => { if (chat) seen.current = true; else if (seen.current) onBack(); else refresh(); }, [!!chat]);
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [entries.length, entries.at(-1)?.status, Object.keys(cancelled).length]);
  // Drop local cancel marks once the server entry has left answering.
  useEffect(() => {
    if (!chat) return;
    setCancelled((m) => {
      let next = m; let changed = false;
      for (const id of Object.keys(m)) {
        const e = chat.entries.find((x) => x.id === id);
        if (e && e.status !== 'answering') { if (!changed) { next = { ...m }; changed = true; } delete next[id]; }
      }
      return changed ? next : m;
    });
  }, [chat?.entries]);

  const markCancelled = (id: string) => setCancelled((m) => (m[id] ? m : { ...m, [id]: true }));

  const cancelEntry = (entry: SideEntry) => {
    if (!client) return;
    markCancelled(entry.id);
    if (entry.id.startsWith('pending:')) {
      // sideAsk has not returned the real id yet — queue cancel for when it does.
      cancelQueued.current.add(entry.id);
      return;
    }
    client.sideCancel(chatId, entry.id).then((r) => {
      // Race: answer already finished → drop optimistic cancel and show the real status.
      if (r && r.answering === false) setCancelled((m) => { const n = { ...m }; delete n[entry.id]; return n; });
      return refresh();
    }, () => setCancelled((m) => { const n = { ...m }; delete n[entry.id]; return n; }));
  };

  const ask = () => {
    const text = draft.trim();
    if (!text || busy || !client) return;
    setDraft(''); setFail(null);
    const p: SideEntry = { id: `pending:${Date.now()}`, question: text, status: 'answering' };
    setPending((x) => [...x, p]);
    client.sideAsk(bot.id, text, chatId).then(
      (v) => {
        // Swap pending id → real entryId so Cancel can hit side-cancel before refresh.
        setPending((x) => x.map((e) => (e === p || e.id === p.id ? { ...e, id: v.entryId } : e)));
        setCancelled((m) => {
          if (!m[p.id] && !cancelQueued.current.has(p.id)) return m;
          const n = { ...m }; delete n[p.id]; n[v.entryId] = true; return n;
        });
        if (cancelQueued.current.has(p.id) || cancelQueued.current.has(v.entryId)) {
          cancelQueued.current.delete(p.id);
          cancelQueued.current.delete(v.entryId);
          client.sideCancel(chatId, v.entryId).then(refresh, () => {});
        }
        refresh().finally(() => setPending((x) => x.filter((e) => e.id !== v.entryId && e.id !== p.id && e !== p)));
      },
      (e: any) => {
        setPending((x) => x.filter((y) => y !== p && y.id !== p.id));
        cancelQueued.current.delete(p.id);
        setCancelled((m) => { const n = { ...m }; delete n[p.id]; return n; });
        setDraft((v) => (v === '' ? text : v));
        setFail(sideHostText(String(e?.message ?? e)));
      });
  };
  const close = () => { client?.sideClose(chatId).then(refresh, () => {}); onBack(); };

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label="返回" />
        <Text numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '600', marginHorizontal: 8 }}>{sideTitle(chat ?? (pending[0] ? { id: '', botId: '', entries: pending } : undefined))}</Text>
        <RoundButton theme={theme} icon="close" onPress={close} label={SIDE.close} />
      </View>
      <Text style={{ color: theme.sub, fontSize: 12, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: theme.sep }}>{SIDE.note}</Text>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
        {entries.map((e) => <Entry key={e.id.startsWith('pending:') ? e.id : e.id} theme={theme} entry={e} cancelled={!!cancelled[e.id]} onCancel={() => cancelEntry(e)} />)}
      </ScrollView>
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, borderTopWidth: 0.5, borderTopColor: theme.sep }}>
        <TextInput value={draft} editable={!busy} onChangeText={(v) => { setDraft(v); if (fail !== null) setFail(null); }}
          placeholder={SIDE.placeholder} placeholderTextColor={theme.faint} accessibilityLabel={SIDE.placeholder}
          returnKeyType="send" submitBehavior="submit" onSubmitEditing={ask} multiline
          style={{ minHeight: 44, maxHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, backgroundColor: theme.fill, color: theme.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 10, opacity: busy ? 0.6 : 1 }} />
        {fail !== null ? <Text style={{ color: theme.danger, fontSize: 13, marginTop: 6 }}>{fail}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
