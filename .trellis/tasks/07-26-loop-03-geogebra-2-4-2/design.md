# 技术设计

## 现状与问题

重构版的 Demo 子系统已经按 renderer 家族拆分到 `app/interactive-demos/`。课程缓存使用 `data-demo-b64` 保存声明式 JSON，`dispatcher.js` 负责推断家族、去重、水合和显式 teardown。现有 `convolution-lab.js` 实现的是离散卷积 `x[n] * h[n]`，不能表达 `2.4-2` 教材中的连续时间翻转和平移。

重构版已经包含 `2.4-2` 的 syllabus、页码映射、OCR 和 `page-179-figure_2_7.png`，但没有正式 lesson cache。旧项目缓存有 14 个连续卷积 Canvas Demo；其中 Figure 2.7 renderer 把 `g` 的支撑方向写反，与“`t=-3` 首次接触”的文案矛盾，因此旧代码不能直接迁入。

## 方案取舍

### 方案 A：声明式适配层与代码构建场景

课程只声明 GeoGebra framework、场景 ID 和教学参数，受信场景模块使用 GeoGebra API 构建对象。该方案可审查、可测试、能复用加载和生命周期能力，因此被选用。

### 方案 B：每个课程保存独立 `.ggb` 文件

制作直观，但二进制资源难以代码审查、批量修改和验证数学差异。章节增多后会形成大量独立构图文件，本试点不采用。

### 方案 C：嵌入在线 `material_id`

最快看到画面，但课程依赖远程作品、账户状态和外部版本，Tutor Agent 难以控制样式、事件和回滚，本试点不采用。

## 总体数据流

```text
2.4-2 lesson cache
  data-demo-b64
        |
        v
dispatcher 显式识别 framework: geogebra
        |
        v
GeoGebra Demo 外壳
  步骤、提示、重置、加载/失败状态
        |
        v
GeoGebra 通用运行时
  CDN、固定版本、注入、resize、teardown
        |
        v
convolution_figure_2_7 场景
  数学对象、可见性、t 监听、面积与输出
```

## 模块边界

### `app/interactive-demos/geogebra-runtime.js`

维护单例加载状态 `idle -> loading -> ready | failed`，动态加载官方 `deployggb.js`，并通过 `setHTML5Codebase()` 固定到 `https://www.geogebra.org/apps/5.4.920.0/web3d`。已有 `window.GGBApplet` 时直接复用；失败重试必须清除失败 Promise 与失效 script 节点。

该模块还维护只接受本地注册函数的场景 registry。它提供 Applet 创建、唯一 ID、超时、尺寸更新和 `remove()` 包装，但不包含 Figure 2.7 数学命令。

### `app/interactive-demos/geogebra-demo.js`

定义 dispatcher 使用的 `renderGeoGebraDemo(node, demo)`。它验证 `spec.scene` 是否存在，渲染 Tutor Agent 外层标题、四步导航、反馈、重置、加载和失败回退，再调用 runtime 注入 Applet。

该模块拥有 DOM 事件与无障碍状态，使用 `aria-live` 发布加载、首次接触和错误信息。它通过现有 `window.__ftutorRegisterInteractiveDemoCleanup` 注册一次幂等 cleanup，并用 generation token 拒绝已经过期的异步完成回调。

### `app/interactive-demos/geogebra-convolution-figure-2-7.js`

向 registry 注册 `convolution_figure_2_7`。场景只暴露以下接口：

- `create(api, options)`：创建数学对象、设置坐标和初始状态；
- `setStep(step)`：切换对象可见性与交互权限，不重建构图；
- `reset()`：恢复 step 1 与 `t=-4`；
- `getState()`：返回 `t`、当前面积、当前输出和是否命中首次接触；
- `destroy()`：注销场景级 listener。

缓存不能传入任意 GeoGebra 命令，只能传入经过白名单归一化的初始值、范围、步长、目标和回退图片。

### `app/interactive-demos/dispatcher.js`

在标题关键词推断之前检查 `spec.framework === 'geogebra'` 并返回 `geogebra`。`INTERACTIVE_DEMO_FAMILY_RENDERERS` 新增 `geogebra: renderGeoGebraDemo`，使现有 family-map 静态检查继续覆盖新键。普通卷积文本仍路由到 `convolution_lab`。

### `app/index.html`

只增加本地模块 script 标签，顺序为 runtime、Figure 2.7 场景、通用 Demo 外壳、dispatcher。不得静态引入远程 GeoGebra script；远程脚本由 runtime 懒加载。

### 课程缓存

新增 `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`。课程正文聚焦教材 Figure 2.7，包含本地教材图、核心公式、一个 GeoGebra block、常见误区和小结，不复制旧缓存后续 Figures 2.8-2.14 的 Demo。

Demo 数据契约：

