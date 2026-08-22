# Loop 06 最终验收记录

## 中文验收

### 结论

2.4-2 Graphical Understanding of Convolution Operation 已完成本 Loop 的课程、交互和专注工作区实现。Section Overview 保持普通课程布局；Lesson 与 Practice 进入应用内专注布局，不调用浏览器 Fullscreen API，也没有建立第二套课程渲染流程。

本轮继续使用现有 `lesson cache -> lesson renderer -> stage navigation` 链路。课程现在由 1 页 Overview、18 页 Lesson 和 1 页独立 Practice 构成；Practice 不再泄漏到 Lesson 18。新增学习者可见文案均为英文。

### 已验收功能

- 桌面左栏固定为 `76px` 纯图标栏；移动端默认隐藏，通过触摸菜单开关，正文不会被推动或横向挤出。
- Tutor 默认收起为“毕业帽 + AI”圆形入口；展开后讲解区与 Tutor 约为 `2:1`，可用 `Minimize Tutor` 收回。
- Home 与 Escape 都能退出专注布局并完整恢复普通左栏、Q&A、触摸菜单和 ARIA 状态。
- Demo 在桌面采用约 `46% / 54%` 的讲解/交互左右布局；移动端恢复纵向排列。
- 第 6–15 页各有一个受控 GeoGebra Demo；第 4 页三张讲解图可稳定加载；第 18 页不再包含 Practice Demo。
- Practice 使用独立的 `Predict -> Plan -> Build -> Calculate -> Sketch` 五步任务，并使用 rectangle-triangle 练习预设。

### 关键尺寸与人工视觉检查

| 场景 | 结果 |
| --- | --- |
| `1280 x 720`，Tutor 收起 | 左栏 `76px`；Demo 两栏约 `520 / 610px`；横向溢出 `0px` |
| `1440 x 900`，Tutor 展开 | 讲解约 `909px`，Tutor 约 `455px`；Demo 两栏约 `384 / 451px`；GeoGebra 约 `449 x 449px` |
| `390 x 844` | 左栏默认隐藏；Tutor 圆球隐藏；Demo 纵向排列；横向溢出 `0px` |

最终截图重新生成到系统临时目录并人工检查，没有覆盖任务 artifacts 或视觉基线。桌面布局、Tutor 比例、移动端降级、底部分页器和文字可读性均正常。

### 自动化结果

| 检查 | 结果 |
| --- | --- |
| `git diff --check` | 通过 |
| `npm run check:convolution-visuals` | 通过：18 页顺序、10 个受控 Demo、英文文案均符合契约 |
| `npm run test:convolution-layout` | `40/40` 通过 |
| `npm run test:convolution-micro` | `7/7` 通过 |
| `npm run test:geogebra` | `14/14` 通过 |
| `npm run test:mobile-learn-panels` | `8/8` 通过 |
| `npm run test:demo-lifecycle` | `6/6` 通过 |
| `npm run test:convolution-practice` | `3/3` 通过 |
| `npm run test:convolution-exit-check` | `5/5` 通过 |
| `npm run test:css-probe:check` | 全部 CSS 探针逐字节一致 |
| `npm run test:visual:check` | 最终重跑全部视觉场景通过 |
| `npm run check:chapter-materials` | 通过：`876` 个材料文件、`83` 个章节映射 |

### 已知边界

- 严格视觉检查首次运行时，`17t-textbook-overview-tall` 与 `17f-textbook-overview-fill` 曾出现相同的 `3505 / 1024000 = 0.342%` 文字抗锯齿波动；最终重跑全部通过。本轮没有更新视觉基线来掩盖差异。
- `npm run check` 的语法、工具、材料、GeoGebra 和 2.4-2 结构检查均通过；最后统一缓存清单因用户自有且未跟踪的 `workspace/materials/lesson-cache/2_4/` 使 parent-prelude 数量从期望 `14` 变为 `15` 而退出 `1`。该缓存未删除、未修改、未纳入提交。
- 真实在线 Tutor 回复仍依赖外部模型服务，本 Loop 验证的是布局和交互路径，没有把外部网络回复声明为端到端通过。

### 工作区边界

- 分支：`codex/lesson-loop-06-convolution-focus-workspace`
- 基线提交：`231118f`
- 未推送、未创建 PR、未合并。
- 提交不包含 `.trellis/.../artifacts/*.png`、`tools/visual-baseline/*.png`、`workspace/memory/*`、用户课程缓存或未采用的讲解图。

## English Summary

Loop 06 completes the 2.4-2 graphical-convolution course loop on the existing lesson-cache, lesson-renderer, and stage-navigation path. The course now contains one Overview, eighteen Lesson pages, and one isolated Practice page. Practice no longer leaks into Lesson 18.

Lesson and Practice use a persistent 76px desktop icon rail and a hidden touch-menu rail on mobile. The Tutor starts as a graduation-cap/AI orb, expands to an approximately 2:1 lesson-to-Tutor split, and returns to the orb through the existing minimize control. Desktop Demo pages use an approximately 46/54 teaching-to-interaction split; mobile restores a vertical layout.

The targeted gates pass: layout 40/40, micro interactions 7/7, GeoGebra 14/14, mobile panels 8/8, demo lifecycle 6/6, Practice 3/3, exit check 5/5, convolution visual structure, CSS probes, and chapter materials. Fresh 1280x720, 1440x900 Tutor-open, and 390x844 screenshots were generated outside the repository and inspected manually.

The strict visual suite ultimately passes without rewriting any baseline; an earlier run showed the same transient 0.342% text-antialiasing-only difference in two existing Textbook Overview scenarios. The full `npm run check` reaches the final cache inventory and reports 15 parent preludes instead of 14 because of the pre-existing untracked `workspace/materials/lesson-cache/2_4/` cache; that user-owned cache was left untouched.
