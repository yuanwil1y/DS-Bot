// web activity-row.js: the Bot's mark and a phrase at the transcript tail while it
// works and no reply text is streaming; a tool names itself, else a random phrase,
// each held ≥800ms, with the elapsed clock.
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Bot } from '../api';
import { PHRASES, elapsedLabel, workPhrase } from '../api/work';
import { Avatar } from './Avatar';
import type { Theme } from '../theme';

const draw = (pool: string[]) => pool[Math.min(pool.length - 1, Math.floor(Math.random() * pool.length))];

export function ActivityRow({ theme, bot, mark, visible, tool, at }: { theme: Theme; bot?: Bot; mark?: React.ReactNode; visible: boolean; tool?: any; at: number }) {
  const want = !visible ? null : tool?.tool || tool?.said || tool?.note ? { key: `tool:${workPhrase(tool)}`, label: workPhrase(tool), pool: PHRASES.working } : { key: 'thinking', label: '', pool: PHRASES.thinking };
  const [shown, setShown] = useState<{ key: string; text: string; at: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!want) { setShown(null); return; }
    if (shown?.key === want.key) return;
    const make = () => setShown({ key: want.key, text: want.label || draw(want.pool), at: Date.now() });
    const wait = shown ? shown.at + 800 - Date.now() : 0;
    if (wait <= 0) { make(); return; }
    const t = setTimeout(make, wait);
    return () => clearTimeout(t);
  }, [want?.key, shown]);
  useEffect(() => {
    if (!visible) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [visible]);
  if (!visible || !shown) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, marginLeft: 4 }}>
      {bot ? <Avatar bot={bot} size={28} /> : mark}
      <Text style={{ color: theme.sub, fontSize: 14, marginLeft: 8 }}>{`${shown.text}…`}</Text>
      <Text style={{ color: theme.faint, fontSize: 13, marginLeft: 6 }}>{`· ${elapsedLabel(Math.max(1000, now - at))}`}</Text>
    </View>
  );
}
