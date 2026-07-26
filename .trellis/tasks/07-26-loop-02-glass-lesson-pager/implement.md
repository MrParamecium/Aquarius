# 实施计划

## 原则

- 只修改 `codex/loop-02`，旧桌面项目保持只读。
- 先证明基线与测试有效，再修改运行时代码。
- 书角导航按 DOM、行为、状态同步、CSS、测试探针的完整纵向切片删除。
- CSS 必须按选择器分支处理；不得按大段行号删除混合规则。
- 任一行为门槛失败立即停止，不继续更新视觉基线。

## 第 0 步：锁定基线

- [ ] 确认分支为 `codex/loop-02`，工作区干净，HEAD 包含设计提交 `094b575`。
- [ ] 记录 `origin/main` 与当前 HEAD；确认业务代码仍与 `a02c34c` 一致。
- [ ] 运行 `npm run check`。
- [ ] 启动隔离端口服务并运行当前 `npm run test:ui-friction`。
- [ ] 运行现有 CSS probe 与 visual diff 的 `--check`，证明提交前基线可复现。
- [ ] 将基线命令、结果和已知噪声记录到本任务 `verification.md`。

失败条件：任一现有门槛在未改业务代码前失败，则先诊断环境或基线，不进入删除步骤。

## 第 1 步：先建立新契约测试

- [ ] 扩展 `tools/test-ui-friction-v123.js`：
  - 断言页面不存在两个书角按钮及 `.lecture-page-corner`、`.page-turner`；
  - 断言底部分页器 DOM 仍存在且只有一个；
  - 注入零、单个和两个知识点状态，调用 `__ftutorRefreshPager()` 后核对显隐；
  - 核对两个知识点时首、中/末状态所需的 `Prev`、`Next`、页码和 `Next topic` 行为；
  - 核对毛玻璃 computed style、44 像素触控高度、禁用态与 `:focus-visible` 契约。
- [ ] 在修改运行时代码前运行新测试，确认它因书角仍存在或旧实色样式而失败。
- [ ] 保存精确失败断言，证明测试不是空检查。

失败条件：新测试在旧实现上直接通过，说明断言没有区分新旧行为，必须先修正测试。

## 第 2 步：删除书角 DOM 与 JavaScript 行为

### `app/index.html`

- [ ] 删除 `#lecturePrevOverlayBtn`、`#lectureNextOverlayBtn` 及其 `.turner-content` 子节点。
- [ ] 保留 `#learnExplainPager` 的结构、图标、语义和 ID。

### `app/app.js`

- [ ] 删除两个书角 DOM 常量。
- [ ] 删除 `animateLectureNavButton()`、书角命中检测、去重时间戳和捕获事件处理函数。
- [ ] 删除课程清空和布局切换中的书角禁用/显隐写入。
- [ ] 删除书角按钮直接点击监听，以及文档级 `pointerdown`/`click` 捕获监听。
- [ ] 保留 `learnKpPrevBtn`、`learnKpNextBtn` 与 `moveLearnKnowledgePoint()`。

### `app/lesson-render.js`

- [ ] 删除顶部依赖说明中的书角引用。
- [ ] 删除知识点渲染时查询书角按钮和同步禁用状态的代码。
- [ ] 保留现有知识点按钮状态与 `window.__ftutorRefreshPager()` 调用。

### `app/ui-friction-fixes.js`

- [ ] 从底部分页器点击路径删除 `animateLectureNavButton(delta)` 调用。
- [ ] 在 `refreshPagerNow()` 中加入明确的 `points.length < 2` 隐藏门槛，并重置末页过渡状态。
- [ ] 保留现有知识点导航、完成标记和末页跨小节行为。

### 静态门槛

- [ ] 使用 `rg` 确认 `app/**/*.html` 与 `app/**/*.js` 不再引用书角 ID、专属类和专属函数。
- [ ] 运行语法检查和新契约测试；确认无 `ReferenceError`、无双触发、无跳页。

建议提交：`refactor: 删除课程书角导航`

## 第 3 步：按选择器分支删除书角 CSS

- [ ] 在修改前保存以下书角令牌的完整引用清单：
  - `lecturePrevOverlayBtn`
  - `lectureNextOverlayBtn`
  - `lecture-page-corner`
  - `page-turner`
  - `turner-content`
- [ ] 处理 `app/style.css`：
  - 整条规则仅包含书角分支时删除整条规则；
  - 与其他控件混合时只移除书角分支；
  - 媒体查询与 `prefers-reduced-motion` 中使用相同规则。
