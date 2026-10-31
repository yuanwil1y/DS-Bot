// @ts-nocheck
// ds-bot 0.2.4 appearance prefs (themes.js, inks.js, index.js:320-345, team-actions.js) as
// pure helpers: parse server `state.prefs`, build the palette, and validate edits like the host.
import { INKS, ACCENT_INKS, isHex, luminance } from './avatar/inks';

export const THEMES = {
  deepseek: {
    label: 'DeepSeek',
    light: { bg: '#fcfcfc', sidebar: '#f7f7f7', bubble: '#eeeeee', card: '#ffffff', text: '#141414', user: '#070707', userText: '#fcfcfc', accent: '#4d6bfe' },
    dark: { bg: '#141414', sidebar: '#1b1b1b', bubble: '#262626', card: '#1f1f1f', text: '#f2f2f2', user: '#f2f2f2', userText: '#141414', accent: '#5b7bff' },
  },
  mono: {
    label: '黑白',
    light: { bg: '#ffffff', sidebar: '#f9f9f9', bubble: '#f0f0f0', card: '#ffffff', text: '#0d0d0d', user: '#0d0d0d', userText: '#ffffff', accent: '#0d0d0d' },
    dark: { bg: '#0f0f0f', sidebar: '#171717', bubble: '#242424', card: '#1c1c1c', text: '#f4f4f4', user: '#f4f4f4', userText: '#0f0f0f', accent: '#f4f4f4' },
  },
  paper: {
    label: '纸张',
    light: { bg: '#faf9f5', sidebar: '#f3f0e8', bubble: '#ebe7dc', card: '#ffffff', text: '#1f1e1b', user: '#2b2a26', userText: '#faf9f5', accent: '#d97757' },
    dark: { bg: '#1f1e1b', sidebar: '#262521', bubble: '#34322d', card: '#2a2925', text: '#f3f0e8', user: '#f3f0e8', userText: '#1f1e1b', accent: '#e08a6d' },
  },
  moonlight: {
    label: '月光',
    light: { bg: '#f7f9fc', sidebar: '#eef2f8', bubble: '#e5ebf5', card: '#ffffff', text: '#121826', user: '#1e3a8a', userText: '#ffffff', accent: '#1e86ff' },
    dark: { bg: '#0b1020', sidebar: '#10172a', bubble: '#1a2340', card: '#141c33', text: '#e8edf7', user: '#3b6fd8', userText: '#ffffff', accent: '#4f9dff' },
  },
};
export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'deepseek';
export const ACCENT_LABELS = { deepseek: 'DeepSeek 蓝', charcoal: '炭黑', graphite: '石墨', rose: '玫瑰', sky: '天蓝', tangerine: '橘', cobalt: '钴蓝' };
export { ACCENT_INKS, INKS, isHex };
export const LAYOUTS = [{ value: 'bubble', label: '气泡' }, { value: 'flat', label: '平铺' }];
export const MOTIONS = [{ value: 'quiet', label: '安静' }, { value: 'normal', label: '正常' }, { value: 'lively', label: '活泼' }];
export const MESSAGE_WIDTH = { min: 50, max: 100, step: 5 };

const percent = (v, fallback) => (Number.isInteger(v) && v >= MESSAGE_WIDTH.min && v <= MESSAGE_WIDTH.max ? v : fallback);
export const themeOf = (p) => (p && Object.hasOwn(THEMES, p.theme) ? p.theme : DEFAULT_THEME);
export const accentOf = (p) => (isHex(p?.accent) ? p.accent : undefined);
export const motionOf = (p) => (p?.motion === 'quiet' || p?.motion === 'lively' ? p.motion : 'normal');
export const layoutOf = (p) => (p?.layout === 'flat' ? 'flat' : 'bubble');
export const widthOf = (p) => percent(p?.width, 80);
export const flatWidthOf = (p) => percent(p?.flatWidth, 100);
export const thinkingShown = (p) => p?.thinking === true;
export const resolvePrefs = (p) => ({ theme: themeOf(p), accent: accentOf(p), motion: motionOf(p), layout: layoutOf(p), width: widthOf(p), flatWidth: flatWidthOf(p), thinking: thinkingShown(p) });

