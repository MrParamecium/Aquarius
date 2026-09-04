# Loop 07 最终验收记录

## 中文验收

### 结论

2.4-2 Graphical Understanding of Convolution Operation 已恢复为旧版更清晰的课程阅读壳层，同时保留 Loop 06 已完成的课程内容、GeoGebra Demo、Practice、Tutor 和专注布局能力。本轮没有新建第二套课程页面，也没有改变现有 `lesson cache -> lesson renderer -> stage navigation` 流程。

课程页面现在统一使用五类模板：`overview`、`reading`、`demo`、`finish` 和 `practice`。每页只有一个主阅读面，Stage 使用全宽三等分导航，WHAT / WHY / HOW 回到标题层；学习者可见文案继续保持英文。

### 已验收功能

- Overview、Reading、Demo、Finish 和 Practice 均使用唯一 `.convolution-reading-surface`，没有卡片套卡片。
- Reading 与 Finish 正文宽度约为 `72ch`；Demo 桌面使用约 `43% / 57%` 的讲解/交互双栏，移动端改为上下排列。
- Stage 始终为全宽三等分导航；Phase 在桌面位于标题右侧，在移动端换到标题下一行。
- Teaching、Exit Check、GeoGebra 和 Practice 根壳保持透明，公式与学习目标使用高对比、语义明确的阅读强调样式。
- Practice 保留 `Predict -> Plan -> Build -> Calculate -> Sketch` 五步结构；步骤条位于活动面板上方，builder / Demo 桌面约为 `43% / 57%`。

### 人工视觉检查

| 场景 | 结果 |
| --- | --- |
| `1280 x 720`，Tutor 收起 | 主讲解面、Stage、Demo 双栏和底部分页器布局正常，无异常遮挡 |
| `1440 x 900`，Tutor 展开 | 讲解区保持主要宽度，Tutor 与 Demo 均可用，页面层级清晰 |
| `390 x 844` | Phase 正确换行；Demo 纵向排列；Stage、分页器和移动导航可达 |
| `430 x 932` | 移动版阅读面宽度、纵向 Demo 和交互区均正常 |

证据截图生成在仓库外的系统临时目录：

- `/tmp/tutor-loop07-evidence.oHtmhI/focus-1280x720.png`
- `/tmp/tutor-loop07-evidence.oHtmhI/focus-1440x900-tutor.png`
- `/tmp/tutor-loop07-evidence.oHtmhI/focus-390x844.png`
- `/tmp/tutor-loop07-evidence.oHtmhI/focus-430x932.png`

人工检查确认桌面比例、Tutor 展开状态、移动端 Phase 换行和纵向 Demo 均正常。

### 自动化结果

| 检查 | 结果 |
| --- | --- |
| `git diff --check 9473b6c...HEAD` | 通过 |
| `npm run check:convolution-visuals` | 通过 |
| `npm run test:convolution-layout` | `50/50` 通过 |
| `npm run test:convolution-micro` | `7/7` 通过 |
| `npm run test:convolution-practice` | `3/3` 通过 |
| `npm run test:convolution-exit-check` | `5/5` 通过 |
| `npm run test:geogebra` | `14/14` 通过 |
| `npm run test:demo-lifecycle` | `6/6` 通过 |
| `npm run test:mobile-learn-panels` | `8/8` 通过 |
| `npm run test:css-probe:check` | 全部 CSS 探针逐字节一致 |
| `npm run check:chapter-materials` | 通过：`876` 个材料文件 |
| `npm run test:visual:check` | `33/35`；两个既有 Textbook Overview 场景出现相同的文字抗锯齿波动 |

### 已知例外

- 严格视觉检查两次均为 `33/35`。`17t-textbook-overview-tall` 与 `17f-textbook-overview-fill` 各有 `3505 / 1024000 = 0.342%` 差异；该差异仅为已在 Loop 06 记录过的文字抗锯齿波动。本轮没有更新视觉基线来掩盖差异。
- `npm run check` 的语法、工具、材料和课程结构检查均通过；最后因用户自有且未跟踪的课程缓存报告 `Parent-prelude count mismatch: got 15, expected 14`，因此命令退出 `1`。`workspace/materials/lesson-cache/2_4/` 未删除、未修改、未纳入提交。
- 真实在线 Tutor 回复依赖外部模型服务；本轮验收覆盖课程壳层、Tutor 布局和交互路径，不把外部网络回复声明为端到端通过。

### 规范与工作区边界

- 本轮只恢复 2.4-2 的既有页面壳层，遵循当前 scoped CSS 与响应式规范，无需更新全局 spec。
- 分支：`codex/lesson-loop-07-restore-layout-shell`。
- 未推送、未创建 PR、未合并。
- 四张既有视觉 baseline 检查前后哈希完全一致。
- 提交不包含 Loop 06 artifacts、`workspace/materials/lesson-cache/2_4/`、`workspace/memory/*`、未采用图片或旧 Superpowers 文件。

## English Summary

Loop 07 restores the clearer reading shell for the 2.4-2 Graphical Understanding of Convolution Operation lesson while preserving the Loop 06 course content, GeoGebra demos, Practice flow, Tutor behavior, and focus workspace. It continues to use the existing lesson-cache, lesson-renderer, and stage-navigation path rather than introducing a second rendering system.

The lesson now has five explicit templates: `overview`, `reading`, `demo`, `finish`, and `practice`. Every page has exactly one `.convolution-reading-surface`. Reading and Finish pages are constrained to approximately `72ch`; desktop Demo and Practice builder layouts use an approximately `43/57` teaching-to-interaction split and become vertical on mobile. Stage navigation spans the reading surface in three equal sections, while WHAT / WHY / HOW appears in the heading and wraps below the title on mobile.

The targeted suites pass: layout 50/50, micro interactions 7/7, Practice 3/3, exit check 5/5, GeoGebra 14/14, demo lifecycle 6/6, mobile panels 8/8, convolution visual structure, CSS probes, and chapter materials with 876 files. Fresh desktop and mobile evidence screenshots were generated outside the repository and inspected manually.

The strict visual suite is accurately recorded as 33/35. The two failing Textbook Overview scenarios each differ by `3505 / 1024000 = 0.342%`, matching the pre-existing text-antialiasing-only variation documented in Loop 06. No visual baseline was rewritten. The full `npm run check` reaches the final cache inventory and exits with `Parent-prelude count mismatch: got 15, expected 14` because of the pre-existing untracked user cache at `workspace/materials/lesson-cache/2_4/`; that cache remains untouched and uncommitted.