- [ ] 处理 `app/css/runtime-collapsed.css`，遵守同一分支删除协议。
- [ ] 删除后再次扫描五个令牌，运行时代码和 CSS 中结果必须为零。
- [ ] 对所有被重写的混合规则，比较前后其他活选择器集合，要求完全一致。
- [ ] 运行 `git diff --check`、`npm run check`，并检查 CSS 括号与媒体查询结构。

失败条件：任何非书角控件的 computed style 或活选择器集合发生变化，立即恢复对应规则并缩小删除粒度。

建议提交：`refactor: 清理书角导航样式`

## 第 4 步：实现毛玻璃底部分页器

只在 `app/css/ui-friction-v123.css` 维护最终分页器皮肤：

- [ ] 外壳改为半透明中性白色背景。
- [ ] 同时设置 `backdrop-filter` 与 `-webkit-backdrop-filter`，使用模糊和适度饱和；不支持时依靠半透明背景保证可读。
- [ ] 使用一像素半透明描边、柔和多层阴影和轻量内高光，移除粗黑边与硬偏移阴影。
- [ ] 内部按钮使用较轻的半透明表面和细描边，最小高度 44 像素。
- [ ] 默认、悬停、按下、禁用、`is-next-topic` 和 `:focus-visible` 状态均独立可辨认。
- [ ] 页码使用稳定最小宽度与等宽数字，所有分页器文本 `letter-spacing: 0`。
- [ ] 动态 `Next`/`Next topic` 标签不得改变外壳位置或造成明显宽度跳动。
- [ ] 增加移动端约束：收紧间距与水平内边距，但保持单行、页码和 44 像素触控高度。
- [ ] 根据实际截图调整课程正文底部预留空间，确保不遮挡最后一行内容。

建议提交：`feat: 将课程分页器改为毛玻璃样式`

## 第 5 步：更新 CSS 探针与视觉证据

### CSS 探针

- [ ] 从 `tools/css-probe.js` 删除 `S-page-corner` 状态及所有书角探针。
- [ ] 增加底部分页器状态，进入真实分段课程并断言分页器处于显示状态。
- [ ] 探测能区分新旧实现的属性：`background-color`、`backdrop-filter`、边框宽度/颜色、阴影、按钮最小高度、禁用态和焦点态。
- [ ] 更新 `tools/css-probe-baseline.json`，只接受已批准分页器属性的变化；不得让其他状态或控件消失。

### 视觉验收

- [ ] 先运行 visual diff `--check`，记录实际变化的课程视图。
- [ ] 检查变化只来自书角消失和底部分页器皮肤；课程正文、教材区、问答栏和布局比例不得漂移。
- [ ] 人工检查代表性桌面视口与移动视口截图。
- [ ] 验收后才更新受影响视觉基线，再运行 `--check` 确认稳定。
- [ ] 对图片做非空像素检查，确认截图不是加载失败或空白页。

建议提交：`test: 覆盖课程分页器交互与视觉状态`

## 第 6 步：全量回归

- [ ] `git diff --check`
- [ ] `npm run check`
- [ ] `npm run test:ui-friction`
- [ ] `npm run test:css-probe:check`
- [ ] `npm run test:visual:check`
- [ ] 在桌面视口执行 `Prev -> Next -> Next topic`，核对每次只移动一步。
- [ ] 在移动视口检查分页器不越界、不遮挡、不与问答栏重叠。
- [ ] 检查浏览器控制台无新增错误。
- [ ] 最终静态扫描确认书角令牌在运行时和测试代码中为零。
- [ ] 确认旧桌面项目 git 状态未被本循环改变。

## 第 7 步：证据、记录与 PR

- [ ] 把基线、新测试负向证据、静态清零、桌面/移动截图、交互结果和全量回归写入本任务 `verification.md`。
- [ ] 更新 Trellis 任务验收项和 Codex 会话日志。
- [ ] 检查分支 diff 只包含本循环允许范围。
- [ ] 推送 `codex/loop-02` 并创建合并到 `main` 的中文 PR。
- [ ] 等待远端检查通过并由用户审阅；不得自动合并。

## 最终停止条件

只有当书角路径完整清零、底部分页器行为与毛玻璃视觉通过桌面/移动验证、所有门槛通过且证据已保存时，Loop 02 才结束。任一门槛失败时保留分支用于诊断，不扩大范围，不恢复第二套导航。
