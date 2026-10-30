// Pure helpers of web schedules.js (timingText / nextText / inAnHour), zh wording from i18n.js.
import type { ScheduleTask } from './client';

export const localZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } };
const clock = (time?: string | null) => String(time ?? '').slice(0, 5);
export const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const NARROW = ['', '一', '二', '三', '四', '五', '六', '日'];
function dayAndTime(ms: number) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const year = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}年`;
  return `${year}${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function everyText(seconds: number) {
  if (seconds % 86400 === 0) return seconds === 86400 ? '每天' : `每 ${seconds / 86400} 天`;
  if (seconds % 3600 === 0) return seconds === 3600 ? '每小时' : `每 ${seconds / 3600} 小时`;
  return `每 ${Math.round(seconds / 60)} 分钟`;
}
export function timingText(task: ScheduleTask) {
  const zone = task.timeZone && task.timeZone !== localZone() ? ` (${task.timeZone})` : '';
  switch (task.kind) {
    case 'after':
    case 'at': return `一次，${dayAndTime(Date.parse(task.scheduledAt ?? ''))}`;
    case 'every': return everyText(task.everySeconds ?? 0);
    case 'daily': return `每天 ${clock(task.time)}${zone}`;
    case 'weekly': {
      const days = (task.weekdays ?? []).join();
      const text = days === '1,2,3,4,5' ? `每个工作日 ${clock(task.time)}` : days === '6,7' ? `每个周末 ${clock(task.time)}`
        : days === '1,2,3,4,5,6,7' ? `每天 ${clock(task.time)}` : `每${(task.weekdays ?? []).map((d) => WEEK[d]).join('、')} ${clock(task.time)}`;
      return `${text}${zone}`;
    }
    case 'cron': return `按计划 ${task.expression}${zone}`;
    default: return '';
  }
}
export const nextText = (task: ScheduleTask) => (task.status === 'active' ? `下次 ${dayAndTime(Date.parse(task.scheduledAt ?? ''))}` : '已结束');
export function inAnHour() {
  const d = new Date(Date.now() + 3600_000); d.setMinutes(0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
}
/** 'YYYY-MM-DD HH:MM' (local) → ISO, like the web's datetime-local input. */
export function parseLocal(text: string): string {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m) throw new Error('bad');
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (Number.isNaN(d.getTime())) throw new Error('bad');
  return d.toISOString();
}

