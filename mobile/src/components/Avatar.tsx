import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, Text, View, useColorScheme } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Bot } from '../api';
import { usePrefs } from '../prefs';
import { animatedXml, characterXml, lookOf, shapeOf, type Look } from '../avatar/mark';
import { ANIMS, ORIGIN, bodyBox, eyesBox, plan, progress, sample, svgTransform, type MarkState, type Motion, type Play } from '../avatar/motion';
import { useTeamPrefs } from '../teamPrefs';
import { useTheme } from '../theme';

function useDark() { const sys = useColorScheme(); const { theme } = usePrefs(); return theme === 'auto' ? sys !== 'light' : theme === 'dark'; }

/** The web's BotMark: the Bot's character (shape + color from lookOf), or its photo,
 *  moving for its state with the web's keyframes (avatar/motion.ts). */
export function Mark({ look, size, state = 'idle', live = false, pokeable = false, id = '' }: { look: Look; size: number; state?: MarkState; live?: boolean; pokeable?: boolean; id?: string }) {
  const dark = useDark();
  const motion = useMotion();
  const reduced = useReducedMotion();
  const [poked, setPoked] = useState(false);
  const image = !!look.image;
  const p = reduced ? { body: null, eyes: null, eye: null } : plan({ state, shape: look.shape, image, motion, live, id, poked });
  const box = image ? { x: 0, y: 0, w: 100, h: 100 } : bodyBox(look.shape);
  const body = useBodyStyle(p.body, box, size, () => setPoked(false));
  const xml = useEyesXml(look, dark, p.eyes, p.eye);
  const inner = image ? <Image source={{ uri: look.image }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <SvgXml xml={xml} width={size} height={size} />;
  const mark = <Animated.View style={[{ width: size, height: size }, body]}>{inner}</Animated.View>;
  // quiet: a tap does nothing (the web's quiet level drops the poke).
  if (!pokeable || motion === 'quiet' || reduced) return mark;
  return <Pressable onPress={() => setPoked(true)} accessibilityRole="button">{mark}</Pressable>;
}

function useMotion(): Motion { try { return (useTeamPrefs()?.resolved?.motion ?? 'normal') as Motion; } catch { return 'normal'; } }
function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setR).catch(() => {}); const s = AccessibilityInfo.addEventListener('reduceMotionChanged', setR); return () => s.remove(); }, []);
  return r;
}

const N = 120;
/** .bt-b: a native-driver loop over densely pre-sampled keyframes, about the fill-box origin. */
function useBodyStyle(play: Play, box: { x: number; y: number; w: number; h: number }, size: number, onEnd: () => void) {
  const v = useRef(new Animated.Value(0)).current;
  const key = play ? `${play.anim}|${play.iterations}|${play.delay}|${play.origin}|${box.x},${box.y},${box.w},${box.h}|${size}` : '';
  const end = useRef(onEnd); end.current = onEnd;
  const style = useMemo(() => {
    if (!play) return null;
    const a = ANIMS[play.anim]; const k = size / 100;
    const phase = play.delay < 0 ? ((-play.delay % a.dur) / a.dur) : 0;
    const input: number[] = [], tx: number[] = [], ty: number[] = [], rot: string[] = [], sx: number[] = [], sy: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = sample(play.anim, play.iterations === Infinity ? (i / N + phase) % 1 || (i === N ? (phase || 1) : 0) : i / N);
      input.push(i / N); tx.push(t.tx * box.w * k); ty.push(t.ty * box.h * k); rot.push(`${t.rot}deg`); sx.push(t.sx); sy.push(t.sy);
    }
    const at = (out: any[]) => v.interpolate({ inputRange: input, outputRange: out });
    const [ox, oy] = ORIGIN[play.origin];
    return { transformOrigin: `${(box.x + box.w * ox) * k}px ${(box.y + box.h * oy) * k}px`, transform: [{ translateX: at(tx) }, { translateY: at(ty) }, { rotate: at(rot) }, { scaleX: at(sx) }, { scaleY: at(sy) }] } as any;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!play) return undefined;
    v.setValue(0);
    const once = Animated.timing(v, { toValue: 1, duration: ANIMS[play.anim].dur, easing: Easing.linear, useNativeDriver: true });
    const anim = play.iterations === Infinity ? Animated.loop(once) : Animated.loop(once, { iterations: play.iterations });
    anim.start(({ finished }) => { if (finished) end.current(); });
    return () => anim.stop();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return style;
}

