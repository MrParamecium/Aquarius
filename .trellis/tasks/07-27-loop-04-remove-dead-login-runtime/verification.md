# 验收记录

验收日期：2026-07-27

## 结论

登录页中不可见的 Three.js 粒子运行时已经完整删除，GSAP、ScrollTrigger 和 `login-cosmos.js` 不再下载或执行。登录页改为以真实的 `#loginView` 作为一次性事件绑定锚点，静态视觉、密码显隐和访客入口保持可用。

本 Loop 没有修改 Clerk Token、服务端认证、课程 Demo、教材材料、课程缓存、用户记忆或持久化接口。GitHub、Google 和邮箱登录控件及原事件路径均保留；本地验收没有实际发起外部 OAuth 或提交真实账号密码，以免产生外部账号副作用。

## 删除范围

- 删除页面入口中的 Three.js、GSAP、ScrollTrigger 和 `login-cosmos.js` 脚本。
- 删除 `loginWebglContainer`、`introWebglContainer`、隐藏 Canvas 专属样式和测试遮罩。
- 删除 15000 粒子创建、`requestAnimationFrame` 循环、鼠标与窗口监听器以及 GPU 资源销毁逻辑。
- 删除 `loginScene`、`destroyLoginScene()` 和八个无效调用点。
- `initLoginExperience()` 改用 `#loginView[data-bound-login-experience]` 防止重复绑定。
- 从语法检查清单移除已删除的 `app/login-cosmos.js`。

## 自动化结果

### 通过

| 检查 | 结果 |
|---|---|
| `git diff --check` | 通过 |
| 受影响 JavaScript 语法检查 | 通过 |
| `node tools/test-utils.test.js` | 通过，`7/7` |
| `node tools/find-dead-redeclarations.js --validate` | 通过，`19 passed` |
| `node tools/check-harness-exports.js` | 通过 |
| `node tools/check-demo-family-map.js` | 通过 |
| `node tools/check-geogebra-pilot.js` | 通过 |
| GeoGebra 与相关测试脚本语法检查 | 通过 |
| 静态运行引用扫描 | 通过；`app/`、`tools/`、`package.json` 中目标运行引用为零 |

### 仓库既有限制

- `npm run check` 的前置语法、自测、导出、Demo 路由和 GeoGebra 检查均通过，随后被 876 个用户保留的带 ` 2` 后缀重复材料文件拦截。
- `npm run test:css-probe:check` 的 21 个界面状态均成功采集；整套命令仍报告反馈板四项既有亚像素漂移，宽度和伪元素位置相差约 `0.547px`。本 Loop 没有修改反馈板选择器。
- 没有运行会重写 `tools/visual-diff-coverage.json` 的完整视觉差异流程；该用户原有文件保持 SHA-256 `ca1592e1e95c25318919af34fd9e5c10540c04fdd3dc89bdc59994ee7108fc5a`，并明确排除在提交之外。

## 浏览器实测

本地服务：`http://localhost:9134/`

- 实际请求日志中没有 Three.js、GSAP、ScrollTrigger 或 `login-cosmos.js`。
- 登录页 `canvas` 数量为 `0`，两个旧 WebGL 容器数量为 `0`。
- 页面全局不存在 `THREE`、`gsap` 或 `ScrollTrigger`。
- 密码输入框完成 `password -> text -> password` 两次切换，按钮文案同步从显示变为隐藏。
- 访客按钮成功进入工作区，章节导航和问答区正常出现。
- 浏览器控制台错误数量为 `0`。
- 桌面 `1440x900` 与手机 `390x844` 均无横向溢出，登录卡片没有空白 Canvas、重叠或布局断裂。
- 临时截图保存在 `/tmp/fourier-login-desktop.png` 与 `/tmp/fourier-login-mobile.png`，不进入仓库。

## 范围确认

- `tools/visual-diff-coverage.json` 未纳入本 Loop 提交。
- `.superpowers/`、所有带 ` 2` 后缀文件、教材页、OCR、公式目录和课程缓存均未纳入本 Loop 提交。
- 没有更新视觉基线，也没有自动合并到 `main`。

## 回滚

本 Loop 不含数据迁移。若认证入口出现回归，可整体回滚实现提交，恢复动画脚本、两个隐藏容器、登录场景生命周期和对应测试说明；课程与用户数据无需处理。
