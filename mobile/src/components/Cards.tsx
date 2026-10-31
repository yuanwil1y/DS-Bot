// Inline cards like the DS Bot web UI: question (ask_user), view (show_view), approval.
// Labels follow the web UI's zh dictionary.
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, Text, TextInput, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SvgChart, chartCsv } from './ChartSvg';
import { asText, choiceValue, inputDefault, resolve, viewInputs, viewScope } from '../vendor/deepview/views';
import type { Approval, Bot, QOption, Question, SecretRequest, ViewCard } from '../api';
import { Avatar } from './Avatar';
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
        {onDismiss ? <Pressable onPress={onDismiss} disabled={busy} accessibilityLabel="关闭问题" hitSlop={10} style={{ marginLeft: 8 }}><Text style={{ color: theme.sub, fontSize: 18 }}>✕</Text></Pressable> : null}
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

// questions.js QuestionView, raised (the dock card above the composer): own answer is one
// more keyed row; multi-select gets 可多选 and 跳过/提交; selection shows as an active row.
export function QuestionCard({ theme, q, onAnswer, onDismiss, onError }: { theme: Theme; q: Question; onAnswer(a: { selected: string[]; custom?: string }): Promise<unknown>; onDismiss(): Promise<unknown>; onError?(e: unknown): void }) {
  const [busy, run] = useRun(onError);
  const [picked, setPicked] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const multi = q.multiSelect === true;
  const custom = own.trim();
  const canSubmit = multi ? picked.length > 0 || !!custom : !!custom;
  const options = opts(q);
  const choose = (label: string) => {
    if (busy) return;
    if (multi) setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
    else run(() => onAnswer({ selected: [label], custom: '' }));
  };
  const submit = () => { if (canSubmit && !busy) run(() => onAnswer({ selected: multi ? picked : [], custom })); };
  const row = (on: boolean) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, paddingHorizontal: 12, marginTop: 1, borderRadius: 12, backgroundColor: on ? theme.cardHi : 'transparent' });
  const key = (i: number) => <Text style={{ color: theme.sub, fontSize: 12, width: 22, height: 22, lineHeight: 22, textAlign: 'center', borderRadius: 6, backgroundColor: theme.cardHi, marginRight: 10 }}>{letter(i)}</Text>;
  return (
    <Shell theme={theme} title={(q.header ? `${q.header} · ` : '') + q.question} detail={[q.detail, multi ? '可多选' : ''].filter(Boolean).join('\n') || undefined} onDismiss={() => run(onDismiss)} busy={busy}>
      <View style={{ marginTop: 8 }}>
        {options.map((o, i) => (
          <Pressable key={o.label} disabled={busy} onPress={() => choose(o.label)} accessibilityState={multi ? { selected: picked.includes(o.label) } : undefined} style={({ pressed }) => row((multi && picked.includes(o.label)) || pressed)}>
            {key(i)}
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 15 }}>{o.label}</Text>
              {o.description ? <Text style={{ color: theme.sub, fontSize: 13, marginTop: 2 }}>{o.description}</Text> : null}
            </View>
          </Pressable>
        ))}
        {q.allowCustom ? (
          <View style={row(!!custom)}>
            {options.length ? key(options.length) : null}
            <TextInput value={own} onChangeText={(v) => { if (!busy) setOwn(v); }} editable={!busy} placeholder="输入你自己的回答" accessibilityLabel="你自己的回答" placeholderTextColor={theme.sub} multiline
              blurOnSubmit onSubmitEditing={submit} style={{ flex: 1, color: theme.text, fontSize: 15, padding: 0 }} />
          </View>
        ) : null}
      </View>
      {multi ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <Btn theme={theme} title="跳过" disabled={busy} onPress={() => run(onDismiss)} />
          <Btn theme={theme} primary title="提交" disabled={!canSubmit || busy} onPress={submit} />
        </View>
      ) : canSubmit ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          {busy ? <ActivityIndicator color={theme.sub} /> : null}
          <Btn theme={theme} primary title="提交" disabled={busy} onPress={submit} />
        </View>
      ) : null}
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

