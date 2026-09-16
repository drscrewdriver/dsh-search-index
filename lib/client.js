window.__ModuleLoader__.load({
	id: "dsh-search-index",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		//#region src/config.ts
		/** Defaults when nothing is configured. */
		const DEFAULT_CONFIG = {
			enabled: true,
			defaultMode: "title",
			autoSync: true,
			syncIntervalMs: 3e4,
			archiveKeep: 2,
			indexDir: ""
		};
		/** The settings namespace the host half registers (kept in lockstep with src/index.ts). */
		const SWITCH_SEARCH_SETTINGS_NAMESPACE = "switch-search";
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
		//#endregion
		//#region src/client/locales.ts
		/** `switch-search` client dictionaries (zh / en), thinking-levels pattern. */
		/** Dictionary namespace owned by this plugin (the host settings namespace). */
		const NS = "switch-search";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
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
			"panel.archived": "归档会话",
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
		};
		/** English dictionary; missing keys fall back to zh. */
		const en = {
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
			"panel.archived": "Archived sessions",
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
		};
		/** All shipped dictionaries by locale id (only built-in ids take the map overload). */
		const dictionaries = {
			zh,
			en
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
		* Session-search settings card — the `settings.plugin.item` face of the
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
					}, `${translate(t, "panel.archived")} ${status?.archivedSessions}`)]),
					(0, react.createElement)("span", {
						key: "d",
						className: "dsws_setDesc"
					}, statusLine),
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
			const [open, setOpen] = (0, react.useState)(false);
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
		* Two registrations:
		* - `settings.plugin.item` — the plugin's own settings card (thinking-levels
		*   pattern, dual `id`+`key` for CLI/Desktop slot kinds): enable switch,
		*   default panel mode, independent-index sync knobs, and the index lifecycle
		*   block (整理 / snapshot export/import). The old `settings.general.item`
		*   row and its local store seat were removed in favor of this card.
		* - a `sidebar.footer.action` entry (currently disabled upstream) that opens
		*   the floating title/content search panel.
		*
		* The `locale` and `settingsScope` services are consumed structurally: when
		* the host release lacks them the card falls back to the bundled zh
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
.dsws_root{box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;flex:none;width:100%}
.dsws_button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
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
.dsws_setRoot{display:flex;flex-direction:column;width:100%}
.dsws_setRow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsws_setRow:last-child{border-bottom:none}
.dsws_setText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsws_setTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.dsws_setDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsws_switch{position:relative;width:40px;height:22px;flex:none}
.dsws_switch>input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:pointer}
.dsws_switch>input:disabled{cursor:not-allowed}
.dsws_switchTrack{position:absolute;inset:0;background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:11px;transition:background .15s ease,border-color .15s ease;pointer-events:none}
.dsws_switch>input:checked+.dsws_switchTrack{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.dsws_switchThumb{position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .15s ease}
.dsws_switch>input:checked+.dsws_switchTrack>.dsws_switchThumb{transform:translateX(18px)}
.dsws_seg{display:inline-flex;align-items:center;gap:2px;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px;flex:none}
.dsws_segBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 10px;font-size:12px;font-weight:500;line-height:20px}
.dsws_segBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_segBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_segBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_actBtn{height:26px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:0 10px;font-size:12px;line-height:24px;white-space:nowrap}
.dsws_actBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsws_actBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_indexLine{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
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
.dsws_kbd{flex:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:18px;width:auto;height:18px;padding:0 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsws_linkBtn{height:26px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 8px;font:inherit;font-size:12px;line-height:18px}
.dsws_linkBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_dialogHead{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 0}
.dsws_dialogTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:22px}
.dsws_archRow{cursor:default}
.dsws_archRow:hover{background:transparent}
.dsws_uuid{font-family:var(--ds-font-family-code,monospace);font-size:11px;user-select:text}
.dsws_archCheck{flex:none;display:grid;place-items:center;width:18px;height:18px}
.dsws_archCheck input{width:14px;height:14px;margin:0;cursor:pointer;accent-color:var(--dsw-alias-state-business-primary)}
.dsws_dangerBtn{border-color:var(--dsw-alias-state-error-primary,var(--dsw-alias-state-warn-label));color:var(--dsw-alias-state-error-primary,var(--dsw-alias-state-warn-label))}
.dsws_dangerBtn:hover{background:var(--dsw-alias-state-error-tertiary,var(--dsw-alias-state-warn-tertiary))}
.dsws_editActive{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
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
		/** The footer entry: one icon button that opens the search panel. */
		function SwitchFooter({ t, wide, open }) {
			const [openPanel, setOpenPanel] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (!isInvokeChord(event, LABELS.isMac)) return;
					event.preventDefault();
					setOpenPanel(true);
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, []);
			return (0, react.createElement)("div", { className: "dsws_root" }, [(0, react.createElement)("button", {
				key: "btn",
				type: "button",
				className: "dsws_button",
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
		/** Services required before mounting: the slot registry (others optional). */
		const inject = ["slots"];
		/**
		* Client plugin body: dictionaries, the plugin settings card, and the
		* (disabled upstream) footer search panel entry.
		* @param ctx - client plugin context (slots, optional locale/settingsScope/sessions).
		*/
		function apply(ctx) {
			ctx.effect(() => injectStyles(), "dsh-search-index: stylesheet");
			const locale = ctx.get("locale");
			if (locale !== void 0 && typeof locale.register === "function") ctx.effect(() => locale.register(NS, {
				zh,
				en
			}), "dsh-search-index: dictionaries");
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			const open = (sessionId) => {
				const sessions = ctx.get("sessions");
				if (sessions !== void 0 && typeof sessions.open === "function") sessions.open(sessionId);
			};
			slots.inject("sidebar.footer.action", () => slots.register({
				name: "sidebar.footer.action",
				id: "dsh-search-index",
				order: 10
			}, (props) => (0, react.createElement)(SwitchFooter, {
				...props,
				open
			})), "dsh-search-index: sidebar footer entry");
			const settingsScope = ctx.get("settingsScope");
			slots.inject("settings.plugin.item", () => slots.register({
				name: "settings.plugin.item",
				id: SWITCH_SEARCH_SETTINGS_NAMESPACE,
				key: SWITCH_SEARCH_SETTINGS_NAMESPACE,
				locale: locale !== void 0 ? NS : void 0,
				inject: () => {
					return {
						scope: settingsScope?.bind({ namespace: "switch-search" }) ?? {
							getSnapshot: () => ({
								status: "ready",
								value: DEFAULT_CONFIG,
								revision: void 0,
								writable: false
							}),
							subscribe: () => () => {},
							set: async () => {}
						},
						openSession: open
					};
				}
			}, SearchSettingsCard), "dsh-search-index: plugin settings card");
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