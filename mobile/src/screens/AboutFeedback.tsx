// Settings → 关于 DS Bot (about.js AboutPage), 反馈 (feedback.js FeedbackPage) and the
// 删除后仍受保护 section (kept-private.js KeptPrivateSection), as on the 0.2.4 web.
// The phone installs nothing: where the web offers Update / Restart, the row says so.
import React, { useEffect, useState } from 'react';
import { useFT } from '../featureTest'; // TEST-ONLY
import { Linking, Pressable, ScrollView, Text, TextInput, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Group, Row } from '../components/ui';
import { Mark } from '../components/Avatar';
import { MAIN_LOOK } from '../avatar/characters';
import { NA_MOBILE } from '../components/Menu';
import { useStore } from '../store';
import { loadLastError, clearLastError } from '../errors';
import { APP_VERSION } from '../version';
import { failureLabel, issueUrl, starCount, whenText, WHAT_MAX, botHint, dshHint } from '../api/aboutModel';
import type { Theme } from '../theme';

const show = (m: string) => ToastAndroid.show(m, ToastAndroid.SHORT);
const errText = (e: any) => String(e?.message ?? e);

export function Soft({ theme, title, onPress, disabled, primary, danger }: { theme: Theme; title: string; onPress?: () => void; disabled?: boolean; primary?: boolean; danger?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} hitSlop={4} style={({ pressed }) => ({ marginLeft: 8, height: 30, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', backgroundColor: primary ? theme.accent : theme.cardHi, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}>
      <Text style={{ color: primary ? theme.accentText : danger ? theme.danger : theme.text, fontSize: 13 }}>{title}</Text>
    </Pressable>
  );
}

export function AboutPage({ theme, onFeedback }: { theme: Theme; onFeedback(): void }) {
  const { client } = useStore();
  const [update, setUpdate] = useState<any>({});
  const [stars, setStars] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let live = true;
    client?.repoStars().then((n) => { if (live && Number.isInteger(n)) setStars(n); }, () => {});
    client?.updateCheck(false).then((u) => { if (live && u) setUpdate(u); }, () => {});
    return () => { live = false; };
  }, [client]);
  const check = () => {
    setChecking(true);
    client!.updateCheck(true).then((u) => setUpdate(u ?? {}), (e) => show(errText(e))).finally(() => setChecking(false));
  };
  useFT('about.check', () => check()); // TEST-ONLY
  const phase = update.phase ?? 'idle';
  const dsh = update.dsh;
  const repo: string | undefined = update.repoUrl;
  const open = (url: string) => Linking.openURL(url).catch((e) => show(errText(e)));
  // Web shows Update / Try again (update-install) here; the phone does not install.
  const installable = update.source !== 'app' && phase !== 'installed' && phase !== 'updated' && (update.available || phase === 'installing');
  const botControl = update.source === 'app' || phase === 'installed' || phase === 'updated' ? null
    : installable ? <Soft theme={theme} title={`更新 · ${NA_MOBILE}`} disabled />
      : <Soft theme={theme} title={checking ? '正在检查…' : '检查更新'} disabled={checking || update.enabled === false} onPress={check} />;
  const dshAvail = !!dsh?.available;
  return <>
    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
      <Mark look={MAIN_LOOK as any} size={52} state={checking ? 'searching' as any : 'idle'} live pokeable id="about" />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22, fontWeight: '600' }}>DS Bot</Text>
        {update.current ? <Text style={{ color: theme.sub, fontSize: 12, lineHeight: 16 }}>{`版本 ${update.current}`}</Text> : null}
        <Text style={{ color: theme.faint, fontSize: 12, lineHeight: 16 }}>{`手机应用 ${APP_VERSION}`}</Text>
      </View>
      {repo ? <Pressable onPress={() => open(repo)} style={{ flexDirection: 'row', height: 30, borderRadius: 999, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
        <View style={{ paddingLeft: 10, paddingRight: 12, justifyContent: 'center', backgroundColor: theme.cardHi }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '500' }}>☆ Star</Text></View>
        {stars === null ? null : <View style={{ paddingHorizontal: 11, justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: theme.border }}><Text style={{ color: theme.sub, fontSize: 12 }}>{starCount(stars)}</Text></View>}
      </Pressable> : null}
    </View>
    {repo ? <Text style={{ color: theme.faint, fontSize: 12, lineHeight: 16, marginHorizontal: 22, marginTop: 8 }}>如果 DS Bot 对你有用，欢迎在 GitHub 上点个 Star，让更多人看到它。</Text> : null}
    <Group theme={theme} title="更新">
      <Row theme={theme} label="DS Bot" caption={botHint(update) ?? undefined} right={<>{botControl}{update.available && update.notesUrl ? <Soft theme={theme} title="更新说明" onPress={() => open(update.notesUrl)} /> : null}</>} />
      {dsh?.current ? <Row theme={theme} label="DeepSeek Harness" caption={dshHint(dsh, dshAvail)} right={dshAvail && dsh.phase !== 'installed' ? <Soft theme={theme} title={`更新 · ${NA_MOBILE}`} disabled /> : null} /> : null}
    </Group>
    <Group theme={theme} title="链接">
      {repo ? <Row theme={theme} label="源代码" caption={repo.replace(/^https:\/\//, '')} right={<Soft theme={theme} title="打开" onPress={() => open(repo)} />} /> : null}
      {update.notesUrl ? <Row theme={theme} label="发布说明" right={<Soft theme={theme} title="打开" onPress={() => open(update.notesUrl)} />} /> : null}
      <Row theme={theme} label="报告问题" right={<Soft theme={theme} title="打开" onPress={onFeedback} />} />
    </Group>
  </>;
}

const SOURCES: Record<string, string> = { turn: '模型调用', host: 'DS Bot', api: 'DS Bot', browser: '这个应用' };

export function FeedbackPage({ theme }: { theme: Theme }) {
  const { client } = useStore();
  const [what, setWhat] = useState('');
  const [report, setReport] = useState<any>(null);
  const [preview, setPreview] = useState(false);
  const [note, setNote] = useState('');
  const [local, setLocal] = useState<any[]>([]);
  // clientFacts / clientErrors: this app, and the last JS error it kept (errors.tsx).
  const fetchReport = async () => {
    const last = await loadLastError();
    const errs = last ? [{ time: last.time, level: 'error', text: `${last.where}: ${last.message}` }] : [];
    setLocal(errs);
    const next = await client!.diagnostics({ client: { surface: `DS Bot Android ${APP_VERSION}`, language: 'zh-CN', userAgent: `ds-bot-mobile/${APP_VERSION} (Android)` }, clientErrors: errs });
    setReport(next);
    return next;
  };
  const run = (p: Promise<unknown>) => p.catch((e) => show(errText(e)));
  useEffect(() => { void run(fetchReport()); }, [client]);
  const copy = (text: string) => Clipboard.setStringAsync(text).then(() => true, () => false);
  const copyReport = () => run(fetchReport().then(async (next) => {
    const ok = await copy(next.markdown);
    setNote(ok ? '已复制诊断信息。' : '无法复制。请选中下面的文字手动复制。');
    if (!ok) setPreview(true);
  }));
  const openIssue = () => run(fetchReport().then(async (next) => {
    const copied = await copy(next.markdown);
    const { url, inline } = issueUrl(next.issuesUrl, { what, diagnostics: next.markdown });
    await Linking.openURL(url);
    setNote(inline ? '已打开新的 GitHub issue，诊断信息已填好。提交前请检查一遍。'
      : copied ? '已打开新的 GitHub issue。诊断信息太长，已复制到剪贴板，请粘贴到 issue 里。' : '已打开新的 GitHub issue。请把下面的诊断信息复制进去。');
    if (!inline && !copied) setPreview(true);
  }));
  // Web downloads ds-bot-diagnostics.log; the phone hands the same file to the share sheet.
  const downloadLog = () => run(client!.diagnosticsLog().then(async (text) => {
    const f = new File(Paths.cache, 'ds-bot-diagnostics.log');
    if (f.exists) f.delete();
    f.create(); f.write(text || 'No entries.\n');
    await Sharing.shareAsync(f.uri, { mimeType: 'text/plain', dialogTitle: 'ds-bot-diagnostics.log' });
    setNote('已下载日志。里面的密钥、令牌和用户目录都已隐藏。');
  }));
  const clearLog = () => run(client!.diagnosticsClear().then(() => clearLastError()).then(fetchReport).then(() => setNote('已清空错误日志。')));
  const browser = report ? local.map((e) => ({ ...e, source: 'browser' })) : [];
  const entries = [...(report?.entries ?? []), ...browser].sort((a, b) => +new Date(b.time) - +new Date(a.time));
  const total = (report?.total ?? 0) + browser.length;
  return <>
    <Group theme={theme} title="报告问题">
      <View style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
        <Text style={{ color: theme.text, fontSize: 17 }}>发生了什么？</Text>
        <Text style={{ color: theme.sub, fontSize: 13, marginTop: 3 }}>你做了什么、期望什么、实际发生了什么。会写进 issue。</Text>
        <TextInput value={what} onChangeText={setWhat} maxLength={WHAT_MAX} multiline placeholder="例如：我在群聊里问 Writer，它显示出错了。" placeholderTextColor={theme.faint}
          style={{ marginTop: 8, minHeight: 80, color: theme.text, fontSize: 16, backgroundColor: theme.cardHi, borderRadius: 12, padding: 10, textAlignVertical: 'top' }} />
      </View>
      <Row theme={theme} label="诊断信息" caption="版本、系统、模型和最近的错误。已保存的密钥、令牌和你的用户目录都已隐藏。" right={<><Soft theme={theme} title={preview ? '收起' : '查看'} onPress={() => setPreview(!preview)} /><Soft theme={theme} title="复制" onPress={copyReport} /></>} />
      {preview ? <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }}><Text selectable style={{ color: theme.sub, fontSize: 11, lineHeight: 16, fontFamily: 'monospace', paddingHorizontal: 12, paddingVertical: 10 }}>{report?.markdown || '加载中…'}</Text></ScrollView> : null}
      <Row theme={theme} label="GitHub issue" caption="在 DS Bot 仓库新建一个 issue，并填好以上内容。你在 GitHub 上提交之前，什么都不会发出。" right={<Soft theme={theme} primary title="在 GitHub 上报告" onPress={openIssue} />} />
    </Group>
    {note ? <Text style={{ color: theme.sub, fontSize: 13, marginHorizontal: 22, marginTop: 8 }}>{note}</Text> : null}
    <Group theme={theme} title={report ? `最近的错误 · ${total}` : '最近的错误'}>
      {entries.length === 0 ? <Row theme={theme} label="没有错误记录。" caption="模型调用失败和 DS Bot 的问题会显示在这里，最新的在前。" />
        : entries.slice(0, 8).map((e, i) => <View key={`${e.time}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingVertical: 12 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, marginRight: 10, backgroundColor: e.level === 'warn' ? '#e3a008' : theme.danger }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ color: theme.text, fontSize: 15 }}>{e.source === 'turn' ? failureLabel(e.code, e.text) : e.text}</Text>
            <Text style={{ color: theme.sub, fontSize: 13, marginTop: 3 }}>{[whenText(e.time), e.bot, e.where, SOURCES[e.source] ?? 'DS Bot'].filter(Boolean).join(' · ')}</Text>
          </View>
          {e.code ? <Text style={{ color: theme.sub, fontSize: 11, fontFamily: 'monospace', marginLeft: 8, marginTop: 3 }}>{e.status ? `${e.code} ${e.status}` : e.code}</Text> : null}
        </View>)}
      <Row theme={theme} label="错误日志" caption="保存在这台电脑上，重启后仍在，最多约 1 MB。" right={<><Soft theme={theme} title="下载" onPress={downloadLog} /><Soft theme={theme} title="清空" disabled={!report || total === 0} onPress={clearLog} /></>} />
    </Group>
  </>;
}

export function KeptPrivateSection({ theme }: { theme: Theme }) {
  const { client, state, refresh } = useStore();
  const kept: { id: string; name: string; workDir?: string }[] = (state as any)?.privateArchives ?? [];
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (confirming === null) return undefined;
    const timer = setTimeout(() => setConfirming(null), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);
  if (kept.length === 0) return null;
  const release = (id: string) => {
    if (confirming !== id) { setConfirming(id); return; }
    setConfirming(null);
    client!.privateRelease(id).then(refresh, (e) => show(errText(e)));
  };
  return <Group theme={theme} title={`删除后仍受保护 · ${kept.length}`}>
    {kept.map((e) => <Row key={e.id} theme={theme} label={e.name} caption={confirming === e.id ? '再点一次解除。其他 Bot 之后可以读取它的文件夹、记忆和对话。' : e.workDir}
      right={<Soft theme={theme} title="解除保护" danger={confirming === e.id} onPress={() => release(e.id)} />} />)}
  </Group>;
}