// ---- Views (deep-view react/card.js WidgetCard). Formulas go through deep-view's own core
// (src/vendor/deepview, copied unchanged), labels through ds-bot's zh dictionary.
const TONE: Record<string, string> = { good: '#3fb950', warn: '#f0b84a', bad: '#e5484d' };
const countType = (n: any, type: string): number => (!n || typeof n !== 'object' ? 0 : (n.type === type ? 1 : 0) + (Array.isArray(n.children) ? n.children : []).reduce((s: number, ch: any) => s + countType(ch, type), 0));
const ANSWER_TYPES = new Set(['options', 'confirm', 'form', 'submit', 'slider', 'choice', 'toggle', 'number']);
const hasControls = (n: any): boolean => !!n && typeof n === 'object' && (ANSWER_TYPES.has(n.type) || (Array.isArray(n.children) && n.children.some(hasControls)));
const fieldsOf = (n: any) => (Array.isArray(n?.fields) ? n.fields : []).filter((f: any) => f && typeof f === 'object' && f.id !== undefined);
const answerValues = (answer: any, n: any) => (answer?.action === n.id ? answer.values : undefined);
const cellText = (v: any) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : asText(v));
const NUMERIC_CELL = /^[-+]?[\d.,]+\s?(%|[a-zA-Z]{1,4})?$/;
const fmtNum = (v: number) => { if (!Number.isFinite(v)) return asText(v); const a = Math.abs(v); const d = a >= 100 ? 0 : a >= 10 ? 1 : 2; return Number(v.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }); };
const chartUnit = (v: number, unit: string) => (unit ? (unit === '%' ? `${fmtNum(v)}%` : `${fmtNum(v)} ${unit}`) : fmtNum(v));
const PALETTE = [BLUE, '#f0883e', '#3fb950', '#a371f7', '#58a6ff', '#f778ba', '#e3b341', '#39c5cf', '#db61a2'];

type Ctx = { theme: Theme; busy: boolean; settled: boolean; answer: any; locked: boolean; lookup: any; values: Record<string, any>; submit(action: string, extra: object): void; setInput(id: string, v: any): void };