```json
{
  "type": "interactive_demo",
  "demo_type": "geogebra_convolution",
  "title": "Graphical convolution: flip, slide, and integrate",
  "spec": {
    "framework": "geogebra",
    "scene": "convolution_figure_2_7",
    "guidance": "soft",
    "initial_step": 1,
    "initial_t": -4,
    "t_min": -4,
    "t_max": 3,
    "t_step": 0.05,
    "target_t": -3,
    "target_tolerance": 0.08,
    "fallback_figure": "/figures/page-179-figure_2_7.png"
  }
}
```

## 数学构图

场景以 `tau` 为积分轴：

```text
x(tau)       = If(tau >= -1, 1, 0)
g(tau)       = If(tau >= -2, exp(-(tau + 2)), 0)
g(-tau)      = If(tau <= 2, exp(tau - 2), 0)
g(t - tau)   = If(tau <= t + 2, exp(tau - t - 2), 0)
product      = x(tau) * g(t - tau)
c(s)         = If(s < -3, 0, 1 - exp(-(s + 3)))
currentPoint = (t, c(t))
```

一个 Applet 使用 Graphics View 与 Graphics View 2 形成上下联动画图区：上区展示 `tau` 轴、原信号/翻转信号/移动信号及橙色积分区域；下区展示 `c(t)` 与当前点。实施第 0 步先验证固定版本对双画图区、对象归属和移动端尺寸的支持；验证失败时回到设计，不改成两个 Applet。

关键数值：

```text
t < -3: c(t) = 0
t = -3: c(t) = 0
t = -2: c(t) = 1 - e^-1
t =  0: c(t) = 1 - e^-3
```

显示面积与 `c(t)` 使用同一数学定义；真实 CDN 冒烟测试必须从 Applet API 读取两个对象并比较，避免只测试 Tutor Agent 的 JavaScript 文案。

## 四步状态机

1. `signals`：显示 `x(tau)` 与 `g(tau)`；隐藏移动信号、面积和输出区。
2. `flip`：保留淡色 `g(tau)` 参照，显示 `g(-tau)` 与支撑边界从 `-2` 到 `2` 的变化。
3. `slide`：显示 `x(tau)`、`g(t-tau)` 与 `t` 滑块，初始值 `-4`；监听 `t`，进入 `-3 +/- 0.08` 时外层提示首次接触。
4. `integrate`：保持同一 `t`，显示乘积区域、面积、完整输出曲线和移动点。

`上一步/下一步` 始终可用到边界，不以完成操作为硬门槛。重置是唯一恢复初始状态的动作。

## 加载、失败与销毁

- 加载容器使用稳定最小高度，避免课程布局跳动。
- runtime 设置 15 秒初始化超时。超时、script error、缺少 `GGBApplet` 或 `appletOnLoad` 不返回 API 均进入统一失败状态。
- 失败状态显示本地 Figure 2.7、核心公式和重试按钮；课程其余文字保持可读。
- 重试只重建当前 Applet，不重复绑定外层事件。
- `ResizeObserver` 只调用 API `setSize()`；不得因 resize 重建场景。
- cleanup 顺序为：标记 generation 失效、断开 observer、注销 update/client listener、停止动画、调用 Applet `remove()`、清空引用。
- cleanup 必须幂等；课程节点仍连接时主动 teardown 也必须释放资源。

## 样式与可访问性

GeoGebra 外壳样式只使用专属 `.geogebra-demo-*` 类，放在现有 Demo 样式所有者中。通用课程布局只允许增加下文已确认的移动端单面板规则，不改变桌面双栏。外壳保持工作型课程界面：小标题、紧凑步骤控制、固定画布尺寸、清晰状态反馈，不使用营销式大卡片或 GeoGebra 原生编辑器 chrome。

步骤、重置和重试使用原生 button；`t` 滑块必须可聚焦并支持方向键。若固定版本内置滑块无法满足键盘或触屏验收，则由 Tutor Agent 提供与同一 GeoGebra `t` 对象双向同步的原生 range 控件，不能牺牲可访问性或改成两个状态源。

## 移动端讲义与问答单面板

### 已确认的问题

重构版课程在 `390px` 视口仍套用桌面双栏网格：问答列保留 `320px` 以上最小宽度，导致讲义列和 `#learnExplainScroll` 的实际宽度变为 `0`。现有“显示讲义”按钮同时保持隐藏，因此用户没有可点击的恢复路径。该问题在 Loop 03 修改前已经存在，但会让真实 `2.4-2` 移动端课程无法看到 GeoGebra，必须并入本循环修复。

### 采用方案

在 `900px` 及以下使用明确的单面板状态，而不是同时压缩讲义和问答：

