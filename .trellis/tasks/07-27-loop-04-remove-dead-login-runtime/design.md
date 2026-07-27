# 技术设计

## 现状

登录页已经通过 `.login-webgl-container` 的高优先级规则隐藏 WebGL 容器，但 `clerk-auth.js` 在打开登录页时仍调用 `createLoginCosmos()`。该函数创建 15000 个 Three.js 粒子、注册鼠标和窗口监听器，并持续运行 `requestAnimationFrame`。因此用户看不到动画，浏览器仍承担下载、初始化和 GPU 渲染成本。

`index.html` 还在所有页面加载 GSAP 与 ScrollTrigger，但运行代码中没有调用它们。介绍页中的 `introWebglContainer` 同样没有运行消费者，并被样式隐藏。

## 方案比较

1. **彻底删除，采用。** 删除外部脚本、动画模块、隐藏容器、关联状态和专属样式。收益完整，且不改变可见界面。
2. **改为懒加载，不采用。** 只能减少非登录页面的下载，但动画仍不可见，继续保留生命周期和 GPU 成本。
3. **只停止动画，不采用。** 可以减少 GPU 消耗，但死代码、网络依赖和维护边界仍存在。

## 变更边界

### `app/index.html`

- 删除 Three.js、GSAP、ScrollTrigger 和 `login-cosmos.js` 的脚本标签。
- 删除 `loginWebglContainer` 与 `introWebglContainer` 两个无效占位节点。
- 不调整 Landing Page、静态登录装饰或认证表单 DOM。

### `app/clerk-auth.js`

- 删除 `loginScene` 状态、创建逻辑和销毁逻辑。
- `initLoginExperience()` 改用真实存在的登录根节点作为一次性绑定标记。
- 保留 OAuth、密码显隐和转交 Clerk 的事件逻辑；不得因为删除旧锚点而提前返回。

### 样式与清单

- 从 `app/style.css` 和 `app/css/inline-styles.css` 删除只指向两个 WebGL 容器的规则，不改其他登录样式。
- 删除 `app/login-cosmos.js`。
- 从 `package.json` 的语法检查清单删除已删除文件。
- 清理测试工具中只用于隐藏旧 WebGL 容器的选择器；不修改无关视觉基线。

## 数据流与错误处理

认证数据流不变：按钮事件仍进入 Clerk 或访客模式，Bearer Token、会话恢复和服务端认证均不受影响。删除后登录初始化只负责绑定真实控件，不再有 WebGL 初始化失败、GPU 资源释放或动画监听器清理分支。

## 验证

1. 静态搜索确认运行代码和测试中不存在已删除依赖的引用。
2. 运行 `npm run check`，确认语法检查和现有静态门禁通过。
3. 运行登录相关回归，覆盖 GitHub、Google、邮箱表单、访客入口和密码显隐控件的事件绑定。
4. 在本地页面检查 Network 与 DOM：没有三个动画库请求，没有登录 Canvas。
5. 对登录页做桌面和移动端截图检查，确认静态视觉没有变化。

## 回滚

本 Loop 是独立删除提交。若发现登录初始化回归，可整体回滚该提交；不需要迁移数据，也不会影响教材、缓存或用户存储。

## 明确不做

- 不删除或改版 Landing Page。
- 不清理 Tailwind、Google Fonts 或其他视觉依赖。
- 不重写登录页 CSS。
- 不修改 GeoGebra 或其他互动 Demo。
- 不处理 Feedback Board、RAGFlow、意图分类或偏好系统。
