import { CharacterGrid, LibraryPanel, avatarImage, pickImages } from './AvatarEditor';
// '+' -> what the web UI's New chat offers: message a Bot, Create new Bot, Create group chat.
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Bot } from '../api';
import { AdminStar, Avatar } from '../components/Avatar';
import { Group, PillButton, Row, Sheet } from '../components/ui';
import { useStore } from '../store';
import { t } from '../i18n';
import type { Theme } from '../theme';
import { DEFAULT_COLORS, DEFAULT_SHAPES } from '../avatar/characters';

// create-bot.js randomLook, bot-draft.js freshBotName, shared/mentions.js nameProblem.
const pickOne = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
const randomLook = (avoid: { shape?: string; color?: string } = {}) => ({ shape: pickOne(DEFAULT_SHAPES.filter((x) => x !== avoid.shape)), color: pickOne(DEFAULT_COLORS.filter((x) => x !== avoid.color)) });
function freshBotName(bots: Bot[], base = '新 Bot') {
  const taken = new Set(bots.map((b) => b.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let i = 2; while (taken.has(`${base.toLowerCase()} ${i}`)) i += 1;
  return `${base} ${i}`;
}
function nameProblem(name: string) {
  const s = name.trim();
  if (!s) return 'Bot 需要一个名字';
  if (/[@`\r\n]/.test(s)) return 'Bot 名字里不能有 @、` 或换行';
  if (['all', 'everyone', '所有人', '全体'].includes(s.toLowerCase())) return `「${s}」在群里表示所有人，不能用作 Bot 名字`;
  if (['user', 'you'].includes(s.toLowerCase())) return `「${s}」在对话里表示用户本人，不能用作 Bot 名字`;
  return undefined;
}
import type { ChatTarget } from './HomeScreen';

type Mode = 'chat' | 'group' | 'bot';
export function NewChatSheet({ theme, mode: initial, onClose, onOpen }: { theme: Theme; mode: 'chat' | 'group' | null; onClose(): void; onOpen(t: ChatTarget & { settings?: boolean }): void }) {
  const { client, state, refresh } = useStore();
  const [mode, setMode] = useState<Mode>('chat');
  const [q, setQ] = useState('');
  const [admin, setAdmin] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [look, setLook] = useState(randomLook);
  const [image, setImage] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  const [message, setMessage] = useState('');
  const [model, setModel] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (initial) { setMode(initial); setQ(''); setAdmin(null); setPicked([]); setName(''); setLook(randomLook()); setImage(null); setLibrary(false); setMessage(''); setErr(''); setModel(state?.defaultModel ?? state?.models?.[0]?.ref); } }, [initial]);
  const readOnly = !!state?.readOnly;
  const bots = state?.bots ?? [];
  const w = q.trim().toLowerCase();
  const matches = bots.filter((b) => b.id !== admin && !picked.includes(b.id) && (!w || b.name.toLowerCase().includes(w) || (b.role ?? '').toLowerCase().includes(w)));
  const run = async (f: () => Promise<void>) => { if (busy) return; setBusy(true); setErr(''); try { await f(); } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(false); } };

  const fallbackName = freshBotName(bots);
  const finalName = name.trim() || fallbackName;
  const clash = bots.some((b) => b.name.toLowerCase() === finalName.toLowerCase());
  const problem = nameProblem(finalName);
  const exact = bots.some((b) => b.name.toLowerCase() === w);
  // Web: a new Bot opens on its chat with the settings panel showing.
  const createBot = () => run(async () => {
    if (clash || problem) return;
    const b = await client!.createBot({ name: finalName, color: look.color, avatar: image ? { shape: look.shape, image } : { shape: look.shape }, ...(model ? { model } : {}) } as any);
    await refresh(); onClose(); if (b?.id) onOpen({ kind: 'bot', id: b.id, settings: true } as any);
  });
  const upload = async () => {
    setErr('');
    try { const [a] = await pickImages(false); if (a) setImage(await avatarImage(a)); } catch (e: any) { setErr(String(e?.message ?? e)); }
  };
  // new-chat.js makeGroup: with no message the admin greets and asks what the group is for.
  const createRoom = () => run(async () => {
    const text = message.trim();
    const r = await client!.call<any>('create-room', { members: [admin!, ...picked], admin: admin!, ...(text ? {} : { greet: true }) });
    if (text && r?.id) await client!.send(r.id, text);
    await refresh(); onClose(); if (r?.id) onOpen({ kind: 'room', id: r.id });
  });
  const tap = (b: Bot) => {
    if (mode === 'chat') run(async () => {
      if (b.hidden) await client!.call('set-flags', { id: b.id, hidden: false });
      if (message.trim()) await client!.send(b.id, message.trim());
      await refresh(); onClose(); onOpen({ kind: 'bot', id: b.id });
    });
    else if (!admin) setAdmin(b.id);
    else setPicked((p) => [...p, b.id]);
    setQ('');
  };
  const title = mode === 'bot' ? t.createBot : mode === 'group' ? (admin ? t.pickMembers : t.chooseAdmin) : t.newChat;
  const action = mode === 'bot' ? <PillButton theme={theme} primary title={busy ? t.creating : t.create} disabled={busy || clash || !!problem} onPress={createBot} />
    : mode === 'group' ? <PillButton theme={theme} primary title={busy ? t.creating : t.create} disabled={busy || !admin || picked.length < 1} onPress={createRoom} /> : undefined;
  const input = { color: theme.text, fontSize: 17, paddingHorizontal: 18, paddingVertical: 14 };

  return (
    <Sheet theme={theme} visible={!!initial} onClose={onClose} right={action}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700', marginLeft: 6 }}>{title}</Text>
      {mode === 'bot' ? (
        <>
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Avatar bot={{ id: 'new-bot', name: finalName, color: look.color, avatar: image ? { shape: look.shape, image } : { shape: look.shape } } as any} size={88} ring={theme.bg} />
          </View>
          {/* create-bot.js: 形象 — character grid, then 随机 / 上传照片 / 头像库 / 移除照片; the library opens below. */}
          <Text style={{ color: theme.sub, fontSize: 13, marginLeft: 6, marginTop: 16 }}>形象</Text>
          <CharacterGrid theme={theme} look={look as any} hasPhoto={!!image} onShape={(shape) => { setImage(null); setLook((c) => ({ ...c, shape })); }} onColor={(color) => { setImage(null); setLook((c) => ({ ...c, color })); }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <Pressable onPress={() => { setImage(null); setLook((c) => randomLook(c)); }} style={{ backgroundColor: false ? theme.cardHi : theme.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 }}><Text style={{ color: theme.text }}>随机</Text></Pressable>
            <Pressable onPress={upload} style={{ backgroundColor: false ? theme.cardHi : theme.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 }}><Text style={{ color: theme.text }}>{image ? '更换照片' : '上传照片'}</Text></Pressable>
            <Pressable onPress={() => setLibrary((v) => !v)} style={{ backgroundColor: library ? theme.cardHi : theme.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 }}><Text style={{ color: theme.text }}>头像库</Text></Pressable>
            {image ? <Pressable onPress={() => setImage(null)} style={{ backgroundColor: false ? theme.cardHi : theme.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 }}><Text style={{ color: theme.text }}>移除照片</Text></Pressable> : null}
          </View>
          {library ? <LibraryPanel theme={theme} onPick={(e) => { setImage(e.image); setLibrary(false); }} /> : null}
          <Group theme={theme} title={t.name}><TextInput value={name} onChangeText={setName} autoFocus maxLength={40} style={input} placeholder={fallbackName} placeholderTextColor={theme.faint} /></Group>
          {name.trim() && problem ? <Text style={{ color: theme.danger, marginHorizontal: 6 }}>{problem}</Text> : clash ? <Text style={{ color: theme.danger, marginHorizontal: 6 }}>{`已经有叫 ${finalName} 的 Bot 了`}</Text> : null}
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
                  <Avatar bot={b} size={28} badge={false} ring={theme.card} /><Text style={{ color: theme.text, marginLeft: 6, marginRight: id === admin ? 4 : 0 }}>{b.name}</Text>{id === admin ? <AdminStar /> : null}<Text style={{ color: theme.text }}> ✕</Text>
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
              {w && !exact ? <Row theme={theme} icon="＋" label={`新建 Bot「${q.trim()}」`} onPress={() => { setName(q.trim()); setMode('bot'); }} /> : null}
              <Row theme={theme} icon="＋" label={t.createBot} onPress={() => { setName(q.trim()); setMode('bot'); }} />
              <Row theme={theme} icon="👥" label={t.createGroup} onPress={() => setMode('group')} />
              <Row theme={theme} icon="⌘" label="添加 DSH Agent" value="移动端暂未实现" />
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
      {mode !== 'bot' ? <View style={{ backgroundColor: theme.card, borderRadius: 20, marginTop: 16, paddingHorizontal: 16 }}>
        <TextInput value={message} onChangeText={setMessage} multiline placeholder={mode === 'group' && admin ? `给 ${[admin, ...picked].map((id) => bots.find((b) => b.id === id)?.name).filter(Boolean).join('、')} 发消息` : '给 Bot 发消息'} placeholderTextColor={theme.sub} style={{ color: theme.text, fontSize: 16, minHeight: 44, maxHeight: 140 }} />
      </View> : null}
      {err ? <Text style={{ color: theme.danger, margin: 6, marginTop: 12 }}>{err}</Text> : null}
    </Sheet>
  );
}