function Badge({ theme, label }: { theme: Theme; label: string }) {
  return <View style={{ alignSelf: 'flex-end' }}><Text style={{ color: theme.sub, fontSize: 12, backgroundColor: theme.cardHi, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>{label}</Text></View>;
}
const Foot = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>{children}</View>;

function Node({ n, c }: { n: any; c: Ctx }): React.ReactElement | null {
  const { theme, lookup } = c;
  if (!n || typeof n !== 'object') return null;
  switch (n.type) {
    case 'stack': case 'row':
      return <View style={n.type === 'row' ? { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 12 } : { gap: 12 }}>
        {(Array.isArray(n.children) ? n.children : []).map((ch: any, i: number) => <View key={ch?.id ?? i} style={n.type === 'row' ? { flexGrow: 1, flexBasis: 140, minWidth: 0 } : undefined}><Node n={ch} c={c} /></View>)}</View>;
    case 'text': return <Markdown text={asText(resolve(n.text, lookup, ''))} color={n.tone === 'muted' ? theme.sub : theme.text} codeBg={theme.code} size={n.tone === 'muted' ? 12 : 15} />;
    case 'metric': {
      const tone = resolve(n.tone, lookup); const cap = n.caption === undefined ? '' : asText(resolve(n.caption, lookup, ''));
      return <View><Text style={{ color: theme.sub, fontSize: 12 }}>{n.label}</Text>
        <Text style={{ color: TONE[tone] ?? theme.text, fontSize: 22, lineHeight: 28, fontWeight: '600' }}>{asText(resolve(n.value, lookup, '—'))}</Text>
        {cap ? <Text style={{ color: theme.sub, fontSize: 12 }}>{cap}</Text> : null}</View>;
    }
    case 'callout': {
      const tone = resolve(n.tone, lookup); const col = TONE[tone] ?? BLUE;
      return <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: col + '14' }}>
        <Text style={{ color: col, fontSize: 14, marginRight: 8 }}>ⓘ</Text>
        <View style={{ flex: 1 }}><Markdown text={asText(resolve(n.text, lookup, ''))} color={theme.text} codeBg={theme.code} size={14} /></View></View>;
    }
    case 'progress': {
      let p = n.percent !== undefined ? Number(resolve(n.percent, lookup, 0)) : (() => { const max = Number(resolve(n.max, lookup, 0)); return max > 0 ? (Number(resolve(n.value, lookup, 0)) / max) * 100 : 0; })();
      p = Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));
      const tone = resolve(n.tone, lookup); const right = n.valueLabel !== undefined ? asText(resolve(n.valueLabel, lookup, '')) : `${Math.round(p)}%`;
      return <View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '500' }}>{n.label}</Text><Text style={{ color: tone === 'bad' ? TONE.bad : theme.sub, fontSize: 12 }}>{right}</Text></View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.cardHi, marginTop: 5, overflow: 'hidden' }}><View style={{ width: `${p}%`, height: 6, backgroundColor: TONE[tone] ?? BLUE }} /></View></View>;
    }
    case 'table': {
      const cols: any[] = (Array.isArray(n.columns) ? n.columns : []).filter((x: any) => x && typeof x === 'object');
      const rows: any[][] = (Array.isArray(n.rows) ? n.rows : []).map((r: any) => (Array.isArray(r) ? r : []).map((x: any) => resolve(x, lookup, '')));
      const num = cols.map((_, i) => { const cells = rows.map((r) => r[i]).filter((x) => x !== undefined && x !== ''); return cells.length > 0 && cells.every((x) => typeof x === 'number' || (typeof x === 'string' && NUMERIC_CELL.test(x.trim()))); });
      return <Table theme={theme} head={cols.map((x) => x.label)} rows={rows.map((r) => cols.map((_, j) => cellText(r[j])))} num={num} />;
    }
    case 'chart': return <Chart n={n} c={c} />;
    case 'sources': {
      const items = (Array.isArray(n.items) ? n.items : []).filter((x: any) => typeof x?.url === 'string' && /^https?:\/\//i.test(x.url));
      return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{items.map((x: any, i: number) => <Pressable key={i} onPress={() => Linking.openURL(x.url)} style={{ height: 20, paddingHorizontal: 6, borderRadius: 4, backgroundColor: theme.cardHi, justifyContent: 'center', maxWidth: '100%' }}><Text numberOfLines={1} style={{ color: theme.sub, fontSize: 11 }}>🔗 {x.label}</Text></Pressable>)}</View>;
    }
    case 'html': return <Text style={{ color: theme.sub, fontSize: 12 }}>HTML 内容 · 移动端暂未实现</Text>;
    case 'slider': case 'number': return <NumberLike n={n} c={c} />;
    case 'choice': {
      const o = opts(n); const cur = c.values[n.id];
      const side = o.length <= 4 && o.every((x) => [...x.label].length <= 14);
      return <View style={{ gap: 6 }}><Text style={{ color: theme.sub, fontSize: 12 }}>{n.label}</Text>
        {side ? <View style={{ flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: theme.fill, borderRadius: 10, padding: 2 }}>{o.map((x) => { const on = choiceValue(x) === cur; return (
          <Pressable key={x.label} disabled={c.locked} onPress={() => c.setInput(n.id, choiceValue(x))} style={{ paddingHorizontal: 12, height: 28, justifyContent: 'center', borderRadius: 8, backgroundColor: on ? theme.card : 'transparent' }}><Text style={{ color: on ? theme.text : theme.sub, fontSize: 13 }}>{x.label}</Text></Pressable>); })}</View>
          : o.map((x) => { const on = choiceValue(x) === cur; return (
            <Pressable key={x.label} disabled={c.locked} onPress={() => c.setInput(n.id, choiceValue(x))} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 30 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: on ? 5 : 1.5, borderColor: on ? BLUE : theme.fillBorder, marginRight: 8 }} /><Text style={{ color: theme.text, fontSize: 14 }}>{x.label}</Text></Pressable>); })}</View>;
    }
    case 'toggle': return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}><Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>{n.label}</Text>
      <Switch value={c.values[n.id] === true} disabled={c.locked} onValueChange={(v) => c.setInput(n.id, v)} /></View>;
    case 'submit': return c.settled ? null : <Foot><Btn theme={theme} primary title={n.label || '发给 Bot'} disabled={c.busy} onPress={() => c.submit(n.id, {})} /></Foot>;
    case 'options': return c.settled ? <SettledOptionsNode n={n} c={c} /> : <OptionsNode n={n} c={c} />;
    case 'confirm': {
      const cancel = n.cancelLabel ?? '取消'; const ok = n.confirmLabel ?? '确认';
      if (c.settled) { const v = answerValues(c.answer, n)?.confirmed; if (v === true || v === false) return <Badge theme={theme} label={v ? ok : cancel} />; }
      return <Foot><Btn theme={theme} title={cancel} disabled={c.busy || c.settled} onPress={() => c.submit(n.id, { confirmed: false })} /><Btn theme={theme} primary title={ok} disabled={c.busy || c.settled} onPress={() => c.submit(n.id, { confirmed: true })} /></Foot>;
    }
    case 'form': return <FormNode n={n} c={c} />;
    default: return null;
  }
}
function Table({ theme, head, rows, num, rowHead }: { theme: Theme; head: string[]; rows: string[][]; num: boolean[]; rowHead?: boolean }) {
  const cell = (s: string, j: number, h: boolean) => <Text key={j} style={{ flex: 1, minWidth: 64, paddingVertical: 6, paddingHorizontal: 10, color: h ? theme.sub : theme.text, fontSize: 13, fontWeight: h ? '500' : '400', textAlign: num[j] ? 'right' : 'left' }}>{s}</Text>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderWidth: 0.5, borderColor: theme.fillBorder, borderRadius: 10 }} contentContainerStyle={{ flexGrow: 1 }}>
    <View style={{ flexGrow: 1 }}><View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: theme.fillBorder }}>{head.map((s, j) => cell(s, j, true))}</View>
      {rows.map((r, i) => <View key={i} style={{ flexDirection: 'row', borderTopWidth: i ? 0.5 : 0, borderTopColor: theme.sep }}>{r.map((s, j) => cell(s, j, !!rowHead && j === 0))}</View>)}</View></ScrollView>;
}
// chart.js ported to react-native-svg (ChartSvg); the ⋯ menu's 以表格查看 and 复制数据 sit
// in the head, 下载图片 is web-only.
function Chart({ n, c }: { n: any; c: Ctx }) {
  const { theme, lookup } = c;
  const [asTable, setAsTable] = useState(false);
  const [hidden, setHidden] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [menu, setMenu] = useState(false);
  const categories = (Array.isArray(n.categories) ? n.categories : []).map(asText);
  const series = (Array.isArray(n.series) ? n.series : []).map((s: any, i: number) => ({ name: typeof s?.name === 'string' ? s.name : '', color: PALETTE[i % PALETTE.length],
    values: categories.map((_: any, at: number) => { const v = Number(resolve(Array.isArray(s?.values) ? s.values[at] : undefined, lookup, 0)); return Number.isFinite(v) ? v : 0; }) }));
  const unit = typeof n.unit === 'string' ? n.unit : '';
  const data = { kind: typeof n.kind === 'string' ? n.kind : 'bar', categories, series, unit };
  const shown = series.map((_: any, i: number) => !hidden.includes(i));
  const toggle = (i: number) => { if (hidden.includes(i)) setHidden(hidden.filter((x) => x !== i)); else if (shown.filter(Boolean).length > 1) setHidden([...hidden, i]); };
  const heads = series.map((s: any, i: number) => s.name || (series.length === 1 ? unit || '值' : `系列 ${i + 1}`));
  const caption = typeof n.caption === 'string' && n.caption !== '' ? n.caption : '';
  const copy = () => { setMenu(false); Clipboard.setStringAsync(chartCsv(data)).then(() => ToastAndroid.show('已复制', ToastAndroid.SHORT)); };
  return <View style={{ gap: 8 }} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>{n.title ? <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>{n.title}</Text> : null}</View>
      <Pressable onPress={() => setMenu((v) => !v)} hitSlop={8}><Text style={{ color: theme.sub, fontSize: 16 }}>⋯</Text></Pressable>
    </View>
    {menu ? <View style={{ alignSelf: 'flex-end', backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.fillBorder, borderRadius: 10, paddingVertical: 4 }}>
      {[[asTable ? '以图表查看' : '以表格查看', () => { setMenu(false); setAsTable((v) => !v); }], ['复制数据', copy], ['下载图片 · 移动端暂未实现', null]].map(([label, fn]: any) =>
        <Pressable key={label} disabled={!fn} onPress={fn} style={{ paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: fn ? theme.text : theme.faint, fontSize: 13 }}>{label}</Text></Pressable>)}
    </View> : null}
    {asTable ? <Table theme={theme} rowHead head={['', ...heads]} num={[false, ...heads.map(() => true)]} rows={categories.map((label: string, at: number) => [label, ...series.map((s: any) => chartUnit(s.values[at], series.length === 1 && !s.name ? '' : unit))])} />
      : width > 0 ? <SvgChart data={data} theme={theme} palette={PALETTE} width={width} shown={shown} onToggle={toggle} /> : null}
    {caption ? <Text style={{ color: theme.sub, fontSize: 12 }}>{caption}</Text> : null}
  </View>;
}
function NumberLike({ n, c }: { n: any; c: Ctx }) {
  const { theme } = c;
  const [draft, setDraft] = useState<string | null>(null);
  const value = c.values[n.id];
  const slider = n.type === 'slider';
  const shown = `${typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 6 }) : asText(value)}${n.unit ? ` ${n.unit}` : ''}`;
  const accept = (raw: string) => {
    setDraft(raw); const x = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(x)) return;
    if ((n.min !== undefined && x < n.min) || (n.max !== undefined && x > n.max)) return;
    c.setInput(n.id, x);
  };
  const step = (dir: number) => { const s = Number(n.step) > 0 ? Number(n.step) : (n.max - n.min) / 20 || 1; const x = Math.min(n.max, Math.max(n.min, Number(value) + dir * s)); c.setInput(n.id, Number(x.toPrecision(12))); };
  return <View style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><Text style={{ color: theme.sub, fontSize: 12 }}>{n.label}</Text>{slider ? <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{shown}</Text> : null}</View>
    {slider ? <View style={{ flexDirection: 'row', alignItems: 'center', opacity: c.locked ? 0.6 : 1 }}>
      <Pressable disabled={c.locked} onPress={() => step(-1)} hitSlop={6} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.text }}>−</Text></Pressable>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.cardHi, marginHorizontal: 10, overflow: 'hidden' }}><View style={{ width: `${n.max > n.min ? Math.max(0, Math.min(100, ((Number(value) - n.min) / (n.max - n.min)) * 100)) : 0}%`, height: 6, backgroundColor: BLUE }} /></View>
      <Pressable disabled={c.locked} onPress={() => step(1)} hitSlop={6} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.text }}>＋</Text></Pressable>
    </View> : <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: 200 }}>
      <TextInput keyboardType="decimal-pad" editable={!c.locked} value={draft ?? asText(value)} onChangeText={accept} onBlur={() => setDraft(null)}
        style={{ flex: 1, color: theme.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder }} />
      {n.unit ? <Text style={{ color: theme.sub, fontSize: 13, marginLeft: 6 }}>{n.unit}</Text> : null}</View>}
  </View>;
}
function OptionsNode({ n, c }: { n: any; c: Ctx }) {
  const [picked, setPicked] = useState<string[]>([]);
  const multi = n.multi === true;
  const choose = (label: string) => { if (c.busy) return; if (multi) setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label])); else c.submit(n.id, { selected: [label] }); };
  const keys = countType(c.lookup?.__view, 'options') === 1;
  return <View>{opts(n).map((o, i) => <OptRow key={o.label} theme={c.theme} i={keys ? i : undefined} label={o.label} desc={o.description} picked={multi && picked.includes(o.label)} disabled={c.busy} onPress={() => choose(o.label)} />)}
    {multi ? <Foot><Btn theme={c.theme} primary title="提交" disabled={c.busy || picked.length === 0} onPress={() => { if (picked.length) c.submit(n.id, { selected: picked }); }} /></Foot> : null}</View>;
}
function SettledOptionsNode({ n, c }: { n: any; c: Ctx }) {
  const sel = answerValues(c.answer, n)?.selected; const chosen: string[] = Array.isArray(sel) ? sel : [];
  return <View>{opts(n).map((o) => <OptRow key={o.label} theme={c.theme} label={o.label} desc={o.description} picked={chosen.includes(o.label)} />)}</View>;
}
function FormNode({ n, c }: { n: any; c: Ctx }) {
  const fields: any[] = fieldsOf(n);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const sent = c.settled ? answerValues(c.answer, n)?.fields : undefined;
  const values: Record<string, string> = c.settled ? (sent && typeof sent === 'object' ? sent : {}) : draft;
  const submit = () => { if (!c.busy) c.submit(n.id, { fields: Object.fromEntries(fields.map((f) => [f.id, draft[f.id] ?? ''])) }); };
  return <View style={{ gap: 8 }}>{fields.map((f) => <View key={f.id} style={{ gap: 4 }}>
    <Text style={{ color: c.theme.sub, fontSize: 12 }}>{f.label}</Text>
    <TextInput value={values[f.id] ?? ''} onChangeText={(s) => { if (!c.busy) setDraft((d) => ({ ...d, [f.id]: s })); }} placeholder={c.settled ? undefined : f.placeholder} placeholderTextColor={c.theme.faint}
      editable={!c.busy && !c.settled} autoCorrect={false} autoCapitalize="none" returnKeyType="send" onSubmitEditing={c.settled ? undefined : submit}
      style={{ color: c.theme.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: c.theme.fill, borderWidth: 1, borderColor: c.theme.fillBorder, opacity: c.settled ? 0.75 : 1 }} />
  </View>)}
    {c.settled ? null : <Foot><Btn theme={c.theme} primary title={n.submitLabel ?? '提交'} disabled={c.busy} onPress={submit} /></Foot>}</View>;
}

