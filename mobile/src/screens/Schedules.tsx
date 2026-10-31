// Scheduled tasks = web schedules.js: SchedulesPage (账户菜单「自动化任务」/ 设置 → 定时任务),
// BotSchedules (Bot 设置里的「定时任务」), ScheduleSummary (详情面板那一行) and TaskForm.
// The host has list / create / delete only, so there is no edit or pause here either.
import React, { useEffect, useRef, useState } from 'react';
import { useFT } from '../selfTest'; // TEST-ONLY
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { BotClient, ScheduleTask, ScheduleView, ScheduleWhen } from '../api';
import { NARROW, clockText, localText, inAnHour, localZone, nextText, parseLocal, timingText } from '../api/schedules';
export { timingText };
import { Avatar, GroupAvatar } from '../components/Avatar';
import { PageHeader, PillButton, RoundButton } from '../components/ui';
import { useStore } from '../store';
import type { Theme } from '../theme';

const POLL_MS = 30_000;
const OFF_HINT = '在 Harness 设置的插件页启用「自动化任务」。';

// One view shared by every surface; each asks again when it mounts (web useSchedules).
let shared: ScheduleView | null = null;
const listeners = new Set<(v: ScheduleView) => void>();
// schedules.js uses native <input type="datetime-local"> (once) and <input type="time"> (daily/weekly), no min/max:
// on Android those are the system date + time pickers.
function pickAt(at: string, set: (v: string) => void) {
  let base: Date; try { base = new Date(parseLocal(at)); } catch { base = new Date(); }
  DateTimePickerAndroid.open({ value: base, mode: 'date', onChange: (e, d) => {
    if (e.type !== 'set' || !d) return;
    DateTimePickerAndroid.open({ value: d, mode: 'time', is24Hour: true, onChange: (e2, t) => { if (e2.type === 'set' && t) set(localText(t)); } });
  } });
}
function pickTime(time: string, set: (v: string) => void) {
  const [h, m] = time.split(':').map(Number); const v = new Date(); v.setHours(h || 0, m || 0, 0, 0);
  DateTimePickerAndroid.open({ value: v, mode: 'time', is24Hour: true, onChange: (e, t) => { if (e.type === 'set' && t) set(clockText(t)); } });
}
export function publishSchedules(view: ScheduleView) { shared = view; for (const l of listeners) l(view); }
export function useSchedules(client: BotClient | null | undefined) {
  const [view, setView] = useState<ScheduleView | null>(shared);
  useEffect(() => {
    if (!client) return;
    listeners.add(setView);
    let stopped = false; let timer: any;
    const load = () => client.schedules().then((v) => { if (!stopped) publishSchedules(v); }).catch(() => {}).finally(() => { if (!stopped) timer = setTimeout(load, POLL_MS); });
    load();
    return () => { stopped = true; clearTimeout(timer); listeners.delete(setView); };
  }, [client]);
  return view;
}

// Harness settings live in the DSH shell, which the phone cannot open.
const HarnessButton = ({ theme }: { theme: Theme }) => <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.fill, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 }}><Text style={{ color: theme.faint, fontSize: 13 }}>打开 Harness 设置 · 移动端暂未实现</Text></View>;

function TaskRow({ theme, task, showBot }: { theme: Theme; task: ScheduleTask; showBot?: boolean }) {
  const { client, state } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!confirming) return; const t = setTimeout(() => setConfirming(false), 3000); return () => clearTimeout(t); }, [confirming]);
  const remove = () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    client?.scheduleDelete(task.sessionId, task.id).then(publishSchedules, () => setBusy(false));
  };
  const room = task.roomId ? state?.rooms?.find((r) => r.id === task.roomId) : undefined;
  const bot = showBot && task.botId ? state?.bots.find((b) => b.id === task.botId) : undefined;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, opacity: busy ? 0.4 : task.status === 'active' ? 1 : 0.6 }}>
      {bot ? <View style={{ marginRight: 10 }}><Avatar bot={bot} size={28} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>{task.title}</Text>
        <Text style={{ color: theme.sub, fontSize: 12, marginTop: 2 }}>{[timingText(task), room ? `在 ${room.name}` : ''].filter(Boolean).join(' · ')}</Text>
        {task.prompt && task.prompt !== task.title ? <Text numberOfLines={2} style={{ color: theme.sub, fontSize: 12, marginTop: 2 }}>{task.prompt}</Text> : null}
      </View>
      <Text style={{ color: theme.faint, fontSize: 12, marginLeft: 8 }}>{nextText(task)}</Text>
      <Pressable disabled={busy} onPress={remove} accessibilityLabel={confirming ? '再点一次删除' : '删除任务'} hitSlop={8}
        style={{ marginLeft: 8, minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: confirming ? 10 : 0, alignItems: 'center', justifyContent: 'center', backgroundColor: confirming ? theme.danger + '22' : 'transparent' }}>
        <Text style={{ color: confirming ? theme.danger : theme.sub, fontSize: confirming ? 13 : 16 }}>{confirming ? '删除' : '🗑'}</Text>
      </Pressable>
    </View>
  );
}

