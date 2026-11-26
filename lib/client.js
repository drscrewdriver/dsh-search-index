window.__ModuleLoader__.load({
	id: "dsh-search-index",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/client/locales.ts
		/** `switch-search` client dictionaries (zh / en / ja / ko / fr / de / it / ru / es / pt), thinking-levels pattern. */
		/** Dictionary namespace owned by this plugin (the host settings namespace). */
		const NS = "switch-search";
		/** All shipped dictionaries by locale id. */
		const dictionaries = {
			zh: {
				"card.deepSync.btn": "深度同步（drsc）",
				"card.deepSync.hint": "先让 drsc 慢速重扫修好投影库，再把本地索引整理一遍。",
				"card.deepSync.drs": "drsc 同步中…",
				"card.deepSync.rebuilding": "索引整理中…",
				"panel.deepSync": "深度同步",
				"panel.deepSync.hint": "先让 drsc 慢速重扫修好投影库，再把本地索引整理一遍（用于定位不到 / 新会话搜不到）。",
				"panel.deepSync.drs": "drsc 同步中…",
				"panel.deepSync.rebuild": "索引整理中…",
				"panel.deepSync.done": "同步完成",
				"panel.deepSync.failed": "同步失败",
				"panel.deepSync.failedReason": "深度同步失败：{error}",
				"panel.deepSync.retry": "重试同步",
				"panel.doctor": "诊断报告",
				"panel.doctor.hint": "把异常台账与探针现状编排成一份可粘贴的报告（含可执行命令），复制到剪贴板；复制成功后会清空台账。",
				"panel.doctor.copied": "诊断报告已复制：直接贴进 issue 即可。",
				"panel.doctor.failed": "生成诊断报告失败：{error}",
				"panel.doctor.copyFailed": "报告已生成但复制失败（{error}），已打印到浏览器控制台。",
				"card.corpusSource": "语料源",
				"card.corpusSource.desc": "内容检索的语料来自 DRS 投影库；native 仅保留标题/头部元数据面。",
				"card.mode.drs": "DRS 投影库",
				"card.mode.native": "本地会话服务",
				"card.drsBaseUrl": "DRS 基址",
				"card.drsBaseUrl.desc": "空=自动（首个 trustedHosts 条目，再退 http://127.0.0.1:8080）。",
				"card.drsStatus.up": "内容检索可用。",
				"card.drsStatus.down": "内容检索不可用：{reason}",
				"card.drsStatus.reading": "正在探测 DRS…",
				"card.drsStatus.mode": "当前通道：{mode}",
				"card.contentTransport": "DRS 连接方式",
				"card.contentTransport.desc": "auto=先走 HTTP，失败自动切进程内只读库（推荐）；http=只走 HTTP；in-process=只走进程内只读库（桌面版）。",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "进程内",
				"card.drsReason.browser-access-denied": "宿主禁止非渲染进程访问本地接口",
				"card.drsReason.drs-http-unreachable": "DRS 路由不可达（端口未监听或被拒）",
				"card.drsReason.drs-http-error": "DRS 返回错误",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector 未作为插件激活（路由 404）：执行 dsh plugin --profile <name> add dsh-reference-session-collector 后重启宿主",
				"card.drsReason.drs-missing": "依赖未随包安装：请重装本插件（依赖会自动带上）",
				"card.drsReason.drs-empty": "投影库尚未建立：重启宿主等首轮同步",
				"card.drsReason.drs-schema-mismatch": "投影库版本与插件预期不一致：请升级 dsh-reference-session-collector",
				"card.drsStatus.inactive": "依赖插件未激活：执行 dsh plugin --profile <name> add dsh-reference-session-collector 后重启宿主（当前走进程内只读库，投影数据不会自动更新）",
				"panel.contentErr.browser-access-denied": "宿主禁止浏览器访问本地接口，且进程内只读库也不可用：请重启宿主后重试（{error}）",
				"panel.contentErr.drs-http-unreachable": "DRS 路由不可达：请确认 dsh-reference-session-collector 已启用（{error}）",
				"panel.contentErr.drs-http-error": "DRS 返回错误：{error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector 未作为插件激活（路由 404）：执行 dsh plugin --profile <name> add dsh-reference-session-collector 后重启宿主（{error}）",
				"panel.contentErr.drs-missing": "依赖未随包安装：请重装本插件（会自动带上 dsh-reference-session-collector）（{error}）",
				"panel.contentErr.drs-empty": "投影库尚未建立：重启宿主等待首轮同步完成（{error}）",
				"panel.contentErr.drs-schema-mismatch": "投影库版本不匹配：请升级 dsh-reference-session-collector（本插件不会清库）（{error}）",
				"card.title": "搜索索引",
				"card.description": "侧边栏会话搜索增强：标题搜索与内容搜索一键切换。内容搜索使用插件自建索引，不依赖 DSH 官方全文索引。",
				"card.unavailable": "设置命名空间不可用：请确认插件已装配进 profile。",
				"card.readonly": "只读",
				"card.enabled": "启用会话搜索",
				"card.enabled.desc": "在侧边栏底部显示\"搜索\"入口。",
				"card.defaultMode": "默认搜索模式",
				"card.defaultMode.desc": "面板打开时默认进入标题搜索还是内容搜索。",
				"card.rememberQuery": "保留搜索历史",
				"card.rememberQuery.desc": "再次打开搜索时恢复上次的关键词、筛选与滚动位置（12 小时内有效）。关闭时不保存任何检索内容。",
				"card.mode.title": "标题",
				"card.mode.content": "内容",
				"card.autoSync": "自动同步索引",
				"card.autoSync.desc": "后台按水位增量同步会话日志到独立索引。",
				"card.syncInterval": "同步间隔（秒）",
				"card.syncInterval.desc": "两次增量同步之间的最小间隔。",
				"card.archiveKeep": "归档保留份数",
				"card.archiveKeep.desc": "每次整理索引后保留的历史索引文件数量。",
				"card.index": "内容搜索索引",
				"card.index.desc": "索引正常：已收录 {indexed} 个会话。",
				"card.index.archives": "，归档 {archives} 份。",
				"card.index.empty": "独立索引尚未建立。点击\"整理索引\"从会话日志全量建立。",
				"card.index.reading": "正在读取索引状态…",
				"card.index.rebuilding": "正在整理索引… {done}/{total}（整理期间旧索引仍可搜索）",
				"card.index.syncing": "正在同步索引…",
				"card.index.failures": "{count} 个会话同步失败（详见 Host 日志）。",
				"card.index.rebuildError": "整理失败：{error}",
				"card.index.rebuild": "整理索引",
				"card.index.rebuilding.btn": "整理中…",
				"card.index.rebuild.hint": "非破坏性：构建期间旧索引继续可搜索，完成后原子切换并归档旧索引。",
				"card.index.archivedOwner": "归档会话的浏览与清理由「会话管家」（dsh-session-steward）负责。本插件只读归档集合，把已归档会话排除出索引。",
				"card.index.archivedMissing": "归档会话的浏览与清理需要「会话管家」（dsh-session-steward），当前未安装。本插件只读归档集合，把已归档会话排除出索引。",
				"card.index.export": "导出快照",
				"card.index.import": "导入快照",
				"card.index.exported": "快照已导出为下载文件。",
				"card.index.import.started": "快照导入已开始：正在后台重建索引，完成后自动切换。",
				"card.index.importParse": "快照解析失败或无有效会话。",
				"card.action.failed": "操作失败：{error}",
				"panel.titleSearch": "标题",
				"panel.contentSearch": "内容",
				"panel.searchTitle": "搜索会话标题…",
				"panel.searchContent": "搜索会话内容…",
				"panel.entry": "搜索",
				"panel.history.clear": "清除",
				"panel.history.clear.hint": "清除已保存的搜索现场，回到空白检索。",
				"panel.buildIndex": "建立索引",
				"panel.archived": "已排除 {count} 个已归档会话",
				"panel.rebuilding": "正在整理索引… {done}/{total}（整理期间旧索引仍可搜索）",
				"panel.unavailable": "独立索引服务不可用：Host 未完成初始化。",
				"panel.notBuilt": "独立索引尚未建立：先建立索引即可启用内容搜索（不依赖 DSH 官方全文索引）。",
				"panel.loadingSessions": "正在读取会话列表…",
				"panel.sessionsError": "读取会话列表失败：{error}",
				"panel.noSessions": "暂无会话",
				"panel.noMatch": "没有匹配的会话。",
				"panel.loadingContent": "正在搜索会话内容…",
				"panel.contentError": "内容搜索失败：{error}",
				"panel.noContent": "没有匹配的内容。",
				"panel.contentHint": "输入内容关键词开始搜索。",
				"panel.noText": "(无文本)",
				"panel.delete": "删除",
				"panel.delete.confirm": "确认删除",
				"panel.delete.hint": "删除该会话（不可逆，与管理端同款链路）",
				"panel.delete.done": "已删除会话 {n} 个",
				"panel.delete.failed": "删除失败：{error}",
				"panel.untitled": "(未命名)",
				"panel.openSession": "打开会话",
				"panel.footer.invoke": "唤出",
				"panel.footer.close": "关闭",
				"filter.all": "全部",
				"filter.user": "用户",
				"filter.reply": "回复",
				"filter.tool": "工具",
				"sort.label": "结果排序",
				"sort.relevance": "相关度",
				"sort.time": "时间",
				"sort.relevance.hint": "按匹配强度排序（默认）。",
				"sort.time.hint": "按会话最后活动时间倒序，更新的排前面；同一时间再按匹配强度。",
				"group.merge": "合并",
				"group.expand": "分开",
				"group.merge.hint": "每个会话只显示最强的一条命中（默认）。",
				"group.expand.hint": "同一会话的多条命中分行显示（每行仍是可跳转的独立命中）。",
				"type.user/message": "用户",
				"type.assistant/message": "回复",
				"type.tool/call": "工具调用",
				"type.tool/result": "工具结果",
				"panel.manage": "管理",
				"domain.all": "全部",
				"domain.active": "活跃",
				"domain.archived": "归档",
				"tag.archived": "归档",
				"manage.hint": "按工作区分组，勾选后批量操作；删除不可撤销。",
				"manage.restartHint": "优先走宿主内存 API 即时生效（0.1.7+ 归档/取消归档免重启）；不可用时直写存储文件，重启后侧栏生效。",
				"manage.done.restart": "需重启 DSH 后在侧栏完全生效。",
				"manage.group.nocwd": "（未分组）",
				"manage.selectGroup": "全选/取消本组",
				"manage.selected": "已选 {n}",
				"manage.batch.archive": "归档",
				"manage.batch.unarchive": "取消归档",
				"manage.batch.delete": "删除",
				"manage.batch.confirm": "确认删除",
				"manage.batch.working": "执行中…",
				"manage.done.archive": "已归档 {n} 个会话。",
				"manage.done.unarchive": "已取消归档 {n} 个会话。",
				"manage.done.purge": "已清理 {n} 个会话。",
				"manage.done.error": "操作失败：{error}",
				"panel.index.none": "索引未建立",
				"panel.index.count": "索引 {n}",
				"panel.index.rebuilding": "整理中 {done}/{total}",
				"panel.index.rebuild": "整理",
				"filter.favorites": "收藏",
				"date.from": "开始日期",
				"date.to": "结束日期",
				"star.on": "取消收藏",
				"star.off": "收藏",
				"workspace.label": "工作区",
				"workspace.more": "还有 {n} 个",
				"workspace.less": "收起",
				"manage.search": "搜索会话…",
				"group.collapse": "收拢/展开本组",
				"group.expandAll": "全部展开",
				"group.collapseAll": "全部收拢",
				"cold.badge.hint": "冷数据：目标超出消息轨索引范围（>40 回合），点击需回溯加载",
				"toocold.badge.hint": "过冷数据：目标超出安全回溯范围（>200 回合），不自动翻页",
				"cold.confirm.body": "目标在最新回合前约 {gap} 回合，超出消息轨索引范围，需回溯翻页加载（预计约 {pages} 页）。确认后将尽力加载并跳转。",
				"cold.confirm.ok": "确认加载并跳转",
				"cold.confirm.cancel": "取消",
				"toocold.hint": "已打开会话，但目标超出安全回溯范围（>200 回合），请手动向上翻页查找。",
				"hud.progress": "正在回溯加载更早历史… {pulled}/{budget}",
				"hud.done": "历史已加载完成",
				"hud.jump": "跳转",
				"hud.fail": "回溯未命中目标",
				"hud.retry": "再试一次（追加翻页预算）",
				"hud.close": "关闭",
				"panel.sessionsError.bare": "读取会话列表失败",
				"panel.searchFailed": "搜索失败",
				"panel.unknownError": "未知错误",
				"panel.indexUnreachable": "索引状态不可达：Host 半可能是旧进程。请完全重启 dsh web（浏览器刷新不重载 Host）后重试。",
				"panel.locate.pending": "定位巡逻中",
				"panel.locate.ok": "已跳转到命中行",
				"panel.locate.miss": "未能定位（行未渲染/文本被拆分/超时）",
				"card.indexStatus.requestFailed": "index-status 请求失败",
				"card.indexStatus.readFailed": "状态读取失败",
				"card.indexStatus.readFailedHint": "索引状态读取失败：{error}。请完全重启 dsh web（浏览器刷新不会重载 Host 半）后重试。",
				"card.indexStatus.retry": "重试状态",
				"err.requestFailed": "请求失败",
				"err.timeout": "请求超时",
				"err.settingsUnwritable": "设置桥不可写（describe 未就绪或宿主只读）",
				"err.settingsWriteFailed": "设置写入失败"
			},
			en: {
				"card.deepSync.btn": "Deep sync (drsc)",
				"card.deepSync.hint": "Re-scan through drsc first, then rebuild the local index.",
				"card.deepSync.drs": "drsc syncing…",
				"card.deepSync.rebuilding": "Rebuilding index…",
				"panel.deepSync": "Deep sync",
				"panel.deepSync.hint": "Ask drsc to re-scan slowly, then rebuild the local index (for failed locating or missing new sessions).",
				"panel.deepSync.drs": "drsc syncing…",
				"panel.deepSync.rebuild": "Rebuilding index…",
				"panel.deepSync.done": "Sync done",
				"panel.deepSync.failed": "Sync failed",
				"panel.deepSync.failedReason": "Deep sync failed: {error}",
				"panel.deepSync.retry": "Retry sync",
				"panel.doctor": "Diagnostics",
				"panel.doctor.hint": "Compose the failure ledger and probe state into a pasteable report with runnable commands, then copy it. The ledger is cleared once copied.",
				"panel.doctor.copied": "Diagnostic report copied — paste it straight into the issue.",
				"panel.doctor.failed": "Could not build the diagnostic report: {error}",
				"panel.doctor.copyFailed": "Report built but copy failed ({error}); it was printed to the browser console.",
				"card.corpusSource": "Corpus source",
				"card.corpusSource.desc": "Content search reads the DRS projection DB; native keeps title/header metadata only.",
				"card.mode.drs": "DRS projection",
				"card.mode.native": "Local session service",
				"card.drsBaseUrl": "DRS base URL",
				"card.drsBaseUrl.desc": "Empty = auto (first trustedHosts entry, then http://127.0.0.1:8080).",
				"card.drsStatus.up": "Content search available.",
				"card.drsStatus.down": "Content search unavailable: {reason}",
				"card.drsStatus.reading": "Probing DRS…",
				"card.drsStatus.mode": "Active transport: {mode}",
				"card.contentTransport": "DRS transport",
				"card.contentTransport.desc": "auto = HTTP first, then the in-process read-only store (recommended); http = HTTP only; in-process = in-process store only (desktop).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "in-process",
				"card.drsReason.browser-access-denied": "Host blocks non-renderer access to local routes",
				"card.drsReason.drs-http-unreachable": "DRS route unreachable (port closed or refused)",
				"card.drsReason.drs-http-error": "DRS returned an error",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector is not activated as a plugin (route 404): run dsh plugin --profile <name> add dsh-reference-session-collector, then restart the host",
				"card.drsReason.drs-missing": "Dependency missing: reinstall this plugin (it ships the dependency)",
				"card.drsReason.drs-empty": "Projection DB not built yet: restart the host and wait for the first sync",
				"card.drsReason.drs-schema-mismatch": "Projection DB schema mismatch: upgrade dsh-reference-session-collector",
				"card.drsStatus.inactive": "Dependency plugin not activated: run dsh plugin --profile <name> add dsh-reference-session-collector and restart the host (currently serving from the read-only store; the projection DB will not update)",
				"panel.contentErr.browser-access-denied": "Host blocks browser access and the in-process store is unavailable too: restart the host and retry ({error})",
				"panel.contentErr.drs-http-unreachable": "DRS route unreachable: check that dsh-reference-session-collector is enabled ({error})",
				"panel.contentErr.drs-http-error": "DRS returned an error: {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector is not activated as a plugin (route 404): run dsh plugin --profile <name> add dsh-reference-session-collector, then restart the host ({error})",
				"panel.contentErr.drs-missing": "Dependency missing: reinstall this plugin (it ships dsh-reference-session-collector) ({error})",
				"panel.contentErr.drs-empty": "Projection DB not built yet: restart the host and wait for the first sync ({error})",
				"panel.contentErr.drs-schema-mismatch": "Projection DB schema mismatch: upgrade dsh-reference-session-collector (the DB is never cleared) ({error})",
				"card.title": "Search Index",
				"card.description": "Sidebar session search with title/content mode switching. Content search uses the plugin-owned index and never depends on the official DSH full-text index.",
				"card.unavailable": "Settings namespace unavailable: make sure the plugin is assembled into the profile.",
				"card.readonly": "Read-only",
				"card.enabled": "Enable session search",
				"card.enabled.desc": "Show the \"Search\" entry at the bottom of the sidebar.",
				"card.defaultMode": "Default search mode",
				"card.defaultMode.desc": "Which mode the panel opens in.",
				"card.rememberQuery": "Remember search history",
				"card.rememberQuery.desc": "Restore the last keywords, filters and scroll position when the panel reopens (valid for 12 hours). Nothing is saved while this is off.",
				"card.mode.title": "Title",
				"card.mode.content": "Content",
				"card.autoSync": "Auto sync index",
				"card.autoSync.desc": "Incrementally sync session logs into the independent index in the background.",
				"card.syncInterval": "Sync interval (seconds)",
				"card.syncInterval.desc": "Minimum interval between two incremental syncs.",
				"card.archiveKeep": "Archives to keep",
				"card.archiveKeep.desc": "How many archived index files each rebuild retains.",
				"card.index": "Content search index",
				"card.index.desc": "Index ready: {indexed} sessions collected.",
				"card.index.archives": ", {archives} archive(s).",
				"card.index.empty": "Independent index not built yet. Click \"Rebuild index\" to build it from session logs.",
				"card.index.reading": "Reading index status…",
				"card.index.rebuilding": "Rebuilding index… {done}/{total} (the old index keeps serving during the rebuild)",
				"card.index.syncing": "Syncing index…",
				"card.index.failures": "{count} session(s) failed to sync (see Host logs).",
				"card.index.rebuildError": "Rebuild failed: {error}",
				"card.index.rebuild": "Rebuild index",
				"card.index.rebuilding.btn": "Rebuilding…",
				"card.index.rebuild.hint": "Non-destructive: the old index keeps serving while the shadow builds; the swap is atomic and the old index is archived.",
				"card.index.archivedOwner": "Browsing and disposing of archived sessions belongs to dsh-session-steward. This plugin only reads the archive set and excludes those sessions from the index.",
				"card.index.archivedMissing": "Browsing and disposing of archived sessions needs dsh-session-steward, which is not installed. This plugin only reads the archive set and excludes those sessions from the index.",
				"card.index.export": "Export snapshot",
				"card.index.import": "Import snapshot",
				"card.index.exported": "Snapshot downloaded.",
				"card.index.import.started": "Import started: the index rebuilds in the background and swaps in when done.",
				"card.index.importParse": "Snapshot parse failed or contains no valid session.",
				"card.action.failed": "Action failed: {error}",
				"panel.titleSearch": "Title",
				"panel.contentSearch": "Content",
				"panel.searchTitle": "Search session titles…",
				"panel.searchContent": "Search session content…",
				"panel.entry": "Search",
				"panel.history.clear": "Clear",
				"panel.history.clear.hint": "Discard the saved search scene and start from an empty search.",
				"panel.buildIndex": "Build index",
				"panel.archived": "{count} archived session(s) excluded",
				"panel.rebuilding": "Rebuilding index… {done}/{total} (the old index keeps serving)",
				"panel.unavailable": "Independent index service unavailable: Host not initialized.",
				"panel.notBuilt": "Independent index not built yet: build it once to enable content search (no official FTS index needed).",
				"panel.loadingSessions": "Loading sessions…",
				"panel.sessionsError": "Failed to load sessions: {error}",
				"panel.noSessions": "No sessions",
				"panel.noMatch": "No matching sessions.",
				"panel.loadingContent": "Searching content…",
				"panel.contentError": "Content search failed: {error}",
				"panel.noContent": "No matching content.",
				"panel.contentHint": "Type keywords to search content.",
				"panel.noText": "(no text)",
				"panel.delete": "Delete",
				"panel.delete.confirm": "Confirm delete",
				"panel.delete.hint": "Delete this session (irreversible, same pipeline as the manage view)",
				"panel.delete.done": "Deleted {n} session(s)",
				"panel.delete.failed": "Delete failed: {error}",
				"panel.untitled": "(untitled)",
				"panel.openSession": "Open session",
				"panel.footer.invoke": "Open",
				"panel.footer.close": "Close",
				"filter.all": "All",
				"filter.user": "User",
				"filter.reply": "Reply",
				"filter.tool": "Tool",
				"sort.label": "Result ordering",
				"sort.relevance": "Relevance",
				"sort.time": "Time",
				"sort.relevance.hint": "Order by match strength (default).",
				"sort.time.hint": "Order by session last-activity, newest first; ties break on match strength.",
				"group.merge": "Merge",
				"group.expand": "Expand",
				"group.merge.hint": "Show only the strongest hit per session (default).",
				"group.expand.hint": "List every hit of a session as its own row (each row is a jump target).",
				"type.user/message": "User",
				"type.assistant/message": "Reply",
				"type.tool/call": "Tool call",
				"type.tool/result": "Tool result",
				"panel.manage": "Manage",
				"domain.all": "All",
				"domain.active": "Active",
				"domain.archived": "Archived",
				"tag.archived": "Archived",
				"manage.hint": "Grouped by workspace; tick rows then batch-operate. Deletion is irreversible.",
				"manage.restartHint": "Prefers host in-memory APIs (0.1.7+ archive/unarchive apply instantly); falls back to direct storage-file edits, which need a restart.",
				"manage.done.restart": "Restart DSH for the sidebar to fully reflect this.",
				"manage.group.nocwd": "(no workspace)",
				"manage.selectGroup": "Toggle the whole group",
				"manage.selected": "{n} selected",
				"manage.batch.archive": "Archive",
				"manage.batch.unarchive": "Unarchive",
				"manage.batch.delete": "Delete",
				"manage.batch.confirm": "Confirm delete",
				"manage.batch.working": "Working…",
				"manage.done.archive": "Archived {n} sessions.",
				"manage.done.unarchive": "Unarchived {n} sessions.",
				"manage.done.purge": "Purged {n} sessions.",
				"manage.done.error": "Operation failed: {error}",
				"panel.index.none": "Index not built",
				"panel.index.count": "Index {n}",
				"panel.index.rebuilding": "Rebuilding {done}/{total}",
				"panel.index.rebuild": "Rebuild",
				"filter.favorites": "Favorites",
				"date.from": "From date",
				"date.to": "To date",
				"star.on": "Unfavorite",
				"star.off": "Favorite",
				"workspace.label": "Workspace",
				"workspace.more": "{n} more",
				"workspace.less": "Collapse",
				"manage.search": "Search sessions…",
				"group.collapse": "Collapse/expand group",
				"group.expandAll": "Expand all",
				"group.collapseAll": "Collapse all",
				"cold.badge.hint": "Cold data: target is beyond the message-rail index (>40 turns); clicking needs backfill loading",
				"toocold.badge.hint": "Very cold: target exceeds the safe backtrack range (>200 turns); no auto paging",
				"cold.confirm.body": "Target is ~{gap} turns before the latest, beyond the rail index. Backfill paging is needed (~{pages} pages). Confirm to best-effort load and jump.",
				"cold.confirm.ok": "Load & jump",
				"cold.confirm.cancel": "Cancel",
				"toocold.hint": "Session opened, but the target exceeds the safe backtrack range (>200 turns). Please page up manually.",
				"hud.progress": "Backfilling earlier history… {pulled}/{budget}",
				"hud.done": "History loaded",
				"hud.jump": "Jump",
				"hud.fail": "Backfill did not find the target",
				"hud.retry": "Retry (extra page budget)",
				"hud.close": "Close",
				"panel.sessionsError.bare": "Failed to load session list",
				"panel.searchFailed": "Search failed",
				"panel.unknownError": "Unknown error",
				"panel.indexUnreachable": "Index status unreachable: the Host half is probably a stale process. Fully restart dsh web (a browser refresh does not reload the Host) and retry.",
				"panel.locate.pending": "Locating the hit…",
				"panel.locate.ok": "Jumped to the hit line",
				"panel.locate.miss": "Could not locate (line not rendered / text split / timed out)",
				"card.indexStatus.requestFailed": "index-status request failed",
				"card.indexStatus.readFailed": "Failed to read status",
				"card.indexStatus.readFailedHint": "Failed to read index status: {error}. Fully restart dsh web (a browser refresh does not reload the Host half) and retry.",
				"card.indexStatus.retry": "Retry status",
				"err.requestFailed": "Request failed",
				"err.timeout": "Request timed out",
				"err.settingsUnwritable": "Settings bridge not writable (describe not ready, or the host is read-only)",
				"err.settingsWriteFailed": "Settings write failed"
			},
			ja: {
				"card.contentTransport": "DRS 接続方式",
				"card.contentTransport.desc": "auto=まず HTTP、失敗時はプロセス内の読み取り専用ストアへ（推奨）。http=HTTP のみ。in-process=プロセス内ストアのみ（デスクトップ）。",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "プロセス内",
				"card.drsStatus.mode": "現在の経路：{mode}",
				"card.drsReason.browser-access-denied": "ホストが非レンダラーのローカルアクセスを拒否しています",
				"card.drsReason.drs-http-unreachable": "DRS 経路に到達できません（ポート未待受または拒否）",
				"card.drsReason.drs-http-error": "DRS がエラーを返しました",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector がプラグインとして有効化されていません（ルート 404）：dsh plugin --profile <name> add dsh-reference-session-collector を実行後にホストを再起動してください",
				"card.drsReason.drs-missing": "依存パッケージが同梱されていません：本プラグインを再インストールしてください（依存は自動で入ります）",
				"card.drsReason.drs-empty": "投影 DB が未作成です：ホストを再起動して初回同期を待ってください",
				"card.drsReason.drs-schema-mismatch": "投影 DB のスキーマが想定と一致しません：dsh-reference-session-collector を更新してください",
				"card.drsStatus.inactive": "依存プラグイン未有効化：dsh plugin --profile <name> add dsh-reference-session-collector を実行後にホストを再起動（現在は読み取り専用ストアで提供中、投影データは自動更新されません）",
				"panel.contentErr.browser-access-denied": "ホストがブラウザーからのローカルアクセスを拒否し、プロセス内ストアも利用できません：ホストを再起動して再試行してください ({error})",
				"panel.contentErr.drs-http-unreachable": "DRS 経路に到達できません：dsh-reference-session-collector が有効か確認してください ({error})",
				"panel.contentErr.drs-http-error": "DRS がエラーを返しました：{error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector がプラグインとして有効化されていません（ルート 404）：dsh plugin --profile <name> add dsh-reference-session-collector を実行後にホストを再起動してください ({error})",
				"panel.contentErr.drs-missing": "依存パッケージがありません：本プラグインを再インストールしてください（dsh-reference-session-collector は同梱されます） ({error})",
				"panel.contentErr.drs-empty": "投影 DB が未作成です：ホストを再起動して初回同期をお待ちください ({error})",
				"panel.contentErr.drs-schema-mismatch": "投影 DB のスキーマが一致しません：dsh-reference-session-collector を更新してください（DB は消去されません） ({error})",
				"card.title": "検索インデックス",
				"card.description": "サイドバーセッション検索の強化：タイトル検索とコンテンツ検索のワンクリック切り替え。コンテンツ検索はプラグイン独自のインデックスを使用し、DSH公式全文インデックスに依存しません。",
				"card.unavailable": "設定名前空間が利用できません：プラグインがプロファイルに組み込まれていることを確認してください。",
				"card.readonly": "読み取り専用",
				"card.enabled": "セッション検索を有効化",
				"card.enabled.desc": "サイドバー下部に「検索」エントリを表示します。",
				"card.defaultMode": "デフォルト検索モード",
				"card.defaultMode.desc": "パネルを開いたときの初期モード。",
				"card.rememberQuery": "検索履歴を保持",
				"card.rememberQuery.desc": "パネルを開き直したとき、前回のキーワード・絞り込み・スクロール位置を復元します（12 時間有効）。オフの間は何も保存しません。",
				"card.mode.title": "タイトル",
				"card.mode.content": "コンテンツ",
				"card.autoSync": "インデックス自動同期",
				"card.autoSync.desc": "バックグラウンドでセッションログを独立インデックスに増分同期します。",
				"card.syncInterval": "同期間隔（秒）",
				"card.syncInterval.desc": "2回の増分同期間の最小間隔。",
				"card.archiveKeep": "アーカイブ保持数",
				"card.archiveKeep.desc": "インデックス再構築ごとに保持するアーカイブファイル数。",
				"card.index": "コンテンツ検索インデックス",
				"card.index.desc": "インデックス正常：{indexed} セッションを収容済み。",
				"card.index.archives": "、アーカイブ {archives} 件。",
				"card.index.empty": "独立インデックスが未構築です。「インデックス再構築」をクリックしてセッションログから構築してください。",
				"card.index.reading": "インデックス状態を読み取り中…",
				"card.index.rebuilding": "インデックス再構築中… {done}/{total}（再構築中も旧インデックスで検索可能）",
				"card.index.syncing": "インデックス同期中…",
				"card.index.failures": "{count} 件のセッション同期に失敗（Hostログ参照）。",
				"card.index.rebuildError": "再構築失敗：{error}",
				"card.index.rebuild": "インデックス再構築",
				"card.index.rebuilding.btn": "再構築中…",
				"card.index.rebuild.hint": "非破壊的：構築中も旧インデックスで検索可能、完了後にアトミック切替し旧インデックスをアーカイブ。",
				"card.index.archivedOwner": "アーカイブ済みセッションの閲覧と清理は「セッション管理者」（dsh-session-steward）が担当。本プラグインはアーカイブ集合を読み取り専用で参照し、アーカイブ済みセッションをインデックスから除外します。",
				"card.index.archivedMissing": "アーカイブ済みセッションの閲覧と清理には「セッション管理者」（dsh-session-steward）が必要ですが、現在未インストールです。本プラグインはアーカイブ集合を読み取り専用で参照し、アーカイブ済みセッションをインデックスから除外します。",
				"card.index.export": "スナップショット書出",
				"card.index.import": "スナップショット読込",
				"card.index.exported": "スナップショットをダウンロードしました。",
				"card.index.import.started": "スナップショットのインポートを開始：バックグラウンドでインデックスを再構築し、完了後に自動切替。",
				"card.index.importParse": "スナップショットの解析に失敗、または有効なセッションがありません。",
				"card.action.failed": "操作失敗：{error}",
				"panel.titleSearch": "タイトル",
				"panel.contentSearch": "コンテンツ",
				"panel.searchTitle": "セッションタイトルを検索…",
				"panel.searchContent": "セッション内容を検索…",
				"panel.entry": "検索",
				"panel.history.clear": "クリア",
				"panel.history.clear.hint": "保存された検索状態を破棄し、空の検索に戻ります。",
				"panel.buildIndex": "インデックス構築",
				"panel.archived": "アーカイブ済み {count} 件を除外",
				"panel.rebuilding": "インデックス再構築中… {done}/{total}（再構築中も旧インデックスで検索可能）",
				"panel.unavailable": "独立インデックスサービス利用不可：Host初期化未完了。",
				"panel.notBuilt": "独立インデックス未構築：構築すればコンテンツ検索が有効になります（DSH公式全文インデックス不要）。",
				"panel.loadingSessions": "セッション一覧を読み込み中…",
				"panel.sessionsError": "セッション一覧の読み込み失敗：{error}",
				"panel.noSessions": "セッションなし",
				"panel.noMatch": "一致するセッションがありません。",
				"panel.loadingContent": "セッション内容を検索中…",
				"panel.contentError": "コンテンツ検索失敗：{error}",
				"panel.noContent": "一致するコンテンツがありません。",
				"panel.contentHint": "キーワードを入力してコンテンツを検索。",
				"panel.noText": "（テキストなし）",
				"panel.delete": "削除",
				"panel.delete.confirm": "削除を確認",
				"panel.delete.hint": "このセッションを削除（不可逆、管理画面と同じ経路）",
				"panel.delete.done": "セッション {n} 件を削除しました",
				"panel.delete.failed": "削除に失敗：{error}",
				"panel.untitled": "（無題）",
				"panel.openSession": "セッションを開く",
				"panel.footer.invoke": "開く",
				"panel.footer.close": "閉じる",
				"filter.all": "すべて",
				"filter.user": "ユーザー",
				"filter.reply": "返信",
				"filter.tool": "ツール",
				"sort.label": "結果の並べ替え",
				"sort.relevance": "関連度",
				"sort.time": "時間",
				"sort.relevance.hint": "一致強度順に並べ替え（デフォルト）。",
				"sort.time.hint": "セッション最終活動日時の降順、同着時は一致強度順。",
				"group.merge": "まとめる",
				"group.expand": "展開",
				"group.merge.hint": "セッションごとに最強の一致1件のみ表示（デフォルト）。",
				"group.expand.hint": "同一セッションの複数一致を行ごとに展開（各行が個別のジャンプ先）。",
				"type.user/message": "ユーザー",
				"type.assistant/message": "返信",
				"type.tool/call": "ツール呼び出し",
				"type.tool/result": "ツール結果",
				"panel.deepSync": "ディープ同期",
				"panel.deepSync.hint": "drsc に低速再スキャンを依頼して投影ライブラリを修復し、その後ローカルインデックスを整理します（見つからない / 新しいセッションが検索できない場合）。",
				"panel.deepSync.drs": "drsc 同期中…",
				"panel.deepSync.rebuild": "インデックス整理中…",
				"panel.deepSync.done": "同期完了",
				"panel.deepSync.failed": "同期失敗",
				"panel.deepSync.failedReason": "ディープ同期に失敗しました：{error}",
				"panel.deepSync.retry": "同期を再試行",
				"panel.doctor": "診断レポート",
				"panel.doctor.hint": "障害台帳とプローブ状態を、実行可能なコマンド付きの貼り付け用レポートにまとめてクリップボードへコピーします。コピー後は台帳を消去します。",
				"panel.doctor.copied": "診断レポートをコピーしました。そのまま issue に貼り付けてください。",
				"panel.doctor.failed": "診断レポートの生成に失敗しました：{error}",
				"panel.doctor.copyFailed": "レポートは生成されましたがコピーに失敗しました（{error}）。ブラウザのコンソールに出力しました。",
				"panel.sessionsError.bare": "セッション一覧の読み込みに失敗しました",
				"panel.searchFailed": "検索に失敗しました",
				"panel.unknownError": "不明なエラー",
				"panel.indexUnreachable": "インデックス状態に到達できません：Host 側が旧プロセスの可能性があります。dsh web を完全に再起動し（ブラウザの再読み込みでは Host は再読込されません）、再試行してください。",
				"panel.locate.pending": "ヒット行を探しています…",
				"panel.locate.ok": "ヒット行にジャンプしました",
				"panel.locate.miss": "位置特定できませんでした（行が未レンダリング／テキスト分割／タイムアウト）",
				"card.indexStatus.requestFailed": "index-status リクエストに失敗しました",
				"card.indexStatus.readFailed": "ステータスの読み取りに失敗しました",
				"card.indexStatus.readFailedHint": "インデックス状態の読み取りに失敗しました：{error}。dsh web を完全に再起動し（ブラウザの再読み込みでは Host 半分は再読込されません）、再試行してください。",
				"card.indexStatus.retry": "ステータスを再試行",
				"err.requestFailed": "リクエストに失敗しました",
				"err.timeout": "リクエストがタイムアウトしました",
				"err.settingsUnwritable": "設定ブリッジが書き込み不可です（describe 未準備、またはホストが読み取り専用）",
				"err.settingsWriteFailed": "設定の書き込みに失敗しました",
				"panel.index.count": "インデックス {n}",
				"panel.index.none": "インデックス未構築",
				"panel.index.rebuilding": "整理中 {done}/{total}",
				"domain.all": "すべて",
				"tag.archived": "アーカイブ",
				"date.from": "開始日",
				"date.to": "終了日",
				"hud.progress": "以前の履歴を遡って読み込み中… {pulled}/{budget}",
				"hud.done": "履歴を読み込みました",
				"hud.jump": "ジャンプ",
				"hud.fail": "遡っても対象が見つかりませんでした",
				"hud.retry": "再試行（ページング予算を追加）",
				"hud.close": "閉じる",
				"cold.badge.hint": "冷データ：対象はメッセージレールのインデックス範囲外（>40 ターン）です。クリック時には遡り読み込みが必要です。",
				"cold.confirm.body": "対象は最新ターンの約 {gap} ターン前で、メッセージレールのインデックス範囲外です。遡りページング読み込みが必要です（約 {pages} ページ）。確認すると、可能な範囲で読み込んでジャンプします。",
				"cold.confirm.ok": "読み込んでジャンプ",
				"cold.confirm.cancel": "キャンセル",
				"toocold.badge.hint": "極冷データ：対象が安全な遡り範囲（>200 ターン）を超えています。自動ページングはしません。",
				"toocold.hint": "セッションは開きましたが、対象が安全な遡り範囲（>200 ターン）を超えています。手動で上へページングして探してください。",
				"card.deepSync.btn": "ディープ同期（drsc）",
				"card.deepSync.hint": "まず drsc で低速再スキャンして投影 DB を直し、そのあとローカル索引を整理します。",
				"card.deepSync.drs": "drsc 同期中…",
				"card.deepSync.rebuilding": "索引を整理中…",
				"card.corpusSource": "コーパス元",
				"card.corpusSource.desc": "内容検索のコーパスは DRS 投影 DB から取得します。native はタイトル／ヘッダーのメタデータのみを保持します。",
				"card.mode.drs": "DRS 投影 DB",
				"card.mode.native": "ローカルセッションサービス",
				"card.drsBaseUrl": "DRS ベース URL",
				"card.drsBaseUrl.desc": "空=自動（最初の trustedHosts エントリ、なければ http://127.0.0.1:8080）。",
				"card.drsStatus.up": "内容検索が利用できます。",
				"card.drsStatus.down": "内容検索は利用できません：{reason}",
				"card.drsStatus.reading": "DRS を検出中…",
				"panel.manage": "管理",
				"domain.active": "有効",
				"domain.archived": "アーカイブ済み",
				"manage.hint": "ワークスペースごとに分類。チェックして一括操作。削除は元に戻せません。",
				"manage.restartHint": "ホストのメモリ API を優先して即時反映します（0.1.7+ のアーカイブ／解除は再起動不要）。使えない場合は保存ファイルを直接書き換え、再起動後にサイドバーへ反映されます。",
				"manage.done.restart": "サイドバーに完全反映するには DSH の再起動が必要です。",
				"manage.group.nocwd": "（未分類）",
				"manage.selectGroup": "グループ全体を選択/解除",
				"manage.selected": "{n} 件選択",
				"manage.batch.archive": "アーカイブ",
				"manage.batch.unarchive": "アーカイブ解除",
				"manage.batch.delete": "削除",
				"manage.batch.confirm": "削除を確定",
				"manage.batch.working": "実行中…",
				"manage.done.archive": "{n} 件のセッションをアーカイブしました。",
				"manage.done.unarchive": "{n} 件のセッションのアーカイブを解除しました。",
				"manage.done.purge": "{n} 件のセッションを削除しました。",
				"manage.done.error": "操作に失敗しました：{error}",
				"panel.index.rebuild": "整理",
				"filter.favorites": "お気に入り",
				"star.on": "お気に入り解除",
				"star.off": "お気に入り登録",
				"workspace.label": "ワークスペース",
				"workspace.more": "ほか {n} 件",
				"workspace.less": "折りたたむ",
				"manage.search": "セッションを検索…",
				"group.collapse": "グループを折りたたむ/展開",
				"group.expandAll": "すべて展開",
				"group.collapseAll": "すべて折りたたむ"
			},
			ko: {
				"card.contentTransport": "DRS 연결 방식",
				"card.contentTransport.desc": "auto=먼저 HTTP, 실패하면 프로세스 내 읽기 전용 저장소(권장). http=HTTP만. in-process=프로세스 내 저장소만(데스크톱).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "프로세스 내",
				"card.drsStatus.mode": "현재 경로: {mode}",
				"card.drsReason.browser-access-denied": "호스트가 비렌더러의 로컬 접근을 차단합니다",
				"card.drsReason.drs-http-unreachable": "DRS 경로에 연결할 수 없습니다(포트 미개방 또는 거부)",
				"card.drsReason.drs-http-error": "DRS가 오류를 반환했습니다",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector가 플러그인으로 활성화되지 않았습니다(라우트 404): dsh plugin --profile <name> add dsh-reference-session-collector 실행 후 호스트를 재시작하세요",
				"card.drsReason.drs-missing": "의존 패키지가 포함되어 있지 않습니다: 이 플러그인을 다시 설치하세요(의존성은 자동 포함)",
				"card.drsReason.drs-empty": "프로젝션 DB가 아직 없습니다: 호스트를 재시작하고 첫 동기화를 기다리세요",
				"card.drsReason.drs-schema-mismatch": "프로젝션 DB 스키마가 예상과 다릅니다: dsh-reference-session-collector를 업그레이드하세요",
				"card.drsStatus.inactive": "의존 플러그인이 활성화되지 않음: dsh plugin --profile <name> add dsh-reference-session-collector 실행 후 호스트 재시작(현재는 읽기 전용 저장소를 사용하며 프로젝트 데이터가 자동 갱신되지 않습니다)",
				"panel.contentErr.browser-access-denied": "호스트가 브라우저 접근을 차단했고 프로세스 내 저장소도 사용할 수 없습니다: 호스트를 재시작한 뒤 다시 시도하세요 ({error})",
				"panel.contentErr.drs-http-unreachable": "DRS 경로에 연결할 수 없습니다: dsh-reference-session-collector가 활성화되어 있는지 확인하세요 ({error})",
				"panel.contentErr.drs-http-error": "DRS가 오류를 반환했습니다: {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector가 플러그인으로 활성화되지 않았습니다(라우트 404): dsh plugin --profile <name> add dsh-reference-session-collector 실행 후 호스트를 재시작하세요 ({error})",
				"panel.contentErr.drs-missing": "의존 패키지가 없습니다: 이 플러그인을 다시 설치하세요(dsh-reference-session-collector 자동 포함) ({error})",
				"panel.contentErr.drs-empty": "프로젝션 DB가 아직 없습니다: 호스트를 재시작하고 첫 동기화를 기다리세요 ({error})",
				"panel.contentErr.drs-schema-mismatch": "프로젝션 DB 스키마가 일치하지 않습니다: dsh-reference-session-collector를 업그레이드하세요(DB는 지워지지 않음) ({error})",
				"card.title": "검색 인덱스",
				"card.description": "사이드바 세션 검색 강화: 제목 검색과 콘텐츠 검색 간 원클릭 전환. 콘텐츠 검색은 플러그인 자체 인덱스를 사용하며 DSH 공식 전문 인덱스에 의존하지 않습니다.",
				"card.unavailable": "설정 네임스페이스를 사용할 수 없습니다: 플러그인이 프로파일에 조립되어 있는지 확인하세요.",
				"card.readonly": "읽기 전용",
				"card.enabled": "세션 검색 활성화",
				"card.enabled.desc": "사이드바 하단에 \"검색\" 항목을 표시합니다.",
				"card.defaultMode": "기본 검색 모드",
				"card.defaultMode.desc": "패널을 열 때 기본 모드.",
				"card.rememberQuery": "검색 기록 유지",
				"card.rememberQuery.desc": "패널을 다시 열 때 지난 키워드·필터·스크롤 위치를 복원합니다(12시간 유효). 끄면 아무것도 저장하지 않습니다.",
				"card.mode.title": "제목",
				"card.mode.content": "콘텐츠",
				"card.autoSync": "인덱스 자동 동기화",
				"card.autoSync.desc": "백그라운드에서 세션 로그를 독립 인덱스에 증분 동기화합니다.",
				"card.syncInterval": "동기화 간격(초)",
				"card.syncInterval.desc": "두 증분 동기화 사이의 최소 간격.",
				"card.archiveKeep": "아카이브 보존 수",
				"card.archiveKeep.desc": "인덱스 재구축 시 보존할 아카이브 파일 수.",
				"card.index": "콘텐츠 검색 인덱스",
				"card.index.desc": "인덱스 정상: {indexed}개 세션 수집 완료.",
				"card.index.archives": ", 아카이브 {archives}건.",
				"card.index.empty": "독립 인덱스가 아직 구축되지 않았습니다. \"인덱스 재구축\"을 클릭하여 세션 로그에서 구축하세요.",
				"card.index.reading": "인덱스 상태 읽는 중…",
				"card.index.rebuilding": "인덱스 재구축 중… {done}/{total} (재구축 중에도 이전 인덱스로 검색 가능)",
				"card.index.syncing": "인덱스 동기화 중…",
				"card.index.failures": "{count}개 세션 동기화 실패 (Host 로그 참조).",
				"card.index.rebuildError": "재구축 실패: {error}",
				"card.index.rebuild": "인덱스 재구축",
				"card.index.rebuilding.btn": "재구축 중…",
				"card.index.rebuild.hint": "비파괴적: 구축 중에도 이전 인덱스로 검색 가능하며, 완료 후 원자적 전환하고 이전 인덱스를 아카이브합니다.",
				"card.index.archivedOwner": "아카이브된 세션의 탐색 및 정리는 \"세션 관리자\"(dsh-session-steward)가 담당합니다. 본 플러그인은 아카이브 세트를 읽기 전용으로 참조하여 아카이브된 세션을 인덱스에서 제외합니다.",
				"card.index.archivedMissing": "아카이브된 세션의 탐색 및 정리에는 \"세션 관리자\"(dsh-session-steward)가 필요하지만 현재 미설치 상태입니다. 본 플러그인은 아카이브 세트를 읽기 전용으로 참조하여 아카이브된 세션을 인덱스에서 제외합니다.",
				"card.index.export": "스냅샷 내보내기",
				"card.index.import": "스냅샷 가져오기",
				"card.index.exported": "스냅샷이 다운로드되었습니다.",
				"card.index.import.started": "스냅샷 가져오기 시작: 백그라운드에서 인덱스를 재구축하며 완료 후 자동 전환됩니다.",
				"card.index.importParse": "스냅샷 파싱 실패 또는 유효한 세션 없음.",
				"card.action.failed": "작업 실패: {error}",
				"panel.titleSearch": "제목",
				"panel.contentSearch": "콘텐츠",
				"panel.searchTitle": "세션 제목 검색…",
				"panel.searchContent": "세션 콘텐츠 검색…",
				"panel.entry": "검색",
				"panel.history.clear": "지우기",
				"panel.history.clear.hint": "저장된 검색 상태를 지우고 빈 검색으로 돌아갑니다.",
				"panel.buildIndex": "인덱스 구축",
				"panel.archived": "아카이브된 {count}개 세션 제외됨",
				"panel.rebuilding": "인덱스 재구축 중… {done}/{total} (재구축 중에도 이전 인덱스로 검색 가능)",
				"panel.unavailable": "독립 인덱스 서비스 사용 불가: Host 초기화 미완료.",
				"panel.notBuilt": "독립 인덱스 미구축: 구축하면 콘텐츠 검색이 활성화됩니다 (DSH 공식 전문 인덱스 불필요).",
				"panel.loadingSessions": "세션 목록 읽는 중…",
				"panel.sessionsError": "세션 목록 읽기 실패: {error}",
				"panel.noSessions": "세션 없음",
				"panel.noMatch": "일치하는 세션이 없습니다.",
				"panel.loadingContent": "세션 콘텐츠 검색 중…",
				"panel.contentError": "콘텐츠 검색 실패: {error}",
				"panel.noContent": "일치하는 콘텐츠가 없습니다.",
				"panel.contentHint": "키워드를 입력하여 콘텐츠를 검색하세요.",
				"panel.noText": "(텍스트 없음)",
				"panel.delete": "삭제",
				"panel.delete.confirm": "삭제 확인",
				"panel.delete.hint": "이 세션 삭제(되돌릴 수 없음, 관리 화면과 동일한 경로)",
				"panel.delete.done": "세션 {n}개 삭제됨",
				"panel.delete.failed": "삭제 실패: {error}",
				"panel.untitled": "(제목 없음)",
				"panel.openSession": "세션 열기",
				"panel.footer.invoke": "열기",
				"panel.footer.close": "닫기",
				"filter.all": "전체",
				"filter.user": "사용자",
				"filter.reply": "답변",
				"filter.tool": "도구",
				"sort.label": "결과 정렬",
				"sort.relevance": "관련도",
				"sort.time": "시간",
				"sort.relevance.hint": "일치 강도순 정렬(기본값).",
				"sort.time.hint": "세션 마지막 활동 시간 내림차순, 동률 시 일치 강도순.",
				"group.merge": "병합",
				"group.expand": "분할",
				"group.merge.hint": "세션별 최강 일치 1건만 표시(기본값).",
				"group.expand.hint": "같은 세션의 여러 일치를 각 행으로 표시(각 행이 개별 이동 대상).",
				"type.user/message": "사용자",
				"type.assistant/message": "답변",
				"type.tool/call": "도구 호출",
				"type.tool/result": "도구 결과",
				"panel.deepSync": "딥 동기화",
				"panel.deepSync.hint": "drsc 에 느린 재스캔을 요청해 투영 라이브러리를 고친 뒤 로컬 인덱스를 정리합니다(위치를 찾지 못하거나 새 세션 검색이 안 될 때).",
				"panel.deepSync.drs": "drsc 동기화 중…",
				"panel.deepSync.rebuild": "인덱스 정리 중…",
				"panel.deepSync.done": "동기화 완료",
				"panel.deepSync.failed": "동기화 실패",
				"panel.deepSync.failedReason": "딥 동기화 실패: {error}",
				"panel.deepSync.retry": "동기화 재시도",
				"panel.doctor": "진단 보고서",
				"panel.doctor.hint": "장애 원장과 프로브 상태를 실행 가능한 명령이 포함된 붙여넣기용 보고서로 정리해 클립보드에 복사합니다. 복사 후 원장을 비웁니다.",
				"panel.doctor.copied": "진단 보고서를 복사했습니다. 그대로 issue 에 붙여넣으세요.",
				"panel.doctor.failed": "진단 보고서 생성 실패: {error}",
				"panel.doctor.copyFailed": "보고서는 생성되었지만 복사에 실패했습니다({error}). 브라우저 콘솔에 출력했습니다.",
				"panel.sessionsError.bare": "세션 목록을 불러오지 못했습니다",
				"panel.searchFailed": "검색에 실패했습니다",
				"panel.unknownError": "알 수 없는 오류",
				"panel.indexUnreachable": "인덱스 상태에 도달할 수 없습니다: Host 쪽이 이전 프로세스일 가능성이 있습니다. dsh web을 완전히 재시작한 뒤(브라우저 새로고침으로는 Host가 다시 로드되지 않음) 재시도하세요.",
				"panel.locate.pending": "히트 줄을 찾는 중…",
				"panel.locate.ok": "히트 줄로 이동했습니다",
				"panel.locate.miss": "위치를 찾지 못했습니다(줄 미렌더링/텍스트 분할/시간 초과)",
				"card.indexStatus.requestFailed": "index-status 요청 실패",
				"card.indexStatus.readFailed": "상태를 읽지 못했습니다",
				"card.indexStatus.readFailedHint": "인덱스 상태를 읽지 못했습니다: {error}. dsh web을 완전히 재시작한 뒤(브라우저 새로고침으로는 Host 절반이 다시 로드되지 않음) 재시도하세요.",
				"card.indexStatus.retry": "상태 재시도",
				"err.requestFailed": "요청 실패",
				"err.timeout": "요청 시간 초과",
				"err.settingsUnwritable": "설정 브리지를 쓸 수 없습니다(describe 미준비 또는 호스트 읽기 전용)",
				"err.settingsWriteFailed": "설정 쓰기 실패",
				"panel.index.count": "인덱스 {n}",
				"panel.index.none": "인덱스 미구축",
				"panel.index.rebuilding": "정리 중 {done}/{total}",
				"domain.all": "전체",
				"tag.archived": "아카이브",
				"date.from": "시작일",
				"date.to": "종료일",
				"hud.progress": "이전 기록을 소급하여 불러오는 중… {pulled}/{budget}",
				"hud.done": "기록을 불러왔습니다",
				"hud.jump": "이동",
				"hud.fail": "소급했지만 대상을 찾지 못했습니다",
				"hud.retry": "다시 시도(페이지 예산 추가)",
				"hud.close": "닫기",
				"cold.badge.hint": "콜드 데이터: 대상이 메시지 레일 인덱스 범위를 벗어남(>40턴). 클릭 시 소급 불러오기가 필요합니다.",
				"cold.confirm.body": "대상은 최신 턴의 약 {gap}턴 전으로 메시지 레일 인덱스 범위를 벗어납니다. 소급 페이징 불러오기가 필요합니다(약 {pages}페이지). 확인하면 최선을 다해 불러온 뒤 이동합니다.",
				"cold.confirm.ok": "불러오고 이동",
				"cold.confirm.cancel": "취소",
				"toocold.badge.hint": "극저온 데이터: 대상이 안전 소급 범위(>200턴)를 초과함. 자동 페이징 없음.",
				"toocold.hint": "세션은 열었지만 대상이 안전 소급 범위(>200턴)를 초과합니다. 수동으로 위로 페이징하여 찾아 주세요.",
				"card.deepSync.btn": "딥 동기화(drsc)",
				"card.deepSync.hint": "먼저 drsc로 저속 재스캔해 투영 DB를 고친 뒤 로컬 인덱스를 정리합니다.",
				"card.deepSync.drs": "drsc 동기화 중…",
				"card.deepSync.rebuilding": "인덱스 정리 중…",
				"card.corpusSource": "코퍼스 소스",
				"card.corpusSource.desc": "콘텐츠 검색의 코퍼스는 DRS 투영 DB에서 가져옵니다. native는 제목/헤더 메타데이터만 유지합니다.",
				"card.mode.drs": "DRS 투영 DB",
				"card.mode.native": "로컬 세션 서비스",
				"card.drsBaseUrl": "DRS 기본 URL",
				"card.drsBaseUrl.desc": "비우면 자동(첫 trustedHosts 항목, 없으면 http://127.0.0.1:8080).",
				"card.drsStatus.up": "콘텐츠 검색을 사용할 수 있습니다.",
				"card.drsStatus.down": "콘텐츠 검색을 사용할 수 없습니다: {reason}",
				"card.drsStatus.reading": "DRS 감지 중…",
				"panel.manage": "관리",
				"domain.active": "활성",
				"domain.archived": "보관됨",
				"manage.hint": "워크스페이스별로 묶여 있습니다. 선택 후 일괄 작업합니다. 삭제는 되돌릴 수 없습니다.",
				"manage.restartHint": "호스트 메모리 API를 우선 사용해 즉시 반영합니다(0.1.7+ 보관/해제는 재시작 불필요). 사용할 수 없으면 저장 파일을 직접 수정하며 재시작 후 사이드바에 반영됩니다.",
				"manage.done.restart": "사이드바에 완전히 반영하려면 DSH를 다시 시작해야 합니다.",
				"manage.group.nocwd": "(그룹 없음)",
				"manage.selectGroup": "그룹 전체 선택/해제",
				"manage.selected": "{n}개 선택됨",
				"manage.batch.archive": "보관",
				"manage.batch.unarchive": "보관 해제",
				"manage.batch.delete": "삭제",
				"manage.batch.confirm": "삭제 확인",
				"manage.batch.working": "실행 중…",
				"manage.done.archive": "{n}개 세션을 보관했습니다.",
				"manage.done.unarchive": "{n}개 세션의 보관을 해제했습니다.",
				"manage.done.purge": "{n}개 세션을 정리했습니다.",
				"manage.done.error": "작업 실패: {error}",
				"panel.index.rebuild": "정리",
				"filter.favorites": "즐겨찾기",
				"star.on": "즐겨찾기 해제",
				"star.off": "즐겨찾기 추가",
				"workspace.label": "워크스페이스",
				"workspace.more": "{n}개 더",
				"workspace.less": "접기",
				"manage.search": "세션 검색…",
				"group.collapse": "그룹 접기/펼치기",
				"group.expandAll": "모두 펼치기",
				"group.collapseAll": "모두 접기"
			},
			fr: {
				"card.contentTransport": "Transport DRS",
				"card.contentTransport.desc": "auto = HTTP d'abord, puis le stockage local en lecture seule (recommandé) ; http = HTTP uniquement ; in-process = stockage local uniquement (bureau).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "en processus",
				"card.drsStatus.mode": "Canal actif : {mode}",
				"card.drsReason.browser-access-denied": "L'hôte bloque l'accès local des processus non-renderer",
				"card.drsReason.drs-http-unreachable": "Route DRS injoignable (port fermé ou refusé)",
				"card.drsReason.drs-http-error": "DRS a renvoyé une erreur",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector n'est pas activé en tant que plugin (route 404) : exécutez dsh plugin --profile <name> add dsh-reference-session-collector puis redémarrez l'hôte",
				"card.drsReason.drs-missing": "Dépendance absente du paquet : réinstallez ce plugin (la dépendance est fournie)",
				"card.drsReason.drs-empty": "Base de projection absente : redémarrez l'hôte et attendez la première synchro",
				"card.drsReason.drs-schema-mismatch": "Schéma de la base de projection incompatible : mettez à jour dsh-reference-session-collector",
				"card.drsStatus.inactive": "Plugin de dépendance non activé : exécutez dsh plugin --profile <name> add dsh-reference-session-collector puis redémarrez l'hôte (servi via le magasin en lecture seule ; les projections ne seront pas mises à jour)",
				"panel.contentErr.browser-access-denied": "L'hôte bloque l'accès navigateur et le stockage local est aussi indisponible : redémarrez l'hôte puis réessayez ({error})",
				"panel.contentErr.drs-http-unreachable": "Route DRS injoignable : vérifiez que dsh-reference-session-collector est activé ({error})",
				"panel.contentErr.drs-http-error": "DRS a renvoyé une erreur : {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector n'est pas activé en tant que plugin (route 404) : exécutez dsh plugin --profile <name> add dsh-reference-session-collector puis redémarrez l'hôte ({error})",
				"panel.contentErr.drs-missing": "Dépendance absente : réinstallez ce plugin (dsh-reference-session-collector est fourni) ({error})",
				"panel.contentErr.drs-empty": "Base de projection absente : redémarrez l'hôte et attendez la première synchro ({error})",
				"panel.contentErr.drs-schema-mismatch": "Schéma de la base de projection incompatible : mettez à jour dsh-reference-session-collector (la base n'est jamais vidée) ({error})",
				"card.title": "Index de recherche",
				"card.description": "Recherche de sessions dans la barre latérale avec bascule titre/contenu. La recherche de contenu utilise l'index indépendant du plugin et ne dépend jamais de l'index full-text officiel DSH.",
				"card.unavailable": "Espace de noms des paramètres indisponible : vérifiez que le plugin est assemblé dans le profil.",
				"card.readonly": "Lecture seule",
				"card.enabled": "Activer la recherche de sessions",
				"card.enabled.desc": "Afficher l'entrée « Recherche » en bas de la barre latérale.",
				"card.defaultMode": "Mode de recherche par défaut",
				"card.defaultMode.desc": "Mode d'ouverture du panneau.",
				"card.rememberQuery": "Conserver l'historique",
				"card.rememberQuery.desc": "Restaure les derniers mots-clés, filtres et la position de défilement à la réouverture (valable 12 heures). Rien n'est enregistré lorsque cette option est désactivée.",
				"card.mode.title": "Titre",
				"card.mode.content": "Contenu",
				"card.autoSync": "Synchronisation automatique de l'index",
				"card.autoSync.desc": "Synchronisation incrémentale des journaux de session vers l'index indépendant en arrière-plan.",
				"card.syncInterval": "Intervalle de synchronisation (secondes)",
				"card.syncInterval.desc": "Intervalle minimum entre deux synchronisations incrémentales.",
				"card.archiveKeep": "Archives à conserver",
				"card.archiveKeep.desc": "Nombre de fichiers d'index archivés conservés à chaque reconstruction.",
				"card.index": "Index de recherche de contenu",
				"card.index.desc": "Index prêt : {indexed} sessions collectées.",
				"card.index.archives": ", {archives} archive(s).",
				"card.index.empty": "Index indépendant pas encore construit. Cliquez sur « Reconstruire l'index » pour le créer à partir des journaux de session.",
				"card.index.reading": "Lecture de l'état de l'index…",
				"card.index.rebuilding": "Reconstruction de l'index… {done}/{total} (l'ancien index reste actif pendant la reconstruction)",
				"card.index.syncing": "Synchronisation de l'index…",
				"card.index.failures": "{count} session(s) en échec de synchronisation (voir les journaux Host).",
				"card.index.rebuildError": "Échec de la reconstruction : {error}",
				"card.index.rebuild": "Reconstruire l'index",
				"card.index.rebuilding.btn": "Reconstruction…",
				"card.index.rebuild.hint": "Non destructif : l'ancien index reste actif pendant la construction ; l'échange est atomique et l'ancien index est archivé.",
				"card.index.archivedOwner": "La consultation et la suppression des sessions archivées relèvent de dsh-session-steward. Ce plugin lit uniquement l'ensemble archivé et exclut ces sessions de l'index.",
				"card.index.archivedMissing": "La consultation et la suppression des sessions archivées nécessitent dsh-session-steward, qui n'est pas installé. Ce plugin lit uniquement l'ensemble archivé et exclut ces sessions de l'index.",
				"card.index.export": "Exporter l'instantané",
				"card.index.import": "Importer l'instantané",
				"card.index.exported": "Instantané téléchargé.",
				"card.index.import.started": "Import démarré : l'index se reconstruit en arrière-plan et bascule une fois terminé.",
				"card.index.importParse": "Échec de l'analyse de l'instantané ou aucune session valide.",
				"card.action.failed": "Échec de l'opération : {error}",
				"panel.titleSearch": "Titre",
				"panel.contentSearch": "Contenu",
				"panel.searchTitle": "Rechercher dans les titres…",
				"panel.searchContent": "Rechercher dans le contenu…",
				"panel.entry": "Recherche",
				"panel.history.clear": "Effacer",
				"panel.history.clear.hint": "Supprime la scène de recherche enregistrée et repart d'une recherche vide.",
				"panel.buildIndex": "Construire l'index",
				"panel.archived": "{count} session(s) archivée(s) exclue(s)",
				"panel.rebuilding": "Reconstruction de l'index… {done}/{total} (l'ancien index reste actif)",
				"panel.unavailable": "Service d'index indépendant indisponible : Host non initialisé.",
				"panel.notBuilt": "Index indépendant pas encore construit : construisez-le pour activer la recherche de contenu (aucun index FTS officiel requis).",
				"panel.loadingSessions": "Chargement des sessions…",
				"panel.sessionsError": "Échec du chargement des sessions : {error}",
				"panel.noSessions": "Aucune session",
				"panel.noMatch": "Aucune session correspondante.",
				"panel.loadingContent": "Recherche dans le contenu…",
				"panel.contentError": "Échec de la recherche de contenu : {error}",
				"panel.noContent": "Aucun contenu correspondant.",
				"panel.contentHint": "Saisissez des mots-clés pour rechercher dans le contenu.",
				"panel.noText": "(pas de texte)",
				"panel.delete": "Supprimer",
				"panel.delete.confirm": "Confirmer la suppression",
				"panel.delete.hint": "Supprimer cette session (irréversible, même pipeline que la gestion)",
				"panel.delete.done": "{n} session(s) supprimée(s)",
				"panel.delete.failed": "Échec de suppression : {error}",
				"panel.untitled": "(sans titre)",
				"panel.openSession": "Ouvrir la session",
				"panel.footer.invoke": "Ouvrir",
				"panel.footer.close": "Fermer",
				"filter.all": "Tout",
				"filter.user": "Utilisateur",
				"filter.reply": "Réponse",
				"filter.tool": "Outil",
				"sort.label": "Ordre des résultats",
				"sort.relevance": "Pertinence",
				"sort.time": "Temps",
				"sort.relevance.hint": "Trier par force de correspondance (par défaut).",
				"sort.time.hint": "Trier par dernière activité, plus récent d'abord ; à égalité, par force de correspondance.",
				"group.merge": "Fusionner",
				"group.expand": "Détailler",
				"group.merge.hint": "Une seule correspondance la plus forte par session (par défaut).",
				"group.expand.hint": "Afficher chaque correspondance de la session sur sa propre ligne (chacune est une cible de saut).",
				"type.user/message": "Utilisateur",
				"type.assistant/message": "Réponse",
				"type.tool/call": "Appel d'outil",
				"type.tool/result": "Résultat d'outil",
				"panel.deepSync": "Synchronisation approfondie",
				"panel.deepSync.hint": "Demandez à drsc une réanalyse lente pour réparer la bibliothèque de projection, puis reconstruisez l'index local (localisation en échec ou nouvelles sessions introuvables).",
				"panel.deepSync.drs": "Synchronisation drsc…",
				"panel.deepSync.rebuild": "Reconstruction de l'index…",
				"panel.deepSync.done": "Synchronisation terminée",
				"panel.deepSync.failed": "Échec de la synchronisation",
				"panel.deepSync.failedReason": "Échec de la synchronisation approfondie : {error}",
				"panel.deepSync.retry": "Réessayer",
				"panel.doctor": "Diagnostic",
				"panel.doctor.hint": "Compose le registre des échecs et l'état des sondes en un rapport collable avec des commandes exécutables, puis le copie. Le registre est vidé après la copie.",
				"panel.doctor.copied": "Rapport de diagnostic copié — collez-le directement dans l'issue.",
				"panel.doctor.failed": "Échec de génération du rapport de diagnostic : {error}",
				"panel.doctor.copyFailed": "Rapport généré mais copie impossible ({error}) ; il a été affiché dans la console du navigateur.",
				"panel.sessionsError.bare": "Échec du chargement de la liste des sessions",
				"panel.searchFailed": "Échec de la recherche",
				"panel.unknownError": "Erreur inconnue",
				"panel.indexUnreachable": "État de l'index inaccessible : la moitié Host est probablement un processus obsolète. Redémarrez complètement dsh web (un rafraîchissement du navigateur ne recharge pas le Host) puis réessayez.",
				"panel.locate.pending": "Recherche de la ligne correspondante…",
				"panel.locate.ok": "Allé à la ligne correspondante",
				"panel.locate.miss": "Impossible de localiser (ligne non rendue / texte fractionné / délai dépassé)",
				"card.indexStatus.requestFailed": "Échec de la requête index-status",
				"card.indexStatus.readFailed": "Échec de la lecture du statut",
				"card.indexStatus.readFailedHint": "Échec de la lecture du statut de l'index : {error}. Redémarrez complètement dsh web (un rafraîchissement du navigateur ne recharge pas la moitié Host) puis réessayez.",
				"card.indexStatus.retry": "Réessayer le statut",
				"err.requestFailed": "Échec de la requête",
				"err.timeout": "Délai de requête dépassé",
				"err.settingsUnwritable": "Pont de réglages non inscriptible (describe non prêt ou hôte en lecture seule)",
				"err.settingsWriteFailed": "Échec de l’écriture des réglages",
				"panel.index.count": "Index {n}",
				"panel.index.none": "Index non construit",
				"panel.index.rebuilding": "Reconstruction {done}/{total}",
				"domain.all": "Tout",
				"tag.archived": "Archivé",
				"date.from": "Date de début",
				"date.to": "Date de fin",
				"hud.progress": "Récupération de l'historique antérieur… {pulled}/{budget}",
				"hud.done": "Historique chargé",
				"hud.jump": "Atteindre",
				"hud.fail": "La récupération n'a pas trouvé la cible",
				"hud.retry": "Réessayer (budget de pages supplémentaire)",
				"hud.close": "Fermer",
				"cold.badge.hint": "Données froides : la cible est hors de l'index du rail de messages (>40 tours) ; le clic nécessite une récupération",
				"cold.confirm.body": "La cible se trouve ~{gap} tours avant la plus récente, hors de l'index du rail. Une récupération paginée est nécessaire (~{pages} pages). Confirmez pour charger au mieux et atteindre la cible.",
				"cold.confirm.ok": "Charger et atteindre",
				"cold.confirm.cancel": "Annuler",
				"toocold.badge.hint": "Données très froides : la cible dépasse la plage de récupération sûre (>200 tours) ; pas de pagination automatique",
				"toocold.hint": "La session est ouverte, mais la cible dépasse la plage de récupération sûre (>200 tours). Paginez manuellement vers le haut.",
				"card.deepSync.btn": "Synchronisation approfondie (drsc)",
				"card.deepSync.hint": "Relancez d’abord drsc en analyse lente pour réparer la base de projection, puis reconstruisez l’index local.",
				"card.deepSync.drs": "Synchronisation drsc…",
				"card.deepSync.rebuilding": "Reconstruction de l’index…",
				"card.corpusSource": "Source du corpus",
				"card.corpusSource.desc": "Le corpus de la recherche de contenu vient de la base de projection DRS ; native ne garde que les métadonnées de titre/en-tête.",
				"card.mode.drs": "Projection DRS",
				"card.mode.native": "Service de session local",
				"card.drsBaseUrl": "URL de base DRS",
				"card.drsBaseUrl.desc": "Vide = automatique (première entrée trustedHosts, sinon http://127.0.0.1:8080).",
				"card.drsStatus.up": "Recherche de contenu disponible.",
				"card.drsStatus.down": "Recherche de contenu indisponible : {reason}",
				"card.drsStatus.reading": "Détection de DRS…",
				"panel.manage": "Gérer",
				"domain.active": "Actif",
				"domain.archived": "Archivé",
				"manage.hint": "Regroupé par espace de travail ; cochez puis agissez en lot. La suppression est irréversible.",
				"manage.restartHint": "Priorité aux API en mémoire de l’hôte (archivage/désarchivage instantané en 0.1.7+) ; à défaut, écriture directe des fichiers, effective dans la barre latérale après redémarrage.",
				"manage.done.restart": "Redémarrez DSH pour que la barre latérale le reflète entièrement.",
				"manage.group.nocwd": "(sans espace de travail)",
				"manage.selectGroup": "Tout cocher/décocher le groupe",
				"manage.selected": "{n} sélectionné(s)",
				"manage.batch.archive": "Archiver",
				"manage.batch.unarchive": "Désarchiver",
				"manage.batch.delete": "Supprimer",
				"manage.batch.confirm": "Confirmer la suppression",
				"manage.batch.working": "En cours…",
				"manage.done.archive": "{n} session(s) archivée(s).",
				"manage.done.unarchive": "{n} session(s) désarchivée(s).",
				"manage.done.purge": "{n} session(s) purgée(s).",
				"manage.done.error": "Échec de l’opération : {error}",
				"panel.index.rebuild": "Reconstruire",
				"filter.favorites": "Favoris",
				"star.on": "Retirer des favoris",
				"star.off": "Ajouter aux favoris",
				"workspace.label": "Espace de travail",
				"workspace.more": "{n} de plus",
				"workspace.less": "Réduire",
				"manage.search": "Rechercher des sessions…",
				"group.collapse": "Réduire/développer le groupe",
				"group.expandAll": "Tout développer",
				"group.collapseAll": "Tout réduire"
			},
			de: {
				"card.contentTransport": "DRS-Transport",
				"card.contentTransport.desc": "auto = zuerst HTTP, dann der prozessinterne Nur-Lese-Store (empfohlen); http = nur HTTP; in-process = nur der prozessinterne Store (Desktop).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "prozessintern",
				"card.drsStatus.mode": "Aktiver Kanal: {mode}",
				"card.drsReason.browser-access-denied": "Der Host blockiert lokale Zugriffe von Nicht-Renderer-Prozessen",
				"card.drsReason.drs-http-unreachable": "DRS-Route nicht erreichbar (Port geschlossen oder abgelehnt)",
				"card.drsReason.drs-http-error": "DRS hat einen Fehler zurückgegeben",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector ist als Plugin nicht aktiviert (Route 404): dsh plugin --profile <name> add dsh-reference-session-collector ausführen und den Host neu starten",
				"card.drsReason.drs-missing": "Abhängigkeit fehlt im Paket: Plugin neu installieren (die Abhängigkeit wird mitgeliefert)",
				"card.drsReason.drs-empty": "Projektionsdatenbank noch nicht aufgebaut: Host neu starten und ersten Sync abwarten",
				"card.drsReason.drs-schema-mismatch": "Schema der Projektionsdatenbank passt nicht: dsh-reference-session-collector aktualisieren",
				"card.drsStatus.inactive": "Abhängiges Plugin nicht aktiviert: dsh plugin --profile <name> add dsh-reference-session-collector ausführen und Host neu starten (derzeit prozessinterner Nur-Lese-Store; Projektionsdaten werden nicht aktualisiert)",
				"panel.contentErr.browser-access-denied": "Der Host blockiert Browserzugriff und der prozessinterne Store ist ebenfalls nicht verfügbar: Host neu starten und erneut versuchen ({error})",
				"panel.contentErr.drs-http-unreachable": "DRS-Route nicht erreichbar: prüfen, ob dsh-reference-session-collector aktiv ist ({error})",
				"panel.contentErr.drs-http-error": "DRS hat einen Fehler zurückgegeben: {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector ist als Plugin nicht aktiviert (Route 404): dsh plugin --profile <name> add dsh-reference-session-collector ausführen und den Host neu starten ({error})",
				"panel.contentErr.drs-missing": "Abhängigkeit fehlt: Plugin neu installieren (dsh-reference-session-collector wird mitgeliefert) ({error})",
				"panel.contentErr.drs-empty": "Projektionsdatenbank noch nicht aufgebaut: Host neu starten und ersten Sync abwarten ({error})",
				"panel.contentErr.drs-schema-mismatch": "Schema der Projektionsdatenbank passt nicht: dsh-reference-session-collector aktualisieren (die DB wird nie geleert) ({error})",
				"card.title": "Suchindex",
				"card.description": "Sidebar-Sitzungssuche mit Titel-/Inhaltsmodus-Umschaltung. Die Inhaltssuche verwendet den plugin-eigenen Index und hängt nie vom offiziellen DSH-Volltextindex ab.",
				"card.unavailable": "Einstellungs-Namensraum nicht verfügbar: Stellen Sie sicher, dass das Plugin im Profil zusammengestellt ist.",
				"card.readonly": "Schreibgeschützt",
				"card.enabled": "Sitzungssuche aktivieren",
				"card.enabled.desc": "Den „Suche\"-Eintrag am unteren Rand der Sidebar anzeigen.",
				"card.defaultMode": "Standardsuchmodus",
				"card.defaultMode.desc": "In welchem Modus das Panel geöffnet wird.",
				"card.rememberQuery": "Suchverlauf behalten",
				"card.rememberQuery.desc": "Stellt beim erneuten Öffnen die letzten Suchbegriffe, Filter und die Scrollposition wieder her (12 Stunden gültig). Bei ausgeschalteter Option wird nichts gespeichert.",
				"card.mode.title": "Titel",
				"card.mode.content": "Inhalt",
				"card.autoSync": "Index automatisch synchronisieren",
				"card.autoSync.desc": "Sitzungsprotokolle inkrementell in den unabhängigen Index im Hintergrund synchronisieren.",
				"card.syncInterval": "Synchronisierungsintervall (Sekunden)",
				"card.syncInterval.desc": "Mindestintervall zwischen zwei inkrementellen Synchronisierungen.",
				"card.archiveKeep": "Aufzubewahrende Archive",
				"card.archiveKeep.desc": "Anzahl der archivierten Indexdateien, die jeder Neuaufbau beibehält.",
				"card.index": "Inhaltssuchindex",
				"card.index.desc": "Index bereit: {indexed} Sitzungen erfasst.",
				"card.index.archives": ", {archives} Archiv(e).",
				"card.index.empty": "Unabhängiger Index noch nicht aufgebaut. Klicken Sie auf „Index neu aufbauen\", um ihn aus Sitzungsprotokollen zu erstellen.",
				"card.index.reading": "Indexstatus wird gelesen…",
				"card.index.rebuilding": "Index wird neu aufgebaut… {done}/{total} (der alte Index bleibt während des Neuaufbaus aktiv)",
				"card.index.syncing": "Index wird synchronisiert…",
				"card.index.failures": "{count} Sitzung(en) konnten nicht synchronisiert werden (siehe Host-Protokolle).",
				"card.index.rebuildError": "Neuaufbau fehlgeschlagen: {error}",
				"card.index.rebuild": "Index neu aufbauen",
				"card.index.rebuilding.btn": "Wird aufgebaut…",
				"card.index.rebuild.hint": "Zerstörungsfrei: Der alte Index bleibt aktiv, während der Schatten-Index aufgebaut wird; der Tausch erfolgt atomar und der alte Index wird archiviert.",
				"card.index.archivedOwner": "Das Durchsuchen und Entsorgen archivierter Sitzungen gehört zu dsh-session-steward. Dieses Plugin liest nur das Archiv-Set und schließt diese Sitzungen aus dem Index aus.",
				"card.index.archivedMissing": "Das Durchsuchen und Entsorgen archivierter Sitzungen erfordert dsh-session-steward, das nicht installiert ist. Dieses Plugin liest nur das Archiv-Set und schließt diese Sitzungen aus dem Index aus.",
				"card.index.export": "Snapshot exportieren",
				"card.index.import": "Snapshot importieren",
				"card.index.exported": "Snapshot heruntergeladen.",
				"card.index.import.started": "Import gestartet: Der Index wird im Hintergrund neu aufgebaut und nach Fertigstellung atomar ausgetauscht.",
				"card.index.importParse": "Snapshot-Analyse fehlgeschlagen oder enthält keine gültige Sitzung.",
				"card.action.failed": "Aktion fehlgeschlagen: {error}",
				"panel.titleSearch": "Titel",
				"panel.contentSearch": "Inhalt",
				"panel.searchTitle": "Sitzungstitel durchsuchen…",
				"panel.searchContent": "Sitzungsinhalt durchsuchen…",
				"panel.entry": "Suche",
				"panel.history.clear": "Zurücksetzen",
				"panel.history.clear.hint": "Verwirft die gespeicherte Suchsituation und startet mit einer leeren Suche.",
				"panel.buildIndex": "Index aufbauen",
				"panel.archived": "{count} archivierte Sitzung(en) ausgeschlossen",
				"panel.rebuilding": "Index wird neu aufgebaut… {done}/{total} (der alte Index bleibt aktiv)",
				"panel.unavailable": "Unabhängiger Indexdienst nicht verfügbar: Host nicht initialisiert.",
				"panel.notBuilt": "Unabhängiger Index noch nicht aufgebaut: Bauen Sie ihn auf, um die Inhaltssuche zu aktivieren (kein offizieller FTS-Index erforderlich).",
				"panel.loadingSessions": "Sitzungen werden geladen…",
				"panel.sessionsError": "Sitzungen konnten nicht geladen werden: {error}",
				"panel.noSessions": "Keine Sitzungen",
				"panel.noMatch": "Keine passenden Sitzungen.",
				"panel.loadingContent": "Inhalt wird durchsucht…",
				"panel.contentError": "Inhaltssuche fehlgeschlagen: {error}",
				"panel.noContent": "Kein passender Inhalt.",
				"panel.contentHint": "Geben Sie Stichwörter ein, um Inhalte zu durchsuchen.",
				"panel.noText": "(kein Text)",
				"panel.delete": "Löschen",
				"panel.delete.confirm": "Löschen bestätigen",
				"panel.delete.hint": "Diese Sitzung löschen (unwiderruflich, gleiche Pipeline wie die Verwaltung)",
				"panel.delete.done": "{n} Sitzung(en) gelöscht",
				"panel.delete.failed": "Löschen fehlgeschlagen: {error}",
				"panel.untitled": "(unbenannt)",
				"panel.openSession": "Sitzung öffnen",
				"panel.footer.invoke": "Öffnen",
				"panel.footer.close": "Schließen",
				"filter.all": "Alle",
				"filter.user": "Benutzer",
				"filter.reply": "Antwort",
				"filter.tool": "Werkzeug",
				"sort.label": "Ergebnissortierung",
				"sort.relevance": "Relevanz",
				"sort.time": "Zeit",
				"sort.relevance.hint": "Nach Übereinstimmungsstärke sortieren (Standard).",
				"sort.time.hint": "Nach letzter Sitzungsaktivität, neueste zuerst; bei Gleichstand nach Übereinstimmungsstärke.",
				"group.merge": "Zusammen",
				"group.expand": "Aufklappen",
				"group.merge.hint": "Nur der stärkste Treffer je Sitzung (Standard).",
				"group.expand.hint": "Jeden Treffer einer Sitzung als eigene Zeile anzeigen (jede Zeile ist ein Sprungziel).",
				"type.user/message": "Benutzer",
				"type.assistant/message": "Antwort",
				"type.tool/call": "Werkzeugaufruf",
				"type.tool/result": "Werkzeugergebnis",
				"panel.deepSync": "Tiefensynchronisierung",
				"panel.deepSync.hint": "drsc zu einem langsamen erneuten Scan auffordern, um die Projektionsbibliothek zu reparieren, dann den lokalen Index neu aufbauen (bei fehlgeschlagener Lokalisierung oder fehlenden neuen Sitzungen).",
				"panel.deepSync.drs": "drsc synchronisiert…",
				"panel.deepSync.rebuild": "Index wird neu aufgebaut…",
				"panel.deepSync.done": "Synchronisierung abgeschlossen",
				"panel.deepSync.failed": "Synchronisierung fehlgeschlagen",
				"panel.deepSync.failedReason": "Tiefensynchronisierung fehlgeschlagen: {error}",
				"panel.deepSync.retry": "Synchronisierung wiederholen",
				"panel.doctor": "Diagnosebericht",
				"panel.doctor.hint": "Fehlerprotokoll und Prüfstatus zu einem einfügbaren Bericht mit ausführbaren Befehlen zusammenstellen und kopieren. Nach dem Kopieren wird das Protokoll geleert.",
				"panel.doctor.copied": "Diagnosebericht kopiert – direkt ins Issue einfügen.",
				"panel.doctor.failed": "Diagnosebericht konnte nicht erstellt werden: {error}",
				"panel.doctor.copyFailed": "Bericht erstellt, aber Kopieren fehlgeschlagen ({error}); in der Browser-Konsole ausgegeben.",
				"panel.sessionsError.bare": "Sitzungsliste konnte nicht geladen werden",
				"panel.searchFailed": "Suche fehlgeschlagen",
				"panel.unknownError": "Unbekannter Fehler",
				"panel.indexUnreachable": "Indexstatus nicht erreichbar: die Host-Hälfte ist wahrscheinlich ein veralteter Prozess. Starten Sie dsh web vollständig neu (ein Browser-Refresh lädt den Host nicht neu) und versuchen Sie es erneut.",
				"panel.locate.pending": "Suche die Trefferzeile…",
				"panel.locate.ok": "Zur Trefferzeile gesprungen",
				"panel.locate.miss": "Konnte nicht lokalisiert werden (Zeile nicht gerendert / Text aufgeteilt / Timeout)",
				"card.indexStatus.requestFailed": "index-status-Anfrage fehlgeschlagen",
				"card.indexStatus.readFailed": "Status konnte nicht gelesen werden",
				"card.indexStatus.readFailedHint": "Indexstatus konnte nicht gelesen werden: {error}. Starten Sie dsh web vollständig neu (ein Browser-Refresh lädt die Host-Hälfte nicht neu) und versuchen Sie es erneut.",
				"card.indexStatus.retry": "Status erneut versuchen",
				"err.requestFailed": "Anforderung fehlgeschlagen",
				"err.timeout": "Zeitüberschreitung der Anforderung",
				"err.settingsUnwritable": "Einstellungs-Bridge nicht beschreibbar (describe nicht bereit oder Host schreibgeschützt)",
				"err.settingsWriteFailed": "Einstellungen konnten nicht geschrieben werden",
				"panel.index.count": "Index {n}",
				"panel.index.none": "Index nicht aufgebaut",
				"panel.index.rebuilding": "Neuaufbau {done}/{total}",
				"domain.all": "Alle",
				"tag.archived": "Archiviert",
				"date.from": "Startdatum",
				"date.to": "Enddatum",
				"hud.progress": "Früheren Verlauf wird nachgeladen… {pulled}/{budget}",
				"hud.done": "Verlauf geladen",
				"hud.jump": "Springen",
				"hud.fail": "Rückladen hat das Ziel nicht gefunden",
				"hud.retry": "Erneut versuchen (zusätzliches Seitenbudget)",
				"hud.close": "Schließen",
				"cold.badge.hint": "Kalte Daten: Ziel liegt außerhalb des Nachrichten-Rail-Index (>40 Turns); Klicken erfordert Rückladen",
				"cold.confirm.body": "Das Ziel liegt ~{gap} Turns vor dem neuesten, außerhalb des Rail-Index. Rückladen mit Seitenwechsel ist nötig (~{pages} Seiten). Nach Bestätigung wird bestmöglich geladen und gesprungen.",
				"cold.confirm.ok": "Laden & springen",
				"cold.confirm.cancel": "Abbrechen",
				"toocold.badge.hint": "Sehr kalte Daten: Ziel überschreitet den sicheren Rückladebereich (>200 Turns); kein automatisches Blättern",
				"toocold.hint": "Sitzung geöffnet, aber das Ziel überschreitet den sicheren Rückladebereich (>200 Turns). Bitte blättern Sie manuell nach oben.",
				"card.deepSync.btn": "Tiefensynchronisierung (drsc)",
				"card.deepSync.hint": "Zuerst drsc langsam neu scannen, um die Projektionsdatenbank zu reparieren, dann den lokalen Index neu aufbauen.",
				"card.deepSync.drs": "drsc wird synchronisiert…",
				"card.deepSync.rebuilding": "Index wird neu aufgebaut…",
				"card.corpusSource": "Korpusquelle",
				"card.corpusSource.desc": "Der Korpus der Inhaltssuche stammt aus der DRS-Projektionsdatenbank; native behält nur Titel-/Kopf-Metadaten.",
				"card.mode.drs": "DRS-Projektion",
				"card.mode.native": "Lokaler Sitzungsdienst",
				"card.drsBaseUrl": "DRS-Basis-URL",
				"card.drsBaseUrl.desc": "Leer = automatisch (erster trustedHosts-Eintrag, sonst http://127.0.0.1:8080).",
				"card.drsStatus.up": "Inhaltssuche verfügbar.",
				"card.drsStatus.down": "Inhaltssuche nicht verfügbar: {reason}",
				"card.drsStatus.reading": "DRS wird geprüft…",
				"panel.manage": "Verwalten",
				"domain.active": "Aktiv",
				"domain.archived": "Archiviert",
				"manage.hint": "Nach Arbeitsbereich gruppiert; ankreuzen und gesammelt bearbeiten. Löschen ist unwiderruflich.",
				"manage.restartHint": "Bevorzugt Host-In-Memory-APIs (0.1.7+ Archivieren/Reaktivieren sofort wirksam); sonst direktes Schreiben der Speicherdateien, wirksam in der Seitenleiste nach Neustart.",
				"manage.done.restart": "DSH neu starten, damit die Seitenleiste dies vollständig zeigt.",
				"manage.group.nocwd": "(kein Arbeitsbereich)",
				"manage.selectGroup": "Ganze Gruppe an-/abwählen",
				"manage.selected": "{n} ausgewählt",
				"manage.batch.archive": "Archivieren",
				"manage.batch.unarchive": "Reaktivieren",
				"manage.batch.delete": "Löschen",
				"manage.batch.confirm": "Löschen bestätigen",
				"manage.batch.working": "Läuft…",
				"manage.done.archive": "{n} Sitzung(en) archiviert.",
				"manage.done.unarchive": "{n} Sitzung(en) reaktiviert.",
				"manage.done.purge": "{n} Sitzung(en) bereinigt.",
				"manage.done.error": "Vorgang fehlgeschlagen: {error}",
				"panel.index.rebuild": "Neu aufbauen",
				"filter.favorites": "Favoriten",
				"star.on": "Aus Favoriten entfernen",
				"star.off": "Zu Favoriten hinzufügen",
				"workspace.label": "Arbeitsbereich",
				"workspace.more": "{n} weitere",
				"workspace.less": "Einklappen",
				"manage.search": "Sitzungen suchen…",
				"group.collapse": "Gruppe ein-/ausklappen",
				"group.expandAll": "Alle ausklappen",
				"group.collapseAll": "Alle einklappen"
			},
			it: {
				"card.contentTransport": "Trasporto DRS",
				"card.contentTransport.desc": "auto = prima HTTP, poi lo store in-process in sola lettura (consigliato); http = solo HTTP; in-process = solo store in-process (desktop).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "in-process",
				"card.drsStatus.mode": "Canale attivo: {mode}",
				"card.drsReason.browser-access-denied": "L'host blocca l'accesso locale dei processi non-renderer",
				"card.drsReason.drs-http-unreachable": "Route DRS irraggiungibile (porta chiusa o rifiutata)",
				"card.drsReason.drs-http-error": "DRS ha restituito un errore",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector non è attivato come plugin (rotta 404): esegui dsh plugin --profile <name> add dsh-reference-session-collector e riavvia l'host",
				"card.drsReason.drs-missing": "Dipendenza assente dal pacchetto: reinstalla il plugin (la dipendenza è inclusa)",
				"card.drsReason.drs-empty": "Database di proiezione non ancora creato: riavvia l'host e attendi la prima sincronizzazione",
				"card.drsReason.drs-schema-mismatch": "Schema del database di proiezione non allineato: aggiorna dsh-reference-session-collector",
				"card.drsStatus.inactive": "Plugin di dipendenza non attivato: esegui dsh plugin --profile <name> add dsh-reference-session-collector e riavvia l'host (attualmente serve dal store in sola lettura; le proiezioni non si aggiornano)",
				"panel.contentErr.browser-access-denied": "L'host blocca l'accesso del browser e lo store in-process non è disponibile: riavvia l'host e riprova ({error})",
				"panel.contentErr.drs-http-unreachable": "Route DRS irraggiungibile: verifica che dsh-reference-session-collector sia attivo ({error})",
				"panel.contentErr.drs-http-error": "DRS ha restituito un errore: {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector non è attivato come plugin (rotta 404): esegui dsh plugin --profile <name> add dsh-reference-session-collector e riavvia l'host ({error})",
				"panel.contentErr.drs-missing": "Dipendenza assente: reinstalla il plugin (dsh-reference-session-collector è incluso) ({error})",
				"panel.contentErr.drs-empty": "Database di proiezione non ancora creato: riavvia l'host e attendi la prima sincronizzazione ({error})",
				"panel.contentErr.drs-schema-mismatch": "Schema del database di proiezione non allineato: aggiorna dsh-reference-session-collector (il DB non viene mai svuotato) ({error})",
				"card.title": "Indice di ricerca",
				"card.description": "Ricerca sessioni nella barra laterale con commutazione titolo/contenuto. La ricerca per contenuto utilizza l'indice indipendente del plugin e non dipende mai dall'indice full-text ufficiale DSH.",
				"card.unavailable": "Namespace delle impostazioni non disponibile: verificare che il plugin sia assemblato nel profilo.",
				"card.readonly": "Sola lettura",
				"card.enabled": "Abilita ricerca sessioni",
				"card.enabled.desc": "Mostra la voce «Ricerca» in fondo alla barra laterale.",
				"card.defaultMode": "Modalità di ricerca predefinita",
				"card.defaultMode.desc": "Modalità di apertura del pannello.",
				"card.rememberQuery": "Mantieni la cronologia",
				"card.rememberQuery.desc": "Ripristina gli ultimi termini, i filtri e la posizione di scorrimento alla riapertura (valido 12 ore). Con l'opzione disattivata non viene salvato nulla.",
				"card.mode.title": "Titolo",
				"card.mode.content": "Contenuto",
				"card.autoSync": "Sincronizzazione automatica indice",
				"card.autoSync.desc": "Sincronizza incrementalmente i log delle sessioni nell'indice indipendente in background.",
				"card.syncInterval": "Intervallo sincronizzazione (secondi)",
				"card.syncInterval.desc": "Intervallo minimo tra due sincronizzazioni incrementali.",
				"card.archiveKeep": "Archivi da conservare",
				"card.archiveKeep.desc": "Numero di file indice archiviati conservati ad ogni ricostruzione.",
				"card.index": "Indice ricerca contenuti",
				"card.index.desc": "Indice pronto: {indexed} sessioni raccolte.",
				"card.index.archives": ", {archives} archivio/i.",
				"card.index.empty": "Indice indipendente non ancora costruito. Fare clic su «Ricostruisci indice» per crearlo dai log delle sessioni.",
				"card.index.reading": "Lettura stato indice…",
				"card.index.rebuilding": "Ricostruzione indice… {done}/{total} (il vecchio indice resta attivo durante la ricostruzione)",
				"card.index.syncing": "Sincronizzazione indice…",
				"card.index.failures": "{count} sessione/i non sincronizzata/e (vedi log Host).",
				"card.index.rebuildError": "Ricostruzione fallita: {error}",
				"card.index.rebuild": "Ricostruisci indice",
				"card.index.rebuilding.btn": "Ricostruzione…",
				"card.index.rebuild.hint": "Non distruttivo: il vecchio indice resta attivo durante la costruzione; lo scambio è atomico e il vecchio indice viene archiviato.",
				"card.index.archivedOwner": "La consultazione e l'eliminazione delle sessioni archiviate spettano a dsh-session-steward. Questo plugin legge solo l'insieme archiviato ed esclude tali sessioni dall'indice.",
				"card.index.archivedMissing": "La consultazione e l'eliminazione delle sessioni archiviate richiedono dsh-session-steward, attualmente non installato. Questo plugin legge solo l'insieme archiviato ed esclude tali sessioni dall'indice.",
				"card.index.export": "Esporta snapshot",
				"card.index.import": "Importa snapshot",
				"card.index.exported": "Snapshot scaricato.",
				"card.index.import.started": "Importazione avviata: l'indice viene ricostruito in background e scambiato al termine.",
				"card.index.importParse": "Analisi snapshot fallita o nessuna sessione valida.",
				"card.action.failed": "Operazione fallita: {error}",
				"panel.titleSearch": "Titolo",
				"panel.contentSearch": "Contenuto",
				"panel.searchTitle": "Cerca nei titoli delle sessioni…",
				"panel.searchContent": "Cerca nel contenuto delle sessioni…",
				"panel.entry": "Ricerca",
				"panel.history.clear": "Azzera",
				"panel.history.clear.hint": "Elimina la ricerca salvata e riparte da una ricerca vuota.",
				"panel.buildIndex": "Costruisci indice",
				"panel.archived": "{count} sessione/i archiviata/e esclusa/e",
				"panel.rebuilding": "Ricostruzione indice… {done}/{total} (il vecchio indice resta attivo)",
				"panel.unavailable": "Servizio indice indipendente non disponibile: Host non inizializzato.",
				"panel.notBuilt": "Indice indipendente non ancora costruito: costruiscilo per abilitare la ricerca per contenuto (nessun indice FTS ufficiale richiesto).",
				"panel.loadingSessions": "Caricamento sessioni…",
				"panel.sessionsError": "Caricamento sessioni fallito: {error}",
				"panel.noSessions": "Nessuna sessione",
				"panel.noMatch": "Nessuna sessione corrispondente.",
				"panel.loadingContent": "Ricerca nel contenuto…",
				"panel.contentError": "Ricerca contenuto fallita: {error}",
				"panel.noContent": "Nessun contenuto corrispondente.",
				"panel.contentHint": "Inserisci parole chiave per cercare nel contenuto.",
				"panel.noText": "(nessun testo)",
				"panel.delete": "Elimina",
				"panel.delete.confirm": "Conferma eliminazione",
				"panel.delete.hint": "Elimina questa sessione (irreversibile, stessa pipeline della gestione)",
				"panel.delete.done": "Eliminate {n} sessione/i",
				"panel.delete.failed": "Eliminazione non riuscita: {error}",
				"panel.untitled": "(senza titolo)",
				"panel.openSession": "Apri sessione",
				"panel.footer.invoke": "Apri",
				"panel.footer.close": "Chiudi",
				"filter.all": "Tutti",
				"filter.user": "Utente",
				"filter.reply": "Risposta",
				"filter.tool": "Strumento",
				"sort.label": "Ordinamento risultati",
				"sort.relevance": "Pertinenza",
				"sort.time": "Tempo",
				"sort.relevance.hint": "Ordina per forza di corrispondenza (predefinito).",
				"sort.time.hint": "Ordina per ultima attività, più recente prima; a parità, per forza di corrispondenza.",
				"group.merge": "Unisci",
				"group.expand": "Espandi",
				"group.merge.hint": "Mostra solo il risultato più forte per sessione (predefinito).",
				"group.expand.hint": "Mostra ogni corrispondenza della sessione su riga propria (ogni riga è una destinazione).",
				"type.user/message": "Utente",
				"type.assistant/message": "Risposta",
				"type.tool/call": "Chiamata strumento",
				"type.tool/result": "Risultato strumento",
				"panel.deepSync": "Sincronizzazione profonda",
				"panel.deepSync.hint": "Chiedi a drsc una nuova scansione lenta per riparare la libreria di proiezione, poi ricostruisci l'indice locale (per localizzazione non riuscita o nuove sessioni mancanti).",
				"panel.deepSync.drs": "Sincronizzazione drsc…",
				"panel.deepSync.rebuild": "Ricostruzione dell'indice…",
				"panel.deepSync.done": "Sincronizzazione completata",
				"panel.deepSync.failed": "Sincronizzazione non riuscita",
				"panel.deepSync.failedReason": "Sincronizzazione profonda non riuscita: {error}",
				"panel.deepSync.retry": "Riprova sincronizzazione",
				"panel.doctor": "Diagnostica",
				"panel.doctor.hint": "Compone il registro degli errori e lo stato delle sonde in un report incollabile con comandi eseguibili, poi lo copia. Il registro viene svuotato dopo la copia.",
				"panel.doctor.copied": "Report di diagnostica copiato: incollalo direttamente nell'issue.",
				"panel.doctor.failed": "Impossibile generare il report di diagnostica: {error}",
				"panel.doctor.copyFailed": "Report generato ma copia non riuscita ({error}); è stato stampato nella console del browser.",
				"panel.sessionsError.bare": "Caricamento dell'elenco delle sessioni non riuscito",
				"panel.searchFailed": "Ricerca non riuscita",
				"panel.unknownError": "Errore sconosciuto",
				"panel.indexUnreachable": "Stato dell'indice irraggiungibile: la metà Host è probabilmente un processo obsoleto. Riavvia completamente dsh web (un refresh del browser non ricarica l'Host) e riprova.",
				"panel.locate.pending": "Ricerca della riga corrispondente…",
				"panel.locate.ok": "Passato alla riga corrispondente",
				"panel.locate.miss": "Impossibile localizzare (riga non renderizzata / testo diviso / timeout)",
				"card.indexStatus.requestFailed": "Richiesta index-status non riuscita",
				"card.indexStatus.readFailed": "Lettura dello stato non riuscita",
				"card.indexStatus.readFailedHint": "Lettura dello stato dell'indice non riuscita: {error}. Riavvia completamente dsh web (un refresh del browser non ricarica la metà Host) e riprova.",
				"card.indexStatus.retry": "Riprova stato",
				"err.requestFailed": "Richiesta non riuscita",
				"err.timeout": "Richiesta scaduta",
				"err.settingsUnwritable": "Bridge delle impostazioni non scrivibile (describe non pronto o host in sola lettura)",
				"err.settingsWriteFailed": "Scrittura impostazioni non riuscita",
				"panel.index.count": "Indice {n}",
				"panel.index.none": "Indice non creato",
				"panel.index.rebuilding": "Ricostruzione {done}/{total}",
				"domain.all": "Tutti",
				"tag.archived": "Archiviato",
				"date.from": "Data di inizio",
				"date.to": "Data di fine",
				"hud.progress": "Caricamento della cronologia precedente… {pulled}/{budget}",
				"hud.done": "Cronologia caricata",
				"hud.jump": "Salta",
				"hud.fail": "Il caricamento all'indietro non ha trovato l'obiettivo",
				"hud.retry": "Riprova (budget pagine extra)",
				"hud.close": "Chiudi",
				"cold.badge.hint": "Dati freddi: l'obiettivo è oltre l'indice della rail dei messaggi (>40 turni); il clic richiede il caricamento all'indietro",
				"cold.confirm.body": "L'obiettivo è ~{gap} turni prima del più recente, oltre l'indice della rail. Serve il caricamento paginato all'indietro (~{pages} pagine). Conferma per caricare al meglio e saltare.",
				"cold.confirm.ok": "Carica e salta",
				"cold.confirm.cancel": "Annulla",
				"toocold.badge.hint": "Dati molto freddi: l'obiettivo supera l'intervallo sicuro di retrocaricamento (>200 turni); nessun paging automatico",
				"toocold.hint": "Sessione aperta, ma l'obiettivo supera l'intervallo sicuro di retrocaricamento (>200 turni). Scorrere manualmente verso l'alto.",
				"card.deepSync.btn": "Sincronizzazione profonda (drsc)",
				"card.deepSync.hint": "Prima riesegui drsc in scansione lenta per riparare il database di proiezione, poi ricostruisci l’indice locale.",
				"card.deepSync.drs": "Sincronizzazione drsc…",
				"card.deepSync.rebuilding": "Ricostruzione indice…",
				"card.corpusSource": "Origine del corpus",
				"card.corpusSource.desc": "Il corpus della ricerca contenuti proviene dal database di proiezione DRS; native conserva solo i metadati di titolo/intestazione.",
				"card.mode.drs": "Proiezione DRS",
				"card.mode.native": "Servizio di sessione locale",
				"card.drsBaseUrl": "URL di base DRS",
				"card.drsBaseUrl.desc": "Vuoto = automatico (prima voce trustedHosts, altrimenti http://127.0.0.1:8080).",
				"card.drsStatus.up": "Ricerca contenuti disponibile.",
				"card.drsStatus.down": "Ricerca contenuti non disponibile: {reason}",
				"card.drsStatus.reading": "Rilevamento DRS…",
				"panel.manage": "Gestisci",
				"domain.active": "Attivo",
				"domain.archived": "Archiviato",
				"manage.hint": "Raggruppato per workspace; seleziona e applica in blocco. L’eliminazione è irreversibile.",
				"manage.restartHint": "Privilegia le API in memoria dell’host (archiviazione/ripristino immediati in 0.1.7+); altrimenti scrive direttamente i file, efficace nella barra laterale dopo il riavvio.",
				"manage.done.restart": "Riavvia DSH perché la barra laterale lo rifletta del tutto.",
				"manage.group.nocwd": "(nessun workspace)",
				"manage.selectGroup": "Seleziona/deseleziona il gruppo",
				"manage.selected": "{n} selezionati",
				"manage.batch.archive": "Archivia",
				"manage.batch.unarchive": "Ripristina",
				"manage.batch.delete": "Elimina",
				"manage.batch.confirm": "Conferma eliminazione",
				"manage.batch.working": "In corso…",
				"manage.done.archive": "{n} sessioni archiviate.",
				"manage.done.unarchive": "{n} sessioni ripristinate.",
				"manage.done.purge": "{n} sessioni eliminate.",
				"manage.done.error": "Operazione non riuscita: {error}",
				"panel.index.rebuild": "Ricostruisci",
				"filter.favorites": "Preferiti",
				"star.on": "Rimuovi dai preferiti",
				"star.off": "Aggiungi ai preferiti",
				"workspace.label": "Workspace",
				"workspace.more": "altri {n}",
				"workspace.less": "Comprimi",
				"manage.search": "Cerca sessioni…",
				"group.collapse": "Comprimi/espandi il gruppo",
				"group.expandAll": "Espandi tutto",
				"group.collapseAll": "Comprimi tutto"
			},
			ru: {
				"card.contentTransport": "Транспорт DRS",
				"card.contentTransport.desc": "auto = сначала HTTP, затем внутрипроцессное хранилище только для чтения (рекомендуется); http = только HTTP; in-process = только внутрипроцессное хранилище (десктоп).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "в процессе",
				"card.drsStatus.mode": "Активный канал: {mode}",
				"card.drsReason.browser-access-denied": "Хост блокирует локальный доступ для процессов, отличных от рендерера",
				"card.drsReason.drs-http-unreachable": "Маршрут DRS недоступен (порт закрыт или соединение отклонено)",
				"card.drsReason.drs-http-error": "DRS вернул ошибку",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector не активирован как плагин (маршрут 404): выполните dsh plugin --profile <name> add dsh-reference-session-collector и перезапустите хост",
				"card.drsReason.drs-missing": "Зависимость отсутствует в пакете: переустановите плагин (зависимость поставляется вместе с ним)",
				"card.drsReason.drs-empty": "База проекций ещё не создана: перезапустите хост и дождитесь первой синхронизации",
				"card.drsReason.drs-schema-mismatch": "Схема базы проекций не совпадает: обновите dsh-reference-session-collector",
				"card.drsStatus.inactive": "Зависимый плагин не активирован: выполните dsh plugin --profile <name> add dsh-reference-session-collector и перезапустите хост (сейчас используется внутрипроцессное хранилище только для чтения; проекции не обновляются)",
				"panel.contentErr.browser-access-denied": "Хост блокирует доступ из браузера, а внутрипроцессное хранилище тоже недоступно: перезапустите хост и повторите ({error})",
				"panel.contentErr.drs-http-unreachable": "Маршрут DRS недоступен: проверьте, что dsh-reference-session-collector включён ({error})",
				"panel.contentErr.drs-http-error": "DRS вернул ошибку: {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector не активирован как плагин (маршрут 404): выполните dsh plugin --profile <name> add dsh-reference-session-collector и перезапустите хост ({error})",
				"panel.contentErr.drs-missing": "Зависимость отсутствует: переустановите плагин (dsh-reference-session-collector поставляется вместе) ({error})",
				"panel.contentErr.drs-empty": "База проекций ещё не создана: перезапустите хост и дождитесь первой синхронизации ({error})",
				"panel.contentErr.drs-schema-mismatch": "Схема базы проекций не совпадает: обновите dsh-reference-session-collector (база никогда не очищается) ({error})",
				"card.title": "Поисковый индекс",
				"card.description": "Поиск сессий в боковой панели с переключением «заголовки/содержимое». Поиск по содержимому использует собственный индекс плагина и не зависит от официального полнотекстового индекса DSH.",
				"card.unavailable": "Пространство имён настроек недоступно: убедитесь, что плагин собран в профиле.",
				"card.readonly": "Только чтение",
				"card.enabled": "Включить поиск сессий",
				"card.enabled.desc": "Показывать пункт «Поиск» в нижней части боковой панели.",
				"card.defaultMode": "Режим поиска по умолчанию",
				"card.defaultMode.desc": "Режим открытия панели.",
				"card.rememberQuery": "Сохранять историю поиска",
				"card.rememberQuery.desc": "При повторном открытии восстанавливает последние запросы, фильтры и позицию прокрутки (действует 12 часов). Пока опция выключена, ничего не сохраняется.",
				"card.mode.title": "Заголовок",
				"card.mode.content": "Содержимое",
				"card.autoSync": "Автосинхронизация индекса",
				"card.autoSync.desc": "Инкрементальная синхронизация журналов сессий в независимый индекс в фоновом режиме.",
				"card.syncInterval": "Интервал синхронизации (сек)",
				"card.syncInterval.desc": "Минимальный интервал между двумя инкрементальными синхронизациями.",
				"card.archiveKeep": "Хранимых архивов",
				"card.archiveKeep.desc": "Сколько архивных файлов индекса сохранять при каждой пересборке.",
				"card.index": "Индекс поиска по содержимому",
				"card.index.desc": "Индекс готов: собрано {indexed} сессий.",
				"card.index.archives": ", архивов: {archives}.",
				"card.index.empty": "Независимый индекс ещё не построен. Нажмите «Пересобрать индекс», чтобы создать его из журналов сессий.",
				"card.index.reading": "Чтение состояния индекса…",
				"card.index.rebuilding": "Пересборка индекса… {done}/{total} (старый индекс остаётся доступным во время пересборки)",
				"card.index.syncing": "Синхронизация индекса…",
				"card.index.failures": "{count} сессий не синхронизировано (см. журналы Host).",
				"card.index.rebuildError": "Пересборка не удалась: {error}",
				"card.index.rebuild": "Пересобрать индекс",
				"card.index.rebuilding.btn": "Пересборка…",
				"card.index.rebuild.hint": "Недеструктивно: старый индекс остаётся доступным, пока строится теневой; замена атомарна, старый индекс архивируется.",
				"card.index.archivedOwner": "Просмотр и удаление архивных сессий — задача dsh-session-steward. Этот плагин только читает набор архива и исключает архивные сессии из индекса.",
				"card.index.archivedMissing": "Для просмотра и удаления архивных сессий требуется dsh-session-steward, который не установлен. Этот плагин только читает набор архива и исключает архивные сессии из индекса.",
				"card.index.export": "Экспорт снимка",
				"card.index.import": "Импорт снимка",
				"card.index.exported": "Снимок скачан.",
				"card.index.import.started": "Импорт начат: индекс пересобирается в фоне и переключается по завершении.",
				"card.index.importParse": "Ошибка разбора снимка или нет допустимых сессий.",
				"card.action.failed": "Действие не выполнено: {error}",
				"panel.titleSearch": "Заголовок",
				"panel.contentSearch": "Содержимое",
				"panel.searchTitle": "Поиск по заголовкам сессий…",
				"panel.searchContent": "Поиск по содержимому сессий…",
				"panel.entry": "Поиск",
				"panel.history.clear": "Очистить",
				"panel.history.clear.hint": "Удаляет сохранённое состояние поиска и возвращает пустой поиск.",
				"panel.buildIndex": "Построить индекс",
				"panel.archived": "Исключено {count} архивных сессий",
				"panel.rebuilding": "Пересборка индекса… {done}/{total} (старый индекс остаётся доступным)",
				"panel.unavailable": "Сервис независимого индекса недоступен: Host не инициализирован.",
				"panel.notBuilt": "Независимый индекс не построен: постройте его, чтобы включить поиск по содержимому (официальный FTS-индекс не требуется).",
				"panel.loadingSessions": "Загрузка сессий…",
				"panel.sessionsError": "Не удалось загрузить сессии: {error}",
				"panel.noSessions": "Нет сессий",
				"panel.noMatch": "Нет подходящих сессий.",
				"panel.loadingContent": "Поиск по содержимому…",
				"panel.contentError": "Поиск по содержимому не удался: {error}",
				"panel.noContent": "Нет подходящего содержимого.",
				"panel.contentHint": "Введите ключевые слова для поиска по содержимому.",
				"panel.noText": "(без текста)",
				"panel.delete": "Удалить",
				"panel.delete.confirm": "Подтвердить удаление",
				"panel.delete.hint": "Удалить эту сессию (необратимо, тот же конвейер, что и в администраторе)",
				"panel.delete.done": "Удалено сессий: {n}",
				"panel.delete.failed": "Ошибка удаления: {error}",
				"panel.untitled": "(без названия)",
				"panel.openSession": "Открыть сессию",
				"panel.footer.invoke": "Открыть",
				"panel.footer.close": "Закрыть",
				"filter.all": "Все",
				"filter.user": "Пользователь",
				"filter.reply": "Ответ",
				"filter.tool": "Инструмент",
				"sort.label": "Сортировка результатов",
				"sort.relevance": "Релевантность",
				"sort.time": "Время",
				"sort.relevance.hint": "Сортировать по силе совпадения (по умолчанию).",
				"sort.time.hint": "Сортировать по последней активности, сначала новые; при равенстве — по силе совпадения.",
				"group.merge": "Объединить",
				"group.expand": "Развернуть",
				"group.merge.hint": "По одному сильнейшему совпадению на сессию (по умолчанию).",
				"group.expand.hint": "Каждое совпадение сессии — отдельной строкой (каждая строка — цель перехода).",
				"type.user/message": "Пользователь",
				"type.assistant/message": "Ответ",
				"type.tool/call": "Вызов инструмента",
				"type.tool/result": "Результат инструмента",
				"panel.deepSync": "Глубокая синхронизация",
				"panel.deepSync.hint": "Попросите drsc выполнить медленное повторное сканирование, чтобы исправить библиотеку проекций, затем пересоберите локальный индекс (если позиционирование не работает или новые сессии не находятся).",
				"panel.deepSync.drs": "Синхронизация drsc…",
				"panel.deepSync.rebuild": "Пересборка индекса…",
				"panel.deepSync.done": "Синхронизация завершена",
				"panel.deepSync.failed": "Синхронизация не удалась",
				"panel.deepSync.failedReason": "Глубокая синхронизация не удалась: {error}",
				"panel.deepSync.retry": "Повторить синхронизацию",
				"panel.doctor": "Диагностика",
				"panel.doctor.hint": "Собрать журнал сбоев и состояние проб в готовый к вставке отчёт с выполнимыми командами и скопировать его. После копирования журнал очищается.",
				"panel.doctor.copied": "Отчёт диагностики скопирован — вставьте его прямо в issue.",
				"panel.doctor.failed": "Не удалось построить отчёт диагностики: {error}",
				"panel.doctor.copyFailed": "Отчёт построен, но копирование не удалось ({error}); он выведен в консоль браузера.",
				"panel.sessionsError.bare": "Не удалось загрузить список сессий",
				"panel.searchFailed": "Поиск не удался",
				"panel.unknownError": "Неизвестная ошибка",
				"panel.indexUnreachable": "Статус индекса недоступен: вероятно, процесс Host устарел. Полностью перезапустите dsh web (обновление браузера не перезагружает Host) и повторите попытку.",
				"panel.locate.pending": "Ищу строку с совпадением…",
				"panel.locate.ok": "Перешёл на строку с совпадением",
				"panel.locate.miss": "Не удалось найти позицию (строка не отрисована / текст разбит / таймаут)",
				"card.indexStatus.requestFailed": "Ошибка запроса index-status",
				"card.indexStatus.readFailed": "Не удалось прочитать статус",
				"card.indexStatus.readFailedHint": "Не удалось прочитать статус индекса: {error}. Полностью перезапустите dsh web (обновление браузера не перезагружает половину Host) и повторите попытку.",
				"card.indexStatus.retry": "Повторить проверку статуса",
				"err.requestFailed": "Запрос не выполнен",
				"err.timeout": "Превышено время ожидания запроса",
				"err.settingsUnwritable": "Мост настроек недоступен для записи (describe не готов или хост только для чтения)",
				"err.settingsWriteFailed": "Не удалось записать настройки",
				"panel.index.count": "Индекс {n}",
				"panel.index.none": "Индекс не построен",
				"panel.index.rebuilding": "Пересборка {done}/{total}",
				"domain.all": "Все",
				"tag.archived": "Архив",
				"date.from": "Дата начала",
				"date.to": "Дата окончания",
				"hud.progress": "Догрузка более ранней истории… {pulled}/{budget}",
				"hud.done": "История загружена",
				"hud.jump": "Перейти",
				"hud.fail": "При догрузке цель не найдена",
				"hud.retry": "Повторить (добавить лимит страниц)",
				"hud.close": "Закрыть",
				"cold.badge.hint": "Холодные данные: цель вне индекса дорожки сообщений (>40 ходов); для перехода нужна догрузка",
				"cold.confirm.body": "Цель примерно на {gap} ходов позади последней, вне индекса дорожки сообщений. Нужна догрузка с перелистыванием (~{pages} стр.). После подтверждения будет выполнена догрузка и переход.",
				"cold.confirm.ok": "Загрузить и перейти",
				"cold.confirm.cancel": "Отмена",
				"toocold.badge.hint": "Очень холодные данные: цель за пределами безопасной догрузки (>200 ходов); автолистания нет",
				"toocold.hint": "Сессия открыта, но цель за пределами безопасной догрузки (>200 ходов). Листайте вверх вручную.",
				"card.deepSync.btn": "Глубокая синхронизация (drsc)",
				"card.deepSync.hint": "Сначала медленно пересканируйте через drsc, чтобы починить базу проекций, затем пересоберите локальный индекс.",
				"card.deepSync.drs": "Синхронизация drsc…",
				"card.deepSync.rebuilding": "Пересборка индекса…",
				"card.corpusSource": "Источник корпуса",
				"card.corpusSource.desc": "Корпус поиска по содержимому берётся из базы проекций DRS; native сохраняет только метаданные заголовка.",
				"card.mode.drs": "Проекция DRS",
				"card.mode.native": "Локальная служба сеансов",
				"card.drsBaseUrl": "Базовый URL DRS",
				"card.drsBaseUrl.desc": "Пусто = автоматически (первая запись trustedHosts, иначе http://127.0.0.1:8080).",
				"card.drsStatus.up": "Поиск по содержимому доступен.",
				"card.drsStatus.down": "Поиск по содержимому недоступен: {reason}",
				"card.drsStatus.reading": "Проверка DRS…",
				"panel.manage": "Управление",
				"domain.active": "Активные",
				"domain.archived": "Архив",
				"manage.hint": "Сгруппировано по рабочему пространству; отметьте и выполните пакетную операцию. Удаление необратимо.",
				"manage.restartHint": "Сначала используются API в памяти хоста (архивация/разархивация мгновенно в 0.1.7+); иначе прямая запись файлов, боковая панель обновится после перезапуска.",
				"manage.done.restart": "Перезапустите DSH, чтобы боковая панель обновилась полностью.",
				"manage.group.nocwd": "(без рабочего пространства)",
				"manage.selectGroup": "Выбрать/снять всю группу",
				"manage.selected": "Выбрано {n}",
				"manage.batch.archive": "Архивировать",
				"manage.batch.unarchive": "Разархивировать",
				"manage.batch.delete": "Удалить",
				"manage.batch.confirm": "Подтвердить удаление",
				"manage.batch.working": "Выполняется…",
				"manage.done.archive": "Архивировано сеансов: {n}.",
				"manage.done.unarchive": "Разархивировано сеансов: {n}.",
				"manage.done.purge": "Очищено сеансов: {n}.",
				"manage.done.error": "Операция не удалась: {error}",
				"panel.index.rebuild": "Пересобрать",
				"filter.favorites": "Избранное",
				"star.on": "Убрать из избранного",
				"star.off": "Добавить в избранное",
				"workspace.label": "Рабочее пространство",
				"workspace.more": "ещё {n}",
				"workspace.less": "Свернуть",
				"manage.search": "Поиск сеансов…",
				"group.collapse": "Свернуть/развернуть группу",
				"group.expandAll": "Развернуть всё",
				"group.collapseAll": "Свернуть всё"
			},
			es: {
				"card.contentTransport": "Transporte DRS",
				"card.contentTransport.desc": "auto = primero HTTP y luego el almacén en proceso de solo lectura (recomendado); http = solo HTTP; in-process = solo almacén en proceso (escritorio).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "en proceso",
				"card.drsStatus.mode": "Canal activo: {mode}",
				"card.drsReason.browser-access-denied": "El host bloquea el acceso local de procesos que no son el renderer",
				"card.drsReason.drs-http-unreachable": "Ruta DRS inalcanzable (puerto cerrado o rechazado)",
				"card.drsReason.drs-http-error": "DRS devolvió un error",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector no está activado como plugin (ruta 404): ejecuta dsh plugin --profile <name> add dsh-reference-session-collector y reinicia el host",
				"card.drsReason.drs-missing": "Falta la dependencia en el paquete: reinstala este plugin (la dependencia viene incluida)",
				"card.drsReason.drs-empty": "La base de proyección aún no existe: reinicia el host y espera la primera sincronización",
				"card.drsReason.drs-schema-mismatch": "El esquema de la base de proyección no coincide: actualiza dsh-reference-session-collector",
				"card.drsStatus.inactive": "Plugin de dependencia no activado: ejecuta dsh plugin --profile <name> add dsh-reference-session-collector y reinicia el host (actualmente se sirve del almacén de solo lectura; las proyecciones no se actualizan)",
				"panel.contentErr.browser-access-denied": "El host bloquea el acceso del navegador y el almacén en proceso tampoco está disponible: reinicia el host y reintenta ({error})",
				"panel.contentErr.drs-http-unreachable": "Ruta DRS inalcanzable: comprueba que dsh-reference-session-collector esté activo ({error})",
				"panel.contentErr.drs-http-error": "DRS devolvió un error: {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector no está activado como plugin (ruta 404): ejecuta dsh plugin --profile <name> add dsh-reference-session-collector y reinicia el host ({error})",
				"panel.contentErr.drs-missing": "Falta la dependencia: reinstala este plugin (dsh-reference-session-collector viene incluido) ({error})",
				"panel.contentErr.drs-empty": "La base de proyección aún no existe: reinicia el host y espera la primera sincronización ({error})",
				"panel.contentErr.drs-schema-mismatch": "El esquema de la base de proyección no coincide: actualiza dsh-reference-session-collector (la base nunca se borra) ({error})",
				"card.title": "Índice de búsqueda",
				"card.description": "Búsqueda de sesiones en la barra lateral con cambio entre título y contenido. La búsqueda de contenido usa el índice propio del plugin y nunca depende del índice de texto completo oficial de DSH.",
				"card.unavailable": "Espacio de nombres de configuración no disponible: verifique que el plugin esté ensamblado en el perfil.",
				"card.readonly": "Solo lectura",
				"card.enabled": "Habilitar búsqueda de sesiones",
				"card.enabled.desc": "Mostrar la entrada «Buscar» en la parte inferior de la barra lateral.",
				"card.defaultMode": "Modo de búsqueda predeterminado",
				"card.defaultMode.desc": "Modo en que se abre el panel.",
				"card.rememberQuery": "Recordar el historial",
				"card.rememberQuery.desc": "Restaura los últimos términos, filtros y la posición de desplazamiento al reabrir (válido 12 horas). Con la opción desactivada no se guarda nada.",
				"card.mode.title": "Título",
				"card.mode.content": "Contenido",
				"card.autoSync": "Sincronización automática del índice",
				"card.autoSync.desc": "Sincroniza incrementalmente los registros de sesión al índice independiente en segundo plano.",
				"card.syncInterval": "Intervalo de sincronización (segundos)",
				"card.syncInterval.desc": "Intervalo mínimo entre dos sincronizaciones incrementales.",
				"card.archiveKeep": "Archivos a conservar",
				"card.archiveKeep.desc": "Cuántos archivos de índice archivados se conservan en cada reconstrucción.",
				"card.index": "Índice de búsqueda de contenido",
				"card.index.desc": "Índice listo: {indexed} sesiones recopiladas.",
				"card.index.archives": ", {archives} archivo(s) de respaldo.",
				"card.index.empty": "El índice independiente aún no está construido. Haga clic en «Reconstruir índice» para crearlo desde los registros de sesión.",
				"card.index.reading": "Leyendo estado del índice…",
				"card.index.rebuilding": "Reconstruyendo índice… {done}/{total} (el índice anterior sigue activo durante la reconstrucción)",
				"card.index.syncing": "Sincronizando índice…",
				"card.index.failures": "{count} sesión(es) fallaron al sincronizar (ver registros del Host).",
				"card.index.rebuildError": "Reconstrucción fallida: {error}",
				"card.index.rebuild": "Reconstruir índice",
				"card.index.rebuilding.btn": "Reconstruyendo…",
				"card.index.rebuild.hint": "No destructivo: el índice anterior sigue activo mientras se construye el nuevo; el intercambio es atómico y el índice anterior se archiva.",
				"card.index.archivedOwner": "La consulta y eliminación de sesiones archivadas corresponde a dsh-session-steward. Este plugin solo lee el conjunto archivado y excluye esas sesiones del índice.",
				"card.index.archivedMissing": "La consulta y eliminación de sesiones archivadas requiere dsh-session-steward, que no está instalado. Este plugin solo lee el conjunto archivado y excluye esas sesiones del índice.",
				"card.index.export": "Exportar instantánea",
				"card.index.import": "Importar instantánea",
				"card.index.exported": "Instantánea descargada.",
				"card.index.import.started": "Importación iniciada: el índice se reconstruye en segundo plano y se intercambia al finalizar.",
				"card.index.importParse": "Error al analizar la instantánea o sin sesiones válidas.",
				"card.action.failed": "Acción fallida: {error}",
				"panel.titleSearch": "Título",
				"panel.contentSearch": "Contenido",
				"panel.searchTitle": "Buscar títulos de sesión…",
				"panel.searchContent": "Buscar contenido de sesión…",
				"panel.entry": "Buscar",
				"panel.history.clear": "Borrar",
				"panel.history.clear.hint": "Descarta la búsqueda guardada y vuelve a una búsqueda vacía.",
				"panel.buildIndex": "Construir índice",
				"panel.archived": "{count} sesión(es) archivada(s) excluida(s)",
				"panel.rebuilding": "Reconstruyendo índice… {done}/{total} (el índice anterior sigue activo)",
				"panel.unavailable": "Servicio de índice independiente no disponible: Host no inicializado.",
				"panel.notBuilt": "Índice independiente no construido: constrúyalo para habilitar la búsqueda de contenido (no se requiere índice FTS oficial).",
				"panel.loadingSessions": "Cargando sesiones…",
				"panel.sessionsError": "Error al cargar sesiones: {error}",
				"panel.noSessions": "Sin sesiones",
				"panel.noMatch": "Sin sesiones coincidentes.",
				"panel.loadingContent": "Buscando en el contenido…",
				"panel.contentError": "Búsqueda de contenido fallida: {error}",
				"panel.noContent": "Sin contenido coincidente.",
				"panel.contentHint": "Escriba palabras clave para buscar contenido.",
				"panel.noText": "(sin texto)",
				"panel.delete": "Eliminar",
				"panel.delete.confirm": "Confirmar borrado",
				"panel.delete.hint": "Eliminar esta sesión (irreversible, misma ruta que la gestión)",
				"panel.delete.done": "{n} sesión(es) eliminadas",
				"panel.delete.failed": "Error de borrado: {error}",
				"panel.untitled": "(sin título)",
				"panel.openSession": "Abrir sesión",
				"panel.footer.invoke": "Abrir",
				"panel.footer.close": "Cerrar",
				"filter.all": "Todos",
				"filter.user": "Usuario",
				"filter.reply": "Respuesta",
				"filter.tool": "Herramienta",
				"sort.label": "Orden de resultados",
				"sort.relevance": "Relevancia",
				"sort.time": "Tiempo",
				"sort.relevance.hint": "Ordenar por fuerza de coincidencia (predeterminado).",
				"sort.time.hint": "Ordenar por última actividad, más reciente primero; en caso de empate, por fuerza de coincidencia.",
				"group.merge": "Unir",
				"group.expand": "Desplegar",
				"group.merge.hint": "Solo la coincidencia más fuerte por sesión (predeterminado).",
				"group.expand.hint": "Mostrar cada coincidencia de la sesión en su propia fila (cada fila es un destino).",
				"type.user/message": "Usuario",
				"type.assistant/message": "Respuesta",
				"type.tool/call": "Llamada de herramienta",
				"type.tool/result": "Resultado de herramienta",
				"panel.deepSync": "Sincronización profunda",
				"panel.deepSync.hint": "Pide a drsc un reescaneo lento para reparar la biblioteca de proyección y luego reconstruye el índice local (para localización fallida o sesiones nuevas que no aparecen).",
				"panel.deepSync.drs": "Sincronizando drsc…",
				"panel.deepSync.rebuild": "Reconstruyendo índice…",
				"panel.deepSync.done": "Sincronización completada",
				"panel.deepSync.failed": "Sincronización fallida",
				"panel.deepSync.failedReason": "Error en la sincronización profunda: {error}",
				"panel.deepSync.retry": "Reintentar sincronización",
				"panel.doctor": "Diagnóstico",
				"panel.doctor.hint": "Compone el registro de fallos y el estado de las sondas en un informe pegable con comandos ejecutables, y lo copia. El registro se vacía tras copiar.",
				"panel.doctor.copied": "Informe de diagnóstico copiado: pégalo directamente en el issue.",
				"panel.doctor.failed": "No se pudo generar el informe de diagnóstico: {error}",
				"panel.doctor.copyFailed": "Informe generado pero la copia falló ({error}); se imprimió en la consola del navegador.",
				"panel.sessionsError.bare": "No se pudo cargar la lista de sesiones",
				"panel.searchFailed": "La búsqueda falló",
				"panel.unknownError": "Error desconocido",
				"panel.indexUnreachable": "Estado del índice inaccesible: la mitad Host probablemente sea un proceso obsoleto. Reinicie completamente dsh web (una actualización del navegador no recarga el Host) y reintente.",
				"panel.locate.pending": "Buscando la línea del resultado…",
				"panel.locate.ok": "Saltó a la línea del resultado",
				"panel.locate.miss": "No se pudo localizar (línea no renderizada / texto dividido / tiempo agotado)",
				"card.indexStatus.requestFailed": "Solicitud index-status fallida",
				"card.indexStatus.readFailed": "No se pudo leer el estado",
				"card.indexStatus.readFailedHint": "No se pudo leer el estado del índice: {error}. Reinicie completamente dsh web (una actualización del navegador no recarga la mitad Host) y reintente.",
				"card.indexStatus.retry": "Reintentar estado",
				"err.requestFailed": "La solicitud falló",
				"err.timeout": "La solicitud agotó el tiempo de espera",
				"err.settingsUnwritable": "El puente de ajustes no admite escritura (describe no listo o host de solo lectura)",
				"err.settingsWriteFailed": "Falló la escritura de ajustes",
				"panel.index.count": "Índice {n}",
				"panel.index.none": "Índice no construido",
				"panel.index.rebuilding": "Reconstruyendo {done}/{total}",
				"domain.all": "Todos",
				"tag.archived": "Archivado",
				"date.from": "Fecha de inicio",
				"date.to": "Fecha de fin",
				"hud.progress": "Cargando historial anterior… {pulled}/{budget}",
				"hud.done": "Historial cargado",
				"hud.jump": "Saltar",
				"hud.fail": "El retroceso no encontró el objetivo",
				"hud.retry": "Reintentar (presupuesto extra de páginas)",
				"hud.close": "Cerrar",
				"cold.badge.hint": "Datos fríos: el objetivo está fuera del índice del carril de mensajes (>40 turnos); hacer clic requiere carga retrospectiva",
				"cold.confirm.body": "El objetivo está ~{gap} turnos antes del más reciente, fuera del índice del carril. Se necesita carga paginada retrospectiva (~{pages} páginas). Confirme para cargar lo mejor posible y saltar.",
				"cold.confirm.ok": "Cargar y saltar",
				"cold.confirm.cancel": "Cancelar",
				"toocold.badge.hint": "Datos muy fríos: el objetivo supera el rango seguro de retroceso (>200 turnos); sin paginación automática",
				"toocold.hint": "La sesión se abrió, pero el objetivo supera el rango seguro de retroceso (>200 turnos). Busque paginando manualmente hacia arriba.",
				"card.deepSync.btn": "Sincronización profunda (drsc)",
				"card.deepSync.hint": "Primero vuelve a escanear con drsc en modo lento para reparar la base de proyección y luego reconstruye el índice local.",
				"card.deepSync.drs": "Sincronizando drsc…",
				"card.deepSync.rebuilding": "Reconstruyendo el índice…",
				"card.corpusSource": "Origen del corpus",
				"card.corpusSource.desc": "El corpus de la búsqueda de contenido proviene de la base de proyección DRS; native solo conserva metadatos de título/encabezado.",
				"card.mode.drs": "Proyección DRS",
				"card.mode.native": "Servicio de sesión local",
				"card.drsBaseUrl": "URL base de DRS",
				"card.drsBaseUrl.desc": "Vacío = automático (primera entrada de trustedHosts, si no http://127.0.0.1:8080).",
				"card.drsStatus.up": "Búsqueda de contenido disponible.",
				"card.drsStatus.down": "Búsqueda de contenido no disponible: {reason}",
				"card.drsStatus.reading": "Detectando DRS…",
				"panel.manage": "Gestionar",
				"domain.active": "Activos",
				"domain.archived": "Archivados",
				"manage.hint": "Agrupado por espacio de trabajo; marca y aplica en lote. La eliminación es irreversible.",
				"manage.restartHint": "Prioriza las API en memoria del host (archivar/desarchivar al instante en 0.1.7+); si no, escribe los archivos directamente y la barra lateral lo refleja tras reiniciar.",
				"manage.done.restart": "Reinicia DSH para que la barra lateral lo refleje del todo.",
				"manage.group.nocwd": "(sin espacio de trabajo)",
				"manage.selectGroup": "Seleccionar/deseleccionar el grupo",
				"manage.selected": "{n} seleccionados",
				"manage.batch.archive": "Archivar",
				"manage.batch.unarchive": "Desarchivar",
				"manage.batch.delete": "Eliminar",
				"manage.batch.confirm": "Confirmar eliminación",
				"manage.batch.working": "En curso…",
				"manage.done.archive": "{n} sesiones archivadas.",
				"manage.done.unarchive": "{n} sesiones desarchivadas.",
				"manage.done.purge": "{n} sesiones depuradas.",
				"manage.done.error": "La operación falló: {error}",
				"panel.index.rebuild": "Reconstruir",
				"filter.favorites": "Favoritos",
				"star.on": "Quitar de favoritos",
				"star.off": "Añadir a favoritos",
				"workspace.label": "Espacio de trabajo",
				"workspace.more": "{n} más",
				"workspace.less": "Contraer",
				"manage.search": "Buscar sesiones…",
				"group.collapse": "Contraer/expandir el grupo",
				"group.expandAll": "Expandir todo",
				"group.collapseAll": "Contraer todo"
			},
			pt: {
				"card.deepSync.btn": "Sincronização profunda (drsc)",
				"card.deepSync.hint": "Primeiro peça ao drsc um reescaneamento lento para reparar a biblioteca de projeção e depois reorganize o índice local.",
				"card.deepSync.drs": "sincronizando drsc…",
				"card.deepSync.rebuilding": "reorganizando o índice…",
				"panel.deepSync": "Sincronização profunda",
				"panel.deepSync.hint": "Peça ao drsc um reescaneamento lento para reparar a biblioteca de projeção e depois reorganize o índice local (para falhas de localização ou sessões novas que não aparecem na busca).",
				"panel.deepSync.drs": "sincronizando drsc…",
				"panel.deepSync.rebuild": "reorganizando o índice…",
				"panel.deepSync.done": "Sincronização concluída",
				"panel.deepSync.failed": "Falha na sincronização",
				"panel.deepSync.failedReason": "Falha na sincronização profunda: {error}",
				"panel.deepSync.retry": "Tentar sincronizar de novo",
				"panel.doctor": "Relatório de diagnóstico",
				"panel.doctor.hint": "Combina o registro de falhas e o estado das sondas em um relatório pronto para colar (com comandos executáveis) e o copia para a área de transferência; o registro é limpo depois que a cópia tem sucesso.",
				"panel.doctor.copied": "Relatório de diagnóstico copiado: é só colar direto no issue.",
				"panel.doctor.failed": "Falha ao gerar o relatório de diagnóstico: {error}",
				"panel.doctor.copyFailed": "Relatório gerado, mas a cópia falhou ({error}); ele foi impresso no console do navegador.",
				"card.corpusSource": "Fonte do corpus",
				"card.corpusSource.desc": "O corpus da busca de conteúdo vem da biblioteca de projeção DRS; o modo nativo mantém apenas a superfície de títulos/metadados de cabeçalho.",
				"card.mode.drs": "Biblioteca de projeção DRS",
				"card.mode.native": "Serviço local de sessões",
				"card.drsBaseUrl": "URL base do DRS",
				"card.drsBaseUrl.desc": "Vazio = automático (primeira entrada de trustedHosts; senão http://127.0.0.1:8080).",
				"card.drsStatus.up": "Busca de conteúdo disponível.",
				"card.drsStatus.down": "Busca de conteúdo indisponível: {reason}",
				"card.drsStatus.reading": "Sondando o DRS…",
				"card.drsStatus.mode": "Canal atual: {mode}",
				"card.contentTransport": "Conexão com o DRS",
				"card.contentTransport.desc": "auto = HTTP primeiro e, em caso de falha, o banco somente leitura em processo (recomendado); http = somente HTTP; in-process = somente o banco somente leitura em processo (versão desktop).",
				"card.transport.auto": "auto",
				"card.transport.http": "HTTP",
				"card.transport.in-process": "Em processo",
				"card.drsReason.browser-access-denied": "O host proíbe o acesso de processos não renderizadores às rotas locais",
				"card.drsReason.drs-http-unreachable": "Rota do DRS inalcançável (porta fechada ou conexão recusada)",
				"card.drsReason.drs-http-error": "O DRS devolveu um erro",
				"card.drsReason.drs-not-activated": "dsh-reference-session-collector não está ativado como plugin (rota 404): execute dsh plugin --profile <name> add dsh-reference-session-collector e reinicie o host",
				"card.drsReason.drs-missing": "Dependência não instalada junto com o pacote: reinstale este plugin (a dependência vem automática)",
				"card.drsReason.drs-empty": "A biblioteca de projeção ainda não foi criada: reinicie o host e aguarde a primeira sincronização",
				"card.drsReason.drs-schema-mismatch": "A versão da biblioteca de projeção difere do esperado pelo plugin: atualize o dsh-reference-session-collector",
				"card.drsStatus.inactive": "Plugin de dependência não ativado: execute dsh plugin --profile <name> add dsh-reference-session-collector e reinicie o host (no momento servindo pelo banco somente leitura em processo; os dados da projeção não se atualizam sozinhos)",
				"panel.contentErr.browser-access-denied": "O host bloqueia o acesso do navegador às rotas locais e o banco somente leitura em processo também está indisponível: reinicie o host e tente de novo ({error})",
				"panel.contentErr.drs-http-unreachable": "Rota do DRS inalcançável: confirme que o dsh-reference-session-collector está habilitado ({error})",
				"panel.contentErr.drs-http-error": "O DRS devolveu um erro: {error}",
				"panel.contentErr.drs-not-activated": "dsh-reference-session-collector não está ativado como plugin (rota 404): execute dsh plugin --profile <name> add dsh-reference-session-collector e reinicie o host ({error})",
				"panel.contentErr.drs-missing": "Dependência não instalada junto com o pacote: reinstale este plugin (ele traz o dsh-reference-session-collector) ({error})",
				"panel.contentErr.drs-empty": "A biblioteca de projeção ainda não foi criada: reinicie o host e aguarde o fim da primeira sincronização ({error})",
				"panel.contentErr.drs-schema-mismatch": "Versão da biblioteca de projeção incompatível: atualize o dsh-reference-session-collector (este plugin nunca limpa o banco) ({error})",
				"card.title": "Índice de busca",
				"card.description": "Busca de sessões na barra lateral com alternância entre título e conteúdo em um clique. A busca de conteúdo usa o índice próprio do plugin e nunca depende do índice de texto completo oficial do DSH.",
				"card.unavailable": "Namespace de configurações indisponível: confirme que o plugin foi montado no profile.",
				"card.readonly": "Somente leitura",
				"card.enabled": "Ativar busca de sessões",
				"card.enabled.desc": "Mostra a entrada «Buscar» na parte inferior da barra lateral.",
				"card.defaultMode": "Modo de busca padrão",
				"card.defaultMode.desc": "Em qual modo o painel abre: busca por título ou busca por conteúdo.",
				"card.rememberQuery": "Memorizar histórico de busca",
				"card.rememberQuery.desc": "Ao reabrir a busca, restaura as últimas palavras-chave, os filtros e a posição de rolagem (válido por 12 horas). Desligado, nada é salvo.",
				"card.mode.title": "Título",
				"card.mode.content": "Conteúdo",
				"card.autoSync": "Sincronizar índice automaticamente",
				"card.autoSync.desc": "Sincroniza os logs de sessão ao índice independente de forma incremental em segundo plano.",
				"card.syncInterval": "Intervalo de sincronização (segundos)",
				"card.syncInterval.desc": "Intervalo mínimo entre duas sincronizações incrementais.",
				"card.archiveKeep": "Arquivamentos do índice a manter",
				"card.archiveKeep.desc": "Quantos arquivos de índice históricos cada reorganização retém.",
				"card.index": "Índice de busca de conteúdo",
				"card.index.desc": "Índice normal: {indexed} sessões coletadas.",
				"card.index.archives": ", {archives} arquivamento(s).",
				"card.index.empty": "O índice independente ainda não foi criado. Clique em «Reorganizar índice» para construí-lo a partir dos logs de sessão.",
				"card.index.reading": "Lendo o estado do índice…",
				"card.index.rebuilding": "Reorganizando o índice… {done}/{total} (durante a reorganização o índice antigo continua disponível para busca)",
				"card.index.syncing": "Sincronizando o índice…",
				"card.index.failures": "{count} sessão(ões) com falha de sincronização (detalhes nos logs do Host).",
				"card.index.rebuildError": "Falha na reorganização: {error}",
				"card.index.rebuild": "Reorganizar índice",
				"card.index.rebuilding.btn": "Reorganizando…",
				"card.index.rebuild.hint": "Não destrutivo: durante a construção o índice antigo continua disponível para busca; ao terminar há troca atômica e o índice antigo vai para arquivamento.",
				"card.index.archivedOwner": "A navegação e a limpeza das sessões arquivadas pertencem ao «mordomo de sessões» (dsh-session-steward). Este plugin apenas lê o conjunto de arquivamento e exclui do índice as sessões arquivadas.",
				"card.index.archivedMissing": "Navegar e limpar sessões arquivadas exige o «mordomo de sessões» (dsh-session-steward), que não está instalado. Este plugin apenas lê o conjunto de arquivamento e exclui do índice as sessões arquivadas.",
				"card.index.export": "Exportar instantâneo",
				"card.index.import": "Importar instantâneo",
				"card.index.exported": "Instantâneo exportado como arquivo baixado.",
				"card.index.import.started": "Importação de instantâneo iniciada: o índice é reconstruído em segundo plano e entra em serviço ao terminar.",
				"card.index.importParse": "Falha ao analisar o instantâneo ou nenhuma sessão válida encontrada.",
				"card.action.failed": "Falha na ação: {error}",
				"panel.titleSearch": "Título",
				"panel.contentSearch": "Conteúdo",
				"panel.searchTitle": "Buscar títulos de sessões…",
				"panel.searchContent": "Buscar conteúdo das sessões…",
				"panel.entry": "Buscar",
				"panel.history.clear": "Limpar",
				"panel.history.clear.hint": "Descarta o cenário de busca salvo e volta para uma busca vazia.",
				"panel.buildIndex": "Construir índice",
				"panel.archived": "{count} sessão(ões) arquivada(s) excluída(s)",
				"panel.rebuilding": "Reorganizando o índice… {done}/{total} (durante a reorganização o índice antigo continua disponível para busca)",
				"panel.unavailable": "Serviço de índice independente indisponível: o Host não concluiu a inicialização.",
				"panel.notBuilt": "O índice independente ainda não foi criado: construa-o uma vez para habilitar a busca de conteúdo (não depende do índice de texto completo oficial do DSH).",
				"panel.loadingSessions": "Carregando a lista de sessões…",
				"panel.sessionsError": "Falha ao carregar a lista de sessões: {error}",
				"panel.noSessions": "Nenhuma sessão",
				"panel.noMatch": "Nenhuma sessão correspondente.",
				"panel.loadingContent": "Buscando no conteúdo das sessões…",
				"panel.contentError": "Falha na busca de conteúdo: {error}",
				"panel.noContent": "Nenhum conteúdo correspondente.",
				"panel.contentHint": "Digite palavras-chave para buscar no conteúdo.",
				"panel.noText": "(sem texto)",
				"panel.delete": "Excluir",
				"panel.delete.confirm": "Confirmar exclusão",
				"panel.delete.hint": "Excluir esta sessão (irreversível, mesmo caminho da gestão)",
				"panel.delete.done": "{n} sessão(ões) excluída(s)",
				"panel.delete.failed": "Falha ao excluir: {error}",
				"panel.untitled": "(sem título)",
				"panel.openSession": "Abrir sessão",
				"panel.footer.invoke": "Abrir",
				"panel.footer.close": "Fechar",
				"filter.all": "Todos",
				"filter.user": "Usuário",
				"filter.reply": "Resposta",
				"filter.tool": "Ferramenta",
				"sort.label": "Ordem dos resultados",
				"sort.relevance": "Relevância",
				"sort.time": "Tempo",
				"sort.relevance.hint": "Ordena pela força da correspondência (padrão).",
				"sort.time.hint": "Ordena pela última atividade da sessão, mais recente primeiro; em empate, pela força da correspondência.",
				"group.merge": "Unir",
				"group.expand": "Separar",
				"group.merge.hint": "Mostra apenas a correspondência mais forte por sessão (padrão).",
				"group.expand.hint": "Mostra cada correspondência da sessão em sua própria linha (cada linha continua sendo um destino de salto).",
				"type.user/message": "Usuário",
				"type.assistant/message": "Resposta",
				"type.tool/call": "Chamada de ferramenta",
				"type.tool/result": "Resultado de ferramenta",
				"panel.manage": "Gerenciar",
				"domain.all": "Todos",
				"domain.active": "Ativas",
				"domain.archived": "Arquivadas",
				"tag.archived": "Arquivada",
				"manage.hint": "Agrupado por workspace; marque linhas e opere em lote. A exclusão é irreversível.",
				"manage.restartHint": "Prefere a API em memória do host para efeito imediato (0.1.7+ arquivar/desarquivar sem reinício); quando indisponível, escreve direto no arquivo de armazenamento e a barra lateral só reflete após reinício.",
				"manage.done.restart": "Reinicie o DSH para a barra lateral refletir completamente a mudança.",
				"manage.group.nocwd": "(sem workspace)",
				"manage.selectGroup": "Marcar/desmarcar o grupo inteiro",
				"manage.selected": "{n} selecionada(s)",
				"manage.batch.archive": "Arquivar",
				"manage.batch.unarchive": "Desarquivar",
				"manage.batch.delete": "Excluir",
				"manage.batch.confirm": "Confirmar exclusão",
				"manage.batch.working": "Executando…",
				"manage.done.archive": "{n} sessão(ões) arquivada(s).",
				"manage.done.unarchive": "{n} sessão(ões) desarquivada(s).",
				"manage.done.purge": "{n} sessão(ões) limpa(s).",
				"manage.done.error": "Falha na operação: {error}",
				"panel.index.none": "Índice não criado",
				"panel.index.count": "Índice {n}",
				"panel.index.rebuilding": "Reorganizando {done}/{total}",
				"panel.index.rebuild": "Reorganizar",
				"filter.favorites": "Favoritos",
				"date.from": "Data inicial",
				"date.to": "Data final",
				"star.on": "Remover dos favoritos",
				"star.off": "Favoritar",
				"workspace.label": "Workspace",
				"workspace.more": "mais {n}",
				"workspace.less": "Recolher",
				"manage.search": "Buscar sessões…",
				"group.collapse": "Recolher/expandir o grupo",
				"group.expandAll": "Expandir tudo",
				"group.collapseAll": "Recolher tudo",
				"cold.badge.hint": "Dados frios: o alvo está fora da faixa do índice da trilha de mensagens (>40 turnos); o clique exige carregamento retroativo",
				"toocold.badge.hint": "Dados muito frios: o alvo ultrapassa a faixa segura de retrocesso (>200 turnos); sem virar páginas automaticamente",
				"cold.confirm.body": "O alvo está cerca de {gap} turnos antes do mais recente, fora do índice da trilha de mensagens; é preciso retroceder páginas (cerca de {pages} página(s)). Após confirmar, o carregamento e o salto serão tentados.",
				"cold.confirm.ok": "Carregar e saltar",
				"cold.confirm.cancel": "Cancelar",
				"toocold.hint": "Sessão aberta, mas o alvo ultrapassa a faixa segura de retrocesso (>200 turnos); procure virando a página para cima manualmente.",
				"hud.progress": "Carregando histórico anterior… {pulled}/{budget}",
				"hud.done": "Histórico carregado",
				"hud.jump": "Saltar",
				"hud.fail": "O retrocesso não encontrou o alvo",
				"hud.retry": "Tentar de novo (orçamento extra de páginas)",
				"hud.close": "Fechar",
				"panel.sessionsError.bare": "Falha ao carregar a lista de sessões",
				"panel.searchFailed": "A busca falhou",
				"panel.unknownError": "Erro desconhecido",
				"panel.indexUnreachable": "Status do índice inacessível: a metade Host provavelmente é um processo desatualizado. Reinicie totalmente o dsh web (uma atualização do navegador não recarrega o Host) e tente novamente.",
				"panel.locate.pending": "Localizando a linha do resultado…",
				"panel.locate.ok": "Saltou para a linha do resultado",
				"panel.locate.miss": "Não foi possível localizar (linha não renderizada / texto dividido / tempo esgotado)",
				"card.indexStatus.requestFailed": "Falha na solicitação index-status",
				"card.indexStatus.readFailed": "Falha ao ler o status",
				"card.indexStatus.readFailedHint": "Falha ao ler o status do índice: {error}. Reinicie totalmente o dsh web (uma atualização do navegador não recarrega a metade Host) e tente novamente.",
				"card.indexStatus.retry": "Repetir status",
				"err.requestFailed": "Falha na solicitação",
				"err.timeout": "Tempo limite da solicitação esgotado",
				"err.settingsUnwritable": "Ponte de configurações não é gravável (describe não pronto ou host somente leitura)",
				"err.settingsWriteFailed": "Falha ao gravar configurações"
			}
		};
		let defaultSeat;
		/**
		* Bind the plugin's own locale namespace as the fallback seat.
		* Slot components are not guaranteed to receive `t` in their props, so the
		* plugin must be able to translate without one.
		*/
		function bindDefaultSeat(seat) {
			defaultSeat = seat;
		}
		/** Translate with {param} interpolation; falls back to zh, then the key itself. */
		function translate(locale, key, params) {
			const raw = locale?.(key, params) ?? defaultSeat?.(key, params);
			if (typeof raw === "string" && raw !== "" && raw !== key) return raw;
			const template = dictionaries.zh[key] ?? key;
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/gu, (_, name) => String(params[name] ?? `{${name}}`));
		}
		//#endregion
		//#region src/client/host-api.ts
		/**
		* Client-side helpers and structural mirrors shared by the search panel and
		* the settings card. Everything talks to the host through the fenced
		* `/switch-search/api` route; no official package is value-imported.
		*/
		/** 模块级错误文案：走 `translate` 的 defaultSeat（`index.ts` 用 `locale.bind(NS)` 绑定），
		* 因此这里没有 `t` 可传也能跟随宿主语言，而不是写死中文。 */
		const errText = (key) => translate(void 0, key);
		/** Fetch timeout for one host call (long for import: the body can be large). */
		const FETCH_TIMEOUT = 1e4;
		/** POST a JSON body to a fenced switch-search API method (items shape).
		*  `code` 是 0.7.8 起的失败档位（旧宿主无此字段）；客户端优先按它取本地化文案。
		*  `detail` 是 0.7.28 起的原始细节（issue #5）：宿主不再拼散文，`error` 只剩
		*  通用兜底，drs 档位的 `{error}` 插槽数据源由 `detail` 提供。 */
		function callHost(method, body) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = controller !== void 0 && typeof setTimeout === "function" ? setTimeout(() => {
				controller.abort();
			}, FETCH_TIMEOUT) : void 0;
			return fetch(`/switch-search/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).then((data) => {
				const record = data;
				if (record && record.ok === true && Array.isArray(record.items)) return {
					ok: true,
					items: record.items
				};
				return {
					ok: false,
					items: [],
					error: record?.error ?? errText("err.requestFailed"),
					...typeof record?.code === "string" ? { code: record.code } : {},
					...typeof record?.detail === "string" ? { detail: record.detail } : {}
				};
			}).catch((err) => ({
				ok: false,
				items: [],
				error: err instanceof DOMException && err.name === "AbortError" ? errText("err.timeout") : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		/** POST a body to a fenced switch-search API method, returning the whole record. */
		function callHostAny(method, body, timeout = FETCH_TIMEOUT) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = typeof setTimeout === "function" ? setTimeout(() => {
				controller?.abort();
			}, timeout) : void 0;
			return fetch(`/switch-search/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: typeof body === "string" ? body : JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).catch((err) => ({
				ok: false,
				error: err instanceof DOMException && err.name === "AbortError" ? errText("err.timeout") : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		/**
		* POST to the STEWARD fenced route (`/session-steward/api`) — the batch
		* management console (archive / unarchive / purge) rides the steward subdomain,
		* per the merged package's route contract (session-* methods stay there).
		*/
		function callSteward(method, body, timeout = FETCH_TIMEOUT) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = typeof setTimeout === "function" ? setTimeout(() => {
				controller?.abort();
			}, timeout) : void 0;
			return fetch(`/manage-session/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).catch((err) => ({
				ok: false,
				error: err instanceof DOMException && err.name === "AbortError" ? errText("err.timeout") : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		/**
		* 深度同步：让 DRS 慢速重扫修好自己的投影库，再把本地索引整理一遍。
		* 后台执行，进度看 index-status 的 deepSync 面。
		*/
		async function deepSyncIndex() {
			return await callHostAny("index-deep-sync", {});
		}
		/**
		* 诊断报告（issue #4 后续）：宿主把「异常台账 + 探针现状」编排成一份可粘贴的
		* Markdown，每一步带可执行命令。
		*
		* 为什么返回整段文本而不是结构化步骤：用户要的动作是**把它贴进 issue**，
		* 排版在宿主侧一次成型，客户端只负责复制，不在浏览器里重新拼一遍（两边拼法
		* 迟早会分叉）。
		*/
		async function fetchDoctorReport() {
			return await callHostAny("doctor", {});
		}
		/** 清空异常台账（用户手动清 / 已贴完 issue）。 */
		async function clearDoctorLedger() {
			return await callHostAny("doctor-clear", {});
		}
		/** Trigger a browser download of the index snapshot from the host route. */
		async function downloadSnapshot() {
			const res = await fetch("/switch-search/api/index-export", { method: "POST" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `switch-search-snapshot-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.jsonl`;
			anchor.click();
			URL.revokeObjectURL(url);
		}
		/**
		* Open a session from a search hit through whichever face the running host
		* offers: `uiWorkspace.openSession` first (0.1.7+), the pre-0.1.7
		* `sessions.open` as fallback. Neither present → silent no-op: a host line
		* this package does not target must not crash the panel.
		*
		* The service names are resolved through `get` at call time, not captured at
		* apply time: this plugin applies before the session-controller / ui-workspace
		* client modules in the load order, so an eager lookup captures `undefined`
		* and every result click silently no-ops. Both are root-context singletons,
		* so by the time a user clicks a hit they are always mounted.
		*/
		function openSessionThrough(get, sessionId) {
			const uiWorkspace = get("uiWorkspace");
			if (uiWorkspace !== void 0 && typeof uiWorkspace.openSession === "function") {
				uiWorkspace.openSession(sessionId);
				return;
			}
			const sessions = get("sessions");
			if (sessions !== void 0 && typeof sessions.open === "function") sessions.open(sessionId);
		}
		//#endregion
		//#region src/client/guide.tsx
		/**
		* ⚠️ 生成副本 —— 请勿手改。真源：mine-dsh-plugins/_tools/guide-kit/guide.tsx
		* 重新同步：node _tools/guide-kit/sync.mjs
		*/
		/**
		* guide-kit —— 九插件共用的「首次使用引导」件（**生成副本，勿手改**）。
		*
		* 唯一真源：`mine-dsh-plugins/_tools/guide-kit/guide.tsx`
		* 同步命令：`node _tools/guide-kit/sync.mjs`（会覆盖本文件；改这里等于白改）
		*
		* 六条契约（见 .agents/plans/unified-i18n-onboarding/spec.md §2）：
		* 1. Skip 恒定可见，任何步骤都能退；
		* 2. 永远有字：引导外壳（标题/按钮/步进）自带 10 语词表，按 <html lang> 取词，
		*    认不出的一律落 en；步骤正文按「本语 → en → zh → 任意可用」逐级回退，绝不留空白；
		* 3. 重启入口：`GuideRestartButton`（或自己调 `resetGuide(ns)` + setOpen(true)）就地重开；
		* 4. 零依赖：只 react + localStorage，不 import 平台包，不抢宿主设置表单；
		* 5. 引导自己绝不能成为卡面渲染的失败点：样式注入与存储访问全部 try/catch + 能力探测；
		* 6. 外壳词表与步骤正文分离：外壳跨插件统一（本文件），正文每插件一份 `guide-steps.ts`。
		*/
		/** 生态通用的十个语言码（与各插件 `locale/*.json`、README 的十语镜像同口径）。 */
		const GUIDE_LOCALES = [
			"zh",
			"en",
			"ja",
			"ko",
			"fr",
			"de",
			"it",
			"ru",
			"es",
			"pt"
		];
		/**
		* 引导外壳词表（10 语）。
		*
		* 为什么不塞进各插件 locales：这七个词是**跨插件同一套**，塞进九个字典要重复翻译
		* 9×10 次，且一旦措辞调整就得动九个仓。外壳留在本文件，正文留各插件。
		*/
		const GUIDE_COPY = {
			zh: {
				title: "快速上手",
				skip: "跳过引导",
				next: "下一步",
				prev: "上一步",
				done: "开始使用",
				restart: "重新查看引导",
				stepOf: (current, total) => `第 ${current} / ${total} 步`
			},
			en: {
				title: "Quick start",
				skip: "Skip guide",
				next: "Next",
				prev: "Back",
				done: "Get started",
				restart: "Show guide again",
				stepOf: (current, total) => `Step ${current} of ${total}`
			},
			ja: {
				title: "クイックスタート",
				skip: "ガイドをスキップ",
				next: "次へ",
				prev: "戻る",
				done: "はじめる",
				restart: "ガイドをもう一度表示",
				stepOf: (current, total) => `ステップ ${current} / ${total}`
			},
			ko: {
				title: "빠른 시작",
				skip: "가이드 건너뛰기",
				next: "다음",
				prev: "이전",
				done: "시작하기",
				restart: "가이드 다시 보기",
				stepOf: (current, total) => `${current} / ${total} 단계`
			},
			fr: {
				title: "Démarrage rapide",
				skip: "Ignorer le guide",
				next: "Suivant",
				prev: "Retour",
				done: "Commencer",
				restart: "Revoir le guide",
				stepOf: (current, total) => `Étape ${current} sur ${total}`
			},
			de: {
				title: "Schnellstart",
				skip: "Anleitung überspringen",
				next: "Weiter",
				prev: "Zurück",
				done: "Loslegen",
				restart: "Anleitung erneut anzeigen",
				stepOf: (current, total) => `Schritt ${current} von ${total}`
			},
			it: {
				title: "Avvio rapido",
				skip: "Salta la guida",
				next: "Avanti",
				prev: "Indietro",
				done: "Inizia",
				restart: "Rivedi la guida",
				stepOf: (current, total) => `Passo ${current} di ${total}`
			},
			ru: {
				title: "Быстрый старт",
				skip: "Пропустить руководство",
				next: "Далее",
				prev: "Назад",
				done: "Начать",
				restart: "Показать руководство снова",
				stepOf: (current, total) => `Шаг ${current} из ${total}`
			},
			es: {
				title: "Inicio rápido",
				skip: "Omitir la guía",
				next: "Siguiente",
				prev: "Atrás",
				done: "Empezar",
				restart: "Ver la guía de nuevo",
				stepOf: (current, total) => `Paso ${current} de ${total}`
			},
			pt: {
				title: "Início rápido",
				skip: "Ignorar o guia",
				next: "Próximo",
				prev: "Voltar",
				done: "Começar",
				restart: "Ver o guia novamente",
				stepOf: (current, total) => `Passo ${current} de ${total}`
			}
		};
		/** 语言标签 → 语言码：只认主标签，认不出的落 null（由调用方回退 en）。 */
		function normalizeGuideLocale(tag) {
			const primary = tag.toLowerCase().trim().split(/[-_]/)[0] ?? "";
			return GUIDE_LOCALES.includes(primary) ? primary : null;
		}
		function htmlLang() {
			try {
				return typeof document === "undefined" ? "" : document.documentElement?.lang ?? "";
			} catch {
				return "";
			}
		}
		/**
		* 当前引导语言：以宿主 `<html lang>` 为准（语言切换会改写这个属性）。
		*
		* 认不出 → en：引导是「帮助」面，宁可给英文也不能给空白或中文硬串。
		*/
		function currentGuideLocale() {
			return normalizeGuideLocale(htmlLang()) ?? "en";
		}
		/** 引导外壳取词。 */
		function guideLabels(locale = currentGuideLocale()) {
			return GUIDE_COPY[locale] ?? GUIDE_COPY.en;
		}
		/**
		* 步骤正文取词：本语 → en → zh → 表里第一个可用。
		*
		* 为什么需要回退链：九插件分批补语种，某个插件可能只有 zh/en 而宿主是 ru；
		* 这时给英文是可用的，给空白等于「引导坏了」。`undefined` 步骤表按空表处理。
		*/
		function guideSteps(map) {
			if (map === void 0) return [];
			const order = [
				currentGuideLocale(),
				"en",
				"zh"
			];
			for (const key of order) {
				const hit = key === void 0 ? void 0 : map[key];
				if (hit !== void 0 && hit.length > 0) return hit;
			}
			for (const key of GUIDE_LOCALES) {
				const hit = map[key];
				if (hit !== void 0 && hit.length > 0) return hit;
			}
			return [];
		}
		function guideStorageKey(ns) {
			return `dsh.guide.${ns}.skipped`;
		}
		/** 是否已跳过（存储不可用时按「未跳过」处理：宁可多教一次，不要静默不教）。 */
		function isGuideSkipped(ns) {
			try {
				return typeof localStorage !== "undefined" && localStorage.getItem(guideStorageKey(ns)) === "1";
			} catch {
				return false;
			}
		}
		/** 记下跳过；写失败不抛（隐私模式 / 存储禁用）。 */
		function skipGuide(ns) {
			try {
				localStorage?.setItem(guideStorageKey(ns), "1");
			} catch {}
		}
		/** 清标记 = 允许重新教学。 */
		function resetGuide(ns) {
			try {
				localStorage?.removeItem(guideStorageKey(ns));
			} catch {}
		}
		const GUIDE_CSS = `
.sgGuide{border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06));border-radius:12px;padding:14px 16px;margin:0 0 12px}
.sgGuideHead{display:flex;align-items:center;gap:8px;margin:0 0 10px}
.sgGuideTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary, currentColor)}
.sgGuideStep{font-size:12px;color:var(--dsw-alias-label-tertiary, rgba(127,127,127,.9));margin-left:auto}
.sgGuideBody{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary, currentColor);min-height:52px}
.sgGuideBody b{color:var(--dsw-alias-label-primary, currentColor);font-weight:600}
.sgGuideDots{display:flex;gap:6px;margin:10px 0 0}
.sgGuideDot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-border-l2, rgba(127,127,127,.3))}
.sgGuideDot-on{background:var(--dsw-alias-button-primary-fill, #4d6bfe)}
.sgGuideFoot{display:flex;align-items:center;gap:8px;margin:12px 0 0}
.sgGuideBtn{appearance:none;font:inherit;font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-primary, currentColor);cursor:pointer}
.sgGuideBtn-primary{background:var(--dsw-alias-button-primary-fill, #4d6bfe);border-color:transparent;color:#fff}
.sgGuideBtn-skip{margin-right:auto;color:var(--dsw-alias-label-tertiary, rgba(127,127,127,.9));border-color:transparent;text-decoration:underline}
.sgGuideRestart{appearance:none;font:inherit;font-size:12px;line-height:1.4;padding:4px 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35));background:var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06));color:var(--dsw-alias-label-primary, currentColor);cursor:pointer;text-decoration:none}
.sgGuideRestart:hover{border-color:var(--dsw-alias-button-primary-fill, #4d6bfe);color:var(--dsw-alias-button-primary-fill, #4d6bfe)}
`;
		function injectGuideCss() {
			try {
				if (typeof document === "undefined") return;
				if (typeof document.querySelector !== "function") return;
				if (typeof document.createElement !== "function") return;
				if (!document.head) return;
				if (document.querySelector("style[data-plugin-css=\"guide-kit\"]") !== null) return;
				const tag = document.createElement("style");
				tag.dataset.pluginCss = "guide-kit";
				tag.textContent = GUIDE_CSS;
				document.head.appendChild(tag);
			} catch {}
		}
		/** 语言变更订阅：语言切换后重渲染词表（引导是短生命周期，直接跟随 <html lang>）。 */
		function useLangTick() {
			const [, setTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				try {
					if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
					if (!document.documentElement) return;
					const observer = new MutationObserver(() => setTick((n) => n + 1));
					observer.observe(document.documentElement, {
						attributes: true,
						attributeFilter: ["lang"]
					});
					return () => observer.disconnect();
				} catch {
					return;
				}
			}, []);
		}
		/**
		* 引导主体：≤10 步的小教学（惯例：末条讲「用量端点」贴士）+ 恒定可见的 Skip。
		*
		* `onClose` 由宿主卡面传：Skip/Done 都会调用它（Skip 同时写标记）。
		*/
		function GuidePanel(props) {
			const { ns, steps, onClose } = props;
			const [index, setIndex] = (0, react.useState)(0);
			useLangTick();
			const labels = guideLabels();
			(0, react.useEffect)(() => {
				injectGuideCss();
			}, []);
			if (steps.length === 0) return null;
			const current = steps[Math.min(index, steps.length - 1)];
			const last = index >= steps.length - 1;
			const finish = () => {
				skipGuide(ns);
				onClose();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "sgGuide",
				"aria-label": labels.title,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "sgGuideHead",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sgGuideTitle",
							children: labels.title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sgGuideStep",
							children: labels.stepOf(index + 1, steps.length)
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sgGuideBody",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: current.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: current.body })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "sgGuideDots",
						"aria-hidden": "true",
						children: steps.map((step, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sgGuideDot" + (i === index ? " sgGuideDot-on" : "") }, step.title))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
						className: "sgGuideFoot",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn sgGuideBtn-skip",
								onClick: () => finish(),
								children: labels.skip
							}),
							index > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn",
								onClick: () => setIndex(index - 1),
								children: labels.prev
							}),
							last ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn sgGuideBtn-primary",
								onClick: () => finish(),
								children: labels.done
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn sgGuideBtn-primary",
								onClick: () => setIndex(index + 1),
								children: labels.next
							})
						]
					})
				]
			});
		}
		/**
		* 重启入口：清标记 + 就地重开引导。
		*
		* 统一件，避免九插件各写一份（措辞/样式/清标记时机容易走样）。跳过之后
		* 用户想再看一次，不需要去清浏览器存储。
		*/
		function GuideRestartButton(props) {
			const { ns, onOpen, style } = props;
			useLangTick();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "sgGuideRestart",
				style,
				onClick: () => {
					resetGuide(ns);
					onOpen();
				},
				children: guideLabels().restart
			});
		}
		//#endregion
		//#region src/client/guide-steps.ts
		const SEARCH_GUIDE_STEPS = {
			zh: [
				{
					title: "先建索引，再搜索",
					body: "搜索走本地索引，索引没建过就是空的。打开设置卡里的「索引」块点一次同步，之后新增内容会自动增量补。"
				},
				{
					title: "两个入口",
					body: "侧栏放大镜打开整页搜索面板；输入框旁的按钮是当前会话内的快速定位。两者读同一份索引。"
				},
				{
					title: "搜不到先看状态",
					body: "面板顶部的状态条会说话：未建立 / 重建中 / 直接报错。冷数据（很久以前、从未打开的会话）需要先回溯加载才进索引。"
				}
			],
			en: [
				{
					title: "Index first, then search",
					body: "Search reads a local index; with no index the results are simply empty. Open the settings card, hit sync once in the Index block — later content is picked up incrementally."
				},
				{
					title: "Two entry points",
					body: "The sidebar magnifier opens the full-page search panel; the button near the composer does a quick locate inside the current session. Both read the same index."
				},
				{
					title: "Nothing found? Check the status",
					body: "The status strip at the top says it plainly: not built / rebuilding / error. Cold sessions (old, never opened) must be backfilled before they enter the index."
				}
			]
		};
		//#endregion
		//#region src/client/star-row-copy.ts
		/**
		* star-row 真源（面板 star 快车道行，v1）——纯 DOM 实现，零依赖。
		*
		* 副本约束：生成文件名 star-row-copy.ts，头部须保留 /** 块注释，单行 ≤140
		* 字宽（sidebar-fold 仓 lint 门禁：max-line + file-header）。
		*
		* 契约（对齐 panel-star-row spec）：
		*  - 渲染一行 <a>：GitHub 单色 SVG + `owner/name`；variant A 追加一句工程话术；
		*  - 整行即链接（A/L 档），新标签页打开；不做弹窗、不做按钮交互；
		*  - 文案内嵌 10 语，按 `document.documentElement.lang` 前缀自选
		*    （同 sidebar-fold `pickDictionary` 口径），不依赖宿主 locale 服务，
		*    避免逐仓动字典文件；
		*  - 样式一次性注入 <style data-dsh-star-row>，色随 currentColor，深浅主题自适应；
		*  - 副本由 _tools/star-row/sync.mjs 生成到各仓 `src/client/star-row-copy.ts`
		*    （文件名含 copy，locale 守卫豁免规则命中），改副本无效，改真源后重跑 sync。
		*
		* 每仓生成时在文件头部烘焙 REPO_URL / STAR_NS / STAR_VARIANT 三个常量。
		*/
		/** 生成段：REPO_URL / STAR_NS / STAR_VARIANT 由 sync 注入。 */
		const REPO_URL = "https://github.com/drscrewdriver/dsh-search-index";
		const STAR_NS = "search-index";
		const STAR_LANGS = [
			"zh",
			"en",
			"ja",
			"ko",
			"fr",
			"de",
			"it",
			"ru",
			"es",
			"pt"
		];
		/** GitHub mark（Simple Icons / octicon 轮廓，24 视口），fill 随 currentColor。 */
		const GITHUB_MARK_PATH = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332 -5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";
		const STYLE_ID = "dsh-star-row-style";
		const STYLE_CSS = [
			".dsh-star-row{display:flex;align-items:center;gap:7px;font-size:12px;",
			"line-height:1.5;color:inherit;text-decoration:none;opacity:.72;padding:3px 0;",
			"margin-top:6px;min-width:0;flex-wrap:wrap}",
			".dsh-star-row:hover{opacity:1;text-decoration:underline}",
			".dsh-star-row svg{width:14px;height:14px;flex:none;display:block}",
			".dsh-star-row .dsh-star-ask{opacity:.85;font-weight:400}"
		].join("");
		const STAR_FOOT_COPY = {
			zh: {
				ask: "觉得好用？",
				star: "去 GitHub 点个 Star",
				issue: "反馈建议 / 提 issue"
			},
			en: {
				ask: "Finding it useful?",
				star: "Star on GitHub",
				issue: "Feedback / open an issue"
			},
			ja: {
				ask: "お役に立っていますか？",
				star: "GitHub でスター",
				issue: "ご意見・不具合報告"
			},
			ko: {
				ask: "유용한가요?",
				star: "GitHub 에서 스타",
				issue: "피드백 / 이슈 열기"
			},
			fr: {
				ask: "Utile ?",
				star: "Une étoile sur GitHub",
				issue: "Retour / ouvrir un ticket"
			},
			de: {
				ask: "Hilfreich?",
				star: "Stern auf GitHub",
				issue: "Feedback / Issue öffnen"
			},
			it: {
				ask: "Ti è utile?",
				star: "Stella su GitHub",
				issue: "Feedback / apri una issue"
			},
			ru: {
				ask: "Полезно?",
				star: "Звезда на GitHub",
				issue: "Отзыв / открыть issue"
			},
			es: {
				ask: "¿Te resulta útil?",
				star: "Danos una estrella",
				issue: "Sugerencias / abrir issue"
			},
			pt: {
				ask: "Achou útil?",
				star: "Dê uma estrela no GitHub",
				issue: "Feedback / abrir uma issue"
			}
		};
		const STAR_FOOT_STYLE_ID = "dsh-star-foot-style";
		const STAR_FOOT_STYLE = [
			".dsh-star-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap;",
			"font-size:12px;line-height:1.6;color:inherit;opacity:.72;margin-top:10px}",
			".dsh-star-foot:hover{opacity:1}",
			".dsh-star-foot .dsh-star-ver{opacity:.6;font-variant-numeric:tabular-nums}",
			".dsh-star-foot .dsh-star-dot{opacity:.4}",
			".dsh-star-foot a{color:inherit;text-decoration:none}",
			".dsh-star-foot a:hover{text-decoration:underline}"
		].join("");
		/** 宿主语言标签归一：取 `documentElement.lang` 的前缀，命中 STAR_LANGS 即用。 */
		function starLang() {
			const low = (typeof document !== "undefined" && document.documentElement.lang || "").toLowerCase();
			for (const cand of STAR_LANGS) if (low.startsWith(cand)) return cand;
			return "en";
		}
		/** 关闭态新键（v2）。**必须换键**：≤2.0.25 把「点 ★」误写成了关闭，旧键里的 1 是误判产物。 */
		const STAR_DISMISS_KEY = "dsh.star." + STAR_NS + ".v2.dismissed";
		/** 旧键（脏数据源）：读到即清掉，**不迁值**——迁过来等于把旧 bug 固化。 */
		const STAR_DISMISS_KEY_V1 = "dsh.star." + STAR_NS + ".dismissed";
		/** 是否已被用户点掉话术（隐私模式下读失败按未关闭处理，只影响本次会话）。 */
		function starDismissed() {
			try {
				if (localStorage.getItem(STAR_DISMISS_KEY_V1) !== null) localStorage.removeItem(STAR_DISMISS_KEY_V1);
				return localStorage.getItem(STAR_DISMISS_KEY) === "1";
			} catch {
				return false;
			}
		}
		/** 记住关闭态（隐私模式写失败不报错，话术本次隐藏、刷新复活）。 */
		function starDismiss() {
			try {
				localStorage.setItem(STAR_DISMISS_KEY, "1");
			} catch {}
		}
		/** 一次性注入页脚样式。 */
		function injectFootStyle(d) {
			if (d.getElementById(STAR_FOOT_STYLE_ID)) return;
			const style = d.createElement("style");
			style.id = STAR_FOOT_STYLE_ID;
			style.textContent = STAR_FOOT_STYLE;
			d.head.appendChild(style);
		}
		/** 页脚里的一段：可点即 <a>，纯文字即 <span>。 */
		function footItem(d, tag, text, href) {
			const el = d.createElement(tag);
			el.className = "dsh-star-ask";
			if (tag === "a" && href) {
				const a = el;
				a.href = href;
				a.target = "_blank";
				a.rel = "noopener noreferrer";
			}
			el.textContent = text;
			return el;
		}
		/** 分隔点。 */
		function footDot(d) {
			const dot = d.createElement("span");
			dot.className = "dsh-star-dot";
			dot.textContent = "·";
			return dot;
		}
		/**
		* S 档：一行页脚；非 S 档或已关掉过话术时返回 null（走裸链接原路径）。
		* 点过任一链接 → 记关闭 + 换回中性一行，链接本身照常跳转（不 preventDefault）。
		*/
		function extendedStarRow(neutral, d) {
			if (starDismissed()) return null;
			injectFootStyle(d);
			const copy = STAR_FOOT_COPY[starLang()] ?? STAR_FOOT_COPY.en;
			const issuesUrl = REPO_URL.replace(/\/+$/, "") + "/issues/new";
			const row = d.createElement("div");
			row.className = "dsh-star-foot";
			const ver = d.createElement("span");
			ver.className = "dsh-star-ver";
			ver.textContent = "v0.8.5";
			row.appendChild(ver);
			row.appendChild(footDot(d));
			row.appendChild(footItem(d, "span", copy.ask));
			const star = footItem(d, "a", "⭐ " + copy.star, REPO_URL);
			const issue = footItem(d, "a", "💬 " + copy.issue, issuesUrl);
			row.appendChild(star);
			row.appendChild(footDot(d));
			row.appendChild(issue);
			const collapse = () => {
				starDismiss();
				if (row.parentNode) {
					neutral.className = "dsh-star-row";
					row.parentNode.replaceChild(neutral, row);
				}
			};
			star.addEventListener("click", collapse);
			issue.addEventListener("click", collapse);
			return row;
		}
		/** 在目标文档上建出快车道行（一次性注入样式）。纯 DOM，React 仓经 ref 回调挂载。 */
		function mountStarRow(doc) {
			const d = doc ?? document;
			if (!d.getElementById(STYLE_ID)) {
				const tag = d.createElement("style");
				tag.id = STYLE_ID;
				tag.textContent = STYLE_CSS;
				d.head.appendChild(tag);
			}
			const match = REPO_URL.match(/github\.com\/([^/]+\/[^/#?]+)/);
			const repo = match ? match[1] : "drscrewdriver";
			const a = d.createElement("a");
			a.className = "dsh-star-row";
			a.href = REPO_URL;
			a.target = "_blank";
			a.rel = "noreferrer";
			a.dataset.starNs = STAR_NS;
			const svg = d.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("aria-hidden", "true");
			const path = d.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("fill", "currentColor");
			path.setAttribute("d", GITHUB_MARK_PATH);
			svg.appendChild(path);
			a.appendChild(svg);
			const label = d.createElement("span");
			label.textContent = repo;
			a.appendChild(label);
			const row = extendedStarRow(a, d);
			if (row) return row;
			return a;
		}
		//#endregion
		//#region src/client/card.tsx
		/**
		* Session-search settings card（0.1.7 起不再挂载：设置表单由 host 侧 .volatile() 字段自动生成）。
		* plugin, following the dsh-thinking-levels card pattern.
		*
		* The card binds the `switch-search` settings namespace through the
		* `settingsScope` cordis service and renders its fields as one editable card:
		* the enable switch, the default panel mode, the independent-index sync
		* knobs, and the index-lifecycle block (status, the non-destructive 整理
		* button, and the JSON snapshot export/import seam). Every change commits
		* immediately through the scope (no staged form).
		*
		* Kept dependency-free beyond react: the scope is subscribed with
		* `useSyncExternalStore`, and the controls are plain HTML reusing the
		* stylesheet the client half injects.
		*/
		/** Row shared by every field of the card. */
		function Row(props) {
			return (0, react.createElement)("div", { className: "dsws_setRow" }, [(0, react.createElement)("div", {
				key: "text",
				className: "dsws_setText"
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dsws_setTitle"
			}, props.title), props.desc !== void 0 && (0, react.createElement)("span", {
				key: "d",
				className: "dsws_setDesc"
			}, props.desc)]), (0, react.createElement)("div", { key: "ctl" }, props.control)]);
		}
		/**
		* A boolean switch editing one namespace field.
		*
		* Drawn entirely with inline styles (thinking-levels discipline): the card
		* must not depend on the injected stylesheet — scoped or late-loaded settings
		* pages left the class-based switch rendering as a bare checkbox dot.
		*/
		function Toggle(props) {
			const checked = props.checked;
			return (0, react.createElement)("label", { style: {
				position: "relative",
				width: "40px",
				height: "22px",
				flex: "none",
				display: "inline-block",
				cursor: props.writable ? "pointer" : "not-allowed"
			} }, [
				(0, react.createElement)("input", {
					key: "input",
					type: "checkbox",
					checked,
					disabled: !props.writable,
					onChange: (e) => props.onChange(e.target.checked),
					style: {
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						opacity: 0,
						margin: 0,
						cursor: props.writable ? "pointer" : "not-allowed"
					}
				}),
				(0, react.createElement)("span", {
					key: "track",
					style: {
						position: "absolute",
						inset: 0,
						background: checked ? "var(--dsw-alias-state-business-primary, #4c6ef5)" : "var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.25))",
						border: `1px solid ${checked ? "var(--dsw-alias-state-business-primary, #4c6ef5)" : "var(--dsw-alias-border-l2, rgba(127,127,127,0.35))"}`,
						borderRadius: "11px",
						transition: "background .15s ease, border-color .15s ease",
						pointerEvents: "none"
					}
				}),
				(0, react.createElement)("span", {
					key: "thumb",
					style: {
						position: "absolute",
						top: "2px",
						left: "2px",
						width: "16px",
						height: "16px",
						background: "#fff",
						borderRadius: "50%",
						boxShadow: "0 1px 2px rgba(0,0,0,.2)",
						transition: "transform .15s ease",
						transform: checked ? "translateX(18px)" : "none",
						pointerEvents: "none"
					}
				})
			]);
		}
		/**
		* A status pill in the official ConnectionIndicator visual language: rounded
		* chip, semantic state tokens, animated dots while syncing.
		*/
		function StatusPill(props) {
			const stateClass = props.state === "ready" ? "dsws_pillReady" : props.state === "syncing" ? "dsws_pillWarn" : props.state === "error" ? "dsws_pillError" : "dsws_pillNeutral";
			return (0, react.createElement)("span", { className: `dsws_pill ${stateClass}` }, [(0, react.createElement)("span", {
				key: "icon",
				className: "dsws_pillIcon",
				"aria-hidden": true
			}, props.icon), (0, react.createElement)("span", {
				key: "label",
				className: "dsws_pillLabel"
			}, [(0, react.createElement)("span", { key: "text" }, props.label), props.dots === true && (0, react.createElement)("span", {
				key: "dots",
				className: "dsws_pillDots",
				"aria-hidden": true
			}, (0, react.createElement)("span", {}, "."), (0, react.createElement)("span", {}, "."), (0, react.createElement)("span", {}, "."))])]);
		}
		/** The independent-index lifecycle block (status + 整理 + snapshot seam). */
		function IndexBlock(props) {
			const [status, setStatus] = (0, react.useState)(null);
			const [fetchError, setFetchError] = (0, react.useState)(null);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [note, setNote] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				let timer;
				const refresh = () => {
					callHostAny("index-status", {}).then((res) => {
						if (cancelled) return;
						if (res.ok) {
							setStatus(res);
							setFetchError(null);
						} else {
							setStatus(null);
							setFetchError(res.error ?? translate(t, "card.indexStatus.requestFailed"));
						}
						const rebuilding = res.rebuild?.state === "building" || res.rebuild?.state === "swapping";
						const deep = res.deepSync?.state;
						if (rebuilding || deep === "drs-syncing" || deep === "rebuilding") timer = window.setTimeout(refresh, 2e3);
						else setBusy(false);
					});
				};
				refresh();
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, [attempt]);
			const t = props.t;
			const rebuilding = status?.rebuild?.state === "building" || status?.rebuild?.state === "swapping";
			const rebuildError = status?.rebuild?.state === "error" ? status.rebuild.error : void 0;
			const syncFailures = status?.sync?.failures?.length ?? 0;
			const blocking = busy || rebuilding;
			const onRebuild = () => {
				setBusy(true);
				setNote(null);
				callHostAny("index-rebuild", {}).then((res) => {
					if (!res.ok) {
						setNote(translate(t, "card.action.failed", { error: res.error ?? "?" }));
						setBusy(false);
					}
				});
			};
			const onExport = () => {
				setBusy(true);
				setNote(null);
				downloadSnapshot().then(() => setNote(translate(t, "card.index.exported"))).catch((err) => setNote(translate(t, "card.action.failed", { error: String(err instanceof Error ? err.message : err) }))).finally(() => setBusy(false));
			};
			const onImportFile = (file) => {
				setBusy(true);
				setNote(null);
				file.text().then((text) => callHostAny("index-import", text, 3e4)).then((res) => {
					if (res.ok) setNote(translate(t, "card.index.import.started"));
					else setNote(res.error ?? translate(t, "card.index.importParse"));
				}).catch((err) => setNote(translate(t, "card.action.failed", { error: String(err instanceof Error ? err.message : err) }))).finally(() => setBusy(false));
			};
			const pillState = rebuilding ? "syncing" : status?.rebuild?.state === "error" || fetchError !== null ? "error" : status === null || status.available !== true ? "neutral" : "ready";
			const modeText = status?.mode === "http" ? translate(t, "card.transport.http") : status?.mode === "in-process" ? translate(t, "card.transport.in-process") : String(status?.mode ?? "none");
			const pillLabel = fetchError !== null ? translate(t, "card.indexStatus.readFailed") : rebuilding ? translate(t, "card.index.rebuilding", {
				done: status?.rebuild?.done ?? 0,
				total: status?.rebuild?.total || "?"
			}) : status === null ? translate(t, "card.index.reading") : status.available === true ? translate(t, "card.index.desc", { indexed: status.sync?.indexed ?? "?" }) : translate(t, "card.index.empty");
			const statusLine = fetchError !== null ? translate(t, "card.indexStatus.readFailedHint", { error: fetchError }) : status === null ? translate(t, "card.index.reading") : rebuilding ? translate(t, "card.index.rebuilding", {
				done: status.rebuild?.done ?? 0,
				total: status.rebuild?.total || "?"
			}) : status.available === true ? `${translate(t, "card.index.desc", { indexed: status.sync?.indexed ?? "?" })}${(status.archives?.length ?? 0) > 0 ? translate(t, "card.index.archives", { archives: status.archives?.length }) : ""}` : translate(t, "card.index.empty");
			const rebuildDone = status?.rebuild?.done ?? 0;
			const rebuildTotal = status?.rebuild?.total ?? 0;
			const progressPct = rebuilding && rebuildTotal > 0 ? Math.min(100, Math.round(rebuildDone / rebuildTotal * 100)) : void 0;
			const progressBlock = rebuilding ? (0, react.createElement)("div", {
				key: "progress",
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "4px",
					margin: "2px 0 6px",
					width: "100%"
				}
			}, [(0, react.createElement)("div", {
				key: "bar",
				style: {
					height: "6px",
					borderRadius: "3px",
					background: "var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.2))",
					overflow: "hidden"
				}
			}, (0, react.createElement)("div", { style: progressPct === void 0 ? {
				height: "100%",
				width: "30%",
				borderRadius: "3px",
				background: "var(--dsw-alias-state-business-primary, #4c6ef5)",
				opacity: .6
			} : {
				height: "100%",
				width: `${progressPct}%`,
				borderRadius: "3px",
				background: "var(--dsw-alias-state-business-primary, #4c6ef5)",
				transition: "width .4s ease"
			} })), (0, react.createElement)("span", { style: {
				color: "var(--dsw-alias-state-business-primary, #4c6ef5)",
				fontSize: "12px",
				lineHeight: "18px",
				fontWeight: 600,
				fontVariantNumeric: "tabular-nums"
			} }, progressPct === void 0 ? translate(t, "card.index.rebuilding", {
				done: rebuildDone,
				total: "?"
			}) : `${progressPct}% · ${translate(t, "card.index.rebuilding", {
				done: rebuildDone,
				total: rebuildTotal
			})}`)]) : null;
			return (0, react.createElement)("div", {
				className: "dsws_setRow",
				style: rebuilding ? {
					flexDirection: "column",
					alignItems: "stretch"
				} : void 0
			}, [
				(0, react.createElement)("div", {
					key: "text",
					className: "dsws_setText"
				}, [
					(0, react.createElement)("span", {
						key: "t",
						className: "dsws_setTitle"
					}, translate(t, "card.index")),
					(0, react.createElement)("span", {
						key: "p",
						style: {
							display: "flex",
							gap: "8px",
							alignItems: "center",
							flexWrap: "wrap"
						}
					}, [(0, react.createElement)(StatusPill, {
						key: "pill",
						state: pillState,
						label: pillLabel,
						icon: pillState === "ready" ? "✓" : pillState === "syncing" || pillState === "error" ? "!" : "·",
						dots: pillState === "syncing"
					}), (status?.archivedSessions ?? 0) > 0 && (0, react.createElement)("span", {
						key: "archived",
						className: "dsws_pill dsws_pillNeutral"
					}, translate(t, "panel.archived", { count: status?.archivedSessions ?? 0 }))]),
					(0, react.createElement)("span", {
						key: "d",
						className: "dsws_setDesc"
					}, statusLine),
					(0, react.createElement)("span", {
						key: "drs",
						className: "dsws_setDesc"
					}, status === null ? translate(t, "card.drsStatus.reading") : status.notActivated === true ? translate(t, "card.drsStatus.inactive") : status.available === true ? `${translate(t, "card.drsStatus.up")} ${translate(t, "card.drsStatus.mode", { mode: modeText })}` : translate(t, "card.drsStatus.down", { reason: status.reason === void 0 ? "drs-unavailable" : translate(t, `card.drsReason.${status.reason}`, {}) })),
					(status?.archivedSessions ?? 0) > 0 && (0, react.createElement)("span", {
						key: "archHint",
						className: "dsws_setDesc"
					}, status?.steward === "missing" ? translate(t, "card.index.archivedMissing") : translate(t, "card.index.archivedOwner")),
					rebuildError !== null && rebuildError !== void 0 && (0, react.createElement)("span", {
						key: "err",
						className: "dsws_setDesc"
					}, translate(t, "card.index.rebuildError", { error: rebuildError })),
					syncFailures > 0 && (0, react.createElement)("span", {
						key: "warn",
						className: "dsws_setDesc"
					}, translate(t, "card.index.failures", { count: syncFailures })),
					note !== null && (0, react.createElement)("span", {
						key: "note",
						className: "dsws_setDesc"
					}, note),
					(0, react.createElement)("span", {
						key: "hint",
						className: "dsws_setDesc"
					}, translate(t, "card.index.rebuild.hint"))
				]),
				progressBlock,
				(0, react.createElement)("div", {
					key: "btns",
					className: "dsws_btnRow"
				}, [
					(0, react.createElement)("button", {
						key: "rebuild",
						type: "button",
						className: "dsws_actBtn",
						disabled: blocking,
						onClick: onRebuild
					}, rebuilding ? translate(t, "card.index.rebuilding.btn") : translate(t, "card.index.rebuild")),
					(0, react.createElement)("button", {
						key: "deepSync",
						type: "button",
						className: "dsws_actBtn",
						disabled: blocking || status?.deepSync?.state === "drs-syncing" || status?.deepSync?.state === "rebuilding",
						title: translate(t, "card.deepSync.hint"),
						onClick: () => {
							setBusy(true);
							setNote(null);
							callHostAny("index-deep-sync", {}).then((res) => {
								if (!res.ok) {
									setBusy(false);
									setNote(res.error ?? translate(t, "card.action.failed", { error: "unknown" }));
									return;
								}
								setAttempt((a) => a + 1);
							});
						}
					}, status?.deepSync?.state === "drs-syncing" ? translate(t, "card.deepSync.drs") : status?.deepSync?.state === "rebuilding" ? translate(t, "card.deepSync.rebuilding") : translate(t, "card.deepSync.btn")),
					(0, react.createElement)("button", {
						key: "export",
						type: "button",
						className: "dsws_actBtn",
						disabled: blocking || status?.available !== true,
						onClick: onExport
					}, translate(t, "card.index.export")),
					fetchError !== null && (0, react.createElement)("button", {
						key: "retryStatus",
						type: "button",
						className: "dsws_actBtn",
						onClick: () => {
							setAttempt((n) => n + 1);
						}
					}, translate(t, "card.indexStatus.retry")),
					(0, react.createElement)("label", {
						key: "import",
						className: "dsws_actBtn"
					}, [translate(t, "card.index.import"), (0, react.createElement)("input", {
						key: "file",
						type: "file",
						accept: ".jsonl,.json,text/plain,application/json",
						style: { display: "none" },
						onChange: (e) => {
							const file = e.target.files?.[0] ?? void 0;
							e.target.value = "";
							if (file !== void 0 && file !== null) onImportFile(file);
						}
					})])
				])
			]);
		}
		/**
		* The settings card body: a collapsed drawer shell (title + description +
		* chevron, thinking-levels pattern) expanding into the namespace fields and
		* the index-lifecycle block.
		* @param props - locale seat (optional) and the bound namespace scope.
		*/
		function SearchSettingsCard(props) {
			const { scope } = props;
			const t = props.t;
			const [open, setOpen] = (0, react.useState)(true);
			const body = createCardBody({
				t,
				snapshot: (0, react.useSyncExternalStore)((listener) => scope.subscribe(listener), () => scope.getSnapshot()),
				scope
			});
			const [guideOpen, setGuideOpen] = (0, react.useState)(() => !isGuideSkipped("search-index"));
			const guideEl = guideOpen ? (0, react.createElement)(GuidePanel, {
				ns: "search-index",
				steps: guideSteps(SEARCH_GUIDE_STEPS),
				onClose: () => {
					setGuideOpen(false);
				}
			}) : null;
			const restartEl = (0, react.createElement)("p", {
				key: "guide-restart",
				style: { margin: "0 0 10px" }
			}, (0, react.createElement)(GuideRestartButton, {
				key: "b",
				ns: "search-index",
				onOpen: () => {
					setGuideOpen(true);
				}
			}));
			return (0, react.createElement)("div", { style: {
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))",
				background: "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))",
				borderRadius: "12px",
				transition: "border-color 0.16s, background 0.16s"
			} }, [
				(0, react.createElement)("button", {
					key: "head",
					type: "button",
					"aria-expanded": open,
					style: {
						appearance: "none",
						width: "100%",
						font: "inherit",
						color: "inherit",
						textAlign: "left",
						cursor: "pointer",
						background: "none",
						border: 0,
						borderRadius: "12px",
						display: "flex",
						alignItems: "center",
						gap: "12px",
						padding: "14px 16px"
					},
					onClick: () => {
						setOpen((current) => !current);
					}
				}, [(0, react.createElement)("span", {
					key: "text",
					style: {
						flex: "1 1 0%",
						minWidth: 0
					}
				}, [(0, react.createElement)("div", {
					key: "title",
					style: {
						fontSize: "14px",
						fontWeight: 600,
						color: "var(--dsw-alias-label-primary)"
					}
				}, translate(t, "card.title")), (0, react.createElement)("div", {
					key: "desc",
					style: {
						color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
						fontSize: "13px",
						lineHeight: 1.5
					}
				}, translate(t, "card.description"))]), (0, react.createElement)("svg", {
					key: "chev",
					width: 16,
					height: 16,
					viewBox: "0 0 16 16",
					"aria-hidden": true,
					style: {
						color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
						flex: "0 0 auto",
						transition: "transform 0.16s",
						transform: open ? "rotate(180deg)" : "none"
					}
				}, (0, react.createElement)("path", {
					d: "M4 6l4 4 4-4",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.5,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}))]),
				open && (0, react.createElement)("div", {
					key: "body",
					style: { padding: "12px 16px" }
				}, [
					restartEl,
					...guideEl === null ? [] : [guideEl],
					...body
				]),
				(0, react.createElement)("span", {
					key: "star-row",
					ref: (node) => {
						if (node && !node.firstChild) node.appendChild(mountStarRow());
					}
				})
			]);
		}
		/** The card's expandable content: namespace fields plus the index block. */
		function createCardBody(props) {
			const t = props.t;
			const snapshot = props.snapshot;
			const scope = props.scope;
			if (snapshot.status === "unavailable") return [(0, react.createElement)("div", {
				className: "dsws_setRow",
				key: "unavailable"
			}, (0, react.createElement)("span", { className: "dsws_setTitle" }, translate(t, "card.unavailable")))];
			const value = snapshot.value ?? {};
			const writable = snapshot.writable;
			const syncIntervalSeconds = Math.round((value.syncIntervalMs ?? 3e4) / 1e3);
			const archiveKeep = value.archiveKeep ?? 2;
			const children = [
				(0, react.createElement)(Row, {
					key: "enable",
					title: translate(t, "card.enabled"),
					desc: translate(t, "card.enabled.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.enabled ?? true,
						writable,
						onChange: (checked) => {
							scope.set("enabled", checked);
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "mode",
					title: translate(t, "card.defaultMode"),
					desc: translate(t, "card.defaultMode.desc"),
					control: (0, react.createElement)("div", {
						className: "dsws_seg",
						role: "group"
					}, ["title", "content"].map((mode) => (0, react.createElement)("button", {
						key: mode,
						type: "button",
						className: `dsws_segBtn${(value.defaultMode ?? "title") === mode ? " dsws_segBtnActive" : ""}`,
						"aria-pressed": (value.defaultMode ?? "title") === mode,
						disabled: !writable,
						onClick: () => {
							scope.set("defaultMode", mode);
						}
					}, mode === "title" ? translate(t, "card.mode.title") : translate(t, "card.mode.content"))))
				}),
				(0, react.createElement)(Row, {
					key: "remember",
					title: translate(t, "card.rememberQuery"),
					desc: translate(t, "card.rememberQuery.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.rememberQuery ?? false,
						writable,
						onChange: (checked) => {
							scope.set("rememberQuery", checked);
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "autoSync",
					title: translate(t, "card.autoSync"),
					desc: translate(t, "card.autoSync.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.autoSync ?? true,
						writable,
						onChange: (checked) => {
							scope.set("autoSync", checked);
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "interval",
					title: translate(t, "card.syncInterval"),
					desc: translate(t, "card.syncInterval.desc"),
					control: (0, react.createElement)("input", {
						type: "number",
						min: 5,
						max: 3600,
						disabled: !writable,
						value: syncIntervalSeconds,
						style: {
							width: "72px",
							boxSizing: "border-box"
						},
						className: "dsws_search",
						onChange: (e) => {
							const seconds = Number(e.target.value);
							if (Number.isFinite(seconds) && seconds >= 5) scope.set("syncIntervalMs", Math.round(seconds * 1e3));
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "archiveKeep",
					title: translate(t, "card.archiveKeep"),
					desc: translate(t, "card.archiveKeep.desc"),
					control: (0, react.createElement)("input", {
						type: "number",
						min: 0,
						max: 20,
						disabled: !writable,
						value: archiveKeep,
						style: {
							width: "72px",
							boxSizing: "border-box"
						},
						className: "dsws_search",
						onChange: (e) => {
							const count = Number(e.target.value);
							if (Number.isFinite(count) && count >= 0) scope.set("archiveKeep", Math.round(count));
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "corpus",
					title: translate(t, "card.corpusSource"),
					desc: translate(t, "card.corpusSource.desc"),
					control: (0, react.createElement)("div", {
						className: "dsws_seg",
						role: "group"
					}, ["drs", "native"].map((source) => (0, react.createElement)("button", {
						key: source,
						type: "button",
						className: `dsws_segBtn${(value.corpusSource ?? "drs") === source ? " dsws_segBtnActive" : ""}`,
						"aria-pressed": (value.corpusSource ?? "drs") === source,
						disabled: !writable,
						onClick: () => {
							scope.set("corpusSource", source);
						}
					}, source === "drs" ? translate(t, "card.mode.drs") : translate(t, "card.mode.native"))))
				}),
				(0, react.createElement)(Row, {
					key: "drsBaseUrl",
					title: translate(t, "card.drsBaseUrl"),
					desc: translate(t, "card.drsBaseUrl.desc"),
					control: (0, react.createElement)("input", {
						type: "text",
						disabled: !writable,
						defaultValue: value.drsBaseUrl ?? "",
						placeholder: "http://127.0.0.1:8080",
						style: {
							width: "220px",
							boxSizing: "border-box"
						},
						className: "dsws_search",
						onBlur: (e) => {
							scope.set("drsBaseUrl", e.target.value);
						},
						onKeyDown: (e) => {
							if (e.key === "Enter") e.currentTarget.blur();
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "contentTransport",
					title: translate(t, "card.contentTransport"),
					desc: translate(t, "card.contentTransport.desc"),
					control: (0, react.createElement)("div", {
						className: "dsws_seg",
						role: "group"
					}, [
						"auto",
						"http",
						"in-process"
					].map((mode) => (0, react.createElement)("button", {
						key: mode,
						type: "button",
						className: `dsws_segBtn${(value.contentTransport ?? "auto") === mode ? " dsws_segBtnActive" : ""}`,
						"aria-pressed": (value.contentTransport ?? "auto") === mode,
						disabled: !writable,
						onClick: () => {
							scope.set("contentTransport", mode);
						}
					}, translate(t, `card.transport.${mode}`))))
				})
			];
			const indexBlock = IndexBlock({ t });
			children.push(indexBlock);
			if (!writable) children.push((0, react.createElement)("div", {
				key: "ro",
				className: "dsws_setDesc"
			}, translate(t, "card.readonly")));
			return children;
		}
		//#endregion
		//#region src/client/bridge-scope.ts
		/** 与宿主 settings-bridge.ts 的命名空间键一致（存储键稳定承诺）。 */
		const SEARCH_NS = "switch-search";
		const shared = {
			search: {},
			status: "loading",
			writable: false,
			revision: void 0
		};
		const listeners = /* @__PURE__ */ new Set();
		let describeInFlight;
		function notify() {
			for (const listener of [...listeners]) try {
				listener();
			} catch {}
		}
		function replaceDoc(next) {
			Object.assign(shared, next);
			notify();
		}
		/** 首个订阅触发一次 describe；并发调用共享同一 in-flight promise。 */
		function ensureDescribe() {
			if (describeInFlight !== void 0) return describeInFlight;
			describeInFlight = callHostAny("settings-describe", {}).then((res) => {
				if (res.ok === true && res.namespaces !== null && typeof res.namespaces === "object") replaceDoc({
					search: res.namespaces[SEARCH_NS] ?? {},
					status: "ready",
					writable: res.writable === true,
					revision: typeof res.revision === "number" ? res.revision : void 0
				});
				else replaceDoc({
					status: "unavailable",
					writable: false
				});
			}).catch(() => {
				replaceDoc({
					status: "unavailable",
					writable: false
				});
			}).finally(() => {
				describeInFlight = void 0;
			});
			return describeInFlight;
		}
		/** 组装一个视图 scope。`ns` 决定读/写哪个命名空间文档。 */
		function makeBridgeScope(ns, keyOf) {
			let snapshot = {
				status: "loading",
				value: void 0,
				revision: void 0,
				writable: false
			};
			const refresh = () => {
				const next = {
					status: shared.status,
					value: shared.status === "ready" ? { ...keyOf(shared) } : void 0,
					revision: shared.revision,
					writable: shared.writable
				};
				if (next.status !== snapshot.status || next.writable !== snapshot.writable || next.revision !== snapshot.revision || JSON.stringify(next.value ?? null) !== JSON.stringify(snapshot.value ?? null)) snapshot = next;
			};
			return {
				getSnapshot: () => {
					refresh();
					return snapshot;
				},
				subscribe: (listener) => {
					listeners.add(listener);
					ensureDescribe();
					return () => {
						listeners.delete(listener);
					};
				},
				set: async (field, value) => {
					if (shared.status !== "ready" || shared.writable === false) throw new Error(translate(void 0, "err.settingsUnwritable"));
					const before = keyOf(shared)[field];
					keyOf(shared)[field] = value;
					refresh();
					const res = await callHostAny("settings-mutate", {
						ns,
						fields: { [field]: value }
					});
					if (res.ok === true && res.namespaces !== null && typeof res.namespaces === "object") replaceDoc({
						search: res.namespaces[SEARCH_NS] ?? shared.search,
						revision: typeof res.revision === "number" ? res.revision : shared.revision
					});
					else {
						keyOf(shared)[field] = before;
						refresh();
						throw new Error(res.error ?? translate(void 0, "err.settingsWriteFailed"));
					}
				}
			};
		}
		let searchScope;
		/** 搜索卡/搜索入口的桥 scope（命名空间 switch-search）。 */
		function searchBridgeScope() {
			searchScope ??= makeBridgeScope(SEARCH_NS, (doc) => doc.search);
			return searchScope;
		}
		/**
		* 原生句柄 + 桥的合成 scope：原生快照**在任意时刻**观测到 unavailable（出生
		* 死或 loading→死，0.1.7 上 steward 条目的 configForms 实测后者）就地读桥，
		* 不做 apply 期时序猜测。写侧同理：原生 unavailable 即走桥（桥在无 legacy
		* settings 服务的宿主上 set 会显式拒绝，卡片保持只读真值）。双订阅：桥的
		* describe 全页一次（模块单例），代价可忽略。
		*/
		function withBridgeFallback(native, bridge) {
			if (native === void 0) return bridge;
			return {
				getSnapshot: () => {
					const snap = native.getSnapshot();
					return snap.status === "unavailable" ? bridge.getSnapshot() : snap;
				},
				subscribe: (listener) => {
					const offNative = native.subscribe(listener);
					const offBridge = bridge.subscribe(listener);
					return () => {
						offNative();
						offBridge();
					};
				},
				set: async (field, value) => {
					if (native.getSnapshot().status === "unavailable") return bridge.set(field, value);
					return native.set(field, value);
				}
			};
		}
		//#endregion
		//#region src/client/locate.ts
		/** DRS fenced 路由（同源相对路径，与 dsh-reference-session-collector DRS_API_PATH 字面一致）。 */
		const DRS_ROUTE = "/api/dsh-reference-session-collector";
		/** 定位总超时（打开会话后 DOM 渲染窗口）。 */
		const LOCATE_TIMEOUT_MS = 8e3;
		/** 高亮驻留时长后自动摘除。 */
		const FLASH_MS = 6e3;
		/** needle 下限——短于此值的行（"好的"）歧义面太大，不值得定位。 */
		const MIN_NEEDLE_CHARS = 12;
		/** needle 上限——取前缀足够唯一，过长整串匹配反而更易被渲染差异打断。 */
		const MAX_NEEDLE_CHARS = 80;
		/** 驻留确认窗口：目标行在视口内稳定停留这么久才算跳转成功。 */
		const STICK_MS = 900;
		/** 翻页上限：24 页 × 宿主页宽足够任何真机会话；防无限拉页。 */
		const MAX_OLDER_PAGES = 24;
		/** 硬封顶：带翻页的定位窗口上限。 */
		const HARD_DEADLINE_MS = 3e4;
		/** 深加载硬封顶（冷数据确认后的定位窗口上限）。 */
		const DEEP_HARD_DEADLINE_MS = 6e4;
		/** 巡逻间隔：会话重渲染会换 DOM 节点，每轮重新定位。 */
		const TICK_MS = 350;
		/** 定位行在视口内的判定余量（顶部允许略出屏，代码块开头行高度不定）。 */
		const VISIBILITY_SLACK = 40;
		/** markdown 结构符与空白——DOM 渲染后不含这些，两侧同抹才能对上。 */
		const MATCH_NOISE_RE = /[\s`*_~#>|[\]()!，。：；、"'\\{}-]+/gu;
		/** 归一化比对文本：去空白与 markdown 噪声字符。 */
		function normalizeForMatch(text) {
			return text.replace(MATCH_NOISE_RE, "");
		}
		/**
		* 从段行选一条可定位 needle（按纯函数导出，供单测）。
		* @returns 归一化 needle；null=该行不可定位（被替换原文/无有效文本/过短歧义）。
		*/
		function resolveNeedle(row) {
			if (row === void 0) return null;
			if (Number(row.on_surface ?? 1) === 0) return null;
			const sources = Number(row.compressed ?? 0) === 1 ? [
				row.surface_text,
				row.search_text,
				row.text
			] : [row.search_text, row.text];
			for (const source of sources) {
				if (typeof source !== "string" || source === "") continue;
				const needle = normalizeForMatch(source.split("\n").find((line) => line.trim() !== "") ?? source).slice(0, MAX_NEEDLE_CHARS);
				if (needle.length >= MIN_NEEDLE_CHARS) return needle;
				const whole = normalizeForMatch(source).slice(0, MAX_NEEDLE_CHARS);
				if (whole.length >= MIN_NEEDLE_CHARS) return whole;
			}
			return null;
		}
		/**
		* 按 turn_gap 分档：≤40 热（直接跳）、41..200 冷（确认+深加载）、>200 过冷
		* （不自动回溯）、undefined 未知（富化失败/老库，按热处理）。
		*/
		function classifyHit(hit) {
			const g = hit.turnGap;
			if (typeof g !== "number" || !Number.isFinite(g)) return "unknown";
			if (g <= 40) return "hot";
			if (g > 200) return "too-cold";
			return "cold";
		}
		/** 正文候选标签：只取消息渲染会用的块级/内联代码标签——不含 div/span，
		* 否则搜索面板自己的结果行（dsws_snippet 的 span，文本就含 needle 前缀）会抢先命中。 */
		const MESSAGE_TAGS = "p, li, pre, blockquote, h1, h2, h3, h4, td, code";
		/** 阅读线偏移（dsh-tidy-display conversation-scroll.ts READING_LINE_OFFSET_PX 同值）。 */
		const READING_LINE_OFFSET_PX = 24;
		/** 有布局才叫可见：未挂载页签（display:none）的 rect 全 0，旧视口判定会误判驻留。 */
		function hasLayout(el) {
			return el.offsetHeight > 0 || el.offsetWidth > 0;
		}
		/** 祖先滚动盒（tidy-display 官方选择子）；缺席时退化窗口滚动。 */
		function scrollerOf(el) {
			return el.closest("[data-conversation-scroll]");
		}
		/** 在滚动窗口坐标系里把行着陆到顶部偏读线位——**绝不 scrollIntoView**
		* （dsh-tidy-display 实锤：它会爬祖先 scroller 把 sticky composer 抬离底部，
		* 随后宿主回贴 = 「还停在底部」）；与阅读模式 landTurn 同款 scrollTop 数学。 */
		function landRow(el, offsetPx = READING_LINE_OFFSET_PX) {
			const html = el;
			const port = scrollerOf(html) ?? el.ownerDocument.scrollingElement ?? html;
			if (port === html) {
				html.scrollIntoView({
					block: "start",
					behavior: "auto"
				});
				return;
			}
			port.scrollTop += html.getBoundingClientRect().top - port.getBoundingClientRect().top - offsetPx;
		}
		/** 行在**其滚动窗口**内是否已就位（驻留判定也用窗口系，不用视口系）。 */
		function landedInPort(el) {
			const html = el;
			if (!hasLayout(html)) return false;
			const port = scrollerOf(html);
			if (port === null) {
				const rect = html.getBoundingClientRect();
				const vh = html.ownerDocument.defaultView?.innerHeight ?? 0;
				return rect.top >= -40 && rect.bottom <= vh + VISIBILITY_SLACK;
			}
			const flow = html.getBoundingClientRect().top - port.getBoundingClientRect().top;
			return flow >= -40 && flow <= port.clientHeight + VISIBILITY_SLACK;
		}
		/**
		* 找正文行：以宿主官方消息轨锚点 `[data-chat-anchor-key]` 为主——0.1.2+ 原生会话行
		* 都带此属性（tidy-display 的 RailView 也正是镜像它），其 textContent 含整轮正文，
		* needle 命中即取该锚点；多义时取最深者。官方锚点缺席（老宿主）才回退块级正文标签
		* 文本匹配。两条路都不依赖 tidy-display 的 [data-reader-turn]，也不按哈希类名匹配。
		* 回退路径额外排除插件自家子树（dsws_ / role=dialog），绝不停到面板自己身上。
		*/
		function findMessageElement(root, needle) {
			const deepestMatch = (nodes, excludePanel) => {
				let best = null;
				let bestDepth = -1;
				for (const el of nodes) {
					if (!hasLayout(el)) continue;
					const text = el.textContent;
					if (text === null) continue;
					if (excludePanel && el.closest("[class*=\"dsws_\"], [role=\"dialog\"]") !== null) continue;
					if (!normalizeForMatch(text).includes(needle)) continue;
					let depth = 0;
					for (let n = el.parentElement; n !== null; n = n.parentElement) depth += 1;
					if (depth > bestDepth) {
						best = el;
						bestDepth = depth;
					}
				}
				return best;
			};
			const byAnchor = deepestMatch(Array.from(root.querySelectorAll("[data-chat-anchor-key]")), false);
			if (byAnchor !== null) return byAnchor;
			return deepestMatch(Array.from(root.querySelectorAll(MESSAGE_TAGS)), true);
		}
		/** 瞬时高亮：类切换（不写 inline 样式——真机教训：prepend 历史后 React 复用
		* 节点，定时器迟到把旧样式写在不相干元素上）。首次使用时惰性注入样式表。 */
		const FLASH_CLASS = "dss-located-flash";
		let flashCssReady = false;
		function ensureFlashCss(doc) {
			if (flashCssReady) return;
			flashCssReady = true;
			const style = doc.createElement("style");
			style.textContent = `.${FLASH_CLASS}{outline:2px solid var(--dsw-alias-accent,#4a9eff);outline-offset:2px;transition:outline 120ms ease}`;
			doc.head.appendChild(style);
		}
		function flashElement(el) {
			if (el.ownerDocument !== null) ensureFlashCss(el.ownerDocument);
			el.setAttribute("data-dss-located", "1");
			el.classList.add(FLASH_CLASS);
			setTimeout(() => {
				el.classList.remove(FLASH_CLASS);
				el.removeAttribute("data-dss-located");
			}, FLASH_MS);
		}
		let injectedDeps = {};
		/** 接线点：client apply 调一次；未接线时定位退化为 v3 纯 DOM 巡逻。 */
		function configureLocator(deps) {
			injectedDeps = deps;
		}
		/** 已加载回合数（官方消息轨锚点 [data-chat-anchor-key] 计数，不依赖 tidy-display）。 */
		function countLoadedTurns(root) {
			try {
				return root.querySelectorAll("[data-chat-anchor-key]").length;
			} catch {
				return 0;
			}
		}
		/**
		* 点击豁免探测：拉 DRS 行→选 needle→单次 findMessageElement 判目标行是否已在 DOM。
		* 不滚动、不翻页；命中=true（用户已翻到过，算激活，可直接跳）。任何异常返回 false。
		*/
		async function probeHitInDom(hit, env = {}) {
			const fetchImpl = env.fetchImpl ?? globalThis.fetch;
			const doc = env.doc ?? (typeof document === "undefined" ? void 0 : document);
			if (doc === void 0) return false;
			try {
				const response = await fetchImpl(`${DRS_ROUTE}?op=session&session=${encodeURIComponent(hit.sessionId)}`);
				if (!response.ok) return false;
				const body = await response.json();
				if (body.ok !== true || !Array.isArray(body.rows)) return false;
				const needle = resolveNeedle(body.rows.find((r) => Number(r.seq) === Number(hit.seq)));
				if (needle === null) return false;
				return findMessageElement(doc.body ?? doc, needle) !== null;
			} catch {
				return false;
			}
		}
		/** 目标行是否基本完整落在**其滚动窗口**内由 landedInPort 判定；旧视口函数已废弃。 */
		/**
		* 主管线：拉 DRS 段行 → 选 needle → 巡逻宿主 DOM 补滚 → 驻留后高亮。
		* fire-and-forget 语义：任何一步不满足都 resolve(false)，从不抛。
		*/
		async function locateSearchHit(hit, env = {}) {
			const fetchImpl = env.fetchImpl ?? globalThis.fetch;
			const doc = env.doc ?? (typeof document === "undefined" ? void 0 : document);
			if (doc === void 0) return false;
			const win = env.win ?? doc.defaultView ?? (typeof window === "undefined" ? void 0 : window);
			if (win === void 0) return false;
			const log = env.log ?? ((message) => {
				console.debug(`[dsh-session-steward] ${message}`);
			});
			try {
				const response = await fetchImpl(`${DRS_ROUTE}?op=session&session=${encodeURIComponent(hit.sessionId)}`);
				if (!response.ok) {
					log(`locate: drs http ${String(response.status)}`);
					return false;
				}
				const body = await response.json();
				if (body.ok !== true || !Array.isArray(body.rows)) {
					log("locate: drs envelope shape");
					return false;
				}
				const needle = resolveNeedle(body.rows.find((r) => Number(r.seq) === Number(hit.seq)));
				if (needle === null) {
					log(`locate: skip row seq=${String(hit.seq)} (shadowed/短文本/无行)`);
					return false;
				}
				const startedAt = Date.now();
				const deep = env.deep === true;
				let budget = env.pageBudget ?? (deep ? 40 : MAX_OLDER_PAGES);
				let deadline = startedAt + (env.timeoutMs ?? LOCATE_TIMEOUT_MS);
				const hardDeadline = startedAt + (deep ? DEEP_HARD_DEADLINE_MS : HARD_DEADLINE_MS);
				let lastScrollAt = 0;
				let userTookOver = false;
				const pullOlder = env.loadOlder ?? injectedDeps.loadOlder;
				let pagesPulled = 0;
				let pullInFlight = false;
				let lastPullAt = 0;
				let turnsBeforePull;
				let pageSizeMeasured = false;
				const USER_EVENTS = [
					"wheel",
					"touchstart",
					"keydown",
					"pointerdown"
				];
				const onUser = () => {
					userTookOver = true;
				};
				return await new Promise((resolve) => {
					const finish = (ok, why) => {
						clearInterval(ticker);
						for (const ev of USER_EVENTS) win.removeEventListener(ev, onUser);
						log(`${why}: seq=${String(hit.seq)} ${hit.sessionId.slice(0, 12)} +${String(Date.now() - startedAt)}ms`);
						resolve(ok);
					};
					for (const ev of USER_EVENTS) win.addEventListener(ev, onUser, {
						passive: true,
						once: true
					});
					const ticker = setInterval(() => {
						if (env.cancel?.cancelled === true) {
							finish(false, "cancelled");
							return;
						}
						if (userTookOver) {
							finish(false, "yield user");
							return;
						}
						if (Date.now() >= deadline) {
							finish(false, `locate timeout (pages=${String(pagesPulled)})`);
							return;
						}
						const el = findMessageElement(doc.body ?? doc, needle);
						if (el === null) {
							if (pullOlder !== void 0 && !pullInFlight && pagesPulled < budget && deadline < hardDeadline && Date.now() - lastPullAt >= TICK_MS * 2) {
								pullInFlight = true;
								lastPullAt = Date.now();
								if (turnsBeforePull === void 0) turnsBeforePull = countLoadedTurns(doc);
								Promise.resolve().then(() => pullOlder()).then((pulled) => {
									if (pulled) {
										pagesPulled += 1;
										env.onProgress?.(pagesPulled, budget);
										if (!pageSizeMeasured && env.pageBudget === void 0 && typeof hit.turnGap === "number" && hit.turnGap > 0 && turnsBeforePull !== void 0) {
											pageSizeMeasured = true;
											const delta = countLoadedTurns(doc) - turnsBeforePull;
											if (delta > 0) budget = Math.min(budget, Math.ceil(hit.turnGap / delta) + 1);
										}
										deadline = Math.min(hardDeadline, Date.now() + 2e3 + (env.timeoutMs ?? LOCATE_TIMEOUT_MS) / 2);
									} else deadline = Math.min(deadline, Date.now());
								}).catch(() => {}).finally(() => {
									pullInFlight = false;
								});
							}
							return;
						}
						if (landedInPort(el)) {
							if (env.forceLand === true || lastScrollAt === 0 || Date.now() - lastScrollAt >= STICK_MS) {
								landRow(el);
								flashElement(el);
								finish(true, "located");
							}
							return;
						}
						if (Date.now() - lastScrollAt >= TICK_MS) {
							landRow(el);
							lastScrollAt = Date.now();
						}
					}, TICK_MS);
				});
			} catch (err) {
				log(`locate error(silent): ${String(err instanceof Error ? err.message : err)}`);
				return false;
			}
		}
		//#endregion
		//#region src/client/locate-hud.ts
		let host = null;
		let labelEl = null;
		let actionsEl = null;
		/** 重建按钮组：每次 show 都按最新 buttons 渲染（本地化与回调保持新鲜）。 */
		function renderButtons(buttons) {
			if (actionsEl === null) return;
			while (actionsEl.firstChild !== null) actionsEl.removeChild(actionsEl.firstChild);
			for (const b of buttons) {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.textContent = b.label;
				btn.style.cssText = [
					"flex:none",
					"font:inherit",
					"font-size:12px",
					"cursor:pointer",
					"border-radius:7px",
					"padding:3px 10px",
					"color:var(--dsw-alias-label-primary, inherit)",
					b.primary === true ? "border:1px solid transparent;background:var(--dsw-alias-state-business-primary, rgba(76,110,245,.9))" : "border:1px solid var(--dsw-alias-border-l2, currentColor);background:transparent"
				].join(";");
				btn.addEventListener("click", () => {
					b.onClick();
				});
				actionsEl.appendChild(btn);
			}
		}
		/** 显示（或更新）浮窗。buttons 即当前全部动作，重复 show 只替换不重建。 */
		function showLocateHud(text, buttons) {
			if (typeof document === "undefined") return;
			if (host !== null && document.body.contains(host)) {
				if (labelEl !== null) labelEl.textContent = text;
				renderButtons(buttons);
				return;
			}
			host = document.createElement("div");
			host.setAttribute("role", "status");
			host.setAttribute("aria-live", "polite");
			host.style.cssText = [
				"position:fixed",
				"left:50%",
				"bottom:28px",
				"transform:translateX(-50%)",
				"z-index:2147483000",
				"display:flex",
				"align-items:center",
				"gap:10px",
				"padding:8px 12px",
				"border-radius:10px",
				"border:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35))",
				"background:var(--dsw-specific-tip, rgba(127,127,127,.12))",
				"backdrop-filter:blur(8px)",
				"color:var(--dsw-alias-label-primary, inherit)",
				"font-size:13px",
				"line-height:18px",
				"max-width:80vw",
				"box-shadow:var(--dsw-shadow-lv3, 0 6px 24px rgba(0,0,0,.16))"
			].join(";");
			labelEl = document.createElement("span");
			labelEl.textContent = text;
			actionsEl = document.createElement("div");
			actionsEl.style.cssText = [
				"display:flex",
				"align-items:center",
				"gap:6px",
				"flex:none"
			].join(";");
			host.appendChild(labelEl);
			host.appendChild(actionsEl);
			document.body.appendChild(host);
			renderButtons(buttons);
		}
		/** 仅更新文案（浮窗不在则忽略——落定后迟到的 onProgress 不该把它唤回）。 */
		function updateLocateHud(text) {
			if (host !== null && document.body.contains(host) && labelEl !== null) labelEl.textContent = text;
		}
		/** 移除浮窗。幂等。只由用户动作（取消/跳转/关闭）或新一次 show 之前的清理触发。 */
		function hideLocateHud() {
			if (host !== null && host.parentNode !== null) host.parentNode.removeChild(host);
			host = null;
			labelEl = null;
			actionsEl = null;
		}
		//#endregion
		//#region src/client/query-history.ts
		/**
		* 搜索现场快照（「保留搜索历史」开关的数据层）。
		*
		* 为什么单独成文件
		* ----------------
		* 本仓的测试跑不了 React 渲染路径（见 `tests/client-store.test.mjs` 的说明：
		* 客户端只用 vm + stub 验注册面）。把快照的读写、校验、越界收敛抽成**纯函数**，
		* 是这块唯一能被真用例覆盖的办法——和 `platform.ts` 同一个模式。
		*
		* 语义边界
		* --------
		* 只存**检索意图**：关键词、检索域、类型筛选、日期范围、面板模式、列表滚动位置。
		* 不存**进行中的动作**（冷数据确认卡 `pendingCold`、深回溯进度 `deepProgress`、
		* 定位巡逻态 `locateStatus`）——恢复它们会把用户拖回一个半截的确认框，比丢失更糟。
		*
		* 本插件没有分页：内容检索固定 `limit:50`、渲染 `slice(0,200)`、靠 `overflow-y:auto`
		* 滚动。所以「翻到上次点的地方」对应的是 `scrollTop`，不是页码。
		*/
		/** localStorage 键。与 `dsh-search-index.sortBy` / `.groupMode` 同一命名族。 */
		const QUERY_HISTORY_KEY = "dsh-search-index.queryHistory";
		/**
		* 取默认存储。
		*
		* 隐私模式 / SSR / 沙箱 iframe 下 `window` 或 `localStorage` 可能不存在，
		* 或访问即抛——这里全部收敛成 `undefined`，让调用方退化为「不记忆」而不是崩掉面板。
		*/
		function defaultStorage() {
			try {
				const candidate = globalThis.localStorage;
				if (candidate === void 0 || candidate === null) return void 0;
				if (typeof candidate.getItem !== "function" || typeof candidate.setItem !== "function") return void 0;
				return candidate;
			} catch {
				return;
			}
		}
		/** 快照里的字符串字段：非字符串一律当空串（中性值），不抛错。 */
		function asText(value) {
			return typeof value === "string" ? value : "";
		}
		/**
		* 清除快照。
		*
		* 开关关闭、快照过期、快照损坏三条路径都要调它——留着陈旧数据的后果是：
		* 用户关掉开关又打开，会恢复一个「关开关之前」的旧现场，语义错乱。
		*
		* @param storage - 注入的存储面；缺省取 `localStorage`。
		*/
		function clearSnapshot(storage) {
			const target = storage ?? defaultStorage();
			if (target === void 0) return;
			try {
				target.removeItem(QUERY_HISTORY_KEY);
			} catch {}
		}
		/**
		* 读一份有效快照。
		*
		* 五道校验，任一不过都视为「没有快照」并顺手清掉：
		* 1. 存储不可用；
		* 2. 没有这个键；
		* 3. JSON 解析失败；
		* 4. 不是对象 / 版本号不是 {@link QUERY_HISTORY_VERSION}；
		* 5. 超过 {@link QUERY_HISTORY_TTL_MS}。
		*
		* @param now - 当前时刻（epoch ms），注入以便测 TTL；缺省 `Date.now()`。
		* @param storage - 注入的存储面；缺省取 `localStorage`。
		* @returns 有效快照，或 `null`。
		*/
		function readSnapshot(now, storage) {
			const target = storage ?? defaultStorage();
			if (target === void 0) return null;
			let raw = null;
			try {
				raw = target.getItem(QUERY_HISTORY_KEY);
			} catch {
				return null;
			}
			if (raw === null || raw === "") return null;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				clearSnapshot(target);
				return null;
			}
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
				clearSnapshot(target);
				return null;
			}
			const doc = parsed;
			if (doc["v"] !== 1) {
				clearSnapshot(target);
				return null;
			}
			const at = typeof doc["at"] === "number" && Number.isFinite(doc["at"]) ? doc["at"] : 0;
			if (at <= 0 || (now ?? Date.now()) - at > 432e5) {
				clearSnapshot(target);
				return null;
			}
			const mode = doc["mode"] === "content" ? "content" : "title";
			const scrollRaw = doc["scrollTop"];
			const scrollTop = typeof scrollRaw === "number" && Number.isFinite(scrollRaw) && scrollRaw > 0 ? scrollRaw : 0;
			return {
				v: 1,
				at,
				mode,
				query: asText(doc["query"]),
				contentType: asText(doc["contentType"]),
				archivedFilter: asText(doc["archivedFilter"]),
				dateFrom: asText(doc["dateFrom"]),
				dateTo: asText(doc["dateTo"]),
				scrollTop
			};
		}
		/**
		* 写一份快照。
		*
		* `at` 由本函数盖戳（调用方不必关心时钟）；`v` 强制为当前版本。
		* 存储抛异常时静默——记忆是锦上添花，不能因为它让面板挂掉。
		*
		* @param snapshot - 待写的现场（`v` / `at` 会被覆盖）。
		* @param storage - 注入的存储面；缺省取 `localStorage`。
		*/
		function writeSnapshot(snapshot, storage) {
			const target = storage ?? defaultStorage();
			if (target === void 0) return;
			const doc = {
				...snapshot,
				v: 1,
				at: Date.now()
			};
			try {
				target.setItem(QUERY_HISTORY_KEY, JSON.stringify(doc));
			} catch {}
		}
		/**
		* 把目标滚动位置收敛到合法区间。
		*
		* 为什么需要：快照存下之后，用户可能删过会话（`session-history-purge` 会把行
		* 从列表里摸掉），行数变少后原 `scrollTop` 会超出新的 `scrollHeight`。浏览器
		* 自己会夹住，但不同引擎行为不完全一致，显式收敛更稳。
		*
		* @param top - 期望的滚动位置。
		* @param scrollHeight - 列表内容总高。
		* @param clientHeight - 列表可视高。
		* @returns `[0, scrollHeight - clientHeight]` 内的值。
		*/
		function clampScroll(top, scrollHeight, clientHeight) {
			if (!Number.isFinite(top) || top <= 0) return 0;
			const max = scrollHeight - clientHeight;
			if (!Number.isFinite(max) || max <= 0) return 0;
			return Math.min(top, max);
		}
		//#endregion
		//#region src/client/platform.ts
		/**
		* Resolve the running platform string, three tiers deep.
		*
		* 1. UA-CH (`navigator.userAgentData.platform`) — modern and precise.
		* 2. `navigator.platform` — broadly available, deprecated, and empty in some
		*    privacy modes.
		* 3. The UA string — last resort, still non-empty in practice.
		*
		* @param nav - the navigator to read; `undefined` is allowed (non-DOM host).
		* @returns a lower-cased platform string, or `''` when nothing could be read.
		*/
		function detectPlatform(nav) {
			const chPlatform = nav?.userAgentData?.platform;
			if (typeof chPlatform === "string" && chPlatform !== "") return chPlatform.toLowerCase();
			const legacy = nav?.platform;
			if (typeof legacy === "string" && legacy !== "") return legacy.toLowerCase();
			const agent = nav?.userAgent;
			if (typeof agent === "string" && agent !== "") return agent.toLowerCase();
			return "";
		}
		/**
		* Derive the label vocabulary from a platform string.
		*
		* An unrecognised platform — an empty string, or a UA that names neither
		* system — takes the non-Mac vocabulary on purpose: `Ctrl` is legible to
		* everyone, while `⌘` is opaque to anyone who has never used a Mac.
		*
		* @param platform - the string produced by {@link detectPlatform}.
		* @returns the label vocabulary for that platform.
		*/
		function platformLabels(platform) {
			const isMac = /mac|iphone|ipad|ipod/u.test(platform);
			const isWindows = /win/u.test(platform);
			const modLabel = isMac ? "⌘" : "Ctrl";
			return {
				platform,
				isMac,
				isWindows,
				modLabel,
				altLabel: isMac ? "⌥" : "Alt",
				shiftLabel: isMac ? "⇧" : "Shift",
				enterLabel: "↵",
				escLabel: isMac ? "esc" : "Esc",
				invokeLabel: isMac ? `${modLabel}K` : `${modLabel} K`
			};
		}
		/** Read `globalThis.navigator` without assuming a DOM (or a DOM lib). */
		function currentNavigator() {
			const candidate = globalThis.navigator;
			if (candidate === null || typeof candidate !== "object") return void 0;
			return candidate;
		}
		/** The labels for the platform this bundle is running on. */
		const LABELS = platformLabels(detectPlatform(currentNavigator()));
		/**
		* Whether a keydown event is the invoke chord advertised by
		* {@link PlatformLabels.invokeLabel}.
		*
		* The hint and the binding have to agree: a footer promising `⌘K` while the
		* handler matches `Ctrl+K` is worse than showing no hint at all. Both sides
		* call this, so neither can be changed alone. Requiring the other modifier to
		* be *absent* keeps the two chords distinct instead of letting either one
		* satisfy both platforms.
		*
		* @param event - the keydown payload.
		* @param isMac - the running platform's macOS-ness, from {@link LABELS}.
		* @returns `true` when the event is the invoke chord.
		*/
		function isInvokeChord(event, isMac) {
			if (event.key !== "k" && event.key !== "K") return false;
			if (event.altKey || event.shiftKey) return false;
			return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
		}
		//#endregion
		//#region src/client/panel.tsx
		/**
		* 搜索子域 client 组件（原 dsh-search-index client 半身的面板部分）。
		*
		* 注册职责（侧栏入口 / 家族 tab / 插件页配置卡）在合并包的 client/index.ts；
		* 本文件只持有：样式表、悬浮搜索面板（标题/内容双模式）、侧栏 footer 按钮、
		* 唤出和弦绑定。
		*
		* The `locale` and config services are consumed structurally: when
		* the host release lacks them the footer falls back to the bundled zh
		* dictionary and the host-composition config layer.
		*/
		/** The coarse filter chips rendered above content results. */
		const CONTENT_TYPE_CHIPS = [
			{
				id: "all",
				labelKey: "filter.all"
			},
			{
				id: "user",
				labelKey: "filter.user"
			},
			{
				id: "reply",
				labelKey: "filter.reply"
			},
			{
				id: "tool",
				labelKey: "filter.tool"
			}
		];
		/** 检索域 chips（标题/内容两模式共用）。 */
		const ARCHIVED_CHIPS = [
			{
				id: "all",
				labelKey: "domain.all"
			},
			{
				id: "active",
				labelKey: "domain.active"
			},
			{
				id: "archived",
				labelKey: "domain.archived"
			}
		];
		/** Result-ordering chips rendered at the right of the same filter row. */
		const SORT_CHIPS = [{
			id: "relevance",
			labelKey: "sort.relevance"
		}, {
			id: "time",
			labelKey: "sort.time"
		}];
		/** 命中粒度 chips（仅内容模式）。 */
		const GROUP_CHIPS = [{
			id: "merge",
			labelKey: "group.merge"
		}, {
			id: "expand",
			labelKey: "group.expand"
		}];
		/**
		* The identity of one content-search request, derived from every input that
		* changes the result set.
		*
		* This is the single owner of that identity. The effect that issues the
		* request and the render path that decides whether the stored result belongs
		* to the current inputs must both come through here: two hand-written copies
		* of the same template literal drift apart silently, and the render path then
		* falls through to its empty `loading` state for every query — results arrive,
		* parse, and are never shown.
		*
		* @param normalized - the trimmed query text.
		* @param contentType - the active content-type filter.
		* @param sortBy - the active result ordering.
		* @param archivedFilter - the retrieval-domain chip (all/active/archived).
		* @returns an opaque key, stable for equal inputs.
		*/
		function contentRequestKey(normalized, contentType, sortBy, archivedFilter, dateRange, groupMode) {
			return `${normalized}\u0000${contentType}\u0000${sortBy}\u0000${archivedFilter}\u0000${dateRange.from}\u0000${dateRange.to}\u0000${groupMode}`;
		}
		/**
		* Persisted ordering preference. Unlike `lastPanelMode` this one survives a
		* page reload — an ordering is a durable preference, not a session mood.
		*/
		const SORT_STORE_KEY = "dsh-search-index.sortBy";
		/** Read the persisted ordering; private mode or a bad value degrades to relevance. */
		function readStoredSort() {
			try {
				return window.localStorage.getItem(SORT_STORE_KEY) === "time" ? "time" : "relevance";
			} catch {
				return "relevance";
			}
		}
		/** Persist the ordering; a storage failure still leaves this session working. */
		function writeStoredSort(next) {
			try {
				window.localStorage.setItem(SORT_STORE_KEY, next);
			} catch {}
		}
		/** 命中粒度持久化（与排序同款：耐久偏好，不是会话情绪）。 */
		const GROUP_STORE_KEY = "dsh-search-index.groupMode";
		function readStoredGroup() {
			try {
				return window.localStorage.getItem(GROUP_STORE_KEY) === "expand" ? "expand" : "merge";
			} catch {
				return "merge";
			}
		}
		function writeStoredGroup(next) {
			try {
				window.localStorage.setItem(GROUP_STORE_KEY, next);
			} catch {}
		}
		/**
		* Local re-sort so the page honours the chosen ordering even against an older
		* host half that ignores `sortBy` and therefore omits `updatedAt` entirely —
		* in that case the host order is left untouched rather than scrambled to NaN.
		*/
		function sortHits(items, sortBy) {
			if (sortBy !== "time") return [...items];
			if (!items.every((item) => typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt))) return [...items];
			return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
		}
		/** Last panel mode used this web session (mode memory, not persisted). */
		let lastPanelMode = "title";
		/** ------------------------------------------------------------------ styles */
		const CSS = `
/* 侧栏 footer 槽位公约（2026-09-26；2026-10-01 收紧行距并强制居中）：一行多
   入口（第三方 dsh-context 等）会互相挤占 —— 宿主 .footerActions 是 nowrap
   flex 行。这里允许容器换行，并把本插件入口钉成独占一整行（flex-basis:100%）；
   其余入口（含第三方）自然落到后续行。justify-content:center 让行内所有入口
   （含不占满行的）统一居中；row-gap:0 配合入口自身 32px 高度压缩纵向占位。
   类名用 [class*=] 中段匹配：宿主是 CSS Module 哈希类名（实测形如
   hHd-Xa_footerActions —— <hash>_<name>，哈希在前），中段跨版本稳定。 */
[class*="footerActions"]{flex-wrap:wrap;justify-content:center;row-gap:0;height:auto;min-height:0}
/* —— 第三方矫正：dsh-context「上下文洞察」入口（2026-10-01）——
   .lc-ov-entry 按"独占整行"设计（width:calc(100% + 4px)、无 justify-content、
   42px 高、不对称 padding），与本槽位公约（每个入口独占一行、行内居中、32px）
   冲突，表现为文字靠左、纵向松散。这里按公约强制矫正；:not() 排除收起轨道的
   36px 圆钮形态。lc-ov-* 是 dsh-context 源码硬编码类名（非构建哈希），跨版本
   稳定（实测 0.56.1 / 0.60.0 规则一致）。 */
.lc-ov-entry:not(.lc-ov-entry-rail){width:auto!important;flex:0 0 100%!important;min-width:0!important;justify-content:center!important;height:32px!important;margin:0!important;padding:0 10px!important}
.lc-ov-entry-label{flex:0 1 auto!important}
.dsws_root{box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 100%;width:100%;min-width:0;container-type:inline-size}
/* 收起轨道：回落自然宽度（根类的 100% 基准只属于宽栏形态），放弃收缩。 */
.dsws_rootRail{flex:none;width:auto;container-type:normal}
/* 高度 32px（内容 22px 行高 + 上下各 5px）：宿主默认 42px 的上下裕度在
   多行堆叠后过于松散；左右内边距对称（10px/10px），否则整行居中时按钮内容
   会因不对称 padding 向左偏 1px。 */
.dsws_button{box-sizing:border-box;display:inline-flex;align-items:center;flex:0 0 auto;min-width:0;gap:8px;height:32px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
.dsws_buttonRail{flex:none;width:28px;height:28px;padding:0;gap:0;justify-content:center;border-radius:50%}
.dsws_button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_button svg{flex:none}
.dsws_trigger.dsws_triggerPage{position:relative;left:auto;top:auto;transform:none;z-index:auto;width:auto;max-width:none;height:100%;max-height:none;border:none;border-radius:0;box-shadow:none;background:transparent}
.dsws_trigger{position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);width:860px;max-width:calc(100vw - 32px);max-height:min(84vh,880px);box-sizing:border-box;background:var(--dsw-specific-tip);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 8px 28px rgba(0,0,0,.16));overflow:hidden;display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family)}
.dsws_toolrow{display:flex;align-items:center;gap:8px;padding:10px 10px 0}
.dsws_mode{display:inline-flex;align-items:center;gap:2px;flex:none;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px}
.dsws_modeBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 8px;font-size:12px;font-weight:500;line-height:20px}
.dsws_modeBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_modeBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_search{flex:auto;min-width:0;height:30px;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;outline:none;padding:0 10px;font:inherit;font-size:13px;line-height:20px}
.dsws_search:focus{border-color:var(--dsw-alias-state-business-primary)}
.dsws_search::placeholder{color:var(--dsw-alias-label-caption)}
.dsws_chips{display:flex;align-items:center;gap:6px;padding:8px 10px 0;flex:none}
.dsws_chipGap{flex:1;min-width:0}
.dsws_sortGroup{display:flex;align-items:center;gap:6px;flex:none}
.dsws_chip{height:24px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;line-height:22px;white-space:nowrap}
.dsws_chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_chipActive{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary)}
.dsws_list{flex:1 1 auto;min-height:0;overflow-y:auto;margin:8px 0 0;padding:0 6px 8px;list-style:none}
.dsws_row{box-sizing:border-box;border-radius:8px;width:100%;padding:7px 8px;cursor:pointer;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:2px;min-width:0}
.dsws_row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsws_rowLine{display:flex;align-items:stretch;gap:4px}
.dsws_rowLine>.dsws_row{flex:1 1 auto;width:auto;min-width:0}
.dsws_delBtn{flex:none;align-self:center;height:24px;box-sizing:border-box;border:1px solid var(--dsw-alias-state-error-primary);background:transparent;color:var(--dsw-alias-state-error-primary);border-radius:999px;padding:0 10px;font-size:12px;line-height:22px;cursor:pointer;white-space:nowrap}
.dsws_delBtn:hover{background:var(--dsw-alias-state-error-primary);color:#fff}
.dsws_delBtnArm{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:#fff;font-weight:600}
.dsws_delBtn:disabled{opacity:.5;cursor:default}
.dsws_rowTitle{display:flex;align-items:center;gap:8px;min-width:0}
.dsws_titleText{flex:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:18px}
.dsws_tag{flex:none;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsws_snippet{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.dsws_meta{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsws_status{color:var(--dsw-alias-label-tertiary);padding:10px 8px 8px;font-size:12px;line-height:18px}
.dsws_error{color:var(--dsw-alias-state-error-primary);padding:8px;font-size:12px;line-height:18px}
.dsws_empty{color:var(--dsw-alias-label-tertiary);padding:10px 8px 8px;font-size:12px;line-height:18px}
.dsws_backdrop{position:fixed;inset:0;z-index:2147482999;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.24));backdrop-filter:blur(var(--dsw-mask-blur,4px))}
.dsws_setRow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsws_setRow:last-child{border-bottom:none}
.dsws_setText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsws_setTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.dsws_setDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsws_seg{display:inline-flex;align-items:center;gap:2px;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px;flex:none}
.dsws_segBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 10px;font-size:12px;font-weight:500;line-height:20px}
.dsws_segBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_segBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_segBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_actBtn{height:26px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:0 10px;font-size:12px;line-height:24px;white-space:nowrap}
.dsws_actBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsws_actBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_btnRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsws_progressWrap{display:flex;flex-direction:column;gap:4px;padding:8px 10px 0}
.dsws_progress{height:6px;border-radius:3px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}
.dsws_progressFill{height:100%;border-radius:3px;background:var(--dsw-alias-state-business-primary);transition:width .4s ease}
.dsws_progressLabel{color:var(--dsw-alias-state-business-primary);font-size:12px;line-height:18px;font-weight:600;font-variant-numeric:tabular-nums}
.dsws_panelFoot{flex:none;display:flex;align-items:center;gap:14px;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.dsws_footItem{display:inline-flex;align-items:center}
.dsws_footItem>.dsws_kbd{margin-right:5px}
.dsws_footGap{flex:1;min-width:0}
.dsws_buttonLabel{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsws_kbd{flex:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:18px;width:auto;height:18px;padding:0 4px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
/*
 * The row shares its width with the session-steward entry (order 12), so at
 * narrow sidebar widths the shortcut chip, not the label, is what yields: the
 * chip is a hint repeated by the entry tooltip and the panel footer, while the
 * label is the entry's identity. Measured in Chrome: the pair needs 230px for
 * both labels plus the chip; below that the chip's 43px is what makes the
 * difference. The query is scoped to the wide form: container-type also
 * applies inline-size containment, which zeroes a flex:none rail root.
 */
@container (max-width: 132px){.dsws_kbd{display:none}}
.dsws_pill{flex:none;display:inline-grid;grid-template-columns:14px max-content;align-items:center;column-gap:4px;height:26px;padding:0 10px;box-sizing:border-box;border:none;border-radius:8px;font-size:12px;font-weight:500;line-height:18px;white-space:nowrap;transition:background-color 160ms ease-out,color 160ms ease-out}
.dsws_pill .dsws_pillIcon{display:grid;place-items:center;width:14px;height:14px}
.dsws_pill .dsws_pillLabel{display:grid;text-align:left}
.dsws_pill .dsws_pillLabel>span{grid-area:1/1}
.dsws_pillReady{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dsws_pillWarn{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}
.dsws_pillError{background:var(--dsw-alias-state-error-tertiary,var(--dsw-alias-state-warn-tertiary));color:var(--dsw-alias-state-error-primary,var(--dsw-alias-state-warn-label))}
.dsws_pillNeutral{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dsws_pillDots span{opacity:0;animation:dsws-reveal-dot 1.5s step-end infinite}
.dsws_pillDots span:nth-child(2){animation-delay:.5s}
.dsws_pillDots span:nth-child(3){animation-delay:1s}
@keyframes dsws-reveal-dot{0%,32%{opacity:0}33%,100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.dsws_pillDots span{animation:none;opacity:1}}
`;
		/** Inject the plugin stylesheet once per activation (removed on disposal). */
		function injectStyles() {
			if (typeof document === "undefined") return () => {};
			if (document.querySelector("style[data-plugin-css=\"dsw-session-search-toggle/styles\"]") !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-search-index";
			tag.dataset.pluginCss = "dsw-session-search-toggle/styles";
			tag.textContent = CSS;
			document.head.appendChild(tag);
			return () => {
				if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
			};
		}
		/** ------------------------------------------------------------------ view */
		/** The floating search panel. */
		function SwitchPanel({ t, onClose, open, variant = "dialog", scope }) {
			const remember = useRememberQuery(scope);
			const bootedRef = (0, react.useRef)(false);
			const bootRef = (0, react.useRef)(null);
			if (!bootedRef.current) {
				bootedRef.current = true;
				bootRef.current = remember ? readSnapshot() : null;
				if (!remember) clearSnapshot();
			}
			const boot = bootRef.current;
			const [mode, setModeState] = (0, react.useState)(boot?.mode ?? lastPanelMode);
			const setMode = (next) => {
				lastPanelMode = next;
				setModeState(next);
			};
			const [query, setQuery] = (0, react.useState)(boot?.query ?? "");
			const [contentType, setContentType] = (0, react.useState)(boot?.contentType ?? "all");
			const [archivedFilter, setArchivedFilter] = (0, react.useState)(boot?.archivedFilter ?? "all");
			const [dateFrom, setDateFrom] = (0, react.useState)(boot?.dateFrom ?? "");
			const [dateTo, setDateTo] = (0, react.useState)(boot?.dateTo ?? "");
			const [locateStatus, setLocateStatus] = (0, react.useState)({});
			const [pendingCold, setPendingCold] = (0, react.useState)(null);
			const [deepProgress, setDeepProgress] = (0, react.useState)(null);
			const cancelRef = (0, react.useRef)({ cancelled: false });
			const [coldNote, setColdNote] = (0, react.useState)(null);
			const [directDelete, setDirectDelete] = (0, react.useState)(false);
			const [armedDelete, setArmedDelete] = (0, react.useState)(null);
			const [deleteBusy, setDeleteBusy] = (0, react.useState)(false);
			const [deleteNote, setDeleteNote] = (0, react.useState)(null);
			const [doctorNote, setDoctorNote] = (0, react.useState)(null);
			const [sortBy, setSortByState] = (0, react.useState)(readStoredSort);
			const setSortBy = (next) => {
				writeStoredSort(next);
				setSortByState(next);
			};
			const [groupMode, setGroupModeState] = (0, react.useState)(readStoredGroup);
			const setGroupMode = (next) => {
				writeStoredGroup(next);
				setGroupModeState(next);
			};
			const [sessions, setSessions] = (0, react.useState)(null);
			const [sessionsError, setSessionsError] = (0, react.useState)(null);
			const [content, setContent] = (0, react.useState)({
				query: "",
				status: "idle",
				items: []
			});
			const [searchStatus, setSearchStatus] = (0, react.useState)({
				available: null,
				rebuilding: false,
				done: 0,
				total: 0,
				count: 0
			});
			const inputRef = (0, react.useRef)(null);
			const listRef = (0, react.useRef)(null);
			const scrollRef = (0, react.useRef)(boot?.scrollTop ?? 0);
			const restoreRef = (0, react.useRef)(boot !== null && boot.scrollTop > 0 ? boot.scrollTop : null);
			const latestRef = (0, react.useRef)({
				mode,
				query,
				contentType,
				archivedFilter,
				dateFrom,
				dateTo
			});
			latestRef.current = {
				mode,
				query,
				contentType,
				archivedFilter,
				dateFrom,
				dateTo
			};
			(0, react.useEffect)(() => {
				if (!remember) return void 0;
				const timer = window.setTimeout(() => {
					const cur = latestRef.current;
					writeSnapshot({
						mode: cur.mode,
						query: cur.query,
						contentType: cur.contentType,
						archivedFilter: cur.archivedFilter,
						dateFrom: cur.dateFrom,
						dateTo: cur.dateTo,
						scrollTop: scrollRef.current
					});
				}, 300);
				return () => {
					window.clearTimeout(timer);
				};
			}, [
				remember,
				mode,
				query,
				contentType,
				archivedFilter,
				dateFrom,
				dateTo
			]);
			(0, react.useEffect)(() => {
				if (!remember) return void 0;
				return () => {
					const cur = latestRef.current;
					writeSnapshot({
						mode: cur.mode,
						query: cur.query,
						contentType: cur.contentType,
						archivedFilter: cur.archivedFilter,
						dateFrom: cur.dateFrom,
						dateTo: cur.dateTo,
						scrollTop: scrollRef.current
					});
				};
			}, [remember]);
			const normalized = query.trim().toLowerCase();
			(0, react.useEffect)(() => {
				let cancelled = false;
				let timer;
				const probe = () => {
					callHostAny("index-status", {}).then((res) => {
						if (cancelled) return;
						if (!res.ok) {
							setSearchStatus({
								available: false,
								reason: "unreachable",
								rebuilding: false,
								done: 0,
								total: 0,
								count: 0
							});
							return;
						}
						const status = res;
						const rebuilding = status.rebuild?.state === "building" || status.rebuild?.state === "swapping";
						setDirectDelete(status.directDelete === true);
						const deepState = status.deepSync?.state;
						setSearchStatus({
							available: status.available ?? false,
							reason: status.reason,
							rebuilding,
							done: status.rebuild?.done ?? 0,
							total: status.rebuild?.total ?? 0,
							count: status.sync?.indexed ?? 0,
							deepSync: deepState,
							deepSyncError: deepState === "failed" ? status.deepSync?.error : void 0
						});
						if (rebuilding || deepState === "drs-syncing" || deepState === "rebuilding") timer = window.setTimeout(probe, 1500);
					});
				};
				probe();
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, []);
			const startIndexBuild = () => {
				setSearchStatus((prev) => ({
					...prev,
					rebuilding: true
				}));
				callHostAny("index-rebuild", {});
			};
			/**
			* 深度同步：先让 DRS 慢速重扫修好自己的投影库，再把本地索引整理一遍。
			* 用于「有些命中定位不到 / 新会话迟迟搜不到」的自我修复。
			*/
			const startDeepSync = () => {
				setSearchStatus((prev) => ({
					...prev,
					deepSync: "drs-syncing"
				}));
				deepSyncIndex();
			};
			/**
			* 生成诊断报告并复制（issue #4 后续）。
			*
			* 编排在宿主侧做（`doctor` 路由）：报告要含环境、结论、每步观测值与可执行命令，
			* 这些只有宿主拿得到（探针、台账、库路径）。客户端只负责复制 —— 两边各拼一份
			* 迟早会分叉。
			*
			* 复制成功顺手清台账：用户已经把它贴进 issue 了，留着只会让下次报告带着
			* 上一轮的旧失败，反而干扰判断。
			*/
			const copyDoctorReport = async () => {
				const res = await fetchDoctorReport();
				if (!res.ok || typeof res.report !== "string") {
					setDoctorNote({
						text: translate(t, "panel.doctor.failed", { error: res.error ?? "?" }),
						failed: true
					});
					return;
				}
				try {
					await navigator.clipboard.writeText(res.report);
					setDoctorNote({
						text: translate(t, "panel.doctor.copied"),
						failed: false
					});
					clearDoctorLedger();
				} catch (err) {
					setDoctorNote({
						text: translate(t, "panel.doctor.copyFailed", { error: String(err instanceof Error ? err.message : err) }),
						failed: true
					});
					console.info(res.report);
				}
			};
			/**
			* 真删一个会话（功能①）：走管理端同款 session-history-purge 链路（内存
			* 全痕删除优先，宿主成功后落墓碑台账）；成功只把该会话从两侧结果面
			* 摸掉——不刷语料、不关面板（失败要能原地重试）。
			*/
			const purgeSession = (sessionId) => {
				setArmedDelete(null);
				setDeleteBusy(true);
				setDeleteNote(null);
				callSteward("session-history-purge", { sessionIds: [sessionId] }).then((res) => {
					if (res.ok) {
						setSessions((prev) => prev === null ? prev : prev.filter((it) => it.sessionId !== sessionId));
						setContent((prev) => ({
							...prev,
							items: prev.items.filter((it) => it.sessionId !== sessionId)
						}));
						setDeleteNote({
							text: translate(t, "panel.delete.done", { n: res.purged ?? 1 }),
							failed: false
						});
					} else setDeleteNote({
						text: translate(t, "panel.delete.failed", { error: res.error ?? "?" }),
						failed: true
					});
				}).finally(() => {
					setDeleteBusy(false);
				});
			};
			/** 行内删除按钮（仅 directDelete 开启时参与渲染）：两步确认，第一击上弦。 */
			const deleteBtn = (sessionId) => (0, react.createElement)("button", {
				key: "del",
				type: "button",
				className: `dsws_delBtn${armedDelete === sessionId ? " dsws_delBtnArm" : ""}`,
				title: translate(t, "panel.delete.hint"),
				disabled: deleteBusy,
				onClick: () => {
					if (armedDelete === sessionId) purgeSession(sessionId);
					else setArmedDelete(sessionId);
				}
			}, armedDelete === sessionId ? translate(t, "panel.delete.confirm") : translate(t, "panel.delete"));
			(0, react.useEffect)(() => {
				if (sessions !== null) return;
				let cancelled = false;
				callHost("list-sessions", {}).then((res) => {
					if (cancelled) return;
					if (res.ok) {
						setSessions(res.items);
						setSessionsError(null);
					} else setSessionsError(res.error ?? translate(t, "panel.sessionsError.bare"));
				});
				return () => {
					cancelled = true;
				};
			}, [sessions]);
			(0, react.useEffect)(() => {
				if (mode !== "content" || normalized === "") {
					if (mode !== "content") setContent({
						query: normalized,
						status: "idle",
						items: []
					});
					return;
				}
				let cancelled = false;
				const requestType = contentType;
				const requestKey = contentRequestKey(normalized, requestType, sortBy, archivedFilter, {
					from: dateFrom,
					to: dateTo
				}, groupMode);
				setContent((prev) => ({
					query: requestKey,
					status: "loading",
					items: prev.query === requestKey ? prev.items : []
				}));
				const timer = window.setTimeout(() => {
					callHost("content-search", {
						query: normalized,
						limit: 50,
						types: requestType === "all" ? void 0 : [requestType],
						sortBy,
						archived: archivedFilter,
						expand: groupMode === "expand" || void 0,
						from: dateFrom === "" ? void 0 : dateFrom,
						to: dateTo === "" ? void 0 : dateTo
					}).then((res) => {
						if (cancelled) return;
						setContent({
							query: requestKey,
							status: res.ok ? "ready" : "error",
							items: res.ok ? sortHits(res.items, sortBy) : [],
							error: res.ok ? void 0 : res.error ?? translate(t, "panel.searchFailed"),
							code: res.ok ? void 0 : res.code,
							detail: res.ok ? void 0 : res.detail
						});
					});
				}, 250);
				return () => {
					cancelled = true;
					window.clearTimeout(timer);
				};
			}, [
				mode,
				normalized,
				contentType,
				sortBy,
				archivedFilter,
				dateFrom,
				dateTo,
				groupMode
			]);
			(0, react.useEffect)(() => {
				inputRef.current?.focus();
			}, []);
			(0, react.useEffect)(() => {
				const onKey = (e) => {
					if (e.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			const dateRangeMs = (0, react.useMemo)(() => {
				const parse = (value, nextDay) => {
					if (value === "") return void 0;
					const [year, month, day] = value.split("-").map(Number);
					if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return void 0;
					const date = new Date(year, month - 1, day);
					if (nextDay) date.setDate(date.getDate() + 1);
					return date.getTime();
				};
				const from = parse(dateFrom, false);
				const to = parse(dateTo, true);
				return {
					...from === void 0 ? {} : { from },
					...to === void 0 ? {} : { to }
				};
			}, [dateFrom, dateTo]);
			const titleRows = (0, react.useMemo)(() => {
				if (sessions === null) return [];
				const byDomain = sessions.filter((item) => archivedFilter === "active" ? item.archived !== true : archivedFilter === "archived" ? item.archived === true : true);
				const byDate = byDomain.filter((item) => (dateRangeMs.from === void 0 || item.updatedAt >= dateRangeMs.from) && (dateRangeMs.to === void 0 || item.updatedAt < dateRangeMs.to));
				if (normalized === "") return byDate;
				return byDomain.filter((item) => item.title.toLowerCase().includes(normalized) || item.cwd.toLowerCase().includes(normalized));
			}, [
				sessions,
				normalized,
				archivedFilter,
				dateRangeMs
			]);
			const runPlainLocate = (hit, hitKey) => {
				setLocateStatus((s) => ({
					...s,
					[hitKey]: "pending"
				}));
				locateSearchHit(hit).then((ok) => {
					setLocateStatus((s) => ({
						...s,
						[hitKey]: ok ? "ok" : "fail"
					}));
				});
			};
			const runDeepLocate = (hit, hitKey) => {
				cancelRef.current = { cancelled: false };
				setDeepProgress({
					key: hitKey,
					pulled: 0,
					budget: 1
				});
				setLocateStatus((s) => ({
					...s,
					[hitKey]: "pending"
				}));
				const hudText = (pulled, budget) => translate(t, "hud.progress", {
					pulled,
					budget
				});
				const cancelBtn = () => ({
					label: translate(t, "cold.confirm.cancel"),
					onClick: () => {
						cancelRef.current.cancelled = true;
						hideLocateHud();
						setDeepProgress(null);
						setLocateStatus((s) => ({
							...s,
							[hitKey]: "fail"
						}));
					}
				});
				let initialBudget = 40;
				let lastBudget = 40;
				let budgetSeen = false;
				const MAX_RETRY = 2;
				const enterBacktrack = (pageBudget, attempt = 0) => {
					showLocateHud(hudText(0, pageBudget ?? initialBudget), [cancelBtn()]);
					locateSearchHit(hit, {
						deep: true,
						pageBudget,
						onProgress: (pulled, budget) => {
							if (!budgetSeen) {
								budgetSeen = true;
								initialBudget = budget;
							}
							lastBudget = Math.max(lastBudget, budget);
							setDeepProgress({
								key: hitKey,
								pulled,
								budget
							});
							updateLocateHud(hudText(pulled, budget));
						},
						cancel: cancelRef.current
					}).then((ok) => {
						setLocateStatus((s) => ({
							...s,
							[hitKey]: ok ? "ok" : "fail"
						}));
						setDeepProgress(null);
						if (ok) {
							showLocateHud(translate(t, "hud.done"), [{
								label: translate(t, "hud.jump"),
								primary: true,
								onClick: () => {
									hideLocateHud();
									locateSearchHit(hit, { forceLand: true });
								}
							}, cancelBtn()]);
							return;
						}
						const buttons = [];
						if (attempt < MAX_RETRY) buttons.push({
							label: translate(t, "hud.retry"),
							primary: true,
							onClick: () => {
								enterBacktrack(Math.min(40, lastBudget + initialBudget), attempt + 1);
							}
						});
						buttons.push({
							label: translate(t, "hud.close"),
							onClick: () => {
								hideLocateHud();
							}
						});
						showLocateHud(translate(t, "hud.fail"), buttons);
					});
				};
				enterBacktrack();
			};
			const handleHitClick = (hit) => {
				const hitKey = `${hit.sessionId}:${hit.seq}`;
				setArmedDelete(null);
				setColdNote(null);
				const cls = classifyHit(hit);
				if (cls === "cold") {
					(async () => {
						if (await probeHitInDom(hit)) {
							open(hit.sessionId);
							runPlainLocate(hit, hitKey);
							return;
						}
						setPendingCold({
							hit,
							gap: typeof hit.turnGap === "number" ? hit.turnGap : 0
						});
					})();
					return;
				}
				if (cls === "too-cold") {
					setColdNote(translate(t, "toocold.hint"));
					return;
				}
				open(hit.sessionId);
				runPlainLocate(hit, hitKey);
			};
			const children = [];
			if (deleteNote !== null) children.push((0, react.createElement)("div", {
				key: "delnote",
				className: deleteNote.failed ? "dsws_error" : "dsws_status"
			}, deleteNote.text));
			if (doctorNote !== null) children.push((0, react.createElement)("div", {
				key: "doctornote",
				className: doctorNote.failed ? "dsws_error" : "dsws_status"
			}, doctorNote.text));
			if (coldNote !== null) children.push((0, react.createElement)("div", {
				key: "coldnote",
				className: "dsws_status"
			}, coldNote));
			if (pendingCold !== null) {
				const pk = `${pendingCold.hit.sessionId}:${pendingCold.hit.seq}`;
				const pages = Math.max(1, Math.ceil(pendingCold.gap / 40));
				children.push((0, react.createElement)("div", {
					key: "coldconfirm",
					className: "dsws_status",
					style: {
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: "8px",
						padding: "8px",
						border: "1px solid var(--dsw-alias-border-default, #444)",
						borderRadius: "6px"
					}
				}, [
					(0, react.createElement)("span", { key: "msg" }, translate(t, "cold.confirm.body", {
						gap: pendingCold.gap,
						pages
					})),
					(0, react.createElement)("button", {
						key: "ok",
						type: "button",
						className: "dsws_actBtn",
						onClick: () => {
							const hit = pendingCold.hit;
							setPendingCold(null);
							open(hit.sessionId);
							runDeepLocate(hit, pk);
						}
					}, translate(t, "cold.confirm.ok")),
					(0, react.createElement)("button", {
						key: "cancel",
						type: "button",
						className: "dsws_actBtn",
						onClick: () => {
							setPendingCold(null);
						}
					}, translate(t, "cold.confirm.cancel"))
				]));
			}
			if (sessionsError !== null) children.push((0, react.createElement)("div", {
				key: "err",
				className: "dsws_error"
			}, translate(t, "panel.sessionsError", { error: sessionsError })));
			const activeRequestKey = contentRequestKey(normalized, contentType, sortBy, archivedFilter, {
				from: dateFrom,
				to: dateTo
			}, groupMode);
			const activeContent = content.query === activeRequestKey ? content : {
				query: activeRequestKey,
				status: "loading",
				items: []
			};
			const listReady = mode === "title" ? sessions !== null && titleRows.length > 0 : activeContent.status === "ready" && activeContent.items.length > 0;
			(0, react.useEffect)(() => {
				const target = restoreRef.current;
				if (target === null || target <= 0) return;
				if (!listReady) return;
				const list = listRef.current;
				if (list === null) return;
				list.scrollTop = clampScroll(target, list.scrollHeight, list.clientHeight);
				restoreRef.current = null;
			}, [listReady, mode]);
			const hasRestorable = query !== "" || contentType !== "all" || archivedFilter !== "all" || dateFrom !== "" || dateTo !== "" || restoreRef.current !== null;
			/** 一键回到空白检索：重置六项 + 清快照 + 丢掉待恢复的滚动目标。 */
			const clearHistory = () => {
				setQuery("");
				setContentType("all");
				setArchivedFilter("all");
				setDateFrom("");
				setDateTo("");
				scrollRef.current = 0;
				restoreRef.current = null;
				clearSnapshot();
				if (listRef.current !== null) listRef.current.scrollTop = 0;
			};
			if (mode === "title") {
				if (sessions === null) children.push((0, react.createElement)("div", {
					key: "loading",
					className: "dsws_status"
				}, translate(t, "panel.loadingSessions")));
				else if (titleRows.length === 0) children.push((0, react.createElement)("div", {
					key: "empty",
					className: "dsws_empty"
				}, normalized === "" ? translate(t, "panel.noSessions") : translate(t, "panel.noMatch")));
				else children.push((0, react.createElement)("ul", {
					key: "list",
					ref: listRef,
					className: "dsws_list",
					role: "listbox",
					"aria-label": translate(t, "panel.titleSearch"),
					onScroll: (e) => {
						scrollRef.current = e.currentTarget.scrollTop;
					}
				}, titleRows.slice(0, 200).map((item) => (0, react.createElement)("li", {
					key: item.sessionId,
					role: "option"
				}, (0, react.createElement)("div", { className: "dsws_rowLine" }, [(0, react.createElement)("button", {
					key: "row",
					type: "button",
					className: "dsws_row",
					onClick: () => {
						setArmedDelete(null);
						open(item.sessionId);
					}
				}, [(0, react.createElement)("span", {
					key: "t",
					className: "dsws_rowTitle"
				}, [
					(0, react.createElement)("span", {
						key: "x",
						className: "dsws_titleText"
					}, item.title || translate(t, "panel.untitled")),
					item.archived === true && (0, react.createElement)("span", {
						key: "arch",
						className: "dsws_tagArch"
					}, translate(t, "tag.archived")),
					(0, react.createElement)("span", {
						key: "tag",
						className: "dsws_tag"
					}, fmtTime(item.updatedAt))
				]), item.cwd !== "" && (0, react.createElement)("span", {
					key: "c",
					className: "dsws_meta"
				}, item.cwd)]), directDelete && deleteBtn(item.sessionId)])))));
			} else if (searchStatus.rebuilding) {
				const pct = searchStatus.total > 0 ? Math.min(100, Math.round(searchStatus.done / searchStatus.total * 100)) : void 0;
				children.push((0, react.createElement)("div", {
					key: "rebuilding",
					className: "dsws_progressWrap"
				}, [(0, react.createElement)("div", {
					key: "bar",
					className: "dsws_progress"
				}, (0, react.createElement)("div", {
					className: "dsws_progressFill",
					style: pct === void 0 ? {
						width: "30%",
						opacity: .6
					} : { width: `${pct}%` }
				})), (0, react.createElement)("span", {
					key: "label",
					className: "dsws_progressLabel"
				}, translate(t, "panel.rebuilding", {
					done: searchStatus.done,
					total: searchStatus.total || "?"
				}))]));
			} else if (searchStatus.available === false) children.push((0, react.createElement)("div", {
				key: "unavailable",
				className: "dsws_error"
			}, [(0, react.createElement)("div", { key: "msg" }, searchStatus.reason === "unreachable" ? translate(t, "panel.indexUnreachable") : searchStatus.reason === "unavailable" ? translate(t, "panel.unavailable") : translate(t, "panel.notBuilt")), (0, react.createElement)("button", {
				key: "build",
				type: "button",
				className: "dsws_actBtn",
				style: { marginTop: "6px" },
				onClick: startIndexBuild
			}, translate(t, "panel.buildIndex"))]));
			else if (searchStatus.deepSync === "failed" && searchStatus.deepSyncError !== void 0)
 /**
			* 深度同步失败的可见原因（issue #4）。
			*
			* 放在列表区而不是只挂在按钮 title 上：`title` 悬停才出现，而用户报 issue 时
			* 能贴出来的只有屏幕上看得见的字。宿主半边抓到的 `deepSync.error` 原样展示，
			* 因为它通常就是 `HTTP 404` / `fetch failed` 这类可直接对照原因的短语。
			*/
			children.push((0, react.createElement)("div", {
				key: "deepsync-failed",
				className: "dsws_error"
			}, [(0, react.createElement)("div", { key: "msg" }, translate(t, "panel.deepSync.failedReason", { error: searchStatus.deepSyncError })), (0, react.createElement)("button", {
				key: "retry",
				type: "button",
				className: "dsws_actBtn",
				style: { marginTop: "6px" },
				onClick: startDeepSync
			}, translate(t, "panel.deepSync.retry"))]));
			else if (activeContent.status === "loading") children.push((0, react.createElement)("div", {
				key: "loading",
				className: "dsws_status"
			}, translate(t, "panel.loadingContent")));
			else if (activeContent.status === "error") {
				const text = activeContent.code === void 0 ? translate(t, "panel.contentError", { error: activeContent.error ?? translate(t, "panel.unknownError") }) : translate(t, `panel.contentErr.${activeContent.code}`, { error: activeContent.detail ?? "" });
				children.push((0, react.createElement)("div", {
					key: "error",
					className: "dsws_error"
				}, text));
			} else if (activeContent.items.length === 0) children.push((0, react.createElement)("div", {
				key: "empty",
				className: "dsws_empty"
			}, normalized === "" ? translate(t, "panel.contentHint") : translate(t, "panel.noContent")));
			else children.push((0, react.createElement)("ul", {
				key: "list",
				ref: listRef,
				className: "dsws_list",
				role: "listbox",
				"aria-label": translate(t, "panel.contentSearch"),
				onScroll: (e) => {
					scrollRef.current = e.currentTarget.scrollTop;
				}
			}, activeContent.items.slice(0, 200).map((item) => (0, react.createElement)("li", {
				key: `${item.sessionId}:${item.seq}`,
				role: "option"
			}, (0, react.createElement)("div", { className: "dsws_rowLine" }, [(0, react.createElement)("button", {
				key: "row",
				type: "button",
				className: "dsws_row",
				onClick: () => handleHitClick(item)
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dsws_rowTitle"
			}, [
				(0, react.createElement)("span", {
					key: "x",
					className: "dsws_titleText"
				}, [item.title || translate(t, "panel.untitled"), ...classifyHit(item) === "cold" ? [(0, react.createElement)("span", {
					key: "cold",
					title: translate(t, "cold.badge.hint")
				}, " 🧊")] : classifyHit(item) === "too-cold" ? [(0, react.createElement)("span", {
					key: "cold",
					title: translate(t, "toocold.badge.hint")
				}, " ❄️")] : []]),
				(0, react.createElement)("span", {
					key: "tag",
					className: "dsws_tag"
				}, typeLabel(t, item.type)),
				(0, react.createElement)("span", {
					key: "time",
					className: "dsws_tag"
				}, fmtTime(groupMode === "expand" ? item.time : item.updatedAt)),
				...locateStatus[`${item.sessionId}:${item.seq}`] === void 0 ? [] : [(0, react.createElement)("span", {
					key: "loc",
					className: "dsws_tag",
					title: locateStatus[`${item.sessionId}:${item.seq}`] === "pending" ? translate(t, "panel.locate.pending") : locateStatus[`${item.sessionId}:${item.seq}`] === "ok" ? translate(t, "panel.locate.ok") : translate(t, "panel.locate.miss")
				}, locateStatus[`${item.sessionId}:${item.seq}`] === "pending" ? deepProgress?.key === `${item.sessionId}:${item.seq}` ? `⏳ ${String(deepProgress.pulled)}/${String(deepProgress.budget)}` : "⏳" : locateStatus[`${item.sessionId}:${item.seq}`] === "ok" ? "✓" : "✗")]
			]), (0, react.createElement)("span", {
				key: "s",
				className: "dsws_snippet"
			}, item.snippet || translate(t, "panel.noText"))]), directDelete && deleteBtn(item.sessionId)])))));
			const panelEl = (0, react.createElement)("div", {
				key: "panel",
				className: variant === "page" ? "dsws_trigger dsws_triggerPage" : "dsws_trigger",
				role: variant === "page" ? "region" : "dialog",
				"aria-label": translate(t, "card.title")
			}, [
				(0, react.createElement)("div", {
					key: "tools",
					className: "dsws_toolrow"
				}, [(0, react.createElement)("div", {
					key: "mode",
					className: "dsws_mode",
					role: "group",
					"aria-label": translate(t, "card.defaultMode")
				}, [(0, react.createElement)("button", {
					key: "title",
					type: "button",
					className: `dsws_modeBtn${mode === "title" ? " dsws_modeBtnActive" : ""}`,
					onClick: () => {
						setMode("title");
					}
				}, translate(t, "panel.titleSearch")), (0, react.createElement)("button", {
					key: "content",
					type: "button",
					className: `dsws_modeBtn${mode === "content" ? " dsws_modeBtnActive" : ""}`,
					onClick: () => {
						setMode("content");
					}
				}, translate(t, "panel.contentSearch"))]), (0, react.createElement)("input", {
					key: "search",
					ref: inputRef,
					className: "dsws_search",
					type: "text",
					placeholder: mode === "title" ? translate(t, "panel.searchTitle") : translate(t, "panel.searchContent"),
					value: query,
					onChange: (e) => setQuery(e.target.value)
				})]),
				(0, react.createElement)("div", {
					key: "chips",
					className: "dsws_chips",
					role: "group",
					"aria-label": translate(t, "domain.all")
				}, [
					...ARCHIVED_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: chip.id,
						type: "button",
						className: `dsws_chip${archivedFilter === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": archivedFilter === chip.id,
						onClick: () => {
							setArchivedFilter(chip.id);
						}
					}, translate(t, chip.labelKey))),
					(0, react.createElement)("input", {
						key: "from",
						type: "date",
						className: "dsws_search",
						style: {
							flex: "none",
							width: "128px",
							height: "24px",
							padding: "0 6px",
							fontSize: "12px"
						},
						value: dateFrom,
						title: translate(t, "date.from"),
						onChange: (e) => {
							setDateFrom(e.target.value);
						}
					}),
					(0, react.createElement)("input", {
						key: "to",
						type: "date",
						className: "dsws_search",
						style: {
							flex: "none",
							width: "128px",
							height: "24px",
							padding: "0 6px",
							fontSize: "12px"
						},
						value: dateTo,
						title: translate(t, "date.to"),
						onChange: (e) => {
							setDateTo(e.target.value);
						}
					}),
					...mode === "content" ? CONTENT_TYPE_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: chip.id,
						type: "button",
						className: `dsws_chip${contentType === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": contentType === chip.id,
						onClick: () => {
							setContentType(chip.id);
						}
					}, translate(t, chip.labelKey))) : [],
					...mode === "content" ? GROUP_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: `g-${chip.id}`,
						type: "button",
						className: `dsws_chip${groupMode === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": groupMode === chip.id,
						title: translate(t, chip.id === "expand" ? "group.expand.hint" : "group.merge.hint"),
						onClick: () => {
							setGroupMode(chip.id);
						}
					}, translate(t, chip.labelKey))) : [],
					(0, react.createElement)("span", {
						key: "gap",
						className: "dsws_chipGap"
					}),
					...mode === "content" ? [(0, react.createElement)("span", {
						key: "sort",
						className: "dsws_sortGroup",
						role: "group",
						"aria-label": translate(t, "sort.label")
					}, SORT_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: chip.id,
						type: "button",
						className: `dsws_chip${sortBy === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": sortBy === chip.id,
						title: chip.id === "time" ? translate(t, "sort.time.hint") : translate(t, "sort.relevance.hint"),
						onClick: () => {
							setSortBy(chip.id);
						}
					}, translate(t, chip.labelKey))))] : [],
					remember && hasRestorable ? (0, react.createElement)("button", {
						key: "clearHistory",
						type: "button",
						className: "dsws_chip",
						title: translate(t, "panel.history.clear.hint"),
						onClick: clearHistory
					}, translate(t, "panel.history.clear")) : null
				]),
				children,
				(0, react.createElement)("div", {
					key: "foot",
					className: "dsws_panelFoot"
				}, [
					(0, react.createElement)("span", {
						key: "index",
						className: "dsws_footItem"
					}, [
						(0, react.createElement)("span", { key: "label" }, searchStatus.rebuilding ? translate(t, "panel.index.rebuilding", {
							done: searchStatus.done,
							total: searchStatus.total || "?"
						}) : searchStatus.available === false ? translate(t, "panel.index.none") : translate(t, "panel.index.count", { n: searchStatus.count })),
						(0, react.createElement)("button", {
							key: "rebuild",
							type: "button",
							className: "dsws_actBtn",
							style: {
								height: "20px",
								padding: "0 8px",
								fontSize: "11px",
								lineHeight: "18px"
							},
							disabled: searchStatus.rebuilding,
							title: translate(t, "card.index.rebuild.hint"),
							onClick: startIndexBuild
						}, searchStatus.rebuilding ? translate(t, "card.index.rebuilding.btn") : translate(t, "card.index.rebuild")),
						(0, react.createElement)("button", {
							key: "deepSync",
							type: "button",
							className: "dsws_actBtn",
							style: {
								height: "20px",
								padding: "0 8px",
								fontSize: "11px",
								lineHeight: "18px"
							},
							disabled: searchStatus.deepSync === "drs-syncing" || searchStatus.deepSync === "rebuilding",
							/**
							* 失败时 title 换成具体原因（issue #4）：宿主半边抓到的错误一直存在
							* `deepSync.error` 里，但面板此前只画「同步失败」，用户拿不到任何可排查
							* 的线索。成功/进行中的 title 仍是操作提示。
							*/
							title: searchStatus.deepSync === "failed" && searchStatus.deepSyncError !== void 0 ? searchStatus.deepSyncError : translate(t, "panel.deepSync.hint"),
							onClick: startDeepSync
						}, searchStatus.deepSync === "drs-syncing" ? translate(t, "panel.deepSync.drs") : searchStatus.deepSync === "rebuilding" ? translate(t, "panel.deepSync.rebuild") : searchStatus.deepSync === "done" ? translate(t, "panel.deepSync.done") : searchStatus.deepSync === "failed" ? translate(t, "panel.deepSync.failed") : translate(t, "panel.deepSync")),
						(0, react.createElement)("button", {
							key: "doctor",
							type: "button",
							className: "dsws_actBtn",
							style: {
								height: "20px",
								padding: "0 8px",
								fontSize: "11px",
								lineHeight: "18px"
							},
							/**
							* 诊断报告（issue #4 后续）：把异常台账 + 探针现状编排成一份可粘贴的
							* Markdown，每步带可执行命令。报 issue 的人拿不到宿主日志，这份报告
							* 就是替代品 —— 复制成功会顺手清台账，避免下次报告带着旧失败。
							*/
							title: translate(t, "panel.doctor.hint"),
							onClick: () => {
								copyDoctorReport();
							}
						}, translate(t, "panel.doctor"))
					]),
					(0, react.createElement)("span", {
						key: "invoke",
						className: "dsws_footItem"
					}, [(0, react.createElement)("kbd", {
						key: "k",
						className: "dsws_kbd"
					}, LABELS.invokeLabel), translate(t, "panel.footer.invoke")]),
					(0, react.createElement)("span", {
						key: "gap",
						className: "dsws_footGap"
					}),
					(0, react.createElement)("span", {
						key: "close",
						className: "dsws_footItem"
					}, [(0, react.createElement)("kbd", {
						key: "k",
						className: "dsws_kbd"
					}, LABELS.escLabel), translate(t, "panel.footer.close")])
				])
			]);
			if (variant === "page") return panelEl;
			return (0, react_dom.createPortal)((0, react.createElement)("div", { key: "switch-root" }, [(0, react.createElement)("div", {
				key: "backdrop",
				className: "dsws_backdrop",
				onClick: onClose
			}), panelEl]), document.body);
		}
		/**
		* Whether the user has the sidebar entry switched on.
		*
		* The `enabled` field has existed since the card shipped, but nothing read it:
		* the switch promised "show the search entry at the bottom of the sidebar" and
		* controlled nothing at all. Reading it here is the whole fix.
		*
		* An absent or unreadable scope keeps the entry visible — a settings service we
		* cannot read is not a user asking for the feature off, and hiding the entry
		* would also hide the only way back to the panel.
		*
		* @param scope - the bound `switch-search` namespace scope, when available.
		* @returns `false` only when a readable scope says the entry is switched off.
		*/
		function useEntryEnabled(scope) {
			return (0, react.useSyncExternalStore)((listener) => scope?.subscribe(listener) ?? (() => {}), () => scope?.getSnapshot())?.value?.enabled !== false;
		}
		/**
		* Whether the panel should remember the last search scene.
		*
		* 与 {@link useEntryEnabled} 结构同款，但**默认方向相反**：读不到设置时按
		* **关**处理。理由：`enabled` 缺省是开（入口消失会让用户找不到回来的路），
		* 而「记忆用户输入」是一件需要被同意的事——读不到同意就不做。
		*
		* 特别注意这里必须写 `=== true` 而不是 `!== false`：后者会把 undefined
		* 判成「开」，一次符号写反就是一次未经同意的行为变更。
		*
		* @param scope - the bound `switch-search` namespace scope, when available.
		* @returns `true` only when a readable scope says `rememberQuery` is on.
		*/
		function useRememberQuery(scope) {
			return (0, react.useSyncExternalStore)((listener) => scope?.subscribe(listener) ?? (() => {}), () => scope?.getSnapshot())?.value?.rememberQuery === true;
		}
		/** The footer entry: one icon button that opens the search panel. */
		function SwitchFooter({ t, wide, open, scope }) {
			const [openPanel, setOpenPanel] = (0, react.useState)(false);
			const enabled = useEntryEnabled(scope);
			(0, react.useEffect)(() => {
				if (!enabled) return void 0;
				const onKey = (event) => {
					if (!isInvokeChord(event, LABELS.isMac)) return;
					event.preventDefault();
					setOpenPanel(true);
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [enabled]);
			if (!enabled) return null;
			return (0, react.createElement)("div", { className: wide ? "dsws_root" : "dsws_root dsws_rootRail" }, [(0, react.createElement)("button", {
				key: "btn",
				type: "button",
				className: wide ? "dsws_button" : "dsws_button dsws_buttonRail",
				title: `${translate(t, "panel.entry")}（${LABELS.invokeLabel}）`,
				"aria-label": `${translate(t, "panel.entry")}（${translate(t, "panel.titleSearch")} / ${translate(t, "panel.contentSearch")}，${LABELS.invokeLabel}）`,
				"aria-expanded": openPanel,
				onClick: () => {
					setOpenPanel(true);
				}
			}, [
				searchIcon(),
				wide && (0, react.createElement)("span", {
					key: "label",
					className: "dsws_buttonLabel"
				}, translate(t, "panel.entry")),
				wide && (0, react.createElement)("kbd", {
					key: "key",
					className: "dsws_kbd"
				}, LABELS.invokeLabel)
			]), openPanel && (0, react.createElement)(SwitchPanel, {
				key: "panel",
				t,
				scope,
				onClose: () => {
					setOpenPanel(false);
				},
				open: (sessionId) => {
					setOpenPanel(false);
					open(sessionId);
				}
			})]);
		}
		/** ------------------------------------------------------------------ helpers */
		/** Format an epoch-ms timestamp: today → HH:mm, else YYYY-MM-DD HH:mm. */
		function fmtTime(ms) {
			if (!ms || typeof ms !== "number") return "";
			try {
				const d = new Date(ms);
				const now = /* @__PURE__ */ new Date();
				const pad = (n) => String(n).padStart(2, "0");
				const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
				const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
				if (sameDay) return time;
				return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
			} catch {
				return "";
			}
		}
		/** Short label for a content-hit event type. */
		function typeLabel(t, type) {
			if (type === "user/message" || type === "assistant/message" || type === "tool/call" || type === "tool/result") return translate(t, `type.${type}`);
			return type;
		}
		/** Inline search icon (stroke aligned with the product's 1.75 hairline). */
		function searchIcon() {
			return (0, react.createElement)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true
			}, (0, react.createElement)("circle", {
				cx: 7,
				cy: 7,
				r: 4.5,
				stroke: "currentColor",
				strokeWidth: 1.75,
				fill: "none"
			}), (0, react.createElement)("path", {
				d: "M10.5 10.5 L14 14",
				stroke: "currentColor",
				strokeWidth: 1.75,
				strokeLinecap: "round"
			}));
		}
		//#endregion
		//#region src/client/index.ts
		/** 客户端插件声明的注入面。 */
		const inject = ["slots", "locale"];
		/** 017+ 页 id / 面板行 id / main key（同一值）。 */
		const PANEL_ID = "dsh-search-index";
		/** 面板行与底栏入口的 order：落在「插件」(0) 之后、「会话管理」(6) 之前。 */
		const ENTRY_ORDER = 5;
		/** 顶栏工具槽位（面板行列表）。 */
		const PANEL_SEAT = "sidebar.panellist";
		/** 主栏整页槽位（keyed）。 */
		const MAIN_SEAT = "main";
		/** 017 代际信号：0.1.7 线起声明的会话菜单子席位（0.1.5 线无）。 */
		const GEN_017_SEAT = "sidebar.workspaces.session.menu.item";
		/**
		* 入口按钮壳：把设置 scope 绑到搜索入口组件上（底栏弹窗形态）。
		* @param props - 宿主给的槽位 props + 绑定面。
		*/
		function FooterEntry(props) {
			return (0, react.createElement)(SwitchFooter, {
				wide: props.wide === true,
				open: props.open,
				scope: props.scope
			});
		}
		/**
		* 整页形态：搜索面板占满主栏（017+）。
		* @param props - 关闭动作 + 打开会话回调（真实导航，不是空函数）。
		*/
		function SearchPage(props) {
			return (0, react.createElement)(SwitchPanel, {
				variant: "page",
				onClose: props.onClose,
				scope: props.scope,
				open: (sessionId) => {
					props.onClose();
					props.openSession(sessionId);
				}
			});
		}
		/**
		* 客户端插件主体。
		* @param ctx - 客户端上下文（slots、可选 locale / configForms / layout / conversation）。
		*/
		function apply(ctx) {
			ctx.effect(() => injectStyles(), "dsh-search-index: stylesheet");
			const locale = ctx.get("locale");
			if (locale !== void 0 && typeof locale.register === "function") {
				ctx.effect(() => locale.register(NS, dictionaries), "dsh-search-index: dictionaries");
				if (typeof locale.bind === "function") bindDefaultSeat(locale.bind(NS));
			}
			const bound = withBridgeFallback(ctx.get("configForms")?.get(PANEL_ID), searchBridgeScope());
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			const openHit = (sessionId) => {
				openSessionThrough((name) => ctx.get(name), sessionId);
			};
			configureLocator({ loadOlder: async () => {
				const earlier = /^(加载更早|正在加载更早|载入更早|加载历史|Load earlier|Load older|Loading earlier|Loading older)/i;
				const btn = Array.from(document.querySelectorAll("button")).find((b) => earlier.test((b.textContent || "").trim()));
				if (btn !== void 0) {
					if (!btn.disabled) btn.click();
					return true;
				}
				try {
					const conv = ctx.get("conversation");
					if (conv !== void 0 && typeof conv.loadOlder === "function") {
						await conv.loadOlder();
						return true;
					}
				} catch {
					return false;
				}
				return false;
			} });
			/** 回退到会话（017+ 页内关闭 / 快捷键占位）。 */
			const closePage = () => {
				try {
					ctx.get("layout")?.selectPanel?.(null);
				} catch {}
			};
			/** 打开 017+ 页（点行之外的另一条路：快捷键）。 */
			const openPage = () => {
				try {
					ctx.get("layout")?.selectPanel?.(PANEL_ID);
				} catch {}
			};
			ctx.effect(() => {
				let gen017 = false;
				let mainSeat = false;
				let wired = false;
				let footerOff;
				let pageOff;
				let chordOff;
				const mountPage = () => {
					const row = slots.inject(PANEL_SEAT, () => slots.register({
						name: PANEL_SEAT,
						id: PANEL_ID,
						order: ENTRY_ORDER,
						label: () => translate(locale?.bind?.(NS), "card.title"),
						locale: NS
					}, () => (0, react.createElement)(SearchIcon, {})), "dsh-search-index: sidebar tool row");
					const page = slots.inject(MAIN_SEAT, () => slots.register({
						name: MAIN_SEAT,
						key: PANEL_ID,
						locale: NS
					}, () => (0, react.createElement)(PageHost, {
						onClose: closePage,
						openSession: openHit,
						scope: bound
					})), "dsh-search-index: main page");
					return () => {
						page();
						row();
					};
				};
				const mountFooter = () => slots.inject("sidebar.footer.action", () => slots.register({
					name: "sidebar.footer.action",
					id: PANEL_ID,
					order: ENTRY_ORDER,
					locale: NS
				}, (props) => (0, react.createElement)(FooterEntry, {
					...props,
					scope: bound,
					open: openHit
				})), "dsh-search-index: sidebar footer entry");
				const sync = () => {
					const pageReady = gen017 && mainSeat;
					if (pageReady && pageOff === void 0) {
						if (footerOff !== void 0) {
							const off = footerOff;
							footerOff = void 0;
							off();
						}
						pageOff = mountPage();
						chordOff = bindInvokeChord(() => {
							openPage();
						});
						return;
					}
					if (!pageReady && footerOff === void 0 && pageOff === void 0) footerOff = mountFooter();
				};
				const onSeat = () => {
					if (wired) sync();
				};
				const offGen = slots.inject(GEN_017_SEAT, () => {
					gen017 = true;
					onSeat();
					return () => {
						gen017 = false;
					};
				}, "dsh-search-index: probe 017 seat");
				const offMain = slots.inject(MAIN_SEAT, () => {
					mainSeat = true;
					onSeat();
					return () => {
						mainSeat = false;
					};
				}, "dsh-search-index: probe main seat");
				wired = true;
				sync();
				return () => {
					offGen();
					offMain();
					if (chordOff !== void 0) {
						const off = chordOff;
						chordOff = void 0;
						off();
					}
					if (footerOff !== void 0) {
						const off = footerOff;
						footerOff = void 0;
						off();
					}
					if (pageOff !== void 0) {
						const off = pageOff;
						pageOff = void 0;
						off();
					}
				};
			}, "dsh-search-index: sidebar entry");
			ctx.effect(() => {
				let off;
				const apply = () => {
					if (!(bound.getSnapshot().value?.enabled !== false) && off !== void 0) {
						const fn = off;
						off = void 0;
						fn();
					}
				};
				apply();
				const unsubscribe = bound.subscribe(apply);
				return () => {
					unsubscribe();
					if (off !== void 0) off();
				};
			}, "dsh-search-index: entry gate");
			slots.inject("dsh-family.tab", () => slots.register({
				name: "dsh-family.tab",
				id: PANEL_ID,
				order: 30,
				label: () => translate(locale?.bind?.(NS), "card.title"),
				locale: NS
			}, (props) => (0, react.createElement)(SearchSettingsCard, {
				scope: bound,
				t: props.t
			})), "dsh-search-index: family settings tab");
			slots.inject("plugins.bundle.config", () => slots.register({
				name: "plugins.bundle.config",
				key: PANEL_ID
			}, (props) => (0, react.createElement)(SearchSettingsCard, {
				scope: bound,
				t: props.t
			})), "dsh-search-index: plugins page config card");
		}
		/** 017+ 页宿主：把 closePage / 打开会话绑进 SwitchPanel（page 形态）。 */
		function PageHost(props) {
			return SearchPage({
				onClose: props.onClose,
				openSession: props.openSession,
				scope: props.scope
			});
		}
		/** 顶栏行图标：放大镜（随行字色）。 */
		function SearchIcon({ size }) {
			const edge = size ?? 16;
			return (0, react.createElement)("svg", {
				width: edge,
				height: edge,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true
			}, (0, react.createElement)("circle", {
				cx: 7,
				cy: 7,
				r: 4.5,
				stroke: "currentColor",
				strokeWidth: 1.75,
				fill: "none"
			}), (0, react.createElement)("path", {
				d: "M10.5 10.5 L14 14",
				stroke: "currentColor",
				strokeWidth: 1.75,
				strokeLinecap: "round"
			}));
		}
		/**
		* 绑定调出快捷键（Ctrl/⌘+K）——只用于 017+（017- 由 SwitchFooter 自己绑）。
		* @param open - 命中快捷键时的动作。
		* @returns 解绑函数。
		*/
		function bindInvokeChord(open) {
			if (typeof document === "undefined") return () => {};
			const onKey = (event) => {
				if (!isInvokeChord(event, LABELS.isMac)) return;
				event.preventDefault();
				open();
			};
			document.addEventListener("keydown", onKey);
			return () => {
				document.removeEventListener("keydown", onKey);
			};
		}
		//#endregion
		exports.SWITCH_SEARCH_LOCALE_NAMESPACE = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.translate = translate;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map