/** .bt-eyes / .bt-eye: the mask's eyes, redrawn at ~30fps (frames cached) while they move. */
function useEyesXml(look: Look, dark: boolean, eyes: Play, eye: Play) {
  const [now, setNow] = useState(0);
  const active = !look.image && (eyes || eye);
  const key = active ? `${eyes?.anim}|${eyes?.delay}|${eye?.anim}|${eye?.delay}` : '';
  const t0 = useRef(0);
  useEffect(() => {
    if (!active) return undefined;
    t0.current = Date.now(); setNow(0);
    const h = setInterval(() => setNow(Date.now() - t0.current), 33);
    return () => clearInterval(h);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (!active) return characterXml(look.shape, look.color, dark);
    const def: any = shapeOf(look.shape);
    const fe = eyes ? progress(eyes, now) : null, fr = eye ? progress(eye, now) : null;
    const qe = fe == null ? -1 : Math.round(fe * 300), qr = fr == null ? -1 : Math.round(fr * 300);
    const ck = `${look.shape}|${look.color}|${dark}|${eyes?.anim}:${qe}|${eye?.anim}:${qr}`;
    let xml = frames.get(ck);
    if (!xml) {
      const etf = eyes && qe >= 0 ? svgTransform(sample(eyes.anim, qe / 300), eyesBox(def.eyes), 0.5, 0.5) : '';
      const rt = eye && qr >= 0 ? sample(eye.anim, qr / 300) : null;
      xml = animatedXml(look.shape, look.color, dark, etf, ([, , w, h]) => (rt ? svgTransform(rt, { x: -w / 2, y: -h / 2, w, h }, 0.5, 0.5) : ''));
      if (frames.size > 4000) frames.clear();
      frames.set(ck, xml);
    }
    return xml;
  }, [active, look.shape, look.color, dark, now, key]); // eslint-disable-line react-hooks/exhaustive-deps
}
const frames = new Map<string, string>();

/** Marks settle with a short squash (the 'done' keyframes, 1.8s) when a run finishes (mark.js useSettled). */
function useSettled(state: MarkState) {
  const prev = useRef(state);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const was = prev.current; prev.current = state;
    if (state !== 'idle') { setSettled(false); return undefined; }
    if (was === 'idle' || was === 'alert') return undefined;
    setSettled(true);
    const t = setTimeout(() => setSettled(false), 1800);
    return () => clearTimeout(t);
  }, [state]);
  return settled;
}

/** The web's BotAvatar. `state` (mark.js botState) drives motion and the badge; the older
 *  `working` prop still maps to 'working'. `live` marks blink/fidget at the lively level. */
export function Avatar({ bot, size = 44, working, star, ring = '#111', state: given, live = false, pokeable = false, badge = true }: { bot: Bot; size?: number; working?: boolean; star?: boolean; ring?: string; state?: MarkState; live?: boolean; pokeable?: boolean; badge?: boolean }) {
  const look = lookOf(bot) as Look;
  const state: MarkState = given ?? (working ? 'working' : 'idle');
  const settled = useSettled(state);
  const theme = useTheme();
  const motion = useMotion();
  const kind = !badge ? null : state === 'alert' ? 'alert' : state !== 'idle' && state !== 'waiting' ? 'working' : star ? 'main' : null;
  const dot = Math.max(12, size * 0.3);
  const q = Math.max(12, size / 3);
  return (
    <View style={{ width: size, height: size }}>
      <Mark look={look} size={size} state={settled ? 'done' : state} live={live} pokeable={pokeable} id={bot.id} />
      {kind === 'main' ? <View style={{ position: 'absolute', right: -2, bottom: -2, width: dot, height: dot, borderRadius: dot, backgroundColor: '#f59e0b', borderWidth: 2, borderColor: ring, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: dot * 0.5, lineHeight: dot * 0.62 }}>★</Text></View> : null}
      {kind === 'working' ? <View style={{ position: 'absolute', right: size / 36, bottom: size / 36, width: Math.max(8, size * 0.22), height: Math.max(8, size * 0.22), borderRadius: size, backgroundColor: theme.ok, borderWidth: 1.5, borderColor: ring }} /> : null}
      {kind === 'alert' ? <AlertBadge size={size} q={q} ring={ring} ride={motion === 'lively'} bg={theme.accent} ink={theme.accentText} /> : null}
    </View>
  );
}

/** The "?" badge: bottom-right, or (lively) riding on the head with bt-q-ride. */
function AlertBadge({ size, q, ring, ride, bg, ink }: { size: number; q: number; ring: string; ride: boolean; bg: string; ink: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ride) return undefined;
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ANIMS.qRide.dur, easing: Easing.linear, useNativeDriver: true })); a.start();
    return () => a.stop();
  }, [ride, v]);
  const ty = useMemo(() => { const i: number[] = [], o: number[] = []; for (let k = 0; k <= 60; k++) { i.push(k / 60); o.push(sample('qRide', k / 60).ty * size); } return v.interpolate({ inputRange: i, outputRange: o }); }, [size, v]);
  const pos = ride ? { left: size / 2 - q / 2, top: -size * 0.14, transform: [{ translateY: ty }] } : { right: 0, bottom: 0 };
  return <Animated.View style={[{ position: 'absolute', width: q, height: q, borderRadius: q, backgroundColor: bg, borderWidth: 1.5, borderColor: ring, alignItems: 'center', justifyContent: 'center' }, pos as any]}><Text style={{ color: ink, fontSize: q * 0.7, fontWeight: '600', lineHeight: q * 0.95 }}>?</Text></Animated.View>;
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