/** WidgetView + WidgetCard: inputs start where the Bot set them; an answer carries their values. */
function WidgetCard({ theme, title, view, onSubmit, onDismiss, busy = false, raised = false, settled = false, answer = null }: { theme: Theme; title: string; view: any; onSubmit?(action: string, values: object): void; onDismiss?(): void; busy?: boolean; raised?: boolean; settled?: boolean; answer?: any }) {
  const inputs = viewInputs(view);
  const [values, setValues] = useState<Record<string, any>>(() => Object.fromEntries(inputs.map((x: any) => [x.id, inputDefault(x)])));
  const sentIn = answer?.values?.inputs;
  const current = settled && sentIn && typeof sentIn === 'object' ? { ...values, ...sentIn } : values;
  const lookup = viewScope(view, current); (lookup as any).__view = view;
  const c: Ctx = { theme, busy, settled, answer, locked: settled || busy, lookup, values: current,
    setInput: (id, v) => setValues((b) => ({ ...b, [id]: v })),
    submit: (action, extra) => onSubmit?.(action, inputs.length > 0 ? { ...extra, inputs: current } : extra) };
  const framed = raised || hasControls(view);
  const body = <Node n={view} c={c} />;
  const head = title || onDismiss ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
    <Text style={{ flex: 1, color: settled ? theme.sub : theme.text, fontSize: 13, lineHeight: 18, fontWeight: '500' }}>{title}</Text>
    {onDismiss ? <Pressable onPress={onDismiss} disabled={busy} accessibilityLabel="关闭视图" hitSlop={10} style={{ marginLeft: 8 }}><Text style={{ color: theme.sub, fontSize: 16 }}>✕</Text></Pressable> : null}</View> : null;
  if (!framed) return <View style={{ marginVertical: 8 }}>{head}{body}</View>;
  return <View style={{ backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.fillBorder, padding: 14, marginVertical: 6, opacity: settled ? 0.75 : 1 }}>{head}{body}</View>;
}

