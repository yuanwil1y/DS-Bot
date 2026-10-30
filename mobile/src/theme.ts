import { useColorScheme } from 'react-native';
export type Theme = ReturnType<typeof useTheme>;
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { dark, bg: '#0f1115', card: '#1a1d23', text: '#eceef2', sub: '#9aa0aa', border: '#2a2e36', accent: '#5b8cff', bubbleMe: '#3a63d8', bubbleBot: '#1f232a', code: '#262a33' }
    : { dark, bg: '#f6f7f9', card: '#ffffff', text: '#15171a', sub: '#6b7280', border: '#e5e7eb', accent: '#3b6cf6', bubbleMe: '#3b6cf6', bubbleBot: '#ffffff', code: '#f0f1f4' };
}
const palette: Record<string, string> = { deepseek: '#4d6bfe', blue: '#3b82f6', green: '#10b981', red: '#ef4444', orange: '#f59e0b', purple: '#8b5cf6', pink: '#ec4899', teal: '#14b8a6', gray: '#6b7280' };
export function botColor(color: string | undefined, seed: string) {
  if (color && palette[color]) return palette[color];
  if (color && color.startsWith('#')) return color;
  const keys = Object.values(palette); let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return keys[Math.abs(h) % keys.length];
}
