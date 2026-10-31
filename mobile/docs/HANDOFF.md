# DS Bot 移动端交接日志

更新：2026-10-31 21:15（UTC+8）· 分支 `mobile-app-mvp` · 当前版本 0.9.5（versionCode 22）

## 1. 项目目标与用户定下的规矩（必须遵守）
- **严格 1:1 复刻官方 DS Bot 0.2.4 网页版的行为和逻辑**。先读网页源码 `ds-bot/src/client/*.js`，不要猜；每一处改动都注明对应的网页文件和行号。
- **网页没有的功能一律不加**。以前加过的多余功能（输入框里的停止按钮、🔔 通知页等）已经删掉了。
- **视觉风格参照 Grok Bot app**：深色主题。首页左上角是账号按钮，右上角是「+」，中间是大的主 Bot 头像，下面是 Bot 列表。**不要搜索框、不要二维码、不要侧栏开关**，网页的侧栏和弹层在手机上改成二级页面和返回导航。
- **占位规则**：
  - 后端没有接口：在原位置标「接口尚未实现」。
  - 手机上做不到或没有意义：如果没有界面就直接不做；如果有界面，标「移动端暂未实现」。
  - DSH Agent 相关功能统一标「移动端暂未实现」。
- **只用系统字体**。用户手机故意设成了系统粗体，不要打包字体：0.9.2 打包字体导致启动闪退，0.9.3 已回退。
- **不要部署到生产环境的 DSH**。
- **只以 GitHub 预发布交付**：仓库 `yuanwil1y/DS-Bot`，remote 名 `yuanwil1y`。**永远不要推到 origin（Fei2411）**。
- 提交身份：`git -c user.name='yuanwil1y' -c user.email='yuanwil1y@users.noreply.github.com' commit ...`
- **不用模拟器**。用户在自己的手机上测试，方法是 app 里内置的一键「外观自测」录屏，再加截图。
- **用户要求慢工细活**：每做完一项先汇报进度；开始新的工作前必须等用户明确说「做」。汇报用中文，要简短。

## 2. 技术栈与目录结构
- Expo SDK ~58.0.19、React Native 0.88、React 19.3、TypeScript。Node 22 以上。
- 额外的原生模块：expo-sharing、expo-file-system（新 API：`File`、`Paths`）、expo-secure-store、react-native-svg、语音识别等，详见 `package.json`。
- `mobile/android/` 已被 gitignore，由 `npx expo prebuild -p android` 生成。生成后要手动改 versionCode 和 versionName，见下文。

| 路径 | 作用 |
|---|---|
| `src/api/auth.ts` | 用 DSH 的 token 链接换 `dsh-auth-*` cookie（ManualCookieTokenAuth） |
| `src/api/client.ts` | `POST /api/bot {endpoint,payload}`，401/403 时重新授权一次，有超时 |
| `src/api/feed.ts` | 通过 WebSocket `/api/remote.mux` 订阅流式接口 `dsBot/feed`，断线退避重连 |
| `src/api/chatModel.ts`、`cards.ts`、`work.ts`、`side.ts`、`schedules.ts`、`voice.ts`、`memoryNews.ts` | 纯逻辑，移植自网页（聊天 reducer、卡片、工作状态文案等） |
| `src/store.tsx`、`prefs.tsx`、`teamPrefs.tsx`、`visits.ts` | 全局状态、本机偏好、团队偏好（set-prefs）、上次离开时间 |
| `src/theme.ts`、`src/appearance.ts` | 主题配色、外观偏好（宽度、主题色、动画），规格见 `docs/appearance-prefs-spec.md` |
| `src/appearanceTest.tsx` | 一键外观自测（只改本机设置，带浮层和停止按钮），用户录屏用 |
| `src/errors.tsx` | 错误边界和 FatalGate：启动或致命 JS 错误时显示错误页，并记录「最近一次错误」 |
| `src/screens/` | Connect、Home、Chat、Panel（Bot/群详情、设置、记忆、用量）、SettingsSheet（账户设置）、NewChatSheet、Schedules、SideChat、VoiceMode、AvatarEditor |
| `src/components/Menu.tsx` | 通用弹出菜单，按网页 `.bt-menu`：13px 行、16px 图标、提示列，常量 `NA`、`NA_MOBILE` |
| `src/components/MessageTools.tsx` | Bot 回复的浮动工具条（表情、回复、更多→复制/下载），表情存在本机文件里 |
| `src/components/Cards.tsx`、`ChartSvg.tsx`、`LearningCard.tsx`、`BtwCard.tsx` | 问题、视图、审批、密钥、学习等卡片；SVG 图表移植自 deep-view |
| `src/components/icons.gen.ts` | 从网页 `icons.js` 生成的 SVG 图标 |
| `test/*.test.mts` | settings、paihuo30（派活 30）、api 三组测试，连本地后端跑 |

