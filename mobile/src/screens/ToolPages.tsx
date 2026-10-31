// Settings → 连接器 / 能力 / 浏览器: ports of ds-bot 0.2.4 connectors.js ConnectorsPage,
// capability-settings.js CapabilitiesPage and browser-settings.js BrowserPage. Pure parts in api/toolsModel.ts.
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { SvgXml } from 'react-native-svg';
import { Group, Soft, Actions, Icon } from '../components/ui';
import { useStore } from '../store';
import type { Theme } from '../theme';
import { ACTIONS, DURATIONS, TOKEN_URL, addGrants, blank, capabilityPayload, capabilitySecondary, connectorStatus, editDraft, expired, grantKinds, grantTime, newGrant, removeGrants, sortCapabilities, type Draft, type Grant } from '../api/toolsModel';

const fail = (e: any) => ToastAndroid.show(e?.message ?? String(e), ToastAndroid.LONG);
const Hint = ({ theme, text }: { theme: Theme; text: string }) => <Text style={{ color: theme.faint, fontSize: 12, lineHeight: 16, padding: 16 }}>{text}</Text>;
const Label = ({ theme, text }: { theme: Theme; text: string }) => <Text style={{ color: theme.sub, fontSize: 13, marginBottom: 6 }}>{text}</Text>;
const Err = ({ theme, text }: { theme: Theme; text: string }) => text ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 13, marginHorizontal: 16, marginTop: 8 }}>{text}</Text> : null;
function Field({ theme, label, value, onChange, multiline, disabled, placeholder, max, secure }: { theme: Theme; label: string; value: string; onChange(v: string): void; multiline?: boolean; disabled?: boolean; placeholder?: string; max?: number; secure?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      <Label theme={theme} text={label} />
      <TextInput value={value} onChangeText={onChange} editable={!disabled} placeholder={placeholder} placeholderTextColor={theme.faint} maxLength={max} secureTextEntry={secure}
        multiline={multiline} autoCapitalize="none" autoCorrect={false} spellCheck={false}
        style={{ color: disabled ? theme.faint : theme.text, backgroundColor: theme.fill, borderColor: theme.fillBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: multiline ? 90 : 40, textAlignVertical: multiline ? 'top' : 'center', fontFamily: multiline ? 'monospace' : undefined }} />
    </View>
  );
}
/** Native <select> / checkbox stand-ins: pill choices. */
function Choice({ theme, label, on, onPress, disabled }: { theme: Theme; label: string; on: boolean; onPress(): void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} accessibilityState={{ checked: on, disabled }} style={{ paddingHorizontal: 12, height: 32, borderRadius: 999, justifyContent: 'center', marginRight: 8, marginBottom: 8, backgroundColor: on ? theme.active : theme.cardHi, borderWidth: 1, borderColor: on ? theme.text : 'transparent', opacity: disabled && !on ? 0.4 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{on ? <Icon name="check" color={theme.text} size={13} /> : null}<Text style={{ color: theme.text, fontSize: 13 }}>{label}</Text></View>
    </Pressable>
  );
}
function Choices({ theme, label, children }: { theme: Theme; label: string; children: React.ReactNode }) {
  return <View style={{ paddingHorizontal: 16, paddingTop: 12 }}><Label theme={theme} text={label} /><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View></View>;
}
function Item({ theme, name, status, children, lead }: { theme: Theme; name: string; status?: string; children?: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
      {lead}
      <View style={{ flex: 1, minWidth: 140 }}>
        <Text style={{ color: theme.text, fontSize: 15 }}>{name}</Text>
        {status ? <Text style={{ color: theme.sub, fontSize: 12, marginTop: 2 }}>{status}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>{children}</View>
    </View>
  );
}

// connectors.js GitHubMark in a .bt-connector-mark tile (36px, radius 10, card fill, .5px line, gap 12).
const GITHUB_D = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';
const MARKS: Record<string, string> = { github: GITHUB_D };
function ConnectorMark({ theme, id }: { theme: Theme; id: string }) {
  const d = MARKS[id];
  return <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
    {d ? <SvgXml xml={`<svg viewBox="0 0 16 16" width="20" height="20"><path fill="${theme.text}" d="${d}"/></svg>`} width={20} height={20} /> : null}
  </View>;
}

// connectors.js — token based (GitHub PAT); the only browser hop is the token page.
export function ConnectorsPage({ theme }: { theme: Theme }) {
  const { client, state, refresh } = useStore();
  const list: any[] = (state as any)?.connectors ?? [];
  const [open, setOpen] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (f: () => Promise<unknown>) => { setError(''); try { await f(); await refresh(); return true; } catch (e: any) { setError(e?.message ?? String(e)); return false; } };
  const connect = async (id: string) => { setBusy(true); const ok = await run(() => client!.connectorConnect(id, token)); setBusy(false); if (ok) { setToken(''); setOpen(''); } };
  return (
    <Group theme={theme} inset={4} title="连接器">
      {list.length === 0 ? <Hint theme={theme} text="暂无连接器" /> : list.map((c) => (
        <View key={c.id}>
          <Item theme={theme} name={c.name} status={connectorStatus(c)} lead={<ConnectorMark theme={theme} id={c.id} />}>
            {c.state === 'error' ? <Soft theme={theme} title="重试" onPress={() => void run(() => client!.connectorRetry(c.id))} /> : null}
            {c.state !== 'off' ? <Soft theme={theme} title="断开" onPress={() => void run(() => client!.connectorDisconnect(c.id))} />
              : <Soft theme={theme} title="连接" onPress={() => { setOpen(c.id); setError(''); }} />}
          </Item>
          {open === c.id && c.state === 'off' ? (
            <View>
              <Field theme={theme} label="GitHub token" value={token} onChange={setToken} secure />
              <Actions gap={6} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Pressable onPress={() => void Linking.openURL(TOKEN_URL)}><Text style={{ color: theme.accent, fontSize: 13 }}>去 GitHub 生成 token</Text></Pressable>
                <Soft theme={theme} title="取消" onPress={() => { setOpen(''); setToken(''); }} />
                <Soft theme={theme} title={busy ? '正在连接…' : '连接'} disabled={busy || !token.trim()} onPress={() => void connect(c.id)} />
              </Actions>
            </View>
          ) : null}
        </View>
      ))}
      {error ? <Err theme={theme} text={error} /> : null}
    </Group>
  );
}

function CapabilityForm({ theme, draft, setDraft, items, onClose }: { theme: Theme; draft: Draft; setDraft(f: (d: Draft) => Draft): void; items: any[]; onClose(): void }) {
  const { client, refresh } = useStore();
  const [error, setError] = useState('');
  const set = (k: keyof Draft, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const editing = draft.originalName !== undefined;
  const submit = async () => {
    setError('');
    let payload;
    try { payload = capabilityPayload(draft); } catch (e: any) { setError(e?.message ?? String(e)); return; }
    try { await client!.capabilitySave(payload); await refresh(); onClose(); } catch (e: any) { setError(e?.message ?? String(e)); }
  };
  const available = items.filter((i) => i.name !== draft.name && ['mcp', 'skill'].includes(i.kind));
  const JSON_HINT = '{"API_KEY": "$DSH_SECRET_MY_KEY"}';
  return (
    <View>
      <Field theme={theme} label="名字" value={draft.name} onChange={(v) => set('name', v)} disabled={editing} placeholder="my-tool" max={32} />
      <Choices theme={theme} label="类型">{[['mcp', 'MCP 服务'], ['skill', '技能'], ['pack', '能力包']].map(([k, l]) => <Choice key={k} theme={theme} label={l} on={draft.kind === k} disabled={editing} onPress={() => set('kind', k)} />)}</Choices>
      <Field theme={theme} label="Description" value={draft.description} onChange={(v) => set('description', v)} />
      {draft.kind === 'mcp' ? <Choices theme={theme} label="连接方式">{[['stdio', '本地命令'], ['streamable-http', 'HTTP 服务']].map(([k, l]) => <Choice key={k} theme={theme} label={l} on={draft.transport === k} onPress={() => set('transport', k)} />)}</Choices> : null}
      {draft.kind === 'mcp' && draft.transport === 'stdio' ? <>
        <Field theme={theme} label="命令" value={draft.command} onChange={(v) => set('command', v)} />
        <Field theme={theme} label="参数（每行一个）" value={draft.argsText} onChange={(v) => set('argsText', v)} multiline />
        <Field theme={theme} label="环境变量（JSON）" value={draft.envText} onChange={(v) => set('envText', v)} multiline placeholder={JSON_HINT} />
      </> : null}
      {draft.kind === 'mcp' && draft.transport === 'streamable-http' ? <>
        <Field theme={theme} label="URL" value={draft.url} onChange={(v) => set('url', v)} />
        <Field theme={theme} label="请求头（JSON）" value={draft.headersText} onChange={(v) => set('headersText', v)} multiline placeholder={JSON_HINT} />
      </> : null}
      {draft.kind === 'skill' ? <Field theme={theme} label="技能说明" value={draft.content} onChange={(v) => set('content', v)} multiline /> : null}
      {draft.kind === 'pack' ? (available.length === 0 ? <Hint theme={theme} text="请先保存 MCP 服务或技能。" />
        : <Choices theme={theme} label="能力包">{available.map((i) => <Choice key={i.name} theme={theme} label={i.name} on={draft.items.includes(i.name)} onPress={() => set('items', draft.items.includes(i.name) ? draft.items.filter((n) => n !== i.name) : [...draft.items, i.name])} />)}</Choices>) : null}
      <Err theme={theme} text={error} />
      <Actions gap={6} style={{ paddingTop: 12, paddingBottom: 12, paddingHorizontal: 18 }}>
        <Soft theme={theme} title="取消" onPress={onClose} />
        <Soft theme={theme} title={editing ? '保存更改' : '添加能力'} onPress={() => void submit()} />
      </Actions>
    </View>
  );
}

export function CapabilitiesPage({ theme }: { theme: Theme }) {
  const { client, state, refresh } = useStore();
  const items = sortCapabilities((state as any)?.capabilities);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState('');
  useEffect(() => { if (!confirming) return undefined; const t = setTimeout(() => setConfirming(''), 4000); return () => clearTimeout(t); }, [confirming]);
  const run = (f: () => Promise<unknown>) => void f().then(() => refresh()).catch(fail);
  const remove = (item: any) => { if (confirming !== item.name) { setConfirming(item.name); return; } setConfirming(''); run(() => client!.capabilityDelete(item.name)); };
  return (
    <>
      {/* capability-settings.js: h3 共享能力 → .bt-actions (left, no card) → form → .bt-set-card list */}
      <Text style={{ color: theme.sub, fontSize: 14, marginLeft: 4, marginTop: 20, marginBottom: 10 }}>共享能力</Text>
      <Actions style={{ marginBottom: 12 }}><Soft theme={theme} title="添加能力" onPress={() => setDraft(blank())} /></Actions>
      {draft ? <CapabilityForm theme={theme} draft={draft} setDraft={(f) => setDraft((d) => (d ? f(d) : d))} items={items} onClose={() => setDraft(null)} /> : null}
      <Group theme={theme} style={{ marginTop: draft ? 12 : 0 }}>
        {items.length === 0 ? <Hint theme={theme} text="还没有保存能力" /> : items.map((item) => (
          <Item key={item.name} theme={theme} name={item.name} status={capabilitySecondary(item)}>
            {item.kind === 'mcp' && item.transport === 'stdio' && !item.approved ? <Soft theme={theme} title="允许" onPress={() => run(() => client!.capabilityApprove(item.name))} /> : null}
            <Soft theme={theme} title="编辑" onPress={() => setDraft(editDraft(item))} />
            <Soft theme={theme} title={confirming === item.name ? '再点一次删除。' : '删除'} danger={confirming === item.name} onPress={() => remove(item)} />
          </Item>
        ))}
      </Group>
    </>
  );
}

const NOTE = 'Bot 可以自由浏览、点击和填写表单。发布、上传、下载和删除会先征求你的同意，除非你在这里预先允许。付款始终由你自己完成：Bot 会把页面交给你。';
export function BrowserPage({ theme }: { theme: Theme }) {
  const { client, state, refresh } = useStore();
  const bots: any[] = state?.bots ?? [];
  const grants = bots.flatMap((bot) => ((bot.browserGrants ?? []) as Grant[]).map((grant, index) => ({ bot, grant, index })));
  const [botId, setBotId] = useState('');
  const [site, setSite] = useState('');
  const [kinds, setKinds] = useState<string[]>(['post']);
  const [duration, setDuration] = useState('hour');
  const [busy, setBusy] = useState(false);
  const chosen = bots.find((b) => b.id === botId) ?? bots[0];
  const run = async (f: () => Promise<unknown>) => { try { await f(); await refresh(); return true; } catch (e) { fail(e); return false; } };
  const add = async () => {
    if (!chosen || kinds.length === 0 || busy) return;
    setBusy(true);
    await run(() => client!.updateBot(chosen.id, { browserGrants: addGrants(chosen.browserGrants, newGrant(site, kinds, duration)) }));
    setBusy(false);
  };
  return (
    <>
      <Group theme={theme} inset={4} title="浏览器权限"><Text style={{ color: theme.sub, fontSize: 13, lineHeight: 19, padding: 16 }}>{NOTE}</Text></Group>
      <Group theme={theme} inset={4} title="已允许的操作">
        {grants.length === 0 ? <Hint theme={theme} text="还没有允许的操作。" /> : grants.map(({ bot, grant, index }) => (
          <Item key={`${bot.id}:${index}`} theme={theme} lead={<View style={{ marginRight: 10 }}><Avatar bot={bot} size={28} badge={false} /></View>}
            name={`${bot.name} · ${grant.site === '*' ? '所有网站' : grant.site}`} status={[grantKinds(grant).join(' '), grantTime(grant)].join(' · ')}>
            <Soft theme={theme} title="移除授权" onPress={() => void run(() => client!.updateBot(bot.id, { browserGrants: removeGrants(bot.browserGrants, index) }))} />
          </Item>
        ))}
      </Group>
      <Group theme={theme} inset={4} title="允许操作">
        <Choices theme={theme} label="Bot">{bots.map((b) => <Choice key={b.id} theme={theme} label={b.name} on={chosen?.id === b.id} onPress={() => setBotId(b.id)} />)}</Choices>
        <Field theme={theme} label="网站" value={site} onChange={setSite} placeholder="example.com — 留空表示所有网站" />
        <Choices theme={theme} label="操作">{ACTIONS.map(([k, l]) => <Choice key={k} theme={theme} label={l} on={kinds.includes(k)} onPress={() => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))} />)}</Choices>
        <Choices theme={theme} label="时限">{DURATIONS.map(([k, l]) => <Choice key={k} theme={theme} label={l} on={duration === k} onPress={() => setDuration(k)} />)}</Choices>
        {/* .bt-browser-form-foot: right, 10px 12px, top line; the button is a default .bt-soft */}
        <Actions end style={{ paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 0.5, borderTopColor: theme.sep }}><Soft theme={theme} sm={false} title={busy ? '保存中…' : '添加'} disabled={busy || !chosen || kinds.length === 0} onPress={() => void add()} /></Actions>
      </Group>
    </>
  );
}
export { expired };
