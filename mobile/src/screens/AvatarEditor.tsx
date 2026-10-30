// 编辑 Bot 形象 = web bot-settings.js AvatarEditor: tabs Bot / 上传 / 头像库, plus 恢复默认.
// Bot: every shape and color tap saves. 上传: one photo, center-cropped to 160px like
// avatarImage(). 头像库: avatar-library / avatar-import / avatar-delete.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, ToastAndroid, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { AvatarEntry, Bot } from '../api';
import { Mark } from '../components/Avatar';
import { PillButton, RoundButton } from '../components/ui';
import { CHARACTER_COLORS, PICKER_SHAPES, hasShape, lookOf, ringXml, swatch, type Look } from '../avatar/mark';
import { useStore } from '../store';
import type { Theme } from '../theme';

const MAX = 150000;
/** web avatarImage(): center crop, 160px square, webp under 150 KB (then png). */
export async function avatarImage(asset: { uri: string; width: number; height: number }): Promise<string> {
  const crop = Math.min(asset.width, asset.height);
  const actions = [{ crop: { originX: (asset.width - crop) / 2, originY: (asset.height - crop) / 2, width: crop, height: crop } }, { resize: { width: 160, height: 160 } }];
  for (const compress of [0.9, 0.75, 0.6]) {
    const r = await manipulateAsync(asset.uri, actions, { compress, format: SaveFormat.WEBP, base64: true });
    const url = `data:image/webp;base64,${r.base64}`;
    if (r.base64 && url.length < MAX) return url;
  }
  const r = await manipulateAsync(asset.uri, actions, { format: SaveFormat.PNG, base64: true });
  const png = `data:image/png;base64,${r.base64}`;
  if (r.base64 && png.length < MAX) return png;
  throw new Error('图片太大了');
}
async function pickImages(multiple: boolean) {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, quality: 1 });
  return r.canceled ? [] : r.assets;
}
const toast = (e: any) => ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT);

export function AvatarEditorScreen({ theme, bot, onBack }: { theme: Theme; bot: Bot; onBack(): void }) {
  const { client, refresh } = useStore();
  const saved = lookOf(bot) as Look;
  const [pending, setPending] = useState<Partial<Look> & { cleared?: boolean } | null>(null);
  // Optimistic: what was tapped shows at once and settles when the saved Bot changes.
  useEffect(() => { setPending(null); }, [bot.avatar?.shape, bot.avatar?.image, bot.color]);
  const look: Look = pending?.cleared ? { shape: saved.shape, color: saved.color } : { ...saved, ...(pending ?? {}) };
  const [tab, setTab] = useState<'bot' | 'upload' | 'library'>(saved.image ? 'upload' : 'bot');
  const save = (patch: Record<string, unknown>, shown: Partial<Look> & { cleared?: boolean }) => {
    if (!client) return;
    setPending((p) => ({ ...(p ?? {}), ...shown }));
    client.updateBot(bot.id, patch).then(() => refresh()).catch((e) => { setPending(null); toast(e); });
  };
  const hasPhoto = Boolean(look.image);
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 36 - 5 * 8) / 6);
  const upload = async () => {
    try {
      const [asset] = await pickImages(false); if (!asset) return;
      const image = await avatarImage(asset);
      save({ avatar: { ...(bot.avatar ?? {}), image } }, { image });
    } catch (e) { toast(e); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <RoundButton theme={theme} icon="back" onPress={onBack} label="返回设置" />
        <Text style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '600', marginLeft: 8 }}>编辑 Bot 形象</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 18 }}><Mark look={look} size={88} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View accessibilityLabel="形象来源" style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.fill, borderRadius: 12, padding: 3 }}>
            {([['bot', 'Bot'], ['upload', '上传'], ['library', '头像库']] as const).map(([id, label]) => (
              <Pressable key={id} onPress={() => setTab(id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: tab === id ? theme.cardHi : 'transparent' }}>
                <Text style={{ color: tab === id ? theme.text : theme.sub, fontWeight: tab === id ? '600' : '400' }}>{label}</Text>
              </Pressable>))}
          </View>
          <Pressable accessibilityLabel="恢复默认形象" onPress={() => save({ avatar: null, color: null }, { cleared: true })} style={{ marginLeft: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: theme.sub }}>恢复默认</Text>
          </Pressable>
        </View>
        {tab === 'bot' ? (
          <>
            <View accessibilityLabel="形状" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {PICKER_SHAPES.map((id: string) => {
                const on = !hasPhoto && look.shape === id;
                return (
                  <Pressable key={id} onPress={() => save({ avatar: { shape: id } }, { shape: id, image: undefined })} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <View style={{ position: 'absolute', left: cell * 0.1 - cell * 0.8 * 0.08, top: cell * 0.1 - cell * 0.8 * 0.08 }}><SvgXml xml={ringXml(id, theme.text)} width={cell * 0.8 * 1.16} height={cell * 0.8 * 1.16} /></View> : null}
                    <Mark look={{ shape: id, color: look.color }} size={cell * 0.8} />
                  </Pressable>
                );
              })}
            </View>
            <View accessibilityLabel="颜色" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              {CHARACTER_COLORS.map((c: string) => (
                <Pressable key={c} onPress={() => save({ color: c }, { color: c })} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: look.color === c ? theme.text : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: swatch(c, theme.dark) }} />
                </Pressable>))}
            </View>
          </>
        ) : null}
        {tab === 'upload' ? (
          <View style={{ marginTop: 16, alignItems: 'center', padding: 22, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.fillBorder }}>
            {hasPhoto ? <Image source={{ uri: look.image }} style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12 }} /> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PillButton theme={theme} title={hasPhoto ? '替换' : '选择文件'} onPress={upload} />
              {hasPhoto ? <PillButton theme={theme} title="移除照片" onPress={() => { const shape = hasShape(bot.avatar?.shape) ? bot.avatar!.shape : undefined; save({ avatar: shape ? { shape } : null }, { image: undefined }); }} /> : null}
            </View>
          </View>
        ) : null}
        {tab === 'library' ? <LibraryPanel theme={theme} onPick={(e) => save({ avatar: { ...(bot.avatar ?? {}), image: e.image } }, { image: e.image })} /> : null}
      </ScrollView>
    </View>
  );
}