const KINDS: [ScheduleWhen['kind'], string][] = [['at', '一次'], ['daily', '每天'], ['weekly', '每周'], ['every', '重复']];
const UNITS: [string, number, string][] = [['minutes', 1, '分钟'], ['hours', 60, '小时'], ['days', 1440, '天']];
function Seg({ theme, items, value, onChange }: { theme: Theme; items: [string, string][]; value: string; onChange(v: string): void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.fill, borderRadius: 12, padding: 3, marginTop: 8 }}>
      {items.map(([id, label]) => <Pressable key={id} onPress={() => onChange(id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: value === id ? theme.cardHi : 'transparent' }}>
        <Text style={{ color: value === id ? theme.text : theme.sub, fontWeight: value === id ? '600' : '400' }}>{label}</Text></Pressable>)}
    </View>
  );
}

export function TaskForm({ theme, start, onDone, onCancel }: { theme: Theme; start?: string; onDone(): void; onCancel(): void }) {
  const { client, state } = useStore();
  const bots = state?.bots ?? []; const rooms = state?.rooms ?? [];
  const [target, setTarget] = useState(start || bots[0]?.id || '');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<ScheduleWhen['kind']>('daily');
  const [at, setAt] = useState(inAnHour);
  const [time, setTime] = useState('09:00');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [count, setCount] = useState('1');
  const [unit, setUnit] = useState('hours');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(false);
  const timing = (): ScheduleWhen => {
    if (kind === 'at') return { kind, at: parseLocal(at) };
    if (kind === 'every') return { kind, minutes: Math.round(Number(count) * UNITS.find(([id]) => id === unit)![1]) };
    return kind === 'weekly' ? { kind, time, timeZone: localZone(), weekdays } : { kind: 'daily', time, timeZone: localZone() };
  };
  const submit = () => {
    if (busy || !client) return;
    setBusy(true); setError('');
    let when: ScheduleWhen;
    try { when = timing(); } catch { setError('选一个日期和时间'); setBusy(false); return; }
    client.scheduleCreate({ target, title, prompt, when }).then((v) => { publishSchedules(v); onDone(); }, (e) => { setError(String(e?.message ?? e)); setBusy(false); });
  };
  const toggleDay = (d: number) => setWeekdays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  const targetName = bots.find((b) => b.id === target)?.name ?? rooms.find((r) => r.id === target)?.name ?? '';
  const box = { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.fillBorder, padding: 14, marginTop: 12 };
  const input = { color: theme.text, fontSize: 16, paddingVertical: 6 };
  const small = { color: theme.text, fontSize: 15, backgroundColor: theme.fill, borderRadius: 10, borderWidth: 1, borderColor: theme.fillBorder, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 };
  return (
    <View>
      <Pressable onPress={() => setPick((v) => !v)} style={[box, { flexDirection: 'row', alignItems: 'center' }]}>
        <Text style={{ flex: 1, color: theme.sub }}>发给</Text>
        <Text style={{ color: theme.text, fontSize: 15 }}>{targetName} ⌄</Text>
      </Pressable>
      {pick ? <View style={[box, { paddingVertical: 6 }]}>
        <Text style={{ color: theme.faint, fontSize: 12, marginTop: 4 }}>Bot</Text>
        {bots.map((b) => <Pressable key={b.id} onPress={() => { setTarget(b.id); setPick(false); }} style={{ paddingVertical: 9, flexDirection: 'row' }}><Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>{b.name}</Text>{target === b.id ? <Text style={{ color: theme.text }}>✓</Text> : null}</Pressable>)}
        {rooms.length ? <Text style={{ color: theme.faint, fontSize: 12, marginTop: 6 }}>群聊</Text> : null}
        {rooms.map((r) => <Pressable key={r.id} onPress={() => { setTarget(r.id); setPick(false); }} style={{ paddingVertical: 9, flexDirection: 'row' }}><Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>{r.name}</Text>{target === r.id ? <Text style={{ color: theme.text }}>✓</Text> : null}</Pressable>)}
      </View> : null}
      <View style={box}>
        <Text style={{ color: theme.sub }}>名字</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={120} autoFocus placeholder="早间简报" placeholderTextColor={theme.faint} style={input} />
      </View>
      <View style={box}>
        <Text style={{ color: theme.sub }}>要做什么</Text>
        <TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="总结一下昨天以来的变化，以及今天需要我处理的事。" placeholderTextColor={theme.faint} style={[input, { minHeight: 72, textAlignVertical: 'top' }]} />
      </View>
      <View style={box}>
        <Text style={{ color: theme.sub }}>什么时候</Text>
        <Seg theme={theme} items={KINDS} value={kind} onChange={(v) => setKind(v as ScheduleWhen['kind'])} />
        {kind === 'at' ? <Pressable accessibilityRole="button" accessibilityLabel="日期和时间" onPress={() => pickAt(at, setAt)} style={[small, { justifyContent: 'center' }]}><Text style={{ color: theme.text }}>{at}</Text></Pressable> : null}
        {kind === 'weekly' ? <View accessibilityLabel="星期" style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => { const on = weekdays.includes(d); return <Pressable key={d} onPress={() => toggleDay(d)} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: on ? theme.accent : theme.fillBorder, backgroundColor: on ? theme.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: on ? theme.accentText : theme.sub }}>{NARROW[d]}</Text></Pressable>; })}
        </View> : null}
        {kind === 'daily' || kind === 'weekly' ? <Pressable accessibilityRole="button" accessibilityLabel="时间" onPress={() => pickTime(time, setTime)} style={[small, { width: 110, justifyContent: 'center' }]}><Text style={{ color: theme.text }}>{time}</Text></Pressable> : null}
        {kind === 'every' ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: theme.sub, marginTop: 8, marginRight: 8 }}>每</Text>
          <TextInput accessibilityLabel="数量" value={count} onChangeText={setCount} keyboardType="number-pad" style={[small, { width: 72, marginRight: 8 }]} />
          <View style={{ flex: 1 }}><Seg theme={theme} items={UNITS.map(([id, , l]) => [id, l])} value={unit} onChange={setUnit} /></View>
        </View> : null}
      </View>
      {error ? <Text style={{ color: theme.danger, marginTop: 10 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 }}>
        <PillButton theme={theme} title="取消" onPress={onCancel} />
        <PillButton theme={theme} primary title={busy ? '创建中…' : '创建任务'} disabled={busy || !target || !title.trim() || !prompt.trim()} onPress={submit} />
      </View>
    </View>
  );
}

