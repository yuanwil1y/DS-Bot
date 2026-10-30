// Bot / group panel = web UI "查看对话详情" panel (phone layout), pushed as a page.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import type { Bot, Room } from '../api';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { Icon, PillButton, RoundButton } from '../components/ui';
import { Menu, NA } from '../components/Menu';
import { useStore } from '../store';
import type { Theme } from '../theme';

export const tok = (x: number) => (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : (x / 1e3).toFixed(1) + 'K');
export const usageLine = (u: any) => {
  if (!u) return '—';
  const m = u.month; const total = m.input + m.cacheRead + m.cacheWrite + m.output; const inp = m.input + m.cacheRead + m.cacheWrite;
  return `${tok(total)} tok · 缓存命中 ${inp ? Math.round((m.cacheRead / inp) * 100) : 0}%`;
};

function Label({ theme, children }: { theme: Theme; children: string }) {
  return <Text style={{ color: theme.sub, fontSize: 14, marginTop: 22, marginBottom: 8 }}>{children}</Text>;
}
function Field({ theme, title, sub, onPress, disabled }: { theme: Theme; title: string; sub?: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled || !onPress} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, paddingHorizontal: 14, paddingVertical: sub ? 10 : 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {sub ? <Text style={{ color: theme.sub, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {disabled ? <Text style={{ color: theme.faint, fontSize: 11, marginRight: 8 }}>{NA}</Text> : null}
      <Text style={{ color: theme.sub }}>⌄</Text>
    </Pressable>
  );
}
export function Hint({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <Text style={{ color: theme.faint, fontSize: 11, marginTop: 4 }}>{children}</Text>;
}

export function PanelScreen({ theme, bot, room, onClose, onSettings, onMemory, onOpenBot, onChat }: { theme: Theme; bot?: Bot; room?: Room; onClose(): void; onSettings(): void; onMemory(botId: string): void; onOpenBot(id: string): void; onChat(): void }) {
  const { client, state } = useStore();
  const [tab, setTab] = useState<'d' | 'b'>('d');
  const [more, setMore] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [memory, setMemory] = useState<any>(null);
  const byId = Object.fromEntries((state?.bots ?? []).map((b) => [b.id, b]));
  const members = room ? (room.members ?? []).map((m) => byId[m]).filter(Boolean) : [];
  const admin = room?.admin ? byId[room.admin] : undefined;
  const memId = bot?.id ?? room?.id;
  useEffect(() => {
    if (!client || !memId) return;
    client.usage(memId).then(setUsage).catch(() => {});
    client.memory(memId).then(setMemory).catch(() => {});
  }, [client, memId]);
  const name = bot?.name ?? room?.name ?? '';
  const model = bot ? state?.models?.find((m) => m.ref === (bot.model ?? bot.appliedModel ?? state?.defaultModel)) : undefined;
  const memCount = memory?.entries?.length ?? 0;
  const share = () => Share.share({ message: name }).catch(() => {});
  const top = [
    { icon: '⚙', label: bot ? '编辑 Bot' : '编辑群聊', f: onSettings },
    { icon: '⋯', label: '更多', f: () => setMore(true) },
    { icon: '⇪', label: '分享对话', f: share },
    { icon: '✕', label: '关闭详情', f: onClose },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 8 }}>
        {top.map((b) => <RoundButton key={b.label} theme={theme} label={b.label} onPress={b.f}><Icon name={b.icon} color={theme.text} size={18} /></RoundButton>)}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          {bot ? <Avatar bot={bot} size={84} ring={theme.bg} /> : <GroupAvatar members={members} size={84} ring={theme.bg} />}
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '600', marginTop: 12 }}>{name}</Text>
          <Text style={{ color: theme.sub, fontSize: 14, marginTop: 4 }}>{bot ? bot.role ?? '' : `${members.length} 位成员${admin ? ` · 管理员 ${admin.name}` : ''}`}</Text>
          {bot ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
              {(['d', 'b'] as const).map((k) => (
                <Pressable key={k} onPress={() => setTab(k)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: tab === k ? theme.cardHi : 'transparent' }}>
                  <Text style={{ color: tab === k ? theme.text : theme.sub, fontSize: 15 }}>{k === 'd' ? '详情' : '浏览器'}</Text>
                </Pressable>
              ))}
            </View>
          ) : <Pressable onPress={onSettings}><Text style={{ color: theme.sub, marginTop: 18 }}>{room?.notice || '在群设置里添加群公告'}</Text></Pressable>}
        </View>

        {bot && tab === 'b' ? <Text style={{ color: theme.sub, marginTop: 20 }}>浏览器在 DSH 桌面版和 DeepSeek Bot 应用里。</Text> : null}

        {bot && tab === 'd' ? (
          <>
            <Label theme={theme}>模型</Label>
            <Field theme={theme} title={model?.name ?? bot.model ?? bot.appliedModel ?? '默认'} sub={model?.providerName} disabled />
            <Label theme={theme}>权限</Label>
            <View style={{ flexDirection: 'row', backgroundColor: theme.card, borderRadius: 12, padding: 3 }}>
              {['仅可查看', '工作区内修改', '完全权限'].map((l, i) => (
                <View key={l} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 }}>
                  <Text style={{ color: i === 2 ? theme.danger : theme.sub, fontSize: 14, opacity: 0.6 }}>{l}</Text>
                </View>
              ))}
            </View>
            <Hint theme={theme}>{NA}（当前权限无法通过移动 API 读取或修改）</Hint>
            <Label theme={theme}>工作文件夹</Label>
            <Field theme={theme} title={bot.workDir ? bot.workDir.split('/').pop() || bot.workDir : '总工作区'} disabled />
            <Pressable onPress={onSettings}><Text style={{ color: theme.sub, textAlign: 'center', marginTop: 16, fontSize: 14 }} numberOfLines={2}>{bot.instructions || '在 Bot 设置里添加说明'}</Text></Pressable>
          </>
        ) : null}

        {room ? (
          <>
            <Label theme={theme}>{`成员 · ${members.length}`}</Label>
            {members.map((m) => (
              <Pressable key={m.id} onPress={() => onOpenBot(m.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Avatar bot={m} size={38} ring={theme.bg} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: theme.text, fontSize: 16 }}>{m.name}</Text>
                    {m.id === room.admin ? <Text style={{ color: theme.sub, fontSize: 11, marginLeft: 6, backgroundColor: theme.cardHi, paddingHorizontal: 5, borderRadius: 4 }}>管理员</Text> : null}
                  </View>
                  {m.role ? <Text style={{ color: theme.sub, fontSize: 13 }}>{m.role}</Text> : null}
                </View>
              </Pressable>
            ))}
            <Label theme={theme}>谁来回答</Label>
            <Text style={{ color: theme.text, fontSize: 15 }}>{room.mode === 'all' ? '所有成员' : '管理员主持'}</Text>
          </>
        ) : null}

        {tab === 'd' || room ? (
          <>
            <Label theme={theme}>记忆</Label>
            <Pressable onPress={() => memId && onMemory(memId)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={{ color: theme.text, fontSize: 15 }}>▤  </Text>
              <Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>{memCount ? `${memCount} 条` : '还没有保存内容'}</Text>
              <Text style={{ color: theme.sub }}>管理 ›</Text>
            </Pressable>
            <Label theme={theme}>用量</Label>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1, color: theme.text }}>{name}</Text>
              <Text style={{ color: theme.text }}>{usageLine(usage)}</Text>
            </View>
            {bot ? <>
              <Label theme={theme}>定时任务</Label>
              <Text style={{ color: theme.faint }}>还没有定时任务，去添加（{NA}）</Text>
            </> : null}
          </>
        ) : null}
      </ScrollView>
      <Menu theme={theme} visible={more} onClose={() => setMore(false)} items={[{ label: '侧边对话' }, { label: '终端', sep: true }, { label: '文件树' }]} />
    </View>
  );
}

