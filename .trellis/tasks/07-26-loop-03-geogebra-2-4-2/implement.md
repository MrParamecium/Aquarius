# 实施计划

## 原则

- 只修改 `codex/loop-03-geogebra-2-4-2`，以 `main@9f8360d` 为基线。
- 先验证 GeoGebra 固定版本与单 Applet 双画图区，再编写正式外壳和课程缓存。
- 先建立能区分新旧行为的测试，再接入运行时代码。
- 数学错误按 Sev-1 处理；任何关键数值失败时停止视觉调优。
- 不批量迁移旧课程、不新增 npm 依赖、不静态加载远程脚本。

## 第 0 步：锁定基线与 GeoGebra 技术探针

- [x] 确认分支、工作区、任务状态与 `main@9f8360d` 基线。
- [x] 运行 `npm run check`、`npm run test:demo-lifecycle`、`npm run test:css-probe:check`、`npm run test:visual:check`，记录变更前结果。
- [x] 用独立临时测试页验证 `deployggb.js` + `setHTML5Codebase("https://www.geogebra.org/apps/5.4.920.0/web3d")` 能加载。
- [x] 验证一个 `appName: "classic"` Applet 可以同时显示 Graphics View 与 Graphics View 2，并能把对象稳定分配到上下视图。
- [x] 验证 `evalCommand`、`setValue/getValue`、update listener、`setSize()` 和 `remove()`。
- [x] 在 1280x800 与 390x844 视口检查双画图区不会裁切。
- [x] 把版本、API 返回值、加载资源和截图记录到本任务 `research/` 或 `verification.md`。

停止条件：双画图区或对象归属在固定版本下不稳定，则回到设计评审，不进入正式实现，不改成两个 Applet。

## 第 1 步：建立缓存与路由负向测试

- [x] 新增 `tools/check-geogebra-pilot.js`，检查：
  - 正式 `2_4-2` 缓存路径存在；
  - 只含一个 `interactive_demo` GeoGebra block；
  - `framework`、`scene`、范围、目标、容差和回退图片符合 schema；
  - 缓存不得包含任意命令字段或旧 `continuous_graphic_convolution` block；
  - Figure 2.7 位于现有 `2.4-2` figure map。
- [x] 扩展 `tools/check-demo-family-map.js` 的现有通用检查或增加定向断言，要求显式 GeoGebra demo 路由到 `geogebra`，普通 convolution 文本仍路由到 `convolution_lab`。
- [x] 在运行时代码和缓存尚未创建时运行新检查，确认因缺少路由/缓存而失败。
- [x] 将定向静态检查接入 `npm run check`，不引入测试框架。

## 第 2 步：实现 GeoGebra 通用运行时

新增 `app/interactive-demos/geogebra-runtime.js`：

- [x] 实现单例 `idle/loading/ready/failed` 加载状态。
- [x] 动态插入带稳定标识的 `deployggb.js`，页面已有 `GGBApplet` 时直接复用。
- [x] 固定 HTML5 codebase 为 `5.4.920.0`，集中声明 CDN URL 与 15 秒超时。
- [x] 失败时清理失效 script/Promise，允许显式重试；并发调用共享同一 Promise。
- [x] 实现场景 registry，只接受本地注册函数和受信 scene ID。
- [x] 实现唯一 Applet ID、注入、API ready、`setSize()` 与 `remove()` 包装。
- [x] 所有异步完成路径检查 generation/node 生命周期。
- [x] 为 fake GGBApplet 暴露最小稳定测试接口，不暴露生产任意命令执行入口。

质量门槛：`node --check`、加载器定向测试与失败重试测试通过。

## 第 3 步：实现 Figure 2.7 数学场景

新增 `app/interactive-demos/geogebra-convolution-figure-2-7.js`：

- [x] 注册 `convolution_figure_2_7` 场景。
- [x] 创建 `x(tau)`、`g(tau)`、`g(-tau)`、`g(t-tau)`、乘积、积分面积、`c(s)` 与当前输出点。
- [x] 设置上方 `tau` 图与下方 `t/c(t)` 图的坐标范围、颜色、标签、线宽和对象归属。
- [x] 建立 `t` 数值对象与范围 `[-4,3]`、步长 `0.05`、初值 `-4`。
- [x] 实现四个步骤的对象可见性和交互权限，不在 `setStep()` 中重建对象。
- [x] 注册 `t` update listener，返回 `t`、面积、输出和 `abs(t+3)<=0.08`。
- [x] 实现幂等 reset/destroy，并注销所有 listener。
- [x] 真实 API 查询验证 `t=-4,-3,-2,0` 及面积等于输出，误差不超过 `1e-6`。

停止条件：任何数学值与 PRD 不一致，先修正命令和支撑范围，不进入样式步骤。

## 第 4 步：实现 Tutor Agent 外层控制器

