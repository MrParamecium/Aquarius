# 验收记录 / Verification Record

验收日期 / Verification date: 2026-07-27

## 结论 / Conclusion

登录页中不可见的 Three.js 粒子运行时已经完整删除，GSAP、ScrollTrigger 和 `login-cosmos.js` 不再下载或执行。登录页改为以真实的 `#loginView` 作为一次性事件绑定锚点，静态视觉、密码显隐和访客入口保持可用。

The invisible Three.js particle runtime has been fully removed from the login page. GSAP, ScrollTrigger, and `login-cosmos.js` are no longer downloaded or executed. The login page now uses the real `#loginView` element as the one-time event binding anchor, while preserving the static visuals, password visibility control, and guest entry.

本 Loop 没有修改 Clerk Token、服务端认证、课程 Demo、教材材料、课程缓存、用户记忆或持久化接口。GitHub、Google 和邮箱登录控件及原事件路径均保留；本地验收没有实际发起外部 OAuth 或提交真实账号密码，以免产生外部账号副作用。

This Loop does not modify Clerk tokens, server-side authentication, course demos, textbook materials, course caches, user memory, or persistence APIs. The GitHub, Google, and email login controls and their existing event paths remain intact. Local verification did not initiate external OAuth or submit real account credentials, avoiding side effects on external accounts.

## 删除范围 / Removal Scope

- 删除页面入口中的 Three.js、GSAP、ScrollTrigger 和 `login-cosmos.js` 脚本。<br>
  Removed the Three.js, GSAP, ScrollTrigger, and `login-cosmos.js` scripts from the page entry point.
- 删除 `loginWebglContainer`、`introWebglContainer`、隐藏 Canvas 专属样式和测试遮罩。<br>
  Removed `loginWebglContainer`, `introWebglContainer`, hidden-Canvas-specific styles, and test masks.
- 删除 15000 粒子创建、`requestAnimationFrame` 循环、鼠标与窗口监听器以及 GPU 资源销毁逻辑。<br>
  Removed creation of 15,000 particles, the `requestAnimationFrame` loop, mouse and window listeners, and GPU resource cleanup logic.
- 删除 `loginScene`、`destroyLoginScene()` 和八个无效调用点。<br>
  Removed `loginScene`, `destroyLoginScene()`, and eight obsolete call sites.
- `initLoginExperience()` 改用 `#loginView[data-bound-login-experience]` 防止重复绑定。<br>
  Updated `initLoginExperience()` to use `#loginView[data-bound-login-experience]` to prevent duplicate bindings.
- 从语法检查清单移除已删除的 `app/login-cosmos.js`。<br>
  Removed the deleted `app/login-cosmos.js` file from the syntax-check list.

## 自动化结果 / Automated Results

### 通过 / Passed

| 检查 / Check | 结果 / Result |
|---|---|
| `git diff --check` | 通过 / Passed |
| 受影响 JavaScript 语法检查 / Affected JavaScript syntax checks | 通过 / Passed |
| `node tools/test-utils.test.js` | 通过，`7/7` / Passed, `7/7` |
| `node tools/find-dead-redeclarations.js --validate` | 通过，`19 passed` / Passed, `19 passed` |
| `node tools/check-harness-exports.js` | 通过 / Passed |
| `node tools/check-demo-family-map.js` | 通过 / Passed |
| `node tools/check-geogebra-pilot.js` | 通过 / Passed |
| GeoGebra 与相关测试脚本语法检查 / GeoGebra and related test-script syntax checks | 通过 / Passed |
| 静态运行引用扫描 / Static runtime-reference scan | 通过；`app/`、`tools/`、`package.json` 中目标运行引用为零 / Passed; zero target runtime references in `app/`, `tools/`, and `package.json` |

### 仓库既有限制 / Existing Repository Limitations

- `npm run check` 的前置语法、自测、导出、Demo 路由和 GeoGebra 检查均通过，随后被 876 个用户保留的带 ` 2` 后缀重复材料文件拦截。<br>
  The syntax, self-test, export, demo routing, and GeoGebra stages of `npm run check` passed before the command was blocked by 876 user-preserved duplicate material files with the ` 2` suffix.