function Card({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return <View style={{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.fillBorder, overflow: 'hidden' }}>
    {items.map((c, i) => <View key={i}>{i > 0 ? <View style={{ height: 1, backgroundColor: theme.sep, marginLeft: 16 }} /> : null}{c}</View>)}</View>;
}

/** 设置 → 定时任务 (web SchedulesPage): tasks grouped by chat, '新建任务', or the off hint. */
export function SchedulesScreen({ theme, start, onBack }: { theme: Theme; start?: string; onBack(): void }) {
  const { client, state } = useStore();
  const view = useSchedules(client);
  const [adding, setAdding] = useState(Boolean(start));
  useFT('sched.add', (on: boolean) => setAdding(on)); // TEST-ONLY (form is cancelled, never created)
  useFT('sched.available', () => !!view?.available); // TEST-ONLY
  const scroll = useRef<any>(null);
  useFT('sched.end', () => scroll.current?.scrollToEnd({ animated: true })); // TEST-ONLY: keyboard stays up
  const bots = state?.bots ?? []; const rooms = state?.rooms ?? [];
  const groups = view?.available ? [
    ...bots.map((b) => ({ id: b.id, avatar: <Avatar bot={b} size={18} />, name: b.name, tasks: view.tasks.filter((t) => t.botId === b.id) })),
    ...rooms.map((r) => ({ id: r.id, avatar: <GroupAvatar members={(r.members ?? []).map((m) => bots.find((b) => b.id === m)!).filter(Boolean)} size={18} />, name: r.name, tasks: view.tasks.filter((t) => !t.botId && t.roomId === r.id) })),
  ].filter((g) => g.tasks.length > 0) : [];
  return (
    // schedules.js autofocuses the title too; edge-to-edge Android does not resize for the
    // keyboard, so the page pads itself and 什么时候 scrolls into reach above it.
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: theme.bg }}>
      <PageHeader theme={theme} title="定时任务" onBack={onBack} />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {view === null ? <Text style={{ color: theme.sub }}>加载中…</Text>
          : !view.available ? (
            <View style={{ alignItems: 'center', padding: 28, backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.fillBorder }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.fill, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, color: theme.sub }}>🕘</Text></View>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 10 }}>在 DSH 里打开「自动化任务」</Text>
              <Text style={{ color: theme.sub, fontSize: 13, marginTop: 6, textAlign: 'center' }}>{OFF_HINT}</Text>
              <HarnessButton theme={theme} />
            </View>
          ) : (
            <>
              {adding ? <TaskForm theme={theme} start={start} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
                : <View style={{ alignItems: 'flex-start' }}><PillButton theme={theme} title="+ 新建任务" onPress={() => setAdding(true)} /></View>}
              {groups.length === 0 && !adding ? <View style={{ marginTop: 16 }}><Card theme={theme}><Text style={{ color: theme.sub, padding: 16 }}>还没有定时任务。</Text></Card></View>
                : groups.map((g) => <View key={g.id} style={{ marginTop: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 4 }}>{g.avatar}<Text style={{ color: theme.sub, fontSize: 14, marginLeft: 6 }}>{g.name}</Text></View>
                  <Card theme={theme}>{g.tasks.map((t) => <TaskRow key={t.id} theme={theme} task={t} />)}</Card>
                </View>)}
            </>
          )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Bot 设置里的「定时任务」 (web BotSchedules). */
