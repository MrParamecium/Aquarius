# Loop 04 验收记录

## 中文验收

### 结论

2.4-2 第四版满足本 Loop 的验收标准。现有课程解析结构保持为 `1 个简介 + 6 个讲解 + 1 个练习`，没有建立第二套分页器，也没有改变其他课程、GeoGebra 数学参数或 Quick Check 协议。

### 阶段与教学顺序

- 顶部阶段导航固定为 `章节简介 | 正式讲解 | 练习巩固`。
- 简介、讲解、练习分别显示 `章节简介`、`讲解 n / 6`、`练习巩固`，不再显示误导性的全局 `n / 8`。
- 从练习或简介返回正式讲解，会恢复本次会话最近阅读的讲解页。
- 六个讲解页按 What → Why → How → How → GeoGebra → 本章用途排列。
- 普通知识块使用页边编号；翻转、平移、相乘和积分步骤使用连续时间轴。
- 墨水池、洒水车两张 V2 图片、三个代码原生图解和唯一 Figure 2.7 GeoGebra 均保留。

### 交互与响应式

- 2.4-2 的页面切换参数为 `70ms` 内容提交、`180ms` 总锁定；重复真实测试测得约 `204–216ms` 完成，低于 `250ms` 验收上限。
- 减少动画模式直接提交，不运行翻页动画；旧纸张翻面伪元素不再参与动画。
- 桌面 `1280 x 900`、移动端 `390 x 844` 和 `430 x 844` 均无横向溢出。
- 390px 截图发现 Q&A “Show” 按钮曾遮挡阶段导航；已增加专属顶部空间并加入矩形相交断言，修复后 `showQaOverlapsStageNav=false`。
- GeoGebra 在桌面真实页面正常绘制；移动端切换 Q&A 后保留同一 Applet、当前步骤与 `t=-2` 状态。

### 自动化结果

| 检查 | 结果 |
| --- | --- |
| `git diff --check` | 通过 |
| `npm run check:convolution-visuals` | 通过 |
| `npm run test:convolution-layout` | `16/16` 通过 |
| `node tools/check-geogebra-pilot.js` | 通过 |
| `npm run test:geogebra` | `11/11` 通过 |
| `npm run test:mobile-learn-panels` | `7/7` 通过 |
| `npm run check` | 通过 |
| `npm run test:css-probe:check` | 16 个状态逐项一致 |
| `npm run test:visual:check` | 32 个视图全部通过 |

视觉回归中，31 个视图为 `0.000%`；有意修改的卷积视图为 `0.348%`，低于该视图 `0.500%` 阈值。浏览器控制台没有新增错误；仅保留项目原有的 Tailwind CDN 生产提示。

### 证据

- `evidence/desktop-intro.png`
- `evidence/desktop-lesson-what.png`
- `evidence/desktop-timeline.png`
- `evidence/desktop-geogebra.png`
- `evidence/desktop-practice.png`
- `evidence/mobile-intro-390.png`
- `evidence/mobile-editorial-number-390.png`
- `evidence/mobile-timeline-390.png`
- `evidence/mobile-geogebra-390.png`

### 交付边界

- 分支：`codex/lesson-loop-04-convolution-guided-flow`
- 基线：`codex/lesson-loop-03-convolution-reading-structure`
- 未推送、未创建 PR、未合并。

## English Summary

Loop 04 passes its acceptance criteria. The existing eight-page parser remains intact and is mapped to one introduction, six lesson pages, and one practice page. The guided flow adds stage navigation, stage-local progress, recent lesson-page restoration, What → Why → How ordering, editorial markers, process timelines, and a fast 70/180ms transition without changing other lessons or the GeoGebra math contract.

Desktop, 390px, and 430px checks passed without horizontal overflow. A screenshot exposed an overlap between the mobile Q&A switch and the stage navigation; the layout now reserves dedicated space and the mobile harness asserts that their bounding rectangles do not intersect. All targeted tests, 16 CSS-probe states, and 32 visual-regression views passed. No new browser errors were observed.