// host/channel.js set-prefs, so the optimistic cache equals what the host will store.
export function applyPrefs(prev, patch) {
  const next = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (k === 'theme') { if (typeof v === 'string' && /^[a-z][\w-]{0,31}$/.test(v)) next.theme = v; }
    else if (k === 'accent') { if (v == null || v === '') delete next.accent; else if (isHex(v)) next.accent = v.toLowerCase(); }
    else if (k === 'motion') { if (v == null || v === 'normal') delete next.motion; else if (v === 'quiet' || v === 'lively') next.motion = v; }
    else if (k === 'layout') { if (v == null || v === 'bubble') delete next.layout; else if (v === 'flat') next.layout = v; }
    else if (k === 'width' || k === 'flatWidth') {
      const d = k === 'width' ? 80 : 100;
      if (v == null || v === d) delete next[k]; else if (Number.isInteger(v) && v >= 50 && v <= 100) next[k] = v;
    } else if (k === 'thinking') { if (v === true) next.thinking = true; else if (v === false || v == null) delete next.thinking; }
  }
  return next;
}

// themes.js color math.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const INK_DARK = '#141414';
export const accentInk = (hex) => ((luminance(hex) + 0.05) ** 2 > 1.05 * (luminance(INK_DARK) + 0.05) ? INK_DARK : '#ffffff');
const DARK_OF = Object.fromEntries(ACCENT_INKS.map((id) => [INKS[id][0].toLowerCase(), INKS[id][1]]));
export const darkAccent = (accent) => (accent ? DARK_OF[accent.toLowerCase()] ?? accent : undefined);
// A translucent layer flattened over an opaque color (hover/active rows on cards).
export function over(base, [r, g, b], a) {
  const c = rgb(base).map((v, i) => Math.round(v * (1 - a) + [r, g, b][i] * a));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** CSS color-mix(in srgb, a p, b). */
export const mix = (a, p, b) => over(b, rgb(a), p);

// themeVars(theme[mode], dark, accent) mapped to the app's palette keys.
export function palette(prefs, dark) {
  const p = resolvePrefs(prefs);
  const t = THEMES[p.theme][dark ? 'dark' : 'light'];
  const accent = (dark ? darkAccent(p.accent) : p.accent) ?? t.accent;
  const hover = dark ? [160, 160, 160] : [119, 119, 119];
  return {
    dark, themeId: p.theme,
    bg: t.bg, sidebar: t.sidebar, card: t.card, fill: t.card,
    cardHi: over(t.card, hover, dark ? 0.2 : 0.17),
    hover: `rgba(${hover.join(',')},${dark ? 0.12 : 0.09})`, active: `rgba(${hover.join(',')},${dark ? 0.2 : 0.17})`,
    fillBorder: alpha(t.text, 0.15), border: alpha(t.text, 0.15), sep: alpha(t.text, 0.08), line: alpha(t.text, 0.08), composerBorder: alpha(t.text, 0.3), tool: alpha(t.text, 0.05), you: mix(t.text, 0.05, t.sidebar), youHi: mix(t.text, 0.09, t.sidebar),
    text: t.text, sub: alpha(t.text, 0.6), faint: alpha(t.text, 0.36),
    accent, accentText: accentInk(accent), badge: accent,
    bubbleMe: t.user, userText: t.userText, bubbleBot: t.bubble,
    tagBg: alpha(t.text, dark ? 0.09 : 0.06), tagInk: alpha(t.text, 0.58),
    code: over(t.card, hover, dark ? 0.12 : 0.09),
    // styles.js:102-109 badges: --bt-star/--bt-green mixed into --bt-sidebar.
    star: '#ff9800', green: '#00c972',
    badgeAdmin: mix('#ff9800', 0.82, t.sidebar), badgeWorking: mix('#00c972', 0.82, t.sidebar), badgeAlert: mix(accent, 0.78, t.sidebar),
    danger: dark ? '#ff5a52' : '#e5372d', ok: dark ? '#34c759' : '#22a447',
  };
}

// inks.js: a Bot color as text (black reads as a heading → gray) or fill, per mode.
const LEGACY = { kimi: 'charcoal', zai: 'graphite', minimax: 'rose', stepfun: 'sky', mimo: 'tangerine', qwen: 'cobalt' };
const inkName = (c) => (INKS[c] ? c : INKS[LEGACY[c]] ? LEGACY[c] : 'gray');
export const inkFillHex = (c, dark) => (isHex(c) ? c : INKS[inkName(c)][dark ? 1 : 0]);
export const inkTextHex = (c, dark) => inkFillHex(c === 'black' ? 'gray' : c, dark);

// styles.js bubble widths for a measured column (px).
export const bubbleMax = (col, w) => Math.min((w / 100) * col, col - 82);
export const leadBubbleMax = (col, w) => Math.min((w / 100) * (col - 30) + 30, col - 52);
// dsh MessageItem.module.css .userStack: max-width min(0.702 * min(960px, 100%), 82%); the
// ds-bot width settings never reach the host's user row, in bubble or flat layout.
export const userMax = (col) => 0.702 * Math.min(960, col);
export const flatMax = (col, fw) => (fw / 100) * col;
