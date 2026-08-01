# 实施计划

## 第 0 步：锁定分支与任务边界

- [x] 从已确认规格提交 `54e3818` 创建 `codex/lesson-loop-03-convolution-reading-structure`。
- [x] 将任务 `branch` 登记为 Loop 03 分支，`base_branch` 保持 `codex/lesson-loop-02-convolution-visuals`。
- [ ] 用户确认本实施计划后再执行 `task.py start`；确认前不修改课程缓存、CSS、测试或视觉基线。
- [ ] 实施期间不拉取、合并或变基远端 `main`，避免把与本 Loop 无关的变化混入。

回滚点：本步骤只新增本地分支和任务元数据；删除未推送的 Loop 03 分支即可回到 Loop 02，不影响其提交。

## 第 1 步：记录改动前基线

- [ ] 确认工作区除任务规划文件外无未提交修改，并记录当前 HEAD。
- [ ] 运行现有定向检查：
  - `npm run check:convolution-visuals`
  - `node tools/check-geogebra-pilot.js`
  - `npm run test:geogebra`
  - `npm run test:mobile-learn-panels`
  - `npm run check`
- [ ] 在生产 CSS 修改前运行：
  - `npm run test:css-probe:baseline`
  - `npm run test:visual:baseline`
- [ ] 记录 CSS probe 状态数、视觉基线视图数和已知文字抗锯齿噪声，不把无关噪声当作本轮回归。
- [ ] 如果基线文件发生变化，先以 `test: 记录卷积第三版改动前基线` 单独提交；如果完全相同，记录“无需基线提交”并继续。

回滚点：基线提交不含生产代码，可独立回滚；后续所有 CSS 和视觉判断均以此提交为前态。

## 第 2 步：先建立会失败的第三版契约

### 2.1 静态课程契约

- [ ] 扩展 `tools/check-convolution-lesson-visuals.js`，保留现有 Loop 02 断言并新增：
  - 6 个 H2 顺序和应用内 8 页课程结构对应关系不变；
  - 各知识页的内容岛数量与页内重置编号可从稳定 `data-convolution-*` 标记验证；
  - 第 4 页五步时间线只算一个连续视觉，但内部必须有 `01–05`；
  - 五种语义色变量和每类高亮标记存在；
  - 恰好存在扫描时间轴、五步时间线、教材用途流程三种代码原生图解；
  - 恰好保留两张 V2 图和一个 GeoGebra Demo；
  - 第 6 页不存在旧横向三列标记、外部图片或新增交互脚本。
- [ ] 继续锁定墨水池、洒水车、RLC、sampling/filtering、cascade、Key Takeaway 和教材幅值 `2` 等原有教学契约。

### 2.2 专用真实布局检查

- [ ] 新增 `tools/test-convolution-lesson-layout.js`，复用 `tools/test-utils.js` 的服务启动、课程打开和稳定等待能力，不复制一套 Playwright 基础设施。
- [ ] 检查真实 `/api/section` 命中 `2.4-2`，应用页码能从 `1/8` 到 `8/8`，6 个知识页没有被自动拆成额外页。
- [ ] 在桌面、390px 和 430px 检查：页面无横向溢出；内容岛、序号和三张图解具有非零稳定尺寸；第 6 页流程方向为纵向；两张 V2 图完整显示。
- [ ] 在测试中验证三张图解包含可访问标题/说明，且不只依赖颜色表达变量或箭头关系。
- [ ] 在 `package.json` 新增独立命令 `test:convolution-layout`；该 Playwright 检查不塞进快速 `npm run check`，但列为本 Loop 的强制验收门。
- [ ] 在生产课程和 CSS 修改前运行新静态契约与布局检查，确认只因第三版标记、图解和样式尚未实现而失败；把失败原因写入任务记录。
- [ ] 以 `test: 锁定卷积第三版扫读契约` 单独提交失败契约和测试入口。

回滚点：本提交只改变测试。若契约证明现有 KC block 无法稳定承载内联图解，回到设计阶段，不修改 Markdown engine 或课程分页器。

## 第 3 步：重排六页课程内容

- [ ] 只修改应用实际命中的缓存：
  `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`。
- [ ] 保持 Section Objective 一句、Concepts 3 项、6 个原 H2、英文课程语言和现有 GeoGebra `data-demo-b64` 原样可识别。
- [ ] 使用受审查的 `KC_BLOCK` 输出统一内容岛结构；每页只保留一条必要过渡句，其余核心文字改成短 Bullet。
- [ ] 各页按设计文档落实：
  - 第 1 页：系统记忆、墨水池类比、公式映射；
  - 第 2 页：核心公式、`t` 固定与 `τ` 扫描、快速读法；
  - 第 3 页：农田与洒水车、Flip & Slide、Multiply & Integrate；
  - 第 4 页：Fix、Flip、Slide、Multiply、Record 纵向五步；
  - 第 5 页：教材信号、唯一 GeoGebra、First Contact、输出检查值、Common Trap；
  - 第 6 页：卷积主线、RLC、滤波、级联、Key Takeaway。
