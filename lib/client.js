window.__ModuleLoader__.load({
	id: "dsh-search-index",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		//#endregion
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
				"type.user/message": "用户",
				"type.assistant/message": "回复",
				"type.tool/call": "工具调用",
				"type.tool/result": "工具结果"
			},
			en: {
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
				"type.user/message": "User",
				"type.assistant/message": "Reply",
				"type.tool/call": "Tool call",
				"type.tool/result": "Tool result"
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
						if (res.rebuild?.state === "building" || res.rebuild?.state === "swapping") timer = window.setTimeout(refresh, 2e3);
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
		//#region src/client/index.ts
		/**
		* dsh-search-index client half.
		*
		* One registration:
		* - a `sidebar.footer.action` entry (currently disabled upstream) that opens
		*   the floating title/content search panel.
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
		/** Result-ordering chips rendered at the right of the same filter row. */
		const SORT_CHIPS = [{
			id: "relevance",
			labelKey: "sort.relevance"
		}, {
			id: "time",
			labelKey: "sort.time"
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
		* @returns an opaque key, stable for equal inputs.
		*/
		function contentRequestKey(normalized, contentType, sortBy) {
			return `${normalized}\u0000${contentType}\u0000${sortBy}`;
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
.dsws_trigger{position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;max-width:calc(100vw - 24px);max-height:min(72vh,640px);box-sizing:border-box;background:var(--dsw-specific-tip);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 8px 28px rgba(0,0,0,.16));overflow:hidden;display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family)}
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
		function SwitchPanel({ t, onClose, open }) {
			const [mode, setModeState] = (0, react.useState)(lastPanelMode);
			const setMode = (next) => {
				lastPanelMode = next;
				setModeState(next);
			};
			const [query, setQuery] = (0, react.useState)("");
			const [contentType, setContentType] = (0, react.useState)("all");
			const [sortBy, setSortByState] = (0, react.useState)(readStoredSort);
			const setSortBy = (next) => {
				writeStoredSort(next);
				setSortByState(next);
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
				total: 0
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
								total: 0
							});
							return;
						}
						const status = res;
						const rebuilding = status.rebuild?.state === "building" || status.rebuild?.state === "swapping";
						setSearchStatus({
							available: status.available ?? false,
							reason: status.reason,
							rebuilding,
							done: status.rebuild?.done ?? 0,
							total: status.rebuild?.total ?? 0
						});
						if (rebuilding) timer = window.setTimeout(probe, 1500);
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
				const requestKey = contentRequestKey(normalized, requestType, sortBy);
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
						sortBy
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
				sortBy
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
			const titleRows = (0, react.useMemo)(() => {
				if (sessions === null) return [];
				if (normalized === "") return sessions;
				return sessions.filter((item) => item.title.toLowerCase().includes(normalized) || item.cwd.toLowerCase().includes(normalized));
			}, [sessions, normalized]);
			const children = [];
			if (sessionsError !== null) children.push((0, react.createElement)("div", {
				key: "err",
				className: "dsws_error"
			}, translate(t, "panel.sessionsError", { error: sessionsError })));
			const activeRequestKey = contentRequestKey(normalized, contentType, sortBy);
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
				}, (0, react.createElement)("button", {
					type: "button",
					className: "dsws_row",
					onClick: () => {
						open(item.sessionId);
					}
				}, [(0, react.createElement)("span", {
					key: "t",
					className: "dsws_rowTitle"
				}, [(0, react.createElement)("span", {
					key: "x",
					className: "dsws_titleText"
				}, item.title || translate(t, "panel.untitled")), (0, react.createElement)("span", {
					key: "tag",
					className: "dsws_tag"
				}, fmtTime(item.updatedAt))]), item.cwd !== "" && (0, react.createElement)("span", {
					key: "c",
					className: "dsws_meta"
				}, item.cwd)])))));
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
				key: item.sessionId,
				role: "option"
			}, (0, react.createElement)("button", {
				type: "button",
				className: "dsws_row",
				onClick: () => {
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
				(0, react.createElement)("span", {
					key: "tag",
					className: "dsws_tag"
				}, typeLabel(t, item.type)),
				(0, react.createElement)("span", {
					key: "time",
					className: "dsws_tag"
				}, fmtTime(item.updatedAt))
			]), (0, react.createElement)("span", {
				key: "s",
				className: "dsws_snippet"
			}, item.snippet || translate(t, "panel.noText"))])))));
			return (0, react_dom.createPortal)((0, react.createElement)("div", { key: "switch-root" }, [(0, react.createElement)("div", {
				key: "backdrop",
				className: "dsws_backdrop",
				onClick: onClose
			}), (0, react.createElement)("div", {
				key: "panel",
				className: "dsws_trigger",
				role: "dialog",
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
				mode === "content" && (0, react.createElement)("div", {
					key: "chips",
					className: "dsws_chips",
					role: "group",
					"aria-label": translate(t, "filter.all")
				}, [
					...CONTENT_TYPE_CHIPS.map((chip) => (0, react.createElement)("button", {
						key: chip.id,
						type: "button",
						className: `dsws_chip${contentType === chip.id ? " dsws_chipActive" : ""}`,
						"aria-pressed": contentType === chip.id,
						onClick: () => {
							setContentType(chip.id);
						}
					}, translate(t, chip.labelKey))),
					(0, react.createElement)("span", {
						key: "gap",
						className: "dsws_chipGap"
					}),
					(0, react.createElement)("span", {
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
					}, translate(t, chip.labelKey))))
				]),
				children,
				(0, react.createElement)("div", {
					key: "foot",
					className: "dsws_panelFoot"
				}, [
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
			])]), document.body);
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
		/** ------------------------------------------------------------------ plugin */
		/**
		* Sibling-tab seat (`settings.plugins.tab`). **Deliberately NOT registered.**
		*
		* Kept as a named constant because it is the seat this plugin used to also
		* occupy — registering both is what made the card appear twice (once next to
		* 「插件配置」 and once under it). 0.1.7 removed the child seat entirely; the
		* settings form is generated from the host half's `.volatile()` Config fields.
		*/
		const SETTINGS_SIBLING_SEAT = "settings.plugins.tab";
		/** Services required before mounting: the slot registry + locale (the family
		* tab label captures the translator eagerly — a lazy `ctx.locale` access inside
		* the label thunk would be evaluated by the FAMILY HOLDER's render and throw
		* `cannot get property "locale" without inject` there, killing the whole tab
		* ledger projection). */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: dictionaries, the plugin settings card, and the
		* (disabled upstream) footer search panel entry.
		* @param ctx - client plugin context (slots, optional locale/settingsScope/sessions).
		*/
		function apply(ctx) {
			ctx.effect(() => injectStyles(), "dsh-search-index: stylesheet");
			const locale = ctx.get("locale");
			if (locale !== void 0 && typeof locale.register === "function") ctx.effect(() => locale.register(NS, dictionaries), "dsh-search-index: dictionaries");
			const familyLabel = locale?.bind?.(NS);
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			const open = (sessionId) => {
				openSessionThrough((name) => ctx.get(name), sessionId);
			};
			const configForms = ctx.get("configForms");
			const settingsScope = ctx.get("settingsScope");
			const entryScope = configForms?.get("dsh-search-index") ?? settingsScope?.bind({ namespace: "switch-search" });
			slots.inject("sidebar.footer.action", () => slots.register({
				name: "sidebar.footer.action",
				id: "dsh-search-index",
				order: 5
			}, (props) => (0, react.createElement)(SwitchFooter, {
				...props,
				open,
				scope: entryScope
			})), "dsh-search-index: sidebar footer entry");
			ctx.get("slots")?.inject("dsh-family.tab", () => slots.register({
				name: "dsh-family.tab",
				id: "dsh-search-index",
				order: 30,
				label: () => translate(familyLabel, "card.title"),
				locale: NS
			}, (props) => (0, react.createElement)(SearchSettingsCard, {
				scope: entryScope,
				t: props.t
			})));
			slots.inject("plugins.bundle.config", () => slots.register({
				name: "plugins.bundle.config",
				key: "dsh-search-index"
			}, (props) => (0, react.createElement)(SearchSettingsCard, {
				scope: entryScope,
				t: props.t ?? familyLabel
			})), "dsh-search-index: plugins page config card");
		}
		//#endregion
		exports.SETTINGS_SIBLING_SEAT = SETTINGS_SIBLING_SEAT;
		exports.SWITCH_SEARCH_LOCALE_NAMESPACE = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.translate = translate;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map