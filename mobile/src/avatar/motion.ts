// ds-bot 0.2.4 Bot mark motion (styles.js:25-100, mark.js) as pure data + a sampler, so
// the app plays the web's keyframes frame-exact: per-segment easing, transform-box
// fill-box percentages, and the same origins.
import { fnv1a, shapeOf } from './characters';

export type T = { tx: number; ty: number; rot: number; sx: number; sy: number }; // tx/ty: fraction of the box
export const ID: T = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
type Frame = [number, Partial<T>, Ease?];
export type Ease = [number, number, number, number] | 'linear';
export type Anim = { dur: number; ease: Ease; frames: Frame[] };

const EIO: Ease = [0.42, 0, 0.58, 1];
const STD: Ease = [0.4, 0, 0.2, 1];
const SPRING: Ease = [0.3, 0.7, 0.4, 1];
const OUT: Ease = [0, 0, 0.58, 1];
const f = (offsets: number[], t: Partial<T>, e?: Ease): Frame[] => offsets.map((o) => [o, t, e]);

export const ANIMS: Record<string, Anim> = {
  bob: { dur: 1600, ease: EIO, frames: [...f([0, 1], {}), [0.3, { ty: -0.04, rot: -5 }], [0.65, { rot: 4 }]] },
  wiggle: { dur: 1400, ease: EIO, frames: [...f([0, 1], {}), [0.25, { rot: -12, sx: 1.04, sy: 1.04 }], [0.75, { rot: 12, sx: 1.04, sy: 1.04 }]] },
  squash: { dur: 1200, ease: EIO, frames: [...f([0, 1], {}), [0.3, { sx: 1.08, sy: 0.9 }], [0.55, { ty: -0.04, sx: 0.94, sy: 1.08 }], [0.8, { sx: 1.02, sy: 0.98 }]] },
  ponder: { dur: 2200, ease: EIO, frames: [...f([0, 1], { rot: 4 }), [0.5, { ty: -0.03, rot: 7 }]] },
  squint: { dur: 2200, ease: EIO, frames: [...f([0, 1], { ty: -0.04, sy: 0.7 }), [0.5, { tx: 0.05, ty: -0.05, sy: 0.78 }]] },
  seek: { dur: 1000, ease: EIO, frames: [...f([0, 1], { rot: -4 }), [0.5, { ty: -0.05, rot: -1 }]] },
  scan: { dur: 1600, ease: EIO, frames: [...f([0, 1], { tx: -0.12 }), [0.5, { tx: 0.12 }]] },
  dash: { dur: 1100, ease: STD, frames: [...f([0, 1], {}), [0.35, { tx: 0.09, rot: 7 }], [0.55, { tx: -0.02, rot: -3 }]] },
  sway: { dur: 2600, ease: EIO, frames: [...f([0, 1], { rot: -10 }), [0.5, { rot: 10 }]] },
  roll: { dur: 2600, ease: 'linear', frames: [...f([0, 1], { tx: 0.12 }), [0.25, { ty: 0.09 }], [0.5, { tx: -0.12 }], [0.75, { ty: -0.09 }]] },
  hop: { dur: 1300, ease: SPRING, frames: [...f([0, 0.55, 1], {}), [0.2, { ty: -0.14, sx: 0.96, sy: 1.05 }], [0.4, { sx: 1.06, sy: 0.94 }]] },
  done: { dur: 1800, ease: 'linear', frames: [[0, {}, STD], [0.133, { sx: 1.12, sy: 0.88 }, STD], [0.256, { sx: 0.93, sy: 1.09 }, STD], [0.378, { sx: 1.04, sy: 0.97 }, STD], ...f([0.511, 1], {})] },
  // 55%→78%→100% interpolate as matrices in CSS (rotate(360) is the identity), so the spin is 0–55%.
  poke: { dur: 800, ease: SPRING, frames: [[0, {}], [0.55, { ty: -0.16, rot: 360 }], [0.78, { sx: 1.08, sy: 0.92, rot: 360 }], [1, { rot: 360 }]] },
  pokeImg: { dur: 600, ease: OUT, frames: [...f([0, 1], {}), [0.4, { sx: 1.14, sy: 1.14, rot: -6 }]] },
  blink: { dur: 2400, ease: EIO, frames: [...f([0, 0.42, 0.5, 1], {}), [0.46, { sy: 0.03 }], [0.48, { sy: 1.06 }]] },
  blinkIdle: { dur: 5000, ease: 'linear', frames: [...f([0, 0.296, 0.35, 0.692, 0.746, 1], {}), ...f([0.322, 0.718], { sy: 0.03 }), ...f([0.338, 0.734], { sy: 1.06 })] },
  fidgetHop: { dur: 9000, ease: EIO, frames: [...f([0, 0.08, 1], {}), [0.03, { ty: -0.1, sx: 0.97, sy: 1.04 }], [0.055, { sx: 1.05, sy: 0.95 }]] },
  fidgetSway: { dur: 9000, ease: EIO, frames: [...f([0, 0.1, 1], {}), [0.025, { rot: -8 }], [0.05, { rot: 7 }], [0.075, { rot: -3 }]] },
  fidgetStretch: { dur: 9000, ease: EIO, frames: [...f([0, 0.09, 1], {}), [0.04, { sx: 0.94, sy: 1.08 }], [0.07, { sx: 1.03, sy: 0.97 }]] },
  fidgetLook: { dur: 9000, ease: EIO, frames: [...f([0, 0.22, 1], {}), ...f([0.03, 0.09], { tx: -0.14 }), ...f([0.12, 0.19], { tx: 0.14 })] },
  qRide: { dur: 1300, ease: SPRING, frames: [...f([0, 0.4, 0.55, 1], {}), [0.2, { ty: -0.14 }]] }, // ty: fraction of the mark size
};
for (const a of Object.values(ANIMS)) a.frames.sort((x, y) => x[0] - y[0]);

