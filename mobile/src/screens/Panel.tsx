// Bot / group panel = web UI "查看对话详情" panel (phone layout), pushed as a page.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { roomWork, type Bot, type Room } from '../api';
import { shownMode } from '../api/cards';
import { ApprovalCard } from '../components/Cards';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { Icon, PillButton, RoundButton } from '../components/ui';
import { Menu, NA } from '../components/Menu';
import { FolderField, ModelField, PermissionPicker } from '../components/Pickers';
import { ToastAndroid } from 'react-native';
import { useStore } from '../store';
import { BotSchedules, ScheduleSummary } from './Schedules';
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

export function PanelScreen({ theme, bot, room, onClose, onSettings, onMemory, onOpenBot, onChat, onSchedules }: { theme: Theme; bot?: Bot; room?: Room; onClose(): void; onSettings(): void; onMemory(botId: string): void; onOpenBot(id: string): void; onChat(): void; onSchedules(start?: string): void }) {
  const { client, state, refresh } = useStore();
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
            <ModelField theme={theme} bot={bot} />
            {state?.permissions?.options?.length ? (
              <>
                <Label theme={theme}>权限</Label>
                <PermissionPicker theme={theme} catalog={state.permissions} saved={bot.permission ?? state.permissions.defaultPreset} repick={bot.permission === undefined}
                  onPick={(permission) => client!.updateBot(bot.id, { permission }).then(refresh)} />
              </>
            ) : null}
            <Label theme={theme}>工作文件夹</Label>
            <FolderField theme={theme} value={bot.workDir} onPick={(workDir) => client!.updateBot(bot.id, { workDir }).then(refresh)} />
            <Pressable onPress={onSettings}><Text style={{ color: theme.sub, textAlign: 'center', marginTop: 16, fontSize: 14 }} numberOfLines={2}>{bot.instructions || '在 Bot 设置里添加说明'}</Text></Pressable>
          </>
        ) : null}

        {room ? (
          <>
            <Label theme={theme}>{`成员 · ${members.length}`}</Label>
            {(() => { const busy = roomWork(state, room.id); return busy.length ? (
              <Pressable onPress={() => client!.stopRoomWork(room.id).then(refresh).catch(() => {})} accessibilityLabel="停止本群的所有工作" style={{ alignSelf: 'flex-end' }}><Text style={{ color: '#ff6b6b', fontSize: 14 }}>全部停止</Text></Pressable>) : null; })()}
            {members.map((m) => { const w = roomWork(state, room.id).find((x) => x.botId === m.id); return (<View key={m.id}>
              <Pressable key={m.id} onPress={() => onOpenBot(m.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Avatar bot={m} size={38} ring={theme.bg} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: theme.text, fontSize: 16 }}>{m.name}</Text>
                    {m.id === room.admin ? <Text style={{ color: theme.sub, fontSize: 11, marginLeft: 6, backgroundColor: theme.cardHi, paddingHorizontal: 5, borderRadius: 4 }}>管理员</Text> : null}
                  </View>
                  {w ? <Text numberOfLines={1} style={{ color: w.state === 'ask' ? '#f0b84a' : theme.sub, fontSize: 13 }}>{w.state === 'ask' ? '等你批准' : `正在${w.doing ? ` ${w.doing}` : '干活'}…`}</Text>
                    : m.role ? <Text style={{ color: theme.sub, fontSize: 13 }}>{m.role}</Text> : null}
                </View>
                {w ? <Pressable hitSlop={8} accessibilityLabel={`停止 · ${m.name}`} onPress={() => client!.stopMemberWork(room.id, m.id).then(refresh).catch(() => {})} style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: theme.cardHi, justifyContent: 'center' }}><Text style={{ color: '#ff6b6b', fontSize: 14 }}>停止</Text></Pressable> : null}
              </Pressable>
              {w?.approvals.map((a) => <ApprovalCard key={a.id} theme={theme} a={a} botName={m.name} onAnswer={(c) => client!.approvalAnswer(a.id, c).then(refresh)} onError={() => {}} />)}
            </View>); })}
            <Label theme={theme}>谁来回答</Label>
            <Text style={{ color: theme.text, fontSize: 15 }}>{shownMode(room, state?.bots ?? []) === 'everyone' ? '所有人' : '管理员主持'}</Text>
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
            {bot ? <ScheduleSummary theme={theme} botId={bot.id} onOpen={onSchedules} /> : null}
          </>
        ) : null}
      </ScrollView>
      <Menu theme={theme} visible={more} onClose={() => setMore(false)} items={[{ label: '侧边对话' }, { label: '终端', sep: true }, { label: '文件树' }]} />
    </View>
  );
}

