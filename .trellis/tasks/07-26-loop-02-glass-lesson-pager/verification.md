# 验证记录

## 基线与负向证据

- 基线提交：`697239c`，业务基线为已合并 Loop 01 的 `a02c34c`。
- 修改前 `npm run check` 与原 `npm run test:ui-friction` 通过，服务健康检查报告 555 页。
- 修改前 CSS 快照保存在 `/tmp/fourier-loop02-css-prechange-697239c.json`。
- 修改前 39 张同机截图保存在 `/tmp/fourier-loop02-prechange-visual-697239c/`。
- 新契约测试在旧实现上按预期失败，识别出 2 个书角控件、零/单知识点仍显示、实色白背景、无背景模糊、2px 描边、按钮无 44px 最小高度、非零字距和缺少 `:focus-visible`。

## 实施结果

- 删除两个书角按钮的 HTML、DOM 常量、直接点击监听、文档级捕获事件、命中检测、去重时间戳、动画和禁用状态同步。
- 底部分页器成为知识点导航的唯一可见入口；零或单知识点课程隐藏。
- `app/style.css` 删除 70 条书角专属规则，`app/css/runtime-collapsed.css` 删除 23 条；分析确认混合选择器规则为 0，未删除活分支。
- 毛玻璃外壳采用 `rgba(255, 255, 255, 0.72)`、`blur(18px) saturate(145%)`、1px 半透明描边和多层柔和阴影。
- `Prev` 与 `Next` 保持稳定最小宽度，按钮最小高度 44px，字距为零，并提供独立悬停、按下、禁用、末页和键盘焦点状态。
- 当课程列不足 280px、课程内容实际上被现有响应式双栏压缩隐藏时，分页器通过容器查询隐藏，避免被裁碎或覆盖问答栏；本循环未扩张为移动端双栏重构。

## 自动化结果

### 通过

- `git diff --check`
- `npm run check`
- `npm run test:ui-friction`
  - 页面只有 1 个底部分页器，书角 DOM 数量为 0。
  - 零/单知识点隐藏；两个知识点时首末页状态正确。
  - 实际点击底部 `Next` 后索引 `0 -> 1`，点击 `Prev` 后回到 `0`，无双触发。
  - computed style：半透明背景、背景模糊、1px 描边、44px 按钮、零字距和焦点规则均命中。
  - 390x844 下课程列宽不足 280px时分页器 `display: none`，书角数量仍为 0。
- `npm run test:lesson`
  - `B.8-2 Complex Numbers` 课程缓存正常渲染，无挂起。
- CSS 探针基线采集
  - 21 个状态全部成功，新 `S-lesson-pager` 包含 19 个分页器属性探针。
  - 删除旧 `S-page-corner`，教材模式不再探测已删除书角。
- 视觉流程
  - 39 个视图均成功采集；`26-kp-pager-advance` 三步交互为 3/3。
  - 证据图片均为非空有效 PNG：桌面 1280x800，窄视口 390x844。
  - 12 张受影响视觉基线以不含透明像素的 RGB PNG 重新编码；解码后的 RGBA 像素逐字节一致，总体积由 11,426,647 字节降至 7,616,653 字节。

### 已知环境噪声

- `npm run test:css-probe:check` 的分页器及课程状态全部通过，但整套命令仍报告修改前已存在的 4 个反馈区亚像素漂移：`321.438 -> 320.891`、`328.438 -> 327.891`、`294.438 -> 293.891`。未把这些无关值写入基线。
- `npm run test:visual:check` 在当前机器仍受历史 Chromium/字体环境差异影响，多个未改页面也高于仓库阈值。为隔离本次改动，使用同机修改前截图比较：27 个视图像素差为 0，另外 12 个视图的变化只落在书角消失、分页器换肤及其模态背景采样区域。
- 视觉基线只叠加上述同机前后像素差，没有用当前机器整张截图覆盖历史基线。更新后受影响视图的环境噪声与修改前保持同量级，最大差值为 545 像素（0.053%）。
- 无损重编码后的两次补充复跑均完成其余 38 个视图，但 `18-lesson-pole-zero-roc` 在测试脚本重复进入游客模式时等待持续变换的 `#introGetStartedBtn` 超时；此前同一产品实现已完成 39 个视图采集。该问题发生在测试入口点击稳定性检查，不是产品页面渲染错误，未修改测试工具或视觉基线规避。

## 静态清零

以下令牌在 `app/` 与 `tools/css-probe.js` 中扫描结果为 0：

- `lecturePrevOverlayBtn`
- `lectureNextOverlayBtn`
- `lecture-page-corner`
- `page-turner`
- `turner-content`
- `animateLectureNavButton`
- `handleLectureOverlayNavEvent`
- `getLectureOverlayDeltaFromEvent`
- `lastLectureOverlayNavAt`

缺失控件断言仍保留在 `tools/test-ui-friction-v123.js`，用于防止书角回归。

## 视觉证据

- `evidence/desktop-first.png`：桌面首个知识点，`Prev` 禁用。
- `evidence/desktop-last.png`：桌面末个知识点，显示 `Next topic`。
- `evidence/mobile-narrow-panel.png`：390px 窄视口，现有课程列不可见时分页器不覆盖问答栏。
- `evidence/mobile-metrics.json`：窄视口尺寸、分页器显示状态和书角数量。

## 范围确认

- 未修改课程内容、教材材料、章节映射、课程缓存或问答逻辑。
- 未重写 `moveLearnKnowledgePoint()`。
- 旧项目 `/Users/chenghaoxiang/Desktop/tutor agent` 仅执行只读状态检查，没有写操作。
- 未自动合并到 `main`。
