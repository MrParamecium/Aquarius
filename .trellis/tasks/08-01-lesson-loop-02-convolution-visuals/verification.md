# Loop 02 验收记录 / Verification

## 中文验收

结论：`2.4-2 Graphical Understanding of Convolution Operation` 的视觉分块版通过验收。课程结构、教材数学和唯一 GeoGebra Demo 均未被打乱，可以进入本地提交与用户复核阶段。

### 内容与视觉层级

- Section Objective 已压缩为一句；Concepts In This Section 只保留 3 个一级知识点。
- Why、What、How、五步总结、Figure 2.7 GeoGebra、本书用途 6 个知识页保持原顺序，应用内仍为 `8/8`。
- Why 使用墨水池 V2 图，How 使用洒水车 V2 图；生产课程只引用这两张 V2，第一版图片按用户要求保留但不引用。
- Bridge note、Quick reading rule 与 Common trap 使用现有语义分块，减少连续文字墙；没有新增第二个 Demo 或嵌套卡片。
- 正文字号只在 `data-lesson-section="2.4-2"` 页面上提高，不影响其他课程。

### 图片与响应式布局

- 两张 V2 图片自然尺寸均为 `1153x2048`，加载完成，使用 `object-fit: contain`，未裁切关键内容。
- 桌面端类比文字与图片并排；390px 和 430px 下改为文字在上、图片在下的单列结构。
- 390px 下两张图实际渲染约 `190x338`，均完整显示；洒水车车顶笑脸在课程尺寸下很小，不构成教学干扰，因此不生成 V3。
- 底部分页器在阅读中保持悬浮，但滚动到页尾时正文结尾位于分页器上方，没有永久遮挡。
- 390px、430px 和桌面均未观察到横向溢出、文字越界或不连贯重叠。

### GeoGebra 与课程行为

- 390px 移动端首次进入第 6 页时，GeoGebra 正常挂载两块真实画布，尺寸为 `318x216` 和 `318x314`；此前动态缩放出现的约 60px 画布是未重新初始化造成的验收假象。
- 430px 与桌面端的步骤控件、滑杆、信号曲线、坐标轴和双画布均正常显示。
- 实际切换到 `2. Flip` 成功；自动化继续验证唯一 Applet、四步流程、教材幅值 `2` 和 `t=-3/-2/0` 检查值。
- 五步总结页仍完整包含 Fix、Flip、Slide、Multiply and find area、Record and scan。

### 路由、缓存与错误检查

- 两张 V2 PNG 的真实 HTTP 响应均为 `200 image/png`；不存在文件返回 404；编码后的越界路径返回 403。
- 真实 `/api/section` 命中目标缓存：`cached=true`、正文 8982 字符、6 个 H2、2 张批准图片、13 页教材页。
- 浏览器未记录 JavaScript error。仅存在项目原有的 Tailwind CDN 生产提示，与本轮改动无关。

### 自动化结果

- `git diff --check`：通过。
- `npm run check:convolution-visuals`：通过。
- `node tools/check-geogebra-pilot.js`：通过（由全量 `npm run check` 执行）。
- `npm run test:geogebra`：`11/11` 通过。
- `npm run test:mobile-learn-panels`：`7/7` 通过。
- `npm run check`：通过；162 份课程缓存及 14 份 parent prelude 一致性检查通过。
- `npm run test:css-probe:check`：17 组状态全部与基线逐字节一致。
- `npm run test:visual:check`：32 个页面状态全部在阈值内；除既有 pole-zero 页面为 `0.348%` 外，其余状态均为 `0.000%`。

### 证据

- `evidence/desktop-why.png`
- `evidence/desktop-how.png`
- `evidence/desktop-geogebra.png`
- `evidence/mobile-390-geogebra.png`
- `evidence/mobile-430-overview.png`
- `evidence/mobile-430-why-top.png`
- `evidence/mobile-430-why-image.png`
- `evidence/mobile-430-how-top.png`
- `evidence/mobile-430-how-image.png`
- `evidence/mobile-430-geogebra.png`

## English Summary

Loop 02 passes acceptance. The lesson overview is shorter, the concept list contains three top-level items, and the six approved teaching sections remain in their original order. The Why and How pages now use compact analogy bands with the approved V2 ink and sprinkler images, while the existing Figure 2.7 GeoGebra construction remains the only interactive demo.

Desktop, 390px, and 430px checks pass. Both images preserve their full aspect ratio, the pager does not hide the final content, and GeoGebra mounts two usable canvases when first opened on mobile. The sprinkler's small roof face is not visually distracting at lesson size, so no V3 image is needed.

The protected illustration route, real cached lesson response, targeted tests, full check, CSS probes, and visual regression suite all pass. The implementation remains local and has not been pushed or opened as a PR.