// Gear page ("设置"): 资料 (名字/标签), 模型, 工作文件夹, 说明 for a Bot; group settings show read-only.
export function BotSettingsScreen({ theme, bot, room, onBack, onClose, onAvatar, onSchedules }: { theme: Theme; bot?: Bot; room?: Room; onBack(): void; onClose(): void; onAvatar(): void; onSchedules(start?: string): void }) {
  const { client, state, refresh } = useStore();
  const [name, setName] = useState(bot?.name ?? room?.name ?? '');
  const [role, setRole] = useState(bot?.role ?? '');
  const [ins, setIns] = useState(bot?.instructions ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isMain = !!bot && bot.id === state?.mainBotId;
  const liveBot = bot ? state?.bots.find((b) => b.id === bot.id) ?? bot : undefined;
  const liveRoom = room ? state?.rooms?.find((r) => r.id === room.id) ?? room : undefined;
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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {bot ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={onAvatar} accessibilityLabel="编辑 Bot 形象">
                <Avatar bot={liveBot!} size={64} ring={theme.bg} />
                <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.cardHi, borderWidth: 2, borderColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.text, fontSize: 11 }}>✎</Text></View>
              </Pressable>
              <View style={{ marginLeft: 14 }}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>{bot.name}</Text>
                <Text style={{ color: theme.sub }}>{[bot.role, isMain ? '主 Bot' : ''].filter(Boolean).join(' · ')}</Text>
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
              <ModelField theme={theme} bot={liveBot!} />
            </View>
            <Label theme={theme}>工作文件夹</Label>
            <FolderField theme={theme} value={liveBot!.workDir} onPick={(workDir) => client!.updateBot(bot.id, { workDir }).then(refresh)} />
            <Label theme={theme}>说明</Label>
            <View style={box}><TextInput value={ins} onChangeText={setIns} multiline placeholder="在 Bot 设置里添加说明" placeholderTextColor={theme.faint} style={[input, { minHeight: 120, textAlignVertical: 'top' }]} /></View>
            {err ? <Text style={{ color: theme.danger, marginTop: 8 }}>{err}</Text> : null}
            <BotSchedules theme={theme} botId={bot.id} onNew={() => onSchedules(bot.id)} />
          </>
        ) : (
          liveRoom ? <GroupSettingsForm theme={theme} room={liveRoom} /> : null
        )}
      </ScrollView>
    </View>
  );
}

// memory-panel.js MemoryDialog: 记忆摘要 / 全部记忆 pages, ⋯ 记忆选项 (全部记忆 N, 重新生成摘要), "询问或更新".
export function MemoryScreen({ theme, id, name, onBack }: { theme: Theme; id: string; name: string; onBack(): void }) {
  const { client, state } = useStore();
  const isRoom = !!state?.rooms?.some((r) => r.id === id);
  const [view, setView] = useState<any>(null);
  const [page, setPage] = useState<'summary' | 'entries'>('summary');
  const [text, setText] = useState('');
  const [opts, setOpts] = useState(false);
  const [err, setErr] = useState('');
  const timer = React.useRef<any>(0);
  const load = React.useCallback((flags: { summarize?: boolean; regenerate?: boolean } = {}) => {
    clearTimeout(timer.current);
    client?.memoryView(id, flags, isRoom).then((v) => {
      setView(v); setErr('');
      if (v?.summarizing) timer.current = setTimeout(() => load({ summarize: true }), 2000);
    }).catch((e) => setErr(String(e?.message ?? e)));
  }, [client, id, isRoom]);
  useEffect(() => { load({ summarize: true }); return () => clearTimeout(timer.current); }, [load]);
  const entries: any[] = view?.entries ?? [];
  const count = entries.length;
  const ro = !!state?.readOnly;
  async function send() {
    if (!client || !text.trim()) return; setErr('');
    try { await client.memoryAdd(id, text.trim(), isRoom); setText(''); load({ summarize: true }); } catch (e: any) { setErr(String(e?.message ?? e)); }
  }
  const status = view?.summarizing ? '正在生成摘要…' : '';
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={page === 'entries' ? () => setPage('summary') : onBack} label={page === 'entries' ? '返回摘要' : '返回'} />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginLeft: 10 }}>{page === 'entries' ? '全部记忆' : '记忆摘要'}</Text>
        <Text style={{ flex: 1, color: theme.sub, marginLeft: 8 }} numberOfLines={1}>{page === 'summary' ? [name, status].filter(Boolean).join(' · ') : status}</Text>
        <RoundButton theme={theme} icon="more" onPress={() => setOpts(true)} label="记忆选项" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, flexGrow: 1 }}>
        {err ? <Text style={{ color: theme.danger, marginBottom: 10 }}>{err}</Text> : null}
        {view === null ? null : page === 'entries' ? (
          entries.map((e, i) => (
            <View key={i} style={{ backgroundColor: theme.card, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              {e.topic ? <Text style={{ color: theme.sub, fontSize: 12, marginBottom: 4 }}>{String(e.topic)}</Text> : null}
              <Text style={{ color: theme.text }}>{String(e.text ?? '')}</Text>
            </View>
          ))
        ) : count === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28, color: theme.sub }}>▤</Text>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 10 }}>{isRoom ? '这个群还没有记住任何内容' : `${name} 还没有记住任何内容`}</Text>
            <Text style={{ color: theme.sub, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{isRoom ? '群会记住工作需要的决定、规则和事实，只有群成员在这个群里会读。可以在下面告诉它，也可以在群里说。' : `Bot 会记住长期的偏好、做过的决定，以及你让它记住的事。可以在下面告诉 ${name}，也可以在对话里说。`}</Text>
          </View>
        ) : view.summary ? (
          <Text style={{ color: theme.text, lineHeight: 22 }}>{String(view.summary.text ?? '')}</Text>
        ) : view.error ? (
          <Text style={{ color: theme.sub }}>{`摘要没能生成：${view.error}`}</Text>
        ) : <Text style={{ color: theme.sub }}>正在生成摘要…</Text>}
      </ScrollView>
      {!ro ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', margin: 14, backgroundColor: theme.fill, borderRadius: 26, borderWidth: 1, borderColor: theme.fillBorder, paddingLeft: 18, padding: 5 }}>
          <TextInput value={text} onChangeText={setText} placeholder="询问或更新" placeholderTextColor={theme.sub} style={{ flex: 1, color: theme.text, fontSize: 16 }} onSubmitEditing={send} />
          <Pressable onPress={send} disabled={!text.trim()} accessibilityLabel="发送" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? theme.accent : theme.cardHi, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" color={text.trim() ? theme.accentText : theme.sub} size={18} />
          </Pressable>
        </View>
      ) : null}
      <Menu theme={theme} visible={opts} onClose={() => setOpts(false)} items={[
        { label: `全部记忆  ${count}`, onPress: () => setPage('entries') },
        ...(count === 0 || view?.summarizing ? [{ label: '重新生成摘要' }] : [{ label: '重新生成摘要', onPress: () => load({ regenerate: true }) }]),
      ]} />
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

