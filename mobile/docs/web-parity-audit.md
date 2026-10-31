# Web 0.2.4 parity audit (0.9.0)

| Area | Behavior | Web source | App before | App after |
|---|---|---|---|---|
| Dictation | Mic always visible; voice btn only when send disabled (empty draft), hidden in rooms | composer.js:9-11,77-89; styles.js `.bt-voice` rules | Mic hidden when draft non-empty (0.8.0) | Mic always visible (0.8.1) |
| Dictation | continuous=true default, interimResults, final-only insert, onend → not listening | composer.js:28-53 | 0.8.1 single-utterance | continuous (web default) |
| Composer + | "Add files" only when composer has a file input; "Reference a chat" only when shell can reference; "Scheduled task" always → schedules for this target | composer.js:118-165 | 3 rows, first two inert | Only "定时任务" (app has no file input / reference) |
| Dictation | lang = navigator.language; no silence tuning; error leaves listening to onend | composer.js:31-50 | zh-CN fixed, custom silence extras, error forced stop | device locale, no extras, end event only |
| Voice chat | Speak when turn has a new reply AND session not running; restart listening 250ms | voice.js:118-121,186-201 | Spoke first `message` event even mid-run; 280ms | Waits for !running + new reply; 250ms |
| Voice chat | Errors: aborted/no-speech silent (Android NO_MATCH maps to no-speech) | composer.js:45-48 | same | same (no change) |
| Home list | Main Bot only on top tile, not repeated in list | sidebar.js:330-337,499 | Main listed twice | Excluded from list |
| Home list | Sort pinned first, then updatedAt | sidebar.js:337 | time only | pinned first |
| Home list | Hidden Bots/groups not listed | sidebar.js:79,121 | shown | filtered |
| Home list | Preview = doing line / away "群 · 在做…" / "等 X 交回" / last turn (no "你：" prefix, no role fallback, no time) | sidebar.js:71-104,113-136; text.js:226 | role fallback, 你： prefix, time stamp, 工作中…/等你回答 text | ported workPhrase/workLine (src/api/work.ts) |
| Home list | Indicators are dots (unread / wait), no counts | sidebar.js:104,135-137 | numeric badges | dots |
| Home list | Pinned mark | sidebar.js:92-98 | none | 📌 after name |
| 头部 | 副标题 | header.js HeaderPill（只有头像和名字） | 离线/工作中/谁在说 | 只保留离线（应用独有的连接状态） |
| 活动行 | 运行中提示 | activity-row.js | 无 | 头像 + 短语… + 已用时间，工具状态优先，无流式文本时显示 |
| 头部 | 占位文案 | 给 {name} 发消息 | 相同 | 相同 |
| 群事件 | 工作条 | member-status.js dockModel | 自造摘要 | 排除当前发言者、最多 3 头像、批准黄点、私聊显示在群里工作 |
| 群事件 | 事件文案 | events/diagnostics.js | 部分不同 | failed/missed/lookup/resumed/cut/admin-passed 全部对齐 |
| 群事件 | 暂停继续 | room paused | 无 | 显示「继续」调用 room-continue |
| 详情页 | 成员行 | details-drawer.js MemberRow | 点开详情；停止按钮任何工作都显示 | 点开对话；仅本群在做显示停止，带位置+计时 |
| 详情页 | 群公告/权限 | GroupOverview | 纯文本；无权限行 | About 折叠/添加按钮；有群权限时显示 |
| 详情页 | 头部 | details-drawer.js | 头像 84、名字不可改、分享只发名字、群也有“更多” | 64/成员堆叠、点名字改名、分享对话 Markdown、群无“更多” |
| 详情页 | Bot 详情 | RunStats/About | 无统计；说明 2 行 | 运行统计、缺模型提示、简介 5 行折叠 |
| 审批 | 位置 | 群审批只在详情和工作条 | 群聊流里也有 | 移出群聊流；不可答时给「打开 X 的对话」 |
| 卡片 | 视图公式/输入默认值 | deep-view core/views.js | 自写解析，公式不计算 | 直接复用 deep-view core（Apache-2.0） |
| 卡片 | 视图提交 | widget-cell.js PendingView | 提交时卡片置灰保留 | 提交即隐藏，失败恢复并保留输入 |
| 卡片 | 表单/多选按钮 | card.js FormInput/OptionsInput | 表单「发给 Bot」，多选选中才出「提交」 | 表单默认「提交」，多选「提交」常显、未选禁用；multi 字段 |
| 卡片 | 已答视图 | widget-cell.js AnsweredView | 显示为用户文字 | 显示只读已答卡（确认徽标/已选项/表单值） |
| 卡片 | 展示节点 | card.js/chart.js | 图表/来源不显示，进度/提示简化 | 按网页：图表（条形+以表格查看）、来源链接、进度色调、提示图标 |
| 卡片 | 关闭视图标签 | i18n 'Dismiss view' | 关闭问题 | 关闭视图 |
| 卡片 | 密钥请求卡 | secret-card.js SecretCard | 无 | 新增：填写/允许、范围切换、替换值、取消请求 |
| 卡片 | 浏览器求助 | handoff-card.js | 无 | 已结束卡新增；待处理卡需桌面浏览器，不复刻 |
| 提示 | 学习提案卡 | learning-card.js | 无 | 新增：技能/AGENTS.md diff、超 8 行折叠、批准/拒绝、失败保留错误 |
| 提示 | 记忆已更新 | header.js useMemoryNotice | 无 | 胶囊内显示 3.2 秒，打开前的变化不算 |
| 提示 | N 条新消息 ↓ | header.js NewMessagePills | 无 | 上滑后到达的回复计数，点按回到底部，✕ 关闭 |
| 提示 | 审批系统通知 | approval-notices.js | 无 | 不复刻：网页只在已有权限时通知，安卓需主动申请 |
| Bot 设置 | 保存方式 | bot-settings.js InlineText | 顶部「保存」按钮 | 失焦/回车即存，必填项不存空 |
| Bot 设置 | 模型提示 | bot-settings.js modelHint | 固定「每条消息都用它」 | 未选/不可用/已生效/下一条生效 四种 |
| Bot 设置 | 隐私 | BotSettingsForm Privacy | 无 | 开关+四种禁用原因提示 |
| Bot 设置 | 能力 | capability-settings.js BotCapabilitiesCard | 无 | 每项开关+连接状态 |
| Bot 设置 | 记忆 | MemoryCard | 无 | 条数+管理 |
| Bot 设置 | 主 Bot | BotSettingsForm Main Bot | 无 | 开关；唯一主 Bot 显示说明 |
| Bot 设置 | 侧栏 | BotSettingsForm Sidebar | 无 | 置顶、从侧栏隐藏（主 Bot 卡位不显示） |
| Bot 设置 | 管理 | BotSettingsForm Manage | 无 | 复制一份并打开；删除需 4 秒内再点 |
| Bot 设置 | 模型分组 | model-menu.js groupModels | 按显示名 | 按提供方 id，重名加 (id) |
| 群设置 | 头部 | GroupSettingsForm hero | 无 | 群头像、N 位成员 · 管理员 X |
| 群设置 | 成员操作 | GroupSettingsForm Members | 只能设管理员 | 点名字打开对话、× 移出（>2 人）、添加成员 |
| 群设置 | 成员说明 | GroupSettingsForm note | 无不足 2 人提示 | 加「请先添加一个 Bot」 |
| 群设置 | 侧栏 | GroupSettingsForm Sidebar | 无 | 置顶、从侧栏隐藏 |
| 群设置 | 删除 | GroupSettingsForm Manage | 无 | 4 秒内再点删除 |
| 新对话 | 新建 Bot 表单 | create-bot.js | 名字+角色+模型 | 形象（随机）+名字（默认新 Bot N，最长 40，重名/非法提示）+模型 |
| 新对话 | 新建后 | new-chat.js created | 打开对话 | 打开对话并显示设置 |
| 新对话 | 附带消息 | new-chat.js sendMessage | 无 | 消息框；发给所选 Bot / 群 |
| 新对话 | 建群问候 | makeGroup greet | 无 | 无消息时 greet:true |
| 新对话 | 隐藏 Bot | openBot | 直接打开 | 先 set-flags hidden:false |
| 新对话 | 按名字新建 | options create | 无 | 「新建 Bot「名字」」 |
| 侧边对话 | 旧 /btw 卡片 | btw.js BtwCardView | 不显示 | 输入框上方显示，可折叠、可删除 |
| 账户设置 | 主 Bot | settings.js MainBotsSection | 无 | 换主（replace）、移到最前、取消、添加 |
| 账户设置 | Bot / 群聊列表 | BotsPage / GroupsPage | 无 | 列表+标签，点开设置 |