新增 `app/interactive-demos/geogebra-demo.js`：

- [x] 渲染标题、步骤分段控件、上一步/下一步、状态反馈、重置、固定画布和加载状态。
- [x] 根据 `spec.scene` 从 registry 获取场景；未知场景直接进入安全失败状态。
- [x] 在 `appletOnLoad` 后调用场景 `create()`，同步初始 step/state。
- [x] 步骤切换只调用 `scene.setStep()`；软引导不锁定下一步。
- [x] `t` 命中目标时更新可读状态与 `aria-live`，离开容差后恢复探索提示。
- [x] 实现加载失败回退：本地 Figure 2.7、核心公式和重试按钮。
- [x] 使用 `ResizeObserver` 更新 Applet 尺寸；移动端保持稳定画布高度。
- [x] 通过现有 cleanup 注册 generation 失效、observer 断开、场景 destroy 和 Applet remove。
- [x] 若内置 `t` 滑块未通过键盘/触屏验收，增加单一状态源的原生 range 双向同步控件。

## 第 5 步：接入 dispatcher 与页面加载顺序

### `app/interactive-demos/dispatcher.js`

- [x] 在关键词规则之前对 `spec.framework === "geogebra"` 返回 `geogebra`。
- [x] renderer 表增加 `geogebra: renderGeoGebraDemo`。
- [x] 确认普通 convolution demo 仍返回 `convolution_lab`。

### `app/index.html`

- [x] 按 runtime -> Figure 2.7 scene -> Demo 外壳 -> dispatcher 顺序增加本地脚本。
- [x] 不添加远程 GeoGebra script 标签；保持懒加载。
- [x] 更新本地 query version，避免部署缓存旧模块。

### 静态门槛

- [x] `node --check` 三个新模块与 dispatcher。
- [x] `tools/check-demo-family-map.js` 和 `tools/check-geogebra-pilot.js` 通过。

## 第 6 步：新增 `2.4-2` 正式课程缓存

- [x] 以 `workspace/materials/new-book-ocr/page-178.txt`、`page-179.txt` 和本地 Figure 2.7 为教材依据编写聚焦课程。
- [x] 课程包含目标、卷积积分、`tau` 变量说明、Figure 2.7、四步场景、首次接触推导、输出公式、常见错误和小结。
- [x] 只编码一个批准的 GeoGebra block；用结构化 JSON + Node `Buffer` 生成 `data-demo-b64`，不手工拼接 Base64。
- [x] 不复制旧缓存 Figures 2.8-2.14 和 14 个旧 Canvas Demo。
- [x] 通过 `/api/section` 实际请求确认缓存命中，图片路径和 KC block 格式有效。
- [x] 确认课程分页、教材页映射和 Figure 2.7 图片均正常。

## 第 7 步：样式与响应式

- [x] 只为 `.geogebra-demo-*` 新增专属样式，不改变现有通用 Demo 选择器的有效值。
- [x] 固定画布响应式约束，加载/成功/失败状态切换不得引发布局跳动。
- [x] 工具栏、步骤控件、反馈与画布在桌面使用紧凑布局，在移动端自然换行且不横向溢出。
- [x] 步骤、重置和重试按钮触控高度至少 44 像素，`:focus-visible` 清晰，文本 `letter-spacing: 0`。
- [x] 不使用嵌套卡片、夸张圆角、单一蓝紫配色或课程说明型装饰文案。
- [ ] 运行 CSS probe 与既有 visual diff `--check`，现有视图不得出现新回归。（已运行；既有反馈板探针与全局视觉基线仍有漂移，见 `verification.md`。）

## 第 7A 步：修复移动端讲义与问答单面板

### `app/app.js`

- [x] 新增统一的移动断点判断，只在 `900px` 及以下启用单面板模式。
- [x] 新增移动端面板归一函数，明确设置 `lecture` 或 `qa`，并保持 `isLearnChatCollapsed`、`isLearnExplainCollapsed`、`learnPanelFocus` 和 DOM 类互斥。
- [x] 移动端课程首次打开时默认进入 `lecture`；桌面继续调用原有双栏问答打开流程。
- [x] “显示问答”在移动端切到 `qa`，“显示讲义”切回 `lecture`；桌面保留现有事件行为。
- [x] 使用单例 `matchMedia` change listener 处理跨断点切换：进入移动端归一到讲义，返回桌面恢复 `normal` 双栏。
- [x] 同一移动断点内的 resize 不覆盖用户当前选择；不得让 GeoGebra renderer 读取课程面板状态。

### `app/style.css`

- [x] 在 `max-width: 900px` 内把普通课程 `.learn-body-inner` 固定为单列，并隐藏分隔条。
- [x] `chat-collapsed` 时讲义宽度为 `100%`、问答隐藏并显示“显示问答”；`explain-collapsed` 时规则相反。
- [x] 覆盖问答列已有的 `320px/360px` 最小宽度，保证 `390px` 无横向溢出。
- [x] 两个恢复按钮保持至少 `44px` 触控尺寸和可见焦点；桌面、章节概览与教材模式规则不变。