// CSS cubic-bezier timing function.
export function bezier([x1, y1, x2, y2]: [number, number, number, number]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-6) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; if (Math.abs(X(t) - x) > 1e-5) { t = x; for (let i = 0; i < 30; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return Y(t);
  };
}
const curves = new Map<string, (x: number) => number>();
const ease = (e: Ease) => { if (e === 'linear') return (x: number) => x; const k = e.join(); let c = curves.get(k); if (!c) curves.set(k, (c = bezier(e))); return c; };
const full = (t: Partial<T>): T => ({ ...ID, ...t });

/** The transform at progress p (0–1) of one iteration. */
export function sample(name: string, p: number): T {
  const a = ANIMS[name]; if (!a) return ID;
  const fr = a.frames;
  if (p <= fr[0][0]) return full(fr[0][1]);
  for (let i = 0; i < fr.length - 1; i++) {
    const [o0, t0, e0] = fr[i], [o1, t1] = fr[i + 1];
    if (p <= o1) {
      const k = o1 === o0 ? 1 : ease(e0 ?? a.ease)((p - o0) / (o1 - o0));
      const A = full(t0), B = full(t1);
      return { tx: A.tx + (B.tx - A.tx) * k, ty: A.ty + (B.ty - A.ty) * k, rot: A.rot + (B.rot - A.rot) * k, sx: A.sx + (B.sx - A.sx) * k, sy: A.sy + (B.sy - A.sy) * k };
    }
  }
  return full(fr[fr.length - 1][1]);
}

export const STATES = ['idle', 'thinking', 'searching', 'working', 'sending', 'orbit', 'waiting', 'alert', 'done'] as const;
export type MarkState = typeof STATES[number];
export const botState = (running: boolean, activity: unknown, alert: boolean): MarkState => (running
  ? ((STATES as readonly unknown[]).includes(activity) && activity !== 'waiting' ? activity as MarkState : 'working')
  : alert ? 'alert' : activity === 'waiting' ? 'waiting' : 'idle');
