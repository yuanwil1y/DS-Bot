// fold.js (ds-bot 0.2.4 client) ported as is: a message past FOLD_AT shows folded, its
// first lines then "显示全部 · N 字". A Bot's reply in its own chat folds only past
// FOLD_HUGE (cells.js:269). `whole`: the text is only the start of a long group post
// that went as a file; "显示全部" reads it whole with file-text.
export type Limit = { chars: number; lines: number };
export const FOLD_AT: Limit = { chars: 1500, lines: 25 };
export const FOLD_HUGE: Limit = { chars: 20_000, lines: Infinity };
export const ALWAYS: Limit = { chars: -1, lines: 0 };
const PREVIEW_LINES = 10;
const PREVIEW_CHARS = 600;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function cutAt(text: string, end: number) {
  const code = text.charCodeAt(end - 1);
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? end - 1 : end);
}
function moreLines(text: string, max: number) {
  let lines = 1;
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) if (++lines > max) return true;
  return false;
}
function openFence(lines: string[]) {
  let open: string | null = null; let openLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const marker = FENCE.exec(lines[i])?.[1];
    if (marker === undefined) continue;
    if (open === null) { open = marker; openLine = i; } else if (marker[0] === open[0] && marker.length >= open.length) open = null;
  }
  return { open, openLine };
}
export function foldPreview(text: string, limit: Limit = FOLD_AT, markdown = true): string | null {
  if (text.length <= limit.chars && !moreLines(text, limit.lines)) return null;
  const body = text.replace(/^(\s*\n)+/, '');
  if (body.trim() === '') return null;
  let head = body.split('\n', PREVIEW_LINES).join('\n');
  if (head.length > PREVIEW_CHARS) { const cut = head.lastIndexOf('\n', PREVIEW_CHARS); head = cutAt(head, cut > 0 ? cut : PREVIEW_CHARS); }
  if (head.trim() === '') head = cutAt(body, PREVIEW_CHARS);
  if (!markdown) return head;
  let lines = head.split('\n');
  let { open, openLine } = openFence(lines);
  if (open !== null && lines.slice(openLine + 1).join('').trim() === '') {
    head = cutAt(body, PREVIEW_CHARS);
    lines = head.split('\n');
    ({ open, openLine } = openFence(lines));
  }
  if (open === null) return head;
  lines[openLine] = open;
  return `${lines.join('\n')}\n${open}`;
}
export const stripLongNote = (text: string) => text.replace(/^\[A long message: \d+ characters\.[^\]\n]*\]\n/, '');

export type Whole = { length: number; load?: () => Promise<{ text?: string; whole?: boolean } | undefined> };
export type FoldState = { open: boolean; read?: 'loading' | { text?: string; whole?: boolean } };
export type Folded = { shown: string; folded?: boolean; more?: string; note?: string | null; less?: boolean };
const num = (n: number) => n.toLocaleString('en-US');

/** useFold's render decision, pure: what to show and which control goes under it. */
export function foldView(text: string, s: FoldState, { limit = FOLD_AT, whole, live = false, markdown = true }: { limit?: Limit; whole?: Whole; live?: boolean; markdown?: boolean } = {}): Folded {
  const cut = whole !== undefined && whole.length > text.length;
  const preview = live ? null : foldPreview(text, cut ? ALWAYS : limit, markdown);
  if (preview === null) return { shown: text };
  const count = num(cut ? whole!.length : text.length);
  if (!s.open) return { shown: preview, folded: true, more: `显示全部 · ${count} 字` };
  const loaded = typeof s.read === 'object' && typeof s.read.text === 'string' ? s.read : undefined;
  const note = !cut || s.read === undefined || s.read === 'loading' || loaded?.whole ? null
    : loaded !== undefined && loaded.text!.length > text.length ? `只显示前 ${num(loaded.text!.length)} 字`
      : '这里只保留了这条消息的开头';
  return { shown: loaded?.text ?? text, note, less: true };
}
