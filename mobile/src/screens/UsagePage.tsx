// Settings → 用量: a port of ds-bot 0.2.4 usage-page.js (UsagePage) over the `usage`
// endpoint and usage-data.js. Hover becomes tap; the 53-week heat map scrolls sideways.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ftLog, useFT } from '../featureTest'; // TEST-ONLY
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Avatar, GroupAvatar, Mark } from '../components/Avatar';
import { Icon } from '../components/ui';
import { MAIN_LOOK, colorOf } from '../avatar/characters';
import { inkFillHex, mix } from '../appearance';
import { useStore } from '../store';
import type { Theme } from '../theme';
import {
  DAY_MS, HEAT_LEVELS, RANGES, compact, compareText, dayKey, daysText, focusOf, full, heat, hitRate, hourMs, kindLabel, lastText,
  niceTop, percent, rangeLabel, shape, soften, spanRange, spanText, unitLabel, yearMonth, dayLong, type Colors, type Face, type Range, type UsageView,
} from '../api/usageModel';

const RING_R = 42;
const RING = 2 * Math.PI * RING_R;

export function UsagePage({ theme, focusId, onFocus }: { theme: Theme; focusId: string | null; onFocus(id: string | null): void }) {
  const { client, state } = useStore();
  const [view, setView] = useState<UsageView | null>(null);
  const [error, setError] = useState('');
  const [rangeId, setRangeId] = useState('7d');
  const [span, setSpan] = useState<{ from: string; to: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [by, setBy] = useState<'bot' | 'model'>('bot');
  const focus = focusOf(focusId);
  // TEST-ONLY feature walkthrough actions.
  const ftFocus = useRef<() => void>(() => ftLog('跳过：没有用量数据'));
  useFT('usage.range', (id: string) => { if (id === 'custom') setPicking((o) => !o); else { setRangeId(id); setPicking(false); } });
  useFT('usage.by', (b: 'bot' | 'model') => setBy(b));
  useFT('usage.focus', () => ftFocus.current());
  useEffect(() => {
    let stopped = false; let timer: any;
    const load = async () => {
      try {
        const value = await client!.usage();
        if (stopped) return;
        setView(value); setError('');
        timer = setTimeout(load, value?.scanning ? 3000 : 20000);
      } catch (e: any) {
        if (stopped) return;
        setError(e?.message ?? String(e));
        timer = setTimeout(load, 10000);
      }
    };
    void load();
    return () => { stopped = true; clearTimeout(timer); };
  }, [client]);
  const bots = state?.bots ?? [];
  const rooms = state?.rooms ?? [];
  const byId = Object.fromEntries(bots.map((b) => [b.id, b]));
  const roomsById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const colors: Colors = {
    card: theme.card, text: theme.text, accent: theme.accent,
    botPaint: (id) => inkFillHex(colorOf(byId[id!] ?? { id }), theme.dark),
    botName: (id) => byId[id!]?.name, botRole: (id) => byId[id!]?.role ?? '',
    ink: (name) => inkFillHex(name, theme.dark),
  };
  const today = view?.now.slice(0, 10) ?? '';
  const range: Range = rangeId === 'custom' && span ? { ...spanRange(span.from, span.to), ends: span.to >= today } as Range : (RANGES.find((r: any) => r.id === rangeId) as Range);
  const shaped = useMemo(() => (view && view.rows.length ? shape(view, range, by, focus, colors) : null), [view, rangeId, span, by, focusId, theme, state]);

  if (!view) return error ? <Text style={{ color: theme.danger, fontSize: 13, marginTop: 12 }}>{error}</Text> : <Skeleton theme={theme} />;
  if (view.rows.length === 0) {
    return <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
      <Mark look={MAIN_LOOK as any} size={56} live />
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 8 }}>{view.scanning ? '正在读取聊天记录…' : '还没有用量。'}</Text>
      <Text style={{ color: theme.sub, fontSize: 13 }}>调用模型之后，这里会显示 Token 用量。</Text>
    </View>;
  }
  const { faces, models, ownerAt, face, keep, all, part, series, tipSeries, fillOf, columns, ranked, isBot, activeDays, first } = shaped!;
  const pick = (next: { kind: string; key: string } | null | undefined) => next && onFocus(`${next.kind}:${next.key}`);
  ftFocus.current = () => { const at = ranked(all.owners).find(([i]: [number, any]) => isBot(i))?.[0]; if (at === undefined) ftLog('跳过：没有 Bot 用量'); else pick({ kind: 'owner', key: view.owners[at].key }); }; // TEST-ONLY
  const chooseRange = (id: string) => {
    if (id !== 'custom') { setRangeId(id); setPicking(false); return; }
    if (span) setRangeId('custom');
    setPicking((o) => !o);
  };
  const rangeOptions: [string, string, string?][] = [...RANGES.map((r: any) => [r.id, rangeLabel(r.id)] as [string, string]), ['custom', rangeId === 'custom' && span ? spanText(span.from, span.to) : '自定义', 'calendar']];
  const whole = part.total.total;
  const glyphOf = (f: Face, size: number, at?: number) => {
    if (f.kind === 'bot') return <Avatar bot={byId[f.id!] ?? ({ id: f.id, name: f.name } as any)} size={size} badge={false} />;
    if (f.kind === 'room' && roomsById[f.id!]) return <GroupAvatar members={(roomsById[f.id!].members ?? []).map((id: string) => byId[id]).filter(Boolean)} size={size} ring={theme.card} />;
    if (f.kind === 'model') return <ModelGlyph theme={theme} name={f.name} paint={f.paint} size={size} />;
    return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><Icon name="chats" color={theme.sub} size={Math.round(size * 0.5)} /></View>;
  };
  const ownerRow = ([at, sum]: [number, any], index: number) => <UsageRowView key={`o${at}`} theme={theme} glyph={glyphOf(faces[at], 32)} name={faces[at].name} sub={faces[at].sub} sum={sum} whole={whole}
    fill={face ? soften(face.paint, theme.card, 0.8) : fillOf.get(`o${at}`) ?? soften(faces[at].paint, theme.card)} onPress={() => pick({ kind: 'owner', key: view.owners[at].key })} />;
  const modelRow = ([at, sum]: [number, any]) => <UsageRowView key={`m${at}`} theme={theme} glyph={glyphOf(models[at], 32)} name={models[at].name} sub={models[at].sub} sum={sum} whole={whole}
    fill={face ? soften(face.paint, theme.card, 0.8) : fillOf.get(`m${at}`) ?? soften(models[at].paint, theme.card)} onPress={() => pick({ kind: 'model', key: view.models[at].key })} />;
  const nothing = <Text style={{ color: theme.faint, fontSize: 13, padding: 8 }}>这段时间没有用量。</Text>;
  let body: React.ReactNode;
  if (face) {
    const kinds = ranked(part.kinds); const usedModels = ranked(part.models); const owners = ranked(part.owners);
    body = <>
      <Profile theme={theme} face={face} glyph={glyphOf(face, 64)} range={range} share={all.total.total > 0 ? whole / all.total.total : 0} />
      <Stats theme={theme} range={range} total={part.total} previous={part.previous} />
      <Chart theme={theme} range={range} columns={columns} series={series} tipSeries={tipSeries} onPick={pick} />
      {ownerAt >= 0
        ? <ListCard theme={theme} title="模型" count={usedModels.length}>{usedModels.length ? usedModels.map(modelRow) : nothing}</ListCard>
        : <ListCard theme={theme} title="谁在用" count={owners.length}>{owners.length ? owners.map(ownerRow) : nothing}</ListCard>}
      <ListCard theme={theme} title="用途">{kinds.length ? kinds.map(([at, sum]) => <UsageRowView key={at} theme={theme} name={kindLabel(view.kinds[at], ownerAt >= 0 && isBot(ownerAt))} sum={sum} whole={whole} fill={soften(face.paint, theme.card, 0.8)} />) : nothing}</ListCard>
      <Heat theme={theme} view={view} keep={keep} paint={face.paint} />
    </>;
  } else {
    const owners = ranked(all.owners); const botsR = owners.filter(([at]) => isBot(at)); const rest = owners.filter(([at]) => !isBot(at)); const usedModels = ranked(all.models);
    body = <>
      <Stats theme={theme} range={range} total={all.total} previous={all.previous} />
      <Chart theme={theme} range={range} columns={columns} series={series} tipSeries={tipSeries} by={by} onBy={setBy} onPick={pick} />
      <ListCard theme={theme} title="Bot" count={botsR.length}>
        {owners.length ? null : nothing}
        {botsR.map((e, i) => ownerRow(e, i))}
        {botsR.length && rest.length ? <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 4, marginHorizontal: 8 }} /> : null}
        {rest.map((e, i) => ownerRow(e, botsR.length + i))}
      </ListCard>
      <ListCard theme={theme} title="模型" count={usedModels.length}>{usedModels.length ? usedModels.map(modelRow) : nothing}</ListCard>
      <Heat theme={theme} view={view} keep={keep} paint={theme.accent} />
    </>;
  }
  return <View style={{ gap: 14, paddingBottom: 4, marginTop: 8 }}>
    <View style={{ gap: 8 }}>
      <Tabs theme={theme} value={rangeId} options={rangeOptions} onChange={chooseRange} />
      {view.scanning ? <Text style={{ color: theme.sub, fontSize: 12 }}>还在读取较早的聊天记录，数字可能还会变大。</Text> : null}
      {picking ? <SpanPicker theme={theme} span={span} today={today} first={first} active={activeDays} onPick={(from, to) => { setSpan({ from, to }); setRangeId('custom'); setPicking(false); }} /> : null}
    </View>
    {error ? <Text style={{ color: theme.danger, fontSize: 13 }}>{error}</Text> : null}
    {body}
  </View>;
}

