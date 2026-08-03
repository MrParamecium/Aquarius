# 技术设计

## 1. 保留现有链路

第五版继续使用：

```text
lesson cache → lesson renderer → stage navigation → interactive demo
```

课程缓存继续由现有解析器拆成 Overview、Knowledge 和 Quiz 类型。2.4-2 的阶段映射从 `1 / 6 / 1` 扩充为 `1 / 12 / 1`，不建立第二套分页器，不改变缓存版本键。

完整教学与视觉规范以 `docs/superpowers/specs/2026-08-03-convolution-fifth-loop-design.md` 为唯一设计来源；本文件只锁定代码边界。

## 2. 页面与状态边界

- `app/lesson-render.js` 继续负责 2.4-2 阶段映射、页面框架和阶段导航。
- `app/ui-friction-fixes.js` 继续负责底部分页显示和按钮状态。
- Overview 隐藏底部分页；Lesson 显示 `Lesson n / 12`；Practice 显示 `Practice`。
- Guided Demo Pages 5–9 的 `Continue` 由当前任务完成状态控制；顶部三阶段导航始终可用。
- 使用带版本号的 `sessionStorage` 状态保存阶段、Lesson 页码、Guided 任务、GeoGebra 当前值和 Practice 状态。读取时校验类型并限制页码边界。
- 关闭当前课程时保留可刷新恢复的数据，但销毁 DOM 监听器、ResizeObserver 和 GeoGebra applet。

## 3. GeoGebra 边界

GeoGebra 保持“一套预设注册表 + 一套场景控制器”：

- 预设注册表保存 Figure 2.7 与 Examples 2.10–2.12 的函数、显示范围、关键分界点和输出求值器。
- 场景控制器负责 Change、Flip、Slide、Multiply、Integrate 和统一状态回调。
- 现有 `convolution_figure_2_7` 场景标识保持兼容。
- 每个 Lesson 页面只挂载当前需要的同一场景；切页时销毁并从保存状态重新挂载，不让多个 applet 同时运行。
- 一个 GeoGebra Graphics 视图按三个纵向坐标带绘制 Signals、Product、Output，避免加载三个 applet；HTML 中只保留一个 $t$ 滑块。
- 每次滑块更新形成一个原子状态 `{ preset, step, t, overlap, area, output }`，三层图和任务反馈从同一状态刷新。

## 4. 渐进提示

- Figure 2.7 使用五个 Guided task id：`change-variable`、`flip`、`slide`、`multiply`、`integrate`。
- Example 2.10 预先显示重叠区间并检查积分上下限。
- Example 2.11 先要求学生选择分界点和区间，首次错误后再显示提示。
- Example 2.12 先要求学生预测支撑区间、输出宽度和整体形状，再展开三个教材区间。
- 提示等级由课程页配置决定，不在 GeoGebra 场景内硬编码教材文案。

## 5. Practice 模块

2.4-2 使用专属 Practice 组件替换当前通用的三项准备任务和 Quick Check 卡片；其他课程不变。

Practice 数据是 Drills 2.10–2.13 的只读定义。每题状态包括选择的翻转信号、支撑区间、分界点、区间曲线类型、尝试次数和掌握状态。

曲线拼装不做自由手绘：学生先放置分界点，再为每个区间选择 `Zero / Constant / Rising / Falling / Exponential`。判定比较语义答案，不比较像素。反馈返回第一个错误字段或区间，首次尝试前不显示提示。

## 6. 样式与无障碍

- 所有新增选择器限定在 `.lesson-page-frame[data-lesson-section="2.4-2"]` 或对应激活状态下。
- 顶部阶段导航使用 `position: sticky`，并测试它不遮挡现有课程工具栏。
- 桌面正文目标 18px，移动端不低于 16px，行高不低于 1.6，正文宽度约 72ch。
- 大号边框编号不再输出；步骤使用无边框数字或轻量时间轴。
- Demo 与 Practice 控件使用原生 button、range、radio 或可键盘操作的等价控件；反馈区域使用 `aria-live="polite"`。
- 页面动画保持 180ms；`prefers-reduced-motion` 下为 0ms。

## 7. 降级与回滚

- GeoGebra runtime、场景或预设失败时显示公式、静态三层示意和英文错误提示；Guided `Continue` 可用。
- Practice 状态损坏时只清理 2.4-2 的版本化状态并回到 `Not Started`。
- 阶段映射异常时退回现有通用分页，不渲染空白页。
- 生产修改限定在 2.4-2 缓存、课程渲染与分页模块、卷积 GeoGebra 模块、专属 Practice 模块、课程专属 CSS 和定向测试；各层可以按提交独立回滚。

