<p align="center">
  <strong>给 DeepSeek Harness 侧边栏加一个自带索引的会话检索——标题/内容一键切换，还能按用户/回复/工具筛选</strong>
</p>
<p align="center">
  <strong>中文</strong> · <a href="README.en.md">English</a>
</p>
<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-263146?style=flat-square"></a>
  <img alt="Public" src="https://img.shields.io/badge/status-public-7da1de?style=flat-square"></a>
</p>

# dsh-search-index

> DSH web 侧边栏**搜索索引**：在侧边栏底部新增 **"搜索"** 入口，浮层面板一键在 **标题搜索 ↔ 内容搜索** 间切换；内容模式按**会话聚合**展示标题与命中片段，并按 **用户 / 回复 / 工具** 分类筛选。自带**独立索引**（不依赖 DSH 官方全文索引），支持增量同步、非破坏性整理与快照导入导出。

> **本包只管搜索与索引。** 会话历史的查看与清理（原"归档会话"面板）已迁至 **`dsh-session-steward`（会话管家）** 的「病案室」页签；本包仍会**读取**官方归档集合以把已归档会话排除出索引，但**不再写入**它——归档集合只有一个写方：会话管家。契约见 `dsh-归档文件格式契约-20260914.md`。

无需修改 dsh 源码、无需提 PR：`dsh plugin` 命令组装 + bundle patch 装配的 cordis 客户端 + 插件宿主半。

## 前身与本版

**前身：`dsh-session-search-toggle`。** 那个版本依赖 `@deepseek-ai/dsh-client-runtime` 的 `defineStore` 提供设置行座位。DSH 0.1.2 把客户端引擎包改名/重构（`dsh-client-runtime` → `dsh-client-store`），旧写法在新宿主上无法加载——同一个插件没法用一份产物同时兼容两版。

**本版（`dsh-search-index` 0.2.0-beta.3）以 DSH 0.1.2 为主线**，做法是让宿主版本差异彻底消失：

- **单一产物，运行时自适应**：同一份 `lib/client.js` 在 0.1.1-rc.2 与 0.1.2-rc.1 上都能加载，**没有任何版本号字符串分支**。客户端 bundle 只 `require` `react` / `react-dom`，两者都在两版的共享模块表内。
- **两个引擎包都不导入**：既不 import `dsh-client-runtime`，也不 import `dsh-client-store`，因此**不受那次改名影响**。
- **store 座位本地实现**：设置行需要的是一个 store 座位（`StoreHandle` / `StoreInstance`，契约由 `@deepseek-ai/dsh-client-ui-slots` 拥有、两版一致）。本插件用约 30 行本地实现替代 `defineStore`——只依赖 `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }`，不涉及任何版本专属 specifier。
- **其余契约两版一致**：`settings.general.item` 槽、`SettingsScope.{getSnapshot,subscribe,set,unset}`、`sessionQuery` 三个查询面在两版签名相同。

> **▼ DSH 版本适配**
> | DSH 版本 | 状态 | 关键差异 |
> | --- | --- | --- |
> | 0.1.1-rc.2 | ✅ | store 引擎在 `@deepseek-ai/dsh-client-runtime/client` |
> | 0.1.2-rc.1 | ✅ | 引擎改名 `@deepseek-ai/dsh-client-store`；本插件两个都不导入 |

**从旧名升级**：本包由 `dsh-session-search-toggle` 改名而来，客户端注册 id、cordis patch id 与仓库地址同步改名。GitHub 会为重命名的仓库保留跳转，旧名仍可解析，但请把 profile 依赖换成新名，避免两个名字长期并存：

```sh
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master
dsh plugin --profile web remove dsh-session-search-toggle
dsh web   # 重启
```

设置命名空间仍是 `switch-search`（**存储键保持稳定，不做迁移**），因此旧配置在新包下继续生效。

## 它能做什么

