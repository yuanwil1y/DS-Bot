// Bot / group panel = web UI "查看对话详情" panel (phone layout), pushed as a page.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import { type Bot, type Room } from '../api';
import { elapsedLabel, memberWork, workPhrase } from '../api/work';
import { shownMode } from '../api/cards';
import { ApprovalCard } from '../components/Cards';
import { Avatar, GroupAvatar } from '../components/Avatar';
import { Icon, PillButton, RoundButton } from '../components/ui';
import * as Clipboard from 'expo-clipboard';
import { Menu, NA, NA_MOBILE } from '../components/Menu';
import { FolderField, ModelField, modelLine, PermissionPicker, presetName } from '../components/Pickers';
import { ToastAndroid } from 'react-native';
import { useStore } from '../store';
import { BotSchedules, ScheduleSummary } from './Schedules';
import { SIDE, sideChatsOf, sideHostText, sideTitle } from '../api/side';
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

// details-drawer.js About: folded to 5 lines with 展开/收起.
function About({ theme, title, text }: { theme: Theme; title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.split('\n').length > 5 || text.length > 240;
  return (
    <>
      <Label theme={theme}>{title}</Label>
      <Text numberOfLines={open ? undefined : 5} style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{text}</Text>
      {long ? <Pressable onPress={() => setOpen((v) => !v)}><Text style={{ color: theme.sub, marginTop: 6, fontSize: 14 }}>{open ? '收起' : '展开'}</Text></Pressable> : null}
    </>
  );
}
function MoreButton({ theme, title, onPress }: { theme: Theme; title: string; onPress(): void }) {
  return <Pressable onPress={onPress}><Text style={{ color: theme.sub, textAlign: 'center', marginTop: 16, fontSize: 14 }}>{title}</Text></Pressable>;
}
// MemberPile: first members side by side (max 4, the 4th becomes +N).
function MemberPile({ theme, members }: { theme: Theme; members: Bot[] }) {
  const shown = members.length > 4 ? members.slice(0, 3) : members; const more = members.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((b, i) => <View key={b.id} style={{ marginLeft: i ? -10 : 0, borderRadius: 25, borderWidth: 3, borderColor: theme.bg }}><Avatar bot={b} size={44} /></View>)}
      {more > 0 ? <View style={{ marginLeft: -10, width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: theme.bg, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.sub, fontSize: 13 }}>{`+${more}`}</Text></View> : null}
    </View>
  );
}
// text.js runStatsOf: the DSH status-bar figures, shown here since the phone has no status bar.
function runStatsOf(v: any): string[] {
  const out: string[] = []; const st = v?.sessionStats; const u = v?.tokenUsage; const p = v?.contextPressure;
  if (st?.turns > 0) out.push(st.turns === 1 ? '1 轮' : `${st.turns} 轮`);
  if (st?.decodeMs > 0 && st.decodeTokens > 0) { const sp = st.decodeTokens / (st.decodeMs / 1000); out.push(`${sp >= 10 ? Math.round(sp) : Math.round(sp * 10) / 10} tok/s`); }
  const prompt = (u?.uncachedInputTokens ?? 0) + (u?.cacheReadTokens ?? 0) + (u?.cacheWriteTokens ?? 0);
  if (prompt > 0) { const part = u.cacheReadTokens ?? 0; let txt = '99.99'; if (part >= prompt) txt = '100'; else for (let k = 0; k < 3; k++) { const x = ((part / prompt) * 100).toFixed(k); if (Number(x) < 100) { txt = x; break; } } out.push(`缓存命中 ${txt}%`); }
  const used = p?.projectedTokens ?? p?.pressureTokens;
  if (Number.isFinite(used) && p.contextWindow > 0) out.push(`上下文 ${Math.min(100, Math.round((used / p.contextWindow) * 100))}%`);
  return out;
}
const fmtTok = (c: number) => (c >= 1e6 ? `${(c / 1e6).toFixed(1)}M` : c >= 1e3 ? `${(c / 1e3).toFixed(1)}K` : String(c));
// text.js usageOf, over the figures the phone can read (the current part's tokenUsage).
function usageOf(u: any): string {
  if (!u) return '';
  const input = (u.uncachedInputTokens ?? 0) + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0); const out = u.outputTokens ?? 0;
  if (input + out === 0) return '';
  return `${fmtTok(input + out)} tok · 缓存命中 ${input > 0 ? Math.round(((u.cacheReadTokens ?? 0) / input) * 100) : 0}%`;
}
const HEADER = /^\s*\[[^\]]*\]\s*/;

