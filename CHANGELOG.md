# Changelog

所有重要变更与 bug 修复记录于此。版本遵循语义化版本（`dsh plugin --profile web add dsh-session-search-toggle` 安装）。

## Unreleased

### 新增：归档批量清理（管理面板）

- 归档面板新增批量管理模式：全选/勾选归档会话 → **JS confirm 确认**（列出将移除的 id 摘要）→ `archive-prune` API 从规范存储 `~/.dsh/storages/workspace.json` 的 `global.archivedSessionIds` 数组中批量移除。
- 写入遵循官方 storage-json 协议：**先备份（workspace.json.bak-<ts>）再原子替换**（同目录临时文件 + rename），序列化格式与官方一致（2 空格 + 尾换行）；单次上限 5000 个 id。
- 移除后插件索引**立即解除软删标记**（version=-1，下一轮水位同步重灌仍存在的会话）；运行中的 DSH 内存态在**重启后**才加载新数组——面板与日志均明确提示。
- tests：prune 备份/原子写/无残留/未知 id 幂等，全套 17/17。

### 优化：重建可观测性 + 批事务加速 + 可选 better-sqlite3 驱动

- **进度把控修复**：整理进度原先只在完成后上报（面板一直 "0/?"），改为状态 Sink——index-status 即时反映 done/total/阶段。
- **开发日志**（`[switch-search]` 前缀，走 cordis logger）：驱动标识、重建每 50 会话速率行（sess/s / eta / chunk 耗时）、阶段转换、同步轮次汇总（scanned/updated/skipped-archived/failures/duration）——为前后速度对比提供数据。
- **批事务 checkpoint**：重建按 50 会话一个事务提交（fsync 摊销），chunk 失败逐个重放隔离；PRAGMA 调优（synchronous=NORMAL / temp_store=MEMORY / cache_size=64MB）。
- **双驱动**：`better-sqlite3` 以 optionalDependencies 引入（原生编译失败不阻断安装），运行时动态加载、缺失回退 node:sqlite；引擎与 index-status 均标注当前驱动（`driver` 字段），装与不装只影响速度不影响功能。
- **搜索入口文案**：底部按钮"标题"→"会话搜索"。
- tests：新增批事务嵌套安全 + 驱动标识测试，全套 16/16。

### 新增：归档软删除同步 + 归档查看面板 + DSH 风格对齐

- **归档软删除（schema v4）**：每轮水位同步读取官方 `workspaceRegistry.archivedSessionIds`（惰性解析，服务缺失自动降级），归档会话在索引中打 `archived` 标记——从搜索和会话列表排除、文档内容移除但 header（标题缓存）保留；**恢复归档自动重灌全文**（version=-1 触发下轮重读）。
- **整理不再复制归档内容**：重建/快照导出导入遇到归档会话只写 header 行，docs/fts 零复制。
- **归档查看面板**：只读居中浮窗列出官方归档集（标题/时间/cwd），点击打开会话；入口两处——搜索面板底部"归档会话"与设置卡片"查看归档"（新增 `list-archived` API，沿用 fence）。官方无 unarchive 端点，面板不提供恢复操作。
- **DSH 风格对齐**（对齐官方 `SettingsRoot` / `ConnectionIndicator` 源码度量与 token）：footer 按钮改官方 trigger 规格（42px/12px radius/hover token）；索引状态改官方药丸语言（`--dsw-alias-state-warn/success/error-*` 语义色、同步中点点动画 + `prefers-reduced-motion` 关停）；浮窗遮罩换 Modal mask token（`--dsw-alias-bg-mask-1` + blur）。
- tests：新增 `tests/index-archive.test.mjs`（5 项：软删/恢复重灌/header 行/重建跳过/快照规则），全套 15/15。

### 优化：检索管线重构（分词 / 存储 / 查询路径）

- **Intl.Segmenter 词级分词替代 trigram**：抽取文本按 ICU 词边界空格分隔后进 FTS5 unicode61，查询侧走同一分词。索引体积从 trigram 的全 3 字符窗口降到词级 token（预计 1/4 量级）；2 字短查询从"LIKE 全表扫"恢复为正常索引查询；部分输入用尾词 `*` 前缀命中（"正在搜"→ 正在搜索）；跨词碎片不再误中（精度提升）。
- **FTS5 external content**：FTS 虚表改为 `content='docs'` 外部内容模式（`index_text` 分词列 + 原文 `text` 列），倒排不再复制全文，存储再省约一半；增删通过 `docs_fts 'delete'` 命令维护一致性。
- **查询路径去重载**：MATCH 限 rank 的子查询 rowid 直接对齐 `docs.doc_id`，单条语句完成检索 + 类型/表面过滤，去掉每次按键 5000 参数的 `IN (...)` 二次查询。
- 索引 schema v3：旧索引打开时自动重置，水位同步会在下次轮询自动重灌，无需手动整理。
- tests：新增分词语义回归（短查询/前缀/精度），7/7。

### 重构：独立设置卡片（thinking-levels 模式）

