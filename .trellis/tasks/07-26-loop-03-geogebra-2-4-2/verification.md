# 验收记录

验收日期：2026-07-27

## 结论

`2.4-2 Graphical Understanding of Convolution Operation` 的 GeoGebra 试点已经实现并可用：课程缓存命中，单个 Applet 连续承载上下两个画图区，四步引导、时间滑块、数学反馈、重置、响应式缩放、失败回退和幂等清理均已接入现有 Demo 生命周期。

手机端课程改为讲义 / 问答单面板。`390x844` 首次打开默认显示全宽讲义，可双向切换；切换期间 GeoGebra 不重建，自动化回归确认步骤 `3`、`t=-2` 与原 Canvas 节点均保留，返回桌面后恢复双栏。

功能定向门槛通过，并已取得用户确认进入精确范围提交与 PR。工作区重复材料文件、既有视觉基线漂移和反馈板亚像素漂移仍作为全量仓库门槛的已知限制记录，不纳入本 loop 提交。

## 范围与基线

- 分支：`codex/loop-03-geogebra-2-4-2`
- `main` 基线：`9f8360d73de9c40e950cb172d230662238313d0b`
- 本地验收服务：`http://127.0.0.1:9123/`
- GeoGebra loader：`https://www.geogebra.org/apps/deployggb.js`
- 固定 HTML5 codebase：`https://www.geogebra.org/apps/5.4.920.0/web3d`
- 没有新增 npm 依赖、`.ggb` 二进制或缓存可执行命令入口。

## 数学核验

教材 Figure 2.7 使用：

```text
x(t) = u(t + 1)
g(t) = exp(-(t + 2)) u(t + 2)
c(t) = 0                              , t < -3
c(t) = 1 - exp(-(t + 3))              , t >= -3
```

固定版本真实 API 技术探针读数：

| `t` | 重叠面积 | `c(t)` |
|---:|---:|---:|
| `-4` | `0` | `0` |
| `-3` | `0` | `0` |
| `-2` | `0.6321205588` | `0.6321205588` |
| `0` | `0.9502129316` | `0.9502129316` |

面积与输出一致；首次接触点为 `t=-3`。

## 自动化结果

| 命令 | 结果 |
|---|---|
| `git diff --check` | 通过 |
| `node tools/check-demo-family-map.js` | 通过，`14/14` family 与 renderer 对齐 |
| `node tools/check-geogebra-pilot.js` | 通过，缓存、路由、场景与受信数据契约正确 |
| `npm run test:geogebra` | 通过，`9/9` |
| `npm run test:demo-lifecycle` | 通过，`6/6` |
| `npm run test:mobile-learn-panels` | 通过，`7/7` |
| `npm run test:ui-friction` | 通过 |
| `npm run check` | 未通过；前置语法、自测、导出和路由检查通过，随后被 876 个用户保留的 ` 2` 重复材料文件拦截 |
| `npm run test:css-probe:check` | 未通过；仅反馈板四项宽度 / `::before left` 相差约 `0.547px`，不命中本 loop 选择器 |
| `npm run test:visual:check` | 未通过；39 个视图中 1 个通过、38 个失败，首页等未触及页面也整体漂移 |

视觉差异抽查显示基线仍为 `v1.4.1`，当前应用为 `v1.5.0`，主要差异集中在全局文字边缘与版本号，不是 GeoGebra 局部溢出。新的独立运行已消除旧报告中的 View 18 启动超时，但不能把过期基线重烘焙视为本 loop 的隐式工作。

## 手机端实测

- 讲义态：讲义宽不低于 `359px`，问答宽 `0`，切换按钮高 `44px`，横向溢出 `0`。
- 问答态：问答宽不低于 `352px`，讲义宽 `0`，返回按钮高 `44px`，横向溢出 `0`。
- 返回讲义：仍为第 `4 / 7` 页、步骤 `3`、Applet 状态 `ready`，Canvas 仍为 `318x216` 与 `318x314`。
- 自动化实例断言：`constructor=1`、`inject=1`、`remove=0`、`sameCanvasNodes=true`、`t=-2`。
- 可见画布像素抽样分别检测到 `8742` 与 `21392` 个非近白像素，曲线和坐标轴不是空白画布。
- 页面无横向溢出，控制区无重叠；GeoGebra 工具栏、菜单与代数区未显示。

## 证据索引

- `evidence/geogebra-technical-probe.png`：固定版本单 Applet 双画区技术探针。
- `evidence/geogebra-2-4-2-desktop.png`：桌面课程与真实 Applet。
- `evidence/geogebra-2-4-2-mobile-context.png`：手机课程上下文。
- `evidence/geogebra-2-4-2-mobile-lecture-fixed.png`：修复后手机讲义态。
- `evidence/geogebra-2-4-2-mobile-qa-fixed.png`：修复后手机问答态。
- `evidence/geogebra-2-4-2-mobile-lecture-returned-fixed.png`：返回讲义后的同一 Applet。
- `evidence/geogebra-2-4-2-offline-fallback.png`：断网本地 Figure 2.7 回退。
- `evidence/geogebra-verification-metrics.json`：数学、布局、Canvas 与实例指标。
- `evidence/mobile-show-glass-lecture.png`：毛玻璃“显示问答”按钮。
- `evidence/mobile-show-glass-qa.png`：毛玻璃“返回讲义”按钮。

## 已知限制

- 在线交互依赖 GeoGebra 官方 CDN；CDN 失败时课程正文仍可读，并显示本地 Figure 2.7、核心公式和重试按钮。
- 测试期间 OpenRouter 偶发返回地区限制 `403`，视觉夹具还出现一次 Wikipedia TLS 断开；正式课程缓存和 GeoGebra 加载不受影响。
- `npm run check` 的 876 个重复文件均带 ` 2` 后缀，属于受保护的既有工作区内容，本 loop 未删除或提交。
- `tools/visual-diff-coverage.json` 的本地既有修改明确排除在本 loop 提交之外。

## 回滚

回滚时删除三个 `geogebra-*` 脚本及 `2_4-2` 课程缓存，移除 `index.html` 的加载顺序和 dispatcher 的 `geogebra` family 注册，再撤销本 loop 新增的移动单面板逻辑与专属样式。其他 Demo、教材映射、OCR 和用户保留的 ` 2` 文件无需改动。

## 适配层评估

当前只有一个受信场景，registry、固定 codebase、生命周期和失败回退契约已由代码与任务研究文档覆盖；暂不新增 `.trellis/spec/app/` 全局规范。扩展到第二个 GeoGebra 小节前，再把已稳定的场景 schema 与测试门槛提升为跨章节规范。
