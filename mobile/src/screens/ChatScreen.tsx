import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { applyFeed, emptyChat, rows, withHistory, type Bot, type ChatModel } from '../api';
import { Avatar } from '../components/Avatar';
import { Header } from '../components/Header';
import { Markdown } from '../components/Markdown';
import { useStore } from '../store';
import { t } from '../i18n';
import type { Theme } from '../theme';

export function ChatScreen({ theme, bot, onBack }: { theme: Theme; bot: Bot; onBack: () => void }) {
  const { client, subscribe, markRead, setOpenBot, status, opens, streaming } = useStore();
  const sessionId = bot.sessionId ?? bot.id;
  const [model, setModel] = useState<ChatModel>(emptyChat);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!client) return;
    try { const p = await client.chat(bot.id); setModel((m) => withHistory(m, p.items)); setCursor(p.cursor); setErr(''); }
    catch (e: any) { setErr(String(e?.message ?? e)); } finally { setLoading(false); }
  }, [client, bot.id]);

  useEffect(() => { setOpenBot(bot.id); markRead(bot.id); return () => setOpenBot(null); }, [bot.id]);
  useEffect(() => subscribe((e) => setModel((m) => applyFeed(m, sessionId, e))), [sessionId]);
  // (Re)load history on open and after every feed reconnect, to fill gaps.
  useEffect(() => { load(); }, [load, opens]);

  async function older() {
    if (!client || !cursor) return;
    const p = await client.chat(bot.id, cursor); setModel((m) => withHistory(m, p.items)); setCursor(p.cursor);
  }
  async function send() {
    const s = text.trim(); if (!s || !client) return;
    setText('');
    try { await client.send(sessionId, s); } catch (e: any) { setErr(String(e?.message ?? e)); setText(s); }
  }

  const data = useMemo(() => rows(model).reverse(), [model]);
  const busy = !!streaming[bot.id];
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Header theme={theme} title={bot.name} subtitle={status !== 'open' ? t.offline : busy ? t.working : bot.role} onBack={onBack} right={<View style={{ marginRight: 8 }}><Avatar bot={bot} size={34} working={busy} /></View>} />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ padding: 12 }}
          onEndReached={older}
          ListEmptyComponent={<Text style={{ color: theme.sub, textAlign: 'center', marginTop: 40, transform: [{ scaleY: -1 }] }}>{t.empty}</Text>}
          renderItem={({ item }) => {
            const me = item.kind === 'user' || item.kind === 'answer';
            return (
              <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '86%', marginVertical: 4, backgroundColor: me ? theme.bubbleMe : theme.bubbleBot, borderRadius: 16, borderBottomRightRadius: me ? 4 : 16, borderBottomLeftRadius: me ? 16 : 4, paddingHorizontal: 12, paddingVertical: 8, borderWidth: me ? 0 : 1, borderColor: theme.border }}>
                {me ? <Text selectable style={{ color: '#fff', fontSize: 16, lineHeight: 23 }}>{item.text}</Text>
                  : <Markdown text={item.text + (item.streaming ? ' ▍' : '')} color={theme.text} codeBg={theme.code} />}
              </View>
            );
          }}
        />
      )}
      {err ? <Text style={{ color: '#ef4444', paddingHorizontal: 12 }}>{err}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.card }}>
        <TextInput value={text} onChangeText={setText} placeholder={t.message} placeholderTextColor={theme.sub} multiline
          style={{ flex: 1, maxHeight: 140, color: theme.text, backgroundColor: theme.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 }} />
        <Pressable onPress={send} disabled={!text.trim()} style={{ marginLeft: 8, backgroundColor: theme.accent, opacity: text.trim() ? 1 : 0.4, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t.send}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
