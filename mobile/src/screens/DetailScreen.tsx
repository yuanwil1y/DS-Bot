// Bot / group details in Grok's bot-page style: big avatar, name, Edit pill, grouped rows.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import type { Bot, Room } from '../api';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { Group, PillButton, Row, RoundButton, Sheet } from '../components/ui';
import { useStore } from '../store';
import { fmt, t } from '../i18n';
import type { Theme } from '../theme';

const n = (x: number) => (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : String(x));

export function DetailScreen({ theme, bot, room, onBack, onOpenBot }: { theme: Theme; bot?: Bot; room?: Room; onBack(): void; onOpenBot(id: string): void }) {
  const { client, state, refresh } = useStore();
  const [usage, setUsage] = useState<any>(null);
  const [memory, setMemory] = useState<any>(null);
  const [sheet, setSheet] = useState<null | 'usage' | 'memory' | 'edit' | 'instructions'>(null);
  const readOnly = !!state?.readOnly || !!client?.hello?.readOnly;
  const isMain = !!bot && (state?.mainBotIds as string[] | undefined ?? [state?.mainBotId]).includes(bot.id);
  const byId = Object.fromEntries((state?.bots ?? []).map((b) => [b.id, b]));
  const model = bot ? state?.models?.find((m) => m.ref === (bot.model ?? bot.appliedModel)) : undefined;

  useEffect(() => {
    if (!client || !bot) return;
    client.usage(bot.id).then(setUsage).catch(() => {});
    client.memory(bot.id).then(setMemory).catch(() => {});
  }, [client, bot?.id]);

  const members = room ? (room.members ?? []).map((m) => byId[m]).filter(Boolean) : [];
  const name = bot?.name ?? room?.name ?? '';
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label={t.back} />
        <RoundButton theme={theme} icon="share" onPress={() => Share.share({ message: bot ? `${bot.name}${bot.role ? ` · ${bot.role}` : ''}` : name }).catch(() => {})} label={t.share} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          {bot ? <Avatar bot={bot} size={120} star={isMain} ring={theme.bg} /> : <GroupAvatar members={members} size={120} ring={theme.bg} />}
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '700', marginTop: 14 }}>{name}</Text>
          {bot?.role ? <Text style={{ color: theme.sub, fontSize: 15, marginTop: 4 }}>{bot.role}</Text> : null}
          {bot && !readOnly ? <View style={{ marginTop: 14 }}><PillButton theme={theme} title={t.edit} onPress={() => setSheet('edit')} /></View> : null}
        </View>

        {bot ? (
          <>
            <Group theme={theme}>
              <Row theme={theme} icon="🧠" label={t.memory} value={memory ? String(memory.entries?.length ?? 0) : ''} onPress={() => setSheet('memory')} />
              <Row theme={theme} icon="◔" label={t.usage} value={usage ? `${usage.day.calls} ${t.calls}` : ''} onPress={() => setSheet('usage')} />
              <Row theme={theme} icon="✦" label={t.model} value={model?.name ?? bot.model ?? ''} />
              {bot.workDir ? <Row theme={theme} icon="▢" label={t.workingFolder} value={bot.workDir} /> : null}
              <Row theme={theme} icon="✎" label={t.instructions} value={bot.instructions ? '' : '—'} caption={bot.instructions || undefined} onPress={bot.instructions ? () => setSheet('instructions') : undefined} />
            </Group>
            {isMain ? <Group theme={theme}><Row theme={theme} icon="★" label={t.mainBot} value="✓" /></Group> : null}
          </>
        ) : (
          <>
            <Group theme={theme} title={fmt(t.members, { count: members.length })}>
              {members.map((m) => (
                <Row key={m.id} theme={theme} label={m.name} value={m.id === room?.admin ? t.admin : m.role} onPress={() => onOpenBot(m.id)}
                  right={undefined} icon={undefined} />
              ))}
            </Group>
            {room?.notice ? <Group theme={theme}><Row theme={theme} label="📌" caption={room.notice} /></Group> : null}
          </>
        )}
      </ScrollView>

      <Sheet theme={theme} visible={sheet === 'usage'} onClose={() => setSheet(null)}>
        <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700', marginLeft: 6 }}>{t.usage}</Text>
        {!usage ? <ActivityIndicator style={{ marginTop: 30 }} /> : usage.month.calls === 0 ? <Text style={{ color: theme.sub, margin: 8, marginTop: 20 }}>{t.noUsage}</Text> : (
          <>
            <Group theme={theme}>
              {(['day', 'week', 'month'] as const).map((k) => <Row key={k} theme={theme} label={t[k]} value={`${usage[k].calls} ${t.calls}`} caption={`${t.tokensIn} ${n(usage[k].input)} · ${t.cache} ${n(usage[k].cacheRead)} · ${t.tokensOut} ${n(usage[k].output)}`} />)}
            </Group>
            <Group theme={theme} title={t.model}>
              {(usage.models ?? []).map((m: any) => <Row key={m.key} theme={theme} label={m.name ?? m.key} value={`${m.calls} ${t.calls}`} caption={`${t.tokensIn} ${n(m.input)} · ${t.tokensOut} ${n(m.output)}`} />)}
            </Group>
          </>
        )}
      </Sheet>

      {bot ? <MemorySheet theme={theme} visible={sheet === 'memory'} onClose={() => setSheet(null)} bot={bot} memory={memory} setMemory={setMemory} readOnly={readOnly} /> : null}
      {bot ? <EditSheet theme={theme} visible={sheet === 'edit'} onClose={() => setSheet(null)} bot={bot} onSaved={() => { setSheet(null); refresh(); }} /> : null}
      <Sheet theme={theme} visible={sheet === 'instructions'} onClose={() => setSheet(null)}>
        <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700', marginLeft: 6 }}>{t.instructions}</Text>
        <Text selectable style={{ color: theme.text, fontSize: 16, lineHeight: 24, margin: 6, marginTop: 16 }}>{bot?.instructions}</Text>
      </Sheet>
    </View>
  );
}

