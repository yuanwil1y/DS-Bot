# 外观 / 显示偏好 — 规格（ds-bot 0.2.4 web → Android）

来源：`/tmp/rb2/ds-bot/src/client/**`、`src/host/channel.js`。行号为 0.2.4 源码。
规则：web 有 UI、手机做不到 →「移动端暂未实现」；被接口挡住 →「接口尚未实现」；web 无 UI → 不做。

## 0. 存储与作用域（全部偏好共用）

| 项 | web 行为 | 位置 |
|---|---|---|
| 存储 | 服务器端 `state.prefs`（团队级，所有设备共享） | host/channel.js:77（state 下发 `prefs`）、store.js |
| 写入 | `call('set-prefs', {key: value})`，返回新 `state.prefs`；之后刷新 state | team-actions.js:104 `setPrefs: prefs => after(call('set-prefs', prefs))` |
| 校验 | theme `/^[a-z][\w-]{0,31}$/`；accent `#rrggbb` 或 null/''=删除；motion quiet/normal/lively（normal/null=删除）；layout bubble/flat（bubble/null=删除）；width/flatWidth 50–100 整数（默认值/null=删除）；thinking true=存，false/null=删除，其他忽略 | channel.js:105–139 |
| 只读主机 | `set-prefs` 不在 READS，只读主机拒绝 | channel.js:101 |
| 本地缓存 | localStorage `PREFS_KEY` 仅作启动缓存（state 未到时先用） | index.js:146, 341 |
| 生效时机 | roster 每次变化 `installTheme.render()`：body `data-bt-motion` / `data-bt-layout`，CSS 变量 `--bt-msg-w` / `--bt-flat-w`，以及 `themeCss(theme, accent)` | index.js:320–345 |
| 深浅色 | **不是 ds-bot 偏好**：由 DSH 外壳 `body[data-ds-dark-theme]` 决定（同一主题有 light/dark 两套） | themes.js:58–59 |

App 对应：读 `state.prefs`，写 `client.call('set-prefs', …)` 后 `refresh()`；SecureStore `dsbot.teamPrefs.v1` 作启动缓存；深浅色仍为设备设置（自动/深色/浅色），对应 web 的 DSH 外壳开关。

解析函数（themes.js:118–128，index.js:326–332）：
- theme：`allThemes()[prefs.theme] ? prefs.theme : 'deepseek'`（自定义主题 registerTheme 仅桌面插件 API，app 只有 4 个内置）
- accent：`isHex(prefs.accent) ? prefs.accent : undefined`
- motion：quiet|lively 否则 normal
- layout：`flat` 否则 `bubble`
- width：50–100 整数否则 80；flatWidth 同理否则 100
- thinking：`=== true`

## 1. 设置界面（settings.js）

### 通用页 GeneralPage（settings.js:80–110），分区「外观」，顺序：

| # | 标签 | 提示 | 控件 | 选项/范围（顺序） | 默认 |
|---|---|---|---|---|---|
| 1 | 主题 | 整个团队的配色，所有设备同步。 | `<select>` | DeepSeek、黑白(mono)、纸张(paper)、月光(moonlight) | deepseek |
| 2 | 强调色 | 未读标记、徽标和品牌标志。 | 色块 | 主题强调色(默认，accent=null)、DeepSeek 蓝 #4D6BFE、炭黑 #141416、石墨 #2D2D2D、玫瑰 #EC2F6B、天蓝 #0AA8D6、橘 #FF6900、钴蓝 #082DFF、自定义强调色(颜色输入，350ms 防抖) | 无(主题强调色) |
| 3 | 消息布局 | — | Segmented | 气泡(bubble)、平铺(flat) | bubble |
| 4 | 正文宽度 | — | 滑块（**仅 flat 时显示**） | 50–100 步长 5，显示 `N%`，350ms 防抖、卸载时 flush | 100 |
| 5 | 气泡宽度 | — | 滑块 | 同上 | 80 |
| 6 | 显示思考过程 | — | Switch | 开/关 | 关 |

色块选中态：`aria-pressed = prefs.accent === INKS[ink][0]`；自定义色块 `data-on` = 有 accent 且不等于任何预设。
滑块轨道：已填部分 `--bt-accent`，其余 `--bt-active`（styles.js:768）。Switch 开 = `--bt-accent`（bot-settings.js:286）。
手机宽度（≤640px，styles.js:894–918）：设置全屏、页列表变成顶部横条、`.bt-set-row` 纵向排布（标签在上，控件在下）。

分区「模式」→「经典 Agent 模式」[切换]：仅 `actions.setSurface` 存在（DSH 桌面外壳）时显示。App 已有该行，标「移动端暂未实现」（Agent 页面整体延期）。

### Bot 页 BotsPage → MotionSection（settings.js:174–183），分区「动画」

| 标签 | 控件 | 选项 | 默认 |
|---|---|---|---|
| Bot 动画 | Segmented（宽 216px，styles.js:764） | 安静(quiet)、正常(normal)、活泼(lively) | normal |

