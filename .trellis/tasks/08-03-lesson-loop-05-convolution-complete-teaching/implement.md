# 实施计划

## 第 0 步：锁定分支与任务边界

- [ ] 用户确认本计划后，从规划提交创建 `codex/lesson-loop-05-convolution-complete-teaching`。
- [ ] 将任务 `branch` 更新为 Loop 05 分支，`base_branch` 保持 `codex/lesson-loop-04-convolution-guided-flow`。
- [ ] 执行 `task.py start 08-03-lesson-loop-05-convolution-complete-teaching` 后才修改正式课程、JS、CSS 或测试。
- [ ] 实施期间不拉取、合并、变基、推送或创建 PR。

回滚点：删除未推送的 Loop 05 分支即可回到本规划提交。

## 第 1 步：记录第五版改动前基线

- [ ] 确认工作区只有已批准的规划文件，记录 HEAD 和真实命中的 2.4-2 缓存路径。
- [ ] 运行现有定向检查：
  - `npm run check:convolution-visuals`
  - `npm run test:convolution-layout`
  - `node tools/check-geogebra-pilot.js`
  - `npm run test:geogebra`
  - `npm run test:mobile-learn-panels`
  - `npm run check`
- [ ] 在任何 CSS 修改前运行 `npm run test:css-probe:baseline` 与 `npm run test:visual:baseline`，提交第五版前基线。
- [ ] 保存当前 `1 / 6 / 1` 阶段结构、Figure 2.7 Demo 和桌面/移动截图。

回滚点：基线提交只包含测试证据，不含第五版生产代码。

## 第 2 步：先建立会失败的第五版契约

### 2.1 内容与阶段契约

- [ ] 更新 `tools/check-convolution-lesson-visuals.js`，锁定 Overview 文案、公式、三个核心动作、12 个 Lesson 标题、教材函数、两张插图位置和 Figure 2.14。
- [ ] 更新 `tools/test-convolution-lesson-layout.js`，锁定 `1 / 12 / 1` 阶段映射、置顶导航、Overview 无底部 pager、柔性跳转、页码恢复和 180ms 动画。
- [ ] 删除旧测试对六页布局、页边 `01` 标记和唯一 Demo block 的过期断言，替换为第五版语义断言。

### 2.2 GeoGebra 与 Practice 契约

- [ ] 扩充 `tools/test-geogebra-demo.js`，先锁定四个教材预设、五步状态、三层同步、数值结果、失败降级和单次销毁。
- [ ] 新增 `tools/test-convolution-practice.js`，锁定 Drills 2.10–2.13、首次尝试后提示、曲线拼装判定、具体区间反馈和恢复状态。
- [ ] 在生产文件修改前运行这些契约，确认失败原因只来自第五版尚未实现。
- [ ] 单独提交失败契约，便于回滚和审查。

回滚点：本步骤只改测试；如果数学或交互合同无法明确，返回设计复核，不用 UI 绕过。

## 第 3 步：重写 Overview 与 12 页教材内容

- [ ] 只修改真实缓存 `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`。
- [ ] Overview 写入批准目标、核心公式、三个动作和唯一 `Start Lesson`。
- [ ] 按批准顺序写入 12 个 H2 页面；每页一个核心问题，短段落、Bullet Points、公式块和教材图解。
- [ ] Page 1 放墨水池 V2 图，Page 2 放 Figure 2.14 教材关系图，Page 7 放洒水车 V2 图。
- [ ] Pages 5–9 写入 Figure 2.7 五个任务配置；Pages 10–12 写入 Examples 2.10–2.12 的教材函数与渐进提示配置。
- [ ] 运行内容契约直到通过，并确认课程缓存不存在中文产品文案。

回滚点：恢复单个缓存文件即可回到第四版课程内容。

## 第 4 步：扩充阶段映射、分页和恢复状态

- [ ] 在 `app/lesson-render.js` 将 2.4-2 阶段映射从 6 个 knowledge 扩充为 12 个，保持其他课程通用解析不变。
- [ ] 增加版本化的 2.4-2 会话状态读写、输入校验和页码 clamp。
- [ ] `Start Lesson` 跳到 Lesson 1；顶部三个阶段始终可用；返回 Lesson 恢复最近页。
- [ ] 在 `app/ui-friction-fixes.js` 隐藏 Overview 底部分页，Lesson 显示 `n / 12`，Practice 显示阶段语义。
- [ ] Guided Pages 5–9 根据任务完成状态控制 `Continue`；GeoGebra 降级时启用继续路径。
- [ ] 保持现有 180ms 时间合同和减少动态效果分支，不影响其他课程。

回滚点：移除 12 页映射和版本化状态分支即可恢复第四版 `1 / 6 / 1`。

## 第 5 步：建立教材预设与三层卷积引擎

- [ ] 新增纯数据/纯求值的教材预设注册表，包含 Figure 2.7 与 Examples 2.10–2.12。
- [ ] 扩充 `app/interactive-demos/geogebra-convolution-figure-2-7.js` 的场景控制器，使其接受 preset 和五个 step，同时保留旧场景 id。
- [ ] 在一个 Graphics 视图中建立 Signals、Product、Output 三个纵向坐标带；三层使用同一个 $t$ 值更新。
- [ ] 输出原子状态 `{ preset, step, t, overlap, area, output }`，并提供 reset、restore、destroy。
- [ ] 对四个预设的支撑区间、分界点和代表性 $t$ 值运行数值测试。

