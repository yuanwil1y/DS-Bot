// settings.js GeneralPage「外观」and BotsPage MotionSection, laid out like the web's
// phone settings (≤640px: label above control). Values live in server prefs (set-prefs).
import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, Switch, Text, TextInput, ToastAndroid, View } from 'react-native';
import { Group } from './ui';
import { useTeamPrefs } from '../teamPrefs';
import { ACCENT_INKS as AI, ACCENT_LABELS as AL, INKS as IK, LAYOUTS, MESSAGE_WIDTH, MOTIONS, THEMES, THEME_IDS, isHex } from '../appearance';
import type { Theme } from '../theme';

const INKS: Record<string, string[]> = IK as any; const ACCENT_INKS: string[] = AI as any; const ACCENT_LABELS: Record<string, string> = AL as any;
const toast = (e: any) => ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT);

function SetRow({ theme, label, hint, children, dim }: { theme: Theme; label: string; hint?: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingVertical: 14, gap: 8, opacity: dim ? 0.5 : 1 }}>
      <View>
        <Text style={{ color: theme.text, fontSize: 17 }}>{label}</Text>
        {hint ? <Text style={{ color: theme.sub, fontSize: 13, marginTop: 3 }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Segmented<T extends string>({ theme, value, options, onChange, disabled }: { theme: Theme; value: T; options: { value: T; label: string }[]; onChange(v: T): void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.active, borderRadius: 10, padding: 2, alignSelf: 'flex-start' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { if (!on) onChange(o.value); }}
            style={{ minWidth: 72, height: 34, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? theme.card : 'transparent' }}>
            <Text style={{ color: on ? theme.text : theme.sub, fontSize: 14, fontWeight: on ? '600' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// settings.js WidthSlider: 50–100 step 5, `${w}%`, debounced 350ms, flushed on unmount.
export function WidthSlider({ theme, value, onCommit, disabled, label }: { theme: Theme; value: number; onCommit(v: number): void; disabled?: boolean; label: string }) {
  const [v, setV] = useState(value);
  const [w, setW] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ v: number; dirty: boolean }>({ v: value, dirty: false });
  const commit = useRef(onCommit); commit.current = onCommit;
  useEffect(() => { if (!latest.current.dirty) setV(value); }, [value]);
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); if (latest.current.dirty) commit.current(latest.current.v); } }, []);
  const { min, max, step } = MESSAGE_WIDTH;
  const set = (n: number) => {
    const q = Math.min(max, Math.max(min, Math.round(n / step) * step));
    if (q === latest.current.v) return;
    latest.current = { v: q, dirty: true }; setV(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; latest.current.dirty = false; commit.current(q); }, 350);
  };
  const at = (x: number) => (w ? set(min + (Math.min(w, Math.max(0, x)) / w) * (max - min)) : undefined);
  const atRef = useRef(at); atRef.current = at;
  const start = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { start.current = e.nativeEvent.locationX; atRef.current(start.current); }, onPanResponderMove: (_e, g) => atRef.current(start.current + g.dx),
  })).current;
  const frac = (v - min) / (max - min);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: v, text: `${v}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => set(v + (e.nativeEvent.actionName === 'increment' ? step : -step))}
        pointerEvents={disabled ? 'none' : 'auto'} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}
        style={{ flex: 1, height: 32, justifyContent: 'center' }}>
        <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: theme.active, overflow: 'hidden' }}>
          <View style={{ width: `${frac * 100}%`, height: 4, backgroundColor: theme.accent }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: frac * w - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.border, elevation: 2 }} />
      </View>
      <Text style={{ color: theme.sub, fontSize: 14, minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{`${v}%`}</Text>
    </View>
  );
}

function AccentPicker({ theme, accent, onPick, disabled }: { theme: Theme; accent?: string; onPick(a: string | null): void; disabled?: boolean }) {
  const presets = ACCENT_INKS.map((id: string) => INKS[id][0] as string);
  const custom = !!accent && !presets.some((p: string) => p.toLowerCase() === accent.toLowerCase());
  const [hex, setHex] = useState(accent ?? '#4d6bfe');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (accent) setHex(accent); }, [accent]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const ring = (on: boolean) => ({ borderWidth: 2, borderColor: on ? theme.text : 'transparent', padding: 2, borderRadius: 18 });
  const dot = { width: 28, height: 28, borderRadius: 14 };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pressable disabled={disabled} accessibilityLabel="主题强调色" accessibilityState={{ selected: !accent }} onPress={() => onPick(null)} style={ring(!accent)}>
          <View style={{ ...dot, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', backgroundColor: theme.card }}>
            <View style={{ position: 'absolute', width: 40, height: 1.5, backgroundColor: theme.faint, top: 13, left: -6, transform: [{ rotate: '-45deg' }] }} />
          </View>
        </Pressable>
        {ACCENT_INKS.map((id: string) => {
          const on = accent?.toLowerCase() === INKS[id][0].toLowerCase();
          return <Pressable key={id} disabled={disabled} accessibilityLabel={ACCENT_LABELS[id]} accessibilityState={{ selected: on }} onPress={() => onPick(INKS[id][0])} style={ring(on)}><View style={{ ...dot, backgroundColor: INKS[id][0] }} /></Pressable>;
        })}
        <View accessibilityLabel="自定义强调色" style={ring(custom)}><View style={{ ...dot, backgroundColor: isHex(hex) ? hex : theme.card, borderWidth: 1, borderColor: theme.border }} /></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: theme.sub, fontSize: 13 }}>自定义强调色</Text>
        <TextInput editable={!disabled} value={hex} autoCapitalize="none" autoCorrect={false} maxLength={7} placeholder="#rrggbb" placeholderTextColor={theme.faint}
          onChangeText={(s) => {
            const v = s.startsWith('#') ? s : `#${s}`; setHex(v);
            if (timer.current) clearTimeout(timer.current);
            if (isHex(v)) timer.current = setTimeout(() => { timer.current = null; onPick(v.toLowerCase()); }, 350);
          }}
          style={{ color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minHeight: 40, minWidth: 120, includeFontPadding: false, textAlignVertical: 'center', fontFamily: 'monospace' }} />
      </View>
    </View>
  );
}

