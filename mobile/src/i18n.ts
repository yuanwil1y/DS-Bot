const zh = {
  appName: 'DeepSeek Bot', connectTitle: '连接到你的电脑', connectHint: '粘贴 DSH 打开的完整链接（含 ?token=），或分别填写地址和令牌。',
  server: '服务器地址或令牌链接', token: '令牌（可选）', connect: '连接', connecting: '正在连接…', disconnect: '断开',
  bots: 'Bot', working: '工作中', online: '已连接', offline: '重连中…', noBots: '还没有 Bot',
  message: '发消息…', send: '发送', you: '你', loadOlder: '加载更早的消息', empty: '还没有消息，说点什么吧。',
};
const en: typeof zh = {
  appName: 'DeepSeek Bot', connectTitle: 'Connect to your computer', connectHint: 'Paste the full link DSH opened (with ?token=), or enter address and token.',
  server: 'Server address or token link', token: 'Token (optional)', connect: 'Connect', connecting: 'Connecting…', disconnect: 'Disconnect',
  bots: 'Bots', working: 'Working', online: 'Connected', offline: 'Reconnecting…', noBots: 'No Bots yet',
  message: 'Message…', send: 'Send', you: 'You', loadOlder: 'Load older', empty: 'No messages yet.',
};
const lang = (Intl.DateTimeFormat().resolvedOptions().locale || 'zh').toLowerCase();
export const t = lang.startsWith('en') ? en : zh; // default Chinese