const CHUNK = 20;
function LibraryPanel({ theme, onPick }: { theme: Theme; onPick(e: AvatarEntry): void }) {
  const { client } = useStore();
  const [items, setItems] = useState<AvatarEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<{ imported: number; duplicates: number; failed: { name: string; message: string }[] } | null>(null);
  const load = useCallback(async (from = 0, append = false) => {
    if (!client) return;
    try {
      const v = await client.avatarLibrary(from);
      const page = v?.items ?? [];
      setItems((p) => (append ? [...(p ?? []), ...page] : page)); setTotal(v?.total ?? page.length); setOffset(v?.next ?? from + page.length);
    } catch (e: any) { setError(String(e?.message ?? e)); }
  }, [client]);
  useEffect(() => { void load(); }, [load]);
  const importPhotos = async () => {
    if (!client) return;
    const assets = await pickImages(true).catch((e) => { toast(e); return []; });
    if (!assets.length) return;
    setBusy(true); setError(''); setReport(null);
    const photos: { name: string; image: string }[] = []; const failed: { name: string; message: string }[] = [];
    for (const a of assets) {
      const name = a.fileName ?? '照片';
      try { photos.push({ name, image: await avatarImage(a) }); } catch (e: any) { failed.push({ name, message: String(e?.message ?? e) }); }
    }
    let imported = 0; let duplicates = 0;
    for (let i = 0; i < photos.length; i += CHUNK) {
      const chunk = photos.slice(i, i + CHUNK);
      try { const r = await client.avatarImport(chunk); imported += r?.imported?.length ?? 0; duplicates += r?.duplicates?.length ?? 0; failed.push(...(r?.failed ?? [])); }
      catch (e: any) { failed.push(...chunk.map((p) => ({ name: p.name, message: String(e?.message ?? e) }))); }
    }
    setReport({ imported, duplicates, failed });
    await load(); setBusy(false);
  };
  const remove = async (e: AvatarEntry) => {
    if (!client) return;
    setBusy(true); setError('');
    try { await client.avatarDelete(e.id); await load(); } catch (x: any) { setError(String(x?.message ?? x)); } finally { setBusy(false); }
  };
  const shown = items?.length ?? 0;
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ alignItems: 'flex-start' }}><PillButton theme={theme} title={busy ? '正在导入照片…' : '导入照片'} disabled={busy} onPress={importPhotos} /></View>
      {error ? <Text style={{ color: theme.danger, marginTop: 10 }}>{error}</Text> : null}
      {items === null ? <Text style={{ color: theme.sub, marginTop: 10 }}>加载中…</Text> : null}
      {items?.length === 0 && !error ? <Text style={{ color: theme.sub, marginTop: 10 }}>头像库还是空的。</Text> : null}
      {items?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {items.map((e) => <View key={e.id}>
          <Pressable accessibilityLabel="用这张照片" onPress={() => onPick(e)}><Image source={{ uri: e.image }} style={{ width: 64, height: 64, borderRadius: 32 }} /></Pressable>
          <Pressable accessibilityLabel="从头像库移除这张照片" onPress={() => void remove(e)} hitSlop={6} style={{ position: 'absolute', right: -4, top: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.sub, fontSize: 11 }}>✕</Text></Pressable>
        </View>)}
      </View> : null}
      {shown < total ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
        <PillButton theme={theme} title="显示更多照片" onPress={() => void load(offset, true)} />
        <Text style={{ color: theme.sub, fontSize: 12 }}>显示 {shown} / {total} 张照片</Text>
      </View> : null}
      {report ? <View style={{ marginTop: 12 }}>
        {report.imported ? <Text style={{ color: theme.sub }}>已导入 {report.imported} 张照片</Text> : null}
        {report.duplicates ? <Text style={{ color: theme.sub }}>有 {report.duplicates} 张照片已经在头像库里</Text> : null}
        {report.failed.map((f, i) => <Text key={i} style={{ color: theme.danger }}>{f.name || '照片'}：{f.message}</Text>)}
      </View> : null}
    </View>
  );
}
