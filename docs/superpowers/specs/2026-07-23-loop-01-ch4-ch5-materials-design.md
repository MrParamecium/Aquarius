# 循环 1：第 4–5 章材料整合

## 状态

适用于分支 `codex/loop-01-ch4-ch5-materials` 的设计规范。

## 目标

把本地已经核验的第 4 章和第 5 章教材材料整合进 GitHub 重构版，使应用能够正确解析并读取这些章节、教材页面、OCR 和已核验公式记录。本循环只处理材料与引用完整性，不生成课程，也不改变教学行为。

## 权威来源

源项目是 `/Users/chenghaoxiang/Desktop/tutor agent`。

本循环以本地手工构建的 `app/section-page-map-new.json` 及其关联材料 metadata 为内容权威来源，以 GitHub 重构版的代码和目录结构为架构权威来源。现有远端映射需要与本地映射比较；内容一致时原样保留，不重新生成。

## 范围

### 包含

- `app/section-page-map-new.json` 中第 4–5 章条目引用的 226 个唯一页面 ID。
- `workspace/materials/new-book-pages/` 中对应的教材页面图片。
- `workspace/materials/new-book-ocr/` 中对应的逐页 OCR 文本和 metadata。
- `workspace/materials/new-book-section-ocr/` 中第 4–5 章共 83 组 section OCR `.txt` 与 `.meta.json` 文件。
- `workspace/materials/formula-catalog/` 中第 4–5 章共 32 个规范公式目录文件，其中第 4 章 15 个、第 5 章 17 个，不包含带重复后缀的文件。
- `tools/` 下的确定性材料 manifest 与验证器。
- 用于运行材料验证器的 package script。
- 如重构版需要，补充说明规范材料位置和验证命令的最少文档。

页面允许清单必须由映射生成，不能根据连续页码猜测。当前清单包含第 4 章 `page-330` 至 `page-467`、第 5 章 `page-488` 至 `page-574`，以及因为 `5.11` 共用而纳入的 `page-575`。未被映射引用的习题页不在本循环范围内。

### 不包含

- lesson cache 和课程生成。
- 交互 Demo、布局、UI 和其他产品行为。
- 2nd Edition 材料与路由。
- 根目录 `materials/` 镜像。
- 带 ` 2` 重复后缀的文件。
- 备份缓存、debug 输出、`__pycache__` 和无关生成物。
- 默认重新生成 OCR、公式目录或映射；只有验证失败并证明本地材料存在具体不一致时，才允许局部处理。

## 目标目录

所有运行时材料只加入 GitHub 重构版的规范 `workspace/materials/` 目录树：

```text
workspace/materials/
├── new-book-pages/
├── new-book-ocr/
├── new-book-section-ocr/
└── formula-catalog/
```

如果内容与本地权威映射一致，GitHub 重构版现有的 `app/section-page-map-new.json`、`app/section-page-map-display-new.json` 和 `app/section-page-anchor-new.json` 保持不变。

## 迁移流程

1. 读取本地权威 section map，生成唯一页面允许清单。
2. 建立源文件清单，记录教材图片、逐页 OCR、section OCR/meta、公式目录和 SHA-256 哈希。
3. 拒绝带重复后缀、位于 backup/debug 路径、JSON 无效或超出第 4–5 章允许清单的源文件。
4. 复制材料前，对比本地映射与 GitHub 重构版映射，并记录所有差异。
5. 只把通过验证的源文件复制到重构版 `workspace/materials/`，不覆盖无关的重构版文件。
6. 生成并提交 manifest，记录选中文件的路径、大小、SHA-256、section/page 数和公式数量。
7. 使用 manifest 对目标目录运行验证器。
8. 运行代表性应用检查，为本循环收集证据。

## 验证器契约

新增的 `tools/check-chapter-materials.js` 必须是确定性的，并采用失败即停止策略。它必须：

- 确认预期的 83 个 section ID 和 226 个唯一映射页面；
- 确认每个映射页面图片和逐页 OCR 文本都存在；
- 确认每个 section OCR 文本都有对应 metadata，反向也成立；
- 解析 section metadata，并确认页面范围与权威映射一致；
- 解析三个映射文件，确认 anchor 指向 section 映射内的页面，且 ratio 位于 `[0, 1]`；
- 解析所有第 4–5 章公式目录，要求满足预期 schema 且包含 `status: "verified"`，并确认每个 `sourcePage` 都在页面允许清单中；
- 拒绝带重复后缀、backup、debug 和 manifest 之外的意外文件；
- 对比目标文件哈希与已提交 manifest；
- 输出数量统计和精确相对路径级别的失败信息；
- 仅当全部检查通过时返回退出码 `0`，否则返回非零退出码且不修改任何文件。

验证器不得修复、重新生成或静默丢弃文件。任何失败都必须停止本循环并进入诊断。

## 验收门槛

### 门槛 0：干净基线

- 新分支基于 GitHub `main` commit `d10beb8`。
- 修改材料前，GitHub 重构版能够通过现有 `npm run check`。

### 门槛 1：清单完整性

- 83 个第 4–5 章 section 全部纳入清单。
- 226 个唯一映射页面全部纳入清单。
- 每张选中图片、每个逐页 OCR、每组 section OCR/meta 和每个公式目录都有源文件哈希。

### 门槛 2：引用完整性

- 所有映射引用都能解析到目标文件。
- section metadata 和 anchor 与映射一致。
- 公式 `sourcePage` 都能解析到目标页面。
- 不包含重复文件或范围外文件。

### 门槛 3：运行时解析

- 服务端健康检查保持正常。
- 代表性的第 4 章和第 5 章 section/page 请求能够返回存在的材料和 OCR。
- 浏览器 smoke check 能够进入代表性 section，且没有缺页错误或新增控制台错误。

### 门槛 4：回归与证据

- GitHub 重构版现有检查继续通过。
- 新材料验证器能在该分支的干净 checkout 中通过。
- PR 包含验证器输出、数量统计、哈希/manifest、代表性运行时证据和明确排除项。

## 回滚与 PR

- 本循环绝不修改旧桌面项目。
- 整合分支使用小而可审阅的提交：先提交设计和验证基础设施，再提交材料迁移；只有门槛失败时才增加针对性修复提交。
- 任一门槛失败时，停止并在分支内诊断；不得重新生成源材料或强行合并。
- 推送 `codex/loop-01-ch4-ch5-materials`，创建合并到 `main` 的 PR，只有全部门槛和审阅通过后才合并。

## 停止条件

当第 4–5 章材料已经存在、验证器与运行时检查通过且 PR 证据完整时，本循环结束。lesson cache 迁移以及所有教学/UI 改进都留给后续循环。