// Gear page ("设置"): 资料 (名字/标签), 模型, 工作文件夹, 说明 for a Bot; group settings show read-only.
export function BotSettingsScreen({ theme, bot, room, onBack, onClose }: { theme: Theme; bot?: Bot; room?: Room; onBack(): void; onClose(): void }) {
  const { client, state, refresh } = useStore();
  const [name, setName] = useState(bot?.name ?? room?.name ?? '');
  const [role, setRole] = useState(bot?.role ?? '');
  const [ins, setIns] = useState(bot?.instructions ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isMain = !!bot && bot.id === state?.mainBotId;
  const model = bot ? state?.models?.find((m) => m.ref === (bot.model ?? bot.appliedModel ?? state?.defaultModel)) : undefined;
  const dirty = !!bot && (name !== bot.name || role !== (bot.role ?? '') || ins !== (bot.instructions ?? ''));
  async function save() {
    if (!client || !bot) return; setBusy(true); setErr('');
    try { await client.updateBot(bot.id, { name: name.trim(), role: role.trim(), instructions: ins }); await refresh(); onBack(); } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(false); }
  }
  const input = { color: theme.text, fontSize: 16, paddingVertical: 6 };
  const box = { backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, padding: 14 };
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label="返回详情" />
        <Text style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '600', marginLeft: 8 }}>设置</Text>
        {bot ? <PillButton theme={theme} primary title={busy ? '…' : '保存'} disabled={busy || !dirty || !name.trim()} onPress={save} /> : null}
        <RoundButton theme={theme} icon="close" onPress={onClose} label="关闭" style={{ marginLeft: 8 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {bot ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar bot={bot} size={64} ring={theme.bg} />
              <View style={{ marginLeft: 14 }}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>{bot.name}</Text>
                <Text style={{ color: theme.sub }}>{[bot.role, isMain ? '主 Bot' : ''].filter(Boolean).join(' · ')}</Text>
                <Hint theme={theme}>编辑 Bot 形象：{NA}</Hint>
              </View>
            </View>
            <Label theme={theme}>资料</Label>
            <View style={box}>
              <Text style={{ color: theme.sub }}>名字</Text>
              <TextInput value={name} onChangeText={setName} style={input} />
              <View style={{ height: 1, backgroundColor: theme.sep, marginVertical: 8 }} />
              <Text style={{ color: theme.sub }}>标签</Text>
              <Text style={{ color: theme.faint, fontSize: 12 }}>可选，显示在名字下方。</Text>
              <TextInput value={role} onChangeText={setRole} style={input} />
            </View>
            <Label theme={theme}>模型</Label>
            <View style={box}>
              <Text style={{ color: theme.sub, marginBottom: 8 }}>这个 Bot 的每条消息都用它。</Text>
              <Field theme={theme} title={model?.name ?? '默认'} sub={model?.providerName} disabled />
            </View>
            <Label theme={theme}>工作文件夹</Label>
            <Field theme={theme} title={bot.workDir ?? '总工作区'} disabled />
            <Label theme={theme}>说明</Label>
            <View style={box}><TextInput value={ins} onChangeText={setIns} multiline placeholder="在 Bot 设置里添加说明" placeholderTextColor={theme.faint} style={[input, { minHeight: 120, textAlignVertical: 'top' }]} /></View>
            {err ? <Text style={{ color: theme.danger, marginTop: 8 }}>{err}</Text> : null}
          </>
        ) : (
          <>
            <Label theme={theme}>群名</Label>
            <Field theme={theme} title={name} disabled />
            <Label theme={theme}>群公告</Label>
            <Field theme={theme} title={room?.notice || '在群设置里添加群公告'} disabled />
            <Hint theme={theme}>群设置修改{NA}（移动 API 无 update-room）</Hint>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// "记忆摘要" page: header + ⋯ (记忆选项) + close, entries, bottom input "询问或更新".
export function MemoryScreen({ theme, id, name, onBack }: { theme: Theme; id: string; name: string; onBack(): void }) {
  const { client, state } = useStore();
  const [memory, setMemory] = useState<any>(null);
  const [text, setText] = useState('');
  const [opts, setOpts] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { client?.memory(id).then(setMemory).catch((e) => setErr(String(e?.message ?? e))); }, [client, id]);
  const entries: any[] = memory?.entries ?? [];
  const ro = !!state?.readOnly;
  async function send() {
    if (!client || !text.trim()) return; setErr('');
    try { setMemory(await client.memoryAdd(id, text.trim())); setText(''); } catch (e: any) { setErr(String(e?.message ?? e)); }
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label="返回" />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginLeft: 10 }}>记忆摘要</Text>
        <Text style={{ flex: 1, color: theme.sub, marginLeft: 8 }}>{name}</Text>
        <RoundButton theme={theme} icon="more" onPress={() => setOpts(true)} label="记忆选项" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, flexGrow: 1 }}>
        {memory?.summary ? <Text style={{ color: theme.text, lineHeight: 22, marginBottom: 14 }}>{String(memory.summary)}</Text> : null}
        {entries.length ? entries.map((e, i) => (
          <View key={e.id ?? i} style={{ backgroundColor: theme.card, borderRadius: 12, padding: 12, marginBottom: 8 }}><Text style={{ color: theme.text }}>{String(e.text ?? e)}</Text></View>
        )) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28, color: theme.sub }}>▤</Text>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 10 }}>{name} 还没有记住任何内容</Text>
            <Text style={{ color: theme.sub, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{`Bot 会记住长期的偏好、做过的决定，以及你让它记住的事。可以在下面告诉 ${name}，也可以在对话里说。`}</Text>
          </View>
        )}
        {err ? <Text style={{ color: theme.danger }}>{err}</Text> : null}
      </ScrollView>
      {!ro ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', margin: 14, backgroundColor: theme.fill, borderRadius: 26, borderWidth: 1, borderColor: theme.fillBorder, paddingLeft: 18, padding: 5 }}>
          <TextInput value={text} onChangeText={setText} placeholder="询问或更新" placeholderTextColor={theme.sub} style={{ flex: 1, color: theme.text, fontSize: 16 }} onSubmitEditing={send} />
          <Pressable onPress={send} disabled={!text.trim()} accessibilityLabel="发送" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? theme.accent : theme.cardHi, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" color={text.trim() ? theme.accentText : theme.sub} size={18} />
          </Pressable>
        </View>
      ) : null}
      <Menu theme={theme} visible={opts} onClose={() => setOpts(false)} items={[{ label: '记忆选项' }]} />
    </View>
  );
}

// Account menu "用量": main bot usage summary.
export function UsageScreen({ theme, onBack }: { theme: Theme; onBack(): void }) {
  const { client, state } = useStore();
  const [rows, setRows] = useState<Record<string, any>>({});
  useEffect(() => {
    for (const b of state?.bots ?? []) client?.usage(b.id).then((u) => setRows((r) => ({ ...r, [b.id]: u }))).catch(() => {});
  }, [client, state?.bots.length]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label="返回" />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginLeft: 10 }}>用量</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={{ color: theme.sub, marginBottom: 10 }}>本月</Text>
        {(state?.bots ?? []).map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <Avatar bot={b} size={30} ring={theme.bg} />
            <Text style={{ flex: 1, color: theme.text, marginLeft: 10 }}>{b.name}</Text>
            <Text style={{ color: theme.text }}>{usageLine(rows[b.id])}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