export function PanelScreen({ theme, bot, room, onClose, onSettings, onMemory, onOpenBot, onChat, onSchedules, onSide }: { theme: Theme; bot?: Bot; room?: Room; onClose(): void; onSettings(): void; onMemory(botId: string): void; onOpenBot(id: string): void; onChat(): void; onSchedules(start?: string): void; onSide(chatId: string): void }) {
  const { client, state, refresh } = useStore();
  const [tab, setTab] = useState<'d' | 'b'>('d');
  const [more, setMore] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [memCount, setMemCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [stopping, setStopping] = useState<Record<string, boolean>>({});
  const [, tick] = useState(0);
  const byId = Object.fromEntries((state?.bots ?? []).map((b) => [b.id, b]));
  const members = room ? (room.members ?? []).map((m) => byId[m]).filter(Boolean) as Bot[] : [];
  const admin = room?.admin ? byId[room.admin] : undefined;
  const memId = bot?.id ?? room?.id;
  const work = (state?.work ?? {}) as any;
  const entries = room ? memberWork(room, work) : [];
  const running = bot ? !!work.bots?.[bot.id] && !work.bots[bot.id].roomId : false;
  useEffect(() => {
    if (!client || !memId) return;
    client.memoryView(memId, {}, !!room).then((v: any) => setMemCount(v?.entries?.length ?? 0)).catch(() => {});
  }, [client, memId]);
  useEffect(() => {
    if (!client || !bot) return;
    client.call<any>('run-stats', { botId: bot.id }).then(setStats).catch(() => {});
  }, [client, bot?.id, running]);
  const busy = entries.some((e) => e.state !== 'idle');
  useEffect(() => { if (!busy) return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [busy]);
  const fail = (e: any) => setError(String(e?.message ?? e));
  const run = (p: Promise<unknown>) => { setError(''); return p.then(refresh).catch(fail); };
  const name = bot?.name ?? room?.name ?? '';
  const sides = bot ? sideChatsOf(state, bot.id) : [];
  const newSide = () => { setMore(false); client!.sideNew(bot!.id).then((v) => { refresh(); onSide(v.chatId); }, (e: any) => ToastAndroid.show(sideHostText(String(e?.message ?? e)), ToastAndroid.SHORT)); };
  // details-drawer.js share: copy the conversation as Markdown to the clipboard.
  const share = async () => {
    try {
      const page: any = bot ? await client!.chat(bot.id) : await client!.roomChat(room!.id);
      const lines: string[] = [];
      for (const it of page.items ?? []) {
        if (it.kind === 'user' && it.text && !HEADER.test(it.text)) lines.push(`**你:** ${it.text.trim()}`);
        else if (it.kind === 'bot' && it.text) lines.push(`**${name}:** ${String(it.text).replace(HEADER, '').trim()}`);
      }
      await Clipboard.setStringAsync(lines.join('\n\n'));
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  const saveName = () => {
    setEditing(false);
    const next = draft.trim();
    if (next === name || (room && !room.named && next === '')) return;
    if (bot && next) run(client!.updateBot(bot.id, { name: next }));
    if (room) run(client!.updateRoom(room.id, { name: next }));
  };
  const stopAll = () => { setStopping((s) => ({ ...s, all: true })); client!.stopRoomWork(room!.id).then(refresh).catch((e) => ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT)).finally(() => setStopping((s) => ({ ...s, all: false }))); };
  const stopOne = (id: string) => { setStopping((s) => ({ ...s, [id]: true })); client!.stopMemberWork(room!.id, id).then(refresh).catch((e) => ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT)).finally(() => setStopping((s) => ({ ...s, [id]: false }))); };
  const roomName = (id: string) => state?.rooms?.find((r) => r.id === id)?.name ?? '一个群聊';
  const shownStats = bot ? runStatsOf(stats) : [];
  const usage = bot ? usageOf(stats?.tokenUsage) : '';
  const model = bot ? bot.model ?? bot.appliedModel ?? state?.defaultModel : undefined;
  const top = [
    { icon: '⚙', label: bot ? '编辑 Bot' : '群设置', f: onSettings },
    { icon: '⋯', label: '更多', f: () => setMore(true) },
    { icon: copied ? '✓' : '⇪', label: copied ? '已复制对话' : '分享对话', f: share },
    { icon: '✕', label: '关闭详情', f: onClose },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 8, gap: 8 }}>
        {sides.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingVertical: 2 }}>
            {sides.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', maxWidth: 200, height: 36, borderRadius: 18, paddingLeft: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.fillBorder }}>
                <Pressable onPress={() => onSide(c.id)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 0 }} style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, paddingVertical: 6 }}>
                  <Text style={{ color: theme.sub, fontSize: 13, marginRight: 6 }}>◫</Text>
                  <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, flexShrink: 1 }}>{sideTitle(c)}</Text>
                </Pressable>
                <Pressable hitSlop={12} accessibilityLabel={SIDE.close} onPress={() => client!.sideClose(c.id).then(refresh, () => {})} style={{ paddingHorizontal: 12, height: 36, justifyContent: 'center' }}>
                  <Text style={{ color: theme.sub, fontSize: 18, lineHeight: 20 }}>×</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : <View style={{ flex: 1 }} />}
        <View style={{ flexDirection: 'row', gap: 10, flexShrink: 0 }}>
          {top.map((b) => <RoundButton key={b.icon} theme={theme} label={b.label} onPress={b.f}>{b.icon === '✓' ? <Text style={{ color: theme.text, fontSize: 16 }}>✓</Text> : <Icon name={b.icon} color={theme.text} size={18} />}</RoundButton>)}
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          {bot ? <Avatar bot={bot} size={64} ring={theme.bg} working={running} /> : <MemberPile theme={theme} members={members} />}
          {editing ? (
            <TextInput autoFocus value={draft} onChangeText={setDraft} onBlur={saveName} onSubmitEditing={saveName} placeholder={room ? '按成员命名' : undefined} placeholderTextColor={theme.faint}
              accessibilityLabel={bot ? 'Bot 名字' : '群名'} style={{ color: theme.text, fontSize: 20, fontWeight: '600', marginTop: 16, textAlign: 'center', minWidth: 160, borderBottomWidth: 1, borderColor: theme.fillBorder, paddingVertical: 2 }} />
          ) : (
            <Pressable accessibilityLabel={`重命名 ${name}`} onPress={() => { setDraft(room && !room.named ? '' : name); setEditing(true); }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '600', marginTop: 16 }}>{name}</Text>
            </Pressable>
          )}
          {(bot ? bot.role : room) ? <Text style={{ color: theme.sub, fontSize: 14, marginTop: 4 }}>{bot ? bot.role : `${(room!.members ?? []).length} 位成员 · ${admin ? `管理员 ${admin.name}` : '无管理员'}`}</Text> : null}
          {bot ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
              {(['d', 'b'] as const).map((k) => (
                <Pressable key={k} onPress={() => setTab(k)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: tab === k ? theme.cardHi : 'transparent' }}>
                  <Text style={{ color: tab === k ? theme.text : theme.sub, fontSize: 15 }}>{k === 'd' ? '详情' : '浏览器'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        {error ? <Text style={{ color: theme.danger, marginTop: 14 }}>{error}</Text> : null}

        {bot && tab === 'b' ? <Text style={{ color: theme.sub, marginTop: 20 }}>浏览器在 DSH 桌面版和 DeepSeek Bot 应用里。</Text> : null}

        {bot && tab === 'd' ? (
          <>
            {shownStats.length ? <Text style={{ color: theme.sub, fontSize: 12, textAlign: 'center', marginTop: 10 }}>{shownStats.join('  ')}</Text> : null}
            <Label theme={theme}>模型</Label>
            <ModelField theme={theme} bot={bot} />
            {model ? null : <Hint theme={theme}>{`选好模型，${bot.name} 就能开始工作。`}</Hint>}
            {state?.permissions?.options?.length ? (
              <>
                <Label theme={theme}>权限</Label>
                <PermissionPicker theme={theme} catalog={state.permissions} saved={bot.permission ?? state.permissions.defaultPreset} repick={bot.permission === undefined}
                  onPick={(permission) => client!.updateBot(bot.id, { permission }).then(refresh)} />
              </>
            ) : null}
            <Label theme={theme}>工作文件夹</Label>
            <FolderField theme={theme} value={bot.workDir} onPick={(workDir) => client!.updateBot(bot.id, { workDir }).then(refresh)} />
            {bot.instructions ? <About theme={theme} title="简介" text={bot.instructions} /> : <MoreButton theme={theme} title="在 Bot 设置里添加说明" onPress={onSettings} />}
          </>
        ) : null}

        {room ? (
          <>
            {room.notice ? <About theme={theme} title="群公告" text={room.notice} /> : <MoreButton theme={theme} title="在群设置里添加群公告" onPress={onSettings} />}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Label theme={theme}>{`成员 · ${members.length}`}</Label></View>
              {entries.some((e) => e.here) ? <Pressable disabled={!!stopping.all} onPress={stopAll} accessibilityLabel="停止本群的所有工作" style={{ marginTop: 14, opacity: stopping.all ? 0.5 : 1 }}><Text style={{ color: theme.danger, fontSize: 14 }}>全部停止</Text></Pressable> : null}
            </View>
            {members.map((m) => { const w = entries.find((x) => x.id === m.id); const where = w?.state === 'work' && w.doing.roomId !== room.id ? (w.doing.roomId ? ` 在 ${roomName(w.doing.roomId)}` : ' 在自己的对话里') : '';
              const at = w?.state === 'ask' ? w.approvals[0]?.at : w?.state === 'work' ? w.doing.since : undefined;
              return (<View key={m.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Pressable accessibilityLabel={`打开 ${m.name} 的对话`} onPress={() => onOpenBot(m.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar bot={m} size={32} ring={theme.bg} working={w?.state === 'work'} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: theme.text, fontSize: 16 }}>{m.name}</Text>
                      {m.id === room.admin ? <Text style={{ color: theme.sub, fontSize: 11, marginLeft: 6, backgroundColor: theme.cardHi, paddingHorizontal: 5, borderRadius: 4 }}>管理员</Text> : null}
                    </View>
                    {w?.state === 'ask' || w?.state === 'work' || m.role ? (
                      <View style={{ flexDirection: 'row' }}>
                        <Text numberOfLines={1} style={{ flexShrink: 1, color: w?.state === 'ask' ? '#f0b84a' : theme.sub, fontSize: 12 }}>{w?.state === 'ask' ? '等你批准' : w?.state === 'work' ? `${workPhrase(w.doing)}…${where}` : m.role}</Text>
                        {typeof at === 'number' ? <Text style={{ color: w?.state === 'ask' ? '#f0b84a' : theme.sub, fontSize: 12, marginLeft: 4 }}>{`· ${elapsedLabel(Math.max(1000, Date.now() - at))}`}</Text> : null}
                      </View>) : null}
                  </View>
                </Pressable>
                {w?.here && (w.state === 'work' || w.state === 'ask') ? <Pressable hitSlop={8} disabled={!!stopping[m.id]} accessibilityLabel={`停止 ${m.name}`} onPress={() => stopOne(m.id)} style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: theme.cardHi, justifyContent: 'center', opacity: stopping[m.id] ? 0.5 : 1 }}><Text style={{ color: theme.danger, fontSize: 14 }}>停止</Text></Pressable> : null}
              </View>
              {w?.state === 'ask' ? w.approvals.map((a: any) => <ApprovalCard key={a.id} theme={theme} a={a} botName={m.name} onAnswer={(c) => client!.approvalAnswer(a.id, c).then(refresh)} onError={fail} onOpen={() => onOpenBot(m.id)} />) : null}
            </View>); })}
            <Label theme={theme}>谁来回答</Label>
            <Text style={{ color: theme.text, fontSize: 15 }}>{shownMode(room, state?.bots ?? []) === 'admin' ? '管理员主持' : '所有人'}</Text>
            {room.permission ? (
              <>
                <Label theme={theme}>权限</Label>
                <Text style={{ color: room.permission === 'danger-full-access' ? theme.danger : theme.text, fontSize: 15 }}>{presetName(room.permission, state?.permissions)}</Text>
              </>
            ) : null}
          </>
        ) : null}

        {tab === 'd' || room ? (
          <>
            {(state as any)?.memory === false ? null : (
              <>
                <Label theme={theme}>记忆</Label>
                <Pressable accessibilityLabel={`管理 ${name} 的记忆`} onPress={() => memId && onMemory(memId)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 15 }}>▤  </Text>
                  <Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>{memCount === null ? '加载中…' : memCount === 0 ? '还没有保存内容' : `${memCount} 条`}</Text>
                  <Text style={{ color: theme.sub }}>管理 ›</Text>
                </Pressable>
              </>
            )}
            {usage || room ? (
              <>
                <Label theme={theme}>用量</Label>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={{ flex: 1, color: theme.text }}>{name}</Text>
                  <Text style={{ color: usage ? theme.text : theme.faint }}>{usage || NA}</Text>
                </View>
              </>
            ) : null}
            {bot ? <ScheduleSummary theme={theme} botId={bot.id} onOpen={onSchedules} /> : null}
          </>
        ) : null}
      </ScrollView>
      <Menu theme={theme} visible={more} onClose={() => setMore(false)} items={[...(bot ? [{ label: SIDE.title, onPress: newSide }] : []), { label: '终端', na: NA_MOBILE }, { label: '文件树', na: NA_MOBILE }]} />
    </View>
  );
}