- [ ] 保留两个已确认类比的口语含义和符号映射，不为了缩短文字删掉“稀疏庄稼/茂密庄稼”的乘积直觉。
- [ ] 在第 2、4、6 页加入语义 HTML 与内联 SVG 图解；每个 SVG 使用稳定 `viewBox`、可访问标题和文本标签，不包含动画、Canvas、外部 URL 或脚本。
- [ ] 两张 V2 图的文件、URL、尺寸、`alt` 和懒加载行为保持不变；旧版生成图不删除。
- [ ] GeoGebra block、场景名、初始值、滑块范围、降级图和数学正文不修改。

回滚点：课程缓存可以独立恢复到 Loop 02；若 H2 自动分页不再得到 `8/8`，先压缩内容岛或合并 Bullet，不修改分页器。

## 第 4 步：实现课程专属视觉样式

- [ ] 在 `app/style.css` 现有 `2.4-2 analogy visuals` 区域附近扩展 `.convolution-*`，按选择器 token 编辑，不碰无关 banner 或复杂通用级联。
- [ ] 在 `[data-lesson-section="2.4-2"]` 作用域内定义五种语义色变量：
  - 输入 `#2563eb`
  - 响应 `#7c3aed`
  - 动作 `#16876a`
  - 输出 `#b45309`
  - 警告 `#dc2626`
- [ ] 内容岛使用中性细边界、最多 4px 语义色边线、淡底和不超过 7px 圆角；不加重阴影、hover 位移、卡片套卡片或整页外框。
- [ ] 使用稳定网格轨道、`minmax()`、`aspect-ratio` 和 SVG `viewBox` 固定序号与图解尺寸；不新增随视口宽度缩放的字体。
- [ ] 桌面端只允许类比正文/图片和第 2 页正文/时间轴两处两列；第 4、6 页保持纵向。
- [ ] `760px` 及以下全部按设计改为单列，390px 和 430px 上文字、公式、箭头和序号不互相遮挡。
- [ ] 深色主题若对固定语义色对比不足，只增加课程专属衬底，不改变颜色含义。
- [ ] 不修改 `app/lesson-render.js`、`app/markdown-engine.js`、GeoGebra 文件、静态路由或其他课程样式；若实施中发现必须修改这些文件，停止并回到规格复核。
- [ ] 运行新静态契约，直到第三版结构检查通过。
- [ ] 以 `feat: 实现卷积第三版扫读结构` 提交课程缓存、课程专属 CSS 和必要测试调整。

回滚点：删除新增 `.convolution-*` 样式并恢复课程缓存即可回到 Loop 02；两张 V2 图、静态路由和 GeoGebra 不需要联动回滚。

## 第 5 步：自动化回归

- [ ] `git diff --check`
- [ ] `npm run check:convolution-visuals`
- [ ] `npm run test:convolution-layout`
- [ ] `node tools/check-geogebra-pilot.js`
- [ ] `npm run test:geogebra`，保持现有 `11/11`。
- [ ] `npm run test:mobile-learn-panels`
- [ ] `npm run check`
- [ ] `npm run test:css-probe:check`，既有 probe 必须字节一致；新增样式只作用于未改变的课程专属 DOM。
- [ ] `npm run test:visual:check`，通用视图无本轮新增回归；文字抗锯齿只按已记录噪声判断。
- [ ] 复核 `git diff --name-only`，确认生产改动只落在 PRD 允许的课程缓存、课程专属 CSS、定向测试和任务文档。

任何强制命令失败都不进入真实页面验收。GeoGebra 数学、应用页数或现有 probe 变化视为阻断问题，不能更新期望值掩盖。

## 第 6 步：真实页面视觉验收

- [ ] 在未占用端口启动本分支服务；优先使用 `9145`，若已占用则选择新端口并记录。
- [ ] 验证 `/health` 和真实 `/api/section`，确认不是打开旧进程或其他工作区。
- [ ] 从 `1/8` 逐页检查至 `8/8`，重点截图第 1、2、4、5、6 页到本任务 `evidence/`。
- [ ] 桌面视口检查内容岛密度、语义高亮、两张 V2 图、扫描关系、五步微型信号、教材纵向流程和唯一 GeoGebra。
- [ ] 390px 与 430px 检查：
  - 无横向溢出和分页器永久遮挡；
  - Bullet 可扫读，大序号不挤压正文；
  - 第 2 页连接线指向正确变量；
  - 第 4 页五步差异仍可辨认；
  - 第 6 页三条流程均能自上而下读懂；
  - 两张 V2 图完整，GeoGebra 初载画布非空且可操作。
- [ ] 检查控制台与网络：无新增 JavaScript error、图片 404、内联图解空白或 GeoGebra 生命周期错误。
- [ ] 若真实页面仍出现文字墙，只压缩对应 Bullet；若图解关系看不懂，回到该图的结构设计，不用新增装饰图补救。

## 第 7 步：双语验收与交付

- [ ] 在 `verification.md` 先写完整中文验收，再写英文摘要；记录所有命令结果、`8/8`、GeoGebra `11/11`、关键数学值、视口尺寸、截图路径和剩余风险。
- [ ] 更新 `workspace/memory/2026-08-01.md`，记录第三版最终取舍、测试结论和下一次教学反馈入口。
- [ ] 最后重跑第 5 步全部强制命令并执行 `git diff --check`。
- [ ] 以 `docs: 记录卷积第三版验收` 单独提交任务记录和当天记忆。
- [ ] 保持分支不推送、不创建 PR、不合并；用户先复核真实页面和提交历史，再决定后续 GitHub 操作。