点当前值不发请求。

## 2. 主题颜色（themes.js）

THEMES（light / dark），键：bg, sidebar, bubble, card, text, user, userText, accent —— 见 src/appearance.ts 原样复制。
themeVars（themes.js:36–49）：
- `--bt-ink`=text；`--bt-ink-2`=text@.6；`--bt-ink-3`=text@.36
- `--bt-bubble`=bubble；`--bt-sidebar`=sidebar；`--bt-main`=bg；`--bt-card`=card
- `--bt-line`=text@.08；`--bt-line-2`=text@.15
- `--bt-hover` dark rgba(160,160,160,.12) / light rgba(119,119,119,.09)；`--bt-active` .2 / .17
- `--bt-accent`=accent；`--bt-accent-ink` = #141414 或 #fff（WCAG 对比，(L+.05)²>1.05×(L(#141414)+.05) 取深色）
- `--bt-user`=user；`--bt-user-ink`=userText；`--bt-tag-bg`=text@(.09 dark/.06 light)；`--bt-tag-ink`=text@.58
- 深色下预设强调色换成该预设的深色值（darkAccent），自定义色两种模式相同；未设置则用主题自身 accent。

强调色用处（grep `var(--bt-accent)`）：发送按钮 .bt-send / 新建发送 .bt-nc-send / 输入框主按钮、提交 .bt-q-submit、确认 .bt-confirm-go、学习卡批准、Switch 开、滑块填充、未读点 .bt-unread / .bt-dot、新消息分隔 .bt-new-sep 与「新消息」胶囊 .bt-news、提问徽标 .bt-badge-alert（accent 78% 混 sidebar）、品牌鲸鱼 .bt-brand-whale、记忆图标 .bt-pill-mem-ico、焦点框、用量页日历。
Bot 名字/形象颜色：INKS[色][light|dark]（inks.js），`inkText`：black→gray。

App 映射（Theme 键）：bg←bg；fill/sidebar 面←sidebar；card←card；cardHi←hover/active 叠加在 card 上；text←ink；sub←ink-2；faint←ink-3；sep←line；border/fillBorder←line-2；accent←accent；accentText←accent-ink；bubbleMe←user；userText←userText；bubbleBot←bubble；badge/unread←accent；tagBg/tagInk；danger/ok 保持（web 也是固定红/绿）。

## 3. 消息布局与宽度（styles.js）

| 元素 | 气泡布局 | 平铺布局 | 位置 |
|---|---|---|---|
| Bot 文本 `.bt-msg`/`.bt-bubble` | 左对齐、贴合内容，max-width `min(w×100%, 100%−82px)`；背景 --bt-bubble；圆角 18；内边距 7/12；同组连续气泡内侧角 6px | 无背景、无内边距、无圆角；拉伸，max-width `flatW×100%`；块间距 10px | styles.js:204–206, 632–651 |
| 群聊带头像 `.bt-astack[data-lead]` | `min(w×(100%−30px)+30px, 100%−52px)`；头像 22px 在最后一个气泡旁（底对齐，gap 8） | 头像移到名字行行首，名字用 --bt-ink、13px/600 | styles.js:638, cells.js:301–311 |
| 群聊名字 `.bt-group-name` | 12px/500，Bot 颜色(inkText)，margin-left 42px；时间 11px ink-2 | 13px/22px/600，--bt-ink，头像 22 + 8 间距 | styles.js:226–229 |
| 用户气泡 `.bt-ububble` | 右对齐，max-width `w×100%`，背景 --bt-user，文字 --bt-user-ink，圆角 18 | 同左（平铺只影响 Bot 文本；“气泡宽度仍作用于用户消息”） | styles.js:1144, settings.js:105 注释 |
| 思考 `.bt-think` | max-width w | max-width flatW | styles.js:927–928 |
| 平铺发言头 SpeakerHead | — | 单聊里每轮 Bot 回复前一行：头像 22、名字 13px/600、时间 11px ink-2 | cells.js:247, 534 |
| Bot 互发 exchange | 同群聊规则 | 同群聊 | exchange.js:46 |
| 悬浮工具条 | 82px 预留给 hover 工具条；触屏 (hover:none) 改为点开、右上 | 平铺时浮在消息右上 | styles.js:645, 1073 |

手机 ≤640px：消息宽度无专门规则（82px 预留仍生效）。

## 4. 显示思考过程

web：`thinkingShown(prefs)` 控制 ThinkingRow（cells.js:230）显示推理文本（可折叠 `.bt-think`，13px/18px ink-2）。
App：移动端 chat API（host/parts.js displayItems）只下发文字块，不含推理内容；`thinking` 接口只给耗时。→ 开关照做并同步，效果标「接口尚未实现」。

## 5. Bot 动画（styles.js:25–83，mark.js）

