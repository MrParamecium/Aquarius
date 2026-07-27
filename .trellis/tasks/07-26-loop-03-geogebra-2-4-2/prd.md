# 循环 3：GeoGebra 2.4-2 连续卷积试点

## 目标

以已合并 Loop 02 的 `main` 提交 `9f8360d` 为基线，在 `2.4-2 Graphical Understanding of Convolution Operation` 中用一个连续 GeoGebra 场景呈现 Figure 2.7 的翻转、平移、重叠与卷积输出。该循环只验证 GeoGebra 是否适合作为后续数学 Demo 引擎，不批量迁移现有 Canvas Demo，也不导入旧项目中其余质量不稳定的课程功能。

## 需求

1. 只在 `codex/loop-03-geogebra-2-4-2` 修改合并后的重构版；旧桌面项目保持只读，仅作为教材意图参考。
2. Tutor Agent 为非商业用途；本循环按 GeoGebra 非商业许可试用，不扩大到商业部署判断。
3. 试点只覆盖 `2.4-2` 的 Figure 2.7，并使用一个连续 Applet 完成四步；不迁移 Figures 2.8-2.14，不替换现有二十多个 Demo renderer。
4. 新增一个聚焦 Figure 2.7 的正式课程缓存，路径必须是应用实际读取的 `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`。课程只含一个 GeoGebra Demo block，不复制旧缓存中的 14 个 Canvas Demo。
5. 保留现有 `data-demo-b64` 协议；新 block 必须通过显式 `spec.framework: "geogebra"` 与 `spec.scene: "convolution_figure_2_7"` 路由，不依赖标题关键词猜测。
6. GeoGebra 接入采用“声明式课程数据 + 通用适配层 + 独立场景模块”。课程缓存只能选择受信场景和教学参数，不得注入任意 `evalCommand` 字符串。
7. 试点通过官方 `https://www.geogebra.org/apps/deployggb.js` 懒加载，并将 HTML5 codebase 锁定到已核验的 `5.4.920.0`。只有打开含 GeoGebra Demo 的课程时才发起请求，同一页面只加载一次。
8. Applet 隐藏 GeoGebra 工具栏、菜单、代数输入、重置图标和非教学编辑能力，只保留 Tutor Agent 课程外壳、必要数学画布及交互控件。
9. 数学场景必须以教材 Figure 2.7 为准，不照搬旧 Canvas renderer 的错误支撑方向：
   - `x(tau) = u(tau + 1)`；
   - `g(tau) = exp(-(tau + 2)) u(tau + 2)`；
   - `g(t - tau) = exp(tau - t - 2) u(t + 2 - tau)`；
   - 首次重叠发生在 `t = -3`；
   - `c(t) = 0`（`t < -3`），`c(t) = 1 - exp(-(t + 3))`（`t >= -3`）。
10. 四步交互依次为“认识信号、执行翻转、拖动平移、观察卷积”。步骤切换不得重新创建 Applet，当前 `t` 状态必须保留；只有重置才回到第 1 步与 `t = -4`。
11. 采用软引导：用户未命中目标也能前后切换；当 `t` 进入 `-3 +/- 0.08` 时显示“首次接触”成功反馈。
12. 第 4 步必须同时显示 `x(tau)g(t-tau)` 的橙色重叠区域、当前面积数值、完整 `c(t)` 曲线及随 `t` 移动的输出点。
13. 桌面与移动端均须支持鼠标、触屏和键盘改变 `t`。步骤按钮、重置和重试按钮保留语义、可见焦点与至少 44 像素触控目标。
14. CDN 加载中必须保持稳定尺寸；断网、超时或初始化失败时回退到本地教材 Figure 2.7、核心公式与“重新加载”按钮，不得留下空白画布。
15. 离开课程或替换课程 DOM 时，必须注销 GeoGebra update/client listener、断开尺寸观察器并调用 Applet `remove()`；延迟回调不得写入已经销毁的节点。
16. 试点不持久化 Applet Base64 或滑块位置，不新增 npm 依赖，不引入构建步骤，不改变现有课程分页、登录、记忆或反馈系统。
17. 所有设计、实施与验收文档使用中文；课程正文继续匹配现有英文教材课程风格。

## 验收标准

- [ ] `2.4-2` 在应用中命中新正式缓存，不再显示 “This section has not been prepared yet.”。
- [ ] 课程只水合一个 `framework: "geogebra"`、`scene: "convolution_figure_2_7"` 的 Demo，其他章节仍走原 renderer。
- [ ] GeoGebra 脚本仅在打开该课程时加载，重复水合复用同一加载 Promise，codebase 固定为 `5.4.920.0`。
- [ ] 一个 Applet 内连续完成四步，步骤切换不重载且 `t` 不丢失；重置恢复第 1 步和 `t = -4`。
- [ ] `t = -3` 显示首次接触；`t = -4,-3,-2,0` 的输出分别符合 `0,0,1-e^-1,1-e^-3`，数值误差不超过 `1e-6`。
- [ ] 第 4 步显示的积分面积与输出点纵坐标一致，误差不超过 `1e-6`。
- [ ] 工具栏、菜单、代数输入和 GeoGebra 重置图标均不可见，Tutor Agent 外层步骤、反馈和重置控件完整可用。
- [ ] 模拟 CDN 失败时显示本地教材图、核心公式和可用重试按钮；恢复网络后可在原节点重新初始化。
- [ ] 连续进入/离开课程后无残留 Applet、监听器、观察器或向已销毁节点写入的异步回调。
- [ ] 桌面与移动端画布非空、曲线不裁切、控件不重叠；鼠标、触屏和键盘均能完成主要流程。
- [ ] `npm run check`、GeoGebra 定向静态/浏览器测试、Demo 生命周期测试、CSS probe 与既有 visual diff 均通过。
- [ ] 真实 CDN 冒烟测试完成桌面和移动截图，并记录 Applet API 版本、关键数学值和控制台错误为零。
- [ ] PR 只包含本试点的适配层、场景、课程缓存、样式、测试、规划和证据，不包含旧项目其他功能或批量 Demo 迁移。

## 停止与回滚条件

- 如果真实 GeoGebra 版本无法在一个 Applet 内稳定提供两个联动画图区，停止 UI 扩展并回到设计阶段，不静默改成两个 Applet。
- 如果教材公式、重叠边界或输出数值任一不一致，按 Sev-1 处理，停止视觉调优并先修正数学模型。
- 如果 CDN 失败会阻断整页课程、课程切换出现资源残留，或现有 Canvas Demo 路由发生变化，停止扩大范围并修复适配层边界。
- 整个 Loop 03 可按分支提交独立回滚；回滚不得删除现有教材映射、OCR 或 Figure 2.7 资源。