- **标题 ↔ 内容双模式**：一个入口两种搜法——切到"标题"按会话标题/工作目录子串即时过滤；切到"内容"走**本插件自建的独立索引**搜会话消息正文。
- **内容按会话聚合**：内容搜索结果每个会话一行（会话标题 + 最强命中片段 + 类型标签），点击即打开该会话，不刷屏逐条堆消息。
- **内容类型筛选**：内容模式顶部筛选 chip——**全部 / 用户 / 回复 / 工具**；`工具` 放开 `tool/call` 与 `tool/result` 事件进结果，直接搜到工具调用参数与返回值。
- **结果排序**：同一行右侧可切 **相关度 / 时间**——「时间」按**会话最后活动时间**倒序，最近动过的排前面；偏好记在本地，跨刷新保留。命中同时下发文档时间与会话时间，前端可自行二次排序。
- **标题实时**：宿主订阅 `session/event`，改名（`session/title`）即刻折进索引，不必等下一轮同步（默认 30s）。
- **设置卡片**：设置 → 插件新增 **"搜索索引"** 卡片——启用开关、默认搜索模式、独立索引的同步/保留份数/索引目录，以及索引生命周期块（状态、非破坏性整理、快照导出导入）。卡片报「已排除 N 个已归档会话」时会**就地指路**：归档会话的浏览与清理由 **「会话管家」**（`dsh-session-steward`）负责，本插件只读归档集合；未安装时那句提示会明说「当前未安装」——判定由宿主从**插件自身的模块图**解析得出，解析不出结果时走中性文案，**绝不把"读不到"报成"未安装"**。
- **唤出键与平台化按键提示**：侧边栏入口右侧与面板底部按键条都显示唤出键——macOS 渲染 `⌘K`、Windows/Linux 渲染 `Ctrl K`，按运行系统就地判定；面板内的关闭键同样平台化（macOS `esc` / 其他 `Esc`）。平台识别走 **UA-CH → `navigator.platform` → UA 串**三级降级，隐私模式下不会把 Mac 用户降级成 Windows 符号。**提示与绑定同源**：胶囊上写的和弦就是 `keydown` 实际匹配的和弦，不存在"提示一个键、响应另一个键"。
- **点击直达**：搜索结果点击跳转打开对应会话，定位到命中内容所在上下文。

## 界面预览

侧边栏搜索入口与设置面板布局示意：
<img width="287" height="835" alt="image" src="https://github.com/user-attachments/assets/fc714858-aaf9-4b5b-ad83-a3f1537f6116" />
<img width="844" height="813" alt="image" src="https://github.com/user-attachments/assets/d3ed5d20-9737-4b9b-a7bb-74162513f7c7" />

## 独立索引：三点机制

内容模式**自己建库**，不依赖 DSH 官方的 `session-query-sqlite` 全文索引。索引落在 `src/host/`：`schema.ts` 建表（含自建 FTS5 表 `docs_fts`），`engine.ts` 负责查询，`extract.ts` 从会话事件抽出可检索文本（含 `tool/call` 的工具名与参数、`tool/result` 的结果文本——这是"工具筛选"的数据基础）。DSH 的 `sessionQuery` 只被当作**语料读取器**（`listSessions` / `readSession`），不用来搜索。

### 一、独立的会话内容索引

索引是**本插件自己的 SQLite 文件**，与官方索引互不影响。可选持久化目录、可快照导出/导入、可整体重建。宿主激活时会巡检索引目录：`index.building.sqlite` 半成品在 active 存在时判为"上次重建未完成"直接丢弃；active 缺失时判为"崩溃发生在换名窗口"，把最新归档回滚为 active。

### 二、按归档清理失效会话，滚动更新

`archive-source.ts` 读取官方存储中枢 `~/.dsh/storages/workspace.json` 的 `global.archivedSessionIds`，把**已归档（即已不可用）的会话排除出索引**。归档集合只有一个写方——会话管家；本包只读不写。

同步是**滚动**的：`sync.ts` 的 `SwitchWatermarkSync` 维护每条会话的 `version` 水位，每轮只比对差异、只重灌有变化的会话，不做全量重建。索引文件本身按 `archiveKeep` 保留有限份数，旧的自动淘汰。

### 三、整理期间不影响历史索引工作

整理走**影子索引**：`rebuild.ts` 在 active 索引旁边从零构建 `index.building.sqlite`，构建期间 **active 索引持续对外服务**，搜索不会被阻塞。构建完成后切换是三次同步 `rename`（active → archive，shadow → active），是一个原子窗口。

这也决定了失败语义：**影子还在 + active 还在 = 构建没完成**，此时影子是废料，直接丢弃——active 从头到尾没有处在风险里。

## 安装

```sh
# 方式一：从 GitHub 直装（推荐）——仓库已提交 lib/，无需本地构建
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master

# 方式二：本地路径/源码组装（见"开发"章节）

# 重启 dsh web —— 必做！运行中实例不热载 bundle 层
dsh web
```

