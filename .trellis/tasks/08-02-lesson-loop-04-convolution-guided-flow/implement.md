# 实施计划

## 第 0 步：锁定分支与任务边界

- [ ] 用户确认本实施计划后，从计划提交创建 `codex/lesson-loop-04-convolution-guided-flow`。
- [ ] 将 `task.json.branch` 更新为 Loop 04 分支，`base_branch` 保持 `codex/lesson-loop-03-convolution-reading-structure`。
- [ ] 执行 `python3 ./.trellis/scripts/task.py start 08-02-lesson-loop-04-convolution-guided-flow` 后才修改生产课程、CSS 或测试。
- [ ] 实施期间不拉取、合并或变基远端 `main`。

回滚点：删除未推送的 Loop 04 分支即可返回当前计划提交，不影响第三版提交历史。

## 第 1 步：记录第四版改动前基线

- [ ] 确认工作区除规划文件外无未提交修改，记录 HEAD 和真实命中的 2.4-2 缓存路径。
- [ ] 运行：
  - `npm run check:convolution-visuals`
  - `npm run test:convolution-layout`
  - `node tools/check-geogebra-pilot.js`
  - `npm run test:geogebra`
  - `npm run test:mobile-learn-panels`
  - `npm run check`
- [ ] 在任何 CSS 修改前运行并提交基线：
  - `npm run test:css-probe:baseline`
  - `npm run test:visual:baseline`
- [ ] 记录当前 `8/8` 页面结构、720ms 锁定时间和第三版截图，作为第四版前态。

回滚点：基线提交只包含测试证据，不含生产代码，可以独立回滚。

## 第 2 步：先建立会失败的第四版契约

### 2.1 静态课程契约

- [ ] 更新 `tools/check-convolution-lesson-visuals.js`，先锁定：
  - 2.4-2 专属章节简介标记存在，且不再输出旧 Objective/Concepts 大卡片文案；
  - 六个 H2 按 What → Why → How → How → Demo → Context 排列；
  - 概念页使用页边编号标记，步骤页使用时间轴标记；
  - 旧大号 `.convolution-island-number` 不再出现在课程缓存；
  - 两张 V2 图片、三张既有代码图解和唯一 GeoGebra 保持存在；
  - Figure 2.7 的幅值、关键边界和教材用途词保持正确。

### 2.2 真实阶段与动画契约

- [ ] 更新 `tools/test-convolution-lesson-layout.js`，先锁定：
  - 三个阶段按钮存在并标明当前阶段；
  - 现有 8 个索引被映射为 `1 / 6 / 1`；
  - 从讲解第 4 页跳到练习，再返回讲解时仍回到第 4 页；
  - 底部 pager 显示阶段语义，不再显示误导性的全局页码；
  - 2.4-2 动画在 250ms 内完成，纸张翻页伪元素不再参与绘制；
  - 减少动画模式立即提交；
  - 桌面、390px、430px 没有溢出，阶段导航和按钮可键盘操作。
- [ ] 在生产文件修改前运行两项契约，确认只因第四版尚未实现而失败。
- [ ] 以 `test: 锁定卷积第四版分阶段契约` 单独提交失败契约。

回滚点：本提交只修改测试。如果阶段模型无法在不破坏现有 8 页解析器的前提下实现，回到设计复核，不新建第二套分页器。

## 第 3 步：实现课程专属阶段模型

- [ ] 在 `app/lesson-render.js` 增加 2.4-2 专属阶段映射函数，不改变其他课程的 block 解析。
- [ ] 在页面框架中输出三阶段分段导航和稳定 `data-lesson-stage`、`data-stage-position` 标记。
- [ ] 绑定阶段按钮：简介跳索引 0，讲解跳最近知识页，练习跳最终 quiz 页。
- [ ] 在 `resetLearnKnowledgePointState()` 中清理最近知识页状态。
- [ ] 所有跳转继续调用 `renderCurrentKnowledgePoint()` 和 `replaceLearnContent()`，保留 GeoGebra teardown/hydrate 顺序。
- [ ] 向 pager 暴露只读阶段状态；异常时返回 `null`，让旧分页逻辑接管。
- [ ] 运行 JavaScript 语法检查和定向阶段契约。

回滚点：移除阶段辅助函数和导航输出即可恢复现有 8 页线性分页，不影响缓存内容。

## 第 4 步：重排简介、六页讲解与练习