**服务端**：ds-bot 0.2.4，加上 mobile-api 改动（分支 `mobile-api-on-0.2.4`，已合入本分支；设计见 `docs/plans/2026-10-24-mobile-api.md`）。
- 所有接口都在 `ds-bot/src/host/channel.js` 的 `handle()` 里，共 93 个，`switch(endpoint)` 分发。手机专用的接口在 `host/mobile.js`：hello、notices、avatar、room-chat、usage-summary、memory-edit、memory-add。
- Remote 方法在 `host/remote.js`：`dsBot/call` 调一次 api/bot，`dsBot/feed` 是流式推送。
- 推送事件：hello、revision、live、message、stream、room、notice，app 已全部处理。

## 3. 环境与命令
- Android SDK 在 `/opt/android-sdk`，JDK 17 在 `/opt/jdk17`（box 重置后可能要重装）。
- **打 APK**：
  ```sh
  cd mobile && npx tsc --noEmit
  # 首次或改了原生依赖：npx expo prebuild -p android
  # 改 android/app/build.gradle：versionCode +1，versionName = X.Y.Z；同时改 package.json 和 app.json 的 version
  cd android && ./gradlew assembleRelease -q   # 可加 -PreactNativeArchitectures=arm64-v8a
  # 产物：android/app/build/outputs/apk/release/app-release.apk（用 debug key 签名）
  ```
- **versionCode**：每发一版加 1（0.9.4 = 21，0.9.5 = 22）。
- **tag 命名**：`mobile-mvp-X.Y.Z`。
- **发布**：
  ```sh
  git push yuanwil1y mobile-app-mvp
  cp .../app-release.apk /tmp/dsbot-mobile-X.Y.Z.apk
  gh release create mobile-mvp-X.Y.Z /tmp/dsbot-mobile-X.Y.Z.apk -R yuanwil1y/DS-Bot --target mobile-app-mvp --prerelease -t "DS Bot mobile X.Y.Z" -n "中文说明"
  ```
- **本地测试环境**：仓库里是 `dev/mobile/run-local.sh`；box 上的工作副本在 `/workspace/dsbot-mobile/run-local.sh` 和 `run-demo.sh`（演示数据）。DSH 端口 3097，mock LLM 端口 8797。
  ```sh
  DSH_HOME=/tmp/新目录 sh run-local.sh start | tail -1   # 每次用新的 DSH_HOME；最后一行打印带 token 的 URL
  DSH_HOME=/tmp/新目录 sh run-local.sh stop
  ```
  在网页里先点「Continue」，再把模型选为 DeepSeek-V4.1-Flash，才能聊天。
- **测试**：URL 作为第一个参数传入。
  ```sh
  for t in settings paihuo30 api; do npx tsx test/$t.test.mts "<token URL>"; done
  ```
  当前 31 项全部通过：settings 7、paihuo30 1、api 23。注意：`npm run test:api` 不带 URL，会去读 `/tmp/dsh-mobile/web.log`。
- **Staging**：`apptest.bot.nightsky.ltd`，跑在服务器上一个独立的 `dshstage` 服务里，和生产隔离，专供用户手机连接测试。token 不写在这里。拆除步骤在服务器的 `/root/apptest-staging-README.md`。