装完侧边栏底部出现 **"搜索"** 按钮；设置 → 插件出现 **"搜索索引"** 卡片。

> ⚠️ **GitHub 网络可达性**：github: 直装需要能连通 github.com；网络受限时请先配置可用代理或镜像加速，否则 add 会在拉取阶段卡住。

## 开发

```sh
pnpm install            # 含 @deepseek-ai client 包链 + tsdown/tsc
pnpm typecheck          # tsc --noEmit
pnpm build              # tsc(lib/types) + tsdown(lib/index.mjs + lib/client.js)
```

### 工作区结构

```
src/
├── index.ts            # 宿主半（node）：Config schema + installSettingsSection + 路由
├── config.ts           # 纯共享配置（enabled/defaultMode + 命名空间常量，client 免 schemastery）
├── host/               # 独立索引（宿主侧）
│   ├── schema.ts       # 建表：docs / docs_fts(FTS5) / sessions / 水位
│   ├── engine.ts       # 查询
│   ├── extract.ts      # 从会话事件抽可检索文本（含 tool/call、tool/result）
│   ├── sync.ts         # SwitchWatermarkSync：按 version 水位滚动增量同步
│   ├── rebuild.ts      # 影子索引构建 + 原子切换 + 崩溃恢复巡检
│   ├── archive-source.ts  # 读归档集合，把已归档会话排除出索引
│   └── snapshot.ts     # 快照导出/导入
└── client/
    └── index.ts        # 浏览器半：sidebar.footer.action 入口 + 浮层面板 + settings.general.item 配置行
```

- **宿主半**：注册 fenced HTTP 路由 `/switch-search/api`（`list-sessions` / `content-search` / `search-status`），浏览器信任围栏与 DSH `/api` 网关一致（loopback Host 或 trustedHosts，拒绝 cross-site）。
- **配置模式**：宿主经 `settings` 服务注册 `switch-search` 命名空间 + schemastery `Config`；client 半本地 store 座位 + `settingsScope.bind` 镜像读写；共享纯模块 `src/config.ts` 保持 client bundle 无 schemastery。
- **构建链**：tsdown 复制 harness `packages/client/tsdown.client.ts` 语义（`__ModuleLoader__.load` banner、平台模块 external 表、bundle purity gate）。
- **lib/ 提交进仓库**：GitHub 直装靠已提交的构建产物运行（dsh 从 git 安装不跑 prepare），`.gitignore` 不忽略 `lib/`。

## 与官方侧边栏搜索的关系

- 官方侧边栏的搜索框在 `sidebar.workspaces`（single slot），外部插件**无法替换**；本插件在侧边栏底部**新增独立入口** `sidebar.footer.action`，二者并存、互不干扰。
- 官方内容搜索在 apiproxy 硬编码只搜 `user/message` + `assistant/message`；本插件用自建索引，放开 `tool/call` + `tool/result`，实现工具级筛选。

## 兼容性与隐私

- 需要已安装 DeepSeek Harness 并使用 web profile；**不改任何官方源码**。索引是本插件自己的文件，官方 `session-query-sqlite` 开不开都不影响本插件。
- 配置仅存于 DSH settings 命名空间与浏览器浮层状态；不读取、不上传会话内容以外的数据。
- 宿主/客户端契约类型在 `src/*.ts` 本地结构声明（npm 上 dsh client 包链不完整），构建时以 harness 源码核实为准。

## drscrewdriver DSH Plugin Family

本项目是 [drscrewdriver](https://github.com/drscrewdriver) 维护的 DSH 插件系列之一。如果这个对你有用，其他插件多半也有用：

| 插件 | 一句话描述 |
|---|---|
| [dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | DSH Web GUI 忙时输入队列：三档交通管制，拖拽重排，会话冻结 |
| [dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | 逐轮 reasoning_effort 控制：Auto 智能调度或手动固定档位 |
| [dsh-seatbelt-sandbox](https://github.com/drscrewdriver/dsh-seatbelt-sandbox) | macOS Seatbelt 沙箱适配器：libsandbox 原生 loader，接替弃用的 sandbox-exec |
| [dsh-prime-memory](https://github.com/drscrewdriver/dsh-prime-memory) | 分层蒸馏记忆：L0~L3 自动蒸馏，模型每步前召回注入 |
| **[dsh-search-index](https://github.com/drscrewdriver/dsh-search-index)** | 侧边栏会话搜索增强：标题/内容切换，按用户/回复/工具筛选 |

## License

MIT
