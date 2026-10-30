import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Theme } from '../theme';

export function Header({ theme, title, subtitle, onBack, right }: { theme: Theme; title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 56, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card }}>
      {onBack ? <Pressable onPress={onBack} hitSlop={12} style={{ padding: 8 }} android_ripple={{ borderless: true }}><Text style={{ color: theme.text, fontSize: 24 }}>‹</Text></Pressable> : <View style={{ width: 8 }} />}
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: theme.sub, fontSize: 12 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