function Skeleton({ theme }: { theme: Theme }) {
  const b = (h: number, extra: object = {}) => <View style={{ height: h, borderRadius: 16, backgroundColor: theme.hover, ...extra }} />;
  return <View style={{ gap: 14, marginTop: 8 }}>{b(32, { width: '90%', borderRadius: 999 })}{b(94)}{b(318)}{b(200)}{b(200)}</View>;
}

function Tabs({ theme, value, options, onChange }: { theme: Theme; value: string; options: [string, string, string?][]; onChange(id: string): void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: theme.hover }}>
      {options.map(([id, text, icon]) => <Pressable key={id} onPress={() => onChange(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 12, borderRadius: 999, backgroundColor: value === id ? theme.card : 'transparent' }}>
        {icon ? <Icon name={icon} color={value === id ? theme.text : theme.sub} size={13} /> : null}
        <Text style={{ fontSize: 12, color: value === id ? theme.text : theme.sub }}>{text}</Text>
      </Pressable>)}
    </View>
  </ScrollView>;
}

function Card({ theme, children, style }: { theme: Theme; children: React.ReactNode; style?: object }) {
  return <View style={{ gap: 12, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, ...style }}>{children}</View>;
}
function Head({ theme, title, note, right }: { theme: Theme; title: string; note?: string | number; right?: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, gap: 12 }}>
    <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: theme.text, flexShrink: 1 }}>{title}{note !== undefined ? <Text style={{ fontSize: 12, fontWeight: '400', color: theme.faint }}>{`  ${note}`}</Text> : null}</Text>
    {right}
  </View>;
}

