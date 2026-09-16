# Changelog

所有重要变更与 bug 修复记录于此。版本遵循语义化版本（`dsh plugin --profile web add github:drscrewdriver/dsh-search-index` 安装）。

## 0.2.0-beta.5 —— 窄栏下让「键帽」让位，两个入口的名字都读得全

### 修复（beta.4 实测暴露）
- **现象**：beta.4 让本入口不再独占整行后，`sidebar.footer.action` 这一行要同时装下
  「🔍 搜索 Ctrl K」与「🧭 会话管家」。实测两串内容的自然宽度合计 **240px**，
  而窄栏（约 215–225px）装不下：本插件是 `flex:1`，管家的 wrapper 是 `flex:none`（从不让位），
  于**全部缺口都压在搜索胶囊上**，而标签是胶囊里唯一可收缩项——它被挤成了一个「搜」。
- **谁该让位**：键帽是**提示**（入口 tooltip 与面板底部条都重复写着同一个和弦），
  标签才是入口的**身份**。因此改为让键帽让位：`.dsws_root` 声明 `container-type:inline-size`，
  自身窄于 132px 时用 `@container` 收起 `.dsws_kbd`（省 43px）。
- **实测（Chrome，探针复刻两个入口的真实 CSS 与 DOM）**：栏宽 180–230px 时标签 28/28 完整、键帽自动隐藏、
  两个入口零溢出；≥240px 时键帽恢复显示。改前基线在 220px 处标签只剩 12/28。
- **轨道形态必须豁免**：`container-type` 同时带来 inline-size 尺寸包含，会让 `flex:none` 的轨道根盒
  **塌成 0 宽**（实测 root=0 而按钮仍 36px，溢出到盒外）。故 `.dsws_rootRail` 显式回落 `container-type:normal`。
- **轨道尺寸回到 28×28**：轨道内容盒只有 36px（56px 轨道 − 2×10px 内边距），官方规格的 36×36 控制盒
  是**单控件每行**的假设；两个入口同处一行时 36+28=64px 溢出 14px。取 28+28=56px，
  比改动前的 32+28=60px 还窄一点。
- 键帽内边距 `0 5px` → `0 4px`（自持的 2px）。

## 0.2.0-beta.4 —— 侧边栏入口与「会话管家」同行自适应

### 变更
- **让位，而不是独占**：`.dsws_root` 原本是 `flex:none;width:100%`，在 `sidebar.footer.action` 这个 flex 行里独占整行，
  把相邻的会话管家入口挤到行尾，且 42px 胶囊与对方的图标钮高低不一。改为 `flex:1 1 auto;min-width:0`，按钮 `flex:1;min-width:0`——
  与官方同一座位的控件（`ui-settings-general` 的 `.trigger{flex:1;min-width:0;height:42px;border-radius:12px;padding:0 10px 0 8px}`）同构。
  空间不足时先省略标签（`.dsws_buttonLabel` 本就有 ellipsis），不再挤压邻居。
- **收起轨道对齐官方 36×36**：`wide=false` 时按钮改用 `.dsws_buttonRail`（`36×36`、`border-radius:50%`），
  根元素加 `.dsws_rootRail` 保持 `flex:none`；对齐 Figma 轨道规范（56px 轨道 / 10px 内边距 / 36×36 控制盒）。
- **内容左对齐**：去掉 `justify-content:center`，与正下方官方「设置」行的图标同列。

### 未改动
- 交互、面板、索引、路由、设置命名空间 `switch-search` 一律未动；`enabled` 关掉时整条入口（含 `⌘K` / `Ctrl K`）照旧一起消失。
- 协同只发生在两插件各自的 CSS 上：本插件不引用会话管家的任何值，也不假设它是否安装。
- 新增选择器均被代码引用，`tests/client-styles.test.mjs` 的「零孤儿类」继续成立。

## 0.2.0-beta.1 —— 改名 dsh-search-index，会话历史迁出给会话管家

### 破坏性变更

