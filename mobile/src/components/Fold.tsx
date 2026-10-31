// fold.js useFold + the .bt-fold control (显示全部 · N 字 / 收起) under a message.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { foldView, type Folded, type Limit, type Whole } from '../api/fold';
import type { Theme } from '../theme';

export function useFold(text: string, opts: { limit?: Limit; whole?: Whole; live?: boolean; markdown?: boolean } = {}): Folded & { toggle(): void } {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<'loading' | { text?: string; whole?: boolean } | undefined>();
  const view = foldView(text, { open, read }, opts);
  const cut = opts.whole !== undefined && opts.whole.length > text.length;
  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!cut || read !== undefined || opts.whole?.load === undefined) return;
    setRead('loading');
    setRead((await opts.whole.load().catch(() => undefined)) ?? { whole: false });
  };
  return { ...view, toggle };
}

export function FoldControl({ theme, f, ink }: { theme: Theme; f: Folded & { toggle(): void }; ink?: string }) {
  if (!f.more && !f.less) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
      {f.note ? <Text style={{ color: ink ?? theme.sub, opacity: ink ? 0.7 : 1, fontSize: 12, lineHeight: 16, marginRight: 10 }}>{f.note}</Text> : null}
      <Pressable onPress={f.toggle} hitSlop={8}><Text style={{ color: ink ?? theme.sub, opacity: ink ? 0.7 : 1, fontSize: 12, lineHeight: 16, paddingVertical: 2 }}>{f.more ?? '收起'}</Text></Pressable>
    </View>
  );
}

/** A Bot's text, folded as cells.js Bubble does; `whole` reads a long group post via file-text. */
export function FoldMarkdown({ theme, text, streaming, limit, whole, render }: { theme: Theme; text: string; streaming?: boolean; limit?: Limit; whole?: Whole; render(text: string): React.ReactNode }) {
  const f = useFold(text, { limit, whole, live: streaming });
  return <>{render(f.shown)}<FoldControl theme={theme} f={f} /></>;
}
/** The user's text (user-message.js: plain, FOLD_AT). */
export function FoldPlain({ theme, text, ink, render }: { theme: Theme; text: string; ink: string; render(text: string): React.ReactNode }) {
  const f = useFold(text, { markdown: false });
  return <>{render(f.shown)}<FoldControl theme={theme} f={f} ink={ink} /></>;
}
