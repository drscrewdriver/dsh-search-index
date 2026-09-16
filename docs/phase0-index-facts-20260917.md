docs(plan): 登记 memory-evidence-reconcile 的 Phase 0 实测与本仓待办坐标

本仓本次**不改代码**，只登记两条来自只读实测的事实与因此产生的待办，
供 `search-index-memory-linkage`（本计划的硬前置）与本计划后续开工引用。

## 1. 索引库真实路径（此前在 .dsh 下找不到）

`resolveIndexDir()`（`src/host/rebuild.ts:351-354`）默认 `join(homedir(), '.dsh-switch-search')`。
本机实测路径：`C:\Users\joshua\.dsh-switch-search\index.sqlite`（384,684,032 字节）
另有一份归档快照 `index.archive-1789283837044.sqlite`（289,263,616 字节）。

## 2. 已归档会话在 docs 里 0 行 —— 日志回退是「必需」不是「兜底」

只读实测（`mode=ro`）：

| 项 | 值 |
|---|---|
| sessions | 391（archived=0 → 306，**archived=1 → 85**） |
| docs | 81,518，其中**属于已归档会话的 0 行** |
| docs 列 | doc_id, session_id, seq, type, surface, time, text, index_text（**尚无 turn/step**） |

⇒ 85/391 = **21.7%** 的会话在索引侧已无内容可取，正文只剩会话日志。
这直接决定下游计划的两条设计：`memory-evidence-reconcile` 的 task_8b（跳过而非判矛盾）
与 task_33（归档会话「原文仍可取回」必须单独断言）。

同时确认 archived 软删除实现完整：`sessions.archived` 列、`upsertArchivedHeader`
（`src/host/engine.ts:242-258`，零 docs）、`tests/index-archive.test.mjs`。

## 3. 待办坐标（属本计划 task_10/10b/11，未开工）

- `docs` 仍无 `turn`/`step` 列 → task_10 的 schema 变更尚未开始。
- `content-fetch` 端点尚未实现 → 计划二的 task_33 第 ① 条断言在它落地前只能先写红用例。

只读探针脚本留在 `E:\test\rewrite-agently\scripts\phase0-probe-*.py`（可复跑）。