回滚点：旧 Figure 2.7 场景 id 与原入口保持兼容；移除新 preset 分支即可恢复原 Demo。

## 第 6 步：重做 Guided Demo 容器

- [ ] 在 `app/interactive-demos/geogebra-demo.js` 增加受 Lesson 页面控制的第五版模式，移除该模式内重复的步骤标签和 Previous/Next。
- [ ] 五页分别只暴露当前操作需要的控件，其他状态保持可见但不可误操作。
- [ ] 完成操作时写入 Guided task 状态并刷新外部分页 `Continue`。
- [ ] 切页时先销毁 applet 与监听器，再从保存的 preset、step 和 $t$ 恢复。
- [ ] 加载失败时显示静态三层图、公式、Retry 和可继续状态。

回滚点：第五版受控模式由课程配置触发，旧 GeoGebra Demo 模式可以独立保留。

## 第 7 步：实现三道 Worked Examples 的渐进提示

- [ ] Example 2.10 显示重叠区间，检查学生填写的积分上下限。
- [ ] Example 2.11 先检查 $t<0$ 与 $t\ge0$ 的分界和区间选择，首次错误后展示提示。
- [ ] Example 2.12 先检查输出支撑 $[-1,4]$、宽度 5 和总体形状，再展开三个分段区间。
- [ ] 三页复用同一教材预设引擎，不复制滑块、事件或清理逻辑。
- [ ] 反馈全部使用英文，并通过 `aria-live="polite"` 宣布。

回滚点：各例题由独立 preset 和提示配置驱动，可以逐题禁用而不影响 Figure 2.7。

## 第 8 步：实现 Practice 曲线拼装

- [ ] 新增聚焦的 2.4-2 Practice 模块，并在 `app/index.html` 按现有 plain-script 顺序加载。
- [ ] 将 `buildLessonTestBannerHtml()` 的 2.4-2 分支改为 Drills 2.10–2.13 容器；其他课程继续使用通用 Quick Check。
- [ ] 实现翻转信号选择、支撑端点输入、分界点放置和区间曲线类型选择。
- [ ] 用语义答案比较器返回第一个错误字段或区间；不做像素判分。
- [ ] 首次提交后才启用 Hint；正确后标记 `Mastered`；刷新恢复 `Not Started / In Progress / Mastered`。
- [ ] 为键盘操作、焦点顺序、错误提示和移动端触控目标添加定向测试。

回滚点：移除 2.4-2 Practice 分支即可恢复第四版通用 Quick Check，不影响其他章节。

## 第 9 步：落实课程专属视觉规则

- [ ] 只在 `app/style.css` 的 2.4-2 专属区域调整 Overview、置顶阶段栏、教学块、三层 Demo、例题和 Practice。
- [ ] 删除第五版内容对大号边框 `01/02/03` 的依赖；保留其他页面需要的兼容样式。
- [ ] 落实桌面 18px、移动端至少 16px、行高至少 1.6、正文约 72ch。
- [ ] 为三层图和曲线拼装器定义稳定高度、移动端纵向布局和无重叠约束。
- [ ] 验证标准主题和项目既有暗色主题，但不新增或重做主题系统。

回滚点：所有新增规则使用 2.4-2 专属作用域，可以整段回滚而不改变其他课程。

## 第 10 步：自动化回归

- [ ] `git diff --check`
- [ ] `npm run check:convolution-visuals`
- [ ] `npm run test:convolution-layout`
- [ ] `node tools/check-geogebra-pilot.js`
- [ ] `npm run test:geogebra`
- [ ] `node tools/test-convolution-practice.js`
- [ ] `npm run test:mobile-learn-panels`
- [ ] `npm run check`
- [ ] `npm run test:css-probe:check`
- [ ] `npm run test:visual:check`
- [ ] 视觉差异只允许出现在批准的 2.4-2 页面；其他视图发生差异即阻断。

## 第 11 步：真实页面视觉与交互验收

- [ ] 在未占用端口启动当前分支服务，验证 `/health` 和真实 `/api/section`。
- [ ] 桌面逐页检查 Overview、Lesson 1–12、Practice 2.10–2.13。
- [ ] 在 390px、430px 和 1280px 视口检查置顶导航、公式、图片、三层图、曲线拼装和底部按钮。
- [ ] 实际完成五步 Guided Demo，验证切页恢复 $t$ 与任务状态。
- [ ] 阻断 GeoGebra 网络请求，验证静态降级和继续路径。
- [ ] 检查控制台、网络、画布像素和元素边界：无新增错误、404、空白图、遮挡或意外横向滚动。
- [ ] 保存桌面和移动端证据截图到任务 `evidence/`。

## 第 12 步：双语验收与交付

- [ ] 在 `verification.md` 逐项写中文验收结果与英文摘要，记录命令、视口、数学采样值、失败降级和证据路径。
- [ ] 更新项目记忆，记录第五版结构、教材函数、测试结果和下一轮反馈入口。
- [ ] 重跑第 10 步全部强制命令和 `git diff --check`。
- [ ] 按层提交测试、内容/导航、GeoGebra、Practice、CSS 和验收记录，保持每个回滚点清晰。
- [ ] 不推送、不创建 PR、不合并；用户先审阅本地页面和提交历史。

最终回滚：回滚第五版生产提交即可恢复第四版；测试契约、基线和验收证据保留用于审计。