export const toolState = (name: string): MarkState => (/^(message_bot|stop_bot|create_bot|update_bot|create_group|update_group|delete_group|post_to_group)$/.test(name) ? 'sending'
  : /search|fetch|browse|read|grep|glob|list|recall/i.test(name) ? 'searching' : 'working');

export type Motion = 'quiet' | 'normal' | 'lively';
const FIDGETS = ['hop', 'sway', 'stretch', 'look'] as const;
export const fidgetOf = (id: string) => FIDGETS[fnv1a(`${id}:fidget`) % FIDGETS.length];
export const blinkDelay = (id: string) => -(fnv1a(String(id)) % 5000);   // ms
export const fidgetDelay = (id: string) => -(fnv1a(`${id}:when`) % 9000); // ms
const WIGGLE = ['star', 'hex', 'plus', 'gem', 'magnet', 'ring'];
const SQUASH = ['gumdrop', 'peanut', 'cushion', 'squircle', 'moon', 'wave'];

export type Play = { anim: string; origin: 'bottom' | 'center' | 'poke'; iterations: number; delay: number } | null;
export type Plan = { body: Play; eyes: Play; eye: Play };
/** Which keyframes run on .bt-b / .bt-eyes / .bt-eye for a mark (CSS cascade order). */
export function plan(o: { state: MarkState; shape: string; image?: boolean; motion: Motion; live: boolean; id: string; poked?: boolean }): Plan {
  const { state, shape, motion, live, id } = o;
  const lively = motion === 'lively' && live;
  const fid = lively && state === 'idle' ? fidgetOf(id) : null;
  let body: Play = null, eyes: Play = null, eye: Play = null;
  const loop = (anim: string, origin: 'bottom' | 'center' = 'bottom', delay = 0): Play => ({ anim, origin, iterations: Infinity, delay });
  if (o.image) {
    if (fid && fid !== 'look') body = loop(fid === 'hop' ? 'fidgetHop' : fid === 'sway' ? 'fidgetSway' : 'fidgetStretch', 'center', fidgetDelay(id));
    if (state !== 'idle') body = loop('bob', 'center');
    if (state === 'alert') body = { anim: 'hop', origin: 'center', iterations: lively || motion === 'lively' ? Infinity : 2, delay: 0 };
    if (state === 'done') body = { anim: 'done', origin: 'bottom', iterations: 1, delay: 0 };
    // web behavior, replicated: under quiet the poke class sets animation:none and, as animationend never
    // fires, stays on, so the body stays still until the level changes (styles.js:83, mark.js:75).
    if (o.poked) body = motion === 'quiet' ? null : { anim: 'pokeImg', origin: 'center', iterations: 1, delay: 0 };
    return { body, eyes: null, eye: null };
  }
  if ((state === 'idle' || state === 'alert') && lively) eye = loop('blinkIdle', 'center', blinkDelay(id));
  if (fid) { if (fid === 'look') eyes = loop('fidgetLook', 'center', fidgetDelay(id)); else body = loop(fid === 'hop' ? 'fidgetHop' : fid === 'sway' ? 'fidgetSway' : 'fidgetStretch', 'bottom', fidgetDelay(id)); }
  if (state === 'thinking') { body = loop('ponder'); eyes = loop('squint', 'center'); }
  if (state === 'searching') { body = loop('seek'); eyes = loop('scan', 'center'); }
  if (state === 'working') { body = WIGGLE.includes(shape) ? loop('wiggle', 'center') : SQUASH.includes(shape) ? loop('squash') : loop('bob'); eye = loop('blink', 'center'); }
  if (state === 'sending') body = loop('dash');
  if (state === 'orbit' || state === 'waiting') { body = loop('sway', 'center'); eyes = loop('roll', 'center'); }
  if (state === 'alert') body = { anim: 'hop', origin: 'bottom', iterations: motion === 'lively' ? Infinity : 2, delay: 0 };
  if (state === 'done') body = { anim: 'done', origin: 'bottom', iterations: 1, delay: 0 };
  if (o.poked) body = motion === 'quiet' ? null : { anim: 'poke', origin: 'poke', iterations: 1, delay: 0 };
  return { body, eyes, eye };
}

