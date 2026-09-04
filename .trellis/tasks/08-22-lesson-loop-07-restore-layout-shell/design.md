# Loop 07 技术设计

完整产品设计见：`docs/superpowers/specs/2026-08-22-convolution-restore-old-shell-design.md`。

## 技术结论

- 保留现有课程数据、阶段状态、交互模块和专注工作区状态。
- 调整 `buildConvolutionStageNav()` 与 2.4-2 页面包装结构，使 Stage 导航独立全宽，Phase 指示器进入标题层级。
- 为 2.4-2 明确区分 `overview`、`reading`、`demo`、`finish` 和 `practice` 五种页面修饰状态。
- 删除仅用于 Loop 06 新壳层的多层卡片视觉，恢复单一阅读面；不依靠全局选择器覆盖其他课程。
- Demo 使用实际课程容器宽度决定横向或纵向布局，GeoGebra 实例与数学状态不变。
- 失败回退、Tutor 开合、移动面板和底部分页器继续复用现有实现。

## 主要模块

- `app/lesson-render.js`：页面类型、Stage 导航和轻量 Phase 指示器。
- `app/style.css`：2.4-2 旧壳层、五类页面模板、主题与响应式规则。
- `app/convolution-practice.js`：仅在现有标记不足以形成统一 Practice 壳层时做最小结构调整。
- `tools/test-convolution-lesson-layout.js`：新结构、尺寸、溢出和页面类型契约。
- 现有 GeoGebra、Practice、Exit Check、微交互、移动端和视觉测试：回归边界。

## 回滚

Loop 07 只形成独立提交。回滚该提交即可恢复 Loop 06 页面外观，不影响 Loop 06 的课程内容与交互实现。
