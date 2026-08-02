# 技术设计

## 1. 保留现有解析边界

课程缓存目前被解析为 8 个应用页面：

```text
overview + 6 knowledge + quiz
```

第四版不新增第二套分页器，也不改变缓存版本键。渲染器只为 2.4-2 建立阶段映射：

| 现有页面类型 | 第四版阶段 | 阶段内位置 |
| --- | --- | --- |
| `overview` | `intro` | 1 / 1 |
| 6 个 `knowledge` | `lesson` | 1 / 6 至 6 / 6 |
| `quiz` | `practice` | 1 / 1 |

这样可以保留已有的页面解析、GeoGebra 销毁与重新挂载、Quick Check 入口和课程完成逻辑。

## 2. 课程专属阶段模型

在 `app/lesson-render.js` 中增加只对 2.4-2 生效的阶段辅助函数：

- 根据 `block.type` 和当前索引计算阶段、阶段内位置与总数。
- 生成三阶段导航，并在页面重新渲染后绑定阶段按钮。
- 记录本次会话最近一次 `knowledge` 索引；从简介或练习返回正式讲解时恢复该索引。
- 离开课程时随现有 `resetLearnKnowledgePointState()` 一并清理阶段状态。
- 向现有 pager 暴露只读阶段状态，避免 `ui-friction-fixes.js` 重复推导。

阶段按钮仍通过当前 `renderCurrentKnowledgePoint()` 提交页面，所有内容替换继续经过 `replaceLearnContent()`，因此不会绕过 GeoGebra teardown。

## 3. 章节简介与练习页

课程缓存用稳定标记提供 2.4-2 专属简介内容。`buildLessonOverviewHtml()` 只在发现该标记时直接保留它；其他课程继续使用原有 Objective/Concepts 解析。

简介只含：

- 你已经知道
- 这一节解决什么
- 学习路线

练习阶段沿用现有 Quick Check，不新增题库系统。页面先显示三项准备任务，再保留 `Start Quick Check` 入口。

## 4. 正式讲解内容

六个知识页固定为：

1. What：卷积是什么。
2. Why：为什么需要图解卷积。
3. How：翻转与平移。
4. How：相乘、面积与五步总结。
5. Demo：教材 Figure 2.7 GeoGebra。
6. Context：卷积在本章和后续采样、滤波中的作用。

墨水池、洒水车图片和现有三张代码原生图解按教学含义重新安放，不新增装饰性图片。唯一 GeoGebra block、场景名、滑块范围与降级图保持不变。

## 5. 视觉与动画

- 概念内容使用 `.convolution-editorial-block`：页边编号、细分隔线、无厚重外框。
- 步骤内容使用 `.convolution-process-timeline`：连续轨道和有序节点。
- 旧 `.convolution-island` 可以保留兼容样式，但 2.4-2 新内容不再输出大号编号岛。
- 三阶段导航采用分段控件；当前阶段、键盘焦点和禁用态清晰可见。
- 2.4-2 激活时在课程容器添加专属状态类，用专属 CSS 覆盖纸张翻页伪元素。
- `runLearnPageTurn()` 对 2.4-2 使用约 70ms 的内容提交点和 180ms 总锁定时间；其他课程保持现状。
- `prefers-reduced-motion` 继续直接提交状态。

## 6. Pager 兼容

底部上一页、下一页仍按现有 8 个索引顺序移动，因此简介末尾自然进入讲解，讲解末尾自然进入练习。显示文字改为阶段语义：

- 简介：`章节简介`
- 讲解：`讲解 n / 6`
- 练习：`练习巩固`

到达练习页才沿用现有完成标记和下一小节逻辑。

## 7. 降级与错误处理

- 阶段映射异常时退回现有 `n / 8` 分页，不显示空白页。
- 专属简介标记缺失时使用现有 overview 解析结果。
- GeoGebra 加载失败时保留静态说明和步骤内容，不阻断阶段导航。
- 阶段按钮在动画进行中不重复提交页面。

## 8. 回滚边界

生产改动限定在课程缓存、`lesson-render.js`、`ui-friction-fixes.js`、课程专属 CSS 和定向测试。恢复这些文件即可回到第三版；图片、GeoGebra 源文件、静态路由和其他课程无需联动回滚。