## 10-31 21:10 更正（按功能复核 web 0.2.4）
以下几处标注有误：它们的接口其实存在，应算作「app 还没做」，而不是「接口尚未实现」。
- 首页账号菜单「连接器」：connector-connect/disconnect/retry 都有，连接器列表在 state 里。
- 设置页里的 连接器 / 能力（capability-save/delete/approve）/ 密钥（state.secrets + secret-update/delete）/ 反馈（diagnostics*）/ 关于（repo-stars + 版本 + update-check）/ 浏览器（update-bot 的浏览器授权）：都有接口。
- 群用量：`usage` 接口按 room:<id> 返回，有接口。
- 「模型」页：网页只在 DS Bot 桌面应用里有（app/ui team.js 的 providers*），DSH Web 不显示，应标「移动端暂未实现」。
- 「切换经典 Agent 模式」：它只切换客户端界面（setSurface('agent')），不调用接口；首页菜单应和设置页一致，标「移动端暂未实现」。
- 消息「下载」：0.9.5 已做成分享 .md 文件。
- earlier：网页用它往前翻历史，app 用 chat/room-chat 的 cursor 翻页，效果等价。
- 群里的长消息「显示全文」（file-text）、Bot 间对话记录（exchange/exchange-text）、已保留的私密 Bot（private-release）：app 都没做，接口都有。

