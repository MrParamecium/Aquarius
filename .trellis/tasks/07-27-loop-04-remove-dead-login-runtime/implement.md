# 实施计划

## 步骤 1：删除动画资源与占位节点

- 从 `app/index.html` 删除 Three.js、GSAP、ScrollTrigger、`login-cosmos.js` 的脚本标签。
- 删除 `introWebglContainer` 和 `loginWebglContainer`。
- 删除 `app/login-cosmos.js`。
- 从 `package.json` 的 `check` 命令移除已删除文件。

验证：静态搜索确认页面入口和检查清单不再加载这些资源。

## 步骤 2：解除登录初始化耦合

- 从 `app/clerk-auth.js` 删除 `createLoginCosmos` 外部依赖说明、`loginScene`、`destroyLoginScene()` 和动画创建分支。
- 将 `initLoginExperience()` 的一次性绑定标记移到 `loginView`。
- 从 `app/app.js` 的各视图切换函数删除 `destroyLoginScene()` 调用。

验证：`node --check app/clerk-auth.js` 与 `node --check app/app.js` 通过；登录根节点只绑定一次。

## 步骤 3：删除死样式与测试遮罩

- 从 `app/style.css` 删除 `introWebglContainer` 与 `.login-webgl-container` 专属规则。
- 从 `app/css/inline-styles.css` 的组合选择器中只移除 `introWebglContainer` 这一条，保留 `.nebula` 的现有隐藏规则。
- 从 `tools/test-utils.js` 删除两个旧 Canvas 遮罩并更新登录测试说明。
- 更新 `tools/visual-diff.js` 中只描述旧 Canvas 和销毁函数的注释，不改测试行为或视觉基线。

验证：删除的 CSS 选择器对应 DOM 与 JavaScript 引用均为零；没有删除组合规则中的存活选择器。

## 步骤 4：全量验证

1. `git diff --check`。
2. 静态搜索 `app/`、`tools/` 和 `package.json`，确认不存在相关运行引用。
3. `npm run check`。
4. 启动独立本地端口，使用 Playwright 验证：三个库无网络请求、登录 DOM 无 Canvas、密码显隐可切换、访客入口可进入工作区。
5. 对桌面和移动登录页截图；与既有登录视觉基线或变更前画面比较。
6. 确认 `tools/visual-diff-coverage.json` 和所有带 ` 2` 后缀文件仍未进入差异或提交。

## 提交与回滚

- 运行代码、测试清理和验证记录作为一个独立实现提交。
- 推送功能分支并创建指向 `main` 的 PR，不自动合并。
- 出现认证或视觉回归时整体回滚实现提交；规划提交可保留。
