// Settings → 密钥: a port of ds-bot 0.2.4 secret-card.js SecretsPage (SecretRow, ScopeEditor,
// PurposeEditor, ValueEditor, AddSecret). Values go out in secret-set and never come back.
import React, { useEffect, useState } from 'react';
import { ftLog, useFT } from '../selfTest'; // TEST-ONLY
import { Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Group, Icon } from '../components/ui';
import { Soft } from './AboutFeedback';
import { useStore } from '../store';
import type { Theme } from '../theme';

export const MIN_VALUE = 4;
export const NAME_RE = /^[A-Za-z][\w-]{0,63}$/;
export type SecretView = { name: string; purpose?: string; scope: 'all' | string[]; requestedBy?: string | null; createdAt?: string; updatedAt?: string; lastUsedAt?: string | null };
const MONO = 'monospace';
// secret-card.js when(): toLocaleString(month short, day numeric, hour/minute 2-digit).
export const when = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export function secretMeta(s: SecretView, nameOf: (id: string) => string | undefined) {
  const asker = s.requestedBy ? nameOf(s.requestedBy) ?? '一个已删除的 Bot' : '你';
  return [`由 ${asker} 请求`, `添加于 ${when(s.createdAt)}`, s.lastUsedAt ? `上次使用 ${when(s.lastUsedAt)}` : '还没用过'].join(' · ');
}

export function SecretsPage({ theme }: { theme: Theme }) {
  const { client, state, refresh } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const secrets: SecretView[] = (state as any)?.secrets ?? [];
  useFT('secrets.expand', (name: string | null) => { if (name && !secrets.some((x) => x.name === name)) { ftLog(`跳过：没有密钥 ${name}`); return; } setOpen(name); }); // TEST-ONLY
  const run = (p: Promise<unknown>) => p.then(() => { refresh(); return true; }, (e: any) => { ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT); return false; });
  return <>
    <Text style={{ marginTop: 8, marginBottom: 4, paddingHorizontal: 4, fontSize: 12, lineHeight: 17, color: theme.sub }}>
      你的 Bot 请求过的密钥。Bot 永远看不到值：它们在 shell 里通过 <Text style={{ fontFamily: MONO, fontSize: 11.5 }}>$DSH_SECRET_NAME</Text> 使用，而且发给模型之前，每个值都会被替换成 <Text style={{ fontFamily: MONO, fontSize: 11.5 }}>[secret:NAME]</Text>。
    </Text>
    <Group theme={theme} title={`密钥 · ${secrets.length}`}>
      {secrets.length === 0 && !adding ? <Text style={{ padding: 12, fontSize: 12, color: theme.faint }}>还没有密钥。Bot 需要时，会在对话里弹出一张卡片。</Text> : null}
      {secrets.map((s) => <SecretRow key={s.name} theme={theme} secret={s} open={open === s.name} onToggle={() => setOpen(open === s.name ? null : s.name)}
        onScope={(scope) => run(client!.secretUpdate(s.name, { scope }))} onPurpose={(purpose) => run(client!.secretUpdate(s.name, { purpose }))}
        onValue={(value) => run(client!.secretSet({ name: s.name, value }))} onDelete={() => run(client!.secretDelete(s.name))} />)}
      {adding ? <AddSecret theme={theme} onSave={(p) => run(client!.secretSet({ ...p, scope: 'all' }))} onDone={() => setAdding(false)} /> : null}
    </Group>
    {adding ? null : <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginTop: 12, marginLeft: -8 }}>{/* secret-card.js .bt-actions under the card, left */}<Soft theme={theme} title="添加密钥" onPress={() => setAdding(true)} /></View>}
  </>;
}

function Input({ theme, value, onChange, placeholder, label, masked, upper, mono }: { theme: Theme; value: string; onChange(v: string): void; placeholder?: string; label?: string; masked?: boolean; upper?: boolean; mono?: boolean }) {
  return <TextInput value={value} onChangeText={(v) => onChange(upper ? v.toUpperCase() : v)} placeholder={placeholder} placeholderTextColor={theme.faint} accessibilityLabel={label ?? placeholder}
    secureTextEntry={masked} autoCapitalize={upper ? 'characters' : 'none'} autoCorrect={false} spellCheck={false} autoComplete="off"
    style={{ flex: 1, height: 36, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 14, fontFamily: masked || mono ? MONO : undefined }} />;
}
const Label = ({ theme, text }: { theme: Theme; text: string }) => <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: theme.sub }}>{text}</Text>;
const Hint = ({ theme, text, flex }: { theme: Theme; text: string; flex?: boolean }) => <Text style={{ fontSize: 12, lineHeight: 16, color: theme.faint, ...(flex ? { flex: 1 } : {}) }}>{text}</Text>;