// widget-cell.js PendingView: hides on submit and comes back, with what was typed or
// picked, if the reply fails. A ref guards two taps in one frame.
export function ViewCardView({ theme, v, onReply, onDismiss, onError }: { theme: Theme; v: ViewCard; onReply(action: string, values: object): Promise<unknown>; onDismiss(): Promise<unknown>; onError?(e: unknown): void }) {
  const [flying, setFlying] = useState(false);
  const busyRef = useRef(false);
  const run = (make: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true; setFlying(true);
    void Promise.resolve().then(make).catch((e) => { setFlying(false); onError?.(e); }).finally(() => { busyRef.current = false; });
  };
  return <View style={flying ? { display: 'none' } : undefined}>
    <WidgetCard theme={theme} title={v.title ?? ''} view={v.view} busy={flying} raised onSubmit={(a, vals) => run(() => onReply(a, vals))} onDismiss={() => run(onDismiss)} /></View>;
}

/** widget-cell.js AnsweredView: an answered view rides on the reply, settled and read-only. */
export function AnsweredView({ theme, views, answers }: { theme: Theme; views: any[]; answers?: any[] }) {
  const view = views?.[0];
  if (!view || typeof view !== 'object' || view.view === undefined) return null;
  const list = Array.isArray(answers) ? answers : [];
  const answer = list.find((x) => x?.id === view.id) ?? list[0] ?? null;
  return <WidgetCard theme={theme} title={view.title ?? ''} view={view.view} settled answer={answer} />;
}