### 回归测试

- [x] 新增 `tools/test-mobile-learn-panels.js`，通过真实本地课程验证 `390x844` 默认讲义、双向切换和 `1280x800` 双栏恢复。
- [x] 测试在 `2.4-2` 第 `4 / 7` 页读取同一个 GeoGebra 诊断对象，切换前后步骤、`t` 与两个 Canvas 不丢失。
- [x] 检查讲义/问答当前列宽、页面横向溢出、恢复按钮可见性和至少 `44px` 触控高度。
- [x] 将测试接入 package scripts 与 `npm run check` 的语法检查，不让普通 CI 依赖真实 GeoGebra CDN。

## 第 8 步：自动化交互与生命周期测试

新增 `tools/test-geogebra-demo.js`，使用 fake GGBApplet/fake API：

- [x] 验证显式路由、唯一加载、并发复用和未知场景失败。
- [x] 验证四步可前后切换、`t` 状态保留、软引导和 reset。
- [ ] 验证 `t=-3 +/- 0.08` 反馈边界。（当前已覆盖 `t=-3` 命中，尚未增加边界两侧的显式断言。）
- [ ] 模拟 script error、初始化超时和重试成功。（已覆盖 loader error 与重试成功，尚未单独等待 15 秒初始化超时。）
- [ ] 模拟加载中离开课程，确认过期回调不写 DOM。（运行时有 generation / Abort 防护，尚缺加载中离开的定向自动化。）
- [x] 记录 listener/observer/remove 计数，主动 teardown 后均归零且 cleanup 幂等。
- [x] 验证回退图片、公式、重试按钮及 aria 状态。
- [x] 将脚本加入 package scripts，并在 `npm run check` 中保留静态语法检查。

扩展 `tools/test-demo-lifecycle.js` 或复用新脚本，确保 GeoGebra 生命周期契约成为永久回归门槛。

## 第 9 步：真实 CDN 与视觉验收

- [x] 启动独立端口本地服务，打开真实 `2.4-2` 课程。
- [x] 验证实际加载资源来自固定 `5.4.920.0` codebase，而不是 latest。
- [x] 从真实 Applet API 读取四个关键 `t` 值、面积和输出并记录。
- [x] 在 1280x800 与 390x844 完成四步交互、重置和课程离开/返回。
- [x] 在 390x844 完成讲义 -> 问答 -> 讲义切换，确认 Applet 不重建且当前步骤与 `t` 不丢失。
- [x] 检查 canvas 非空像素、曲线/标签未裁切、控件无重叠、工具栏/菜单/代数区不可见。
- [x] 保存桌面、移动、断网回退截图与 JSON 指标到任务 `evidence/`。
- [x] 检查 console/pageerror/requestfailed；只有人为断网测试中的 GeoGebra 请求失败可列为预期。

## 第 10 步：全量回归与记录

- [x] `git diff --check`
- [ ] `npm run check`（前置检查通过，随后被 876 个受保护的 ` 2` 重复材料文件拦截。）
- [x] `npm run test:demo-lifecycle`
- [x] GeoGebra 定向浏览器测试
- [ ] `npm run test:css-probe:check`（反馈板四项既有宽度漂移约 `0.547px`。）
- [ ] `npm run test:visual:check`（39 个视图中 1 个通过、38 个因全局基线漂移失败。）
- [x] 静态扫描确认无 `.ggb` 二进制、无 `material_id`、无旧 `continuous_graphic_convolution` 缓存迁入。
- [x] 确认 `git diff main...HEAD` 只包含本循环范围，并排除所有带 ` 2` 的用户文件及 `tools/visual-diff-coverage.json`。
- [x] 将命令、结果、数学读数、截图索引、已知限制和回滚说明写入 `verification.md`。
- [x] 评估是否需要把 GeoGebra 适配层约定补入 `.trellis/spec/app/`。

## 第 11 步：提交与 PR

- [x] 按仓库提交风格把运行时/场景、课程缓存、移动体验、测试/证据拆成四个连贯提交。
- [x] 提交前向用户展示 commit 分组和排除边界，并取得推送确认。
- [ ] 推送 `codex/loop-03-geogebra-2-4-2` 并创建合并到 `main` 的中文 PR。
- [ ] 等待远端检查和用户实际体验；不得自动合并。

## 最终停止条件

只有当真实 `2.4-2` 课程能在一个 Applet 内连续完成四步、关键数学值正确、断网有回退、课程切换无资源残留、桌面/移动视觉可用且全部门槛通过时，本试点才可以进入 PR。任一条件失败时保留当前分支诊断，不扩大到其他章节。
