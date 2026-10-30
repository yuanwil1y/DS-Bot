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

function Entry({ theme, chatId, entry }: { theme: Theme; chatId: string; entry: SideEntry }) {
  const { client, refresh } = useStore();
  const [cancelling, setCancelling] = useState(false);
  const cancel = () => {
    if (cancelling || !client || entry.id.startsWith('pending:')) return;
    setCancelling(true);
    client.sideCancel(chatId, entry.id).then(refresh, () => {}).finally(() => setCancelling(false));
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
        {entry.status === 'answering' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: theme.sub, fontSize: 15 }}>{SIDE.answering}</Text>
            <Pressable disabled={cancelling} onPress={cancel} accessibilityLabel={SIDE.cancelLabel}
              style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: theme.cardHi, justifyContent: 'center', opacity: cancelling ? 0.5 : 1 }}>
              <Text style={{ color: theme.text, fontSize: 13 }}>{SIDE.cancel}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {entry.status === 'cancelled' ? <Text style={{ color: theme.sub, fontSize: 13 }}>{SIDE.cancelled}</Text> : null}
            {entry.status === 'failed' ? <Text style={{ color: theme.danger, fontSize: 13 }}>{sideFailure(entry)}</Text> : null}
            {answer ? <Markdown text={answer} color={theme.text} codeBg={theme.code} size={15} /> : null}
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
  const seen = useRef(false);
  const scroll = useRef<any>(null);
  const entries = withPending(chat, pending);
  const busy = entries.some((e) => e.status === 'answering');
  // Opened before the state carried it: fetch once. Closed elsewhere after it was here: go back (web falls back to details).
  useEffect(() => { if (chat) seen.current = true; else if (seen.current) onBack(); else refresh(); }, [!!chat]);
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [entries.length, entries.at(-1)?.status]);

  const ask = () => {
    const text = draft.trim();
    if (!text || busy || !client) return;
    setDraft(''); setFail(null);
    const p: SideEntry = { id: `pending:${Date.now()}`, question: text, status: 'answering' };
    setPending((x) => [...x, p]);
    client.sideAsk(bot.id, text, chatId).then(
      () => refresh().finally(() => setPending((x) => x.filter((e) => e !== p))),
      (e: any) => {
        setPending((x) => x.filter((y) => y !== p));
        // A refused question keeps what was typed unless a new draft replaced it.
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
        {entries.map((e) => <Entry key={e.id} theme={theme} chatId={chatId} entry={e} />)}
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