- [ ] 只修改实际命中的缓存：`workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`。
- [ ] 第一页改为“你已经知道 / 这一节解决什么 / 学习路线”，准确提炼教材纸质页 178 的三个理由。
- [ ] 六个讲解页按已确认顺序重排，明确积分变量是 `τ`，`t` 是参数。
- [ ] 普通概念块输出页边编号标记；只有翻转、平移、相乘、积分使用连续时间轴。
- [ ] 墨水池与洒水车原有口语类比和两张 V2 图片继续保留。
- [ ] GeoGebra block、场景名、初始值、滑块范围、降级图和关键教材数值不修改。
- [ ] 练习页增加三项准备任务并保留现有 Quick Check 入口，不新增题库协议。
- [ ] 运行静态课程契约直到通过。

回滚点：恢复单个缓存文件即可回到第三版课程内容；图片与 GeoGebra 文件无需回滚。

## 第 5 步：实现 A/C 视觉规则和快速切换

- [ ] 在 `app/style.css` 的 2.4-2 课程专属区域实现：
  - 三阶段分段导航；
  - A 方案页边编号和细分隔线；
  - C 方案连续时间轴；
  - 桌面与移动端稳定尺寸、焦点态和深色模式。
- [ ] 2.4-2 不再输出厚重内容岛和大号 `01/02/03`，但不删除其他页面可能使用的兼容样式。
- [ ] 在 2.4-2 激活状态下禁用纸张翻页伪元素，改用 160–180ms 淡入和轻微水平位移。
- [ ] 在 `runLearnPageTurn()` 中为 2.4-2 使用约 70ms 提交点、180ms 总锁定；其他课程保持原值。
- [ ] `prefers-reduced-motion` 保持无动画直接切换。
- [ ] 使用课程专属选择器，避免修改无关全站级联。

回滚点：移除课程专属阶段与动画规则，并恢复两个定时值分支，即可恢复第三版视觉和翻页行为。

## 第 6 步：接通 pager、完成状态与降级路径

- [ ] 在 `app/ui-friction-fixes.js` 的 pager 刷新逻辑中优先读取阶段状态：
  - 简介显示“章节简介”；
  - 知识页显示“讲解 n / 6”；
  - quiz 显示“练习巩固”。
- [ ] 上一页、下一页仍按现有索引移动，边界行为和下一小节逻辑不变。
- [ ] 只有到达练习页时才标记本小节完成。
- [ ] 阶段状态缺失时退回原 `n / total` 文案和原边界判断。
- [ ] 验证动画期间重复点击不会跨过页面或误触发下一小节。

回滚点：pager 读取阶段状态的分支可以独立移除，旧分页显示和完成逻辑仍然可用。

## 第 7 步：自动化回归

- [ ] `git diff --check`
- [ ] `npm run check:convolution-visuals`
- [ ] `npm run test:convolution-layout`
- [ ] `node tools/check-geogebra-pilot.js`
- [ ] `npm run test:geogebra`
- [ ] `npm run test:mobile-learn-panels`
- [ ] `npm run check`
- [ ] `npm run test:css-probe:check`
- [ ] `npm run test:visual:check`
- [ ] 检查 `git diff --name-only`，生产改动只落在计划允许的课程缓存、渲染器、pager、课程专属 CSS 和定向测试。

任何强制命令失败都不更新期望值掩盖问题；GeoGebra 数学值、其他课程动画或下一小节边界变化均视为阻断。

## 第 8 步：真实页面视觉验收

- [ ] 在未占用端口启动本分支服务，验证 `/health` 和 2.4-2 的真实 `/api/section`。
- [ ] 桌面逐阶段检查简介、讲解 1–6、练习，并验证直接跳转和返回位置恢复。
- [ ] 390px 与 430px 检查阶段导航、公式、页边编号、时间轴、两张 V2 图片、GeoGebra 和底部分页器。
- [ ] 用性能时间戳记录 2.4-2 翻页结束小于 250ms，并目视确认没有纸张翻面。
- [ ] 检查控制台和网络：无新增 JavaScript error、图片 404、GeoGebra 生命周期错误或空白阶段。
- [ ] 截图保存到本任务 `evidence/`，至少包含桌面三个阶段、移动端页边编号、移动端时间轴和 GeoGebra。

## 第 9 步：双语验收与交付

- [ ] 在 `verification.md` 先写完整中文验收，再写英文摘要，记录命令结果、视口、阶段映射、动画耗时和证据路径。
- [ ] 更新 `workspace/memory/2026-08-02.md`，记录第四版取舍、测试结论和下一轮反馈入口。
- [ ] 最后重跑第 7 步全部强制命令和 `git diff --check`。
- [ ] 生产实现以 `feat: 实现卷积分阶段学习流程` 提交，验收记录以 `docs: 记录卷积第四版验收` 提交。
- [ ] 保持分支不推送、不创建 PR、不合并；用户先复核页面和提交历史。

最终回滚：回滚生产实现提交即可恢复第三版；基线、测试契约和验收文档保留为审计证据。