// group-settings.js GroupSettingsForm: 资料 (群名, 群公告), 谁来回答 (+ relay limit),
// 工作文件夹, 权限, 成员 (设为管理员 / 取消). Text saves on blur, like InlineText.
const ROOM_MODES: [string, string, string][] = [
  ['admin', '管理员主持', '普通消息先给管理员，由管理员用 @名字 点名其他成员。'],
  ['everyone', '所有人', '每位成员轮流回答，管理员先说。'],
];
function GroupSettingsForm({ theme, room }: { theme: Theme; room: Room }) {
  const { client, state, refresh } = useStore();
  const byId = Object.fromEntries((state?.bots ?? []).map((b) => [b.id, b]));
  const members = (room.members ?? []).map((id) => byId[id]).filter(Boolean) as Bot[];
  const admin = room.admin ? byId[room.admin] : undefined;
  // Like the web pickers: a tap shows at once and settles when the room comes back.
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [pendingShared, setPendingShared] = useState<boolean | null>(null);
  const savedMode = shownMode(room, state?.bots ?? []);
  const mode = pendingMode ?? savedMode;
  const [name, setName] = useState(room.named ? room.name : '');
  const [notice, setNotice] = useState(room.notice ?? '');
  const [relay, setRelay] = useState(room.relayLimit != null ? String(room.relayLimit) : '');
  useEffect(() => setName(room.named ? room.name : ''), [room.name, room.named]);
  useEffect(() => setNotice(room.notice ?? ''), [room.notice]);
  useEffect(() => setRelay(room.relayLimit != null ? String(room.relayLimit) : ''), [room.relayLimit]);
  const update = (patch: Record<string, unknown>) => client!.updateRoom(room.id, patch).then(refresh).catch((e) => { ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT); refresh(); throw e; });
  const saveRelay = () => {
    const text = relay.trim();
    if (!text) { if (room.relayLimit != null) update({ relayLimit: null }).catch(() => {}); return; }
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1 || n > 200 || n === room.relayLimit) { setRelay(room.relayLimit != null ? String(room.relayLimit) : ''); return; }
    update({ relayLimit: n }).catch(() => {});
  };
  const box = { backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, padding: 14 };
  const input = { color: theme.text, fontSize: 16, paddingVertical: 6 };
  const hint = ROOM_MODES.find((m) => m[0] === mode)?.[2] ?? '';
  const catalog = state?.permissions;
  const savedShared = room.permission !== undefined && room.permission !== null;
  const shared = pendingShared ?? savedShared;
  useEffect(() => setPendingMode(null), [savedMode]);
  useEffect(() => setPendingShared(null), [savedShared]);
  return (
    <>
      <Label theme={theme}>资料</Label>
      <View style={box}>
        <Text style={{ color: theme.sub }}>名字</Text>
        <Text style={{ color: theme.faint, fontSize: 12 }}>留空就按成员命名。</Text>
        <TextInput value={name} onChangeText={setName} maxLength={60} placeholder="按成员命名" placeholderTextColor={theme.faint} style={input}
          onEndEditing={() => { if (name !== (room.named ? room.name : '')) update({ name }).catch(() => {}); }} />
        <View style={{ height: 1, backgroundColor: theme.sep, marginVertical: 8 }} />
        <Text style={{ color: theme.sub }}>群公告</Text>
        <Text style={{ color: theme.faint, fontSize: 12 }}>每位成员在这个群里发言前都会读到。</Text>
        <TextInput value={notice} onChangeText={setNotice} multiline maxLength={2000} placeholder="每位成员发言前都会读到的共同说明…" placeholderTextColor={theme.faint}
          style={[input, { minHeight: 80, textAlignVertical: 'top' }]} onBlur={() => { if (notice !== (room.notice ?? '')) update({ notice }).catch(() => {}); }} />
      </View>
      <Label theme={theme}>谁来回答</Label>
      <View style={box}>
        <View style={{ flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 12, padding: 3 }}>
          {ROOM_MODES.map(([id, label]) => {
            const on = mode === id; const off = id === 'admin' && !admin;
            return (
              <Pressable key={id} disabled={off} onPress={() => { if (on) return; setPendingMode(id); update({ mode: id }).catch(() => setPendingMode(null)); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: on ? theme.cardHi : 'transparent', opacity: off ? 0.4 : 1 }}>
                <Text style={{ color: on ? theme.text : theme.sub, fontWeight: on ? '600' : '400' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: theme.sub, fontSize: 12, marginTop: 8 }}>{`${hint} @提及总是指定由谁回答。`}</Text>
        <View style={{ height: 1, backgroundColor: theme.sep, marginVertical: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text }}>Bot 接力几次后暂停</Text>
            <Text style={{ color: theme.faint, fontSize: 12 }}>从你在群里的上一条消息算起。</Text>
          </View>
          <TextInput value={relay} onChangeText={setRelay} keyboardType="number-pad" placeholder={String((room as any).relayLimitDefault ?? '')} placeholderTextColor={theme.faint}
            onEndEditing={saveRelay} style={{ color: theme.text, width: 64, textAlign: 'center', backgroundColor: theme.bg, borderRadius: 8, paddingVertical: 6 }} />
        </View>
      </View>
      <Label theme={theme}>工作文件夹</Label>
      <FolderField theme={theme} value={room.workDir} group onPick={(workDir) => update({ workDir })} />
      {catalog?.options?.length ? (
        <>
          <Label theme={theme}>权限</Label>
          <View style={box}>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: shared }} onPress={() => { const next = !shared; setPendingShared(next); update({ permission: next ? catalog.defaultPreset ?? catalog.options[0].value : null }).catch(() => setPendingShared(null)); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text }}>全员统一</Text>
                <Text style={{ color: theme.faint, fontSize: 12 }}>在这个群里代替各成员自己的权限。</Text>
              </View>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: shared ? '#4d6bfe' : theme.cardHi, justifyContent: 'center', paddingHorizontal: 3 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: shared ? 'flex-end' : 'flex-start' }} />
              </View>
            </Pressable>
            {shared ? <View style={{ marginTop: 10 }}><PermissionPicker theme={theme} catalog={catalog} saved={room.permission ?? catalog.defaultPreset} onPick={(permission) => update({ permission })} /></View> : null}
          </View>
        </>
      ) : null}
      <Label theme={theme}>{`成员 · ${members.length}`}</Label>
      <View style={box}>
        {members.map((m) => {
          const leads = room.admin === m.id;
          return (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <Avatar bot={m} size={26} ring={theme.card} />
              <Text style={{ flex: 1, color: theme.text, marginLeft: 10 }}>{m.name}{leads ? '  · 管理员' : ''}</Text>
              <Pressable hitSlop={8} accessibilityLabel={leads ? '让群聊不设管理员' : undefined} onPress={() => update({ admin: leads ? null : m.id }).catch(() => {})}
                style={{ backgroundColor: theme.cardHi, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: theme.text, fontSize: 13 }}>{leads ? '取消' : '设为管理员'}</Text>
              </Pressable>
            </View>
          );
        })}
        <Text style={{ color: theme.sub, fontSize: 12, marginTop: 6 }}>{admin ? `${admin.name} 主持这个群：可以用 @名字 点名成员、修改群设置、在群里发言。` : '还没有管理员。管理员可以用 @名字 点名成员、修改群设置、在群里发言。'}</Text>
      </View>
    </>
  );
}
