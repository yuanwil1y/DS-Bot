// Grok-style primitives: round icon buttons, pills, grouped rounded rows, sheets.
import React from 'react';
import { BackHandler, Modal, Pressable, ScrollView, Switch, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Theme } from '../theme';
import { SvgXml } from 'react-native-svg';
import { iconXml } from './iconXml';
import { ICONS } from './icons.gen';

// The web's own icons (icons.gen.ts, generated from ds-bot icons.js), drawn at the web's size
// unless a size is given; currentColor becomes the passed color.
export function Icon({ name, color, size }: { name: string; color: string; size?: number }) {
  const xml = ICONS[name];
  if (!xml) return <Text style={{ color, fontSize: size ?? 16 }}>{name}</Text>;
  const own = Number(/width="([\d.]+)"/.exec(xml)?.[1] ?? 16);
  const s = size ?? own;
  return <SvgXml xml={iconXml(xml, color)} width={s} height={s} color={color} />;
}

export function RoundButton({ theme, icon, onPress, size = 36, children, label, style }: { theme: Theme; icon?: string; onPress?: () => void; size?: number; children?: React.ReactNode; label?: string; style?: ViewStyle }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.roundFill ?? theme.bg, borderWidth: 1, borderColor: theme.roundBorder ?? theme.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, style]}>
      {children ?? <Icon name={icon ?? ''} color={theme.text} size={size >= 44 ? 22 : undefined} />}
    </Pressable>
  );
}

export function PillButton({ theme, title, onPress, primary, disabled }: { theme: Theme; title: string; onPress?: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => ({ alignSelf: 'center', paddingHorizontal: 18, height: 40, borderRadius: 20, justifyContent: 'center', backgroundColor: primary ? theme.accent : theme.cardHi, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
      <Text style={{ color: primary ? theme.accentText : theme.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Group({ theme, children, title, caption, style }: { theme: Theme; children: React.ReactNode; title?: string; caption?: string; style?: ViewStyle }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginTop: 20 }, style]}>
      {title ? <Text style={{ color: theme.sub, fontSize: 14, marginLeft: 22, marginBottom: 8 }}>{title}</Text> : null}
      <View style={{ backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
        {items.map((c, i) => <View key={i}>{i > 0 ? <View style={{ height: 1, backgroundColor: theme.sep, marginLeft: 18 }} /> : null}{c}</View>)}
      </View>
      {caption ? <Text style={{ color: theme.faint, fontSize: 13, marginHorizontal: 22, marginTop: 8 }}>{caption}</Text> : null}
    </View>
  );
}

export function Row({ theme, icon, label, value, caption, onPress, chevron = !!onPress, right, danger }: { theme: Theme; icon?: string; label: string; value?: string; caption?: string; onPress?: () => void; chevron?: boolean; right?: React.ReactNode; danger?: boolean }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} android_ripple={onPress ? { color: theme.cardHi } : undefined} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, minHeight: 58, paddingVertical: 12 }}>
      {icon ? <View style={{ width: 28, marginRight: 10, alignItems: 'center' }}><Text style={{ color: theme.text, fontSize: 18 }}>{icon}</Text></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? theme.danger : theme.text, fontSize: 17 }}>{label}</Text>
        {caption ? <Text style={{ color: theme.sub, fontSize: 13, marginTop: 3 }} numberOfLines={3}>{caption}</Text> : null}
      </View>
      {value ? <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 16, marginLeft: 12, maxWidth: '55%' }}>{value}</Text> : null}
      {right}
      {chevron ? <View style={{ marginLeft: 8 }}><Icon name="chevron" color={theme.sub} size={16} /></View> : null}
    </Pressable>
  );
}

export function ToggleRow({ theme, label, value, onChange }: { theme: Theme; label: string; value: boolean; onChange(v: boolean): void }) {
  return <Row theme={theme} label={label} right={<Switch value={value} onValueChange={onChange} thumbColor="#ffffff" trackColor={{ true: theme.accent, false: theme.active }} />} />;
}

/** Full-height sheet with a round close button (Grok settings style). */
const HEAD: ViewStyle = { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 };
const TITLE = { fontSize: 18, fontWeight: '400' as const, marginLeft: 18 };
/** Secondary-page header (Grok style): one row, back chevron (36 + hitSlop ≈ 48dp), title, optional trailing. */
export function PageHeader({ theme, title, onBack, backLabel = '返回', right, sub }: { theme: Theme; title: string; onBack(): void; backLabel?: string; right?: React.ReactNode; sub?: string }) {
  // Hardware / gesture back = this header's back (one level: e.g. 全部记忆 → 摘要, 单个用量 → 全部用量).
  const latest = React.useRef(onBack); latest.current = onBack;
  React.useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { latest.current(); return true; }); return () => sub.remove(); }, []);
  return (
    <View style={HEAD}>
      <RoundButton theme={theme} icon="back" onPress={onBack} label={backLabel} size={48} />
      <Text numberOfLines={1} style={[TITLE, { flexShrink: 1, color: theme.text }]}>{title}</Text>
      <Text numberOfLines={1} style={{ flex: 1, color: theme.sub, marginLeft: 8 }}>{sub ?? ''}</Text>
      {right}
    </View>
  );
}

/** Bottom sheet. Root: ✕ closes. Sub-page (onBack set): one header row — back chevron + title, no ✕;
 * Android back goes up one level (settings.js .bt-settings-head: back button + h2 page title). */
export function Sheet({ theme, visible, onClose, children, right, title, onBack, backLabel }: { theme: Theme; visible: boolean; onClose(): void; children: React.ReactNode; right?: React.ReactNode; title?: string; onBack?: () => void; backLabel?: string }) {
  const ins = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onBack ?? onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: ins.top + 8 }}>
        <View style={{ flex: 1, backgroundColor: theme.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
          <View style={HEAD}>
            {onBack ? <RoundButton theme={theme} icon="back" onPress={onBack} label={backLabel ?? '返回'} size={48} /> : <RoundButton theme={theme} icon="close" onPress={onClose} label="关闭" size={48} />}
            <Text numberOfLines={1} style={[TITLE, { flex: 1, color: theme.text }]}>{title ?? ''}</Text>
            {right}
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: ins.bottom + 40 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Small floating status dot/label instead of a permanent banner. */
export function StatusDot({ theme, status }: { theme: Theme; status: string }) {
  if (status === 'open') return null;
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status === 'connecting' ? '#f5a623' : theme.danger }} />;
}

export function Badge({ n, theme }: { n: number; theme: Theme }) {
  if (n <= 0) return null;
  return <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.badge, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{n > 99 ? '99+' : n}</Text></View>;
}
