// Popup menu, drawn like the web's .bt-menu (ds-bot 0.2.4 styles.js 674-683, touch 1077):
// card padding 6, radius 12, min-width 200, 2px gaps, .5px line-2 border and the soft
// shadow; rows 6/8 padding, 44px min (touch), 16px icon, 13/18 label on one line with
// an ellipsis, a 12px light flex:none hint (.bt-menu-hint) after it. The card sizes to
// its content and never clips. Items without an API show '接口尚未实现' as that hint;
// phone-impossible ones '移动端暂未实现'.
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import type { Theme } from '../theme';
import { Icon } from './ui';

export const NA = '接口尚未实现';
export const NA_MOBILE = '移动端暂未实现';
/** The host has the endpoint; the phone page is not built yet (a later batch). */
export type MenuItem = { label: string; onPress?: () => void; checked?: boolean; sep?: boolean; na?: string; icon?: string; hint?: string };

export function Menu({ theme, visible, onClose, items, top = 64, right = 16, left, bottom, scrim = true }: { theme: Theme; visible: boolean; onClose(): void; items: MenuItem[]; top?: number; right?: number; left?: number; bottom?: number; scrim?: boolean }) {
  const pos = bottom != null ? { bottom, left: left ?? 16 } : left != null ? { top, left } : { top, right };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: scrim ? 'rgba(0,0,0,0.35)' : 'transparent' }}>
        <View style={{ position: 'absolute', ...pos, maxWidth: '92%', backgroundColor: theme.bg, borderRadius: 12, minWidth: 200, padding: 6, gap: 2, borderWidth: 0.5, borderColor: theme.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
          {items.map((o, i) => {
            const hint = !o.onPress ? o.na ?? NA : o.hint;
            const ink = o.onPress ? theme.text : theme.faint;
            return (
              <React.Fragment key={o.label + i}>
                {o.sep ? <View style={{ height: 0.5, backgroundColor: theme.border, marginVertical: 4, marginHorizontal: 8 }} /> : null}
                <Pressable disabled={!o.onPress} onPress={() => { onClose(); o.onPress?.(); }} accessibilityRole="menuitem" accessibilityLabel={hint ? `${o.label}，${hint}` : o.label}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: pressed ? theme.hover : 'transparent' })}>
                  {o.icon ? <View style={{ marginHorizontal: 1 }}><Icon name={o.icon} color={ink} size={16} /></View> : null}
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1, flexGrow: 1, minWidth: 0, color: ink, fontSize: 13, lineHeight: 18 }}>{o.label}</Text>
                  {o.checked ? <Icon name="checkLine" color={theme.text} size={16} /> : null}
                  {hint ? <Text numberOfLines={1} style={{ flexShrink: 0, color: theme.faint, fontSize: 12, lineHeight: 18 }}>{hint}</Text> : null}
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}