/** widget-cell.js WidgetCell for a display-only show_view: the blueprint the host kept on the call. */
export function ShownView({ theme, title, view }: { theme: Theme; title: string; view: any }) {
  return <WidgetCard theme={theme} title={title} view={view} />;
}

/** handoff-card.js SettledHandoff: the title and how it ended. */
const HANDOFF_TITLE: Record<string, string> = { login: '需要登录', payment: '需要付款', captcha: '需要验证' };
export function SettledHandoff({ theme, handoff }: { theme: Theme; handoff: { reason?: string; outcome?: string } }) {
  const skipped = handoff.outcome === 'skipped'; const returned = handoff.outcome === 'returned';
  return <View style={{ opacity: skipped ? 0.6 : 0.75 }}><Shell theme={theme} title={HANDOFF_TITLE[handoff.reason ?? ''] ?? '需要你在浏览器里帮忙'} badge={skipped ? '已跳过' : returned ? '已交还' : '✓'} /></View>;
}


export function ApprovalCard({ theme, a, botName, onAnswer, onError, onOpen }: { theme: Theme; a: Approval; botName: string; onAnswer(choice: 'allow' | 'reject'): Promise<unknown>; onError?(e: unknown): void; onOpen?(): void }) {
  const [busy, run] = useRun(onError);
  return (
    <Shell theme={theme} title={`${botName} 等你批准`} busy={busy}>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginTop: 8 }}>{a.tool}</Text>
      {a.detail?.text ? <Text style={{ color: theme.text, fontSize: 14, marginTop: 4 }}>{a.detail.text}</Text> : null}
      {a.reason ? <Text numberOfLines={3} style={{ color: theme.sub, fontSize: 13, marginTop: 4 }}>{a.reason}</Text> : null}
      {a.detail?.code ? <Text numberOfLines={2} style={{ color: theme.text, fontFamily: 'monospace', fontSize: 12, backgroundColor: theme.code, padding: 8, borderRadius: 8, marginTop: 6 }}>{a.detail.code}</Text> : null}
      {a.answerable ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <Btn theme={theme} title="拒绝" disabled={busy} onPress={() => run(() => onAnswer('reject'))} />
          <Btn theme={theme} primary title="允许一次" disabled={busy} onPress={() => run(() => onAnswer('allow'))} />
        </View>
      ) : onOpen ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}><Btn theme={theme} title={`打开 ${botName} 的对话`} onPress={onOpen} /></View> : null}
    </Shell>
  );
}

