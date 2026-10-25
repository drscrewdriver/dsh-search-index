window.__ModuleLoader__.load({
	id: "dsh-search-index",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		//#region src/client/host-api.ts
		/**
		* Client-side helpers and structural mirrors shared by the search panel and
		* the settings card. Everything talks to the host through the fenced
		* `/switch-search/api` route; no official package is value-imported.
		*/
		/** Fetch timeout for one host call (long for import: the body can be large). */
		const FETCH_TIMEOUT = 1e4;
		/** POST a JSON body to a fenced switch-search API method (items shape). */
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
					error: record?.error ?? "请求失败"
				};
			}).catch((err) => ({
				ok: false,
				items: [],
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
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
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
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
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
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
		//#region src/client/locales.ts
		/** `switch-search` client dictionaries (zh / en / ja / ko / fr / de / it / ru / es), thinking-levels pattern. */
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
				"card.corpusSource": "语料源",
				"card.corpusSource.desc": "内容检索的语料来自 DRS 投影库（硬依赖）；native 仅保留标题/头部元数据面。",
				"card.mode.drs": "DRS 投影库",
				"card.mode.native": "本地会话服务",
				"card.drsBaseUrl": "DRS 基址",
				"card.drsBaseUrl.desc": "空=自动（首个 trustedHosts 条目，再退 http://127.0.0.1:8080）。",
				"card.drsStatus.up": "内容检索可用（DRS 在线）。",
				"card.drsStatus.down": "内容检索不可用：DRS 未就绪（{reason}）。",
				"card.drsStatus.reading": "正在探测 DRS…",
				"card.title": "搜索索引",
				"card.description": "侧边栏会话搜索增强：标题搜索与内容搜索一键切换。内容搜索使用插件自建索引，不依赖 DSH 官方全文索引。",
				"card.unavailable": "设置命名空间不可用：请确认插件已装配进 profile。",
				"card.readonly": "只读",
				"card.enabled": "启用会话搜索",
				"card.enabled.desc": "在侧边栏底部显示\"搜索\"入口。",
				"card.defaultMode": "默认搜索模式",
				"card.defaultMode.desc": "面板打开时默认进入标题搜索还是内容搜索。",
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
				"group.collapseAll": "全部收拢"
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
				"card.corpusSource": "Corpus source",
				"card.corpusSource.desc": "Content search reads the DRS projection DB (hard dependency); native keeps title/header metadata only.",
				"card.mode.drs": "DRS projection",
				"card.mode.native": "Local session service",
				"card.drsBaseUrl": "DRS base URL",
				"card.drsBaseUrl.desc": "Empty = auto (first trustedHosts entry, then http://127.0.0.1:8080).",
				"card.drsStatus.up": "Content search available (DRS online).",
				"card.drsStatus.down": "Content search unavailable: DRS not ready ({reason}).",
				"card.drsStatus.reading": "Probing DRS…",
				"card.title": "Search Index",
				"card.description": "Sidebar session search with title/content mode switching. Content search uses the plugin-owned index and never depends on the official DSH full-text index.",
				"card.unavailable": "Settings namespace unavailable: make sure the plugin is assembled into the profile.",
				"card.readonly": "Read-only",
				"card.enabled": "Enable session search",
				"card.enabled.desc": "Show the \"Search\" entry at the bottom of the sidebar.",
				"card.defaultMode": "Default search mode",
				"card.defaultMode.desc": "Which mode the panel opens in.",
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
				"group.collapseAll": "Collapse all"
			},
			ja: {
				"card.title": "検索インデックス",
				"card.description": "サイドバーセッション検索の強化：タイトル検索とコンテンツ検索のワンクリック切り替え。コンテンツ検索はプラグイン独自のインデックスを使用し、DSH公式全文インデックスに依存しません。",
				"card.unavailable": "設定名前空間が利用できません：プラグインがプロファイルに組み込まれていることを確認してください。",
				"card.readonly": "読み取り専用",
				"card.enabled": "セッション検索を有効化",
				"card.enabled.desc": "サイドバー下部に「検索」エントリを表示します。",
				"card.defaultMode": "デフォルト検索モード",
				"card.defaultMode.desc": "パネルを開いたときの初期モード。",
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
				"type.tool/result": "ツール結果"
			},
			ko: {
				"card.title": "검색 인덱스",
				"card.description": "사이드바 세션 검색 강화: 제목 검색과 콘텐츠 검색 간 원클릭 전환. 콘텐츠 검색은 플러그인 자체 인덱스를 사용하며 DSH 공식 전문 인덱스에 의존하지 않습니다.",
				"card.unavailable": "설정 네임스페이스를 사용할 수 없습니다: 플러그인이 프로파일에 조립되어 있는지 확인하세요.",
				"card.readonly": "읽기 전용",
				"card.enabled": "세션 검색 활성화",
				"card.enabled.desc": "사이드바 하단에 \"검색\" 항목을 표시합니다.",
				"card.defaultMode": "기본 검색 모드",
				"card.defaultMode.desc": "패널을 열 때 기본 모드.",
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
				"type.tool/result": "도구 결과"
			},
			fr: {
				"card.title": "Index de recherche",
				"card.description": "Recherche de sessions dans la barre latérale avec bascule titre/contenu. La recherche de contenu utilise l'index indépendant du plugin et ne dépend jamais de l'index full-text officiel DSH.",
				"card.unavailable": "Espace de noms des paramètres indisponible : vérifiez que le plugin est assemblé dans le profil.",
				"card.readonly": "Lecture seule",
				"card.enabled": "Activer la recherche de sessions",
				"card.enabled.desc": "Afficher l'entrée « Recherche » en bas de la barre latérale.",
				"card.defaultMode": "Mode de recherche par défaut",
				"card.defaultMode.desc": "Mode d'ouverture du panneau.",
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
				"type.tool/result": "Résultat d'outil"
			},
			de: {
				"card.title": "Suchindex",
				"card.description": "Sidebar-Sitzungssuche mit Titel-/Inhaltsmodus-Umschaltung. Die Inhaltssuche verwendet den plugin-eigenen Index und hängt nie vom offiziellen DSH-Volltextindex ab.",
				"card.unavailable": "Einstellungs-Namensraum nicht verfügbar: Stellen Sie sicher, dass das Plugin im Profil zusammengestellt ist.",
				"card.readonly": "Schreibgeschützt",
				"card.enabled": "Sitzungssuche aktivieren",
				"card.enabled.desc": "Den „Suche\"-Eintrag am unteren Rand der Sidebar anzeigen.",
				"card.defaultMode": "Standardsuchmodus",
				"card.defaultMode.desc": "In welchem Modus das Panel geöffnet wird.",
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
				"type.tool/result": "Werkzeugergebnis"
			},
			it: {
				"card.title": "Indice di ricerca",
				"card.description": "Ricerca sessioni nella barra laterale con commutazione titolo/contenuto. La ricerca per contenuto utilizza l'indice indipendente del plugin e non dipende mai dall'indice full-text ufficiale DSH.",
				"card.unavailable": "Namespace delle impostazioni non disponibile: verificare che il plugin sia assemblato nel profilo.",
				"card.readonly": "Sola lettura",
				"card.enabled": "Abilita ricerca sessioni",
				"card.enabled.desc": "Mostra la voce «Ricerca» in fondo alla barra laterale.",
				"card.defaultMode": "Modalità di ricerca predefinita",
				"card.defaultMode.desc": "Modalità di apertura del pannello.",
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
				"type.tool/result": "Risultato strumento"
			},
			ru: {
				"card.title": "Поисковый индекс",
				"card.description": "Поиск сессий в боковой панели с переключением «заголовки/содержимое». Поиск по содержимому использует собственный индекс плагина и не зависит от официального полнотекстового индекса DSH.",
				"card.unavailable": "Пространство имён настроек недоступно: убедитесь, что плагин собран в профиле.",
				"card.readonly": "Только чтение",
				"card.enabled": "Включить поиск сессий",
				"card.enabled.desc": "Показывать пункт «Поиск» в нижней части боковой панели.",
				"card.defaultMode": "Режим поиска по умолчанию",
				"card.defaultMode.desc": "Режим открытия панели.",
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
				"type.tool/result": "Результат инструмента"
			},
			es: {
				"card.title": "Índice de búsqueda",
				"card.description": "Búsqueda de sesiones en la barra lateral con cambio entre título y contenido. La búsqueda de contenido usa el índice propio del plugin y nunca depende del índice de texto completo oficial de DSH.",
				"card.unavailable": "Espacio de nombres de configuración no disponible: verifique que el plugin esté ensamblado en el perfil.",
				"card.readonly": "Solo lectura",
				"card.enabled": "Habilitar búsqueda de sesiones",
				"card.enabled.desc": "Mostrar la entrada «Buscar» en la parte inferior de la barra lateral.",
				"card.defaultMode": "Modo de búsqueda predeterminado",
				"card.defaultMode.desc": "Modo en que se abre el panel.",
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
				"type.tool/result": "Resultado de herramienta"
			}
		};
		/** Translate with {param} interpolation; falls back to zh, then the key itself. */
		function translate(locale, key, params) {
			const raw = locale?.(key, params);
			if (typeof raw === "string" && raw !== "" && raw !== key) return raw;
			const template = dictionaries.zh[key] ?? key;
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/gu, (_, name) => String(params[name] ?? `{${name}}`));
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
							setFetchError(res.error ?? "index-status 请求失败");
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
			const pillLabel = fetchError !== null ? "状态读取失败" : rebuilding ? translate(t, "card.index.rebuilding", {
				done: status?.rebuild?.done ?? 0,
				total: status?.rebuild?.total || "?"
			}) : status === null ? translate(t, "card.index.reading") : status.available === true ? translate(t, "card.index.desc", { indexed: status.sync?.indexed ?? "?" }) : translate(t, "card.index.empty");
			const statusLine = fetchError !== null ? `索引状态读取失败：${fetchError}。请完全重启 dsh web（浏览器刷新不会重载 Host 半）后重试。` : status === null ? translate(t, "card.index.reading") : rebuilding ? translate(t, "card.index.rebuilding", {
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
					}, status === null ? translate(t, "card.drsStatus.reading") : status.available === true ? translate(t, "card.drsStatus.up") : translate(t, "card.drsStatus.down", { reason: status.reason ?? "drs-unavailable" })),
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
					}, "重试状态"),
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
			return (0, react.createElement)("div", { style: {
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))",
				background: "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))",
				borderRadius: "12px",
				transition: "border-color 0.16s, background 0.16s"
			} }, [(0, react.createElement)("button", {
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
			}))]), open && (0, react.createElement)("div", {
				key: "body",
				style: { padding: "12px 16px" }
			}, body)]);
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
					if (shared.status !== "ready" || shared.writable === false) throw new Error("设置桥不可写（describe 未就绪或宿主只读）");
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
						throw new Error(res.error ?? "设置写入失败");
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
		/** 阅读模式优先：命中行若落在 [data-reader-turn] 段内，直接返该段（turn 级
		* 锚点由插件自标，比文本匹配稳）；env.turn 给定时还能直接按 turn 号选段。 */
		function findReaderRow(root, needle, turn) {
			if (turn !== void 0 && turn > 0) {
				const direct = root.querySelector(`[data-reader-turn="${String(turn)}"]`);
				if (direct !== null && hasLayout(direct)) return direct;
			}
			for (const el of Array.from(root.querySelectorAll(MESSAGE_TAGS))) {
				if (!hasLayout(el)) continue;
				if (el.closest("[class*=\"dsws_\"], [role=\"dialog\"]") !== null) continue;
				const text = el.textContent;
				if (text === null || !normalizeForMatch(text).includes(needle)) continue;
				const section = el.closest("[data-reader-turn]");
				if (section !== null && hasLayout(section)) return section;
				return el;
			}
			return null;
		}
		/**
		* 找正文行：多义时取 DOM 最深者（段落本体而非包裹层）；**排除插件自家
		* 子树**（dsws_ 前缀类与任何 role=dialog 弹层）——面板行/管理台行都是
		* 目标文本的镜像，绝不允许当作跳转目的地。
		*/
		function findMessageElement(root, needle, turn) {
			const reader = findReaderRow(root, needle, turn);
			if (reader !== null) return reader;
			let best = null;
			let bestDepth = -1;
			for (const el of Array.from(root.querySelectorAll(MESSAGE_TAGS))) {
				if (!hasLayout(el)) continue;
				const text = el.textContent;
				if (text === null) continue;
				if (el.closest("[class*=\"dsws_\"], [role=\"dialog\"]") !== null) continue;
				if (!normalizeForMatch(text).includes(needle)) continue;
				if (el.closest("[data-reader-turn]") !== null) continue;
				let depth = 0;
				for (let n = el.parentElement; n !== null; n = n.parentElement) depth += 1;
				if (depth > bestDepth) {
					best = el;
					bestDepth = depth;
				}
			}
			return best;
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
				const row = body.rows.find((r) => Number(r.seq) === Number(hit.seq));
				const needle = resolveNeedle(row);
				if (needle === null) {
					log(`locate: skip row seq=${String(hit.seq)} (shadowed/短文本/无行)`);
					return false;
				}
				const targetTurn = typeof row?.turn === "number" ? row.turn : void 0;
				const startedAt = Date.now();
				let deadline = startedAt + (env.timeoutMs ?? LOCATE_TIMEOUT_MS);
				const hardDeadline = startedAt + HARD_DEADLINE_MS;
				let lastScrollAt = 0;
				let userTookOver = false;
				const pullOlder = env.loadOlder ?? injectedDeps.loadOlder;
				let pagesPulled = 0;
				let pullInFlight = false;
				let lastPullAt = 0;
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
						if (userTookOver) {
							finish(false, "yield user");
							return;
						}
						if (Date.now() >= deadline) {
							finish(false, `locate timeout (pages=${String(pagesPulled)})`);
							return;
						}
						const el = findMessageElement(doc.body ?? doc, needle, targetTurn);
						if (el === null) {
							if (pullOlder !== void 0 && !pullInFlight && pagesPulled < MAX_OLDER_PAGES && deadline < hardDeadline && Date.now() - lastPullAt >= TICK_MS * 2) {
								pullInFlight = true;
								lastPullAt = Date.now();
								Promise.resolve().then(() => pullOlder()).then((pulled) => {
									if (pulled) {
										pagesPulled += 1;
										deadline = Math.min(hardDeadline, Date.now() + 2e3 + (env.timeoutMs ?? LOCATE_TIMEOUT_MS) / 2);
									} else deadline = Math.min(deadline, Date.now());
								}).catch(() => {}).finally(() => {
									pullInFlight = false;
								});
							}
							return;
						}
						if (landedInPort(el)) {
							if (lastScrollAt === 0 || Date.now() - lastScrollAt >= STICK_MS) {
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
		function SwitchPanel({ t, onClose, open, variant = "dialog" }) {
			const [mode, setModeState] = (0, react.useState)(lastPanelMode);
			const setMode = (next) => {
				lastPanelMode = next;
				setModeState(next);
			};
			const [query, setQuery] = (0, react.useState)("");
			const [contentType, setContentType] = (0, react.useState)("all");
			const [archivedFilter, setArchivedFilter] = (0, react.useState)("all");
			const [dateFrom, setDateFrom] = (0, react.useState)("");
			const [dateTo, setDateTo] = (0, react.useState)("");
			const [locateStatus, setLocateStatus] = (0, react.useState)({});
			const [directDelete, setDirectDelete] = (0, react.useState)(false);
			const [armedDelete, setArmedDelete] = (0, react.useState)(null);
			const [deleteBusy, setDeleteBusy] = (0, react.useState)(false);
			const [deleteNote, setDeleteNote] = (0, react.useState)(null);
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
							deepSync: deepState
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
					} else setSessionsError(res.error ?? "读取会话列表失败");
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
							error: res.ok ? void 0 : res.error ?? "搜索失败"
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
			const children = [];
			if (deleteNote !== null) children.push((0, react.createElement)("div", {
				key: "delnote",
				className: deleteNote.failed ? "dsws_error" : "dsws_status"
			}, deleteNote.text));
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
					"aria-label": translate(t, "panel.titleSearch")
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
			}, [(0, react.createElement)("div", { key: "msg" }, searchStatus.reason === "unreachable" ? "索引状态不可达：Host 半可能是旧进程。请完全重启 dsh web（浏览器刷新不重载 Host）后重试。" : searchStatus.reason === "unavailable" ? translate(t, "panel.unavailable") : translate(t, "panel.notBuilt")), (0, react.createElement)("button", {
				key: "build",
				type: "button",
				className: "dsws_actBtn",
				style: { marginTop: "6px" },
				onClick: startIndexBuild
			}, translate(t, "panel.buildIndex"))]));
			else if (activeContent.status === "loading") children.push((0, react.createElement)("div", {
				key: "loading",
				className: "dsws_status"
			}, translate(t, "panel.loadingContent")));
			else if (activeContent.status === "error") children.push((0, react.createElement)("div", {
				key: "error",
				className: "dsws_error"
			}, translate(t, "panel.contentError", { error: activeContent.error ?? "未知错误" })));
			else if (activeContent.items.length === 0) children.push((0, react.createElement)("div", {
				key: "empty",
				className: "dsws_empty"
			}, normalized === "" ? translate(t, "panel.contentHint") : translate(t, "panel.noContent")));
			else children.push((0, react.createElement)("ul", {
				key: "list",
				ref: listRef,
				className: "dsws_list",
				role: "listbox",
				"aria-label": translate(t, "panel.contentSearch")
			}, activeContent.items.slice(0, 200).map((item) => (0, react.createElement)("li", {
				key: `${item.sessionId}:${item.seq}`,
				role: "option"
			}, (0, react.createElement)("div", { className: "dsws_rowLine" }, [(0, react.createElement)("button", {
				key: "row",
				type: "button",
				className: "dsws_row",
				onClick: () => {
					const hitKey = `${item.sessionId}:${item.seq}`;
					setArmedDelete(null);
					open(item.sessionId);
					setLocateStatus((s) => ({
						...s,
						[hitKey]: "pending"
					}));
					locateSearchHit(item).then((ok) => {
						setLocateStatus((s) => ({
							...s,
							[hitKey]: ok ? "ok" : "fail"
						}));
					});
				}
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dsws_rowTitle"
			}, [
				(0, react.createElement)("span", {
					key: "x",
					className: "dsws_titleText"
				}, item.title || translate(t, "panel.untitled")),
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
					title: locateStatus[`${item.sessionId}:${item.seq}`] === "pending" ? "定位巡逻中" : locateStatus[`${item.sessionId}:${item.seq}`] === "ok" ? "已跳转到命中行" : "未能定位（行未渲染/文本被拆分/超时）"
				}, locateStatus[`${item.sessionId}:${item.seq}`] === "pending" ? "⏳" : locateStatus[`${item.sessionId}:${item.seq}`] === "ok" ? "✓" : "✗")]
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
					}, translate(t, chip.labelKey))))] : []
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
							title: translate(t, "panel.deepSync.hint"),
							onClick: startDeepSync
						}, searchStatus.deepSync === "drs-syncing" ? translate(t, "panel.deepSync.drs") : searchStatus.deepSync === "rebuilding" ? translate(t, "panel.deepSync.rebuild") : searchStatus.deepSync === "done" ? translate(t, "panel.deepSync.done") : searchStatus.deepSync === "failed" ? translate(t, "panel.deepSync.failed") : translate(t, "panel.deepSync"))
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
			if (locale !== void 0 && typeof locale.register === "function") ctx.effect(() => locale.register(NS, dictionaries), "dsh-search-index: dictionaries");
			const bound = withBridgeFallback(ctx.get("configForms")?.get(PANEL_ID), searchBridgeScope());
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			const openHit = (sessionId) => {
				openSessionThrough((name) => ctx.get(name), sessionId);
			};
			configureLocator({ loadOlder: async () => {
				try {
					const conv = ctx.get("conversation");
					if (conv === void 0 || typeof conv.loadOlder !== "function") return false;
					await conv.loadOlder();
					return true;
				} catch {
					return false;
				}
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
						openSession: openHit
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
				openSession: props.openSession
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