- **`settings.plugin.item` 独立卡片**：新增插件自己的设置卡片（双 `id`+`key` 注册，兼容 CLI dsh 的 keyed 槽位与 DSH Desktop 的 list 槽位），替代原 `settings.general.item` 通用行及其本地 store 座位。卡片绑定 `switch-search` 设置命名空间，`useSyncExternalStore` 订阅、`scope.set` 即时提交（无暂存表单）。
- **统一子设置面板**：启用开关、默认搜索模式、自动同步开关、同步间隔、归档保留份数，以及内容搜索索引管理区（状态、整理索引按钮、快照导出/导入）全部收敛到同一张卡片。
- **locale 字典**：新增 `switch-search` zh/en 字典（`src/client/locales.ts`）；locale 服务在旧版 DSH 缺失时回退内置 zh 文案，settingsScope 缺失时卡片降级为只读 DEFAULT_CONFIG，不崩溃。
- **客户端拆分**：面板/卡片共用的宿主调用与类型收敛到 `src/client/host-api.ts`；`package.json` 的 `dsh.client.inject` 增加 `@deepseek-ai/dsh-client-locale` 与 `@deepseek-ai/dsh-client-ui-settings`。
- **测试**：`tests/client-store.test.mjs` 重写为证明新卡片座位（namespace 绑定、无 store 座位、无 settingsScope 时的降级），3/3。

### 新增：独立全文索引引擎（不再依赖 DSH 官方 FTS5 索引）

- **自有索引文件**：内容搜索改走插件自建索引（node:sqlite FTS5 + trigram 分词，独立 application id `0x53574954`），存放于 `~/.dsh-switch-search/`（可用配置 `indexDir` 或环境变量 `DSH_SWITCH_SEARCH_DIR` 覆盖）。官方 `session-query-sqlite` 默认 `openAt: never` 时内容搜索照常可用；官方索引文件永不打开、互不干扰。
- **水位增量同步**：后台按 `syncIntervalMs`（默认 30s）对比会话 `version` 水位，仅对新增/变更会话调用 `readSession` 增量入库；文本抽取语义与官方 `extractSessionEventText` 对齐（user/reply/tool/todo/turn-end），并复刻 surface 折叠（编辑替换后的旧消息标记 shadowed，不参与搜索）。
- **非破坏性整理（重建）**：面板/设置可触发"整理索引"——shadow 文件全量构建，期间旧索引持续可搜索；完成后三步原子换名切换，旧索引归档为 `index.archive-<ts>.sqlite`（保留 `archiveKeep` 份，默认 2）。
- **JSON 快照迁移接口**：`index-export` 导出 JSON Lines 快照（每会话一行，含抽取后的文档），`index-import` 导入快照并走同一整理路径原子换入——快照同步后即可作为索引使用，实现跨机器搬家/冷备。
- **HTTP API**：`/switch-search/api` 新增 `index-status` / `index-rebuild` / `index-export` / `index-import`；`list-sessions` 在 sessionQuery 不可用时回退读索引；全部沿用原 fence。
- **客户端**：内容面板在索引缺失时提供"建立索引"入口并在整理期间显示进度；设置行新增"内容搜索索引"管理区（状态徽标、整理按钮、快照导出/导入）。
- **配置**：`autoSync` / `syncIntervalMs` / `archiveKeep` / `indexDir` 全部可选带默认值，向后兼容。

### 验证

- `node tests/index-engine.test.mjs`：6/6（摄取与分组检索、类型过滤、FTS 语法净化、整理期间旧索引可查、损坏会话隔离、快照导出→导入 roundtrip、坏行跳过）。
- `npm test`（`tests/client-store.test.mjs`）：9/9。

### 新增：DSH 双版本兼容（0.1.1-rc.2 / 0.1.2-rc.1）

- **单一产物，运行时自适应**：同一份 `lib/client.js` 在两个版本都能加载，无版本号字符串分支。客户端 bundle 只 `require` `react` / `react-dom`，两者都在两版共享模块表内。
- **移除唯一的版本专属值导入**：设置行原先通过 `@deepseek-ai/dsh-client-runtime/client` 的 `defineStore` 建 store；该引擎包在 0.1.2 改名为 `@deepseek-ai/dsh-client-store`，任一值导入都会锁死单版本（0.1.2 下物化即抛 `require(...) missed the module table`，整个客户端半不加载）。
- **store 座位改为本地实现**：座位契约（`StoreHandle` / `StoreInstance`）由 `@deepseek-ai/dsh-client-ui-slots` 拥有、两版一致，渲染层只消费 `getSnapshot` / `subscribe` / `actions`。本地实现约 30 行，覆盖 `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }`，并保留 revision 围栏与订阅通知语义；行为由 `tests/client-store.test.mjs` 覆盖（9 项）。
- **快照类型本地镜像**：`SettingsScopeSnapshot<T>` 两版字段相同（status / value / base / user / revision / writable / mode），改为本地结构镜像，避免类型导入指向单一版本。
- **元数据**：`engines.dsh` 收窄为 `>=0.1.0-rc.7 <0.2.0-0`；`peerDependencies` / `devDependencies` 移除 `@deepseek-ai/dsh-client-runtime`；`dsh.client.inject` 改为实际填充的槽位所属包（`@deepseek-ai/dsh-client-ui-settings-general`）；`tsdown` 的客户端 externals 同步去掉 runtime。

### 验证

- `npm test`（`tests/client-store.test.mjs`）：9/9。
- `_smoke/smoke-batch-c.mjs`：主机半路由 + 设置命名空间；客户端半在两张真实模块表（0.1.1-rc.2 预载 `dsh-client-runtime/client` / 0.1.2-rc.1 含 `dsh-client-store`）下各物化一次，`require` 越表即失败，两次注册账本一致。
