# 验收证据

## 基线

- GitHub 基线：`main` commit `d10beb8`，版本 `1.5.0`。
- 工作分支：`codex/loop-01-ch4-ch5-materials`。
- 迁移材料前运行 `npm run check`：通过。
- 源项目与重构版的 `section-page-map-new.json`、`section-page-map-display-new.json`、`section-page-anchor-new.json`：逐字节一致。

## 清单与复制

- section：83，Chapter 4 为 49，Chapter 5 为 34。
- 唯一页面：226。
- 页面图片：226。
- 逐页 OCR：226 份文本 + 226 份 metadata。
- section OCR：83 份文本 + 83 份 metadata。
- 公式目录：32。
- 材料文件合计：876，字节数 `66,722,753`。
- manifest SHA-256：`d3f0672e381b14f9effa4c063e2e34ebab452e2e94a32331f741f53799cce1eb`。
- 复制前对 876 个源文件执行大小与 SHA-256 预检；复制后逐文件复算目标哈希，全部一致。

## 公式目录诊断

- 目录状态：`27 verified / 5 draft_pdf_latex`。
- 公式状态：`76 verified / 9 draft_pdf_latex`。
- 4 条公式页码位于同章总允许清单，但超出同名 section 的窄映射；按已确认契约保留原值。
- 两条教材未编号定理使用 `label: ""`；源/目标一致，现有运行时会省略空标签。

## 验证器

- 迁移前负向测试：验证器返回非零，并输出缺失材料的精确相对路径。
- 意外文件负向测试：临时加入未映射 `page-468.txt` 时，只报该文件不在 manifest 白名单；临时文件随后删除。
- 正向测试：`npm run check:chapter-materials` 通过。
- 默认回归：`npm run check` 已实际执行材料验证器并通过。
- manifest 重新计算与格式化结果稳定，876 条记录与目标文件一致。

## 运行时

- 服务启动索引：`new=555`，相对迁移前补齐 226 页。
- `/health`：HTTP 200，`indexedPages.new=555`。
- 静态图片：`page-330`、`page-488`、`page-575` 均为 HTTP 200 和 `image/png`。
- cache-only `/api/section`：
  - `4.1` 返回 8 页，`page-330` 至 `page-337`，`generated=false`。
  - `5.11` 返回 2 页，`page-574` 与共享 `page-575`，`generated=false`；命中的是基线已有 lesson cache，本循环没有迁移 lesson cache。
- 浏览器：
  - `4.1` Textbook 视图加载 8 张图，全部完整解码为 `1800x2200`。
  - `5.11` Textbook 视图加载 2 张图，`page-574` 与 `page-575` 均完整解码为 `1800x2200`。
  - 没有材料图片 404 或解码失败。
  - 本地无缓存 overview 曾触发既有 LLM prelude 请求并因 `socket hang up` 报警；服务端日志确认该报警来自外部生成调用，不是材料解析。之后以 `TUTOR_REQUIRE_AUTH=1` 运行 cache-only 验收，未触发生成。

## 部署路径

- `Dockerfile` 使用 `COPY . .`。
- `.dockerignore` 只排除根 `/materials/`，并明确保留 `workspace/materials/`。
- 没有创建根 `materials/` 镜像。

## 排除项

- 未迁移或生成 lesson cache。
- 未修改课程生成、Demo、UI 或教学行为。
- 未迁移 2nd Edition、未映射习题页、重复后缀文件、backup/debug、`__pycache__`。
- 未修改旧桌面项目。

## 提交

- `8dd8284 feat: add chapter materials validation gate`
- `0809ddf feat: add chapter 4-5 source materials`
