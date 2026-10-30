// Inline cards like the DS Bot web UI: question (ask_user), view (show_view), approval.
// Labels follow the web UI's zh dictionary.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { Approval, QOption, Question, ViewCard } from '../api';
import { Markdown } from './Markdown';
import type { Theme } from '../theme';

const letter = (i: number) => String.fromCharCode(65 + i);
const opts = (q?: { options?: QOption[] }) => (q?.options ?? []).map((o) => (typeof o === 'string' ? { label: o } : o));
const BLUE = '#4d6bfe';

function Shell({ theme, title, detail, onDismiss, busy, children, badge }: { theme: Theme; title: string; detail?: string; onDismiss?: () => void; busy?: boolean; children?: React.ReactNode; badge?: string }) {
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.fillBorder, padding: 14, marginVertical: 6, opacity: busy ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          {title ? <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', lineHeight: 22 }}>{title}</Text> : null}
          {detail ? <Text style={{ color: theme.sub, fontSize: 14, marginTop: 4 }}>{detail}</Text> : null}
        </View>
        {badge ? <Text style={{ color: theme.sub, fontSize: 12, backgroundColor: theme.cardHi, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>{badge}</Text> : null}
        {onDismiss ? <Pressable onPress={onDismiss} disabled={busy} accessibilityLabel="关闭" hitSlop={10} style={{ marginLeft: 8 }}><Text style={{ color: theme.sub, fontSize: 18 }}>✕</Text></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

function OptRow({ theme, i, label, desc, picked, onPress, disabled }: { theme: Theme; i?: number; label: string; desc?: string; picked?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || !onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginTop: 8, borderRadius: 12, backgroundColor: pressed ? theme.cardHi : theme.fill, borderWidth: 1, borderColor: picked ? BLUE : theme.fillBorder })}>
      {i != null ? <Text style={{ color: theme.sub, fontSize: 12, width: 22, height: 22, lineHeight: 22, textAlign: 'center', borderRadius: 6, backgroundColor: theme.cardHi, marginRight: 10 }}>{letter(i)}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
        {desc ? <Text style={{ color: theme.sub, fontSize: 13, marginTop: 2 }}>{desc}</Text> : null}
      </View>
      {picked ? <Text style={{ color: BLUE, fontSize: 16 }}>✓</Text> : null}
    </Pressable>
  );
}
function Btn({ theme, title, primary, onPress, disabled }: { theme: Theme; title: string; primary?: boolean; onPress(): void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ height: 36, paddingHorizontal: 16, borderRadius: 18, marginLeft: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? BLUE : theme.cardHi, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 })}>
      <Text style={{ color: primary ? '#fff' : theme.text, fontSize: 14, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

/** Runs an answer call; keeps the card (and its input) if it fails. */
function useRun(onError?: (e: unknown) => void) {
  const [busy, setBusy] = useState(false);
  const run = (f: () => Promise<unknown>) => { if (busy) return; setBusy(true); f().catch((e) => onError?.(e)).finally(() => setBusy(false)); };
  return [busy, run] as const;
}

export function QuestionCard({ theme, q, onAnswer, onDismiss, onError }: { theme: Theme; q: Question; onAnswer(a: { selected: string[]; custom?: string }): Promise<unknown>; onDismiss(): Promise<unknown>; onError?(e: unknown): void }) {
  const [busy, run] = useRun(onError);
  const [picked, setPicked] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const multi = q.multiSelect === true;
  const custom = own.trim();
  const canSubmit = multi ? picked.length > 0 || !!custom : !!custom;
  const choose = (label: string) => {
    if (multi) setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
    else run(() => onAnswer({ selected: [label] }));
  };
  return (
    <Shell theme={theme} title={(q.header ? `${q.header} · ` : '') + q.question} detail={q.detail} onDismiss={() => run(onDismiss)} busy={busy}>
      {opts(q).map((o, i) => <OptRow key={o.label} theme={theme} i={i} label={o.label} desc={o.description} picked={multi && picked.includes(o.label)} onPress={() => choose(o.label)} disabled={busy} />)}
      {q.allowCustom ? (
        <TextInput value={own} onChangeText={setOwn} editable={!busy} placeholder="输入你自己的回答" placeholderTextColor={theme.sub} multiline
          style={{ color: theme.text, fontSize: 15, marginTop: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder }} />
      ) : null}
      {canSubmit ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
        {busy ? <ActivityIndicator color={theme.sub} /> : null}
        <Btn theme={theme} primary title="提交" disabled={busy} onPress={() => run(() => onAnswer({ selected: multi ? picked : [], ...(custom ? { custom } : {}) }))} />
      </View> : null}
    </Shell>
  );
}

/** An answered card left in the transcript: chosen rows with a check, or 已关闭. */
export function SettledQuestion({ theme, q, answer }: { theme: Theme; q: Question; answer?: { selected?: string[]; custom?: string } }) {
  const chosen = [...(answer?.selected ?? []), ...(answer?.custom ? [answer.custom] : [])];
  const all = opts(q);
  return (
    <View style={{ opacity: 0.75 }}>
      <Shell theme={theme} title={q.question} badge={chosen.length ? undefined : '已关闭'}>
        {chosen.map((label, k) => { const i = all.findIndex((o) => o.label === label); return <OptRow key={k} theme={theme} i={i >= 0 ? i : undefined} label={label} picked />; })}
      </Shell>
    </View>
  );
}

// ---- Views (deep-view blueprints). Display nodes and the inputs the web card answers with.
type Ctx = { theme: Theme; busy: boolean; submit(action: string, extra: object): void; inputs: Record<string, any>; setInput(id: string, v: any): void };
function Node({ n, c }: { n: any; c: Ctx }): React.ReactElement | null {
  const { theme } = c;
  if (!n || typeof n !== 'object') return null;
  switch (n.type) {
    case 'stack': case 'row':
      return <View style={{ flexDirection: n.type === 'row' ? 'row' : 'column', flexWrap: 'wrap', gap: 8 }}>{(n.children ?? []).map((ch: any, i: number) => <Node key={ch?.id ?? i} n={ch} c={c} />)}</View>;
    case 'text': return <Markdown text={typeof n.text === 'string' ? n.text : String(n.text?.value ?? '')} color={n.tone === 'muted' ? theme.sub : theme.text} codeBg={theme.code} size={15} />;
    case 'metric': return <View style={{ padding: 10, borderRadius: 12, backgroundColor: theme.fill }}><Text style={{ color: theme.sub, fontSize: 12 }}>{n.label}</Text><Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{String(n.value ?? '')}{n.unit ? ` ${n.unit}` : ''}</Text></View>;
    case 'callout': return <View style={{ padding: 10, borderRadius: 12, backgroundColor: theme.fill, borderLeftWidth: 3, borderLeftColor: BLUE }}>{n.title ? <Text style={{ color: theme.text, fontWeight: '600' }}>{n.title}</Text> : null}<Text style={{ color: theme.text }}>{String(n.text ?? '')}</Text></View>;
    case 'progress': { const v = Math.max(0, Math.min(1, Number(n.value ?? 0) / Number(n.max ?? 1))); return <View><Text style={{ color: theme.sub, fontSize: 13 }}>{n.label}</Text><View style={{ height: 6, borderRadius: 3, backgroundColor: theme.cardHi, marginTop: 4 }}><View style={{ width: `${v * 100}%`, height: 6, borderRadius: 3, backgroundColor: BLUE }} /></View></View>; }
    case 'table': {
      const cols: any[] = n.columns ?? []; const rows: any[] = n.rows ?? [];
      return <View>{[cols.map((x) => x?.label ?? x), ...rows.map((r) => (Array.isArray(r) ? r : cols.map((x) => r?.[x?.id ?? x])))].map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.sep, paddingVertical: 4 }}>{r.map((v: any, j: number) => <Text key={j} style={{ flex: 1, color: i ? theme.text : theme.sub, fontSize: 13 }}>{String(v ?? '')}</Text>)}</View>))}</View>;
    }
    case 'options': return <OptionsNode n={n} c={c} />;
    case 'confirm': return <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn theme={theme} title={n.cancelLabel ?? '取消'} disabled={c.busy} onPress={() => c.submit(n.id, { confirmed: false })} /><Btn theme={theme} primary title={n.confirmLabel ?? '确认'} disabled={c.busy} onPress={() => c.submit(n.id, { confirmed: true })} /></View>;
    case 'form': return <FormNode n={n} c={c} />;
    case 'submit': return <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn theme={theme} primary title={n.label || '发给 Bot'} disabled={c.busy} onPress={() => c.submit(n.id, {})} /></View>;
    case 'choice': return <View>{n.label ? <Text style={{ color: theme.sub, fontSize: 13 }}>{n.label}</Text> : null}{opts(n).map((o) => <OptRow key={o.label} theme={theme} label={o.label} picked={(c.inputs[n.id] ?? n.value) === o.label} onPress={() => c.setInput(n.id, o.label)} />)}</View>;
    case 'toggle': return <OptRow theme={theme} label={n.label ?? n.id} picked={!!(c.inputs[n.id] ?? n.value)} onPress={() => c.setInput(n.id, !(c.inputs[n.id] ?? n.value))} />;
    case 'number': case 'slider':
      return <View><Text style={{ color: theme.sub, fontSize: 13 }}>{n.label}</Text><TextInput keyboardType="numeric" value={String(c.inputs[n.id] ?? n.value ?? '')} onChangeText={(s) => c.setInput(n.id, Number(s))} style={{ color: theme.text, padding: 8, borderRadius: 10, backgroundColor: theme.fill }} /></View>;
    default: return <Text style={{ color: theme.sub, fontSize: 13 }}>（{n.type} 内容请在网页版查看）</Text>;
  }
}
function OptionsNode({ n, c }: { n: any; c: Ctx }) {
  const [picked, setPicked] = useState<string[]>([]);
  const multi = n.multiSelect === true || n.multiple === true;
  return <View>{opts(n).map((o, i) => <OptRow key={o.label} theme={c.theme} i={i} label={o.label} desc={o.description} picked={multi && picked.includes(o.label)} disabled={c.busy}
    onPress={() => (multi ? setPicked((p) => (p.includes(o.label) ? p.filter((x) => x !== o.label) : [...p, o.label])) : c.submit(n.id, { selected: [o.label] }))} />)}
    {multi && picked.length ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}><Btn theme={c.theme} primary title="提交" disabled={c.busy} onPress={() => c.submit(n.id, { selected: picked })} /></View> : null}</View>;
}
function FormNode({ n, c }: { n: any; c: Ctx }) {
  const fields: any[] = n.fields ?? [];
  const [draft, setDraft] = useState<Record<string, string>>({});
  return <View>{fields.map((f) => <View key={f.id} style={{ marginTop: 8 }}>
    <Text style={{ color: c.theme.sub, fontSize: 13, marginBottom: 4 }}>{f.label}</Text>
    <TextInput value={draft[f.id] ?? ''} onChangeText={(s) => setDraft((d) => ({ ...d, [f.id]: s }))} placeholder={f.placeholder} placeholderTextColor={c.theme.faint} editable={!c.busy}
      style={{ color: c.theme.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: c.theme.fill, borderWidth: 1, borderColor: c.theme.fillBorder }} />
  </View>)}
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}><Btn theme={c.theme} primary title={n.submitLabel === 'Send' || !n.submitLabel ? '发给 Bot' : n.submitLabel} disabled={c.busy}
      onPress={() => c.submit(n.id, { fields: Object.fromEntries(fields.map((f) => [f.id, draft[f.id] ?? ''])) })} /></View></View>;
}

