# 讲解 Loop 06：2.4-2 专注工作区与横向 Demo

## 目标

在已验收的 2.4-2 完整课程基础上，让 Lesson 与 Practice 把空间优先留给教学内容：左侧主导航自动隐藏但可悬浮唤出，Tutor Agent 默认收成小球并以固定窄栏展开，包含 GeoGebra 的页面在标准桌面视口中使用左右布局并尽量一屏完成当前任务。

## 用户已确认的要求

- 本 Loop 只修改 `2.4-2 Graphical Understanding of Convolution Operation`，不推广到其他课程。
- 专注模式属于应用内部布局，不调用浏览器 Fullscreen API，也不显示全屏或退出全屏按钮。
- Section Overview 保持普通布局；Lesson 与 Practice 自动进入专注布局。
- 左侧完整导航默认隐藏；鼠标进入左边缘时显示用户截图中的纯图标导航栏，离开后收回。
- 左侧图标栏覆盖显示，不能推动讲解区产生左右晃动。
- Tutor Agent 默认显示为小球；点击后展开到右侧，右上角缩小按钮可恢复小球。
- Agent 桌面展开宽度固定为 `320px`，不提供拖拽调宽；讲解区仍占主要空间。
- 包含 GeoGebra 的页面采用左侧讲解约 `40%`、右侧 GeoGebra 约 `60%` 的布局。
- GeoGebra 可以适当缩小，但 Signals、Product、Output 仍在同一画布内上下排列并保持可读。
- 标准桌面视口中，Demo 的公式、任务、三层图、反馈和翻页操作应尽量在一个画面完成。
- 正式产品新增文案全部使用英文；沟通和设计规范使用中文；Loop 验收记录使用中文正文和英文摘要。

## 范围约束

- 继续使用现有 lesson cache、lesson renderer、stage navigation、Q&A、sidebar DOM 和 GeoGebra runtime。
- 不增加框架、构建步骤、运行时依赖、路由或第二套聊天/导航/Demo 组件。
- 不改变 2.4-2 的页面数量、内容顺序、教材函数、数学输出、Practice 判定或状态存储。
- 不修改其他课程的分栏比例、Q&A 入口、侧栏折叠、GeoGebra 尺寸或移动端面板逻辑。
- 空间不足、浏览器高缩放或触屏设备必须安全退回现有纵向/单面板布局；不能通过裁切伪造一屏。
- 不推送、不创建 PR、不合并，除非用户后续明确要求。
- 工作区现有未跟踪 `workspace/materials/lesson-cache/2_4/` 不属于本任务，不得添加、删除或清理。

## 验收标准

- [ ] 只有 2.4-2 的 Lesson 与 Practice 激活专注工作区；Overview 和其他课程保持原布局。
- [ ] 页面不调用 Fullscreen API，也不显示全屏或退出全屏按钮。
- [ ] 左侧默认隐藏，Hover、键盘焦点与触屏入口都能显示复用的纯图标导航栏。
- [ ] 左侧图标栏覆盖显示，不推动课程，离开后稳定收起且不闪烁。
- [ ] Agent 默认是小球，展开为 `320px` 停靠栏，缩小后恢复小球。
- [ ] Agent 在 Lesson 翻页和进入 Practice 时保持状态；返回 Overview 后恢复普通 Q&A，重新进入 Lesson 时从小球开始。
- [ ] Agent 展开后不覆盖阶段导航、分页、公式、GeoGebra 或 Practice 控件。
- [ ] 含 GeoGebra 页面在足够空间下使用 `40% / 60%` 横向布局；无 Demo 页面保持单栏。
- [ ] GeoGebra 的 Signals、Product、Output 继续共享同一 `t` 并保持现有数学结果。
- [ ] `1280×720` 与 `1440×900`、100% 缩放下，主要 Demo 页面无需课程外层滚动即可完成当前任务。
- [ ] 空间不足时安全恢复纵向布局或滚动，不裁切坐标、公式、反馈和按钮。
- [ ] GeoGebra 加载失败、Retry、销毁和重新挂载保持单实例并允许继续学习。
- [ ] 390px、430px、深色模式和减少动画模式无横向溢出、遮挡或不可用控件。
- [ ] 现有 2.4-2 数学、Practice、状态恢复、CSS probe 和全站视觉回归全部通过。
- [ ] `.trellis/tasks/08-05-lesson-loop-06-convolution-focus-workspace/verification.md` 包含中文验收和英文摘要。

## 设计来源

- `docs/superpowers/specs/2026-08-05-convolution-focus-workspace-design.md`
- 用户确认的左侧纯图标栏截图与 Visual Companion A 方案