## 10-31 21:30 0.9.6 功能对齐第一批
- 占位标注：模型、切换经典 Agent 模式改标「移动端暂未实现」；连接器、能力、浏览器、密钥、群用量改标「移动端尚未开发」；反馈和关于已做成页面。
- 关于页：对照 web about 页（版本、手机应用版本、Star 数、检查更新、更新说明、源代码、发布说明、报告问题）。手机上不能安装更新，所以「更新」按钮标「移动端暂未实现」。
- 长消息：对照 fold.js（FOLD_AT 1500 字/25 行，私聊 Bot 回复用 FOLD_HUGE 20000，见 cells.js:269）；群消息带 `whole` 时用 file-text 取全文。
- 私密 Bot：对照 settings.js:203，「删除后仍受保护」列表，解除保护调用 private-release。
- 头像：state 改用 `avatars:'ref'`，再用 avatar 按编号取图，在客户端缓存。
- 反馈/诊断：对照 web 反馈页，用 diagnostics、diagnostics-log、diagnostics-clear；GitHub issue 链接长度限制和网页一致。
- memory-edit：网页没有编辑记忆的界面，不做。

## 10-31 21:40 0.9.7 功能对齐第二批
- Bot 间对话：exchange.js ExchangeDialog → `src/components/ExchangeSheet.tsx`。底部弹出，标题行两个头像中间「⇄」，每 2 秒拉一次 `exchange`（后台 8 秒），间隔超过 30 分钟显示日期，长消息用 `exchange-text` 读全文，按钮「关闭」。入口是私聊里的事件行（cells.js 'event'：群聊回复：+群 / 叫停者：、收到回复：、收到消息：+Bot）。
- 密钥页：secret-card.js SecretsPage/SecretRow/ScopeEditor/PurposeEditor/ValueEditor/AddSecret → `src/screens/SecretsPage.tsx`。文案、按钮禁用条件、名字规则 `/^[A-Za-z][\w-]{0,63}$/`、值至少 4 个字符都照网页。
- 用量页：usage-page.js + usage-data.js → `src/api/usageData.ts`（原样复制）、`src/api/usageModel.ts`、`src/screens/UsagePage.tsx`。悬停改为点按，自选时段一次一个月。
- 群详情里的用量：网页靠 DSH projections，手机没有 → 标「接口尚未实现」。
- 剩下「移动端尚未开发」：连接器、能力、浏览器。

## 10-31 21:45 0.9.8 功能对齐最后一批
- 设置→浏览器：browser-settings.js BrowserPage（说明、已允许的操作列表+移除授权、允许操作表单：Bot/网站/操作/时限），走 update-bot browserGrants。
- 设置→连接器：connectors.js ConnectorsPage（state.connectors，连接/断开/重试，GitHub token 表单，生成 token 链接用系统浏览器）；首页账号菜单「连接器」按 team-actions.js openConnectors 直接打开此页。
- 设置→能力：capability-settings.js CapabilitiesPage（完整表单、JSON 校验报错、编辑预填、删除 4 秒内二次确认、未批准的本地命令 MCP 显示「允许」）。
- 「移动端尚未开发」清零；13 项对齐表全部完成。
- 剩下没对齐（DSH Agent 除外）：详情里的群用量（接口尚未实现）；模型服务商页、经典 Agent 模式、终端、文件树、HTML 节点、待处理浏览器接管卡、Harness 设置（移动端暂未实现）。

## 10-31 21:50 0.9.9 日期和时间输入
- 网页 schedules.js：一次性用 `<input type="datetime-local">`（默认下一个整点，无 min/max，空值报「请选择日期和时间」，提交 `{kind:'at', at: new Date(值).toISOString()}`）；每天/每周用 `<input type="time">`（默认 09:00，提交 `{kind, time, timeZone}`）。用量自选时段是自绘日历，不是 input。
- app：两处改为 Android 系统选择器（日期→时间，24 小时制），默认值和提交格式不变。
- 自测相关的问题不再列为问题。13 项对齐表全部完成。
