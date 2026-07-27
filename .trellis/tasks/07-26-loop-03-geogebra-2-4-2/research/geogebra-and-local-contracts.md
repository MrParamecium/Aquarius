# GeoGebra 与本地项目契约核对

核对日期：2026-07-26

## 官方资料

- 嵌入文档：<https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/>
- JavaScript API：<https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/>
- App 参数：<https://geogebra.github.io/docs/reference/en/GeoGebra_App_Parameters/>
- 许可：<https://www.geogebra.org/license>
- 官方加载器：<https://www.geogebra.org/apps/deployggb.js>

## 已核验能力

1. 官方推荐通过 `deployggb.js` 与 `new GGBApplet(params)` 嵌入，并调用 `inject()` 放入指定容器。
2. `appletOnLoad(api)` 可在 Applet 就绪时取得 JavaScript API。
3. `setHTML5Codebase()` 可使用 CDN 固定版本，也可在未来切换到本地 Math Apps Bundle。官方文档明确给出固定 CDN 版本的方式。
4. 2026-07-26 读取官方 `deployggb.js` 时观察到当前 codebase 版本 `5.4.920.0`；`https://www.geogebra.org/apps/5.4.920.0/web3d/web3d.nocache.js` 返回 HTTP 200。本试点锁定该版本。
5. API 提供 `evalCommand`、`setValue/getValue`、`setSize`、`registerUpdateListener/unregisterUpdateListener`、`registerClientListener/unregisterClientListener` 和 `remove()`。
6. App 参数支持隐藏 `showToolBar`、`showMenuBar`、`showAlgebraInput`、`showResetIcon`，并可限制标签拖动与平移缩放。
7. 官方提供 Math Apps Bundle 自托管路径；本试点先使用 CDN，未来离线 Loop 可复用适配层切换 codebase。
8. 用户已明确 Tutor Agent 当前为非商业用途，因此本试点按 GeoGebra 非商业许可进行；商业化前必须重新审查许可并取得相应授权。

## 本地项目事实

1. 实际重构版目录为 `/Users/chenghaoxiang/Desktop/Fourier-loop-01-ch4-ch5-materials`，Loop 03 基线为远端 `main@9f8360d`。
2. 应用是无 bundler 的 vanilla HTML/JS/CSS，新增模块必须作为 classic script 按顺序加载，不引入 React/TypeScript 假设。
3. `app/interactive-demos/dispatcher.js` 已拥有 family registry、去重和显式 teardown；新引擎应接入这些边界，不绕过它们。
4. `convolution-lab.js` 是离散卷积，不能替代 `2.4-2` 连续图解卷积。
5. 正式缓存目录中没有 `2_4-2`，但以下依赖均存在：
   - `app/data/syllabus-data.js` 中的 `2.4-2`；
   - `app/section-page-map-new.json` 的 pages 178-190；
   - `app/section-figure-map-new.json` 的 Figure 2.7 等允许图片；
   - `workspace/materials/new-book-ocr/page-178.txt` 与 `page-179.txt`；
   - `workspace/materials/new-book-figures/page-179-figure_2_7.png`。
6. 课程缓存实际路径规范为 `<materials>/lesson-cache/<normalized-section-id>/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`，因此 `2.4-2` 应写入 `workspace/materials/lesson-cache/2_4-2/`。
7. 旧项目 Figure 2.7 Canvas renderer 使用 `movingBase(s) = exp((s-2)/1.25)` 且支撑为 `s <= 2`，与教材原图中从 `t=-2` 向右衰减的 `g(t)` 方向相反；旧代码不能迁移。

## Figure 2.7 数学核对

由教材图中两个归一化信号可读出：

```text
x(t) = u(t + 1)
g(t) = exp(-(t + 2)) u(t + 2)
```

翻转和平移：

```text
g(-tau) = exp(tau - 2) u(2 - tau)
g(t - tau) = exp(tau - t - 2) u(t + 2 - tau)
```

`x(tau)` 的支撑为 `tau >= -1`，`g(t-tau)` 的支撑为 `tau <= t+2`，因此区间非空条件是：

```text
-1 <= t + 2  =>  t >= -3
```

卷积输出：

```text
c(t) = integral(exp(tau-t-2), tau=-1..t+2)
     = 1 - exp(-(t+3)), t >= -3
     = 0,               t < -3
```

关键读数：

```text
c(-4) = 0
c(-3) = 0
c(-2) = 1 - e^-1 ~= 0.6321205588
c( 0) = 1 - e^-3 ~= 0.9502129316
```

## 实施风险与约束

- `deployggb.js` 本身只是加载器，固定版本必须通过 `setHTML5Codebase()`，不能只记录 loader URL。
- 普通 CI 不应依赖 GeoGebra 公网；使用 fake API 验证 Tutor Agent 集成，另用真实 CDN 冒烟测试验证数学对象和渲染。
- 一个 Applet 的 Graphics View + Graphics View 2 需要在正式实现前做固定版本探针；失败时必须回到设计，而不是隐式增加第二个 Applet。
- GeoGebra update listener、client listener、ResizeObserver 与 Applet 都有独立生命周期，cleanup 必须幂等且覆盖加载中的离开场景。
- 课程缓存属于受信内容，但仍不应允许其直接提供 `evalCommand`，否则课程数据会变成不受审查的命令入口。
- CDN 失败不能影响课程正文；回退必须完全使用已存在的本地教材图和公式。
