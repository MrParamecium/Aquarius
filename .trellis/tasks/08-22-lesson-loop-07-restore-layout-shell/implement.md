# 实施计划

完整逐步代码计划：`docs/superpowers/plans/2026-08-22-convolution-restore-old-shell.md`

## 第 0 步：实施门槛

- [x] 用户确认 `prd.md` 与 `design.md`。
- [x] 完成五任务实施计划。
- [x] 运行 `python3 ./.trellis/scripts/task.py validate 08-22-lesson-loop-07-restore-layout-shell`。
- [x] 用户明确选择执行方式后才运行 `python3 ./.trellis/scripts/task.py start 08-22-lesson-loop-07-restore-layout-shell`。
- [x] `task.py start` 前不修改 `app/`、测试或视觉基线。

保护边界：不提交四张既有视觉 baseline、`.superpowers/`、任务 artifacts、`workspace/memory/*`、`workspace/materials/lesson-cache/2_4/` 或用户未采用图片。

## 第 1 步：建立失败的旧壳层契约

- [x] 修改 `tools/test-convolution-lesson-layout.js`，读取 `data-convolution-template`、`.convolution-reading-surface`、Phase 父层、Stage/Tab 宽度和嵌套卡计算样式。
- [x] 锁定映射：Overview=`overview`，Lesson 1–5=`reading`，6–15=`demo`，16–18=`finish`，Practice=`practice`。
- [x] 锁定每页一个主阅读面、标题内 Phase、全宽三等分 Stage、透明内层教学壳和 Demo 约 `43/57`。
- [x] 运行 `npm run test:convolution-layout`，确认只因上述能力尚未实现而失败（`38/42` 通过，4 项预期失败）。
- [x] 提交：`test: define restored convolution shell contract`。

回滚点：本提交只修改测试。

## 第 2 步：实现模板、Stage 和标题层

- [x] 在 `app/lesson-render.js` 增加纯函数 `getConvolutionPageTemplate(stageState)`。
- [x] `buildConvolutionStageNavHtml()` 只输出三段 Stage；新增 `buildConvolutionPhaseProgressHtml()`。
- [x] `buildLessonPageFrameHtml()` 输出 `data-convolution-template` 和唯一 `.convolution-reading-surface`，Phase 放进 `.lesson-page-heading`。
- [x] `.convolution-demo-page` 只在模板为 `demo` 且 hydrate 后存在 `.geogebra-demo-shell` 时添加。
- [x] 整理 `app/style.css` 的 Stage/Phase 规则：Stage 全宽三等分，Phase 是标题右侧轻量提示。
- [x] 运行 `node --check app/lesson-render.js`、layout（`42/42`）和 micro test（`7/7`）。
- [x] 提交：`feat: restore convolution stage and title hierarchy`。

回滚点：回滚该提交恢复 Loop 06 导航与 Phase 外观，不触碰课程数据。

## 第 3 步：恢复 Reading、Demo 和 Finish 壳层

- [x] 先给 layout test 增加不透明主阅读面、透明 teaching card、Reading/Finish 宽度和 `43/57` 比例断言并确认失败。
- [x] 用 2.4-2 模板范围内的同级选择器收束既有竞争规则，没有建立第二套页面壳层。
- [x] 主阅读面使用稳定白色/深色不透明表面；Reading/Finish 约 `72ch`，Demo 不限窄宽。
- [x] 保留互动 DOM，只移除 teaching card、Exit Check root、GeoGebra shell 的边框、阴影和毛玻璃。
- [x] Demo 在足够宽的真实课程容器内使用约 `43% / 57%`，保留既有等比例 canvas、Fallback 和生命周期。
- [x] 公式使用浅灰底 + 橙色左边线；Learning goal/You can now 使用浅绿底 + 绿色左边线。
- [x] 运行 layout（`43/43`）、GeoGebra（`14/14`）、lifecycle（`6/6`）和 Exit Check（`5/5`）tests。
- [x] 提交：`style: restore convolution lesson reading shell`。

回滚点：回滚该提交恢复 Loop 06 卡片外观，模板和导航仍可独立存在。

## 第 4 步：统一 Practice、主题和响应式

- [x] layout test 锁定 Practice 一个主阅读面、五步导航在当前 panel 上方、一个活动 panel 和透明 Practice root。
- [x] 不修改 `app/convolution-practice.js` 的答案、状态或 DOM；当前结构足够由 CSS 完成统一壳层。
- [x] Practice 五步行置于阅读面顶部；桌面使用约 `43/57` 的 builder/Demo 双栏，移动端纵向。
- [x] `390x844` 和 `430x932` 下 Stage 不横滚、Phase 换行、Demo 上下排列、分页器和移动菜单可达。
- [x] 深色正文使用 alpha=1 的高对比表面；无 `backdrop-filter` 时 Stage 使用不透明 fallback。
- [x] 运行 layout（`50/50`）、Practice（`3/3`）、Exit Check（`5/5`）、mobile（`8/8`）、GeoGebra（`14/14`）和 lifecycle（`6/6`）tests。
- [x] 提交：`style: unify convolution practice and responsive shell`。

回滚点：回滚该提交只恢复 Practice/主题/移动壳层，不改变答案模型。

## 第 5 步：全量回归与双语验收

- [x] 运行 `git diff --check`、syntax check、convolution visuals、layout、micro、Practice、Exit Check、GeoGebra、lifecycle 和 mobile tests。
- [x] 运行 CSS probe、visual check 和 `npm run check`；Visual 为 `33/35`，两个既有 Textbook Overview 场景均为 `3505 / 1024000 = 0.342%` 文字抗锯齿波动，没有重做 baseline 掩盖差异。
- [x] 使用 `TUTOR_CONVOLUTION_LAYOUT_EVIDENCE_DIR` 生成 `1280x720`、`1440x900 + Tutor`、`390x844` 和 `430x932` 证据并人工检查。
- [x] 手动走完 Overview → Reading → Demo → Exit Check → Practice，并验证 Tutor、Home/Escape、Fallback/Retry。
- [x] 在 `verification.md` 写中文详细验收和 `English Summary`；`npm run check` 原样记录既有缓存例外：`Parent-prelude count mismatch: got 15, expected 14`。
- [x] 用 `git status --short` 和 `git diff --name-only 9473b6c...HEAD` 确认受保护文件未提交。
- [x] 本轮仅遵循现有 scoped CSS 规范，无需更新全局 spec。
- [x] 提交：`docs: verify restored convolution lesson shell`。

最终交付：停留在本地 `codex/lesson-loop-07-restore-layout-shell`，不 push、不创建 PR、不合并，等待用户验收。
