# 讲解 Loop 05：卷积完整教学与渐进练习

## 目标

在已验收的 2.4-2 第四版基础上，把正式讲解扩充为 12 页教材驱动课程，重做三层同步 GeoGebra、渐进式教材例题和可自动检查的 Practice 曲线拼装。

## 用户已确认的要求

- 正式产品全部使用英文；沟通和设计规范使用中文；Loop 验收记录使用中英文。
- `Section Overview` 先显示准确学习目标、卷积公式和三个核心动作，只保留 `Start Lesson`。
- `Lesson` 恰好 12 页，顺序为 What → Why → $t/\tau$ → Five Steps → Guided Demo → Worked Examples。
- 第一轮严格使用 Figure 2.7、Examples 2.10–2.12 和 Drills 2.10–2.13，不加入自创函数。
- Guided Demo 每页一个动作；三层图始终显示 `Signals / Product / Output`。
- Examples 2.10–2.12 的提示逐题减少。
- Practice 通过支撑区间、分界点和区间曲线类型拼出输出，不使用自由手绘或多选题替代。
- 顶部三阶段导航始终置顶并可自由跳转；页面使用 180ms 淡入淡出。
- 正式课程保留现有主题；Visual Companion 夜间样式不进入产品。

## 范围约束

- 只修改 `2.4-2 Graphical Understanding of Convolution Operation` 及其专属测试和样式。
- 继续使用现有 lesson cache、lesson renderer、stage navigation 和 GeoGebra runtime。
- 不增加框架、构建步骤、运行时依赖或远端持久化服务。
- 不修改其他课程的分页、练习、动画或主题。
- 不推送、不创建 PR、不合并，除非用户后续明确要求。

## 验收标准

- [ ] Overview 的目标、公式、三个核心动作和唯一主按钮符合批准文案。
- [ ] 应用稳定解析为 `1 个 Overview + 12 个 Lesson + 1 个 Practice`。
- [ ] 三阶段导航置顶、可自由跳转，并恢复阶段内页码和任务状态。
- [ ] Guided Demo 五页每页一个动作，完成后启用 `Continue`，GeoGebra 降级时不锁死。
- [ ] 三层图在同一个 $t$ 状态下同步更新 Signals、Product 和 Output。
- [ ] 教材函数、首次接触点、分段边界、积分区间和输出结果全部通过数值契约。
- [ ] Examples 2.10–2.12 的提示等级按完整带做、半带做、接近独立完成递减。
- [ ] Practice 覆盖 Drills 2.10–2.13，并能定位错误的支撑区间、分界点或曲线段。
- [ ] 正式课程无中文产品文案，大号边框编号消失，正文尺寸符合设计规范。
- [ ] 桌面、390px 和 430px 视口无遮挡、意外横向滚动或不可点击控件。
- [ ] 页面动画为 180ms；减少动态效果模式立即切换。
- [ ] 自动化回归、真实页面验收和中英文 verification 全部完成。

## 设计来源

- `docs/superpowers/specs/2026-08-03-convolution-fifth-loop-design.md`
- `/Users/chenghaoxiang/Desktop/Linear Systems and Signals Third Edition.pdf`，纸质页 178–190

