# Loop 04：删除无效登录动画运行时

## 背景

项目准备进入“做减法”阶段。第一步选择一个能够用代码事实证明、且不会改变用户体验的目标：登录 WebGL 动画及未使用的动画依赖。

当前登录页通过 CSS 强制隐藏 `.login-webgl-container`，但打开登录页仍会创建 15000 个 Three.js 粒子并持续执行动画循环。GSAP 与 ScrollTrigger 也由 `index.html` 全站加载，却没有任何运行调用。介绍页还保留一个没有消费者的隐藏 WebGL 占位节点。

## 决策

采用彻底删除方案，而不是懒加载或仅停止动画。删除范围包括：

- Three.js、GSAP、ScrollTrigger 的页面脚本；
- `app/login-cosmos.js`；
- 两个隐藏 WebGL DOM 节点及专属样式；
- `clerk-auth.js` 中的动画创建、状态与销毁逻辑；
- `package.json` 和测试工具中的对应引用。

## 登录初始化

旧代码把 `loginWebglContainer` 同时当作动画宿主和“登录控件是否已经绑定”的标记。删除容器时不能直接保留原来的提前返回，否则 OAuth、密码显隐等控件将失去事件。

新的初始化以真实登录根节点为锚点，只负责一次性绑定登录控件：

```text
打开登录页
   |
   v
找到真实登录根节点
   |
   +-- 尚未绑定 --> 绑定 OAuth、Clerk 转交、密码显隐
   |
   +-- 已绑定 ----> 不重复注册
```

初始化不再检查 `window.THREE`，不创建 Canvas，不维护 `loginScene`，退出登录页时也不需要释放 GPU 资源。

## 兼容边界

以下行为必须保持不变：

- 登录页及 Landing Page 的可见布局和静态装饰；
- GitHub、Google、邮箱密码和访客入口；
- 密码显示与隐藏；
- Clerk 回调、登录返回目标、会话恢复和 Bearer Token；
- 桌面端与移动端登录布局。

本 Loop 不处理 Tailwind、字体、营销页、GeoGebra、Feedback Board、RAGFlow、意图分类和偏好系统。

## 验收

- Network 中不再出现 Three.js、GSAP 或 ScrollTrigger 请求。
- 登录 DOM 中不存在 WebGL Canvas。
- 运行代码和测试中不存在相关可执行引用。
- 认证控件的事件绑定保持有效。
- `npm run check` 与登录回归通过。
- 登录页桌面和移动端视觉无变化。

历史设计文档可以继续记录被删除模块的演变，不视为运行引用。
