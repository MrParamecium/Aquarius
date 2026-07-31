# 讲解 Loop 02：图解卷积视觉分块与类比插图设计

## 背景与基线

第一版已经验证六段教学顺序、两个口语类比、Figure 2.7 GeoGebra 和教材幅值 `2`。本轮不重做教学原理，而是解决真实页面的四个阅读问题：概览太长、知识点拆得太细、正文连续成墙、缺少记忆图像。

当前分支从 `origin/main@37360f7` 新建，再迁入 Loop 01 的五个非重复提交。这样保留 Loop 06 对偏好与课程缓存的简化，同时避免继续在落后远端的旧分支上叠加。

## 方案比较

### 方案 A：普通 Markdown 图片

把两张 V2 图直接插在类比段落后。实现最少，但现有 `.lesson-img` 会把 9:16 图片作为独立内容块，页面明显变长，文字与图片割裂，不采用。

### 方案 B：课程专属紧凑插图带（采用）

类比文字与图片共同放入一个语义区块。桌面端文字占主、图片约占三成；移动端按阅读顺序改为文字在上、图片在下。图片用 `object-fit: contain` 完整显示，并限制高度，不使用卡片套卡片。

该方案直接解决文字墙，同时保持 GeoGebra 的主视觉地位，且只新增一组课程专属样式，改动边界最清楚。

### 方案 C：把类比图并入 GeoGebra 页

这样不需要增加两个视觉区块，但图片会远离对应解释，学生必须跨页回忆类比，也会让 Figure 2.7 页面更长，不采用。

## 内容结构

课程仍保持 6 个知识页和最后测验页：

1. Why：先讲系统记忆，再用墨水池图帮助记住“过去贡献会留下并累加”，随后逐项映射回公式。
2. What：固定 `t`、让 `τ` 扫描历史，保留日历类比和核心积分。
3. How：用洒水车图解释翻转、平移、逐点相乘与积分，保留“稀疏庄稼/茂密庄稼”的乘积直觉。
4. 五步总结：保持 Fix、Flip、Slide、Multiply and find area、Record and scan。
5. GeoGebra：保持现有一个连续 Figure 2.7 场景和教材数值。
6. 本书用途：保持零状态响应、RLC、采样/滤波和级联系统四个连接点。

概览只承担导航，不提前重复正文：目标压缩成一句，Concepts 只列“过去贡献”“图解步骤”“教材 Figure 2.7 与 LTIC 输出”三个一级概念。

## 渲染与样式边界

两张图继续保存在：

- `workspace/materials/lesson-illustrations/2_4-2/convolution-ink-memory-v2.png`
- `workspace/materials/lesson-illustrations/2_4-2/convolution-sprinkler-procedure-v2.png`

`app/static-routes.js` 新增 `/lesson-illustrations/*` 路由，只允许从 `workspace/materials/lesson-illustrations/` 读取路径。路径解析后必须通过现有 `isUnder()` 边界检查，不能用不受限的字符串拼接。

课程缓存使用受保护的 `KC_BLOCK` 输出两个语义化 `<section>`，不扩展 Markdown 协议。每个区块包含：短标签、类比正文、带明确 `alt` 的 `<img>`。图片不添加解释产品功能的可见说明，也不重复正文作为图注。

样式只使用 `.convolution-analogy-*` 命名：

- 桌面为 `grid-template-columns: minmax(0, 1fr) minmax(170px, 30%)`；
- 图片 `width: 100%`、`max-height` 受限、`object-fit: contain`、`aspect-ratio: 1153 / 2048`；
- 小于移动断点后改为一列，图片宽度与高度再次收紧；
- 不覆盖通用 `.lesson-img`，不修改其他课程图片；
- 本节字号通过课程专属标记定向提高一级，避免全站回归。

## 分块策略

分块服务于扫读，不把每段都变成卡片。Why 和 How 各只有一个类比区块；公式映射与常见错误继续使用现有 `lecture-note-card` 语义样式。正文背景、分页纸张和 GeoGebra 外壳不再套新的外层卡片。

## 测试与失败处理

新增定向静态契约检查：概览长度、3 个 Concepts、两张 V2 图、无旧图引用、6 个 H2、1 个 GeoGebra、静态路由与课程专属样式均存在。现有 GeoGebra 检查从“禁止所有 Markdown 图片”调整为“禁止未批准图片”，数学断言保持不变。

CSS 修改前先在当前 HEAD 生成 CSS probe 与视觉基线；修改后运行 check。真实浏览器验收覆盖桌面和 390/430px 移动端，并检查图片自然尺寸、渲染尺寸、`object-fit`、横向溢出和控制台错误。

若图片路由失败，课程文字与 GeoGebra 仍可使用，浏览器显示替代文本；该状态不能作为验收通过。若洒水车笑脸在真实尺寸下仍明显偏幼稚，只生成 `v3` 替换洒水车引用，墨水池 V2 保留。

## 回滚

删除课程中的两个类比区块、`.convolution-analogy-*` 样式和 `/lesson-illustrations/*` 路由即可回到 Loop 01。GeoGebra、教材材料映射和 Loop 06 简化不依赖本轮代码，因此无需联动回滚。
