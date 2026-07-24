# 技术设计

## 设计边界

现有 `app/ws-bridge.js` 已将 `workspace/materials/` 作为首选材料根目录，并已经读取 `new-book-ocr/`、`new-book-pages/` 与 `formula-catalog/`。因此本循环不新增运行时抽象，只补齐它已经支持的数据，并用仓库内验证器证明引用闭合。

## 数据选择

验证器从重构版 `app/section-page-map-new.json` 读取以 `4.` 或 `5.` 开头的 83 个 section，再去重得到 226 个页面 ID。页面 ID 是页面图片和逐页 OCR 的唯一允许清单；section ID 是 section OCR 的唯一允许清单。公式目录只允许规范文件名中属于第 4 或第 5 章且无重复后缀的 32 个文件。

源项目与重构版的 `section-page-map-new.json`、`section-page-map-display-new.json`、`section-page-anchor-new.json` 已逐字节核对一致。manifest 保存它们的哈希，验证器运行时重新计算，从而防止材料与映射在后续提交中无声漂移。

## Manifest 契约

`tools/chapter-4-5-materials.manifest.json` 使用稳定排序和固定 schema：

- `schemaVersion`：当前为 `1`；
- `chapters`：固定为 `[4, 5]`；
- `counts`：总 section、分章 section、page、公式目录和材料文件总数；
- `sections`、`pages`、`formulaCatalogs`：按自然顺序排列的允许清单；
- `mapHashes`：三个映射文件的 SHA-256；
- `files`：按相对路径排序，每项含 `path`、`size`、`sha256`。

manifest 不记录本机绝对源路径和时间戳，因此相同输入会产生逐字节相同的结果。它只包含 876 个迁移材料，不把自己或验证器算入材料数量。

## 验证器职责

`tools/check-chapter-materials.js` 只使用 Node 内置模块并执行以下阶段：

1. 解析 manifest 和三个映射 JSON，验证 schema、排序、数量与 map 哈希。
2. 从主映射重新派生 section/page 允许清单，并与 manifest 精确比较。
3. 验证主映射、display map 与 anchor 的章节引用关系和 ratio。
4. 验证 876 个 manifest 文件存在、是普通文件、大小与 SHA-256 一致。
5. 验证页面图、逐页 OCR、section OCR/meta 的一一配对和 metadata 内容。
6. 验证 32 个公式目录的 JSON、目录与公式状态统计和 `sourcePage` 引用。允许的原始状态只有 `verified` 与 `draft_pdf_latex`，并固定核对目录 `27/5`、公式 `76/9`；现有运行时继续只注入公式级 `verified` 条目。
7. 扫描第 4–5 章命名范围，拒绝 manifest 外文件、重复后缀及 backup/debug 路径。

所有错误先收集为路径级消息，再统一返回失败；成功时输出固定数量摘要。验证器不写文件。

## 数据流

```text
已确认主映射 -> section/page 白名单 -> 选择性复制源材料
       |                                  |
       +---- 映射哈希 --------------------+
                                          v
                              稳定路径/大小/SHA-256 manifest
                                          |
                                          v
                            目标材料 + 映射 + 引用完整性验证
```

## 兼容性与风险控制

- 保留既有文件名、JSON 内容和运行时路径，避免引入转换误差。
- 复制按白名单逐文件进行，不同步整个源目录，不覆盖范围外文件。
- 页面范围存在数字空洞是正常现象；只有映射成员才合法。
- `page-575` 虽超出主要第 5 章页段，但由 `5.11` 映射引用，属于合法白名单。
- 4 条公式的 `sourcePage` 位于同章允许清单、但不在同名 section 的窄映射中；验证器按已批准契约检查 226 页总允许清单，不改写手工目录页码。
- 两条没有教材公式编号的定理使用空字符串 `label`；验证器要求该字段存在且为字符串，但不伪造编号，现有运行时也会省略空标签。
- 草稿公式目录原样迁移并保留状态；把它们升级为 `verified` 必须在后续循环逐条对照教材核验，不能由本次材料迁移隐式完成。
- 大批二进制文件用 manifest 哈希审阅，避免仅凭 Git 文件数判断完整性。

## 验证与证据

先保存基线 `npm run check` 结果；迁移后运行新验证器、现有检查、服务端 curl 与浏览器 smoke。证据写入任务实现记录和 PR，不提交临时日志、截图缓存或本地绝对路径。失败时保留当前分支状态用于诊断，修复必须针对明确失败文件。