## 4. 版本历史
- 0.1–0.2（M1 / 8860416）：Grok 风格的首个界面：首页（Bot + 群）、聊天、详情、设置、新建 Bot。
- 0.3.0：结构对齐网页（Bot/群面板、齿轮设置、记忆页、账号菜单）。
- 0.3.1：Grok 风格首页（顶部账号和「+」、中间主 Bot、列表，去掉底栏）。
- 0.4.0：群聊实时、问题/视图/审批卡、需要你处理的提醒、@提及、停止成员工作。
- 0.4.1：修群工作时的崩溃（speaking 是字符串）；错误边界，「最近一次错误」。
- 0.4.2：停止控件对齐网页（成员停止、全部停止）。
- 0.4.3：删掉网页没有的多余功能。
- 0.5.0：模型/推理强度、权限、工作文件夹、群设置、记忆选项。
- 0.5.1：群设置点了立刻响应，请求超时，「谁来回答」。
- 0.5.2：修空对话状态镜像显示。
- 0.6.0：定时任务（自动化任务），编辑 Bot 形象（角色、上传、头像库）。
- 0.7.0：侧边对话（子页面，/side 命令）。
- 0.7.1：侧边对话的修复（标签被截、等待中可取消）。
- 0.8.0：听写和语音对话。
- 0.8.1：麦克风常驻，连续听写。
- 0.9.0：逐页还原网页逻辑；外观、动画、主题；网页参考截图。
- 0.9.1：一键外观自测（仅测试用）。
- 0.9.2：打包 DSSans 字体，结果启动闪退，下一版回退。
- 0.9.3：去掉打包字体，改回系统字体；启动错误显示错误页。
- 0.9.4：用户气泡宽度按 dsh `.userStack`；已发送的用户消息左侧加复制；轮与轮之间的间距同网页。
- 0.9.5：账号菜单按 `.bt-menu` 重做；Bot 回复工具条（表情、回复、更多→复制/下载），私聊和群聊都有。
- 0.9.6：功能对齐第一批（表格 1–5、7）：改正占位标注；关于页；长消息折叠（fold.js）和群里「显示全文」（file-text）；释放已保留的私密 Bot；头像按编号取并缓存；反馈/诊断页。第 6 项没做（见下）。
- 0.9.7：功能对齐第二批（表格 8–10）：Bot 间对话弹窗（exchange.js，私聊里的事件行打开）；设置→密钥页（secret-card.js SecretsPage）；设置→用量页做全（usage-page.js + usage-data.js 原样移植：汇总、图表、按 Bot/模型、热力图、自选时段、单个 Bot/模型的详情）。

## 5. 当前状态
**已完成**（细节见 `web-parity-audit.md`）：
- 首页、账号菜单、私聊（流式、活动行、思考、复制、工具条）、群聊（工作条、事件、暂停/继续、停止）。
- 卡片：问题、视图、审批、密钥请求、学习提案、图表、来源。
- 记忆面板、定时任务、Bot 设置、群设置、新对话、侧边对话和 /btw、听写和语音、外观和动画、主 Bot 管理、总工作区、未读分隔线。

**和网页的差距**（接口都存在，按从易到难排）：

| # | 功能 | 接口 | 工作量 |
|---|---|---|---|
| 1 | 改正错误的占位标注（见下） | — | 0.2 天 |
| 2 | 关于页：版本、星数、检查更新提示 | 握手里的版本号、repo-stars、update-check | 0.3 天 |
| 3 | 群里的长消息「显示全文」 | file-text | 0.3 天 |
| 4 | 释放已保留的私密 Bot | private-release | 0.3 天 |
| 5 | 头像按编号取，省流量 | state `avatars:'ref'` + avatar | 0.5 天 |
| 6 | 直接编辑一条记忆 | memory-edit | 0.5 天 |
| 7 | 反馈/诊断页 | diagnostics、diagnostics-log、diagnostics-clear | 0.5 天 |
| 8 | 两个 Bot 之间的对话记录弹窗（点事件行打开） | exchange、exchange-text | 0.5–1 天 |
| 9 | 密钥管理页 | state.secrets、secret-update、secret-delete | 1 天 |
| 10 | 用量页做全（汇总、热力图、按模型、群） | usage | 1–1.5 天 |
| 11 | 浏览器授权设置页 | update-bot | 1 天 |
| 12 | 连接器页 | connector-connect、connector-disconnect、connector-retry | 1–1.5 天 |
| 13 | 能力页（全局新增、编辑、删除、批准） | capability-save、capability-delete、capability-approve | 1.5–2 天 |