// bot-settings.js InlineText: saves on blur or Enter (no Save button); a required field never saves empty.
function InlineText({ theme, label, value, placeholder, required, maxLength, multiline, onSave }: { theme: Theme; label: string; value?: string; placeholder?: string; required?: boolean; maxLength?: number; multiline?: boolean; onSave(v: string): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { const next = draft?.trim(); setDraft(null); if (next === undefined || next === (value ?? '') || (required && next === '')) return; onSave(next); };
  return <TextInput accessibilityLabel={label} value={draft ?? value ?? ''} placeholder={placeholder} placeholderTextColor={theme.faint} maxLength={maxLength} multiline={multiline} autoCorrect={false}
    onChangeText={setDraft} onBlur={commit} onSubmitEditing={multiline ? undefined : commit} blurOnSubmit={!multiline}
    style={multiline ? { color: theme.text, fontSize: 15, minHeight: 112, textAlignVertical: 'top', backgroundColor: theme.cardHi, borderRadius: 8, padding: 8, marginTop: 8 } : { color: theme.text, fontSize: 15, flexBasis: 160, flexShrink: 1, textAlign: 'right', paddingVertical: 4 }} />;
}
function SRow({ theme, label, hint, children, stack, onPress, danger, sep }: { theme: Theme; label: string; hint?: string; children?: React.ReactNode; stack?: boolean; onPress?(): void; danger?: boolean; sep?: boolean }) {
  const body = <>
    <View style={{ flex: stack ? undefined : 1, paddingRight: stack ? 0 : 10 }}>
      <Text style={{ color: danger ? theme.danger : theme.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
      {hint ? <Text style={{ color: theme.sub, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{hint}</Text> : null}
    </View>{children}</>;
  const style = { flexDirection: stack ? 'column' as const : 'row' as const, alignItems: stack ? 'stretch' as const : 'center' as const, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: sep ? 1 : 0, borderColor: theme.sep };
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [style, { backgroundColor: pressed ? theme.cardHi : danger && hint?.startsWith('再点') ? 'rgba(229,55,45,0.08)' : 'transparent' }]}>{body}</Pressable> : <View style={style}>{body}</View>;
}
function SCard({ theme, title, children }: { theme: Theme; title?: string; children: React.ReactNode }) {
  const kids = React.Children.toArray(children).filter(Boolean);
  if (!kids.length) return null;
  return <>{title ? <Label theme={theme}>{title}</Label> : null}<View style={{ backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, overflow: 'hidden' }}>{kids.map((k, i) => React.isValidElement(k) && i > 0 ? React.cloneElement(k as any, { sep: true }) : k)}</View></>;
}
const capStatus = (s: any) => (!s ? undefined : s.state === 'ready' ? '就绪' : s.state === 'needs-approval' ? '需要批准' : s.state === 'error' ? `连接失败：${s.error ?? ''}` : '正在连接…');

// Gear page: bot-settings.js BotSettingsForm cards; group settings use GroupSettingsForm.
export function BotSettingsScreen({ theme, bot, room, onBack, onClose, onAvatar, onSchedules, onMemory, onOpenBot }: { theme: Theme; bot?: Bot; room?: Room; onBack(): void; onClose(): void; onAvatar(): void; onSchedules(start?: string): void; onMemory?(id: string): void; onOpenBot?(id: string): void }) {
  const { client, state, refresh } = useStore();
  const [err, setErr] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [memCount, setMemCount] = useState<number | null>(null);
  useEffect(() => { if (!confirming) return; const t = setTimeout(() => setConfirming(false), 4000); return () => clearTimeout(t); }, [confirming]);
  useEffect(() => { if (client && bot) { client.refreshModels().then(refresh).catch(() => {}); client.memoryView(bot.id).then((v: any) => setMemCount(v?.entries?.length ?? 0)).catch(() => {}); } }, [client, bot?.id]);
  const st = state as any;
  const b = (bot ? state?.bots.find((x) => x.id === bot.id) ?? bot : undefined) as any;
  const liveRoom = room ? state?.rooms?.find((r) => r.id === room.id) ?? room : undefined;
  const run = (p: Promise<unknown>) => p.then(() => { setErr(''); return refresh(); }).catch((e: any) => setErr(String(e?.message ?? e)));
  const save = (patch: Record<string, unknown>) => run(client!.updateBot(b.id, patch));
  const mainIds: string[] = st?.mainBotIds ?? (st?.mainBotId ? [st.mainBotId] : []);
  const isMain = !!b && mainIds.includes(b.id);
  const onlyMain = isMain && mainIds.length === 1;
  const isTile = !!b && st?.mainBotId === b.id;
  const inGroup = !!b && (state?.rooms ?? []).some((r) => r.members?.includes(b.id));
  const privateHint = '其他 Bot 不能读取它的文件夹、记忆或对话；它分享给其他 Bot 的内容需要你批准。';
  const privacyHint = !b ? '' : b.private === true ? privateHint : isMain ? '主 Bot 不能设为隐私 Bot。' : inGroup ? '先退出所有群聊，才能设为隐私 Bot。' : !b.workDir ? '先选择一个独立的工作文件夹。' : privateHint;
  const line = b ? modelLine(b, state) : undefined;
  const modelHint = !b ? '' : line!.current === undefined ? '选择这个 Bot 使用的模型。' : !line!.served && (state?.models ?? []).length > 0 ? '这个模型现在不可用，请换一个。' : b.appliedModel && b.appliedModel === b.model ? '这个 Bot 的每条消息都用它。' : '从下一条消息开始生效。';
  const caps = [...(st?.capabilities ?? [])].sort((x: any, y: any) => Number(y.kind === 'pack') - Number(x.kind === 'pack') || x.name.localeCompare(y.name));
  const attached = new Set<string>(b?.capabilities ?? []);
  const statuses = st?.capabilityStatuses?.[b?.id] ?? {};
  const sw = (on: boolean, onChange: (v: boolean) => void, label: string, disabled?: boolean) => <Switch value={on} disabled={disabled} onValueChange={onChange} accessibilityLabel={label} />;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label="返回详情" />
        <Text style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '600', marginLeft: 8 }}>设置</Text>
        <RoundButton theme={theme} icon="close" onPress={onClose} label="关闭" style={{ marginLeft: 8 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {b ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={onAvatar} accessibilityLabel="编辑 Bot 形象">
                <Avatar bot={b} size={64} ring={theme.bg} />
                <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.cardHi, borderWidth: 2, borderColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.text, fontSize: 11 }}>✎</Text></View>
              </Pressable>
              <View style={{ marginLeft: 14, flexShrink: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>{b.name}</Text>
                <Text style={{ color: theme.sub, fontSize: 13 }}>{[b.role, isMain ? '主 Bot' : ''].filter(Boolean).join(' · ') || 'Bot'}</Text>
              </View>
            </View>
            {err ? <Text style={{ color: theme.danger, marginTop: 8 }}>{err}</Text> : null}
            <SCard theme={theme} title="资料">
              <SRow theme={theme} label="名字"><InlineText theme={theme} label="名字" value={b.name} placeholder="Bob" required maxLength={40} onSave={(name) => save({ name })} /></SRow>
              <SRow theme={theme} label="标签" hint="可选，显示在名字下方。"><InlineText theme={theme} label="标签" value={b.role} placeholder="研究、行政…" maxLength={24} onSave={(role) => save({ role })} /></SRow>
            </SCard>
            <SCard theme={theme} title="模型">
              <SRow theme={theme} label="模型" hint={modelHint} stack><View style={{ marginTop: 8 }}><ModelField theme={theme} bot={b} /></View></SRow>
            </SCard>
            <SCard theme={theme} title="工作文件夹">
              <SRow theme={theme} label="文件夹" stack><View style={{ marginTop: 8 }}><FolderField theme={theme} value={b.workDir} onPick={(workDir) => save({ workDir })} /></View></SRow>
            </SCard>
            <SCard theme={theme} title="隐私">
              <SRow theme={theme} label="隐私" hint={privacyHint}>{sw(b.private === true, (v) => save({ private: v }), '隐私', b.private !== true && (isMain || inGroup || !b.workDir))}</SRow>
            </SCard>
            <SCard theme={theme} title="说明">
              <SRow theme={theme} label="这个 Bot 做什么" hint="它在团队里的分工，会写进 Bot 的系统提示词。" stack><InlineText theme={theme} label="说明" value={b.instructions} multiline placeholder="这个 Bot 负责什么…" onSave={(instructions) => save({ instructions })} /></SRow>
            </SCard>
            {caps.length ? <SCard theme={theme} title="能力">
              {caps.map((c: any) => <SRow key={c.name} theme={theme} label={c.name} hint={attached.has(c.name) ? capStatus(statuses[c.name]) : undefined}>{sw(attached.has(c.name), (v) => run(client!.call('bot-capability', { botId: b.id, name: c.name, attached: v })), c.name)}</SRow>)}
            </SCard> : null}
            {st?.memory === false ? null : <SCard theme={theme} title="记忆">
              <SRow theme={theme} label={memCount === null ? '加载中…' : memCount === 0 ? '还没有保存内容' : `${memCount} 条`} onPress={() => onMemory?.(b.id)}><Text style={{ color: theme.sub }}>管理 ›</Text></SRow>
            </SCard>}
            <BotSchedules theme={theme} botId={b.id} onNew={() => onSchedules(b.id)} />
            <SCard theme={theme} title="主 Bot">
              {onlyMain ? <SRow theme={theme} label="主 Bot" hint="这是唯一的主 Bot。要把主 Bot 交给别的 Bot，请到「Bot」页的主 Bot 里换。" />
                : <SRow theme={theme} label="主 Bot" hint={b.private === true ? '隐私 Bot 不能设为主 Bot。' : '可以创建和修改 Bot，并管理所有群聊。'}>{sw(isMain, (on) => run(client!.call('set-main', { id: b.id, main: on })), '主 Bot', b.private === true)}</SRow>}
            </SCard>
            {isTile ? null : <SCard theme={theme} title="侧栏">
              <SRow theme={theme} label="置顶" hint="排在其他对话上面。">{sw(b.pinned === true, (pinned) => run(client!.call('set-flags', { id: b.id, pinned })), '置顶')}</SRow>
              {isMain ? null : <SRow theme={theme} label="从侧栏隐藏" hint="仍然可以搜索到。">{sw(b.hidden === true, (hidden) => run(client!.call('set-flags', { id: b.id, hidden })), '从侧栏隐藏')}</SRow>}
            </SCard>}
            <SCard theme={theme} title="管理">
              {b.private === true ? null : <SRow theme={theme} label="复制一份" hint="复制分工和模型，记忆从零开始。" onPress={() => client!.call<any>('duplicate-bot', { id: b.id }).then(async (copy) => { await refresh(); if (copy?.id) onOpenBot?.(copy.id); }, (e: any) => setErr(String(e?.message ?? e)))}><Text style={{ color: theme.sub }}>›</Text></SRow>}
              {isMain ? null : <SRow theme={theme} danger label={confirming ? `删除 ${b.name}？` : '删除 Bot'} hint={confirming ? '再点一次删除，它的对话会归档。' : '把这个 Bot 从团队里移除。'}
                onPress={() => { if (!confirming) { setConfirming(true); return; } client!.call('delete-bot', { id: b.id }).then(async () => { await refresh(); onClose(); }, (e: any) => setErr(String(e?.message ?? e))); }}><Text style={{ color: theme.sub }}>›</Text></SRow>}
            </SCard>
          </>
        ) : (
          liveRoom ? <GroupSettingsForm theme={theme} room={liveRoom} onOpenBot={onOpenBot} onDeleted={onClose} /> : null
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
function GroupSettingsForm({ theme, room, onOpenBot, onDeleted }: { theme: Theme; room: Room; onOpenBot?(id: string): void; onDeleted?(): void }) {
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { if (!confirming) return; const t = setTimeout(() => setConfirming(false), 4000); return () => clearTimeout(t); }, [confirming]);
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
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <GroupAvatar members={members} size={64} ring={theme.bg} />
        <View style={{ marginLeft: 14, flexShrink: 1 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>{room.name}</Text>
          <Text style={{ color: theme.sub, fontSize: 13 }}>{`${(room.members ?? []).length} 位成员 · ${admin ? `管理员 ${admin.name}` : '无管理员'}`}</Text>
        </View>
      </View>
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
              <Pressable accessibilityLabel={`打开 ${m.name} 的对话`} onPress={() => onOpenBot?.(m.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Avatar bot={m} size={26} ring={theme.card} />
                <Text style={{ flex: 1, color: theme.text, marginLeft: 10 }}>{m.name}{leads ? '  · 管理员' : ''}</Text>
              </Pressable>
              <Pressable hitSlop={8} accessibilityLabel={leads ? '让群聊不设管理员' : undefined} onPress={() => update({ admin: leads ? null : m.id }).catch(() => {})}
                style={{ backgroundColor: theme.cardHi, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: theme.text, fontSize: 13 }}>{leads ? '取消' : '设为管理员'}</Text>
              </Pressable>
              {members.length > 2 ? <Pressable hitSlop={8} accessibilityLabel={`把 ${m.name} 移出群聊`} onPress={() => update({ remove: [m.id] }).catch(() => {})} style={{ paddingLeft: 12 }}><Text style={{ color: theme.sub, fontSize: 18 }}>×</Text></Pressable> : null}
            </View>
          );
        })}
        {adding ? <>
          {(state?.bots ?? []).filter((b) => !(room.members ?? []).includes(b.id)).map((b) => <Pressable key={b.id} onPress={() => { setAdding(false); update({ add: [b.id] }).catch(() => {}); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Avatar bot={b} size={22} ring={theme.card} /><Text style={{ flex: 1, color: theme.text, marginLeft: 10 }}>{b.name}</Text><Text style={{ color: theme.sub, fontSize: 12 }}>添加</Text></Pressable>)}
          <Pressable onPress={() => setAdding(false)} style={{ paddingVertical: 8 }}><Text style={{ color: theme.sub }}>取消</Text></Pressable>
        </> : (state?.bots ?? []).some((b) => !(room.members ?? []).includes(b.id)) ? <Pressable onPress={() => setAdding(true)} style={{ paddingVertical: 8 }}><Text style={{ color: theme.sub }}>＋ 添加成员</Text></Pressable> : null}
        <Text style={{ color: theme.sub, fontSize: 12, marginTop: 6 }}>{members.length < 2 ? '请先添加一个 Bot：群聊至少要两个。' : admin ? `${admin.name} 主持这个群：可以用 @名字 点名成员、修改群设置、在群里发言。` : '还没有管理员。管理员可以用 @名字 点名成员、修改群设置、在群里发言。'}</Text>
      </View>
      <Label theme={theme}>侧栏</Label>
      <View style={box}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: theme.text }}>置顶</Text><Text style={{ color: theme.faint, fontSize: 12 }}>排在其他对话上面。</Text></View>
          <Switch value={room.pinned === true} accessibilityLabel="置顶" onValueChange={(pinned) => client!.call('set-flags', { id: room.id, pinned }).then(refresh).catch(() => {})} /></View>
        <View style={{ height: 1, backgroundColor: theme.sep, marginVertical: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: theme.text }}>从侧栏隐藏</Text><Text style={{ color: theme.faint, fontSize: 12 }}>仍然可以搜索到。</Text></View>
          <Switch value={room.hidden === true} accessibilityLabel="从侧栏隐藏" onValueChange={(hidden) => client!.call('set-flags', { id: room.id, hidden }).then(refresh).catch(() => {})} /></View>
      </View>
      <Label theme={theme}>管理</Label>
      <Pressable onPress={() => { if (!confirming) { setConfirming(true); return; } client!.call('delete-room', { id: room.id }).then(async () => { await refresh(); onDeleted?.(); }, (e: any) => ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT)); }}
        style={[box, confirming ? { backgroundColor: 'rgba(229,55,45,0.08)' } : null]}>
        <Text style={{ color: theme.danger, fontWeight: '500' }}>{confirming ? `删除 ${room.name}？` : '删除群聊'}</Text>
        <Text style={{ color: theme.faint, fontSize: 12 }}>{confirming ? '再点一次删除，聊天记录会归档。' : '删除这个群聊，成员仍留在团队里。'}</Text>
      </Pressable>
    </>
  );
}
