# 第四版改动前基线

- 日期：2026-08-02
- 分支起点：`e58b576`
- 课程缓存：`workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`
- 应用页面：`8/8`，结构为 `overview + 6 knowledge + quiz`
- 现有翻页：内容提交点 255ms，总锁定 720ms，纸张翻页 CSS 640ms

## 自动化结果

- `npm run check:convolution-visuals`：通过，第三版内容岛、语义色、图解和图片契约有效。
- `npm run test:convolution-layout`：`10/10`，桌面、390px、430px 无溢出或 JavaScript 页面错误。
- `node tools/check-geogebra-pilot.js`：通过。
- `npm run test:geogebra`：`11/11`，Figure 2.7 数学值与生命周期正确。
- `npm run test:mobile-learn-panels`：`7/7`。
- `npm run check`：通过。
- `npm run test:css-probe:baseline`：16 个状态全部取得真实计算值。
- `npm run test:visual:baseline`：32 个视图完成；本机重跑刷新 4 张课程相关截图。

## 视觉基线刷新

- `tools/visual-baseline/17-lesson-convolution.png`
- `tools/visual-baseline/22-lesson-quick-check.png`
- `tools/visual-baseline/23-textbook-focus.png`
- `tools/visual-baseline/26-kp-pager-advance.png`

以上刷新发生在任何第四版生产代码修改之前，作为本分支视觉前态。
