# dsh-search-index（会话检索）

DSH 插件：**会话标题 / 内容全文检索**，自带独立 FTS5 索引；内容检索的语料与语义
来自 `dsh-reference-session-collector`（DRS）投影库，经 **HTTP 或进程内只读** 两条通道取数。

- **标题模式** —— 直接命中会话标题，输入即出结果；
- **内容模式** —— 按会话聚合展示标题 + 命中片段，支持类型（用户/回复/工具）、
  检索域（全部/活跃/归档）、日期区间、排序（相关度/时间）与「命中展开」；
- **命中定位** —— 点结果打开会话并巡逻定位到目标行（诊断徽标 ⏳/✓/✗）；
- **索引生命周期** —— 增量同步（水位轮询）、非破坏性整理（影子库构建 + 原子切换 +
  有界归档）、深度同步（DRS 慢扫自愈 + 整理）、JSON Lines 快照导出/导入。

> **DRS 是硬依赖，但通道可选**：内容检索的语义（会话分组、类型加权、表面与归档日期过滤、
> 锚定节选）全部在 `dsh-reference-session-collector` 的投影库里完成。它作为本包的
> 正式依赖随包安装，**包本身不需要用户单独下载**；但注意「包装上 ≠ 插件激活」：
> 宿主激活 bundles 只扫 profile 顶层 `dependencies`，作为传递依赖它可能不被挂载，
> 此时投影库不会更新——设置卡会提示激活命令：
> `dsh plugin --profile <name> add dsh-reference-session-collector` 后重启宿主。
> 两条检索通道任一生效即可用：
> `http`（同源路由）与 `in-process`（只读直连 `projection.db`）。
>
> **DSH NEXT 桌面版必读**：桌面宿主在 web 层对非渲染进程请求一律 `403 Browser access is disabled`，
> 所以 HTTP 通道在桌面版永远不可用——`contentTransport` 缺省 `auto` 会自动改走进程内只读臂，
> 用户无需任何操作。仅当两臂都不可用时，`search-status` 才返回 `available:false` 并给出具体档位码
> （`browser-access-denied` / `drs-http-unreachable` / `drs-http-error` / `drs-not-activated` /
> `drs-missing` / `drs-empty` / `drs-schema-mismatch`）；其中 `drs-not-activated`（路由 404）
> 会在 `search-status.notActivated=true` 中单独标记，即使进程内接穗可用也会提示执行上述激活命令。
>
> 进程内臂只读：不建目录、不跑 DDL、不写 `meta`；库 schema 与本包预期不符时只报错，**绝不清库**。

## 索引自愈：整理 vs 深度同步

面板页脚与设置卡各有两枚按钮，修的不是同一层：

| 按钮 | 做什么 | 修什么 |
|---|---|---|
| **整理索引**（`index-rebuild`） | 读宿主 `sessionQuery` 全量重建本地 FTS 索引：影子库构建 → 原子切换 → 有界归档 | 本地索引脏 / 缺会话 / 标题陈旧 |
| **深度同步（drsc）**（`index-deep-sync`） | ① `POST {op:'sync'}` 让 DRS 慢速重扫投影库，轮询 `last_sync.busy=false`（上限 180s）；② 再自动跑一遍整理 | **命中定位不到**（DRS 投影库滞后，`seq`/`on_surface` 与界面文本对不上） |

命中定位不走本地索引：拿命中行 `seq` 回查 DRS `op=session`，取该行 `search_text` /
`surface_text` 当 needle 到 GUI 里做文本匹配。所以「有些命中点进去不跳」只有深度同步对症，
整理索引重建多少次都不动 DRS 投影库。进度经 `index-status.deepSync`
（`idle → drs-syncing → rebuilding → done | failed`）暴露，两个按钮都在进行中拒绝并发；
整理正在跑时点深度同步会直接失败，等它跑完或只点深度同步。DRSC 侧触发契约为
`POST ?op=sync`（op 必须在 query，body 不作为判据），落定与否记在 `drsSettled`。

## 入口双形态（宿主代际）

