// Bundled DSSans (Roboto Latin + Noto Sans SC CJK, the faces Chrome on Android uses for the
// web's sans-serif stack) so OEM system fonts (MiSans, HyperOS bold) don't make text heavier
// than the web. Android picks a font file per weight; fontWeight maps to the matching family.
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

const FAMILY: Record<string, string> = {
  '100': 'DSSans-Regular', '200': 'DSSans-Regular', '300': 'DSSans-Regular', '400': 'DSSans-Regular', normal: 'DSSans-Regular',
  '500': 'DSSans-Medium', '600': 'DSSans-SemiBold', '700': 'DSSans-Bold', '800': 'DSSans-Bold', '900': 'DSSans-Bold', bold: 'DSSans-Bold',
};
export function fontStyle(style: any) {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily && !String(flat.fontFamily).startsWith('DSSans')) return null; // monospace etc.
  return { fontFamily: FAMILY[String(flat.fontWeight ?? '400')] ?? 'DSSans-Regular', fontWeight: 'normal' as const };
}
function wrap(mod: any) {
  const Orig = mod.default;
  if (!Orig || Orig.__dsFont) return;
  const W: any = React.forwardRef((props: any, ref) => React.createElement(Orig, { ...props, ref, style: [props.style, fontStyle(props.style)] }));
  Object.assign(W, Orig); W.__dsFont = true; W.displayName = Orig.displayName ?? 'Text';
  mod.default = W;
  return W;
}
if (Platform.OS === 'android') {
  const RN = require('react-native');
  const T = wrap(require('react-native/Libraries/Text/Text'));
  const TI = wrap(require('react-native/Libraries/Components/TextInput/TextInput'));
  try { if (T) Object.defineProperty(RN, 'Text', { configurable: true, get: () => T }); } catch {}
  try { if (TI) Object.defineProperty(RN, 'TextInput', { configurable: true, get: () => TI }); } catch {}
}