function MemorySheet({ theme, visible, onClose, bot, memory, setMemory, readOnly }: { theme: Theme; visible: boolean; onClose(): void; bot: Bot; memory: any; setMemory(m: any): void; readOnly: boolean }) {
  const { client } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const entries: any[] = memory?.entries ?? [];
  async function add() {
    if (!client || !text.trim()) return;
    setBusy(true); setErr('');
    try { setMemory(await client.memoryAdd(bot.id, text.trim())); setText(''); } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(false); }
  }
  return (
    <Sheet theme={theme} visible={visible} onClose={onClose}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700', marginLeft: 6 }}>{fmt('{name} · ' + t.memory, { name: bot.name })}</Text>
      {memory?.summary ? <Text style={{ color: theme.sub, margin: 6, marginTop: 12, lineHeight: 21 }}>{String(memory.summary)}</Text> : null}
      {entries.length === 0 ? <Text style={{ color: theme.sub, margin: 6, marginTop: 20 }}>{t.nothingSaved}</Text> : (
        <Group theme={theme}>
          {entries.map((e, i) => <Row key={e.id ?? i} theme={theme} label={String(e.text ?? e)} value={e.scope === 'team' ? t.teamMemory : e.topic ?? undefined} />)}
        </Group>
      )}
      {!readOnly ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 10 }}>
          <TextInput value={text} onChangeText={setText} placeholder={t.addMemory} placeholderTextColor={theme.sub} maxLength={memory?.limits?.entry ?? 300}
            style={{ flex: 1, color: theme.text, backgroundColor: theme.card, borderRadius: 22, paddingHorizontal: 16, height: 46, fontSize: 16 }} />
          <PillButton theme={theme} title={t.add} primary disabled={busy || !text.trim()} onPress={add} />
        </View>
      ) : null}
      {err ? <Text style={{ color: theme.danger, margin: 6 }}>{err}</Text> : null}
    </Sheet>
  );
}

function EditSheet({ theme, visible, onClose, bot, onSaved }: { theme: Theme; visible: boolean; onClose(): void; bot: Bot; onSaved(): void }) {
  const { client } = useStore();
  const [name, setName] = useState(bot.name);
  const [role, setRole] = useState(bot.role ?? '');
  const [ins, setIns] = useState(bot.instructions ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setName(bot.name); setRole(bot.role ?? ''); setIns(bot.instructions ?? ''); setErr(''); } }, [visible]);
  async function save() {
    if (!client) return; setBusy(true); setErr('');
    try { await client.updateBot(bot.id, { name: name.trim(), role: role.trim(), instructions: ins }); onSaved(); } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(false); }
  }
  const input = { color: theme.text, fontSize: 17, paddingHorizontal: 18, paddingVertical: 14 };
  return (
    <Sheet theme={theme} visible={visible} onClose={onClose} right={<PillButton theme={theme} title={busy ? '…' : t.save} primary disabled={busy || !name.trim()} onPress={save} />}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700', marginLeft: 6 }}>{t.editBot}</Text>
      <Group theme={theme} title={t.name}><TextInput value={name} onChangeText={setName} style={input} /></Group>
      <Group theme={theme} title={t.role}><TextInput value={role} onChangeText={setRole} style={input} /></Group>
      <Group theme={theme} title={t.instructions}><TextInput value={ins} onChangeText={setIns} multiline style={[input, { minHeight: 140, textAlignVertical: 'top' }]} /></Group>
      {err ? <Text style={{ color: theme.danger, margin: 6 }}>{err}</Text> : null}
    </Sheet>
  );
}