function Stats({ theme, range, total, previous }: { theme: Theme; range: Range; total: any; previous: number }) {
  const change = previous > 0 ? Math.round(((total.total - previous) / previous) * 100) : null;
  const cell = (label: string, value: string) => <View key={label} style={{ width: '33.33%', padding: 12, gap: 6, borderTopWidth: 1, borderColor: theme.line }}>
    <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: theme.faint }}>{label}</Text>
    <Text numberOfLines={1} style={{ fontSize: 22, lineHeight: 28, fontWeight: '600', color: theme.text }}>{value}</Text>
  </View>;
  return <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, flexDirection: 'row', flexWrap: 'wrap' }}>
    <View style={{ width: '100%', padding: 12, gap: 6 }}>
      <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: theme.faint }}>{lastText(range)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={{ fontSize: 34, lineHeight: 40, fontWeight: '600', color: theme.text }}>{compact(total.total)}</Text>
        <Text style={{ fontSize: 13, color: theme.faint }}>Token</Text>
        {change === null ? null : <Text accessibilityLabel={compareText(range)} style={{ alignSelf: 'center', paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.tagBg, color: theme.sub, fontSize: 11, lineHeight: 20, fontWeight: '500' }}>{`${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}%`}</Text>}
      </View>
    </View>
    {cell('缓存命中率', `${hitRate(total)}%`)}{cell('输出', compact(total.output))}{cell('调用次数', full(total.calls))}
  </View>;
}

