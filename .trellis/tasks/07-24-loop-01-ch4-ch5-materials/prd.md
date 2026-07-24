# 循环 1：整合第 4–5 章材料

## 目标

以 GitHub 重构版为代码基线，把旧桌面项目中已经手工核验的第 4–5 章教材材料迁入规范的 `workspace/materials/` 目录，使现有服务端能够按既有映射读取页面、OCR 和公式目录。本循环只建立材料完整性，不生成课程，也不改变教学或界面行为。

## 权威来源

- 代码与目录结构：GitHub `main` 基线 `d10beb8`，当前分支 `codex/loop-01-ch4-ch5-materials`。
- 材料内容：只读源目录 `/Users/chenghaoxiang/Desktop/tutor agent`。
- 章节范围：源项目 `app/section-page-map-new.json` 中以 `4.` 或 `5.` 开头的 section。
- 已核对三个映射文件在源项目与重构版中逐字节一致，因此本循环不得修改或重建这些映射。

## 需求

1. 只迁移映射实际引用的 83 个 section 与 226 个唯一页面；不得根据连续页码扩大范围。
2. 迁移 226 张教材图片、226 份逐页 OCR 文本及其 226 份 metadata、83 份 section OCR 文本及其 83 份 metadata、32 个第 4–5 章公式目录，共 876 个材料文件。
3. 只写入 `workspace/materials/new-book-pages/`、`new-book-ocr/`、`new-book-section-ocr/` 和 `formula-catalog/`。
4. 排除 lesson cache、UI、课程生成、2nd Edition、根 `materials/` 镜像、带 ` 2` 重复后缀的文件、backup、debug、`__pycache__` 和未映射习题页。
5. 新增确定性 manifest，记录选中文件的相对路径、字节数、SHA-256、section/page/公式数量及三份映射文件的哈希；manifest 不包含生成时间等不稳定字段。
6. 公式状态必须按源文件原样保留：32 个目录中 27 个为 `verified`、5 个为 `draft_pdf_latex`；85 条公式中 76 条为 `verified`、9 条为 `draft_pdf_latex`。现有运行时只注入已核验公式，本循环不得把草稿改写成已核验。
7. 新增只读验证器和 package script。验证失败时必须输出精确路径、返回非零退出码，并停止循环；不得自动修复、重新生成或删除材料。
8. 保持现有运行时读取路径和映射格式，不引入依赖、构建步骤或新框架。
9. 旧桌面项目始终只读；任何生成物、修复和提交只能发生在当前整合分支。

## 验收标准

- [ ] 修改材料前，重构版基线 `npm run check` 通过。
- [ ] 83 个第 4–5 章 section 和 226 个唯一映射页面被完整、唯一地纳入清单。
- [ ] 876 个材料文件全部存在于目标目录，大小和 SHA-256 与 manifest 一致。
- [ ] 每个映射页面都有 `.png`、`.txt`、`.meta.json`；每个 section OCR 文本与 metadata 双向配对。
- [ ] section metadata 的 section ID 与 page 范围和主映射一致。
- [ ] display map 与主映射一致；每个 anchor 页面属于对应 section，ratio 位于 `[0, 1]`。
- [ ] 32 个公式目录 JSON 可解析、满足既有 schema，状态数量严格为目录 `27 verified / 5 draft`、公式 `76 verified / 9 draft`，且所有 `sourcePage` 都位于 226 页允许清单。
- [ ] 第 4–5 章范围内不存在重复后缀、backup/debug 或 manifest 外意外文件。
- [ ] `npm run check:chapter-materials` 和现有 `npm run check` 全部通过。
- [ ] 服务端 `/health`、代表性第 4 章和第 5 章页面/OCR请求通过，浏览器 smoke check 无缺页和新增控制台错误。
- [ ] PR 记录基线、数量、哈希验证、运行时证据和明确排除项，目标分支为 `main`。

## 停止与回滚条件

- 任一数量、映射、schema、哈希或运行时检查失败，立即停止后续迁移并诊断具体文件。
- 不通过重新生成全部 OCR、公式目录或映射来掩盖失败。
- 回滚仅删除本分支新增的白名单材料、manifest、验证器和 package script；不触碰源项目和重构版既有材料。