| 宿主 | 形态 | 注册内容 / 交互 |
|---|---|---|
| **≥ 0.1.7** | 「插件页式」**主栏整页** | `sidebar.panellist` 面板行（id `dsh-search-index`, order 5，落在「插件」0 之后、「会话管理」6 之前）+ `main` 整页（key 同名）；点行或 `Ctrl/⌘+K` → `layout.selectPanel('dsh-search-index')`；页内「关闭」回到会话 |
| **< 0.1.7** | **侧栏弹窗**（原样） | `sidebar.footer.action` 入口（order 5）+ `SwitchPanel` dialog（遮罩 / Esc / `Ctrl/⌘+K`）；不注册 panellist/main |

**代际信号**：`sidebar.workspaces.session.menu.item` 席位 + `main` 席位（0.1.5 线无前者、
0.1.7 线起有）。两形态互斥：席位就绪后一次性决定，席位后到时就地撤掉另一形态；
`enabled=false` 时整对注销。

<!-- hosts-sync:begin -->
<!-- 单源：package.json engines.dsh（与 hosts.mjs 同源的 18 项枚举） -->
支持 DSH 0.1.0-rc.2、0.1.0-rc.3、0.1.0-rc.6、0.1.0-rc.7、0.1.0-rc.8、0.1.1-rc.1、0.1.1-rc.2、0.1.2-rc.1、0.1.5-rc.1、0.1.5-rc.2、0.1.5-rc.3、0.1.7-rc.1、0.1.7-rc.2、0.2.0-rc.1、0.2.0-rc.2、0.2.1-rc.1、0.2.1-rc.2、0.2.1-rc.3（枚举 peer；其中 9 个 rc 有农场 cell 实测，矩阵见下节）。
<!-- hosts-sync:end -->

## 兼容矩阵（0.7.7 实测）

农场 cell（`_host-farm/cells/<rc>`）逐个装入 0.7.7 后起 `dsh web`，探测宿主半身与设置面：

| 宿主 rc | `/switch-search/api/index-status` | `settings-describe` | 入口形态 |
|---|---|---|---|
| 0.1.0-rc.8 | 200 · available:true | 200 · `writable:true`（legacy 桥） | 底栏弹窗 |
| 0.1.1-rc.2 | 200 · available:true | 200 · `writable:true` | 底栏弹窗 |
| 0.1.2-rc.1 | 200 · available:true | 200 · `writable:true` | 底栏弹窗 |
| 0.1.5-rc.3 | 200 · available:true | 200 · `writable:true` | 底栏弹窗（UI 实测） |
| 0.1.7-rc.2 | 200 · available:true | 200 · `writable:false`（只读投影） | 主栏整页 |
| 0.2.0-rc.2 | 200 · available:true | 200 · `writable:false` | 主栏整页 |
| 0.2.1-rc.1 | 200 · available:true | 200 · `writable:false` | 主栏整页 |
| 0.2.1-rc.2 | 200 · available:true | 200 · `writable:false` | 主栏整页 |
| 0.2.1-rc.3 | 200 · available:true | 200 · `writable:false` | 主栏整页（UI 实测，桌面宿主） |

UI 侧（真浏览器）两端各验一格：0.1.5-rc.3 = 底栏「搜索 Ctrl K」+ 弹窗（Esc / Ctrl+K）；
0.2.1-rc.3 = `sidebar.panellist` 行 + 主栏整页（无遮罩）。
**仍在枚举、暂无农场 cell 的 9 个 rc**（0.1.0-rc.2/rc.3/rc.6/rc.7、0.1.1-rc.1、0.1.5-rc.1/rc.2、
0.1.7-rc.1、0.2.0-rc.1）是声明面放行，未逐格实测；若要收窄，删掉对应枚举即可。

## 安装

```bash
dsh plugin --profile web add dsh-search-index
# 或本地 tgz
dsh plugin --profile web add "file:E:/test/rewrite-agently/mine-dsh-plugins/dsh-search-index/dsh-search-index-0.7.7.tgz"
```

安装后**必须重启宿主进程**。DRS 未装时本插件的内容检索不可用（标题面可用）。