- `npm run test:css-probe:check` 的 21 个界面状态均成功采集；整套命令仍报告反馈板四项既有亚像素漂移，宽度和伪元素位置相差约 `0.547px`。本 Loop 没有修改反馈板选择器。<br>
  All 21 UI states were collected successfully by `npm run test:css-probe:check`. The full command still reports four existing subpixel drifts in the feedback board, with width and pseudo-element position differences of approximately `0.547px`. This Loop does not modify feedback-board selectors.
- 没有运行会重写 `tools/visual-diff-coverage.json` 的完整视觉差异流程；该用户原有文件保持 SHA-256 `ca1592e1e95c25318919af34fd9e5c10540c04fdd3dc89bdc59994ee7108fc5a`，并明确排除在提交之外。<br>
  The full visual-diff workflow that would rewrite `tools/visual-diff-coverage.json` was not run. The user-owned file retains SHA-256 `ca1592e1e95c25318919af34fd9e5c10540c04fdd3dc89bdc59994ee7108fc5a` and is explicitly excluded from the commit.

## 浏览器实测 / Browser Verification

本地服务 / Local service: `http://localhost:9134/`

- 实际请求日志中没有 Three.js、GSAP、ScrollTrigger 或 `login-cosmos.js`。<br>
  The actual request log contains no Three.js, GSAP, ScrollTrigger, or `login-cosmos.js` requests.
- 登录页 `canvas` 数量为 `0`，两个旧 WebGL 容器数量为 `0`。<br>
  The login page contains `0` canvas elements and `0` legacy WebGL containers.
- 页面全局不存在 `THREE`、`gsap` 或 `ScrollTrigger`。<br>
  The page exposes no global `THREE`, `gsap`, or `ScrollTrigger` objects.
- 密码输入框完成 `password -> text -> password` 两次切换，按钮文案同步从显示变为隐藏。<br>
  The password input completed the `password -> text -> password` toggle sequence, with the button label changing from show to hide accordingly.
- 访客按钮成功进入工作区，章节导航和问答区正常出现。<br>
  The guest button successfully entered the workspace, where the chapter navigation and question area appeared normally.
- 浏览器控制台错误数量为 `0`。<br>
  The browser console reported `0` errors.
- 桌面 `1440x900` 与手机 `390x844` 均无横向溢出，登录卡片没有空白 Canvas、重叠或布局断裂。<br>
  Neither the `1440x900` desktop viewport nor the `390x844` mobile viewport had horizontal overflow, blank canvases, overlapping elements, or broken login-card layout.
- 临时截图保存在 `/tmp/fourier-login-desktop.png` 与 `/tmp/fourier-login-mobile.png`，不进入仓库。<br>
  Temporary screenshots are stored at `/tmp/fourier-login-desktop.png` and `/tmp/fourier-login-mobile.png` and are not committed to the repository.

## 范围确认 / Scope Confirmation

- `tools/visual-diff-coverage.json` 未纳入本 Loop 提交。<br>
  `tools/visual-diff-coverage.json` is not included in this Loop's commit.
- `.superpowers/`、所有带 ` 2` 后缀文件、教材页、OCR、公式目录和课程缓存均未纳入本 Loop 提交。<br>
  `.superpowers/`, all files with the ` 2` suffix, textbook pages, OCR data, the formula catalog, and course caches are not included in this Loop's commit.
- 没有更新视觉基线，也没有自动合并到 `main`。<br>
  No visual baseline was updated, and the branch was not automatically merged into `main`.

## 回滚 / Rollback

本 Loop 不含数据迁移。若认证入口出现回归，可整体回滚实现提交，恢复动画脚本、两个隐藏容器、登录场景生命周期和对应测试说明；课程与用户数据无需处理。

This Loop contains no data migration. If the authentication entry point regresses, revert the implementation commit as a whole to restore the animation scripts, both hidden containers, the login-scene lifecycle, and the related test descriptions. No course or user data needs to be changed.