**0.9.6 状态**：表格 1–5、7 已完成（测试 `test/batch096.test.mts`，14 项；四套测试共 45 项）。第 6 项**不做**：网页 memory-panel.js 没有编辑记忆的界面（只有 memory-ask / memory-forget），按「不加网页没有的东西」处理。现在标「移动端尚未开发」（NA_TODO）的：连接器、能力、浏览器、密钥、群用量，对应表格 9–13；第 8 项（exchange 弹窗）也还没做。

**0.9.7 状态**：表格 8–10 已完成（测试 `test/batch097.test.mts`，8 项；五套测试全过）。
- 客户端：`usage()` 改调 `usage`（旧的 `usage-summary` 主机没有）；新增 `exchange`、`exchangeText`、`secretUpdate`、`secretDelete`，`secretSet` 也接受 {name, purpose, value, scope}。
- 私聊 `rows()` 现在保留 `kind:'event'` 行（`eventData()` 给出前缀：群聊回复／叫停者／收到回复／收到消息）。
- 详情里的群用量标「接口尚未实现」：网页 details-drawer 用的是 DSH 的 projectionsBySession，手机拿不到；全局用量页里能看到按群的数据。
- 还标「移动端尚未开发」的：设置里的连接器、能力、浏览器（表格 11–13）。
- 手机上的取舍：悬停改为点按显示提示；自选时段一次显示一个月。

**（已在 0.9.6 改正）标错了、需要改的占位**：
- 首页菜单「连接器」，以及设置页里的「连接器」「能力」「浏览器」「密钥」「反馈」「关于」：现在标「接口尚未实现」，但接口都有，应该做出来。
- 群用量：`usage` 接口有按群的数据，也不该标「接口尚未实现」。
- 「模型」页：只有桌面应用有，应改标「移动端暂未实现」。
- 首页菜单「切换经典 Agent 模式」：应改标「移动端暂未实现」。

**39 个没用上的接口怎么分**：
- DSH Agent 6 个（不做）。
- 桌面专用的浏览器接管 5 个。
- 只有桌面应用用的模型服务商 5 个（providers*）。
- 升级主机 3 个（update-check 可以只读，用来显示有没有更新）。
- earlier 1 个：app 用 chat 的 cursor 翻页代替。
- 剩下 19 个就是上表 2–13 项要用的。

**没有接口、不用做的**：
- 消息表情和回复：网页也只存在本地，app 已在本机实现。
- 添加文件、引用对话：这是 DSH 外壳的功能。
- 「打开 Harness 设置」、HTML 节点、浏览器求助卡（待处理）：已标「移动端暂未实现」。

**已知问题**：
- 外观自测结束后不会重新打开设置面板。
- 自测的浮层会挡住最后一条消息。
- 「安静」档下点头像的效果无法在录屏里确认。
- 定时任务里日期时间还是文本输入，时间格式和网页不完全一致。

**0.9.5 等用户在手机上确认的**：
1. 首页账号菜单：图标、省略号、提示列。
2. 其他菜单的新样式：复制/定时任务、Panel 的更多/选项、首页长按。
3. Bot 回复工具条的位置：气泡布局和平铺布局都看。
4. 表情条和气泡下面的表情。
5. 回复时插入的引用格式。
6. 下载能否调起分享。
7. 群聊里同样操作一遍。

## 6. 下一步建议（每一步都要先等用户说「做」）
1. 等用户确认 0.9.7 的结果（Bot 间对话弹窗、密钥页、用量页），修他反馈的问题。
2. 按表格 11→13 的顺序做，每批做完：tsc + 全部测试（batch097/batch096/settings/paihuo30/api 五套） → 打 APK → 发预发布 → 用中文汇报。
4. **验证方法**：
   - 网页参考截图在 `docs/appearance-shots/web/`（用 `variants.mjs` 在 mock 演示数据上生成）。手机截图在 `phone/`，对比拼图在 `compare/`（c01–c19）。
   - 网页侧用 Playwright 打开本地 DSH（token URL），量 DOM 的数值，和 app 对比。
   - 审计文档：`docs/web-parity-audit.md`（逐项对照表，末尾有 10-31 的更正）、`../audit-progress.md`（时间线）、`docs/appearance-prefs-spec.md`（外观规格）。
