// A port of deep-view/src/react/chart.js: bar, hbar, line, area and donut drawn as SVG
// at the width the card gets. Tapping a category shows its values (the web's hover);
// the legend hides a series; the ⋯ actions are 以表格查看 / 复制数据 (下载图片 is web-only).
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Theme } from '../theme';

const TICK = 10;
const LABEL = 11;
const textWidth = (text: any, size: number) => [...String(text)].reduce((s, ch) => s + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.58), 0);
const fit = (text: string, room: number, size: number) => {
  if (textWidth(text, size) <= room) return text;
  let out = '';
  for (const ch of String(text)) { if (textWidth(`${out}${ch}…`, size) > room) break; out += ch; }
  return out === '' ? '' : `${out}…`;
};
export function formatNumber(v: number) {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v); const d = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return Number(v.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d });
}
export const withUnit = (v: number, unit: string) => (unit ? (unit === '%' ? `${formatNumber(v)}%` : `${formatNumber(v)} ${unit}`) : formatNumber(v));
export function niceTicks(low: number, high: number) {
  let lo = low, hi = high;
  if (lo === hi) { lo = Math.min(0, lo); hi = hi === 0 ? 1 : Math.max(0, hi); }
  if (lo === hi) hi = lo + 1;
  const raw = (hi - lo) / 4; const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((c) => c >= raw)!;
  const start = Math.floor(lo / step + 1e-9) * step; const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}
export type Series = { name: string; color: string; values: number[] };
export type ChartData = { kind: string; categories: string[]; series: Series[]; unit: string };
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function chartCsv({ categories, series, unit }: ChartData) {
  const head = ['', ...series.map((s, i) => s.name || (series.length === 1 ? unit || '值' : `系列 ${i + 1}`))];
  const rows = categories.map((l, at) => [l, ...series.map((s) => String(s.values[at]))]);
  return [head, ...rows].map((r) => r.map((c) => csvCell(String(c))).join(',')).join('\n');
}
function valueAxis(values: number[], zero: boolean) {
  const f = values.length > 0 ? values : [0];
  const low = Math.min(...f), high = Math.max(...f);
  if (zero) return niceTicks(Math.min(0, low), Math.max(0, high));
  const pad = (high - low) * 0.1 || Math.abs(high) * 0.1 || 1;
  return niceTicks(low - pad, high + pad);
}
type Ink = { grid: string; tick: string; label: string; guide: string; text: string };
type Drawn = { parts: React.ReactNode[]; height: number; points: { x: number; y: number }[]; hits: { x: number; y: number; w: number; h: number }[] };

function columns({ categories, series, unit, kind }: ChartData, width: number, active: number | null, shown: boolean[], ink: Ink): Drawn {
  const visible = series.filter((_, i) => shown[i]);
  const ticks = valueAxis(visible.flatMap((s) => s.values), kind !== 'line');
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const left = Math.ceil(Math.max(...ticks.map((t) => textWidth(withUnit(t, unit), TICK)))) + 10;
  const top = 8, height = 220, bottom = 24;
  const plot = { x: left, y: top, w: Math.max(40, width - left - 4), h: height - top - bottom };
  const y = (v: number) => plot.y + plot.h - ((v - lo) / (hi - lo)) * plot.h;
  const band = plot.w / Math.max(1, categories.length);
  const parts: React.ReactNode[] = [];
  for (const t of ticks) {
    parts.push(<Line key={`g${t}`} x1={plot.x} x2={plot.x + plot.w} y1={y(t)} y2={y(t)} stroke={ink.grid} strokeWidth={1} strokeDasharray="3 3" />);
    parts.push(<SvgText key={`t${t}`} x={plot.x - 8} y={y(t) + 3} textAnchor="end" fontSize={TICK} fill={ink.tick}>{withUnit(t, unit)}</SvgText>);
  }
  const points: Drawn['points'] = [];
  categories.forEach((label, at) => {
    const cx = plot.x + band * at + band / 2;
    parts.push(<SvgText key={`c${at}`} x={cx} y={height - 7} textAnchor="middle" fontSize={LABEL} fill={ink.label}>{fit(label, band - 4, LABEL)}</SvgText>);
    points.push({ x: cx, y: y(Math.max(...visible.map((s) => s.values[at]), lo)) });
  });
  const dim = (at: number) => (active !== null && active !== at ? 0.28 : 1);
  if (kind === 'bar') {
    const group = band * 0.72; const gap = visible.length > 1 ? 2 : 0;
    const barW = Math.max(2, (group - gap * (visible.length - 1)) / Math.max(1, visible.length));
    const zero = y(Math.max(lo, Math.min(0, hi)));
    categories.forEach((_, at) => visible.forEach((s, row) => {
      const v = s.values[at];
      const x = plot.x + band * at + (band - group) / 2 + row * (barW + gap);
      const t2 = Math.min(y(v), zero); const tall = Math.max(1, Math.abs(y(v) - zero));
      const r = Math.min(4, barW / 2, tall);
      const d = v >= 0
        ? `M${x},${t2 + tall}V${t2 + r}q0,-${r} ${r},-${r}h${barW - 2 * r}q${r},0 ${r},${r}V${t2 + tall}z`
        : `M${x},${t2}V${t2 + tall - r}q0,${r} ${r},${r}h${barW - 2 * r}q${r},0 ${r},-${r}V${t2}z`;
      parts.push(<Path key={`b${at}-${row}`} d={d} fill={s.color} opacity={dim(at)} />);
    }));
  } else {
    const xs = categories.map((_, at) => plot.x + band * at + band / 2);
    if (active !== null) parts.unshift(<Line key="guide" x1={xs[active]} x2={xs[active]} y1={plot.y} y2={plot.y + plot.h} stroke={ink.guide} strokeWidth={1} />);
    visible.forEach((s, row) => {
      const line = s.values.map((v, at) => `${at === 0 ? 'M' : 'L'}${xs[at]},${y(v)}`).join('');
      if (kind === 'area') { const base = y(Math.max(lo, Math.min(0, hi))); parts.push(<Path key={`a${row}`} d={`${line}L${xs[xs.length - 1]},${base}L${xs[0]},${base}z`} fill={s.color} opacity={0.14} />); }
      parts.push(<Path key={`l${row}`} d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />);
      s.values.forEach((v, at) => parts.push(<Circle key={`p${row}-${at}`} cx={xs[at]} cy={y(v)} r={active === at ? 4 : 2.5} fill={s.color} />));
    });
  }
  return { parts, height, points, hits: categories.map((_, at) => ({ x: plot.x + band * at, y: plot.y, w: band, h: plot.h })) };
}

