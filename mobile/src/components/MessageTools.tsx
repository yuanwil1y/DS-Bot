// A Bot reply's toolbar (ds-bot 0.2.4 cells.js 56-142, styles.js 639-667 / touch 1074-1077).
// Touch has no hover: a tap on the bubble opens it (data-open), a tap elsewhere or on the
// bubble again closes it. 添加表情 opens the six-emoji strip, 回复 quotes the text into the
// composer, 更多 opens 复制 / 下载. Reactions are kept on this device only, as the web keeps
// them in localStorage (index.js toggleReaction, shared-map.js); no server API is involved.
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { Theme } from '../theme';
import { Icon } from './ui';
import { Menu } from './Menu';

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// reactions: { [message key]: [emoji…] } (web: { [key]: { [bubble index]: [emoji…] } }; one bubble per row here).
type Reactions = Record<string, string[]>;
const store = () => new File(Paths.document, 'ds-bot-reactions.json');
let cache: Reactions | null = null;
const subs = new Set<(r: Reactions) => void>();
function load(): Reactions {
  if (cache) return cache;
  try { const f = store(); cache = f.exists ? JSON.parse(f.textSync()) : {}; } catch { cache = {}; }
  return cache!;
}
export function toggleReaction(key: string, emoji: string) {
  const next = { ...load() };
  const list = next[key] ?? [];
  next[key] = list.includes(emoji) ? list.filter((e) => e !== emoji) : [...list, emoji];
  if (next[key].length === 0) delete next[key];
  cache = next;
  try { store().write(JSON.stringify(next)); } catch { /* best effort, as localStorage */ }
  subs.forEach((f) => f(next));
}
export function useReactions(): Reactions {
  const [r, setR] = useState<Reactions>(load);
  useEffect(() => { subs.add(setR); return () => { subs.delete(setR); }; }, []);
  return r;
}

