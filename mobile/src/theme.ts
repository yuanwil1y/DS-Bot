import { useColorScheme } from 'react-native';
import { usePrefs } from './prefs';
export type Theme = ReturnType<typeof useTheme>;
// Grok-style palette: near-black page, gray cards, white text, round filled buttons.
const darkT = { dark: true, bg: '#111111', card: '#232323', cardHi: '#2c2c2c', fill: '#262626', fillBorder: '#3a3a3a', text: '#f2f2f2', sub: '#8e8e93', faint: '#5d5d62', border: '#333333', sep: '#363636', accent: '#ffffff', accentText: '#000000', bubbleMe: '#2c2c2c', bubbleBot: '#232323', code: '#1a1a1a', danger: '#ff5a52', badge: '#ff3b30', ok: '#34c759' };
const lightT: typeof darkT = { dark: false, bg: '#f4f4f5', card: '#ffffff', cardHi: '#ececee', fill: '#ffffff', fillBorder: '#dedee2', text: '#111111', sub: '#6b6b70', faint: '#a0a0a6', border: '#e3e3e6', sep: '#e6e6ea', accent: '#111111', accentText: '#ffffff', bubbleMe: '#e6e6ea', bubbleBot: '#ffffff', code: '#f0f0f2', danger: '#e5372d', badge: '#ff3b30', ok: '#22a447' };
export function useTheme() {
  const sys = useColorScheme();
  const { theme } = usePrefs();
  const dark = theme === 'auto' ? sys !== 'light' : theme === 'dark';
  return dark ? darkT : lightT;
}
const palette: Record<string, string> = { deepseek: '#4d6bfe', blue: '#3b82f6', violet: '#8b5cf6', orange: '#f59e0b', green: '#10b981', magenta: '#d946ef', cyan: '#06b6d4', red: '#ef4444', yellow: '#eab308', brown: '#a16207', gray: '#6b7280', black: '#27272a', aurora: '#2dd4bf', charcoal: '#3f3f46', graphite: '#52525b', rose: '#f43f5e', sky: '#0ea5e9', tangerine: '#fb923c', cobalt: '#2563eb', purple: '#8b5cf6', pink: '#ec4899', teal: '#14b8a6' };
export function botColor(color: string | undefined, seed: string) {
  if (color && palette[color]) return palette[color];
  if (color && color.startsWith('#')) return color;
  const keys = Object.values(palette); let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return keys[Math.abs(h) % keys.length];
}
