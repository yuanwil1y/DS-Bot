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
  // Web behavior, replicated: a quiet-level tap still sets poked; the body then stops (animation:none)
  // and stays stopped, since the poke never ends, until the level changes (see plan()).
  if (!pokeable) return mark;
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
export function Avatar({ bot, size = 44, working, star, ring = '#111', state: given, live = false, pokeable = false, badge = true, admin = false }: { bot: Bot; size?: number; working?: boolean; star?: boolean; admin?: boolean; ring?: string; state?: MarkState; live?: boolean; pokeable?: boolean; badge?: boolean }) {
  const look = lookOf(bot) as Look;
  const state: MarkState = given ?? (working ? 'working' : 'idle');
  const settled = useSettled(state);
  const theme = useTheme();
  const motion = useMotion();
  const kind = !badge ? null : state === 'alert' ? 'alert' : state !== 'idle' && state !== 'waiting' ? 'working' : admin ? 'admin' : star ? 'main' : null;
  const ringC = theme.sidebar; // box-shadow 0 0 0 1.5px var(--bt-sidebar)
  const ringS = { position: 'absolute' as const, width: 15, height: 15, borderRadius: 7.5, backgroundColor: ringC, right: -1.5, bottom: -1.5 };
  const main = Math.min(22, Math.max(14, size * 0.36));
  return (
    <View style={{ width: size, height: size }}>
      <Mark look={look} size={size} state={settled ? 'done' : state} live={live} pokeable={pokeable} id={bot.id} />
      {kind === 'admin' ? <View style={ringS}><View style={{ position: 'absolute', left: 1.5, top: 1.5, width: 12, height: 12, borderRadius: 6, backgroundColor: theme.badgeAdmin, alignItems: 'center', justifyContent: 'center' }}><SvgXml width={7} height={7} xml={STAR_ICON} /></View></View> : null}
      {kind === 'main' ? <View style={{ position: 'absolute', right: -0.07 * size, bottom: -0.07 * size, width: main, height: main }}><SvgXml width={main} height={main} xml={mainStar(theme.star, ringC)} /></View> : null}
      {kind === 'working' ? <View style={{ position: 'absolute', right: 1 - 1.5, bottom: 1 - 1.5, width: 11, height: 11, borderRadius: 5.5, backgroundColor: ringC, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.badgeWorking }} /></View> : null}
      {kind === 'alert' ? <AlertBadge size={size} ring={ringC} ride={motion === 'lively'} bg={theme.badgeAlert} ink={theme.accentText} /> : null}
    </View>
  );
}

/** mark.js AdminStar: the small star in a disc, inline after a name. */
export function AdminStar() {
  const theme = useTheme();
  return <View accessibilityLabel="管理员" style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.badgeAdmin, alignItems: 'center', justifyContent: 'center' }}><SvgXml width={7} height={7} xml={STAR_ICON} /></View>;
}

// mark.js StarIcon / MainStar.
const STAR_ICON = '<svg viewBox="0 0 10 10"><path d="M5 .6l1.3 2.8 3 .3-2.3 2 .7 3L5 7.2 2.3 8.7l.7-3L.7 3.7l3-.3z" fill="#fff"/></svg>';
const MAIN_D = 'M10 2.4l2.29 5.04 5.51.63-4.09 3.74 1.11 5.42L10 14.5l-4.82 2.73 1.11-5.42L2.2 8.07l5.51-.63z';
// paint-order:stroke → the stroke drawn under the fill.
const mainStar = (fill: string, stroke: string) => `<svg viewBox="0 0 20 20" overflow="visible"><path d="${MAIN_D}" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round"/><path d="${MAIN_D}" fill="${fill}"/></svg>`;

/** .bt-badge-alert: 12px "?" bottom-right, or (lively) riding on the head with bt-q-ride. */
function AlertBadge({ size, ring, ride, bg, ink }: { size: number; ring: string; ride: boolean; bg: string; ink: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ride) return undefined;
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ANIMS.qRide.dur, easing: Easing.linear, useNativeDriver: true })); a.start();
    return () => a.stop();
  }, [ride, v]);
  const ty = useMemo(() => { const i: number[] = [], o: number[] = []; for (let k = 0; k <= 60; k++) { i.push(k / 60); o.push(sample('qRide', k / 60).ty * size); } return v.interpolate({ inputRange: i, outputRange: o }); }, [size, v]);
  const pos = ride ? { left: size / 2 - 7.5, top: -size * 0.14 - 1.5, transform: [{ translateY: ty }] } : { right: -1.5, bottom: -1.5 };
  return <Animated.View style={[{ position: 'absolute', width: 15, height: 15, borderRadius: 7.5, backgroundColor: ring, alignItems: 'center', justifyContent: 'center' }, pos as any]}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: ink, fontSize: 8.5, fontWeight: '600', lineHeight: 12, includeFontPadding: false }}>?</Text></View></Animated.View>;
}

// mark.js clusterSeats / RoomAvatar: members seated in the frame; a later seat cuts a
// frame/14 gap into the seats it overlaps (the web masks; here a disc in the backdrop
// color is drawn under each later seat, the same picture on a solid backdrop).
function clusterSeats(count: number, frame: number): [number, number, number][] {
  if (count === 1) return [[0, 0, frame]];
  if (count === 2) return [[0, 0, frame * 2 / 3], [frame / 3, frame / 3, frame * 2 / 3]];
  if (count === 3) { const s = frame * 5 / 9, r = frame - s; return [[r / 2, 0, s], [0, r, s], [r, r, s]]; }
  const h = frame / 2;
  return [[0, 0, h], [h, 0, h], [0, h, h], [h, h, h]];
}
export function GroupAvatar({ members, size = 36, ring }: { members: Bot[]; size?: number; working?: boolean; ring?: string }) {
  const theme = useTheme();
  const back = ring ?? theme.sidebar;
  const people: (Bot | null)[] = members.length === 1 ? [members[0], null] : members;
  if (!people.length) return <Mark look={lookOf(undefined) as Look} size={size} />;
  const seats = clusterSeats(Math.min(people.length, 4), size);
  const overflow = people.length > 4 ? people.length - 3 : 0;
  const gap = size / 14;
  return (
    <View style={{ width: size, height: size }}>
      {seats.map(([x, y, s], i) => {
        const r = s * 0.48 + gap;
        const cut = i > 0 ? <View key={`c${i}`} style={{ position: 'absolute', left: x + s / 2 - r, top: y + s / 2 - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: back }} /> : null;
        const you = { position: 'absolute' as const, left: x + s * 0.04, top: y + s * 0.04, width: s * 0.92, height: s * 0.92, borderRadius: s, alignItems: 'center' as const, justifyContent: 'center' as const };
        const p = people[i];
        const seat = overflow > 0 && i === 3
          ? <View key="more" style={[you, { backgroundColor: theme.active }]}><Text style={{ color: theme.faint, fontSize: Math.max(8, Math.round(s * 0.36)), fontWeight: '500' }}>+{overflow}</Text></View>
          : p ? <View key={p.id} style={{ position: 'absolute', left: x, top: y }}><Avatar bot={p} size={s} badge={false} /></View>
            : <View key="you" style={[you, { backgroundColor: mixInk(theme.text, 0.12) }]} />;
        return [cut, seat];
      })}
    </View>
  );
}
const mixInk = (hex: string, a: number) => { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