> **不能与合并包 `dsh-session-steward`（≤0.5.x，内含 search）同装**：两者都注册
> `/switch-search/api` 前缀，0.1.5 线宿主会直接启动失败（`webserver: duplicate prefix route`）。
> 升级路径：`dsh plugin remove dsh-session-steward` → 装 `dsh-manage-session` + 本插件。
> 0.1.5 线实测：底栏「搜索 Ctrl K」入口 → 弹窗（Esc 关闭），`settings-describe` 走 legacy 桥
> `writable:true`；无 DRS 时 `search-status` 返回 `available:false, reason:'drs-unavailable'`。

## 路由契约

前缀 `/switch-search/api`，方法名：

| 方法 | 作用 |
|---|---|
| `list-sessions` | 标题语料（会话 id + 标题 + cwd/updatedAt；索引优先、sessionQuery 兜底） |
| `content-search` | 内容检索（DRS 分组检索直连；`archived`/`types`/`sortBy`/`expand`/`from`/`to`） |
| `search-status` | 可用性由 DRS 探针裁决（`available`/`reason`），附索引水位与整理进度 |
| `index-status` / `index-rebuild` | 索引生命周期面（设置卡行；`index-status` 附 `deepSync` 状态面） |
| `index-deep-sync` | 深度同步：DRS 慢扫自愈 → 本地索引整理（后台执行，进度走 `index-status`） |
| `index-export` / `index-import` | 快照导出（JSON Lines 原始体）/ 导入（原始体） |
| `settings-describe` / `settings-mutate` | 设置面：0.1.7+ 只读投影；≤0.1.5 走 legacy settings 桥（可写） |

## 设置

命名空间：`switch-search`（存储键稳定承诺）。

> 0.7.0 起从合并包的 `manage-sessions-search` 回归本命名空间：旧键不再读取，升级后
> `enabled` 等开关回到缺省（搜索默认开启），需要重新按需调整一次。

| 开关/字段 | 缺省 | 说明 |
|---|---|---|
| `enabled` | true | 关闭后不注册任何方法，入口整体消失 |
| `defaultMode` | `title` | 面板打开时默认标题还是内容模式 |
| `autoSync` / `syncIntervalMs` | true / 30000 | 后台水位轮询增量同步 |
| `archiveKeep` | 2 | 整理索引后保留的历史索引份数 |
| `indexDir` | `''` | 索引目录覆盖（缺省 `~/.dsh-switch-search`，环境变量 `DSH_SWITCH_SEARCH_DIR`） |
| `corpusSource` | `drs` | 同步语料源；`drs`=DRS 投影库；`native`=sessionQuery 兜底（仅标题面可用） |
| `drsBaseUrl` | `''` | DRS 基址；空=首个 `trustedHosts` 条目，再退 `http://127.0.0.1:8080` |
| `contentTransport` | `auto` | 内容检索通道：`auto`=HTTP 优先、失败降级进程内只读库；`http`=只走 HTTP；`in-process`=只走进程内只读库（桌面版） |

## 与 dsh-manage-session 的职责边界

- **归档集合只读**：本插件只读官方归档集合（存储文件优先、registry 兜底），把归档标记
  折进索引语料；**写方只有** `dsh-manage-session`（归档 / 取消归档 / 清理）。
- **行内删除**：搜索结果行的「删除」按钮可见性由跨插件探针决定 ——
  `POST /manage-session/api/session-health-status` 的 `switches.directDelete === true`；
  未装或探针失败即隐藏（破坏性入口 fail-soft）。删除动作走
  `POST /manage-session/api/session-history-purge`（不复制 purge 实现，单一 owner）。
- 未装 manage-session 时，搜索结果打开会话仍正常（导航不依赖它）。

## 存储

| 路径 | 内容 |
|---|---|
| `~/.dsh-switch-search/` | 独立索引库（FTS5）、历史归档份数、墓碑台账 |
| `~/.dsh/storages/workspace.json` | **只读**：归档集合与工作区成员表 |

## 开发

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm run build       # tsc -p tsconfig.build.json && tsdown
pnpm test            # 11 个客户端/宿主契约脚本 + DRS/归档契约（node:test，TS 走 tsx）
```

## 许可

MIT
