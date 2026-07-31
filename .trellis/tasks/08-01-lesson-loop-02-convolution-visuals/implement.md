# 实施计划

## 第 0 步：锁定基线

- [ ] 确认分支为 `codex/lesson-loop-02-convolution-visuals`，基线包含 `origin/main@37360f7`、Loop 06 和迁入后的 Loop 01。
- [ ] 运行 `npm run check`、`npm run test:geogebra` 与 `npm run test:mobile-learn-panels`。
- [ ] 在 CSS 修改前运行 `npm run test:css-probe:baseline` 与 `npm run test:visual:baseline`，记录报告和基线变化。

## 第 1 步：先建立会失败的视觉契约

- [ ] 新增 `tools/check-convolution-lesson-visuals.js`，检查目标缓存、概览、两张 V2 图、六段结构、唯一 GeoGebra、静态路由、专属样式和禁用旧图。
- [ ] 更新 `tools/check-geogebra-pilot.js`，允许且只允许两张批准的 V2 类比图，不放宽 GeoGebra 数学与受信数据断言。
- [ ] 把新检查接入 `package.json` 的 `npm run check` 和独立脚本。
- [ ] 在生产文件修改前运行新检查，确认因路由、样式和图片引用尚未接入而失败。

## 第 2 步：接入受限材料路由

- [ ] 在 `app/static-routes.js` 增加 `/lesson-illustrations/*`，复用 `isUnder()` 防止路径穿越。
- [ ] 保持现有 `/generated`、`/pages`、`/figures` 与 catch-all 行为不变。
- [ ] 通过真实 HTTP 验证两个 PNG 为 `200 image/png`，不存在文件为 404，越界路径不可读取。

## 第 3 步：重排课程视觉层级

- [ ] 精简 Section objective 为一句，Concepts 压缩为 3 项。
- [ ] 在 Why 中将墨水池原话与 V2 图组成紧凑类比区块；在 How 中将洒水车原话与 V2 图组成同类区块。
- [ ] 保留 What、五步总结、Figure 2.7 和本书用途的原教学内容与数学，不新增第二个 Demo。
- [ ] 用现有语义 callout 对“公式对应关系”和“常见错误”做少量分块，避免连续文字墙。

## 第 4 步：定向响应式样式

- [ ] 在 `app/style.css` 尾部新增 `.convolution-analogy-*` 专属规则；不编辑现有复杂选择器。
- [ ] 桌面文字/图片并排，移动端一列；图片始终 `contain`，稳定比例且不触发布局跳动。
- [ ] 只对含本课程专属标记的页面略微提高正文大小，不影响其他章节。
- [ ] 不使用嵌套卡片、全宽 9:16 图或与现有纸张背景竞争的装饰。

## 第 5 步：自动化与真实页面验收

- [ ] `git diff --check`
- [ ] `npm run check:convolution-visuals`
- [ ] `node tools/check-geogebra-pilot.js`
- [ ] `npm run test:geogebra`
- [ ] `npm run test:mobile-learn-panels`
- [ ] `npm run check`
- [ ] `npm run test:css-probe:check`
- [ ] `npm run test:visual:check`
- [ ] 启动独立端口服务并确认真实 `/api/section` 命中目标缓存。
- [ ] 桌面与 390/430px 检查布局、字号、图像完整度、横向溢出、GeoGebra、控制台与网络错误。
- [ ] 保存 Why、How 与 GeoGebra 页必要截图到任务 `evidence/`。

## 第 6 步：结论与提交

- [ ] 真实页面判断洒水车笑脸是否需要 V3；只在它成为明显干扰时定向重生。
- [ ] `verification.md` 先写中文完整结果，再写英文摘要。
- [ ] 更新 `workspace/memory/2026-08-01.md`，记录本轮取舍和下一次教学反馈入口。
- [ ] 最后重跑定向检查、`npm run check`、CSS probe 与必要视觉验收。
- [ ] 分拆为规划、测试契约、实现和验收提交，不推送、不创建 PR，等待用户确认。
