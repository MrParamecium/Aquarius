# 第五版改动前基线

- 日期：2026-08-03
- 分支：`codex/lesson-loop-05-convolution-complete-teaching`
- 基线起点：`31905ab`
- 课程结构：`1 个 Section Overview + 6 个 Lesson + 1 个 Practice`

## 自动化结果

- `npm run check:convolution-visuals`：通过
- `npm run test:convolution-layout`：16/16 通过
- `node tools/check-geogebra-pilot.js`：通过
- `npm run test:geogebra`：11/11 通过
- `npm run test:mobile-learn-panels`：7/7 通过
- `npm run check`：通过

## CSS 与视觉基线

- `npm run test:css-probe:baseline`：16 个状态全部生成真实计算值
- `npm run test:visual:baseline`：33 个视图全部生成成功
- 重新采样后只有 `17-lesson-convolution`、`19-login-screen`、`23-textbook-focus`、`26-kp-pager-advance` 的 PNG 字节发生轻微变化；本提交没有生产 CSS 或 JS 改动

第五版实施后的对比只允许 2.4-2 相关视图出现批准范围内的变化。其他顶层视图发生可见变化时视为回归。