function Chart({ theme, range, columns, series, tipSeries, by, onBy, onPick }: { theme: Theme; range: Range; columns: any[]; series: any[]; tipSeries: any[]; by?: 'bot' | 'model'; onBy?(b: 'bot' | 'model'): void; onPick(p: any): void }) {
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => setHover(null), [range.id, range.from, range.to, columns.length]);
  const top = niceTop(Math.max(0, ...columns.map((c) => c.total)));
  const count = columns.length;
  const fillOf = new Map(series.map((e) => [e.key, e.fill]));
  const tipOf = new Map(tipSeries.map((e) => [e.key, e]));
  useFT('usage.tip', (on: boolean) => { if (!on) { setHover(null); return; } let i = -1; columns.forEach((c, at) => { if (c.total > 0) i = at; }); if (i < 0) ftLog('跳过：图表没有柱子'); else setHover(i); }); // TEST-ONLY
  const tip = hover === null ? null : columns[hover];
  const H = 200;
  const grid = (level: number, label: string) => <View key={level} style={{ position: 'absolute', left: 0, right: 0, bottom: level * H, borderTopWidth: 1, borderStyle: 'dashed', borderColor: theme.border }}>
    <Text style={{ position: 'absolute', left: -40, width: 34, top: -8, textAlign: 'right', fontSize: 10, color: theme.faint }}>{label}</Text>
  </View>;
  return <Card theme={theme}>
    <Head theme={theme} title="Token 走势" note={unitLabel(range.unit)} right={onBy ? <Tabs theme={theme} value={by!} onChange={(v) => onBy(v as any)} options={[['bot', '按 Bot'], ['model', '按模型']]} /> : null} />
    <View>
      <View style={{ height: H, marginLeft: 40 }}>
        {grid(1, compact(top))}{grid(0.5, compact(top * 0.5))}{grid(0, '0')}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end' }}>
          {columns.map((c, at) => <Pressable key={c.key} onPress={() => setHover(hover === at ? null : at)} style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
            {c.total > 0
              ? <View style={{ height: `${(c.total / top) * 100}%`, width: '56%', minWidth: 4, maxWidth: 28, flexDirection: 'column-reverse', gap: 2, opacity: hover !== null && hover !== at ? 0.3 : 1 }}>
                  {c.parts.map(([k, v]: [string, number]) => (v > 0 ? <View key={k} style={{ flexGrow: v, flexBasis: 0, minHeight: 2, borderRadius: 5, backgroundColor: fillOf.get(k) }} /> : null))}
                </View>
              : <View style={{ height: 2, width: '56%', maxWidth: 28, borderRadius: 1, backgroundColor: theme.hover }} />}
          </Pressable>)}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 40, marginTop: 6 }}>
        {columns.map((c, at) => <Text key={c.key} numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 11, lineHeight: 14, overflow: 'visible', color: at === count - 1 && range.ends !== false ? theme.text : theme.faint, fontWeight: at === count - 1 && range.ends !== false ? '500' : '400' }}>
          {((range.from ? at : count - 1 - at) % range.stride === 0) ? c.tick : ''}</Text>)}
      </View>
      {tip ? <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: theme.cardHi, gap: 4 }}>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{tip.title}</Text>
        <Text style={{ color: theme.sub, fontSize: 12 }}>{`${full(tip.total)} Token`}</Text>
        {tip.tip.filter(([, v]: any) => v > 0).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: [string, number]) => <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tipOf.get(k)?.fill }} />
          <Text style={{ flex: 1, color: theme.text, fontSize: 12 }} numberOfLines={1}>{tipOf.get(k)?.name}</Text>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{compact(v)}</Text>
        </View>)}
      </View> : null}
    </View>
    {series.length > 1 || series[0]?.pick ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {series.map((e) => <Pressable key={e.key} disabled={!e.pick} onPress={() => onPick(e.pick)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: e.fill }} />
        <Text style={{ color: theme.sub, fontSize: 12 }}>{e.name}</Text>
      </Pressable>)}
    </View> : null}
  </Card>;
}

function UsageRowView({ theme, glyph, name, sub, sum, whole, fill, onPress }: { theme: Theme; glyph?: React.ReactNode; name: string; sub?: string; sum: any; whole: number; fill: string; onPress?(): void }) {
  const width = whole > 0 ? Math.max(sum.total > 0 ? 2 : 0, (sum.total / whole) * 100) : 0;
  return <Pressable disabled={!onPress} onPress={onPress} accessibilityLabel={`${full(sum.total)} Token · ${full(sum.calls)} 次调用`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, backgroundColor: pressed ? theme.hover : 'transparent' })}>
    {glyph ? <View>{glyph}</View> : null}
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, color: theme.text, fontSize: 13, fontWeight: '500' }}>{name}</Text>
        {sub ? <Text numberOfLines={1} style={{ flexShrink: 1, color: theme.faint, fontSize: 12 }}>{sub}</Text> : null}
      </View>
      <View style={{ height: 4, borderRadius: 999, backgroundColor: theme.hover, overflow: 'hidden' }}><View style={{ height: '100%', width: `${width}%`, borderRadius: 999, backgroundColor: fill }} /></View>
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{compact(sum.total)}</Text>
      <Text style={{ color: theme.faint, fontSize: 11 }}>{`${percent(sum.total, whole)}%`}</Text>
    </View>
  </Pressable>;
}

