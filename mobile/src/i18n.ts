// UI copy. Labels follow the DS Bot web UI's own wording (ds-bot/src/client/i18n.js).
const zh = {
  appName: 'DeepSeek Bot', connectTitle: '连接到你的电脑', connectHint: '粘贴 DSH 打开的完整链接（含 ?token=），或分别填写地址和令牌。',
  server: '服务器地址或令牌链接', token: '令牌（可选）', connect: '连接', connecting: '正在连接…', disconnect: '断开连接',
  bots: 'Bot', working: '工作中', online: '已连接', offline: '重连中…', noBots: '还没有 Bot',
  message: '发消息…', askBot: '向 {name} 提问', send: '发送', you: '你', loadOlder: '加载更早的消息', empty: '还没有消息，说点什么吧。',
  search: '搜索', noMatch: '没有匹配的 Bot', mainBot: '主 Bot', waiting: '等你回答', unread: '有未读', group: '群聊',
  newChat: '新对话', createBot: '新建 Bot', createGroup: '新建群聊', newBot: '新 Bot', name: '名称', role: '分工', model: '模型',
  create: '创建', creating: '创建中…', cancel: '取消', save: '保存', edit: '编辑', close: '关闭', back: '返回',
  chooseAdmin: '选择群管理员', pickMembers: '添加群成员', addOneMore: '再至少添加一个 Bot', groupName: '群名称（可选）', admin: '管理员',
  instructions: '指令', memory: '记忆', usage: '用量', members: '成员 · {count}', workingFolder: '工作文件夹', more: '更多',
  day: '最近 24 小时', week: '最近 7 天', month: '最近 30 天', calls: '次调用', tokensIn: '输入', tokensOut: '输出', cache: '缓存命中',
  noUsage: '还没有用量。', nothingSaved: '还没有保存内容', addMemory: '记下一条…', add: '添加', teamMemory: '团队记忆',
  share: '分享对话', details: '详情', editBot: '编辑 Bot', retry: '重试', failed: '发送失败，点按重试',
  settings: '设置', connection: '连接', server2: '服务器', status: '状态', plugin: 'DS Bot 插件', appVersion: 'App 版本',
  language: '语言', theme: '主题', auto: '跟随系统', dark: '深色', light: '浅色', readOnly: '只读',
  today: '', yesterday: '昨天', am: '上午', pm: '下午', month_day: '{m}月{d}日',
};
const en: typeof zh = {
  appName: 'DeepSeek Bot', connectTitle: 'Connect to your computer', connectHint: 'Paste the full link DSH opened (with ?token=), or enter address and token.',
  server: 'Server address or token link', token: 'Token (optional)', connect: 'Connect', connecting: 'Connecting…', disconnect: 'Disconnect',
  bots: 'Bots', working: 'Working', online: 'Connected', offline: 'Reconnecting…', noBots: 'No Bots yet',
  message: 'Message…', askBot: 'Ask {name}', send: 'Send', you: 'You', loadOlder: 'Load older', empty: 'No messages yet.',
  search: 'Search', noMatch: 'No Bots match', mainBot: 'Main Bot', waiting: 'Waiting for your answer', unread: 'Unread activity', group: 'Group chat',
  newChat: 'New chat', createBot: 'Create new Bot', createGroup: 'Create group chat', newBot: 'New Bot', name: 'Name', role: 'Role', model: 'Model',
  create: 'Create', creating: 'Creating…', cancel: 'Cancel', save: 'Save', edit: 'Edit', close: 'Close', back: 'Back',
  chooseAdmin: 'Choose the group admin', pickMembers: 'Add members', addOneMore: 'Add at least one more Bot', groupName: 'Group name (optional)', admin: 'Admin',
  instructions: 'Instructions', memory: 'Memory', usage: 'Usage', members: 'Members · {count}', workingFolder: 'Working folder', more: 'More',
  day: 'Last 24 hours', week: 'Last 7 days', month: 'Last 30 days', calls: 'calls', tokensIn: 'Input', tokensOut: 'Output', cache: 'Cache read',
  noUsage: 'No usage yet.', nothingSaved: 'Nothing saved yet', addMemory: 'Remember something…', add: 'Add', teamMemory: 'Team memory',
  share: 'Share conversation', details: 'Details', editBot: 'Edit Bot', retry: 'Retry', failed: 'Not sent. Tap to retry',
  settings: 'Settings', connection: 'Connection', server2: 'Server', status: 'Status', plugin: 'DS Bot plugin', appVersion: 'App version',
  language: 'Language', theme: 'Theme', auto: 'System', dark: 'Dark', light: 'Light', readOnly: 'Read-only',
  today: '', yesterday: 'Yesterday', am: 'AM', pm: 'PM', month_day: '{m}/{d}',
};
const sys = (Intl.DateTimeFormat().resolvedOptions().locale || 'zh').toLowerCase();
export const t: typeof zh = { ...(sys.startsWith('en') ? en : zh) }; // default Chinese
export let lang: 'zh' | 'en' = sys.startsWith('en') ? 'en' : 'zh';
export function setLang(l: 'auto' | 'zh' | 'en') {
  lang = l === 'auto' ? (sys.startsWith('en') ? 'en' : 'zh') : l;
  Object.assign(t, lang === 'en' ? en : zh);
}
export const fmt = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''));
/** Grok-style list time: today -> 上午1:58, yesterday -> 昨天, else 10月20日. */
export function shortTime(ms?: number) {
  if (!ms) return '';
  const d = new Date(ms); const now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) {
    const h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
    return lang === 'en' ? `${h % 12 || 12}:${m} ${h < 12 ? t.am : t.pm}` : `${h < 12 ? t.am : t.pm}${h % 12 || 12}:${m}`;
  }
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (same(d, y)) return t.yesterday;
  return fmt(t.month_day, { m: d.getMonth() + 1, d: d.getDate() });
}
