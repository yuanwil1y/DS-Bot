import React from 'react';
import { Image, Text, View } from 'react-native';
import type { Bot } from '../api';
import { botColor } from '../theme';

const shapes: Record<string, string> = { whale: '🐋', cat: '🐱', dog: '🐶', fox: '🦊', owl: '🦉', robot: '🤖', star: '⭐' };

export function Avatar({ bot, size = 44, working }: { bot: Bot; size?: number; working?: boolean }) {
  const bg = botColor(bot.color, bot.id);
  const img = bot.avatar?.image;
  const glyph = bot.avatar?.shape ? shapes[bot.avatar.shape] : undefined;
  return (
    <View style={{ width: size, height: size }}>
      {img ? (
        <Image source={{ uri: img }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: size * (glyph ? 0.5 : 0.42), fontWeight: '600' }}>{glyph ?? bot.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      {working ? <View style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' }} /> : null}
    </View>
  );
}