function rows({ categories, series, unit }: ChartData, width: number, active: number | null, shown: boolean[], ink: Ink): Drawn {
  const visible = series.filter((_, i) => shown[i]);
  const ticks = valueAxis(visible.flatMap((s) => s.values), true);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const labelW = Math.min(width * 0.38, Math.ceil(Math.max(0, ...categories.map((l) => textWidth(l, LABEL)))) + 10);
  const valueW = Math.ceil(Math.max(0, ...visible.flatMap((s) => s.values).map((v) => textWidth(withUnit(v, unit), LABEL)))) + 10;
  const barH = 14; const rowH = 10 + visible.length * barH + (visible.length - 1) * 2; const top = 4;
  const height = top + rowH * categories.length + 22;
  const plot = { x: labelW, y: top, w: Math.max(40, width - labelW - valueW), h: rowH * categories.length };
  const x = (v: number) => plot.x + ((v - lo) / (hi - lo)) * plot.w;
  const parts: React.ReactNode[] = [];
  for (const t of ticks) {
    parts.push(<Line key={`g${t}`} x1={x(t)} x2={x(t)} y1={plot.y} y2={plot.y + plot.h} stroke={ink.grid} strokeWidth={1} strokeDasharray="3 3" />);
    parts.push(<SvgText key={`t${t}`} x={x(t)} y={height - 6} textAnchor="middle" fontSize={TICK} fill={ink.tick}>{withUnit(t, unit)}</SvgText>);
  }
  const points: Drawn['points'] = [];
  const zero = x(Math.max(lo, Math.min(0, hi)));
  categories.forEach((label, at) => {
    const rowY = plot.y + rowH * at + 5;
    parts.push(<SvgText key={`c${at}`} x={labelW - 10} y={rowY + (rowH - 10) / 2 + 4} textAnchor="end" fontSize={LABEL} fill={ink.label}>{fit(label, labelW - 12, LABEL)}</SvgText>);
    visible.forEach((s, row) => {
      const v = s.values[at]; const by = rowY + row * (barH + 2);
      const left = Math.min(x(v), zero); const long = Math.max(1, Math.abs(x(v) - zero));
      parts.push(<Rect key={`b${at}-${row}`} x={left} y={by} width={long} height={barH} rx={Math.min(4, long / 2)} fill={s.color} opacity={active !== null && active !== at ? 0.28 : 1} />);
      parts.push(<SvgText key={`v${at}-${row}`} x={left + long + 6} y={by + barH - 3} fontSize={LABEL} fill={ink.label}>{withUnit(v, unit)}</SvgText>);
    });
    points.push({ x: Math.max(...visible.map((s) => x(s.values[at])), zero), y: rowY });
  });
  return { parts, height, points, hits: categories.map((_, at) => ({ x: 0, y: plot.y + rowH * at, w: width, h: rowH })) };
}