export function ViewCardView({ theme, v, onReply, onDismiss, onError }: { theme: Theme; v: ViewCard; onReply(action: string, values: object): Promise<unknown>; onDismiss(): Promise<unknown>; onError?(e: unknown): void }) {
  const [busy, run] = useRun(onError);
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const c: Ctx = { theme, busy, inputs, setInput: (id, x) => setInputs((s) => ({ ...s, [id]: x })),
    submit: (action, extra) => run(() => onReply(action, Object.keys(inputs).length ? { ...extra, inputs } : extra)) };
  return <Shell theme={theme} title={v.title ?? ''} onDismiss={() => run(onDismiss)} busy={busy}><View style={{ marginTop: 8 }}><Node n={v.view} c={c} /></View></Shell>;
}

export function ApprovalCard({ theme, a, botName, onAnswer, onError }: { theme: Theme; a: Approval; botName: string; onAnswer(choice: 'allow' | 'reject'): Promise<unknown>; onError?(e: unknown): void }) {
  const [busy, run] = useRun(onError);
  return (
    <Shell theme={theme} title={`${botName} 等你批准`} busy={busy}>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginTop: 8 }}>{a.tool}</Text>
      {a.detail?.text ? <Text style={{ color: theme.text, fontSize: 14, marginTop: 4 }}>{a.detail.text}</Text> : null}
      {a.reason ? <Text numberOfLines={3} style={{ color: theme.sub, fontSize: 13, marginTop: 4 }}>{a.reason}</Text> : null}
      {a.detail?.code ? <Text numberOfLines={2} style={{ color: theme.text, fontFamily: 'monospace', fontSize: 12, backgroundColor: theme.code, padding: 8, borderRadius: 8, marginTop: 6 }}>{a.detail.code}</Text> : null}
      {a.answerable !== false ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <Btn theme={theme} title="拒绝" disabled={busy} onPress={() => run(() => onAnswer('reject'))} />
          <Btn theme={theme} primary title="允许一次" disabled={busy} onPress={() => run(() => onAnswer('allow'))} />
        </View>
      ) : <Text style={{ color: theme.sub, fontSize: 13, marginTop: 8 }}>请在 {botName} 的私聊里处理</Text>}
    </Shell>
  );
}
