// Popup menu (web UI dropdowns). Items without an API show '接口尚未实现'; phone-impossible ones '移动端暂未实现'.
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import type { Theme } from '../theme';

export const NA = '接口尚未实现';
export const NA_MOBILE = '移动端暂未实现';
export type MenuItem = { label: string; onPress?: () => void; checked?: boolean; sep?: boolean; na?: string };

export function Menu({ theme, visible, onClose, items, top = 64, right = 16, left, bottom }: { theme: Theme; visible: boolean; onClose(): void; items: MenuItem[]; top?: number; right?: number; left?: number; bottom?: number }) {
  const pos = bottom != null ? { bottom, left: left ?? 16 } : left != null ? { top, left } : { top, right };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <View style={{ position: 'absolute', ...pos, backgroundColor: theme.cardHi, borderRadius: 18, minWidth: 220, overflow: 'hidden', paddingVertical: 4 }}>
          {items.map((o, i) => (
            <React.Fragment key={o.label + i}>
              {o.sep ? <View style={{ height: 1, backgroundColor: theme.sep, marginHorizontal: 14, marginVertical: 4 }} /> : null}
              <Pressable disabled={!o.onPress} onPress={() => { onClose(); o.onPress?.(); }} android_ripple={{ color: theme.fill }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 }}>
                <Text style={{ flex: 1, color: o.onPress ? theme.text : theme.faint, fontSize: 16 }}>{o.label}</Text>
                {o.checked ? <Text style={{ color: theme.text }}>✓</Text> : null}
                {!o.onPress ? <Text style={{ color: theme.faint, fontSize: 11, marginLeft: 10 }}>{o.na ?? NA}</Text> : null}
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