export function BotSchedules({ theme, botId, onNew }: { theme: Theme; botId: string; onNew(): void }) {
  const { client } = useStore();
  const view = useSchedules(client);
  if (view === null) return null;
  const tasks = view.available ? view.tasks.filter((t) => t.botId === botId) : [];
  return (
    <View>
      <Text style={{ color: theme.sub, fontSize: 14, marginTop: 22, marginBottom: 8 }}>定时任务</Text>
      <Card theme={theme}>
        {!view.available ? <View style={{ padding: 16, alignItems: 'flex-start' }}><Text style={{ color: theme.sub, fontSize: 13 }}>{OFF_HINT}</Text><HarnessButton theme={theme} /></View> : null}
        {tasks.map((t) => <TaskRow key={t.id} theme={theme} task={t} />)}
        {view.available ? <Pressable onPress={onNew} style={{ padding: 16 }}><Text style={{ color: theme.text, fontSize: 15 }}>＋ 新建任务</Text></Pressable> : null}
      </Card>
    </View>
  );
}

/** 详情面板的「定时任务」行 (web ScheduleSummary). */
export function ScheduleSummary({ theme, botId, onOpen }: { theme: Theme; botId: string; onOpen(start?: string): void }) {
  const { client } = useStore();
  const view = useSchedules(client);
  const tasks = view?.available ? view.tasks.filter((t) => t.botId === botId && t.status === 'active') : [];
  return (
    <View>
      <Text style={{ color: theme.sub, fontSize: 14, marginTop: 22, marginBottom: 8 }}>定时任务</Text>
      {tasks.length === 0
        ? <Pressable onPress={() => onOpen(botId)}><Text style={{ color: theme.sub }}>{view?.available === false ? OFF_HINT : '还没有定时任务，去添加'}</Text></Pressable>
        : tasks.slice(0, 3).map((t) => <Pressable key={t.id} onPress={() => onOpen()} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ color: theme.faint, marginRight: 8 }}>🕘</Text>
          <Text numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 14 }}>{t.title}</Text>
          <Text style={{ color: theme.faint, fontSize: 12, marginLeft: 8 }}>{timingText(t)}</Text>
        </Pressable>)}
    </View>
  );
}
