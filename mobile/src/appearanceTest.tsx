// TEST-ONLY: one-tap appearance self-test (「外观自动测试（测试用）」 in account settings).
// Steps through the variants of docs/appearance-shots/web/ so the user can screen-record the app
// and compare. Prefs are overridden LOCALLY only (never sent with set-prefs), so the web UI and the
// saved prefs are untouched; stopping or finishing just drops the override.
// REMOVE this file, its Settings row, the overrides in teamPrefs.tsx/theme.ts, the poke hook in
// Avatar.tsx and the runner in App.tsx before a real release.
import { useSyncExternalStore } from 'react';
type Raw = Record<string, unknown>;
type S = { running: boolean; override: Raw | null; dark: boolean | null; label: string };
let s: S = { running: false, override: null, dark: null, label: '' };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const testSet = (p: Partial<S>) => { s = { ...s, ...p }; emit(); };
export const useAppearanceTest = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => s);
export const startAppearanceTest = () => testSet({ running: true, label: '准备…' });
export const stopAppearanceTest = () => testSet({ running: false, override: null, dark: null, label: '' });
// Poke signal for pokeable marks (quiet-motion step taps the main avatar).
const pokes = new Set<() => void>();
export const onPoke = (f: () => void) => { pokes.add(f); return () => { pokes.delete(f); }; };
export const pokeAll = () => pokes.forEach((f) => f());

export type Step = { id: string; label: string; prefs: Raw; dark: boolean; view: 'chat' | 'home' | 'panel'; hold: number; poke?: boolean };
const BASE: Raw = { theme: 'deepseek', accent: null, layout: 'bubble', width: 80, flatWidth: 100, motion: 'normal', thinking: false };
const st = (id: string, label: string, p: Raw, dark: boolean, view: Step['view'] = 'chat', hold = 3000, poke = false): Step => ({ id, label: `${id} ${label}`, prefs: { ...BASE, ...p }, dark, view, hold, poke });
export const STEPS: Step[] = [
  ...['deepseek', 'mono', 'paper', 'moonlight'].flatMap((th) => [st('w01', `${th} light · chat`, { theme: th }, false), st('w01', `${th} dark · chat`, { theme: th }, true)]),
  st('w02', 'accent rose · chat', { accent: '#EC2F6B' }, false),
  st('w03', 'accent custom #8a2be2 · chat', { accent: '#8a2be2' }, false),
  st('w04', 'bubble width 50 · chat', { width: 50 }, false),
  st('w05', 'bubble width 100 · chat', { width: 100 }, false),
  st('w06', 'flat width 100 · chat', { layout: 'flat', flatWidth: 100 }, false),
  st('w07', 'flat width 50 · chat', { layout: 'flat', flatWidth: 50 }, false),
  st('w08', 'thinking on · chat', { thinking: true }, false),
  st('w09', 'motion normal · home', { motion: 'normal' }, false, 'home'),
  st('w10', 'deepseek dark · home', {}, true, 'home'),
  st('w09', 'motion quiet · 头像点击', { motion: 'quiet' }, false, 'panel', 6000, true),
  st('w09', 'motion lively · home', { motion: 'lively' }, false, 'home', 6000),
];
