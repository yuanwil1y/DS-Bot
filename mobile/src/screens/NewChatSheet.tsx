// '+' -> what the web UI's New chat offers: message a Bot, Create new Bot, Create group chat.
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Bot } from '../api';
import { Avatar } from '../components/Avatar';
import { Group, PillButton, Row, Sheet } from '../components/ui';
import { useStore } from '../store';
import { t } from '../i18n';
import type { Theme } from '../theme';
import type { ChatTarget } from './HomeScreen';

type Mode = 'chat' | 'group' | 'bot';
export function NewChatSheet({ theme, mode: initial, onClose, onOpen }: { theme: Theme; mode: 'chat' | 'group' | null; onClose(): void; onOpen(t: ChatTarget): void }) {
  const { client, state, refresh } = useStore();
  const [mode, setMode] = useState<Mode>('chat');
  const [q, setQ] = useState('');
  const [admin, setAdmin] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [model, setModel] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (initial) { setMode(initial); setQ(''); setAdmin(null); setPicked([]); setName(''); setRole(''); setErr(''); setModel(state?.defaultModel); } }, [initial]);
  const readOnly = !!state?.readOnly;
  const bots = state?.bots ?? [];
  const w = q.trim().toLowerCase();
  const matches = bots.filter((b) => b.id !== admin && !picked.includes(b.id) && (!w || b.name.toLowerCase().includes(w) || (b.role ?? '').toLowerCase().includes(w)));
  const run = async (f: () => Promise<void>) => { if (busy) return; setBusy(true); setErr(''); try { await f(); } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(false); } };

  const createBot = () => run(async () => {
    const b = await client!.createBot({ name: name.trim(), role: role.trim() || undefined, model });
    await refresh(); onClose(); if (b?.id) onOpen({ kind: 'bot', id: b.id });
  });
  const createRoom = () => run(async () => {
    const r = await client!.createRoom([admin!, ...picked], admin!);
    await refresh(); onClose(); if (r?.id) onOpen({ kind: 'room', id: r.id });
  });
  const tap = (b: Bot) => {
    if (mode === 'chat') { onClose(); onOpen({ kind: 'bot', id: b.id }); }
    else if (!admin) setAdmin(b.id);
    else setPicked((p) => [...p, b.id]);
    setQ('');
  };
  const title = mode === 'bot' ? t.createBot : mode === 'group' ? (admin ? t.pickMembers : t.chooseAdmin) : t.newChat;
  const action = mode === 'bot' ? <PillButton theme={theme} primary title={busy ? t.creating : t.create} disabled={busy || !name.trim()} onPress={createBot} />
    : mode === 'group' ? <PillButton theme={theme} primary title={busy ? t.creating : t.create} disabled={busy || !admin || picked.length < 1} onPress={createRoom} /> : undefined;
  const input = { color: theme.text, fontSize: 17, paddingHorizontal: 18, paddingVertical: 14 };

  return (
    <Sheet theme={theme} visible={!!initial} onClose={onClose} right={action}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700', marginLeft: 6 }}>{title}</Text>
      {mode === 'bot' ? (
        <>
          <Group theme={theme} title={t.name}><TextInput value={name} onChangeText={setName} autoFocus style={input} placeholder={t.newBot} placeholderTextColor={theme.faint} /></Group>
          <Group theme={theme} title={t.role}><TextInput value={role} onChangeText={setRole} style={input} /></Group>
          {state?.models?.length ? <Group theme={theme} title={t.model}>
            {state.models.map((m) => <Row key={m.ref} theme={theme} label={m.name} caption={m.providerName} value={m.ref === model ? '✓' : ''} onPress={() => setModel(m.ref)} chevron={false} />)}
          </Group> : null}
        </>
      ) : (
        <>
          {mode === 'group' && (admin || picked.length) ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {[admin!, ...picked].filter(Boolean).map((id) => {
                const b = bots.find((x) => x.id === id); if (!b) return null;
                return <Pressable key={id} onPress={() => (id === admin ? (setAdmin(null), setPicked([])) : setPicked((p) => p.filter((x) => x !== id)))} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 18, paddingLeft: 4, paddingRight: 12, height: 36 }}>
                  <Avatar bot={b} size={28} star={id === admin} ring={theme.card} /><Text style={{ color: theme.text, marginLeft: 6 }}>{b.name} ✕</Text>
                </Pressable>;
              })}
            </View>
          ) : null}
          {mode === 'group' && admin && picked.length < 1 ? <Text style={{ color: theme.sub, margin: 6, marginTop: 10 }}>{t.addOneMore}</Text> : null}
          <View style={{ backgroundColor: theme.card, borderRadius: 24, marginTop: 16, paddingHorizontal: 16 }}>
            <TextInput value={q} onChangeText={setQ} placeholder={t.search} placeholderTextColor={theme.sub} style={{ color: theme.text, fontSize: 17, height: 48 }} />
          </View>
          {mode === 'chat' && !readOnly ? (
            <Group theme={theme}>
              <Row theme={theme} icon="＋" label={t.createBot} onPress={() => { setName(q.trim()); setMode('bot'); }} />
              <Row theme={theme} icon="👥" label={t.createGroup} onPress={() => setMode('group')} />
            </Group>
          ) : null}
          <Group theme={theme}>
            {matches.length ? matches.map((b) => (
              <Pressable key={b.id} onPress={() => tap(b)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                <Avatar bot={b} size={40} ring={theme.card} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{b.name}</Text>
                  {b.role ? <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 13 }}>{b.role}</Text> : null}
                </View>
              </Pressable>
            )) : <Row theme={theme} label={t.noMatch} />}
          </Group>
        </>
      )}
      {err ? <Text style={{ color: theme.danger, margin: 6, marginTop: 12 }}>{err}</Text> : null}
    </Sheet>
  );
}