- **包改名**：`dsh-session-search-toggle` → **`dsh-search-index`**（客户端注册 id、cordis patch id、仓库地址同步改名）。设置命名空间**保持 `switch-search` 不变**：它是存储键，改了会丢用户配置，因此刻意不让它跟着产品名走。旧名经 GitHub 重命名跳转仍可解析，但请把 profile 依赖换成新名，避免两名并存。
- **迁出会话历史域**（归档浏览 + 归档清理，含原侧边栏"归档会话"入口与设置卡里的"查看归档"）→ 新包 **`dsh-session-steward`（会话管家）** 的「病案室」页签。
- **本包不再写归档集合**：`pruneArchiveFile` 与 `list-archived` / `archive-prune` 两个方法一并移出。本包仍**读**官方归档集合（`readArchiveSet`）把已归档会话排除出索引——归档集合只有一个写方：会话管家。文件格式契约见 `dsh-归档文件格式契约-20260914.md`。
- **旧方法名保留显式墓碑**：`list-archived` / `archive-prune` 现在返回 **HTTP 410** 与指向 `/session-steward/api/session-history-list|prune` 的明确错误。浏览器刷新不会重载宿主半身，旧的客户端 bundle 必须**大声失败并被告知去哪**，而不是收到静默 404 被读成"归档坏了"。

### 移除

- `src/client/archive-panel.tsx`（迁至会话管家）、`src/host/archive-source.ts` 的写入函数 `pruneArchiveFile`、设置卡里的归档入口与 `IndexBlock` 的 `openSession` 注入面、相关文案键。
- 随实现一起迁走的还有那条 prune 用例：覆盖跟着**实现**走，已在会话管家侧以 `tests/history.spec.ts`（8 项）重建，避免出现"两个包都没测"的空档。

### 保留

- 独立索引全部能力：增量同步、非破坏性整理（shadow + 原子切换 + 有限归档 `archiveKeep`）、快照导出/导入、索引恢复巡检、状态读取失败的显性化。`archiveKeep` 指的是**索引文件**保留份数，与会话归档无关，因此留在本包。

## 0.2.0-beta.3 —— 归档计数会指路了、启用开关真的管用、13 个孤儿选择器清掉

### 修复：`归档会话` 是个没人管的数字 —— 现在它指路

- **现象**：设置卡里一个胶囊报「归档会话 72」，而这个插件**管不了**它们（归档浏览与清理已迁给会话管家）。用户看到数字、点不到任何东西，读起来像功能坏了。
- **改法**：胶囊文案由 `归档会话 {n}` 改为 **`已排除 {n} 个已归档会话`**（说明它是**索引的排除量**，不是待办），并在下方补一句所有权说明——归谁管、本插件负责什么。
- **只指对的路**：宿主新增 `src/host/peers.ts`，从**本插件自己的模块图**（即 profile 的 `node_modules`）解析 `dsh-session-steward`。三态 `installed` / `missing` / `unknown`：**只有确定解析不到**才显示「当前未安装」——叫用户去装一个他早就装了的插件，比不说话更糟；解析器抛出的其他错误（如清单损坏）一律归 `unknown`，走中性文案。
- `probePeer(name, base?)` 的解析基准可注入，因此「存在但读不了」这条分支在测试里可复现（用一份损坏的 `package.json` fixture，靠注入基准指过去）。

### 修复：`启用会话搜索` 是个死开关 —— 现在真的管用

- **现象**：`enabled` 有类型、有默认值、有开关、有文案（「在侧边栏底部显示"搜索"入口」），但**全仓没有第二个消费者**：入口无条件注册，开关什么也没控制。
- **改法**：设置命名空间的绑定**只解一次**（`entryScope`），入口与设置卡**共用同一个**绑定；入口用 `useSyncExternalStore` 订阅并读 `enabled`，关掉即整条入口（含 `⌘K` / `Ctrl K` 唤起键）一起消失——「这个插件开没开」始终只有一个答案。
- 读不到设置时（无 `settingsScope`、状态不可读）**保持入口可见**：读不到用户的选择，不等于用户要求关闭；何况隐藏入口会连「回到面板的唯一路径」一起藏掉。

### 清理：13 个孤儿选择器（其中 10 个来自已迁出的归档面板）