- 变换基准：`.bt-b`（身体，含眼洞）transform-box fill-box、origin 50% 100%；`.bt-eyes`/`.bt-eye` 以自身包围盒中心。
- 状态动画（所有级别、所有传了 state 的标记）：
  thinking=ponder 2.2s + 眼 squint；searching=seek 1s + 眼 scan 1.6s；working=bob 1.6s（star/hex/plus/gem/magnet/ring 用 wiggle 1.4s 中心；gumdrop/peanut/cushion/squircle/moon/wave 用 squash 1.2s）+ 眼 blink 2.4s；sending=dash 1.1s cubic-bezier(.4,0,.2,1)；orbit/waiting=sway 2.6s 中心 + 眼 roll 2.6s linear；alert=hop 1.3s cubic-bezier(.3,.7,.4,1) ×2（活泼：无限）；done=settle 1.8s（run 结束后 useSettled 显示 1.8s）。照片头像：非 idle 时 bob，alert hop，done settle。
- normal：live 标记悬停抚摸（nuzzle）、点击 poke（.8s，origin 50% 60%）、大标记眼睛跟随指针。
- quiet：无 poke 动画、无视线跟随、无抚摸；状态动画保留。
- lively：live 标记 idle/alert 时眨眼（5s，每 Bot 负延迟 fnv1a(id)%5000）；idle 时每 9s 一个小动作（hop/sway/stretch/look，fnv1a(`${id}:fidget`)%4，延迟 fnv1a(`${id}:when`)%9000）；提问徽标骑在头顶 q-ride；alert hop 无限。
- live 标记：侧栏行/主 Bot 磁贴、详情抽屉（64，可 poke、gaze）、打字行（28，可 poke）、语音、关于页；聊天头部 BotAvatar 24（live 默认 true）。对话记录里的标记 live=false。
- prefers-reduced-motion：全部停止。

## 6. 平价表

见文末「Parity」节。

## Parity（Phase 3）

| 项 | Web 0.2.4 | Android | 状态 |
|---|---|---|---|
| 存储 | state.prefs，set-prefs 补丁，host 校验 | 同一接口；applyPrefs 复刻 host 校验做乐观更新；SecureStore 仅作启动缓存；只读 host 禁用控件 | ✅ 一致（单测覆盖） |
| 主题 DeepSeek/黑白/纸张/月光 | themes.js 浅/深两套 | palette() 逐值移植 | ✅ |
| 深浅色 | DSH 外壳决定 | 跟随本设备（行名「深浅色」并注明） | ⚠️ 平台差异，已注明 |
| 强调色（默认 + 7 色 + 自定义 hex） | accent，深色变体 darkAccent，文字色 accentInk | 同算法；用于发送/语音按钮、主按钮、选中、开关、新消息分隔线、滑块 | ✅ |
| 布局 气泡/平铺 | layout | 同；平铺有头行（头像/名/时间），无气泡 | ✅ |
| 气泡宽度 / 平铺宽度 50–100 step 5 | width / flatWidth | 自绘滑块，350ms 防抖写入；bubbleMax/leadBubbleMax/userMax/flatMax 公式移植 | ✅（单测覆盖） |
| 字号 | 网页 15px 正文 | 保持 17（手机可读性） | ⚠️ 差异，已记录 |
| 显示思考过程 | thinking 开关 + 思考块 | 开关同步到服务器；手机聊天接口不返回思考内容 | 「接口尚未实现」 |
| 动画级别 安静/正常/活泼 | motion | 同一偏好；设置在 Bot 列表之后 | ✅ |
| 状态动画（ponder/squint/seek/scan/bob/wiggle/squash/blink/dash/sway/roll/hop/done） | styles.js keyframes | motion.ts 关键帧逐值移植，逐段 cubic-bezier，fill-box 原点；身体用原生驱动 Animated，眼睛 ~30fps 重绘遮罩 | ✅（单测逐帧校验） |
| botState / toolState / 结束 settle 1.8s | mark.js | 同函数；首页行与主 Bot、聊天头部、详情（64，可点 poke）、打字行（28，可点 poke，按工具名）、语音（思考/说话） | ✅ |
| 活泼：眨眼 / 小动作 / ? 骑头 / alert 无限 | lively | 同哈希与负延迟；? 徽标 q-ride | ✅ |
| 点击 poke | normal/lively，.8s 原点 50% 60%；照片 poke-img | 同；安静级别点按无反应（web 安静下点后动画被 none 覆盖、且不复位——这里不复刻该缺陷） | ✅/⚠️ 小差异 |
| 悬停抚摸 nuzzle、开心眼、眼睛跟随指针 | 仅鼠标 | 触屏无悬停/指针 | 「移动端暂未实现」（无对应偏好 UI，行为缺口） |
| 系统减少动态效果 | prefers-reduced-motion 全停 | AccessibilityInfo.isReduceMotionEnabled 全停 | ✅ |
| 徽标 | working 绿点右下 / ? / 主星 / 管理员星 | working 右下绿点（theme.ok）、? 用强调色、主星保留原样式；管理员星未在头像上显示 | ⚠️ 管理员星缺 |
| 截图 | — | 本环境无 Android 模拟器/设备，未能截图；需真机目测 | ⚠️ |