export function AppearanceGroup({ theme }: { theme: Theme }) {
  const { resolved: p, prefs, set, readOnly } = useTeamPrefs();
  const put = (patch: Record<string, unknown>) => set(patch).catch(toast);
  return (
    <Group theme={theme} title="外观" caption={readOnly ? '只读连接：外观设置不能修改。' : undefined}>
      <SetRow theme={theme} label="主题" hint="整个团队的配色，所有设备同步。" dim={readOnly}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEME_IDS.map((id) => {
            const on = id === p.theme; const c = (THEMES as any)[id][theme.dark ? 'dark' : 'light'];
            return (
              <Pressable key={id} disabled={readOnly} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { if (!on) put({ theme: id }); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? theme.accent : theme.border }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.bg, borderWidth: 3, borderColor: c.accent }} />
                <Text style={{ color: theme.text, fontSize: 14 }}>{(THEMES as any)[id].label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SetRow>
      <SetRow theme={theme} label="强调色" hint="未读标记、徽标和品牌标志。" dim={readOnly}>
        <AccentPicker theme={theme} accent={p.accent} disabled={readOnly} onPick={(a) => { if ((a ?? undefined) !== p.accent) put({ accent: a }); }} />
      </SetRow>
      <SetRow theme={theme} label="消息布局" dim={readOnly}>
        <Segmented theme={theme} value={p.layout} options={LAYOUTS as any} disabled={readOnly} onChange={(v) => put({ layout: v })} />
      </SetRow>
      {p.layout === 'flat' ? <SetRow theme={theme} label="正文宽度" dim={readOnly}>
        <WidthSlider theme={theme} label="正文宽度" value={p.flatWidth} disabled={readOnly} onCommit={(v) => put({ flatWidth: v })} />
      </SetRow> : null}
      <SetRow theme={theme} label="气泡宽度" dim={readOnly}>
        <WidthSlider theme={theme} label="气泡宽度" value={p.width} disabled={readOnly} onCommit={(v) => put({ width: v })} />
      </SetRow>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, opacity: readOnly ? 0.5 : 1 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 17 }}>显示思考过程</Text>
          <Text style={{ color: theme.sub, fontSize: 13, marginTop: 3 }}>接口尚未实现（手机聊天接口不返回思考内容，开关已同步）</Text>
        </View>
        <Switch disabled={readOnly} value={p.thinking} onValueChange={(v) => put({ thinking: v })} thumbColor="#ffffff" trackColor={{ true: theme.accent, false: theme.active }} />
      </View>
    </Group>
  );
}

export function MotionGroup({ theme }: { theme: Theme }) {
  const { resolved: p, set, readOnly } = useTeamPrefs();
  return (
    <Group theme={theme} title="动画">
      <SetRow theme={theme} label="Bot 动画" dim={readOnly}>
        <Segmented theme={theme} value={p.motion} options={MOTIONS as any} disabled={readOnly} onChange={(v) => set({ motion: v }).catch(toast)} />
      </SetRow>
    </Group>
  );
}