- 归档面板搬到会话管家时，选择器留在原地继续打包：`dsws_archRow` / `dsws_archCheck` / `dsws_uuid` / `dsws_dialogHead` / `dsws_dialogTitle` / `dsws_dangerBtn` / `dsws_editActive` / `dsws_linkBtn` / `dsws_indexLine` / `dsws_setRoot`。一份满是「已不存在面板」样式的表，读起来像「这个插件还管着那块」——正是拆分要终结的那种误解。
- 另清 3 个死类：`dsws_switch` / `dsws_switchTrack` / `dsws_switchThumb`——`Toggle` 早已改为纯内联样式，这套类选择器从未被引用。
- 样式表从 53 个类降到 50 个，**孤儿 0 个**。
- tests：新增 `tests/client-styles.test.mjs`——样式表只能有一个所有者；**每个**类都必须在代码里被引用，否则失败（这条正是那 13 个类能潜伏至今的原因）。同时钉住「设置绑定只有一个所有者」（`bind()` 恰好一次 + 至少两处消费），这是死开关的结构性防线。
- tests：新增 `tests/host-peers.test.mjs`（`node --import tsx`）覆盖三态分类。
- **已反证**：塞回一个孤儿类 → `client-styles` 立即 `exit 1`；把 `probePeer` 的兜底改成恒返回 `missing` → `host-peers` 立即 `exit 1`；均还原后全绿。

## 0.2.0-beta.2 —— 唤出键与平台化按键提示，结果排序 / 实时标题 / 检索链路一批修复

### 新增：唤出键 + 平台化按键提示（弹出框风格借鉴 `@hyzyn/dsh-search`）

- **一个和弦唤出面板**：侧边栏任意位置按 **`⌘K`（macOS）/ `Ctrl K`（Windows/Linux）** 即打开搜索面板，与点击入口等价。绑定挂在入口组件上而非插件级——入口被关掉时和弦也一并消失，"插件开没开"只有一个答案。
- **按键提示平台化**：侧边栏入口右侧与面板新增的底部按键条都渲染唤出键胶囊，关闭键同为 `esc`（macOS）/ `Esc`（其他）。此前本插件**零快捷键提示**，用户只能靠鼠标发现入口。
- **平台识别三级降级**：`UA-CH（navigator.userAgentData.platform）→ navigator.platform → UA 串`。原先若照搬参考插件的单条 `navigator.platform` 判定，该 API 在部分隐私配置下返回空串，会把 Mac 用户静默降级成 Windows 词汇；现在空串会继续往下问，全问不到时**降级为 `Ctrl`/`Esc`**——`Ctrl` 人人看得懂，`⌘` 不是。
- **提示与绑定同源**：胶囊上的和弦与 `keydown` 实际匹配的和弦由同一处（`src/client/platform.ts` 的 `isInvokeChord`）产出，并互相要求"另一个修饰键必须缺席"以区分两平台。因此不会出现"底部写着 `⌘K`、处理器只认 `Ctrl+K`"这类按了没反应的假提示。
- **键帽自适应**：`.dsws_kbd` 以 `min-width:18px; width:auto` 渲染，`Ctrl K`、`⌘K`、`Esc` 都完整显示不挤压；侧边栏入口的文字标签改为可收缩省略，避免键帽把标签挤出按钮外。
- tests：新增 `tests/client-platform.test.mjs`（`node --import tsx` 直测 `src/client/platform.ts` 的纯函数：三级降级含隐私模式空串、四套词表、和弦真值表、以及"每个平台公布的键必须被处理器接受"的跨半一致性；另对**产物**做结构性钉死——UA-CH 档只有一个所有者、`isInvokeChord` 至少两处引用（定义 + 监听器）、三枚键帽、两平台和弦面同源）。**已反证**：把监听器里的 `isInvokeChord(...)` 换成字面量判定后，产物断言立即失败。

### 优化：浮层阴影改走官方令牌

- 面板阴影原为硬编码 `0 8px 28px rgba(0,0,0,.16)`，现改为 `var(--dsw-shadow-lv3, 0 8px 28px rgba(0,0,0,.16))`——与官方 `Menu` / `Modal` / `Toast` / `HoverCard` 同一档浮层阴影，随主题变化；旧值留作 `var()` 回退，老宿主不退化。圆角 12px 与官方下拉卡片（`Menu` 的 `r12`）本就一致；遮罩沿用 `--dsw-alias-bg-mask-1` + `--dsw-mask-blur`，与官方 `Modal` 同源。

### 修复：内容搜索永久空白 —— 请求键有两个所有者