function SecretRow({ theme, secret, open, onToggle, onScope, onPurpose, onValue, onDelete }: { theme: Theme; secret: SecretView; open: boolean; onToggle(): void; onScope(s: 'all' | string[]): Promise<boolean>; onPurpose(p: string): Promise<boolean>; onValue(v: string): Promise<boolean>; onDelete(): Promise<boolean> }) {
  const { state } = useStore();
  const bots = state?.bots ?? [];
  const byId = Object.fromEntries(bots.map((b) => [b.id, b]));
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!open) setConfirm(false); }, [open]);
  const allowed = secret.scope === 'all' ? [] : secret.scope.map((id) => byId[id]).filter(Boolean);
  const tag = (text: string) => <Text style={{ paddingHorizontal: 8, lineHeight: 20, borderRadius: 999, overflow: 'hidden', fontSize: 11, backgroundColor: theme.tagBg, color: theme.tagInk }}>{text}</Text>;
  return <View style={{ borderTopWidth: 1, borderColor: theme.sep }}>
    <Pressable onPress={onToggle} accessibilityState={{ expanded: open }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, backgroundColor: pressed ? theme.hover : 'transparent' })}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="key" color={theme.sub} size={15} />
          <Text style={{ fontFamily: MONO, fontSize: 12, lineHeight: 16, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, overflow: 'hidden', backgroundColor: theme.hover, color: theme.text }}>{secret.name}</Text>
          {secret.purpose ? <Text numberOfLines={1} style={{ flexShrink: 1, color: theme.sub, fontSize: 13 }}>{secret.purpose}</Text> : null}
        </View>
        <Hint theme={theme} text={secretMeta(secret, (id) => byId[id]?.name)} />
      </View>
      {secret.scope === 'all' ? tag('所有 Bot') : allowed.length === 0 ? tag('没有 Bot')
        : <View style={{ flexDirection: 'row' }}>{allowed.slice(0, 5).map((b, i) => <View key={b.id} style={{ marginLeft: i ? -6 : 0 }}><Avatar bot={b} size={20} badge={false} /></View>)}</View>}
    </Pressable>
    {open ? <View style={{ gap: 14, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 14 }}>
      <ScopeEditor key={JSON.stringify(secret.scope)} theme={theme} secret={secret} bots={bots} onSave={onScope} />
      <PurposeEditor key={secret.purpose ?? ''} theme={theme} secret={secret} onSave={onPurpose} />
      <ValueEditor theme={theme} secret={secret} onSave={onValue} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 0 }}>
        {confirm ? <>
          <Hint theme={theme} flex text={`删除 ${secret.name}？Bot 会立刻失去它。`} />
          <Soft theme={theme} title="保留" onPress={() => setConfirm(false)} />
          <Soft theme={theme} title="删除" danger onPress={onDelete} />
        </> : <Pressable onPress={() => setConfirm(true)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.cardHi, opacity: pressed ? 0.7 : 1 })}>
          <Icon name="trash" color={theme.danger} size={13} /><Text style={{ color: theme.danger, fontSize: 13 }}>删除</Text>
        </Pressable>}
      </View>
    </View> : null}
  </View>;
}

