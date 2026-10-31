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
- **不用模拟器**。用户在自己的手机上测试，方法是 app 里内置的一键「短自测（测试用）」录屏，再加截图。
- **用户确认过、故意保留的差异（不要再当成没对齐去改）**：
  - 用量页顶部汇总：网页是两行两列，app 是一个大数字加下面三个小数字。用户 2026-10-31 看过对比后说「那样挺好」，保留 app 现在的排法。
  - 首页按 Grok 布局，账号菜单从左上头像向下弹（网页是从侧栏底部向上弹）。
- **现有测试**：app 内只有一个「短自测（测试用）」（账户设置 → 测试，约 1 分钟）；仓库里是 test/*.test.mts（用 mock DSH 跑）。**短自测在正式发布前必须删除**（src/selfTest.tsx、各 useFT 调用、设置行、App.tsx SelfTestRunner、test/batch0916）。
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
| `src/selfTest.tsx` | 短自测（测试用，约 1 分钟，带步骤标签和停止按钮），用户录屏用；正式发布前删除 |
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
- 0.9.1：一键外观自测（仅测试用，0.9.13 已删除）。
- 0.9.2：打包 DSSans 字体，结果启动闪退，下一版回退。
- 0.9.3：去掉打包字体，改回系统字体；启动错误显示错误页。
- 0.9.4：用户气泡宽度按 dsh `.userStack`；已发送的用户消息左侧加复制；轮与轮之间的间距同网页。
- 0.9.5：账号菜单按 `.bt-menu` 重做；Bot 回复工具条（表情、回复、更多→复制/下载），私聊和群聊都有。
- 0.9.6：功能对齐第一批（表格 1–5、7）：改正占位标注；关于页；长消息折叠（fold.js）和群里「显示全文」（file-text）；释放已保留的私密 Bot；头像按编号取并缓存；反馈/诊断页。第 6 项没做（见下）。
- 0.9.7：功能对齐第二批（表格 8–10）：Bot 间对话弹窗（exchange.js）；设置→密钥（secret-card.js SecretsPage）；设置→用量做全（usage-page.js + usage-data.js）。
- 0.9.8：功能对齐最后一批（表格 11–13）：设置→浏览器（browser-settings.js，update-bot browserGrants）；设置→连接器（connectors.js，GitHub token 连接/断开/重试，账号菜单「连接器」直达）；设置→能力（capability-settings.js）。「移动端尚未开发」清零。
- 0.9.9：定时任务的日期时间改用 Android 系统选择器，对应网页 schedules.js 的原生 `<input type="datetime-local">`（一次性）和 `<input type="time">`（每天/每周）。

## 5. 当前状态（0.9.10）
**已完成**（细节见 `web-parity-audit.md`）：
- 首页、账号菜单、私聊（流式、活动行、思考、复制、工具条、事件行→Bot 间对话弹窗）、群聊（工作条、事件、暂停/继续、停止、显示全文）。
- 卡片：问题、视图、审批、密钥请求、学习提案、图表、来源。
- 记忆面板、定时任务（系统日期/时间选择器）、Bot 设置、群设置、新对话、侧边对话和 /btw、听写和语音、外观和动画、主 Bot 管理、总工作区、未读分隔线。
- 设置：主 Bot、Bot、群聊、连接器、能力、浏览器、用量、密钥、反馈、关于。

**对齐表 13 项：全部完成**（第 6 项「直接编辑记忆」不做：网页 memory-panel.js 没有这个界面）。
1 占位标注更正 · 2 关于页 · 3 群里显示全文 · 4 释放私密 Bot · 5 头像按编号 · 7 反馈/诊断 · 8 Bot 间对话弹窗 · 9 密钥 · 10 用量 · 11 浏览器授权 · 12 连接器 · 13 能力。

**测试**（全新 DSH_HOME 跑）：batch099 3（纯函数，不需要主机）、batch098 10、batch097 8、batch096 14、settings 7、paihuo30 1、api 23。

**代码要点**：
- `src/api/toolsModel.ts` + `src/screens/ToolPages.tsx`：连接器/能力/浏览器三页；网页 select/checkbox 做成选项胶囊；「Description」网页 i18n 无中文，照显英文。
- 连接器是 token 方式（不是 OAuth），只有「去 GitHub 生成 token」用系统浏览器打开。
- 日期时间：`@react-native-community/datetimepicker` 的 `DateTimePickerAndroid`（先选日期再选时间，24 小时制）；默认值、无 min/max、提交格式（`new Date(本地时间).toISOString()`；每天/每周发 `HH:MM` + 时区）都同网页。用量自选时段网页用的是自绘日历，不是 input，app 已照做。
- NA_TODO 已删除，`grep -rn 移动端尚未开发 src` 为 0。

**还没对齐的（DSH Agent 除外）**：
- 详情里的群用量：标「接口尚未实现」（网页用 DSH 的 projectionsBySession，手机拿不到；全局用量页里有按群的数据）。
- 标「移动端暂未实现」：模型服务商页、切换经典 Agent 模式、终端、文件树、HTML 节点、待处理的浏览器接管卡、打开 Harness 设置。
- 头像拖放/粘贴（桌面交互）不做。

**没用上的接口**：DSH Agent 6 个（不做）、桌面浏览器接管 5 个、模型服务商 providers* 5 个、升级主机（update-check 只读用于关于页）、earlier（用 chat cursor 翻页代替）。

**没有接口、不用做的**：消息表情和回复（网页也只存本地，app 本机实现）；添加文件、引用对话（DSH 外壳功能）。

**已知问题**：
- 「安静」档下点头像的效果无法在录屏里确认。

## 6. 下一步建议（每一步都要先等用户说「做」）
1. 等用户确认 0.9.9（定时任务的日期/时间选择器），修他反馈的问题。
2. 每批做完：tsc + 全部测试（batch099/batch098/batch097/batch096/settings/paihuo30/api，用新的 DSH_HOME） → 打 APK → 发预发布 → 用中文汇报。
3. **验证方法**：
   - 网页参考截图在 `docs/appearance-shots/web/`（用 `variants.mjs` 在 mock 演示数据上生成）。手机截图在 `phone/`，对比拼图在 `compare/`（c01–c19）。
   - 网页侧用 Playwright 打开本地 DSH（token URL），量 DOM 的数值，和 app 对比。
   - 审计文档：`docs/web-parity-audit.md`（逐项对照表，末尾有 10-31 的更正）、`../audit-progress.md`（时间线）、`docs/appearance-prefs-spec.md`（外观规格）。

### 0.9.10 — 二级页头统一（按 Grok 参考图）
- 统一页头：48dp 描边圆形按钮（左 18dp、上 16dp）+ 同行 18sp 常规字重标题（间距 18dp），无框。组件：`ui.tsx` 的 `PageHeader` / `Sheet` 头部（共用 HEAD/TITLE 样式）。
- 设置根页只显示 ✕；子页（连接器/能力/浏览器/用量/密钥/反馈/关于 DS Bot）只显示返回 + 标题；用量详情返回「全部用量」。
- 已改：SettingsSheet 子页、Bot/群聊设置、记忆、用量、定时任务、编辑 Bot 形象、Side chat（右侧保留结束 ✕）。
- 系统返回键逐级返回（Sheet 走 onRequestClose，栈页面走 PageHeader 的 BackHandler）。
- 0.9.10 重做（versionCode 28，versionName 不变）：修返回键「一次退到底」。
  - 原因 1：从设置页 Bot/群聊列表进入的 Bot/群聊设置，会先关掉设置面板再入栈，所以返回时直接回到首页，设置面板没了。现在这个路由带 `fromSheet`，返回时出栈并重开设置面板（对应网页 Back to Bots / Back to group chats）。
  - 原因 2：App 的 BackHandler 每次栈变化都重新注册，成了最新注册的那个，抢在 PageHeader 前面执行，于是系统返回键跳过了「全部记忆→摘要」「单项用量→全部用量」这些内层。现在改为只在挂载时注册一次，作为兜底。
  - 逻辑抽到 `src/nav.ts`（backOne / sheetBack / innerBack），测试见 test/batch0910.test.mts（6 项）。
- 0.9.10 第三次重做（versionCode 29）：页头圆形按钮配色。
  - 原因：(1) 图标 SVG 用的是 currentColor，Android 上 SvgXml 没有解析，描边成了黑色，深色主题下看不见；(2) 圆的填充等于页面背景，描边用的 line 只有文字色 8% 透明度，几乎看不出。
  - 修复：Icon 把 currentColor 直接替换成实色，所有图标都生效；新增 `roundFill`（文字色混入背景，深色 8%、浅色 4%）和 `roundBorder`（深色 30%、浅色 25%）；图标用 text 色，大小 22dp。颜色依据 Grok 参考图：#1d1d1d 背景、填充 #2c2c2e、圈 #4b4b4d、白色图标。
  - 测试 test/batch0911.test.mts：4 套主题 × 深浅色，图标对比度 ≥4.5:1，圈对比度 ≥1.5:1。

## 0.9.10 (versionCode 30) — 返回箭头空白修复
- 真因：icons.gen.ts 中多数图标（back/chevron/mic/more…）把 fill/stroke 写在根 `<svg>` 上，依赖继承；react-native-svg 在 Android Sheet(Modal) 内继承失效 → 空白。✕/plus/search/send 把 stroke 写在 `<path>` 上，因此正常。证据：0.9.9 Sheet 内 ✕ 可见、ChatScreen(非 Modal) 返回箭头可见、0.9.10 Connectors(Sheet) 箭头空白。
- 修复：新增 src/components/iconXml.ts，把根 paint 属性下放到每个 shape 并替换 currentColor；Icon 使用 iconXml(xml,color)。
- 回归测试：test/batch0912.test.mts（32 个图标 XML 合法、无 currentColor、每个 shape 有可见 paint）。
- 渲染验证：docs/appearance-shots/icon-render/header-buttons.png（Chrome 渲染同一 XML，8 主题×模式）。原生模拟器无 KVM 权限未验证。

## 0.9.11 (vc31) — 功能自测（测试用，0.9.13 已删除，被短自测取代）

## 0.9.12 (vc32) — 0.9.11 录屏问题按网页 0.2.4 修正
- 关于：登录后即预取 update-check（同网页 index.js 启动 fresh:false），进页立即有数据；DeepSeek Harness 行同网页条件 `dsh?.current`（取决于服务器是否返回 dsh）。src/api/aboutModel.ts prefetchUpdate/aboutCache。
- 用量 12 个月横轴：标签不截断（同 .bt-us-ticks span nowrap），显示「11月」。
- 用量自定义：SpanPicker 同 .bt-us-pick（≤640px 两个月竖排、每月 ≤252px、弹层铺满宽度、圆角 18、阴影、底部分隔线）。
- 定时任务表单：网页 schedules.js 有 autoFocus，保留；根改为 KeyboardAvoidingView，键盘不再挡「什么时候」。
- 连接器：GitHub 图标块（网页 connectors.js 同一 SVG 路径）。密钥空状态：「添加密钥」左对齐、上间距 12（.bt-actions）。
- 长消息演示 LONG_TEXT 520 行 ≈ 23 300 字，超过 FOLD_HUGE 20 000，能演示折叠（现在在 src/selfTest.tsx）。
- 左侧灰条：系统（HyperOS 侧边栏手柄）叠层，盖在系统对话框之上，非 app。
- 视觉验证：react-native-web 渲染（/tmp/rnw 临时工具）→ docs/appearance-shots/verify-0912/（v-* 深/浅，cmp-* 网页|app）。


## 0.9.13 (vc33) — 只留一个短自测
- 删除「外观自测」「功能自测」及全部相关代码（featureTest.tsx、appearanceTest.tsx、demo.json、各页动作注册、App.tsx 两个 runner、batch0913/0914 测试）。
- 新增「短自测（测试用）」约 1 分钟，只测 0.9.12 未录到的 7 项：关于秒开、用量 12 个月 x 轴、自定义范围选择器开/关、新建计划键盘弹起时「什么时候」可见、能力临时技能 selftest-temp 双击删除、密钥 SELFTEST_TEMP 增/展开/删、超长消息折叠/显示全部/收起。每状态约 2.5 秒，失败跳过，finally 清理临时数据，结束恢复原页面。
- 测试：test/batch0916.test.mts。正式发布前删除短自测。

## 0.9.14 (vc34) — 设置页按钮/图标对齐网页 0.2.4
- `ui.tsx` 新增网页同款 `Soft`（.bt-soft 36/14/0 16；sm 28/12/0 12；`send`=.bt-send；`icon`=.bt-with-icon）、`Actions`（.bt-actions 左对齐 gap 8；`end`=右对齐）、`Select`（.bt-select 34/r8/1px 边框 + 下箭头）。高度都是 minHeight，粗体系统字体会撑高不截断。`Icon name="chevron-down"` = chevron 旋转 90°。关于页保留自己的 Soft，外观不变。
- 能力页：h3「共享能力」→ 卡片外左对齐「添加能力」→ 表单 → 列表卡片（空时「还没有保存能力」）。表单按钮 取消/添加能力 都是 soft-sm，左对齐。
- 连接器：token 链接 + 取消 + 连接 同一行左对齐（.bt-connector-form-row）；浏览器「添加」是默认 soft，在右对齐的卡片底栏。密钥：去掉 marginLeft:-8 补偿，删除按钮改 Soft+trash 图标。
- 定时任务：表单改成网页的一张 .bt-set-card（发给 select 58% / 名字 / 要做什么 / 什么时候 + 右对齐 取消·创建任务 小按钮）；「新建任务」= soft-sm + Plus 图标；Bot 设置里的新建任务行用 Plus 图标。
- 文字字符图标全换 SVG：⌄ › ‹ ▾ ▸ ✕ × ⋯ ✓ ＋（Pickers/Panel/BtwCard/Cards/NewChatSheet/SettingsSheet/ChatScreen/ToolPages Choice）。⌘（添加 DSH Agent）网页用 FishLogo，本地没有该 SVG，先留空图标位。
- 截图：docs/appearance-shots/verify-0914/（web-cap.png 为网页参照）。

## 0.9.15 (vc35) — 图标全部取自网页官方源 + 设置子页间距
- 规则：**功能/控件/行为与网页 1:1，但不照抄网页在手机上未优化的布局缺陷**（贴边、重叠、挤在一起）。
- `src/components/icons.extra.ts`（手抄官方源，不被 icons 脚本覆盖）：`fish` = DSH `packages/client/ui-primitives/src/FishLogo.tsx` 的 FISH_LOGO_PATH（viewBox 23.16×17.04，size=宽，`ICON_RATIO`），网页经 ds-bot `src/client/dsh-primitives.js` 再导出、`new-chat.js:101` 以 size 16 用在「添加 DSH Agent」；`memory/side/pencil/info/sliders/plug` = ds-bot `src/client/icons.js`；`feedback` = `feedback.js` FeedbackIcon；`lock` = `secret-card.js` LockIcon。
- 替换：添加 DSH Agent ⌘→fish；面板 ◫→side、▤→memory；定时任务 🕘→clock；设置页面各行补网页 PAGE_ICONS（模型 sliders/连接器·浏览器 connector/能力 plug/用量 gauge/密钥 key/反馈 feedback/关于 info）；学习卡 ✏️/🧠→pencil/memory；记忆已更新 🧠→memory；密钥卡 🔑→key、🔒→lock；callout ⓘ→info（网页源码里找不到 callout 图标，近似）。
- 间距：`Group` 新增 `inset`（标题左缩进，默认 22，关于/用量不变）；连接器/能力/浏览器/密钥 用 inset 4，标题·按钮·卡片同一左边；能力页 标题→按钮 10、按钮→卡片 12。
- 截图：docs/appearance-shots/verify-0915/（web-*.png 为网页参照）。

## 0.9.16 (vc36) — 真机反馈 4 处 + 移除 App 内自测
- **App 内已没有任何测试代码**：删掉 src/selfTest.tsx、设置里「测试 / 短自测（测试用）」、App.tsx SelfTestRunner、各页 useFT 动作注册、步骤浮层 FTLabel、LONG_TEXT 长消息演示。之后验证靠用户真机截图（+ 本地 rnw 渲染、test/*.test.mts）。test/batch0916 守住「不再出现测试代码」。
- 用量自定义日历：去掉月份 maxWidth 252，7 列铺满弹层，上/下月箭头在两侧边缘。
- 密钥图标：网页 KeyIcon 的圆用 `a3.5…0 .01z` 画，偏左且在安卓上显得小；icons.extra.ts 重画为同形状居中（circle 6.5,10 r3.5 + 柄 10→17.5）。
- TextInput 不再用固定 height：自定义强调色、密钥输入、新建会话搜索改 minHeight + paddingVertical + includeFontPadding:false + textAlignVertical:center（系统粗体/大字号不再被吞）。
- 位置 → 总工作区：文件夹选择框和行合成一个 Group 子项（不再有分隔线），左右与行文字对齐 18；Pickers 的框底色改 theme.fill，卡片里不再「卡片套卡片」。
- 截图：docs/appearance-shots/verify-0916/。