// .bt-reacts / .bt-react: 22px chips under the bubble; a tap removes that reaction.
export function ReactionChips({ theme, picked, onToggle, indent }: { theme: Theme; picked: string[]; onToggle(e: string): void; indent?: number }) {
  if (!picked.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, marginLeft: indent ?? 0 }}>
      {picked.map((e) => (
        <Pressable key={e} onPress={() => onToggle(e)} accessibilityLabel={`移除回应 ${e}`} hitSlop={{ top: 11, bottom: 11 }}
          style={({ pressed }) => ({ height: 22, minWidth: 30, paddingHorizontal: 6, borderRadius: 999, borderWidth: 0.5, borderColor: theme.border, backgroundColor: pressed ? theme.hover : theme.bg, alignItems: 'center', justifyContent: 'center' })}>
          <Text style={{ fontSize: 13, lineHeight: 20 }}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type VRef = React.ComponentRef<typeof View>;
type Rect = { x: number; y: number; w: number; h: number };
const measure = (ref: React.RefObject<VRef | null>) => new Promise<Rect>((res) => ref.current?.measureInWindow((x: number, y: number, w: number, h: number) => res({ x, y, w, h })));
const STRIP_W = REACTIONS.length * 32 + (REACTIONS.length - 1) * 2 + 8;
const STRIP_HALF = STRIP_W / 2 + 8;

// The floating pill (touch .bt-tools: right 4px, radius 999, padding 2, card fill, .5px
// line-2 ring and shadow; 44px targets with the 15px glyphs). Bubble layout centers it
// on the bubble row; flat layout floats it 14px over the message's top right.
export function MessageTools({ theme, text, name, flat, onReact, onReply, onPanel }: { theme: Theme; text: string; name: string; flat: boolean; onReact?: (e: string) => void; onReply?: () => void; onPanel?: (open: boolean) => void }) {
  const [panel, setPanel] = useState<null | { kind: 'react' | 'more'; r: Rect }>(null);
  const [copied, setCopied] = useState(false);
  const smile = useRef<VRef>(null);
  const more = useRef<VRef>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { onPanel?.(panel !== null); }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async (kind: 'react' | 'more') => {
    if (panel?.kind === kind) { setPanel(null); return; }
    const r = await measure(kind === 'react' ? smile : more);
    setPanel({ kind, r });
  };
  const copy = () => {
    Clipboard.setStringAsync(text).then(() => { setCopied(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1000); }).catch(() => {});
  };
  // web: a Blob saved as `${name}-message.md` (text/markdown). The phone's equivalent:
  // the same file written to the cache and handed to the system share sheet (save/send).
  const download = async () => {
    try {
      const f = new File(Paths.cache, `${name.replace(/[\\/:*?"<>|]/g, '_')}-message.md`);
      f.write(text);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'text/markdown', dialogTitle: '下载' });
      else ToastAndroid.show('移动端暂未实现', ToastAndroid.SHORT);
    } catch (e: any) { ToastAndroid.show(String(e?.message ?? e), ToastAndroid.SHORT); }
  };
  const { width: W, height: H } = Dimensions.get('window');
  const btn = (ref: React.RefObject<VRef | null> | null, label: string, icon: string, onPress: () => void, expanded?: boolean) => (
    <View ref={ref ?? undefined} collapsable={false}>
      <Pressable onPress={onPress} accessibilityLabel={label} accessibilityState={expanded !== undefined ? { expanded } : undefined}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? theme.active : expanded ? theme.hover : 'transparent' })}>
        <Icon name={icon} color={expanded ? theme.text : theme.sub} size={15} />
      </Pressable>
    </View>
  );
  const pill = (
    <View style={{ flexDirection: 'row', gap: 2, padding: 2, borderRadius: 999, backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
      {onReact ? btn(smile, '添加表情', 'smile', () => open('react'), panel?.kind === 'react') : null}
      {onReply ? btn(null, '回复', 'reply', onReply) : null}
      {btn(more, '更多消息操作', copied ? 'checkLine' : 'dots', () => open('more'), panel?.kind === 'more')}
    </View>
  );
  // cells.js place(): the strip hangs centered over 添加表情, clamped to the screen; the
  // menu opens below 更多 when 220px fit, else above, its left kept 208px from the right.
  const r = panel?.r;
  const below = r ? r.y + r.h + 220 < H : true;
  const cx = r ? Math.min(Math.max(r.x + r.w / 2, STRIP_HALF), W - STRIP_HALF) : 0;
  return (
    <>
      {flat
        ? <View pointerEvents="box-none" style={{ position: 'absolute', top: -14, right: 0 }}>{pill}</View>
        : <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, right: 4, justifyContent: 'center' }}>{pill}</View>}
      <Modal visible={panel?.kind === 'react'} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <Pressable style={{ flex: 1 }} onPress={() => setPanel(null)}>
          {r ? <View style={{ position: 'absolute', left: cx - STRIP_W / 2, top: r.y - 6 - 52, flexDirection: 'row', gap: 2, padding: 4, borderRadius: 999, backgroundColor: theme.bg, borderWidth: 0.5, borderColor: theme.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
            {REACTIONS.map((e) => (
              <Pressable key={e} accessibilityLabel={e} onPress={() => { setPanel(null); onReact?.(e); }} style={({ pressed }) => ({ width: 32, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? theme.hover : 'transparent' })}>
                <Text style={{ fontSize: 18, lineHeight: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View> : null}
        </Pressable>
      </Modal>
      <Menu theme={theme} scrim={false} visible={panel?.kind === 'more'} onClose={() => setPanel(null)}
        left={r ? Math.min(r.x, W - 208) : 16} {...(below ? { top: r ? r.y + r.h + 4 : 0 } : { bottom: r ? H - r.y + 4 : 0 })}
        items={[{ label: '复制', icon: 'copy', onPress: copy }, { label: '下载', icon: 'download', onPress: () => { void download(); } }]} />
    </>
  );
}
