import { Icon } from './ui';
// learning-card.js ProposalCard: a skill or AGENTS.md change the Bot wants to keep.
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Theme } from '../theme';
import { editLines, lineDiff, type DiffRow } from '../vendor/dsbot/learning-model';

const COLLAPSE_ROWS = 8;
const SIGNS = { added: '+', removed: '\u2212', same: '' } as const;
const STATE = { Added: '新增', Modified: '已修改', Updated: '已更新' } as const;
const failedAnswers = new Map<string, string>();

function FileBox({ theme, name, path, state, blocks }: { theme: Theme; name: string; path?: string; state: keyof typeof STATE; blocks: DiffRow[][] }) {
  const [open, setOpen] = useState(false);
  const all = blocks.flat();
  const added = all.filter((r) => r.kind === 'added').length;
  const removed = all.filter((r) => r.kind === 'removed').length;
  const folds = all.length > COLLAPSE_ROWS;
  const shut = folds && !open;
  let shown = 0;
  return (
    <View style={{ marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.fillBorder, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.fill, gap: 6 }}>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', fontFamily: 'monospace' }}>{name}</Text>
        {path ? <Text style={{ color: theme.sub, fontSize: 12, fontFamily: 'monospace', flexShrink: 1 }} numberOfLines={1}>{path}</Text> : null}
        <View style={{ flex: 1 }} />
        {added > 0 ? <Text style={{ color: '#3fb950', fontSize: 12 }}>+{added}</Text> : null}
        {removed > 0 ? <Text style={{ color: '#f85149', fontSize: 12 }}>{`\u2212${removed}`}</Text> : null}
        <Text style={{ color: theme.sub, fontSize: 12 }}>{STATE[state]}</Text>
      </View>
      <View>
        {blocks.map((rows, b) => <View key={b}>
          {b > 0 ? <View style={{ height: 8, backgroundColor: theme.fill }} /> : null}
          {rows.map((row, i) => { if (shut && shown >= COLLAPSE_ROWS) return null; shown++; return (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: row.kind === 'added' ? 'rgba(63,185,80,0.15)' : row.kind === 'removed' ? 'rgba(248,81,73,0.15)' : 'transparent', paddingHorizontal: 6 }}>
              <Text style={{ width: 28, color: theme.faint, fontSize: 11, fontFamily: 'monospace', textAlign: 'right', marginRight: 4 }}>{row.number ?? ''}</Text>
              <Text style={{ width: 12, color: theme.sub, fontSize: 12, fontFamily: 'monospace' }}>{SIGNS[row.kind]}</Text>
              <Text style={{ flex: 1, color: theme.text, fontSize: 12, fontFamily: 'monospace' }}>{row.line || '\u00a0'}</Text>
            </View>); })}
        </View>)}
      </View>
      {folds ? <Pressable onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} style={{ paddingVertical: 6, alignItems: 'center', backgroundColor: theme.fill }}>
        <Text style={{ color: theme.sub, fontSize: 12 }}>{open ? '收起' : `展开全部 ${all.length} 行`}</Text></Pressable> : null}
    </View>
  );
}

export function LearningCard({ theme, proposal, onAnswer }: { theme: Theme; proposal: any; onAnswer(approve: boolean): Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failedAnswers.get(proposal.id) ?? '');
  const busyRef = useRef(false);
  const answer = (approve: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    void Promise.resolve().then(() => onAnswer(approve)).then(() => { failedAnswers.delete(proposal.id); }, (e) => { const m = e?.message ?? String(e); failedAnswers.set(proposal.id, m); setError(m); })
      .finally(() => { busyRef.current = false; setBusy(false); });
  };
  const update = proposal.action === 'update';
  const rows = useMemo(() => lineDiff(update ? proposal.previous?.content : '', proposal.content), [update, proposal.previous?.content, proposal.content]);
  const agents = proposal.kind === 'agents';
  const blocks: DiffRow[][] = agents ? (proposal.edits ?? []).map((e: any) => [
    ...(e.op === 'add' ? [] : editLines(e.old)).map((line) => ({ kind: 'removed' as const, line })),
    ...(e.op === 'remove' ? [] : editLines(e.text)).map((line) => ({ kind: 'added' as const, line })),
  ]) : [rows];
  const oldDetail = !agents && update && typeof proposal.previous?.description === 'string' && proposal.previous.description !== proposal.description ? proposal.previous.description : undefined;
  const whys: string[] = agents ? (proposal.edits ?? []).map((e: any) => e.why).filter(Boolean) : proposal.why ? [proposal.why] : [];
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.fillBorder, padding: 14, marginVertical: 6, opacity: busy ? 0.7 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ marginRight: 10 }}><Icon name={agents ? 'pencil' : 'memory'} color={theme.text} size={18} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{agents ? 'AGENTS.md 更新' : proposal.name}</Text>
          {!agents ? <Text style={{ color: theme.sub, fontSize: 13, marginTop: 2 }}>{update ? '技能更新' : '新技能'}</Text> : null}
          {oldDetail ? <Text style={{ color: theme.faint, fontSize: 13, marginTop: 4, textDecorationLine: 'line-through' }}>{oldDetail}</Text> : null}
          {!agents && proposal.description ? <Text style={{ color: theme.sub, fontSize: 13, marginTop: 4 }}>{proposal.description}</Text> : null}
        </View>
        <Text style={{ color: theme.sub, fontSize: 12, marginLeft: 6 }}>● 等待批准</Text>
      </View>
      {agents ? <FileBox theme={theme} name="AGENTS.md" path={proposal.folder} state={proposal.exists === false ? 'Added' : 'Modified'} blocks={blocks} />
        : <FileBox theme={theme} name="SKILL.md" path={`skills/${proposal.name}`} state={update ? 'Updated' : 'Added'} blocks={blocks} />}
      {whys.map((w, i) => <Text key={i} style={{ color: theme.sub, fontSize: 13, marginTop: 8 }}>{w}</Text>)}
      {error ? <Text style={{ color: theme.danger, fontSize: 13, marginTop: 6 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
        <Pressable disabled={busy} onPress={() => answer(false)} style={{ paddingHorizontal: 16, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: theme.fill }}><Text style={{ color: theme.text, fontSize: 14 }}>拒绝</Text></Pressable>
        <Pressable disabled={busy} onPress={() => answer(true)} style={{ paddingHorizontal: 16, minHeight: 34, paddingVertical: 6, borderRadius: 17, justifyContent: 'center', backgroundColor: theme.text }}><Text style={{ color: theme.bg, fontSize: 14, fontWeight: '600' }}>✓ 批准</Text></Pressable>
      </View>
    </View>
  );
}