function ListCard({ theme, title, count, children }: { theme: Theme; title: string; count?: number; children: React.ReactNode }) {
  return <Card theme={theme}><Head theme={theme} title={title} note={count} /><View>{children}</View></Card>;
}

function ModelGlyph({ theme, name, paint, size }: { theme: Theme; name: string; paint: string; size: number }) {
  const letter = (name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
  return <View style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center', backgroundColor: mix(paint, 0.2, theme.card) }}>
    <Text style={{ fontSize: Math.round(size * 0.42), fontWeight: '600', color: mix(paint, 0.72, theme.text) }}>{letter}</Text>
  </View>;
}

function Profile({ theme, face, glyph, share, range }: { theme: Theme; face: Face; glyph: React.ReactNode; share: number; range: Range }) {
  const arc = Math.max(0, Math.min(1, share)) * RING;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    <View style={{ width: 96, height: 96 }}>
      <Svg width={96} height={96} viewBox="0 0 96 96" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={48} cy={48} r={RING_R} stroke={theme.line} strokeWidth={4} fill="none" />
        {arc > 0 ? <Circle cx={48} cy={48} r={RING_R} stroke={face.paint} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={`${arc} ${RING}`} /> : null}
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{glyph}</View>
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} style={{ color: theme.text, fontSize: 22, lineHeight: 28, fontWeight: '600' }}>{face.name}</Text>
      {face.sub ? <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 13 }}>{face.sub}</Text> : null}
      <Text style={{ color: theme.faint, fontSize: 12 }}>{range.from ? `占 ${spanText(range.from, range.to!)} 全部用量的 ${percent(share, 1)}%` : `占最近 ${rangeLabel(range.id)}全部用量的 ${percent(share, 1)}%`}</Text>
    </View>
  </View>;
}

