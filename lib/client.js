window.__ModuleLoader__.load({
	id: "dsh-session-search-toggle",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		require("react-dom");
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
			"card.title": "会话搜索",
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
			"panel.buildIndex": "建立索引",
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
			"filter.all": "全部",
			"filter.user": "用户",
			"filter.reply": "回复",
			"filter.tool": "工具",
			"type.user/message": "用户",
			"type.assistant/message": "回复",
			"type.tool/call": "工具调用",
			"type.tool/result": "工具结果"
		};
		/** English dictionary; missing keys fall back to zh. */
		const en = {
			"card.title": "Session Search",
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
			"panel.buildIndex": "Build index",
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
			"filter.all": "All",
			"filter.user": "User",
			"filter.reply": "Reply",
			"filter.tool": "Tool",
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
		/** A boolean switch editing one namespace field. */
		function Toggle(props) {
			return (0, react.createElement)("label", { className: "dsws_switch" }, [(0, react.createElement)("input", {
				type: "checkbox",
				checked: props.checked,
				disabled: !props.writable,
				onChange: (e) => props.onChange(e.target.checked)
			}), (0, react.createElement)("span", {
				key: "track",
				className: "dsws_switchTrack"
			}, (0, react.createElement)("span", { className: "dsws_switchThumb" }))]);
		}
		/** The independent-index lifecycle block (status + 整理 + snapshot seam). */
		function IndexBlock(props) {
			const [status, setStatus] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				let timer;
				const refresh = () => {
					callHostAny("index-status", {}).then((res) => {
						if (cancelled) return;
						if (res.ok) setStatus(res);
						if (res.rebuild?.state === "building" || res.rebuild?.state === "swapping") timer = window.setTimeout(refresh, 2e3);
						else setBusy(false);
					});
				};
				refresh();
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, []);
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
			const statusLine = status === null ? translate(t, "card.index.reading") : rebuilding ? translate(t, "card.index.rebuilding", {
				done: status.rebuild?.done ?? 0,
				total: status.rebuild?.total || "?"
			}) : status.available === true ? `${translate(t, "card.index.desc", { indexed: status.sync?.indexed ?? "?" })}${(status.archives?.length ?? 0) > 0 ? translate(t, "card.index.archives", { archives: status.archives?.length }) : ""}` : translate(t, "card.index.empty");
			return (0, react.createElement)("div", { className: "dsws_setRow" }, [(0, react.createElement)("div", {
				key: "text",
				className: "dsws_setText"
			}, [
				(0, react.createElement)("span", {
					key: "t",
					className: "dsws_setTitle"
				}, translate(t, "card.index")),
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
			]), (0, react.createElement)("div", {
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
			])]);
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
		//#region src/client/index.ts
		/**
		* dsh-session-search-toggle client half.
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
		/** ------------------------------------------------------------------ styles */
		const CSS = `
.dsws_root{box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;flex:none;width:100%}
.dsws_button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0 10px;font-size:12px;line-height:18px;white-space:nowrap}
.dsws_button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_button svg{flex:none}
.dsws_trigger{position:fixed;z-index:2147483000;width:380px;max-width:calc(100vw - 16px);box-sizing:border-box;background:var(--dsw-specific-tip);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.16);overflow:hidden;display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family)}
.dsws_toolrow{display:flex;align-items:center;gap:8px;padding:10px 10px 0}
.dsws_mode{display:inline-flex;align-items:center;gap:2px;flex:none;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px}
.dsws_modeBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 8px;font-size:12px;font-weight:500;line-height:20px}
.dsws_modeBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_modeBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_search{flex:auto;min-width:0;height:30px;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;outline:none;padding:0 10px;font:inherit;font-size:13px;line-height:20px}
.dsws_search:focus{border-color:var(--dsw-alias-state-business-primary)}
.dsws_search::placeholder{color:var(--dsw-alias-label-caption)}
.dsws_chips{display:flex;align-items:center;gap:6px;padding:8px 10px 0;flex:none}
.dsws_chip{height:24px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;line-height:22px;white-space:nowrap}
.dsws_chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_chipActive{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary)}
.dsws_list{max-height:min(50vh,420px);overflow-y:auto;margin:8px 0 0;padding:0 6px 8px;list-style:none}
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
.dsws_backdrop{position:fixed;inset:0;z-index:2147482999;background:transparent}
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
`;
		/** Inject the plugin stylesheet once per activation (removed on disposal). */
		function injectStyles() {
			if (typeof document === "undefined") return () => {};
			if (document.querySelector("style[data-plugin-css=\"dsw-session-search-toggle/styles\"]") !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-search-toggle";
			tag.dataset.pluginCss = "dsw-session-search-toggle/styles";
			tag.textContent = CSS;
			document.head.appendChild(tag);
			return () => {
				if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
			};
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
			ctx.effect(() => injectStyles(), "dsh-session-search-toggle: stylesheet");
			const locale = ctx.get("locale");
			if (locale !== void 0 && typeof locale.register === "function") ctx.effect(() => locale.register(NS, {
				zh,
				en
			}), "dsh-session-search-toggle: dictionaries");
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			const sessions = ctx.get("sessions");
			sessions === void 0 || sessions.open;
			const settingsScope = ctx.get("settingsScope");
			slots.inject("settings.plugin.item", () => slots.register({
				name: "settings.plugin.item",
				id: SWITCH_SEARCH_SETTINGS_NAMESPACE,
				key: SWITCH_SEARCH_SETTINGS_NAMESPACE,
				locale: locale !== void 0 ? NS : void 0,
				inject: () => {
					return { scope: settingsScope?.bind({ namespace: "switch-search" }) ?? {
						getSnapshot: () => ({
							status: "ready",
							value: DEFAULT_CONFIG,
							revision: void 0,
							writable: false
						}),
						subscribe: () => () => {},
						set: async () => {}
					} };
				}
			}, SearchSettingsCard), "dsh-session-search-toggle: plugin settings card");
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