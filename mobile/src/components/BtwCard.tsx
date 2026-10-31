// btw.js BtwCardView: an earlier /btw aside. Read-only; folds open/closed; ✕ deletes it.
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './ui';
import { Markdown } from './Markdown';
import type { Theme } from '../theme';

const clock = (ms?: number) => { if (!Number.isFinite(ms)) return ''; const d = new Date(ms!); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function BtwCard({ theme, card, onDelete }: { theme: Theme; card: any; onDelete(): Promise<any> }) {
  const [open, setOpen] = useState(card?.status !== 'answering');
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (card?.status && card.status !== 'answering') setOpen(true); }, [card?.status]);
  const answer = typeof card.answer === 'string' ? card.answer : '';
  const raw = typeof card.error === 'string' ? card.error : card.error?.message;
  const fail = typeof raw === 'string' && raw.trim() ? raw.trim() : '没能答上。';
  const when = Number.isFinite(card.finishedAt) ? card.finishedAt : card.createdAt;
  return (
    <View accessibilityLabel="侧边对话" style={{ backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.fillBorder, padding: 12, marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ marginRight: 6, transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" color={theme.sub} size={14} /></View>
          <Text numberOfLines={open ? undefined : 1} style={{ flex: 1, color: theme.text, fontWeight: '600' }}>{card.question ?? ''}</Text>
        </Pressable>
        {when ? <Text style={{ color: theme.faint, fontSize: 12 }}>{clock(when)}</Text> : null}
        {card.status === 'answering' ? <Text style={{ color: theme.sub, fontSize: 12 }}>正在回答…</Text> : null}
        {card.status === 'cancelled' ? <Text style={{ color: theme.sub, fontSize: 12 }}>已取消</Text> : null}
        <Pressable disabled={deleting} hitSlop={10} accessibilityLabel="删除侧边对话" onPress={() => { setDeleting(true); onDelete().then((r) => { if (!r?.deleted) setDeleting(false); }, () => setDeleting(false)); }}>
          <View style={{ opacity: deleting ? 0.4 : 1 }}><Icon name="close" color={theme.sub} size={16} /></View>
        </Pressable>
      </View>
      <Text style={{ color: theme.faint, fontSize: 12, marginTop: 4 }}>基于目前已有进展的回答，没有执行任何操作</Text>
      {open ? <View style={{ marginTop: 6 }}>
        {card.status === 'failed' ? <Text style={{ color: theme.danger, fontSize: 13 }}>{fail}</Text> : null}
        {answer ? <Markdown text={answer} color={theme.text} codeBg={theme.code} size={14} /> : null}
      </View> : null}
    </View>
  );
}