function Heat({ theme, view, keep, paint }: { theme: Theme; view: UsageView; keep(row: any): boolean; paint: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const h = heat(view, keep);
  const CELL = 10; const GAP = 3;
  const scroll = useRef<any>(null);
  useFT('usage.heat', (where: 'start' | 'end') => (where === 'start' ? scroll.current?.scrollTo({ x: 0, animated: true }) : scroll.current?.scrollToEnd({ animated: true }))); // TEST-ONLY
  return <Card theme={theme}>
    <Head theme={theme} title="活跃度" right={<Text style={{ fontSize: 12, color: theme.faint }}>{h.summary}</Text>} />
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
      <View>
        <View style={{ height: 14, flexDirection: 'row' }}>
          {h.months.map((m) => <Text key={m.week} style={{ position: 'absolute', left: m.week * (CELL + GAP), fontSize: 10, lineHeight: 14, color: theme.faint }}>{m.label}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {h.weeks.map((days, w) => <View key={w} style={{ gap: GAP }}>
            {days.map((d) => <Pressable key={d.ms} disabled={d.future} onPress={() => setHover(hover === d.ms ? null : d.ms)}
              style={{ width: CELL, height: CELL, borderRadius: 3, overflow: 'hidden', backgroundColor: d.future ? 'transparent' : theme.hover, borderWidth: hover === d.ms ? 1.5 : 0, borderColor: theme.sub }}>
              {d.level > 0 ? <View style={{ flex: 1, backgroundColor: soften(paint, theme.card, HEAT_LEVELS[d.level - 1]) }} /> : null}
            </Pressable>)}
          </View>)}
        </View>
      </View>
    </ScrollView>
    {hover !== null ? <Text style={{ color: theme.text, fontSize: 12 }}>{`${dayLong(hover)} · ${full(h.weeks.flat().find((d) => d.ms === hover)?.value ?? 0)} Token`}</Text> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
      <Text style={{ fontSize: 11, color: theme.faint }}>少</Text>
      {HEAT_LEVELS.map((l) => <View key={l} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: soften(paint, theme.card, l) }} />)}
      <Text style={{ fontSize: 11, color: theme.faint }}>多</Text>
    </View>
  </Card>;
}

const monthOf = (ms: number) => Date.UTC(new Date(ms).getUTCFullYear(), new Date(ms).getUTCMonth(), 1);
const addMonths = (ms: number, n: number) => Date.UTC(new Date(ms).getUTCFullYear(), new Date(ms).getUTCMonth() + n, 1);

// usage-page.js SpanPicker: two taps pick the ends; shortcuts; days with usage carry a dot.
// The phone shows one month at a time (the web shows two side by side).
function SpanPicker({ theme, span, today, first, active, onPick }: { theme: Theme; span: { from: string; to: string } | null; today: string; first: string; active: Set<string>; onPick(from: string, to: string): void }) {
  const todayMs = hourMs(today);
  const thisMonth = monthOf(todayMs);
  const oldest = Math.min(monthOf(hourMs(first)), addMonths(thisMonth, -12));
  const [shown, setShown] = useState(() => Math.max(oldest, monthOf(hourMs(span?.to ?? today))));
  const [anchor, setAnchor] = useState<string | null>(null);
  const [low, high] = anchor ? [anchor, anchor] : span ? [span.from, span.to] : [null, null];
  const press = (key: string) => {
    if (!anchor) { setAnchor(key); return; }
    const [from, to] = [anchor, key].sort();
    onPick(from, to);
  };
  const shortcuts: [string, string, string, string][] = [
    ['month', '本月', dayKey(thisMonth), today],
    ['last', '上个月', dayKey(addMonths(thisMonth, -1)), dayKey(thisMonth - DAY_MS)],
    ['year', '今年', `${today.slice(0, 4)}-01-01`, today],
  ];
  const length = new Date(addMonths(shown, 1) - DAY_MS).getUTCDate();
  const lead = (new Date(shown).getUTCDay() + 6) % 7;
  const cells: React.ReactNode[] = Array.from({ length: lead }, (_, i) => <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 36 }} />);
  for (let day = 1; day <= length; day += 1) {
    const ms = shown + (day - 1) * DAY_MS; const key = dayKey(ms);
    const inside = low !== null && key >= low && key <= high!;
    const end = key === low || key === high;
    cells.push(<Pressable key={key} disabled={ms > todayMs} onPress={() => press(key)} accessibilityLabel={dayLong(ms)} style={{ width: `${100 / 7}%`, height: 36, alignItems: 'center', justifyContent: 'center', opacity: ms > todayMs ? 0.35 : 1, backgroundColor: inside && !end ? theme.hover : 'transparent' }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: end ? theme.accent : 'transparent', borderWidth: key === today && !end ? 1 : 0, borderColor: theme.border }}>
        <Text style={{ fontSize: 13, color: end ? theme.accentText : theme.text }}>{day}</Text>
      </View>
      {active.has(key) ? <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: end ? theme.accentText : theme.accent }} /> : null}
    </Pressable>);
  }
  const count = low === null ? 0 : Math.round((hourMs(high!) - hourMs(low)) / DAY_MS) + 1;
  return <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, gap: 10 }}>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {shortcuts.map(([id, label, from, to]) => <Pressable key={id} onPress={() => onPick(from, to)} style={{ height: 28, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', backgroundColor: span?.from === from && span?.to === to ? theme.active : theme.hover }}>
        <Text style={{ fontSize: 12, color: theme.text }}>{label}</Text>
      </Pressable>)}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable accessibilityLabel="往前一个月" disabled={shown <= oldest} onPress={() => setShown(addMonths(shown, -1))} hitSlop={8} style={{ opacity: shown <= oldest ? 0.3 : 1, padding: 4 }}><Icon name="back" color={theme.text} /></Pressable>
      <Text style={{ flex: 1, textAlign: 'center', color: theme.text, fontSize: 13, fontWeight: '600' }}>{yearMonth(shown)}</Text>
      <Pressable accessibilityLabel="往后一个月" disabled={shown >= thisMonth} onPress={() => setShown(addMonths(shown, 1))} hitSlop={8} style={{ opacity: shown >= thisMonth ? 0.3 : 1, padding: 4 }}><Icon name="chevron" color={theme.text} /></Pressable>
    </View>
    <View style={{ flexDirection: 'row' }}>{['一', '二', '三', '四', '五', '六', '日'].map((w) => <Text key={w} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: theme.faint }}>{w}</Text>)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells}</View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: theme.sub }}>{anchor ? '选择结束日期' : '选择开始日期'}</Text>
      {low === null ? null : <Text style={{ fontSize: 12, color: theme.sub }}><Text style={{ fontWeight: '600', color: theme.text }}>{spanText(low, high!)}</Text>{` · ${daysText(count)}`}</Text>}
    </View>
  </View>;
}