// secret-card.js SecretCard: a key the Bot never sees, or leave to use a saved one.
const MIN_VALUE = 4;
const scopeLabel = (scope: any, bots: Bot[]) => { if (scope === 'all') return '所有 Bot'; const names = (scope ?? []).map((id: string) => bots.find((b) => b.id === id)?.name).filter(Boolean); return names.length === 0 ? '没有 Bot' : names.join('、'); };
export function SecretCard({ theme, bot, bots, request, saved, onSet, onAllow, onCancel }: { theme: Theme; bot: Bot; bots: Bot[]; request: SecretRequest; saved?: { scope: any }; onSet(value: string, scope: 'all' | 'bot'): Promise<unknown>; onAllow(): Promise<unknown>; onCancel(): Promise<unknown> }) {
  const [value, setValue] = useState('');
  const [scope, setScope] = useState<'all' | 'bot'>('all');
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const run = (make: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    void Promise.resolve().then(make).then(() => setValue(''), (e) => setError(e?.message ?? String(e))).finally(() => { busyRef.current = false; setBusy(false); });
  };
  const long = value.trim().length >= MIN_VALUE;
  const filling = request.kind === 'fill' || replacing;
  const save = () => { if (long && !busy) run(() => onSet(value, scope)); };
  const cancel = () => run(onCancel);
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.fillBorder, padding: 14, marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ marginRight: 10 }}><Avatar bot={bot} size={28} /><Text style={{ position: 'absolute', right: -4, bottom: -4, fontSize: 11 }}>🔒</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', lineHeight: 22 }}>{request.kind === 'allow' ? `允许 ${bot.name} 使用 ${request.name}？` : `${bot.name} 需要一个密钥`}</Text>
          <Text style={{ color: theme.sub, fontSize: 14, marginTop: 4 }}><Text style={{ fontFamily: 'monospace' }}>{request.name}</Text>{request.purpose ? ` · ${request.purpose}` : ''}</Text>
        </View>
        {busy ? null : <Pressable onPress={cancel} accessibilityLabel="取消请求" hitSlop={10} style={{ marginLeft: 8 }}><Text style={{ color: theme.sub, fontSize: 18 }}>✕</Text></Pressable>}
      </View>
      {request.kind === 'allow' ? <Text style={{ color: theme.sub, fontSize: 13, marginTop: 10 }}>🔑 已保存，可用范围：{scopeLabel(saved?.scope, bots)}</Text> : null}
      {filling ? <View style={{ marginTop: 10, gap: 8 }}>
        <TextInput value={value} onChangeText={setValue} onSubmitEditing={save} secureTextEntry autoFocus={replacing} autoCorrect={false} autoCapitalize="none" autoComplete="off" importantForAutofill="no"
          accessibilityLabel={`${request.name} 的值`} placeholder="粘贴或输入密钥" placeholderTextColor={theme.faint}
          style={{ color: theme.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.fill, borderWidth: 1, borderColor: theme.fillBorder }} />
        {request.kind === 'fill' ? <View accessibilityRole="radiogroup" accessibilityLabel="谁可以用" style={{ flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: theme.fill, borderRadius: 10, padding: 2 }}>
          {([['all', '所有 Bot'], ['bot', `只给 ${bot.name}`]] as const).map(([id, text]) => <Pressable key={id} onPress={() => setScope(id)} style={{ paddingHorizontal: 12, height: 28, justifyContent: 'center', borderRadius: 8, backgroundColor: scope === id ? theme.card : 'transparent' }}><Text style={{ color: scope === id ? theme.text : theme.sub, fontSize: 13 }}>{text}</Text></Pressable>)}
        </View> : null}
      </View> : null}
      <Text style={{ color: theme.sub, fontSize: 12, marginTop: 10 }}>{`${bot.name} 永远看不到这个值。它会作为下面的环境变量进入 ${bot.name} 的 shell：`}<Text style={{ fontFamily: 'monospace' }}>{`$DSH_SECRET_${request.name}`}</Text>.{filling && value !== '' && !long ? ` 至少 ${MIN_VALUE} 个字符。` : ''}</Text>
      {error ? <Text style={{ color: theme.danger, fontSize: 13, marginTop: 6 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
        {request.kind === 'allow' && !replacing ? <Btn theme={theme} title="替换值" disabled={busy} onPress={() => setReplacing(true)} /> : null}
        <Btn theme={theme} title="取消" disabled={busy} onPress={cancel} />
        {filling ? <Btn theme={theme} primary title={busy ? '保存中…' : '保存'} disabled={!long || busy} onPress={save} />
          : <Btn theme={theme} primary title={busy ? '允许中…' : '允许'} disabled={busy} onPress={() => { if (!busy) run(onAllow); }} />}
      </View>
    </View>
  );
}

/** handoff-card.js PendingHandoff: the live hand-off needs the Bot's browser, which the phone has no view of. */
export function PendingHandoffStub({ theme }: { theme: Theme }) {
  return <Shell theme={theme} title="需要你在浏览器里帮忙" badge="移动端暂未实现" />;
}
