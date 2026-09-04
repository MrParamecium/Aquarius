# Loop 07：恢复 2.4-2 旧版课程页面壳层

## 目标

将 2.4-2 全部页面恢复为用户确认的改版前页面格式，同时完整保留 Loop 06 已完成的 18 页 Lesson、10 个 GeoGebra Demo、独立 Practice、Exit Check、Tutor、专注导航和移动端行为。

本 Loop 只替换课程的视觉与空间组织，不回退课程内容或交互能力。

## 用户确认的要求

- Section Overview、Lesson 和 Practice 全部使用统一的旧版页面骨架。
- `Section Overview / Lesson / Practice` 恢复为全宽三段导航。
- `WHAT / WHY / HOW` 保留，但降级为标题行中的轻量阶段提示，不再单独占用大型卡片。
- 正文只保留一个外层阅读面，删除层层嵌套的教学卡片和重复边框。
- Lesson 1–5 使用宽松单栏或图文双栏；Lesson 6–15 使用约 `43% / 57%` 的讲解与 Demo 双栏；Lesson 16–18 使用专注单栏。
- Practice 使用统一外壳，五步导航置顶，下方切换当前步骤内容和 Demo。
- 正文使用清晰不透明阅读面；毛玻璃只用于顶部导航、Tutor 和底部分页器。
- 公式使用浅灰公式条与橙色左边线，结论使用浅绿色提示条；Signals、Product、Output 保持蓝、橙、绿语义色。
- 正文优先 Bullet points；步骤使用明确编号；新增学习者文案全部使用英文。

## 约束与非目标

- 不回退或替换 `lesson cache -> lesson renderer -> stage navigation` 主流程。
- 不改变 1 Overview + 18 Lesson + 1 Practice 的顺序与边界。
- 不改变 GeoGebra 预设、数学命令、采样值、实例生命周期、失败回退或 Retry。
- 不改变 Tutor 的默认小球、约 `2:1` 展开比例、缩小或阶段保持逻辑。
- 不改变左侧 `76px` 桌面图标栏、移动触摸菜单或 Home/Escape 退出专注逻辑。
- 不影响其他课程，不建立第二套 renderer，不通过更新视觉基线掩盖回归。
- 不提交用户课程缓存、memory、任务截图、视觉 baseline 或 `.superpowers` 示意图。

## 验收标准

- [ ] 整个 2.4-2 使用同一旧版视觉骨架，其他课程计算样式不变。
- [ ] 全宽 Stage 导航稳定置顶，Overview 仍只有 `Start Lesson`，不出现重复底部分页器。
- [ ] Lesson 标题与轻量 `WHAT / WHY / HOW` 同处标题层级，不形成第二张大卡。
- [ ] 普通 Lesson、Demo Lesson、Finish Lesson 和 Practice 分别使用批准的页面模板。
- [ ] Demo 页保持约 `43% / 57%` 左右布局；Tutor 展开后仍不遮挡、重建或压扁 GeoGebra。
- [ ] `1280x720`、`1440x900 + Tutor` 和 `390x844` 下无横向溢出、控件重叠、文字裁切或不可达分页器。
- [ ] 移动端按“讲解在上、Demo 在下”纵向排列，并保留现有 Lecture/Q&A 切换。
- [ ] 18 页、10 个 Demo、Practice、Exit Check、GeoGebra、移动端、Tutor 和 CSS/视觉回归测试全部保持通过。
- [ ] 所有变更只提交到 `codex/lesson-loop-07-restore-layout-shell`，不 push、不创建 PR，直到用户明确要求。
