# 删除无效登录动画运行时

## 目标

删除当前不可见但仍会下载和运行的登录动画链，降低首屏网络请求、GPU 消耗和登录流程的维护成本，同时保持用户可见界面与认证行为不变。

## 需求

- 移除页面对 Three.js、GSAP 和 ScrollTrigger 的加载。
- 删除只为隐藏粒子动画服务的运行时代码、DOM 容器和样式。
- 登录体验初始化不得再依赖隐藏的 WebGL 容器作为事件绑定锚点。
- 保留现有登录页静态视觉、Landing Page、Clerk 认证、邮箱密码登录、OAuth、访客模式和密码显隐功能。
- 不修改 GeoGebra、课程 Demo、教材材料、课程缓存、用户记忆或服务端接口。
- 不顺带重构登录页样式、Tailwind、字体或其他历史 CSS 覆盖层。

## 验收标准

- [ ] 页面不再请求 Three.js、GSAP 或 ScrollTrigger。
- [ ] 登录页不再创建隐藏 Canvas、粒子缓冲区或 `requestAnimationFrame` 循环。
- [ ] 登录页外观与删除前保持一致。
- [ ] GitHub、Google、邮箱密码、访客入口和密码显隐按钮保持可用。
- [ ] `app/`、`tools/` 和 `package.json` 中不存在 `THREE`、`gsap`、`ScrollTrigger`、`createLoginCosmos` 或 `login-cosmos` 的运行引用。
- [ ] `npm run check` 和相关登录回归检查通过。
- [ ] 未提交的 `tools/visual-diff-coverage.json` 和带 ` 2` 后缀文件不被覆盖或纳入提交。

## 备注

- 历史设计文档可以保留对已删除模块的事实记录；它们不属于运行引用。
- 正式技术规格见 `docs/superpowers/specs/2026-07-27-loop-04-remove-dead-login-runtime-design.md`。
