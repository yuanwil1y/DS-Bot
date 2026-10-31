/** Pure stack-navigation helpers (unit-tested in test/batch0910.test.mts). */
export type RouteName = 'chat' | 'panel' | 'settings' | 'memory' | 'usage' | 'schedules' | 'avatar' | 'side' | 'voice';
export type NavRoute<T = unknown> = { name: RouteName; target: T; memId?: string; start?: string; chatId?: string; fromSheet?: boolean };

/** One level up. A screen opened from the settings sheet (settings.js "Back to Bots" / "Back to group chats")
 * goes back to that sheet, not to whatever was under it. */
export function backOne<R extends NavRoute>(stack: R[]): { stack: R[]; reopenSheet: boolean } {
  if (!stack.length) return { stack, reopenSheet: false };
  return { stack: stack.slice(0, -1), reopenSheet: !!stack.at(-1)!.fromSheet };
}

/** Settings-sheet page state: usage detail → all usage → sheet root → close. */
export type SheetNav = { page: string | null; usageFocus: string | null };
export function sheetBack(s: SheetNav): SheetNav | 'close' {
  if (s.page === 'usage' && s.usageFocus) return { page: 'usage', usageFocus: null };
  if (s.page) return { page: null, usageFocus: null };
  return 'close';
}

/** In-screen levels for stack screens with their own sub-state (memory entries → summary, usage focus → all). */
export function innerBack<S>(inner: S | null, clear: () => void, outer: () => void) { if (inner) clear(); else outer(); }