- `lecture`：讲义占满课程内容宽度，问答列与分隔条隐藏，“显示问答”按钮可见；
- `qa`：问答占满课程内容宽度，讲义列与分隔条隐藏，“显示讲义”按钮可见。

课程在移动端首次打开时进入 `lecture`，保证正文、教材图和交互 Demo 是第一可见内容。用户可随时切到 `qa`，再通过对侧恢复按钮回到 `lecture`。两个按钮都沿用现有 DOM、事件和文案，不新增悬浮菜单或第三套导航。

### 状态所有权与转换

`app.js` 继续拥有课程面板状态。新增一个小型移动端状态归一函数，把现有 `isLearnChatCollapsed`、`isLearnExplainCollapsed` 和 `learnPanelFocus` 同步为互斥状态，避免 CSS 显示结果与 JavaScript 状态分离：

```text
打开移动端课程 / 桌面缩到 <= 900px
                 |
                 v
             lecture
        显示问答 | | 显示讲义
                 v ^
                qa
```

进入 `lecture` 时只允许 `chat-collapsed` 生效；进入 `qa` 时只允许 `explain-collapsed` 生效。不得同时折叠两侧，也不得仅靠 `:has(.geogebra-demo-shell)` 绕过全局状态。GeoGebra renderer 不读取或修改课程面板状态，继续只负责自身数学场景和生命周期。

### 断点切换

- 从桌面进入 `<= 900px` 时归一到 `lecture`，避免已有双栏比例把讲义挤成零宽；
- 从移动端回到桌面时恢复现有 `normal` 双栏状态，不保留移动端折叠类；
- 同一断点内的普通 resize 只保持当前 `lecture` 或 `qa`，不得强制把正在提问的用户切回讲义；
- 监听器只注册一次，并复用页面现有的面板状态函数，不为每个 Demo 或课程重复注册。

### 移动端样式边界

移动端规则只负责单列尺寸和可见性：当前面板宽度为 `100%`、`min-width: 0`，隐藏非当前面板与分隔条，并保证恢复按钮至少 `44px`。桌面双栏比例、拖拽分隔、章节概览、教材模式以及 GeoGebra 专属容器规则保持不变。

问答列已有的 `360px` 最小宽度必须在移动断点内覆盖为 `0`，防止 `390px` 视口出现横向溢出。讲义恢复后，GeoGebra 外壳、两个 Canvas 和原生 `t` 滑块必须重新获得非零宽度，Applet 不应因面板切换被销毁或重建。

### 移动端验收

真实 `2.4-2` 课程在 `390x844` 下按以下路径验收：

1. 打开课程第 `4 / 7` 页，默认看到讲义和已就绪的两个 Canvas；
2. 点击“显示问答”，确认问答区占满宽度且无横向溢出；
3. 点击“显示讲义”，确认返回同一 GeoGebra 实例、当前步骤和 `t` 值不丢失；
4. 在返回后的画布上完成步骤切换、键盘调整 `t` 和重置；
5. 从 `390px` 扩到桌面宽度，确认恢复原双栏且页面无重载、无新增控制台错误。

## 验证设计

1. 静态契约测试检查新缓存存在、只含一个 GeoGebra block、场景 ID 与回退图片受信、Figure 2.7 在现有映射中允许。
2. family-map 检查保证 `geogebra` 推断值、renderer 键与函数定义一致，普通卷积仍为 `convolution_lab`。
3. 使用 fake `GGBApplet`/fake API 的 Playwright 测试验证懒加载复用、四步状态、软引导、重置、失败重试、generation guard、resize 与 teardown，不让 CI 依赖公网。
4. 扩展 Demo 生命周期测试，确认 listener、observer 和 `remove()` 在主动 teardown 后执行且只执行一次。
5. 真实 CDN 冒烟测试读取 `t=-4,-3,-2,0` 的 GeoGebra 对象值并比较面积/输出，检查桌面与移动画布非空像素及控制台无错误。
6. CSS 修改后运行既有 css-probe 与 visual-diff `--check`，现有 35 个视图应保持在既有噪声范围；GeoGebra 新画面另存任务 evidence，不把公网依赖加入普通视觉基线。
7. 增加真实课程移动端面板回归测试，覆盖默认讲义、切到问答、返回讲义、GeoGebra 状态保留及恢复桌面双栏。

## 推出与回滚

该 renderer 只有显式 `framework: "geogebra"` 才会启用。GeoGebra 试点可通过删除 `2.4-2` 新缓存中的 block 和对应 renderer 接入回滚；移动端单面板修复可独立回滚其状态函数、事件分支和移动断点样式。两部分不得通过相互依赖的选择器或全局变量绑死，现有 Canvas renderer 不受影响。若试点成功，后续 Loop 再决定自托管 Bundle、统一场景 schema 和其他课程迁移；本循环不预先实现这些能力。
