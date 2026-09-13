# Changelog

所有重要变更与 bug 修复记录于此。版本遵循语义化版本（`dsh plugin --profile web add dsh-session-search-toggle` 安装）。

## Unreleased

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