function donut({ series }: ChartData, width: number, active: number | null, palette: string[]) {
  const values = (series[0]?.values ?? []).map((v) => Math.max(0, v));
  const total = values.reduce((a, v) => a + v, 0);
  const size = Math.min(180, Math.max(120, width * 0.42));
  const r = size / 2, inner = r * 0.62, cx = r, cy = r;
  const parts: React.ReactNode[] = [];
  let angle = -Math.PI / 2;
  values.forEach((v, at) => {
    const sweep = total > 0 ? (v / total) * Math.PI * 2 : 0; const end = angle + sweep;
    if (sweep > 0) {
      const large = sweep > Math.PI ? 1 : 0; const full = sweep >= Math.PI * 2 - 1e-6;
      const p = (rad: number, th: number) => `${cx + Math.cos(th) * rad},${cy + Math.sin(th) * rad}`;
      const d = full
        ? `M${p(r, angle)}A${r},${r} 0 1 1 ${p(r, angle + Math.PI)}A${r},${r} 0 1 1 ${p(r, angle)}M${p(inner, angle)}A${inner},${inner} 0 1 0 ${p(inner, angle + Math.PI)}A${inner},${inner} 0 1 0 ${p(inner, angle)}z`
        : `M${p(r, angle)}A${r},${r} 0 ${large} 1 ${p(r, end)}L${p(inner, end)}A${inner},${inner} 0 ${large} 0 ${p(inner, angle)}z`;
      parts.push(<Path key={`s${at}`} d={d} fillRule="evenodd" fill={palette[at % palette.length]} opacity={active !== null && active !== at ? 0.28 : 1} />);
    }
    angle = end;
  });
  return { parts, size, total, values };
}

export function SvgChart({ data, theme, palette, width, shown, onToggle }: { data: ChartData; theme: Theme; palette: string[]; width: number; shown: boolean[]; onToggle(i: number): void }) {
  const [active, setActive] = useState<number | null>(null);
  const { kind, categories, series, unit } = data;
  const ink: Ink = { grid: theme.sep, tick: theme.faint, label: theme.sub, guide: theme.fillBorder, text: theme.text };
  const tap = (at: number) => setActive((cur) => (cur === at ? null : at));
  if (kind === 'donut') {
    const beside = width >= 360;
    const d = donut(data, beside ? width - 200 : width, active, palette);
    const share = (at: number) => (unit === '%' ? withUnit(d.values[at], unit) : `${withUnit(d.values[at], unit)} · ${d.total > 0 ? Math.round((d.values[at] / d.total) * 100) : 0}%`);
    return <View style={{ flexDirection: beside ? 'row' : 'column', alignItems: 'center', gap: beside ? 24 : 12 }}>
      <Svg width={d.size} height={d.size}>
        {d.parts}
        {active === null
          ? <SvgText x={d.size / 2} y={d.size / 2 + 5} textAnchor="middle" fontSize={15} fontWeight="600" fill={ink.text}>{unit === '%' ? '' : withUnit(d.total, unit)}</SvgText>
          : <G><SvgText x={d.size / 2} y={d.size / 2 - 4} textAnchor="middle" fontSize={LABEL} fill={ink.label}>{fit(categories[active], d.size * 0.56, LABEL)}</SvgText>
            <SvgText x={d.size / 2} y={d.size / 2 + 14} textAnchor="middle" fontSize={15} fontWeight="600" fill={ink.text}>{share(active)}</SvgText></G>}
      </Svg>
      <View style={{ gap: 6, alignSelf: beside ? 'center' : 'stretch', flexShrink: 1, maxWidth: beside ? 280 : undefined }}>
        {categories.map((name, at) => <Pressable key={at} onPress={() => tap(at)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: active !== null && active !== at ? 0.4 : 1 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette[at % palette.length] }} />
          <Text numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 12 }}>{name}</Text>
          <Text style={{ color: theme.sub, fontSize: 12 }}>{share(at)}</Text></Pressable>)}
      </View>
    </View>;
  }
  const drawn = kind === 'hbar' ? rows(data, width, active, shown, ink) : columns(data, width, active, shown, ink);
  const point = active === null ? null : drawn.points[active];
  return <View style={{ gap: 8 }}>
    {series.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
      {series.map((s, i) => <Pressable key={i} onPress={() => onToggle(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20, opacity: shown[i] ? 1 : 0.4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} /><Text style={{ color: theme.sub, fontSize: 12 }}>{s.name || `系列 ${i + 1}`}</Text></Pressable>)}
    </View> : null}
    <View>
      <Svg width={width} height={drawn.height}>
        {drawn.parts}
        {drawn.hits.map((h, at) => <Rect key={`h${at}`} x={h.x} y={h.y} width={h.w} height={h.h} fill="transparent" onPress={() => tap(at)} />)}
      </Svg>
      {point ? <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, Math.min(width - 140, point.x - 70)), top: Math.max(0, point.y - 8 - 22 - 16 * series.filter((_, i) => shown[i]).length), width: 140, alignItems: 'center' }}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.bg, borderWidth: 0.5, borderColor: theme.fillBorder, gap: 2, elevation: 4 }}>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{categories[active!]}</Text>
          {series.filter((_, i) => shown[i]).map((s, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} /><Text style={{ color: theme.sub, fontSize: 12 }}>{s.name ? `${s.name}  ` : ''}{withUnit(s.values[active!], unit)}</Text></View>)}
        </View></View> : null}
    </View>
  </View>;
}
