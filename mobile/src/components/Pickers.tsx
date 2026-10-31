// The web UI's model menu (model-menu.js), permission picker (permission-picker.js) and
// folder menu (folder-menu.js), with the same rows, labels and saves.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, ToastAndroid, View } from 'react-native';
import { Icon } from './ui';
import type { Bot, BotState, Model, PermissionCatalog, Reasoning } from '../api/types';
import { useStore } from '../store';
import type { Theme } from '../theme';

const say = (e: any) => ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT);

export function Trigger({ theme, title, sub, onPress, danger }: { theme: Theme; title: string; sub?: string; onPress(): void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? theme.danger : theme.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ color: theme.sub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Icon name="chevron-down" color={theme.sub} size={16} />
    </Pressable>
  );
}

function Pop({ theme, visible, onClose, children }: { theme: Theme; visible: boolean; onClose(): void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 22 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: theme.cardHi, borderRadius: 18, maxHeight: '80%', paddingVertical: 6 }}>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const GroupHead = ({ theme, children }: { theme: Theme; children: string }) => <Text style={{ color: theme.sub, fontSize: 12, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 }}>{children}</Text>;
const Sep = ({ theme }: { theme: Theme }) => <View style={{ height: 1, backgroundColor: theme.sep, marginHorizontal: 14, marginVertical: 4 }} />;
function Item({ theme, label, sub, hint, on, onPress, disabled, back, fwd }: { theme: Theme; label: string; sub?: string; hint?: string; on?: boolean; onPress?(): void; disabled?: boolean; back?: boolean; fwd?: boolean }) {
  return (
    <Pressable disabled={disabled || !onPress} onPress={onPress} android_ripple={{ color: theme.fill }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 }}>
      {back ? <View style={{ marginRight: 6 }}><Icon name="back" color={theme.text} size={16} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: disabled ? theme.faint : theme.text, fontSize: 16 }}>{label}</Text>
        {sub ? <Text style={{ color: theme.sub, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {hint ? <Text style={{ color: theme.sub, fontSize: 12, marginLeft: 8 }}>{hint}</Text> : null}
      <View style={{ width: 22, alignItems: 'flex-end' }}>{on ? <Icon name="check" color={theme.text} size={16} /> : null}{fwd ? <Icon name="chevron" color={theme.sub} size={14} /> : null}</View>
    </Pressable>
  );
}

// model-menu.js: groupModels / servedOf / the trigger's "provider · effort" line.
// model-menu.js groupModels: by provider id; a shared display name gets "(id)".
function groups(models: Model[]) {
  const by = new Map<string, Model[]>();
  for (const m of models) { const k = m.provider ?? m.providerName ?? m.ref.split('/')[0]; if (!by.has(k)) by.set(k, []); by.get(k)!.push(m); }
  const names = new Map<string, number>();
  for (const [k, list] of by) { const n = list[0].providerName ?? k; names.set(n, (names.get(n) ?? 0) + 1); }
  return [...by].map(([k, list]) => { const n = list[0].providerName ?? k; return [names.get(n)! > 1 ? `${n} (${k})` : n, list] as [string, Model[]]; });
}
export function modelLine(bot: Bot, state: BotState | null, reasoning?: Reasoning | null) {
  const models = state?.models ?? [];
  const current = bot.model ?? bot.appliedModel;
  const served = models.find((m) => m.ref === current);
  const name = served?.name ?? (current ? current.split('/').slice(1).join('/') || current : undefined);
  const provider = served?.providerName ?? served?.provider ?? (current ? current.split('/')[0] : undefined);
  const r = reasoning ?? served?.reasoning;
  const picked = r?.efforts?.some((e) => e.id === bot.effort) ? bot.effort : undefined;
  const eff = picked ?? r?.defaultEffort;
  const effLabel = eff === undefined ? (r?.efforts?.length ? '默认' : undefined) : r!.efforts.find((e) => e.id === eff)?.name ?? eff;
  const sub = !name ? undefined : served || !models.length ? (effLabel === undefined ? provider : `${provider} · ${effLabel}`) : `${provider} · 不可用`;
  return { name: name ?? '选择模型', sub, current, served, picked, reasoning: r };
}

export function ModelField({ theme, bot }: { theme: Theme; bot: Bot }) {
  const { client, state, refresh } = useStore();
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState<Reasoning | null>(null);
  const base = modelLine(bot, state);
  useEffect(() => {
    setFetched(null);
    if (!client || !base.current || base.served?.reasoning) return;
    let live = true; client.efforts(base.current).then((r) => live && setFetched(r)).catch(() => {});
    return () => { live = false; };
  }, [client, base.current, !!base.served?.reasoning]);
  const line = modelLine(bot, state, base.served?.reasoning ?? fetched);
  const save = (p: Record<string, unknown>) => { setOpen(false); client?.updateBot(bot.id, p).then(refresh).catch(say); };
  const models = state?.models ?? [];
  const efforts = line.reasoning?.efforts ?? [];
  return (
    <>
      <Trigger theme={theme} title={line.name} sub={line.sub} onPress={() => { client?.refreshModels().then(refresh).catch(() => {}); setOpen(true); }} />
      <Pop theme={theme} visible={open} onClose={() => setOpen(false)}>
        {models.length ? groups(models).map(([p, list]) => (
          <View key={p}>
            <GroupHead theme={theme}>{p}</GroupHead>
            {list.map((m) => <Item key={m.ref} theme={theme} label={m.name} hint={m.ref === state?.defaultModel ? '默认' : undefined} on={m.ref === line.current}
              onPress={() => (m.ref !== line.current || !bot.model ? save({ model: m.ref }) : setOpen(false))} />)}
          </View>
        )) : <Item theme={theme} label="DeepSeek Harness 里还没有设置模型。" disabled />}
        {efforts.length ? (
          <>
            <Sep theme={theme} />
            <GroupHead theme={theme}>思考强度</GroupHead>
            {[{ id: undefined as string | undefined, name: '默认' }, ...efforts].map((e) => (
              <Item key={e.id ?? 'default'} theme={theme} label={e.name} on={(e.id ?? null) === (line.picked ?? null)}
                onPress={() => (e.id !== bot.effort ? save({ effort: e.id ?? null }) : setOpen(false))} />
            ))}
          </>
        ) : null}
      </Pop>
    </>
  );
}

// permission-picker.js
const PERM: Record<string, string> = { 'read-only': '仅可查看', 'workspace-write': '工作区内修改', 'danger-full-access': '完全权限' };
export const presetName = (v: string, c?: PermissionCatalog | null) => PERM[v] ?? c?.options.find((o) => o.value === v)?.name ?? v;
export function PermissionPicker({ theme, catalog, saved, onPick, repick }: { theme: Theme; catalog: PermissionCatalog; saved?: string; onPick(v: string): Promise<unknown>; repick?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending === saved) setPending(null); }, [saved]);
  const current = pending ?? saved;
  const pick = (v: string) => {
    if (v === current && !repick) return;
    setPending(v);
    onPick(v).catch((e) => { setPending(null); say(e); });
  };
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.card, borderRadius: 12, padding: 3 }}>
      {catalog.options.map((o) => {
        const on = o.value === current; const danger = o.value === 'danger-full-access';
        return (
          <Pressable key={o.value} onPress={() => pick(o.value)} accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: on ? theme.cardHi : 'transparent' }}>
            <Text style={{ color: danger ? theme.danger : on ? theme.text : theme.sub, fontSize: 14, fontWeight: on ? '600' : '400' }}>{presetName(o.value, catalog)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// folder-menu.js
export const folderName = (p: string) => String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(p);
type Listing = Awaited<ReturnType<NonNullable<ReturnType<typeof useStore>['client']>['folderList']>>;
export function FolderField({ theme, value, group, team, disabled, onPick }: { theme: Theme; value?: string; group?: boolean; team?: boolean; disabled?: boolean; onPick(path: string): Promise<unknown> }) {
  const { client } = useStore();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<{ team: string | null; picker: string | null; folders: { path: string; title: string }[] } | null>(null);
  const [view, setView] = useState<'list' | 'browse' | 'type'>('list');
  const [draft, setDraft] = useState('');
  const [listing, setListing] = useState<Listing | null>(null);
  const [problem, setProblem] = useState('');
  const fallback = group ? '各 Bot 自己的文件夹' : '总工作区';
  const toggle = () => { setView('list'); setProblem(''); client?.folders().then(setInfo).catch(() => setInfo((l) => l ?? { team: null, picker: null, folders: [] })); setOpen(true); };
  const choose = (path: string) => { setOpen(false); if (path !== (value ?? '')) onPick(path).catch(say); };
  const browse = (path?: string) => { setProblem(''); client?.folderList(path).then((n) => { setListing(n); setView('browse'); }).catch((e) => setProblem(String(e?.message ?? e))); };
  const known = info?.folders ?? [];
  const folders = value && !known.some((f) => f.path === value) ? [{ path: value, title: folderName(value) }, ...known] : known;
  const parent = listing?.crumbs && listing.crumbs.length > 1 ? listing.crumbs[listing.crumbs.length - 2] : undefined;
  const inside = listing?.entries?.filter((e) => !e.hidden) ?? [];
  return (
    <>
      <Trigger theme={theme} title={value ? folderName(value) : fallback} sub={value} onPress={disabled ? () => {} : toggle} />
      <Pop theme={theme} visible={open} onClose={() => setOpen(false)}>
        {view === 'list' ? (
          <>
            {team ? null : <Item theme={theme} label={fallback} sub={group ? undefined : info?.team ?? undefined} on={!value} onPress={() => choose('')} />}
            {folders.length ? <GroupHead theme={theme}>文件夹</GroupHead> : null}
            {folders.map((f) => <Item key={f.path} theme={theme} label={f.title} sub={f.path} on={f.path === value} onPress={() => choose(f.path)} />)}
            <Sep theme={theme} />
            {info?.picker === 'browse' ? <Item theme={theme} label="浏览文件夹…" onPress={() => browse(value)} /> : null}
            <Item theme={theme} label="输入路径…" onPress={() => { setDraft(value ?? ''); setView('type'); }} />
          </>
        ) : view === 'type' ? (
          <>
            <Item theme={theme} label="后退" back onPress={() => setView('list')} />
            <TextInput autoFocus value={draft} onChangeText={setDraft} placeholder="文件夹的完整路径" placeholderTextColor={theme.faint} autoCapitalize="none" autoCorrect={false}
              onSubmitEditing={() => draft.trim() && choose(draft.trim())}
              style={{ color: theme.text, fontSize: 15, marginHorizontal: 18, marginVertical: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.sep }} />
            <Item theme={theme} label="使用这个文件夹" disabled={!draft.trim()} onPress={() => choose(draft.trim())} />
          </>
        ) : listing ? (
          <>
            <Item theme={theme} label="后退" back onPress={() => setView('list')} />
            <Text style={{ color: theme.sub, fontSize: 11, paddingHorizontal: 18, paddingBottom: 4 }}>{listing.path}</Text>
            {parent ? <Item theme={theme} label="上一级" onPress={() => browse(parent.path)} /> : null}
            {inside.map((e) => <Item key={e.path} theme={theme} label={e.name} fwd onPress={() => browse(e.path)} />)}
            {!inside.length ? <Item theme={theme} label="里面没有文件夹。" disabled /> : null}
            {listing.truncated ? <Text style={{ color: theme.sub, fontSize: 11, paddingHorizontal: 18 }}>还有一些文件夹没有显示。</Text> : null}
            <Sep theme={theme} />
            <Item theme={theme} label="使用这个文件夹" onPress={() => choose(listing.path)} />
          </>
        ) : null}
        {problem ? <Text style={{ color: theme.danger, paddingHorizontal: 18, paddingVertical: 6 }}>{problem}</Text> : null}
      </Pop>
    </>
  );
}
