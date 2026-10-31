// Minimal markdown: fenced code, headings, bullet/numbered lists, quotes, **bold**, *italic*, `code`, links (shown as text).
import React from 'react';
import { Linking, Text, View } from 'react-native';

type P = { text: string; color: string; codeBg: string; size?: number };

function inline(s: string, color: string, codeBg: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0; let m: RegExpExecArray | null; let n = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0]; const k = `${key}-${n++}`;
    if (tok.startsWith('`')) out.push(<Text key={k} style={{ fontFamily: 'monospace', backgroundColor: codeBg }}>{tok.slice(1, -1)}</Text>);
    else if (tok.startsWith('**')) out.push(<Text key={k} style={{ fontWeight: '700' }}>{tok.slice(2, -2)}</Text>);
    else if (tok.startsWith('[')) {
      const [, label, url] = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      out.push(<Text key={k} style={{ color: '#5b8cff', textDecorationLine: 'underline' }} onPress={() => /^https?:/.test(url) && Linking.openURL(url)}>{label}</Text>);
    } else out.push(<Text key={k} style={{ fontStyle: 'italic' }}>{tok.slice(1, -1)}</Text>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export const Markdown = React.memo(function Markdown({ text, color, codeBg, size = 16 }: P) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  const base = { color, fontSize: size, lineHeight: size + 10 };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      blocks.push(<View key={i} style={{ backgroundColor: codeBg, borderRadius: 8, padding: 10, marginVertical: 4 }}><Text selectable style={{ color, fontFamily: 'monospace', fontSize: size - 2 }}>{code.join('\n')}</Text></View>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { blocks.push(<Text key={i} style={[base, { fontWeight: '700', fontSize: size + (h[1].length <= 2 ? 3 : 1) }]}>{inline(h[2], color, codeBg, `${i}`)}</Text>); continue; }
    const li = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(l);
    if (li) {
      blocks.push(<View key={i} style={{ flexDirection: 'row', paddingLeft: 4 + li[1].length * 6 }}><Text style={base}>{/\d/.test(li[2]) ? li[2] + ' ' : '•  '}</Text><Text style={[base, { flex: 1 }]}>{inline(li[3], color, codeBg, `${i}`)}</Text></View>);
      continue;
    }
    if (l.startsWith('>')) { blocks.push(<Text key={i} style={[base, { opacity: 0.75, borderLeftWidth: 3, borderLeftColor: '#888', paddingLeft: 8 }]}>{inline(l.replace(/^>\s?/, ''), color, codeBg, `${i}`)}</Text>); continue; }
    if (!l.trim()) { blocks.push(<View key={i} style={{ height: 6 }} />); continue; }
    blocks.push(<Text key={i} selectable style={base}>{inline(l, color, codeBg, `${i}`)}</Text>);
  }
  return <View>{blocks}</View>;
});