/** Progress within an iteration at elapsed ms (negative delays start mid-cycle); null once finished. */
export function progress(play: NonNullable<Play>, elapsed: number): number | null {
  const a = ANIMS[play.anim]; const t = elapsed - play.delay;
  if (t < 0) return 0;
  const n = t / a.dur;
  if (n >= play.iterations) return null;
  return n - Math.floor(n);
}

// transform-box: fill-box — the body's geometry bbox (all path data; bodies use M/m/L/l/H/h/V/v/Z only).
const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
export function pathBox(d: string, acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }) {
  const re = /([MmLlHhVvZz])|(-?\d*\.?\d+(?:e-?\d+)?)/g; let cmd = 'M', x = 0, y = 0, sx = 0, sy = 0; const nums: number[] = [];
  const add = () => { acc.x0 = Math.min(acc.x0, x); acc.y0 = Math.min(acc.y0, y); acc.x1 = Math.max(acc.x1, x); acc.y1 = Math.max(acc.y1, y); };
  const flush = () => {
    const step = cmd === 'H' || cmd === 'h' || cmd === 'V' || cmd === 'v' ? 1 : 2;
    for (let i = 0; i + step <= nums.length; i += step) {
      const a = nums[i], b = nums[i + 1];
      switch (cmd) {
        case 'M': x = a; y = b; sx = x; sy = y; cmd = 'L'; break;
        case 'm': x += a; y += b; sx = x; sy = y; cmd = 'l'; break;
        case 'L': x = a; y = b; break; case 'l': x += a; y += b; break;
        case 'H': x = a; break; case 'h': x += a; break; case 'V': y = a; break; case 'v': y += a; break;
      }
      add();
    }
    nums.length = 0;
  };
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) { flush(); cmd = m[1]; if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; } } else nums.push(parseFloat(m[2]));
  }
  flush();
  return acc;
}
export function bodyBox(shape: string) {
  let b = boxes.get(shape);
  if (!b) {
    const def: any = shapeOf(shape); const acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const ds = [def.path, ...String(def.layers ?? '').match(/d="[^"]*"/g)?.map((s: string) => s.slice(3, -1)) ?? []];
    for (const d of ds) if (d) pathBox(d, acc);
    b = isFinite(acc.x0) ? { x: acc.x0, y: acc.y0, w: acc.x1 - acc.x0, h: acc.y1 - acc.y0 } : { x: 0, y: 0, w: def.size, h: def.size };
    boxes.set(shape, b);
  }
  return b;
}
/** Union bbox of the eye rects as placed (translate+rotate), the .bt-eyes fill-box. */
export function eyesBox(eyes: number[][]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [cx, cy, w, h, tilt] of eyes) {
    const r = (tilt * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    // The rect, plus the (invisible) happy-eye arc the group also holds: its ends reach ±.62w.
    for (const [px, py] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w * 0.62, h * 0.14], [w * 0.62, h * 0.14]]) {
      const X = cx + px * c - py * s, Y = cy + px * s + py * c;
      x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** An SVG transform: origin, then translate(% of box) rotate scale, then back. */
export function svgTransform(t: T, box: { x: number; y: number; w: number; h: number }, ox: number, oy: number) {
  if (t.tx === 0 && t.ty === 0 && t.rot % 360 === 0 && t.sx === 1 && t.sy === 1) return '';
  const X = box.x + box.w * ox, Y = box.y + box.h * oy;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `translate(${r(X + t.tx * box.w)} ${r(Y + t.ty * box.h)}) rotate(${r(t.rot)}) scale(${r(t.sx)} ${r(t.sy)}) translate(${r(-X)} ${r(-Y)})`;
}
export const ORIGIN = { bottom: [0.5, 1], center: [0.5, 0.5], poke: [0.5, 0.6] } as const;
