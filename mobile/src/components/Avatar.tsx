import React from 'react';
import { Image, Text, View, useColorScheme } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Bot } from '../api';
import { usePrefs } from '../prefs';
import { characterXml, lookOf, type Look } from '../avatar/mark';

function useDark() { const sys = useColorScheme(); const { theme } = usePrefs(); return theme === 'auto' ? sys !== 'light' : theme === 'dark'; }

/** The web's BotMark: the Bot's character (shape + color from lookOf), or its photo. */
export function Mark({ look, size }: { look: Look; size: number }) {
  const dark = useDark();
  if (look.image) return <Image source={{ uri: look.image }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return <SvgXml xml={characterXml(look.shape, look.color, dark)} width={size} height={size} />;
}

export function Avatar({ bot, size = 44, working, star, ring = '#111' }: { bot: Bot; size?: number; working?: boolean; star?: boolean; ring?: string }) {
  const look = lookOf(bot) as Look;
  const dot = Math.max(12, size * 0.3);
  return (
    <View style={{ width: size, height: size }}>
      <Mark look={look} size={size} />
      {star ? <View style={{ position: 'absolute', right: -2, bottom: -2, width: dot, height: dot, borderRadius: dot, backgroundColor: '#f59e0b', borderWidth: 2, borderColor: ring, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: dot * 0.5, lineHeight: dot * 0.62 }}>★</Text></View> : null}
      {working ? <View style={{ position: 'absolute', right: 0, top: 0, width: size * 0.26, height: size * 0.26, borderRadius: size, backgroundColor: '#34c759', borderWidth: 2, borderColor: ring }} /> : null}
    </View>
  );
}

/** Group: up to three member avatars stacked, like the Grok list. */
export function GroupAvatar({ members, size = 44, working, ring = '#111' }: { members: Bot[]; size?: number; working?: boolean; ring?: string }) {
  const m = members.slice(0, 3); const s = size * 0.58;
  const pos = [{ left: size * 0.2, top: 0 }, { left: 0, top: size - s }, { left: size - s, top: size - s }];
  return (
    <View style={{ width: size, height: size }}>
      {m.map((b, i) => <View key={b.id} style={{ position: 'absolute', ...pos[i], borderRadius: s, borderWidth: 1.5, borderColor: ring }}><Avatar bot={b} size={s - 3} /></View>)}
      {working ? <View style={{ position: 'absolute', right: 0, top: 0, width: size * 0.26, height: size * 0.26, borderRadius: size, backgroundColor: '#34c759', borderWidth: 2, borderColor: ring }} /> : null}
    </View>
  );
}