function ScopeEditor({ theme, secret, bots, onSave }: { theme: Theme; secret: SecretView; bots: any[]; onSave(s: 'all' | string[]): void }) {
  const [mode, setMode] = useState<'all' | 'some'>(secret.scope === 'all' ? 'all' : 'some');
  const [picked, setPicked] = useState<string[]>(secret.scope === 'all' ? [] : secret.scope);
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const same = mode === 'all' ? secret.scope === 'all' : secret.scope !== 'all' && [...picked].sort().join() === [...secret.scope].sort().join();
  const radio = (id: 'all' | 'some', text: string) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: mode === id }} onPress={() => setMode(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: mode === id ? theme.accent : theme.border, alignItems: 'center', justifyContent: 'center' }}>{mode === id ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent }} /> : null}</View>
    <Text style={{ fontSize: 13, color: theme.text }}>{text}</Text>
  </Pressable>;
  return <View style={{ gap: 8 }}>
    <Label theme={theme} text="谁可以用" />
    <View accessibilityRole="radiogroup" accessibilityLabel={`谁可以用 ${secret.name}`} style={{ flexDirection: 'row', gap: 16 }}>{radio('all', '所有 Bot')}{radio('some', '指定的 Bot')}</View>
    {mode === 'some' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{bots.map((b) => {
      const on = picked.includes(b.id);
      return <Pressable key={b.id} onPress={() => toggle(b.id)} accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingLeft: 5, paddingRight: 10, borderRadius: 999, borderWidth: 0.5, borderColor: on ? theme.border : theme.line, backgroundColor: on ? theme.active : theme.card }}>
        <Avatar bot={b} size={20} badge={false} /><Text style={{ fontSize: 12, color: on ? theme.text : theme.sub }}>{b.name}</Text>{on ? <Icon name="check" color={theme.text} size={13} /> : null}
      </Pressable>;
    })}</View> : null}
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginTop: 12, marginLeft: -8 }}>{/* secret-card.js .bt-actions under the card, left */}<Soft theme={theme} title="保存权限" disabled={same} onPress={() => onSave(mode === 'all' ? 'all' : picked)} /></View>
  </View>;
}

function PurposeEditor({ theme, secret, onSave }: { theme: Theme; secret: SecretView; onSave(p: string): void }) {
  const [purpose, setPurpose] = useState(secret.purpose ?? '');
  const same = purpose.trim() === (secret.purpose ?? '');
  return <View style={{ gap: 8 }}>
    <Label theme={theme} text="用途" />
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Input theme={theme} value={purpose} onChange={setPurpose} placeholder="用途" /><Soft theme={theme} title="保存" disabled={same} onPress={() => onSave(purpose.trim())} /></View>
  </View>;
}

function ValueEditor({ theme, secret, onSave }: { theme: Theme; secret: SecretView; onSave(v: string): Promise<boolean> }) {
  const [value, setValue] = useState('');
  const [replaced, setReplaced] = useState(false);
  const long = value.trim().length >= MIN_VALUE;
  const save = () => { if (long) void onSave(value).then((ok) => { if (ok) { setValue(''); setReplaced(true); } }); };
  return <View style={{ gap: 8 }}>
    <Label theme={theme} text="替换值" />
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Input theme={theme} value={value} onChange={(v) => { setValue(v); setReplaced(false); }} placeholder="粘贴或输入密钥" label={`${secret.name} 的新值`} masked /><Soft theme={theme} title="替换" disabled={!long} onPress={save} /></View>
    {value !== '' && !long ? <Hint theme={theme} text={`至少 ${MIN_VALUE} 个字符。`} />
      : replaced ? <View accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="check" color="#16a34a" size={13} /><Hint theme={theme} text="已替换。Bot 从下一条命令开始拿到新值。" /></View> : null}
  </View>;
}

function AddSecret({ theme, onSave, onDone }: { theme: Theme; onSave(p: { name: string; purpose: string; value: string }): Promise<boolean>; onDone(): void }) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [value, setValue] = useState('');
  const ready = NAME_RE.test(name.trim()) && value.trim().length >= MIN_VALUE;
  const save = () => { if (ready) void onSave({ name, purpose, value }).then((ok) => { if (ok) { setValue(''); onDone(); } }); };
  return <View style={{ gap: 8, padding: 12, borderTopWidth: 1, borderColor: theme.sep }}>
    <View style={{ flexDirection: 'row' }}><Input theme={theme} value={name} onChange={setName} label="密钥名" placeholder="名字，例如 GITHUB_TOKEN" upper mono /></View>
    <View style={{ flexDirection: 'row' }}><Input theme={theme} value={purpose} onChange={setPurpose} placeholder="用途" /></View>
    <View style={{ flexDirection: 'row' }}><Input theme={theme} value={value} onChange={setValue} label="值" placeholder="粘贴或输入密钥" masked /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
      <Hint theme={theme} flex text="新密钥默认所有 Bot 可用，之后可以收窄。" />
      <Soft theme={theme} title="取消" onPress={onDone} />
      <Soft theme={theme} title="保存密钥" disabled={!ready} onPress={save} />
    </View>
  </View>;
}