- **症状**：内容搜索能拿到正确结果，界面却永远停在加载态、什么都不显示。宿主侧经实测完全正常——`content-search` 对中文（`插件`、`适配`）与 ASCII（`dsh`）都返回命中，索引与分词无障碍。
- **根因**：请求键被**手写了两份**。发起请求的 effect 拼三段键 `query\0type\0sortBy`，渲染侧判定"这条结果属不属于当前输入"时又拼了两段键 `query\0type`。加排序那一版只改了写入方，两键从此永不相等，`activeContent` 每一轮都掉进空的 `loading` 分支：结果送达、解析成功、然后被丢掉。
- **修法**：键收敛为**单一所有者**——一个 `contentRequestKey(normalized, contentType, sortBy)` 供两侧共用。没有选择"把漏掉的那段补到第二份上"：补完仍是两个所有者，下次加输入维度照旧漂移。
- **防回归**：新增 `tests/client-panel-key.test.mjs`。React 渲染路径不在本套覆盖内（`client-store.test.mjs` 开头已声明不覆盖 GUI），因此改为钉住结构不变量——产物中含 NUL 分隔符的模板字面量必须**恰好一个**，且共享助手至少被引用 3 次（定义 + 两个调用点）。该断言已用"把第二份键写回产物"实测会失败，再还原。

### 新增：结果排序（相关度 / 时间）+ 标题变更实时落库

- **排序切换**：内容搜索结果上方新增「相关度 / 时间」切换，与类型筛选同一行、靠右。默认「相关度」保持既有行为；切到「时间」按**会话最后活动时间**倒序，同一时间再按匹配强度。
- **两个时间字段各司其职**：命中同时下发 `time`（最佳匹配**文档**的时间戳）与 `updatedAt`（**会话**级时钟）。排序用后者——命中文档的时间说明不了这个会话最近动没动。两个字段都给，前端可据此自行二次排序。
- **排序在截断之前**：宿主先排序再按 `limit` 截断。若先截断再排，"时间"模式只会把已经按相关度截出的前 N 条重排一遍，等于没排。
- **选择持久化**：排序偏好存 `localStorage`（键 `dsh-search-index.sortBy`），跨刷新保留；隐私模式下读写失败静默降级为相关度。
- **老宿主半身兼容**：宿主不认识 `sortBy` 时降级为相关度而非报错；客户端只在每条命中都带数值 `updatedAt` 时才本地重排，避免对旧数据算出 NaN。
- **内容行补上时间**：内容结果的标题行此前只显示类型标签，时间只在标题搜索结果里显示。按「时间」排序却看不到任何时间，等于无法验证排序生效。现在类型标签右侧并列显示**会话最后活动时间**（`updatedAt`）——与排序所用字段一致，也与标题行看到的那个时间一致。
- **标题实时**：改名会追加一条 log-only 的 `session/title` 事件（不动模型面）。此前它要等下一轮水位同步（默认 30s）才反映到索引；现在宿主订阅 `session/event`，命中即按 id 定向折叠标题（`SwitchWatermarkSync.refreshTitles`），不等整轮扫描。事件按 250ms 合并突发；`autoSync: false` 时不介入；**水位不动**——标题刷新永远不会让索引声称读过它没读的内容，下一轮同步仍按 bump 过的 version 重新摄取该会话。
- tests：`sortBy=time` 排序刻意使用"旧但高相关 / 新但低相关"的反向样本（否则断言可能只是碰巧），并覆盖排序先于截断、未知排序降级；`refreshTitles` 覆盖即时折叠、不重读日志、不动水位、未知 id 幂等、下一轮同步收敛。全套 24/24。

### 修复：重建异常终止的半成品巡检与恢复

- 宿主激活时（引擎打开前）自动巡检索引目录：`index.building.sqlite` 半成品 —— active 存在则判定为"上次重建未完成"直接丢弃（含 -wal/-shm，active 从未处于风险中）；active 缺失则判定为"崩溃发生在换名窗口"，把**最新归档回滚为 active** 再丢弃半成品；无 active 无归档则全新开始。全程 `[switch-search] index recovery` 日志。
- 状态读取失败已显性化（错误药丸 + 重试按钮），不再无限"正在读取索引状态…"。
- tests：恢复路径（半成品丢弃 / 换名窗口回滚）2 项，全套 18/18。

### 交互：归档清理收敛到编辑模式

- 归档面板默认只读；头部新增「编辑」按钮进入编辑态——复选框、全选、红色「删除选中 (N)」仅在编辑态出现，「完成」退出并清空选择。
- 删除按钮仍走完整确认流程（JS confirm：id 摘要 + 备份/重启/不可撤销警示）→ `archive-prune` → 索引即时解除软删 → 刷新列表并停留在编辑态可继续清理。

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
