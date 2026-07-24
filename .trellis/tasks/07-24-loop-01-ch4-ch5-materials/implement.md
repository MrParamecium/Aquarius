# 实施计划

## 阶段 0：固定基线

- [x] 确认当前分支为 `codex/loop-01-ch4-ch5-materials`，基线为 `d10beb8`。
- [x] 运行 `npm run check` 并保存通过结果。
- [x] 逐字节比较源项目与重构版的三个映射文件。
- [x] 从主映射派生 83 个 section、226 个页面，并确认 876 个源材料文件缺失数为 0。
- [x] 诊断公式状态：目录为 `27 verified / 5 draft`，公式为 `76 verified / 9 draft`；确认 4 条跨同名 section 窄映射引用仍位于总页面允许清单。
- [x] 诊断两条空公式标签：教材公式本身无编号，源/目标一致且运行时支持空标签，因此保留原值并只验证字段类型。

失败停止点：任一映射不同、数量异常或现有检查失败时，不编写验证器、不复制材料。

## 阶段 1：验证基础设施

- [x] 新建 `tools/check-chapter-materials.js`，实现 manifest、映射、metadata、公式状态统计和意外文件检查。
- [x] 在 `package.json` 增加 `check:chapter-materials`，并将验证器纳入语法检查。
- [x] 先对尚未迁移的目标运行验证器，确认它以明确缺失路径失败，证明门槛不是空检查。

验证命令：

```bash
node --check tools/check-chapter-materials.js
npm run check:chapter-materials
```

失败停止点：验证器语法失败、错误信息不精确或未能识别缺失材料时，不迁移材料。

## 阶段 2：白名单迁移与 manifest

- [x] 从已确认映射生成稳定 section/page 允许清单。
- [x] 逐文件复制 226 张页面图、452 个逐页 OCR 文件、166 个 section OCR 文件和 32 个公式目录。
- [x] 复制时拒绝重复后缀、backup/debug、无效 JSON 和清单外路径。
- [x] 生成 `tools/chapter-4-5-materials.manifest.json`，按路径排序并记录大小、SHA-256、映射哈希和数量。
- [x] 再生成一次 manifest 并逐字节比较，证明生成结果确定。

验证命令：

```bash
npm run check:chapter-materials
git diff --check
```

失败停止点：源或目标哈希不一致、数量不是 876、出现范围外文件时，保留失败路径并停止。

## 阶段 3：回归与运行时验证

- [x] 运行 `npm run check:chapter-materials`。
- [x] 运行 `npm run check`。
- [x] 启动本地服务，检查 `/health`。
- [x] 请求代表性第 4 章和第 5 章页面图片、逐页 OCR、section OCR 或现有对应 API。
- [x] 在浏览器进入代表性第 4 章与第 5 章 section，检查缺页、网络 404 和新增材料相关控制台错误。
- [x] 检查 Docker 构建上下文仍会包含 `workspace/materials/`，且没有新增根 `materials/` 镜像。

失败停止点：任何现有回归、404、解析错误或浏览器错误出现时，不进入提交与 PR。

## 阶段 4：提交与 PR

- [x] 提交验证基础设施与规划记录。
- [x] 单独提交白名单材料和 manifest。
- [x] 更新 Trellis 任务记录，写入最终数量、命令结果和已知排除项。
- [ ] 再跑完整验收并确认工作区只含本循环预期变更。
- [ ] 推送 `codex/loop-01-ch4-ch5-materials`。
- [ ] 创建目标为 `main` 的 PR，附基线、哈希、引用、运行时和浏览器证据。

## 回滚点

- 验证器提交后、材料提交前可独立回滚基础设施。
- 材料迁移提交可整体回滚，不影响已存在的 Chapter 1–3 材料。
- PR 合并前不改 `main`；任一门槛失败都留在当前分支修复。
