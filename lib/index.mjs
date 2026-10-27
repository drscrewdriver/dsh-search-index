import { createRequire } from "node:module";
import z from "@deepseek-ai/schemastery";
import { mkdir, readdir, rename, rm, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
/** Application id marking files owned by this plugin's index (ASCII "SWIS"). */
const SWITCH_SEARCH_APPLICATION_ID = 1398229332;
/**
* Open the raw handle: better-sqlite3 (synchronous, faster statement
* dispatch) when the optional dependency is present, node:sqlite otherwise.
* Both expose the same prepare/exec/close shape this plugin uses.
*/
async function openRawHandle(actual) {
	try {
		const mod = await import("better-sqlite3");
		return {
			db: new (mod.default ?? mod)(actual),
			driver: "better-sqlite3"
		};
	} catch {
		const { DatabaseSync } = await import("node:sqlite");
		return {
			db: new DatabaseSync(actual),
			driver: "node:sqlite"
		};
	}
}
/**
* Open, validate, and initialize one switch-search index file.
* Missing directories and files are created; a file that belongs to another
* application (including the official session-query index) is refused.
* @param path - absolute path to the index file.
* @returns initialized database handle owned by the caller, plus the driver.
*/
async function openIndexDatabase(path) {
	const actual = resolve(path);
	await mkdir(dirname(actual), { recursive: true });
	const { db, driver } = await openRawHandle(actual);
	try {
		const { application_id: applicationId } = db.prepare("PRAGMA application_id").get();
		const { user_version: version } = db.prepare("PRAGMA user_version").get();
		if (applicationId === 1146308689) throw new Error(`switch-search: "${actual}" is the official session-query index, refusing to open it`);
		if (applicationId !== 0 && applicationId !== 1398229332) throw new Error(`switch-search: database at "${actual}" belongs to another application`);
		if (applicationId === 1398229332 && version !== 5) resetSchema(db);
		db.exec(`PRAGMA journal_mode = wal`);
		ensureSchema(db);
		db.exec(`PRAGMA synchronous = NORMAL`);
		db.exec(`PRAGMA temp_store = MEMORY`);
		db.exec(`PRAGMA cache_size = -65536`);
		return {
			db,
			driver
		};
	} catch (error) {
		db.close();
		throw error;
	}
}
/** Reset an incompatible database in place, preserving the owning application id. */
function resetSchema(db) {
	db.exec(`
    PRAGMA writable_schema = OFF;
    PRAGMA journal_mode = delete;
  `);
	for (const row of db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).all()) db.exec(`DROP TABLE IF EXISTS "${row.name.replace(/"/g, "\"\"")}"`);
	db.exec(`PRAGMA user_version = 0`);
}
/** Create the persistent schema when absent. */
function ensureSchema(db) {
	db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      cwd TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS docs (
      doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      surface TEXT NOT NULL,
      time INTEGER NOT NULL,
      text TEXT NOT NULL,
      index_text TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS docs_session_seq ON docs(session_id, seq);
    CREATE INDEX IF NOT EXISTS docs_session ON docs(session_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      index_text,
      content = 'docs',
      content_rowid = 'doc_id',
      tokenize = 'unicode61'
    );
  `);
	db.exec(`PRAGMA application_id = ${SWITCH_SEARCH_APPLICATION_ID}`);
	db.exec(`PRAGMA user_version = 5`);
}
//#endregion
//#region src/host/index/extract.ts
/**
* 从会话事件流里抽出**最后一帧标题**（`session/title` log-only 事件）。
*
* 这是标题的基础层：入索引时随事件白拿，不依赖 readTitleSnapshots（后者
* 对归档 id 可能整批失败——beta.4 标题全军覆没的根因）。数据形状按历史
* 演变兼容三种：`{ title: string }`、`{ title: { title } }`、`{ title: { val } }`。
*/
function extractTitleFromEvents(events) {
	for (let i = events.length - 1; i >= 0; i -= 1) {
		const event = events[i];
		if (event === null || typeof event !== "object") continue;
		if (event.type !== "session/title") continue;
		const title = event.data?.title;
		if (typeof title === "string" && title.trim() !== "") return title;
		if (title !== null && typeof title === "object") {
			const inner = title;
			if (typeof inner.title === "string" && inner.title.trim() !== "") return inner.title;
			if (typeof inner.val === "string" && inner.val.trim() !== "") return inner.val;
		}
	}
	return "";
}
/**
* ICU word segmenter shared by index and query paths (Node >= 16 / all evergreen
* browsers, zero dependency). 'zh' sensitivity keeps CJK word granularity.
*/
const SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh", { granularity: "word" }) : void 0;
/**
* Space-separate word boundaries so the FTS5 unicode61 tokenizer indexes
* words instead of whole CJK runs: the index and query sides must apply the
* exact same segmentation for a token to meet its match.
* @param text - raw extracted text (or a query term).
* @returns text with a single space at every word boundary.
*/
function segmentForIndex(text) {
	if (SEGMENTER === void 0) return text;
	const parts = [];
	for (const { segment } of SEGMENTER.segment(text)) {
		const piece = segment.trim();
		if (piece !== "") parts.push(piece);
	}
	return parts.join(" ");
}
/**
* Segment one whitespace-delimited query term into FTS5 phrase tokens.
* @returns word-like segments, or the raw term when segmentation is unavailable.
*/
function segmentQueryTerm(term) {
	if (SEGMENTER === void 0) return [term];
	const words = [];
	for (const { segment, isWordLike } of SEGMENTER.segment(term)) {
		const piece = segment.trim();
		if (piece !== "" && isWordLike === true) words.push(piece);
	}
	return words.length > 0 ? words : [term];
}
/** Whether a runtime value is a plain record. */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Trimmed text of one string-or-undefined part list, joined by newlines. */
function joinText(parts) {
	return parts.map((part) => typeof part === "string" ? part.trim() : "").filter(Boolean).join("\n");
}
/** Extracted text of one content block; unknown blocks contribute nothing. */
function blockText(block) {
	if (!isRecord(block)) return [];
	switch (block["type"]) {
		case "text": return typeof block["text"] === "string" ? [block["text"]] : [];
		case "reasoning": return [];
		case "tool-call": return [block["name"], block["arguments"]].filter((v) => typeof v === "string");
		case "tool-result": {
			const content = block["content"];
			return Array.isArray(content) ? content.flatMap(blockText) : [];
		}
		default: return [];
	}
}
/** Text of one message content (array of blocks, or a plain string). */
function contentText(content) {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	return joinText(content.flatMap(blockText));
}
/** Turn-end reason text; completed turns contribute nothing. */
function turnEndText(data) {
	const reason = data["reason"];
	if (!isRecord(reason)) return "";
	switch (reason["kind"]) {
		case "error": {
			const error = reason["error"];
			return joinText(["error", isRecord(error) && typeof error["message"] === "string" ? error["message"] : ""]);
		}
		case "aborted": return "aborted";
		case "max-tokens":
		case "interrupted": return String(reason["kind"]);
		case "completed": return "";
		default: return "";
	}
}
/**
* Extract searchable semantic text from one raw session event.
* @param event - event to inspect.
* @returns newline-joined semantic text, or an empty string when non-searchable.
*/
function extractSessionEventText(event) {
	const data = isRecord(event.data) ? event.data : {};
	switch (event.type) {
		case "user/message": return contentText(data["content"]);
		case "assistant/message": return contentText((isRecord(data["message"]) ? data["message"] : {})["content"]);
		case "tool/call": return joinText([data["name"], data["arguments"]].filter((v) => typeof v === "string"));
		case "tool/result": {
			const message = isRecord(data["message"]) ? data["message"] : {};
			const error = isRecord(data["error"]) ? data["error"] : {};
			return joinText([
				contentText(message["content"]),
				typeof error["name"] === "string" ? error["name"] : "",
				typeof error["code"] === "string" ? error["code"] : ""
			]);
		}
		case "todo/write": return joinText((Array.isArray(data["todos"]) ? data["todos"] : []).flatMap((todo) => {
			if (!isRecord(todo)) return [];
			return [todo["status"], todo["content"]].filter((v) => typeof v === "string");
		}));
		case "turn/end": return turnEndText(data);
		case "turn/start":
		case "step/start":
		case "step/end":
		case "assistant/attempt":
		case "request/header": return "";
		default: return "";
	}
}
/** Event types whose ops participate in the surface fold. */
const SURFACE_ELIGIBLE_TYPES = /* @__PURE__ */ new Set([
	"user/message",
	"assistant/message",
	"tool/call",
	"tool/result"
]);
/**
* Classify raw-log events into current vs shadowed surface membership.
*
* Simplified fold of the official `foldSurface`: append events join the
* surface, and a `replace` op shadows the declared inclusive seq range plus
* removes it from the surface. Validation is intentionally lax — a broken op
* degrades to append rather than failing the whole index build.
* @param events - complete contiguous raw event log.
* @returns seq → surface map; entries absent from the map are log-only.
*/
function classifySurface(events) {
	const surface = /* @__PURE__ */ new Map();
	const nodes = [];
	for (const event of events) {
		if (!SURFACE_ELIGIBLE_TYPES.has(event.type)) continue;
		const op = event.surfaceOp;
		if (op === "append" || op === void 0) {
			nodes.push(event.seq);
			surface.set(event.seq, "current");
			continue;
		}
		if (isRecord(op) && op["op"] === "replace" && typeof op["startSeq"] === "number" && typeof op["endSeq"] === "number") {
			const shadowed = /* @__PURE__ */ new Set();
			for (const seq of nodes) if (seq >= op["startSeq"] && seq <= op["endSeq"]) shadowed.add(seq);
			const kept = nodes.filter((seq) => !shadowed.has(seq));
			nodes.length = 0;
			nodes.push(...kept, event.seq);
			for (const seq of shadowed) surface.set(seq, "shadowed");
			surface.set(event.seq, "current");
			continue;
		}
		nodes.push(event.seq);
		surface.set(event.seq, "current");
	}
	return surface;
}
/**
* Project one complete raw log into searchable documents.
* @param sessionId - session that owns the log.
* @param events - complete contiguous raw event log.
* @returns documents in ascending seq order; structural events are omitted.
*/
function buildIndexDocuments(sessionId, events) {
	const surfaceBySeq = classifySurface(events);
	const documents = [];
	for (const event of events) {
		const text = extractSessionEventText(event);
		if (text.length === 0) continue;
		documents.push({
			sessionId,
			seq: event.seq,
			type: event.type,
			time: typeof event.time === "number" ? event.time : 0,
			surface: surfaceBySeq.get(event.seq) ?? "shadowed",
			text
		});
	}
	return documents;
}
//#endregion
//#region src/host/index/engine.ts
/** Coarse filter → raw event types. */
const CONTENT_TYPE_GROUPS = {
	user: ["user/message"],
	reply: ["assistant/message"],
	tool: ["tool/call", "tool/result"]
};
/** Search weight per event type (message content outranks tool chatter). */
const TYPE_WEIGHT = {
	"user/message": 3,
	"assistant/message": 3,
	"tool/call": 1,
	"tool/result": 1
};
/** Maximum snippet length in characters, aligned with the official route. */
const SNIPPET_CHARS = 240;
/** Maximum FTS matches inspected per query before session grouping. */
const MATCH_SCAN_LIMIT = 5e3;
/**
* Sanitize free text into a safe FTS5 query over the segmented index: each
* whitespace term is segmented into word tokens, quoted as an adjacent
* phrase, and the last token carries a prefix `*` so partial input matches
* ("正在搜" hits 正在搜索). Terms AND together.
*/
function sanitizeFtsQuery(query) {
	const terms = query.split(/\s+/u).filter(Boolean);
	if (terms.length === 0) return "";
	const phrases = [];
	for (const term of terms) {
		const words = segmentQueryTerm(term).map((word) => word.replace(/"/g, "\"\"")).filter((word) => word !== "");
		if (words.length === 0) continue;
		phrases.push(`"${words.join(" ")}"*`);
	}
	return phrases.join(" ");
}
/** Build a snippet around the first term occurrence, official-route aligned. */
function buildSnippet(text, query, max = SNIPPET_CHARS) {
	const flat = text.replace(/\s+/gu, " ").trim();
	if (flat.length <= max) return flat;
	const lower = flat.toLowerCase();
	const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
	let anchor = -1;
	for (const term of terms) {
		const at = lower.indexOf(term);
		if (at >= 0 && (anchor < 0 || at < anchor)) anchor = at;
	}
	if (anchor < 0) return `${flat.slice(0, max)}…`;
	const start = Math.max(0, anchor - Math.floor((max - 3) / 2));
	const end = Math.min(flat.length, start + max - 3);
	const head = start > 0 ? "…" : "";
	const tail = end < flat.length ? "…" : "";
	return `${head}${flat.slice(start, end)}${tail}`;
}
/** One open index handle. All mutating calls are synchronous; callers pace
* them off the HTTP hot path (background sync / rebuild tasks). */
var SwitchIndexEngine = class {
	options;
	db;
	driver = "node:sqlite";
	inBatch = false;
	constructor(options) {
		this.options = options;
	}
	/** Which SQLite driver is serving this handle. */
	get driverLabel() {
		return this.driver;
	}
	/**
	* Run one write inside the current batched transaction, or its own
	* IMMEDIATE transaction when not batching (nested calls join the batch).
	*/
	withWriteTx(fn) {
		const db = this.requireDb();
		if (this.inBatch) return fn();
		db.exec("BEGIN IMMEDIATE");
		this.inBatch = true;
		try {
			const result = fn();
			db.exec("COMMIT");
			return result;
		} catch (error) {
			try {
				db.exec("ROLLBACK");
			} catch {}
			throw error;
		} finally {
			this.inBatch = false;
		}
	}
	/**
	* Run one function as a single batched transaction (one fsync checkpoint):
	* upserts inside it join via withWriteTx instead of opening their own.
	*/
	runBatched(fn) {
		return this.withWriteTx(fn);
	}
	/** Whether the handle is open. */
	get isOpen() {
		return this.db !== void 0;
	}
	/** Open (creating or migrating) the index file. Idempotent. */
	async open() {
		if (this.db !== void 0) return;
		const opened = await openIndexDatabase(this.options.path);
		this.db = opened.db;
		this.driver = opened.driver;
	}
	/** Close the handle. Idempotent. */
	close() {
		this.db?.close();
		this.db = void 0;
	}
	/** Remove one session's FTS entries for external-content bookkeeping. */
	deleteSessionFts(db, sessionId) {
		const existing = db.prepare("SELECT doc_id, index_text FROM docs WHERE session_id = ?").all(sessionId);
		const deleteFts = db.prepare(`
      INSERT INTO docs_fts(docs_fts, rowid, index_text) VALUES ('delete', ?, ?)
    `);
		for (const row of existing) deleteFts.run(Number(row.doc_id), row.index_text);
	}
	/** Insert or replace one session's documents and header row. */
	upsertSession(input) {
		const db = this.requireDb();
		const documents = buildIndexDocuments(input.sessionId, input.events);
		return this.withWriteTx(() => {
			this.deleteSessionFts(db, input.sessionId);
			db.prepare("DELETE FROM docs WHERE session_id = ?").run(input.sessionId);
			const insertDoc = db.prepare(`
        INSERT INTO docs (session_id, seq, type, surface, time, text, index_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
			const insertFts = db.prepare("INSERT INTO docs_fts (rowid, index_text) VALUES (?, ?)");
			for (const doc of documents) {
				const indexText = segmentForIndex(doc.text);
				const result = insertDoc.run(doc.sessionId, doc.seq, doc.type, doc.surface, doc.time, doc.text, indexText);
				insertFts.run(Number(result.lastInsertRowid), indexText);
			}
			db.prepare(`
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at
      `).run(input.sessionId, input.version, input.title ?? "", input.cwd ?? "", input.updatedAt ?? 0, Date.now(), input.archived === true ? 1 : 0);
			return documents.length;
		});
	}
	/**
	* 该会话是否已有正文（issue #1:hollow 行判据）。
	* LIMIT 1 探测命中 docs_session 索引,每轮 poll 对每个未变更会话的开销可忽略。
	*/
	hasSessionDocs(sessionId) {
		return this.requireDb().prepare("SELECT 1 FROM docs WHERE session_id = ? LIMIT 1").get(sessionId) !== void 0;
	}
	/**
	* 「有表头无正文」的会话 id（升序）—— hollow 体检面。补录后仍 hollow 的行
	* 包含无可索引文本的真空会话（合法终态,见 sync 的 confirmedEmpty 缓存）。
	*/
	listHollowSessions() {
		return this.requireDb().prepare(`
      SELECT s.session_id FROM sessions s
      WHERE NOT EXISTS (SELECT 1 FROM docs d WHERE d.session_id = s.session_id)
      ORDER BY s.session_id
    `).all().map((row) => row.session_id);
	}
	/**
	* `PRAGMA integrity_check` 首行：'ok' 或损坏报告串。swap 后完整性闸门用。
	*/
	integrityCheck() {
		const row = this.requireDb().prepare("PRAGMA integrity_check").get();
		if (row === void 0) return "no result";
		const first = Object.values(row)[0];
		return String(first ?? "no result");
	}
	/**
	* Write an archived session's header row without any document content.
	*
	* @deprecated 旧"归档即软删"语义的遗物,合并包 R1 已改为归档保留 docs;仅剩
	* 旧快照兼容路径可落 header 行。新代码一律 upsertSession + setArchived。
	*/
	upsertArchivedHeader(input) {
		const db = this.requireDb();
		this.withWriteTx(() => {
			this.deleteSessionFts(db, input.sessionId);
			db.prepare("DELETE FROM docs WHERE session_id = ?").run(input.sessionId);
			db.prepare(`
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at,
          archived = 1
      `).run(input.sessionId, input.version, input.title ?? "", input.cwd ?? "", input.updatedAt ?? 0, Date.now());
		});
	}
	/**
	* Apply the official archive set: flip the archived flag both ways.
	*
	* 合表复用语义（R1）：归档**保留全部 docs 与 FTS**——正文在归档态不可变
	* （归档门只拒新回合），翻转只是检索域成员资格的变化；恢复也不再需要重灌
	* （旧实现的 version = -1 强制重读随"归档即删 docs"一并废除）。
	*/
	setArchived(archivedIds) {
		const db = this.requireDb();
		this.withWriteTx(() => {
			const rows = db.prepare("SELECT session_id, archived FROM sessions").all();
			for (const row of rows) {
				const shouldBe = archivedIds.has(row.session_id) ? 1 : 0;
				if (row.archived !== shouldBe) db.prepare("UPDATE sessions SET archived = ? WHERE session_id = ?").run(shouldBe, row.session_id);
			}
		});
	}
	/**
	* Flip one session's archived flag (steward write-side linkage). No-op when
	* the row does not exist — flag state on an unindexed session is meaningless.
	*/
	setArchivedOne(sessionId, archived) {
		const db = this.requireDb();
		this.withWriteTx(() => {
			db.prepare("UPDATE sessions SET archived = ? WHERE session_id = ?").run(archived ? 1 : 0, sessionId);
		});
	}
	/** One session's stored documents, ascending seq (snapshot export face). */
	exportSessionDocs(sessionId) {
		return this.requireDb().prepare(`
      SELECT seq, type, surface, time, text FROM docs WHERE session_id = ? ORDER BY seq
    `).all(sessionId);
	}
	/**
	* Insert or replace one session from already-extracted documents
	* (snapshot import face; no re-extraction, what was exported is restored;
	* segmentation is recomputed for the current index format).
	*/
	importSessionDocs(input) {
		const db = this.requireDb();
		this.withWriteTx(() => {
			this.deleteSessionFts(db, input.sessionId);
			db.prepare("DELETE FROM docs WHERE session_id = ?").run(input.sessionId);
			const insertDoc = db.prepare(`
        INSERT INTO docs (session_id, seq, type, surface, time, text, index_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
			const insertFts = db.prepare("INSERT INTO docs_fts (rowid, index_text) VALUES (?, ?)");
			for (const doc of input.docs) {
				const indexText = segmentForIndex(doc.text);
				const result = insertDoc.run(input.sessionId, doc.seq, doc.type, doc.surface, doc.time, doc.text, indexText);
				insertFts.run(Number(result.lastInsertRowid), indexText);
			}
			db.prepare(`
        INSERT INTO sessions (session_id, version, title, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = excluded.title,
          indexed_at = excluded.indexed_at,
          archived = excluded.archived
      `).run(input.sessionId, input.version, input.title ?? "", Date.now(), input.archived === true ? 1 : 0);
		});
	}
	/**
	* Insert or replace one session from corpus-source documents (T7.1 DRS
	* 语料源):docs 已由语料源抽好(surface 字符串),切分仍由本引擎重算。
	* 与 importSessionDocs 的三点差异,均为检索排序/水印所需:cwd 与
	* updated_at 直写(日期过滤/时间排序键);标题空串保留旧行(upsertSession
	* 同款 CASE——DRS 对老会话可能给不出标题,不能抹掉既有精修);归档旗标
	* 冲突时不动(翻转仍归 setArchived)。
	* @returns 落库 docs 数(0 = 该会话无可索引文本,合法终态)。
	*/
	upsertSessionDocs(input) {
		const db = this.requireDb();
		return this.withWriteTx(() => {
			this.deleteSessionFts(db, input.sessionId);
			db.prepare("DELETE FROM docs WHERE session_id = ?").run(input.sessionId);
			const insertDoc = db.prepare(`
        INSERT INTO docs (session_id, seq, type, surface, time, text, index_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
			const insertFts = db.prepare("INSERT INTO docs_fts (rowid, index_text) VALUES (?, ?)");
			for (const doc of input.docs) {
				const indexText = segmentForIndex(doc.text);
				const result = insertDoc.run(input.sessionId, doc.seq, doc.type, doc.surface, doc.time, doc.text, indexText);
				insertFts.run(Number(result.lastInsertRowid), indexText);
			}
			db.prepare(`
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at
      `).run(input.sessionId, input.version, input.title ?? "", input.cwd ?? "", input.updatedAt ?? 0, Date.now(), input.archived === true ? 1 : 0);
			return input.docs.length;
		});
	}
	/**
	* 会话头直写（DRS 直连时代的同步轮专用，T7.3）：只维护 sessions 元数据
	* （水位/标题/目录/末时间/归档），**不碰 docs/docs_fts**——内容检索
	* 已直连 dsh-reference-session-collector（op=search&group=session），本地正文索引
	* 退役，存量 docs 行自然老化不再新增。空标题保留旧行（同 upsertSessionDocs）。
	*/
	upsertSessionHead(input) {
		const db = this.requireDb();
		this.withWriteTx(() => {
			db.prepare(`
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at,
          archived = excluded.archived
      `).run(input.sessionId, input.version, input.title ?? "", input.cwd ?? "", input.updatedAt ?? 0, Date.now(), input.archived === true ? 1 : 0);
		});
	}
	/** Remove one session and its documents entirely. */
	removeSession(sessionId) {
		const db = this.requireDb();
		this.withWriteTx(() => {
			this.deleteSessionFts(db, sessionId);
			db.prepare("DELETE FROM docs WHERE session_id = ?").run(sessionId);
			db.prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
		});
	}
	/** Update only a session's header row (title backfill), keeping documents. */
	updateSessionHeader(input) {
		const db = this.requireDb();
		if (db.prepare("SELECT version FROM sessions WHERE session_id = ?").get(input.sessionId) === void 0) return;
		db.prepare(`
      UPDATE sessions SET
        title = CASE WHEN ? != '' THEN ? ELSE title END,
        cwd = CASE WHEN ? != '' THEN ? ELSE cwd END,
        updated_at = CASE WHEN ? > 0 THEN ? ELSE updated_at END
      WHERE session_id = ?
    `).run(input.title ?? "", input.title ?? "", input.cwd ?? "", input.cwd ?? "", input.updatedAt ?? 0, input.updatedAt ?? 0, input.sessionId);
	}
	/** One indexed session row, or undefined. */
	getSession(sessionId) {
		const row = this.requireDb().prepare("SELECT * FROM sessions WHERE session_id = ?").get(sessionId);
		return row === void 0 ? void 0 : rowToSession(row);
	}
	/** All indexed sessions (active AND archived), newest first — the title
	* corpus and the manage console both read this; the `archived` flag rides
	* each row so clients filter locally. */
	listIndexedSessions() {
		return this.requireDb().prepare("SELECT * FROM sessions ORDER BY updated_at DESC").all().map(rowToSession);
	}
	/** Archived (soft-deleted) sessions, newest first — the archive viewer face. */
	listArchived() {
		return this.requireDb().prepare("SELECT * FROM sessions WHERE archived = 1 ORDER BY updated_at DESC").all().map(rowToSession);
	}
	/** Number of indexed sessions (active + archived — the whole corpus). */
	countSessions() {
		const row = this.requireDb().prepare("SELECT COUNT(*) AS n FROM sessions").get();
		return Number(row.n);
	}
	/** Number of archived (soft-deleted) sessions. */
	countArchived() {
		const row = this.requireDb().prepare("SELECT COUNT(*) AS n FROM sessions WHERE archived = 1").get();
		return Number(row.n);
	}
	/**
	* Run one session-grouped full-text search.
	*
	* One statement: the FTS match is bounded by rank in a subquery (its rowid
	* aligns with docs.doc_id), then the type/surface filters join in — no
	* second round-trip, no large IN parameter lists.
	* @param request - query text, coarse type filter, page size, ordering.
	* @returns hits ordered by `sortBy` (relevance by default).
	*/
	search(request) {
		const db = this.requireDb();
		const match = sanitizeFtsQuery(request.query);
		if (match === "") return [];
		const limit = Math.min(Math.max(1, request.limit ?? 20), 100);
		const types = resolveTypes(request.types);
		const placeholders = types.map(() => "?").join(", ");
		const archivedClause = request.archived === "active" ? "AND s.archived = 0" : request.archived === "archived" ? "AND s.archived = 1" : "";
		const dateClauses = [];
		const dateParams = [];
		if (typeof request.from === "number" && Number.isFinite(request.from)) {
			dateClauses.push("AND s.updated_at >= ?");
			dateParams.push(request.from);
		}
		if (typeof request.to === "number" && Number.isFinite(request.to)) {
			dateClauses.push("AND s.updated_at < ?");
			dateParams.push(request.to);
		}
		const dateClause = dateClauses.join(" ");
		const docs = db.prepare(`
      SELECT d.doc_id AS docId, d.session_id AS sessionId, d.seq, d.type, d.time, d.text,
             s.title, s.updated_at AS updatedAt, f.rank AS ftsRank
      FROM (
        SELECT rowid, rank FROM docs_fts WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?
      ) f
      JOIN docs d ON d.doc_id = f.rowid
      JOIN sessions s ON s.session_id = d.session_id
      WHERE d.type IN (${placeholders}) AND d.surface = 'current' ${archivedClause} ${dateClause}
    `).all(match, MATCH_SCAN_LIMIT, ...types, ...dateParams);
		const bestBySession = /* @__PURE__ */ new Map();
		for (const doc of docs) {
			const weight = TYPE_WEIGHT[doc.type] ?? 1;
			const score = -Number(doc.ftsRank) * weight;
			const best = bestBySession.get(doc.sessionId);
			if (best === void 0 || score > best.score) bestBySession.set(doc.sessionId, {
				doc,
				score
			});
		}
		const grouped = [...bestBySession.values()];
		if (request.sortBy === "time") grouped.sort((a, b) => b.doc.updatedAt - a.doc.updatedAt || b.score - a.score);
		else grouped.sort((a, b) => b.score - a.score);
		return grouped.slice(0, limit).map(({ doc }) => ({
			sessionId: doc.sessionId,
			title: doc.title,
			seq: doc.seq,
			type: doc.type,
			time: doc.time,
			updatedAt: Number(doc.updatedAt ?? 0),
			snippet: buildSnippet(doc.text, request.query)
		}));
	}
	requireDb() {
		if (this.db === void 0) throw new Error("switch-search: index engine is not open");
		return this.db;
	}
};
/** Materialize the coarse filter into raw event types (absent → user+reply). */
function resolveTypes(types) {
	if (types === void 0 || types.length === 0) return ["user/message", "assistant/message"];
	const picked = /* @__PURE__ */ new Set();
	for (const entry of types) if (entry === "user" || entry === "reply" || entry === "tool") picked.add(entry);
	else return [
		"user/message",
		"assistant/message",
		"tool/call",
		"tool/result"
	];
	if (picked.size === 0) return ["user/message", "assistant/message"];
	return [...picked].flatMap((entry) => [...CONTENT_TYPE_GROUPS[entry]]);
}
/** Map one raw sessions row onto the public face. */
function rowToSession(row) {
	return {
		sessionId: String(row["session_id"]),
		version: Number(row["version"]),
		title: String(row["title"] ?? ""),
		cwd: String(row["cwd"] ?? ""),
		updatedAt: Number(row["updated_at"] ?? 0),
		indexedAt: Number(row["indexed_at"] ?? 0),
		archived: Number(row["archived"] ?? 0) === 1
	};
}
//#endregion
//#region src/host/index/sync.ts
/** 标题折叠的分块大小（一次 readTitleSnapshots 的 id 数上限,防整批一坏全坏）。 */
const TITLE_CHUNK = 50;
/**
* One watermark syncer bound to one open engine. `poll()` is re-entrant-safe:
* overlapping calls collapse into the running pass.
*/
var SwitchWatermarkSync = class SwitchWatermarkSync {
	engine;
	sessionQuery;
	readArchiveSource;
	log;
	readSessionFromFile;
	readProjectionTitle;
	drsSource;
	running;
	/**
	* 本进程已确认「重读过且产出仍为 0 docs」的会话（键 id@version）。
	* 无可索引文本是合法终态——没有这份缓存,hollow 补录判据会把真空会话
	* 每轮完整重读一次（热循环）。宿主重启后缓存归零,最多各重读一次。
	*/
	confirmedEmpty = /* @__PURE__ */ new Set();
	static emptyKey(sessionId, version) {
		return `${sessionId}@${String(version)}`;
	}
	state = {
		state: "idle",
		lastSyncAt: 0,
		indexed: 0,
		total: 0,
		updated: 0,
		failures: [],
		hollow: 0
	};
	/**
	* @param readSessionFromFile - 可选的**文件级兜底读取器**（管家 health 侧的
	* 多帧 zstd 读取器）：sessionQuery.readSession 对某些会话（典型:归档会话,
	* 或服务面退化）失败时改读转录文件。返回 undefined 表示文件也不可用。
	*/
	constructor(engine, sessionQuery, readArchiveSource, log, readSessionFromFile, readProjectionTitle, drsSource) {
		this.engine = engine;
		this.sessionQuery = sessionQuery;
		this.readArchiveSource = readArchiveSource;
		this.log = log;
		this.readSessionFromFile = readSessionFromFile;
		this.readProjectionTitle = readProjectionTitle;
		this.drsSource = drsSource;
	}
	/**
	* 读取一个会话的日志:服务面优先,失败落文件兜底。两条路都失败时抛最后
	* 一个错误,由调用方按会话隔离记失败。
	*/
	async readSessionLog(header) {
		try {
			return await this.sessionQuery.readSession(header.id);
		} catch (serviceError) {
			if (this.readSessionFromFile === void 0) throw serviceError;
			const fromFile = await this.readSessionFromFile(header.id);
			if (fromFile !== void 0) {
				this.log?.(`session ${header.id}: sessionQuery read failed, served from transcript file (${String(serviceError instanceof Error ? serviceError.message : serviceError)})`);
				return fromFile;
			}
			throw serviceError;
		}
	}
	/** Current progress snapshot (cloned). */
	snapshot() {
		return {
			...this.state,
			failures: [...this.state.failures]
		};
	}
	/**
	* Fold titles for an explicit id set without running a full pass.
	*
	* Used by the `session/title` event listener so a rename lands immediately
	* rather than at the next poll. It deliberately leaves watermarks alone: a
	* title-only refresh can never make the index claim content it has not read,
	* and the next poll still re-ingests the session off its bumped version.
	* Safe for unknown ids — the header write is a no-op when no row exists.
	* @param sessionIds - sessions whose titles should be re-folded.
	*/
	async refreshTitles(sessionIds) {
		await this.backfillTitles(sessionIds);
	}
	/**
	* Run one incremental pass (or await the running one).
	* @returns the state after the pass completes.
	*/
	poll() {
		if (this.running !== void 0) return this.running;
		this.running = this.runPass().finally(() => {
			this.running = void 0;
		});
		return this.running;
	}
	async runPass() {
		this.state.state = "syncing";
		const passStart = Date.now();
		try {
			if (this.drsSource !== void 0) try {
				return await this.runDrsPass(passStart);
			} catch (drsError) {
				this.log?.(`DRS corpus pass failed, falling back to native sessionQuery: ${String(drsError instanceof Error ? drsError.message : drsError)}`);
			}
			const records = await this.sessionQuery.listSessions();
			this.state.total = records.length;
			const archiveSource = this.readArchiveSource?.();
			const archivedSet = new Set(archiveSource?.archivedSessionIds ?? []);
			this.engine.setArchived(archivedSet);
			const failures = [];
			let updated = 0;
			const changedIds = [];
			for (const record of records) {
				const header = record.header;
				const existing = this.engine.getSession(header.id);
				const emptyKey = SwitchWatermarkSync.emptyKey(header.id, header.version);
				if (existing !== void 0 && existing.version === header.version && (this.confirmedEmpty.has(emptyKey) || this.engine.hasSessionDocs(header.id))) continue;
				changedIds.push(header.id);
				try {
					const log = await this.readSessionLog(header);
					if (this.engine.upsertSession({
						sessionId: header.id,
						version: header.version,
						cwd: log.session.cwd ?? header.cwd ?? "",
						updatedAt: log.session.createdAt ?? header.createdAt ?? 0,
						title: extractTitleFromEvents(log.events),
						events: log.events,
						archived: archivedSet.has(header.id)
					}) === 0) this.confirmedEmpty.add(emptyKey);
					else this.confirmedEmpty.delete(emptyKey);
					updated += 1;
				} catch (err) {
					failures.push({
						sessionId: header.id,
						error: String(err instanceof Error ? err.message : err)
					});
				}
			}
			for (const archivedId of archivedSet) {
				const existingArchived = this.engine.getSession(archivedId);
				if (existingArchived !== void 0 && (this.confirmedEmpty.has(SwitchWatermarkSync.emptyKey(archivedId, existingArchived.version)) || this.engine.hasSessionDocs(archivedId))) continue;
				try {
					const log = await this.readSessionLog({
						id: archivedId,
						version: -1
					});
					const produced = this.engine.upsertSession({
						sessionId: archivedId,
						version: log.session.version,
						cwd: log.session.cwd ?? "",
						updatedAt: log.session.createdAt ?? 0,
						title: extractTitleFromEvents(log.events),
						events: log.events,
						archived: true
					});
					const archivedKey = SwitchWatermarkSync.emptyKey(archivedId, log.session.version);
					if (produced === 0) this.confirmedEmpty.add(archivedKey);
					else this.confirmedEmpty.delete(archivedKey);
					updated += 1;
				} catch (err) {
					failures.push({
						sessionId: archivedId,
						error: `archived: ${String(err instanceof Error ? err.message : err)}`
					});
				}
			}
			const corpusIds = new Set(records.map((record) => record.header.id));
			for (const indexed of this.engine.listIndexedSessions()) if (!corpusIds.has(indexed.sessionId) && !archivedSet.has(indexed.sessionId)) this.engine.removeSession(indexed.sessionId);
			await this.backfillTitles(changedIds);
			const emptyTitles = this.engine.listIndexedSessions().filter((session) => session.title.trim() === "").map((session) => session.sessionId).slice(0, 100);
			if (emptyTitles.length > 0) {
				await this.backfillTitles(emptyTitles);
				let filled = 0;
				for (const id of emptyTitles) {
					const row = this.engine.getSession(id);
					if (row !== void 0 && row.title.trim() !== "") continue;
					const fromProjection = this.readProjectionTitle?.(id) ?? "";
					if (fromProjection.trim() !== "") {
						this.engine.updateSessionHeader({
							sessionId: id,
							title: fromProjection
						});
						filled += 1;
					}
				}
				if (filled > 0) this.log?.(`title sweep: ${filled}/${emptyTitles.length} filled from projection cache`);
			}
			this.state.updated = updated;
			this.state.failures = failures;
			this.state.indexed = this.engine.countSessions();
			this.state.hollow = this.engine.listHollowSessions().length;
			this.state.lastSyncAt = Date.now();
			this.state.state = "idle";
			this.state.error = void 0;
			this.log?.(`sync pass: scanned=${this.state.total} updated=${updated} archived=${archivedSet.size} failures=${failures.length} indexed=${this.state.indexed} hollow=${this.state.hollow} duration=${Date.now() - passStart}ms driver=${this.engine.driverLabel}`);
		} catch (err) {
			this.state.state = "error";
			this.state.error = String(err instanceof Error ? err.message : err);
			this.log?.(`sync pass FAILED: ${this.state.error}`);
		}
		return this.snapshot();
	}
	/**
	* DRS 语料轮(T7.1):语料头从 DRS `op=sessions` 分页拉取,水位
	* diff(version=artifact_mtime_ms)后按会话 `op=session&fields=search`
	* 取检索臂 docs 直插引擎(upsertSessionDocs)。归档集合改用 DRS 行的
	* archived 旗标(DRS sync 本就只读跟随 workspace.json,同源);标题直接
	* 采 DRS 行(投影侧同一 extractTitleFromEvents 视界),不再走快照精修。
	* 每会话失败隔离语义与原生轮一致;无可索引文本仍进 confirmedEmpty 缓存。
	*/
	async runDrsPass(passStart) {
		const source = this.drsSource;
		if (source === void 0) throw new Error("DRS corpus source unavailable");
		const heads = await source.listSessions();
		this.state.total = heads.length;
		const archivedSet = new Set(heads.filter((head) => head.archived).map((head) => head.sessionId));
		this.engine.setArchived(archivedSet);
		const failures = [];
		let updated = 0;
		for (const head of heads) {
			const existing = this.engine.getSession(head.sessionId);
			if (existing !== void 0 && existing.version === head.version) continue;
			try {
				this.engine.upsertSessionHead({
					sessionId: head.sessionId,
					version: head.version,
					title: head.title,
					cwd: head.cwd,
					updatedAt: head.updatedAt,
					archived: head.archived
				});
				updated += 1;
			} catch (err) {
				failures.push({
					sessionId: head.sessionId,
					error: `drs: ${String(err instanceof Error ? err.message : err)}`
				});
			}
		}
		const corpusIds = new Set(heads.map((head) => head.sessionId));
		for (const indexed of this.engine.listIndexedSessions()) if (!corpusIds.has(indexed.sessionId) && !archivedSet.has(indexed.sessionId)) this.engine.removeSession(indexed.sessionId);
		this.state.updated = updated;
		this.state.failures = failures;
		this.state.indexed = this.engine.countSessions();
		this.state.hollow = this.engine.listHollowSessions().length;
		this.state.lastSyncAt = Date.now();
		this.state.state = "idle";
		this.state.error = void 0;
		this.log?.(`sync pass(DRS): scanned=${this.state.total} updated=${updated} archived=${archivedSet.size} failures=${failures.length} indexed=${this.state.indexed} hollow=${this.state.hollow} duration=${Date.now() - passStart}ms driver=${this.engine.driverLabel}`);
		return this.snapshot();
	}
	/**
	* Fold latest titles for changed sessions into the index header rows.
	*
	* beta.4 教训:整批一次调用,任何一个坏 id（典型:归档 id）让整个 promise
	* reject,catch 一吞就是**全部**标题丢失。改为分块 + 块失败时逐 id 重试 ——
	* 单点坏 id 最多损失它自己的精修标题（入索引时的 extractTitleFromEvents
	* 基础层仍然在）。
	*/
	async backfillTitles(sessionIds) {
		const readTitles = this.sessionQuery.readTitleSnapshots;
		if (readTitles === void 0 || sessionIds.length === 0) return;
		const ids = [...new Set(sessionIds)];
		const foldOne = (observation) => {
			if (observation.status !== "fulfilled" || observation.value === void 0) return;
			const title = observation.value.title?.title;
			if (typeof title === "string" && title.trim().length > 0) this.engine.updateSessionHeader({
				sessionId: observation.value.session.id,
				title
			});
		};
		for (let start = 0; start < ids.length; start += TITLE_CHUNK) {
			const chunk = ids.slice(start, start + TITLE_CHUNK);
			try {
				(await readTitles(chunk)).forEach(foldOne);
			} catch {
				for (const id of chunk) try {
					(await readTitles([id])).forEach(foldOne);
				} catch {}
			}
		}
	}
};
//#endregion
//#region src/host/index/archive-source.ts
/**
* Official archive-set source resolution.
*
* Primary: the in-process `workspaceRegistry` service (the same fact the UI
* filters by). Fallback: read the canonical storage hub file directly — the
* workspace domain persists `archivedSessionIds` under the `global` segment
* (storage-json: `~/.dsh/storages/workspace.json`; storage-sqlite variant
* exists but the JSON fallback file is what stock web profiles ship).
* Resolution order is decided per read; failures degrade to "no archive set"
* and are reported through the diagnostics face.
*
* READ-ONLY by contract. The archive set is WRITTEN by dsh-session-steward
* (会话管家 → 病案室); this package only consumes it to keep archived sessions
* out of the index. Format contract: `dsh-归档文件格式契约-20260914.md`.
*/
/** DSH storage hub candidates for the workspace domain (json backend). */
function storageFileCandidates() {
	return [join(homedir(), ".dsh", "storages", "workspace.json")];
}
/** Parse the storage hub file's global.archivedSessionIds; throw on malformed content. */
function readStorageFile(path) {
	const ids = JSON.parse(readFileSync(path, "utf8")).global?.archivedSessionIds;
	if (!Array.isArray(ids)) throw new Error(`storage hub "${path}" holds no global.archivedSessionIds array`);
	return ids.filter((id) => typeof id === "string");
}
/**
* Resolve the official archive set once.
* @param registry - lazy workspaceRegistry face (may be absent or throw).
* @returns the archive ids plus which source served them.
*/
function readArchiveSet(registry) {
	if (registry !== void 0) try {
		const ids = registry.archivedSessionIds;
		if (Array.isArray(ids)) return {
			ids,
			source: "registry"
		};
	} catch {}
	for (const path of storageFileCandidates()) {
		if (!existsSync(path)) continue;
		try {
			return {
				ids: readStorageFile(path),
				source: "storage-file"
			};
		} catch {}
	}
	return {
		ids: [],
		source: "none"
	};
}
/** Build the lazy source face the syncer expects, with diagnostics capture. */
function createArchiveSource(getRegistry) {
	let last = {
		source: "none",
		ids: 0
	};
	return {
		read: () => {
			const read = readArchiveSet(getRegistry());
			last = {
				source: read.source,
				ids: read.ids.length
			};
			return read;
		},
		diagnostics: () => ({ ...last })
	};
}
//#endregion
//#region src/host/index/peers.ts
/**
* Presence probe for the peer plugin that owns the archived-session domain.
*
* Why this exists
* ---------------
* This package *reads* the official archive set — archived sessions are
* excluded from the index — but it no longer *owns* archiving: browsing and
* disposing of archived sessions moved to `dsh-session-steward`. The settings
* card went on reporting a bare archived count, with no pointer to the plugin
* that can act on it. A number the user cannot act on, next to a capability
* that lives somewhere else, reads as a broken feature.
*
* The pointer has to say different things depending on whether the owner is
* actually installed, and only the host half can answer that: the client
* bundle cannot resolve another package, and the slot registry exposes no
* "is anything registered under this id" query.
*
* Three states, never two. A probe that cannot run must not be reported as
* "missing" — that would tell the user to install something they already have.
*/
/** The package that owns the archived-session domain. */
const STEWARD_PACKAGE = "dsh-session-steward";
/**
* Probe whether a package resolves from this plugin's own module graph.
*
* The bundle lives at `<profile>/node_modules/dsh-search-index/lib/index.mjs`,
* so resolution runs against `<profile>/node_modules` — exactly where a
* profile dependency lands, and therefore the same place the host would load
* the peer from.
*
* @param name - the package name to resolve.
* @param base - resolution base; defaults to this module's own URL, i.e. the
*   plugin's install directory. Injectable so the classification can be tested
*   against a fixture that fails in a way this checkout cannot produce.
* @returns `installed` when it resolves; `missing` only for a genuine
*   module-not-found; `unknown` for every other failure, because an
*   unanswerable probe is not evidence of absence.
*/
function probePeer(name, base = import.meta.url) {
	try {
		createRequire(base).resolve(name);
		return "installed";
	} catch (err) {
		const code = err?.code;
		return code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND" ? "missing" : "unknown";
	}
}
/**
* Probe whether {@link STEWARD_PACKAGE} is installed alongside this plugin.
*
* @returns the resolution state, never a throw.
*/
function detectSteward() {
	return probePeer(STEWARD_PACKAGE);
}
//#endregion
//#region src/host/index/rebuild.ts
/**
* Non-destructive index rebuild ("整理索引") for the independent index.
*
* A shadow index file is built from scratch beside the active one; the active
* engine keeps serving queries the whole time. When the shadow is complete the
* swap is three synchronous renames (active → archive, shadow → active), then
* the engine reopens. Old archives are kept (bounded) and stay readable.
*/
/** Default layout names. */
const DEFAULT_INDEX_LAYOUT = {
	dir: ".",
	active: "index.sqlite",
	building: "index.building.sqlite",
	archivePrefix: "index.archive-"
};
/**
* Inspect the index directory for half-built leftovers from an abnormally
* terminated rebuild and recover:
* - shadow present + active present: the build never finished — the shadow
*   is garbage (the active index kept serving) and is discarded.
* - shadow present + active missing: the crash hit the rename window — the
*   newest archive is restored as the active index, the shadow discarded.
* Runs at host activation, before the engine opens (opening would create a
* fresh empty active file and mask the swap-window case).
*/
async function recoverIndex(layout, log) {
	const actions = [];
	await mkdir(layout.dir, { recursive: true });
	const activePath = join(layout.dir, layout.active);
	const buildingPath = join(layout.dir, layout.building);
	const activeExists = existsSync(activePath);
	if (!existsSync(buildingPath)) return actions;
	const discardShadow = async () => {
		for (const suffix of [
			"",
			"-wal",
			"-shm"
		]) await rm(`${buildingPath}${suffix}`, { force: true });
	};
	if (activeExists) {
		await discardShadow();
		actions.push(`discarded stale shadow index (a previous rebuild did not finish; the active index was never at risk)`);
	} else {
		const archives = await listArchives(layout);
		if (archives.length > 0) {
			const newest = archives[archives.length - 1];
			await rename(join(layout.dir, newest), activePath);
			actions.push(`active index was missing (crash during the swap window); restored "${newest}" as the active index`);
		} else actions.push("no active index and no archive: the first build crashed mid-way; starting from a fresh index");
		await discardShadow();
	}
	for (const action of actions) log?.(`index recovery: ${action}`);
	return actions;
}
/** List existing archive files, oldest first. */
async function listArchives(layout) {
	if (!existsSync(layout.dir)) return [];
	return (await readdir(layout.dir)).filter((name) => name.startsWith(layout.archivePrefix) && name.endsWith(".sqlite")).sort();
}
/** Sessions per batched transaction (one fsync checkpoint per chunk). */
const REBUILD_CHUNK = 50;
/**
* 主文件旁的 WAL sidecar（`-wal`/`-shm`）随主文件一并迁走；无目的地时
* （孤儿残留）直接 force rm。rename 失败降级删除——sidecar 清理永远不能
* 阻断 swap 本身。
*/
async function moveOrDeleteSidecars(basePath, destBasePath) {
	for (const suffix of ["-wal", "-shm"]) {
		const src = basePath + suffix;
		if (!existsSync(src)) continue;
		if (destBasePath !== null) try {
			await rename(src, destBasePath + suffix);
			continue;
		} catch {}
		await rm(src, { force: true }).catch(() => {});
	}
}
/**
* The swap window: synchronous renames only; queries fail only inside it.
*
* issue #1 评论的损坏根因：只搬主文件时,旧库残留的 -wal/-shm 会被同名顶替
* 的新库当自己的 WAL 重放,页号错配 → malformed。因此 sidecar 必须随主文件
* 一并迁 archive（干净 close 本会 checkpoint 自删,这里是异常关闭的兜底）。
* swap 后跑 integrity_check：非 ok 则把损坏库改名 .corrupt、从刚落的 archive
* 回滚重开,并抛错让调用方置 error（把「索引损坏」降级为「回到上次快照」）。
* 导出供测试直接驱动 swap 窗口（多连接场景在 Windows 上 rename 必 EBUSY,
* 无法经 rebuildIndex 全链路确定性复现）。
*/
async function swapShadowIntoActive(activeEngine, layout, log) {
	const activePath = join(layout.dir, layout.active);
	const buildingPath = join(layout.dir, layout.building);
	let archivePath = null;
	if (existsSync(activePath)) {
		activeEngine.close();
		archivePath = join(layout.dir, `${layout.archivePrefix}${Date.now()}.sqlite`);
		await rename(activePath, archivePath);
		await moveOrDeleteSidecars(activePath, archivePath);
	} else await moveOrDeleteSidecars(activePath, null);
	await rename(buildingPath, activePath);
	await activeEngine.open();
	const integrity = activeEngine.integrityCheck();
	if (integrity === "ok") return;
	log?.(`post-swap integrity FAILED (${integrity}); rolling back to the newest archive`);
	activeEngine.close();
	const corruptBase = join(layout.dir, `index.corrupt-${Date.now()}.sqlite`);
	try {
		await rename(activePath, corruptBase);
		await moveOrDeleteSidecars(activePath, corruptBase);
		if (archivePath !== null) {
			await rename(archivePath, activePath);
			for (const suffix of ["-wal", "-shm"]) if (existsSync(archivePath + suffix)) await rename(archivePath + suffix, activePath + suffix).catch(() => {});
			await activeEngine.open();
		}
	} catch (rollbackErr) {
		log?.(`swap rollback itself failed: ${String(rollbackErr instanceof Error ? rollbackErr.message : rollbackErr)}`);
	}
	throw new Error(`switch-search: post-swap integrity check failed: ${integrity}`);
}
async function rebuildIndex(activeEngine, layout, sessionQuery, keepArchives, onProgress, archiveSource, hooks) {
	const startedMs = Date.now();
	let docsWritten = 0;
	const emit = () => {
		hooks?.onState?.({ ...state });
	};
	const rate = () => {
		const secs = Math.max(.001, (Date.now() - startedMs) / 1e3);
		return `${(state.done / secs).toFixed(1)} sess/s`;
	};
	const eta = () => {
		if (state.total <= 0 || state.done === 0) return "?";
		const secs = (Date.now() - startedMs) / 1e3;
		return `${Math.max(0, Math.round((state.total - state.done) / (state.done / secs)))}s`;
	};
	const state = {
		state: "building",
		done: 0,
		total: 0,
		startedAt: Date.now(),
		finishedAt: 0,
		failures: []
	};
	try {
		hooks?.log?.(`rebuild started: dir=${layout.dir} keep=${keepArchives}`);
		emit();
		await mkdir(layout.dir, { recursive: true });
		const buildingPath = join(layout.dir, layout.building);
		if (existsSync(buildingPath)) await unlink(buildingPath);
		const shadow = new SwitchIndexEngine({ path: buildingPath });
		await shadow.open();
		try {
			const records = await sessionQuery.listSessions();
			state.total = records.length;
			hooks?.log?.(`rebuild corpus listed: ${state.total} sessions (archived included, full content)`);
			emit();
			const archivedSet = new Set(archiveSource?.()?.archivedSessionIds ?? []);
			const readLog = async (header) => {
				let log;
				try {
					log = await sessionQuery.readSession(header.id);
				} catch (serviceError) {
					if (hooks?.readSessionFromFile === void 0) throw serviceError;
					const fromFile = await hooks.readSessionFromFile(header.id);
					if (fromFile === void 0) throw serviceError;
					log = fromFile;
				}
				return {
					sessionId: header.id,
					version: log.session.version,
					title: extractTitleFromEvents(log.events),
					cwd: log.session.cwd ?? "",
					updatedAt: log.session.createdAt ?? 0,
					archived: archivedSet.has(header.id),
					events: log.events
				};
			};
			for (let i = 0; i < records.length; i += REBUILD_CHUNK) {
				const chunk = records.slice(i, i + REBUILD_CHUNK);
				const chunkStart = Date.now();
				const reads = [];
				for (const record of chunk) try {
					reads.push(await readLog(record.header));
				} catch (err) {
					state.failures.push({
						sessionId: record.header.id,
						error: String(err instanceof Error ? err.message : err)
					});
				}
				try {
					shadow.runBatched(() => {
						for (const item of reads) {
							shadow.upsertSession(item);
							docsWritten += item.events.length;
						}
					});
				} catch (err) {
					hooks?.log?.(`rebuild chunk txn failed, replaying individually: ${String(err instanceof Error ? err.message : err)}`);
					for (const item of reads) try {
						shadow.upsertSession(item);
						docsWritten += item.events.length;
					} catch (e2) {
						state.failures.push({
							sessionId: item.sessionId,
							error: String(e2 instanceof Error ? e2.message : e2)
						});
					}
				}
				state.done = Math.min(state.total, i + chunk.length);
				onProgress?.(state.done, state.total);
				emit();
				hooks?.log?.(`rebuild ${state.done}/${state.total} (${Math.round(state.done / Math.max(1, state.total) * 100)}%) ${rate()} elapsed ${Math.round((Date.now() - startedMs) / 1e3)}s eta ${eta()} chunk ${Date.now() - chunkStart}ms`);
			}
			shadow.setArchived(archivedSet);
			shadow.close();
		} catch (error) {
			shadow.close();
			await unlink(buildingPath).catch(() => {});
			throw error;
		}
		state.state = "swapping";
		emit();
		hooks?.log?.(`rebuild shadow complete: ${state.done} sessions, ~${docsWritten} docs, ${state.failures.length} failures; swapping`);
		await swapShadowIntoActive(activeEngine, layout, hooks?.log);
		await pruneArchives(layout, keepArchives);
		state.finishedAt = Date.now();
		state.state = "idle";
		emit();
		hooks?.log?.(`rebuild done: total ${((state.finishedAt - startedMs) / 1e3).toFixed(1)}s, archives pruned to ${keepArchives}`);
	} catch (err) {
		state.state = "error";
		state.error = String(err instanceof Error ? err.message : err);
		hooks?.log?.(`rebuild FAILED at done=${state.done}: ${state.error}`);
		emit();
		if (!activeEngine.isOpen) await activeEngine.open().catch(() => {});
	}
	return state;
}
/** Import doc-level records into the shadow file and swap it in (same swap path).
* @param log - 可选日志汇（空 docs 记录告警,issue #1 写入侧可观测）。 */
async function importIntoIndex(activeEngine, layout, records, keepArchives, log) {
	const state = {
		state: "building",
		done: 0,
		total: records.length,
		startedAt: Date.now(),
		finishedAt: 0,
		failures: []
	};
	try {
		await mkdir(layout.dir, { recursive: true });
		const buildingPath = join(layout.dir, layout.building);
		if (existsSync(buildingPath)) await unlink(buildingPath);
		const shadow = new SwitchIndexEngine({ path: buildingPath });
		await shadow.open();
		try {
			for (const record of records) {
				try {
					if (record.docs.length === 0) log?.(`snapshot import: session ${record.sessionId} has zero docs (hollow header, sync will backfill)`);
					shadow.importSessionDocs({
						sessionId: record.sessionId,
						version: record.version,
						title: record.title ?? "",
						archived: record.archived === true,
						docs: record.docs
					});
				} catch (err) {
					state.failures.push({
						sessionId: record.sessionId,
						error: String(err instanceof Error ? err.message : err)
					});
				}
				state.done += 1;
			}
			shadow.close();
		} catch (error) {
			shadow.close();
			await unlink(buildingPath).catch(() => {});
			throw error;
		}
		state.state = "swapping";
		await swapShadowIntoActive(activeEngine, layout, log);
		await pruneArchives(layout, keepArchives);
		state.finishedAt = Date.now();
		state.state = "idle";
	} catch (err) {
		state.state = "error";
		state.error = String(err instanceof Error ? err.message : err);
		if (!activeEngine.isOpen) await activeEngine.open().catch(() => {});
	}
	return state;
}
/** Remove the oldest archives beyond the retention bound (sidecars too). */
async function pruneArchives(layout, keep) {
	const archives = await listArchives(layout);
	const excess = archives.length - Math.max(0, keep);
	for (let i = 0; i < excess; i += 1) {
		await unlink(join(layout.dir, archives[i])).catch(() => {});
		await moveOrDeleteSidecars(join(layout.dir, archives[i]), null);
	}
}
/**
* Resolve the index directory that hosts the independent index files:
* an explicit override wins, otherwise a plugin-owned directory under the
* user's home (never the official index path).
*/
function resolveIndexDir(preferred) {
	if (preferred !== void 0 && preferred.trim() !== "") return preferred;
	return join(homedir(), ".dsh-switch-search");
}
//#endregion
//#region src/host/index/snapshot.ts
/** Render the snapshot header line. */
function snapshotHeader() {
	return JSON.stringify({
		v: 1,
		kind: "dsh-switch-search-snapshot",
		exportedAt: Date.now()
	});
}
/**
* Export the whole index (active AND archived) as a JSON Lines string.
* 归档行带 archived 标记一起导出——快照是完整备份,不是活跃子集。
* @param engine - the open active engine.
* @returns the complete snapshot text (header line first).
*/
function exportSnapshot(engine) {
	const lines = [snapshotHeader()];
	for (const session of engine.listIndexedSessions()) lines.push(JSON.stringify({
		v: 1,
		sessionId: session.sessionId,
		version: session.version,
		title: session.title,
		...session.archived ? { archived: true } : {},
		docs: engine.exportSessionDocs(session.sessionId)
	}));
	return `${lines.join("\n")}\n`;
}
/**
* Parse a snapshot's JSON Lines text into importable records.
* The header line and any malformed line are skipped, not fatal.
* @param text - raw snapshot text.
* @returns importable records and how many lines were skipped.
*/
function parseSnapshot(text) {
	const records = [];
	let skipped = 0;
	for (const line of text.split(/\r?\n/)) {
		if (line.trim() === "") continue;
		let value;
		try {
			value = JSON.parse(line);
		} catch {
			skipped += 1;
			continue;
		}
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			skipped += 1;
			continue;
		}
		const record = value;
		if (record["kind"] === "dsh-switch-search-snapshot") continue;
		const sessionId = record["sessionId"];
		const rawDocs = record["docs"];
		if (typeof sessionId !== "string" || sessionId === "" || !Array.isArray(rawDocs)) {
			skipped += 1;
			continue;
		}
		const docs = [];
		let docsValid = true;
		for (const rawDoc of rawDocs) {
			if (typeof rawDoc !== "object" || rawDoc === null || typeof rawDoc.seq !== "number" || typeof rawDoc.type !== "string" || typeof rawDoc.text !== "string") {
				docsValid = false;
				break;
			}
			const doc = rawDoc;
			docs.push({
				seq: doc.seq,
				type: doc.type,
				surface: typeof doc.surface === "string" ? doc.surface : "current",
				time: typeof doc.time === "number" ? doc.time : 0,
				text: doc.text
			});
		}
		if (!docsValid) {
			skipped += 1;
			continue;
		}
		records.push({
			sessionId,
			version: typeof record["version"] === "number" ? record["version"] : 0,
			title: typeof record["title"] === "string" ? record["title"] : void 0,
			archived: record["archived"] === true,
			docs
		});
	}
	return {
		records,
		skipped
	};
}
//#endregion
//#region src/host/index/drs-contract.ts
/** 通道不可用（带可判定的 code 与原始细节）。 */
var DrsUnavailableError = class extends Error {
	code;
	detail;
	constructor(code, detail) {
		super(`[${code}] ${detail}`);
		this.code = code;
		this.detail = detail;
		this.name = "DrsUnavailableError";
	}
};
/**
* 把任意失败归一成 `DrsUnavailableError`。
*
* 判别依据是 `drs-source.getJson` / `triggerSync` 的既有错误文案：
* - `DRS ?op=… → HTTP 403`
* - `DRS ?op=… → HTTP 500`
* - `DRS ?op=…: fetch failed`
* - `DRS ?op=…: ok=false(…)` / `响应非 JSON 对象`
*/
function classifyDrsFailure(err) {
	if (err instanceof DrsUnavailableError) return err;
	const detail = err instanceof Error ? err.message : String(err);
	const status = /HTTP (\d{3})/u.exec(detail)?.[1];
	if (status === "403") return new DrsUnavailableError("browser-access-denied", detail);
	if (status === "404") return new DrsUnavailableError("drs-not-activated", detail);
	if (status !== void 0) return new DrsUnavailableError("drs-http-error", detail);
	if (/ok=false|响应非 JSON/u.test(detail)) return new DrsUnavailableError("drs-http-error", detail);
	return new DrsUnavailableError("drs-http-unreachable", detail);
}
/** 服务端兜底文案（与客户端 `card.drsReason.*` / `panel.contentErr.*` 同义）。 */
function messageForDrsFailure(code, detail) {
	const suffix = detail === void 0 || detail === "" ? "" : `（${detail}）`;
	switch (code) {
		case "browser-access-denied": return `宿主禁止非渲染进程访问本地 HTTP，已改用进程内只读通道${suffix}`;
		case "drs-http-unreachable": return `DRS 路由不可达${suffix}`;
		case "drs-http-error": return `DRS 返回错误${suffix}`;
		case "drs-not-activated": return "dsh-reference-session-collector 未作为插件激活（路由 404）：执行 dsh plugin --profile <name> add dsh-reference-session-collector 后重启宿主；内容检索已改走进程内只读通道，但投影库不会自动更新";
		case "drs-missing": return "内容检索依赖未随包安装（dsh-reference-session-collector），请重装本插件；依赖会自动带上";
		case "drs-empty": return "投影库尚未建立：请重启宿主等待首轮同步完成（或确认 dsh-reference-session-collector 已启用）";
		case "drs-schema-mismatch": return `投影库版本与插件预期不一致${suffix}；请升级 dsh-reference-session-collector（本插件不会清库）`;
	}
}
//#endregion
//#region src/host/index/drs-source.ts
/**
* DRS 语料源:dsh-reference-session-collector 投影库的 HTTP 只读客户端(T7.1)。
*
* 语料契约 = DRS 单条 fenced 路由 `GET /api/dsh-reference-session-collector`:
* - `op=sessions&offset=&limit=` → `{ok, total, rows:[sessions 行]}`(分页);
* - `op=session&session=<id>&fields=search` → `{ok, session, rows:[检索臂]}`。
*
* 字段对照(T7.0,DRS wire snake → steward 引擎列):
*   sessions.version ← artifact_mtime_ms(水位代理:日志重写必 bump mtime);
*   sessions.updated_at ← last_time_ms;title/cwd/archived ← 同名列;
*   docs.type ← kind;docs.surface ← on_surface(1='current'/0='shadowed');
*   docs.time ← time;docs.text ← search_text;index_text 由本引擎
*   segmentForIndex 重算(自有切分面不动)。
*
* 自调用信任面:DRS 的 Host 门是精确匹配(trustedHosts 全小写比对),本客户
* 端可带 hostHeader 显式回显首个 trustedHosts 条目,规避「条目省略端口而
* URL 带端口」的精确匹配失配;loopback + 无 trustedHosts 的老宿主天然放行。
*/
/** DRS API 路径(与 dsh-reference-session-collector 的 DRS_API_PATH 字面一致;不跨包 import)。 */
const DRS_API_PATH = "/api/dsh-reference-session-collector";
/**
* 基址解析:显式配置 > 首个 trustedHosts 条目(补 http:// 前缀)>
* `http://127.0.0.1:8080`(宿主默认口;trustedHosts 缺席的老线 DRS 门本就放行)。
*/
function resolveDrsBaseUrl(explicit, trustedHosts) {
	const trimmed = explicit?.trim() ?? "";
	const pick = trimmed !== "" ? trimmed : trustedHosts?.find((entry) => entry.trim() !== "")?.trim();
	if (pick === void 0 || pick === "") return "http://127.0.0.1:8080";
	return /^https?:\/\//u.test(pick) ? pick : `http://${pick}`;
}
var DrsCorpusSource = class DrsCorpusSource {
	options;
	fetchImpl;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}
	/** 一个 GET 的 JSON 包络(ok!==true 或非 2xx 一律抛,由调用方回退 native)。 */
	async getJson(query, atHost) {
		const url = `${(atHost !== void 0 && atHost !== "" ? `http://${atHost}` : this.options.baseUrl).replace(/\/+$/u, "")}${DRS_API_PATH}${query}`;
		let response;
		try {
			response = await this.fetchImpl(url, { headers: {
				accept: "application/json",
				...this.options.hostHeader === void 0 ? {} : { host: this.options.hostHeader }
			} });
		} catch (err) {
			throw new Error(`DRS ${query}: ${String(err instanceof Error ? err.message : err)}`);
		}
		if (!response.ok) throw new Error(`DRS ${query} → HTTP ${String(response.status)}`);
		const body = await response.json();
		if (typeof body !== "object" || body === null) throw new Error(`DRS ${query}: 响应非 JSON 对象`);
		const record = body;
		if (record["ok"] !== true) throw new Error(`DRS ${query}: ok=false(${String(record["error"] ?? "unknown")})`);
		return record;
	}
	static headOf(row, fallbackId) {
		return {
			sessionId: String(row["session_id"] ?? fallbackId),
			version: Number(row["artifact_mtime_ms"] ?? 0),
			title: String(row["title"] ?? ""),
			cwd: String(row["cwd"] ?? ""),
			updatedAt: Number(row["last_time_ms"] ?? 0),
			archived: Number(row["archived"] ?? 0) === 1
		};
	}
	/** 全量语料头(内部翻页;rows 空或凑满 total 即止)。 */
	async listSessions() {
		const heads = [];
		let offset = 0;
		for (;;) {
			const page = await this.getJson(`?op=sessions&offset=${String(offset)}&limit=${String(500)}`);
			const rows = Array.isArray(page["rows"]) ? page["rows"] : [];
			for (const row of rows) {
				const head = DrsCorpusSource.headOf(row, "");
				if (head.sessionId !== "") heads.push(head);
			}
			offset += rows.length;
			const total = Number(page["total"] ?? heads.length);
			if (rows.length === 0 || offset >= total) break;
		}
		return heads;
	}
	/** 一个会话的检索臂 docs；DRS 无此会话（session:null）返回 undefined。 */
	async readSession(sessionId) {
		const body = await this.getJson(`?op=session&session=${encodeURIComponent(sessionId)}&fields=search`);
		if (body["session"] === null || body["session"] === void 0) return void 0;
		return {
			head: DrsCorpusSource.headOf(body["session"], sessionId),
			docs: (Array.isArray(body["rows"]) ? body["rows"] : []).map((row) => ({
				seq: Number(row["seq"] ?? 0),
				type: String(row["kind"] ?? ""),
				surface: Number(row["on_surface"] ?? 1) === 1 ? "current" : "shadowed",
				time: Number(row["time"] ?? 0),
				text: String(row["search_text"] ?? "")
			}))
		};
	}
	/**
	* 分组内容搜索（通道分派器）：
	* - `transport='http'`：只走 HTTP（强制，失败直抛）；
	* - `transport='in-process'`：只走进程内只读臂；
	* - `transport='auto'`（缺省）：先 HTTP，失败（403 / 不可达 / DRS 报错）降级进程内。
	*   未装配进程内臂时保持既有语义（原样抛错）—— 测试与 http-only 部署零变化。
	*/
	async searchGrouped(request) {
		const transport = this.options.transport?.() ?? "auto";
		const local = this.options.inProcess?.();
		if (transport === "in-process") {
			if (local === void 0) throw new DrsUnavailableError("drs-missing", "进程内臂未装配");
			return local.searchGrouped(request);
		}
		try {
			return await this.searchGroupedHttp(request);
		} catch (err) {
			const failure = classifyDrsFailure(err);
			if (transport === "http" || local === void 0) throw failure;
			this.options.log?.(`HTTP 臂失败(${failure.code})，降级进程内只读臂`);
			return local.searchGrouped(request);
		}
	}
	/**
	* 分组内容搜索直连臂（op=search&group=session，DRS surface.searchGrouped 同构）：
	* 会话分组/加权/过滤/锚定节选全部在 DRS 侧完成，本方法只搬 wire →
	* 引擎命中形状（SwitchSearchHit 字段同名）。失败（网络/非 2xx/包络）直抛，
	* 调用侧按硬依赖语义显式报错——**不回退本地索引**。
	*/
	async searchGroupedHttp(request) {
		const params = new URLSearchParams();
		params.set("op", "search");
		params.set("group", "session");
		params.set("q", request.query);
		if (request.kinds !== void 0 && request.kinds.length > 0) params.set("kinds", request.kinds.join(","));
		if (request.archived !== void 0) params.set("archived", request.archived);
		if (request.from !== void 0) params.set("from", String(request.from));
		if (request.to !== void 0) params.set("to", String(request.to));
		if (request.sortBy === "time") params.set("sort", "time");
		if (request.limit !== void 0) params.set("limit", String(request.limit));
		if (request.expand === true) params.set("expand", "1");
		const body = await this.getJson(`?${params.toString()}`, request.atHost);
		return (Array.isArray(body["hits"]) ? body["hits"] : []).map((row) => ({
			sessionId: String(row["session_id"] ?? ""),
			title: String(row["title"] ?? ""),
			seq: Number(row["seq"] ?? 0),
			type: String(row["type"] ?? ""),
			time: Number(row["time"] ?? 0),
			updatedAt: Number(row["updated_at"] ?? 0),
			snippet: String(row["snippet"] ?? "")
		}));
	}
	/**
	* 触发 DRS 后台同步（`POST ?op=sync`）：慢速全扫，用于修复投影库自身的滞后。
	* **op 走 query**：DRS 的 POST 分发只读 `url.searchParams.get('op')`，落进 body 会
	* 400 `unknown POST op: (missing)`；body 仍为 `{op:'sync'}` 兼容早期只读体版本。
	* 与 op=status 的 `syncing`（新）/ `last_sync.busy`（旧）配合轮询。
	* @param atHost - 同源 Host 覆盖。
	*/
	async triggerSync(atHost) {
		const url = `${(atHost !== void 0 && atHost !== "" ? `http://${atHost}` : this.options.baseUrl).replace(/\/+$/u, "")}${DRS_API_PATH}?op=sync`;
		let response;
		try {
			response = await this.fetchImpl(url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
					...this.options.hostHeader === void 0 ? {} : { host: this.options.hostHeader }
				},
				body: JSON.stringify({ op: "sync" })
			});
		} catch (err) {
			return {
				ok: false,
				error: String(err instanceof Error ? err.message : err)
			};
		}
		if (!response.ok) return {
			ok: false,
			error: `HTTP ${String(response.status)}`
		};
		try {
			const body = await response.json();
			return body["ok"] === true ? { ok: true } : {
				ok: false,
				error: String(body["error"] ?? "ok=false")
			};
		} catch {
			return { ok: true };
		}
	}
	/** DRS 状态明细（op=status 原始体；失败返回 undefined）。 */
	async statusDetail(atHost) {
		try {
			return await this.getJson("?op=status", atHost);
		} catch {
			return;
		}
	}
	/** 可性探针（op=status）：硬依赖预检/降级提示用；失败返回 false。
	*  向后兼容的布尔面——需要区分通道时用 {@link probeDetail}。 */
	async probe(atHost) {
		return (await this.probeDetail(atHost)).ok;
	}
	/**
	* 通道探针：`mode` 是当前**实际可用**通道（http / in-process / none）。
	* - `transport='http'`：只看 HTTP；
	* - `transport='in-process'`：只看进程内只读臂；
	* - `auto`：HTTP 优先，失败再看进程内臂。
	* HTTP 拿 404（DRSC 插件未激活）时额外标 `notActivated`，即使进程内臂接穗成功
	* 也如实透出——诊断面要区分「可用」与「投影库不会再自动更新」。
	*/
	async probeDetail(atHost) {
		const transport = this.options.transport?.() ?? "auto";
		const local = this.options.inProcess?.();
		if (transport !== "in-process") try {
			await this.getJson("?op=status", atHost);
			return {
				ok: true,
				mode: "http"
			};
		} catch (err) {
			const failure = classifyDrsFailure(err);
			const notActivated = failure.code === "drs-not-activated";
			if (transport === "http" || local === void 0) return {
				ok: false,
				mode: "none",
				reason: failure.code,
				...notActivated ? { notActivated: true } : {},
				detail: failure.detail
			};
			const probe = await local.probe();
			if (probe.ok) return {
				ok: true,
				mode: "in-process",
				...notActivated ? { notActivated: true } : {},
				schemaVersion: probe.schemaVersion,
				expected: probe.expected,
				sessions: probe.sessions,
				dir: probe.dir
			};
			return {
				ok: false,
				mode: "none",
				reason: probe.reason ?? failure.code,
				...notActivated ? { notActivated: true } : {},
				detail: probe.detail ?? failure.detail
			};
		}
		if (local === void 0) return {
			ok: false,
			mode: "none",
			reason: "drs-missing",
			detail: "进程内臂未装配"
		};
		const probe = await local.probe();
		if (probe.ok) return {
			ok: true,
			mode: "in-process",
			schemaVersion: probe.schemaVersion,
			expected: probe.expected,
			sessions: probe.sessions,
			dir: probe.dir
		};
		return {
			ok: false,
			mode: "none",
			reason: probe.reason ?? "drs-empty",
			detail: probe.detail
		};
	}
};
//#endregion
//#region src/host/index/drs-local.ts
/**
* DRS 进程内只读查询臂（T7.4）。
*
* 存在理由：DSH NEXT 桌面版在 web 层的 **路由分发之前** 就对非 renderer 请求
* 直接 403（`Browser access is disabled`），renderer token 只在渲染进程里，
* 插件 host 半拿不到。于是「插件 fetch 自己的宿主端口」这条 HTTP 路径在桌面版
* 永远走不通——与 `dsh-reference-session-collector` 装没装、装得对不对无关。
* 本模块改用 DRSC 包内的查询面（`createQueryContext` + `searchGrouped`）直连
* `projection.db`，语义与 HTTP 臂逐字一致（同样的加权/分组/日期域/锚定节选）。
*
* 只读纪律（硬约束，改动前先读 `dsh-reference-session-collector/src/schema.ts`）：
* - 只允许 `new DatabaseSync(path, { readOnly: true })`；
* - **禁止调用 `openProjectionStore`**：它会 mkdir、`PRAGMA journal_mode=WAL`，
*   并在 meta 版本串不符时 DROP 全部表 + VACUUM 重建 + 回写版本——那是写路径，
*   与正在同步的 DRSC 抢锁，且会清空用户投影库；
* - 版本不符只报 `drs-schema-mismatch`，**不清库、不修库**；
* - 库目录不存在时不创建目录（本模块不产生任何写盘）。
*/
/** 投影库目录环境变量（与 DRSC `resolveIndexDir` 同字面；不跨包 import）。 */
const DRS_DIR_ENV = "DSH_REFERENCE_SESSION_COLLECTOR_DIR";
/** 运行期依赖说明符（变量形式：不参与 TS 解析，也不被判成可打包依赖）。 */
const DRS_SPECIFIER = "dsh-reference-session-collector";
/** 库目录解析：显式入参 > 环境变量 > `~/.dsh-reference-session-collector`。 */
function resolveDrsDir(explicit) {
	const trimmed = explicit?.trim() ?? "";
	if (trimmed !== "") return trimmed;
	const fromEnv = process.env[DRS_DIR_ENV];
	if (fromEnv !== void 0 && fromEnv.trim() !== "") return fromEnv.trim();
	return join(homedir(), ".dsh-reference-session-collector");
}
let modulePromise;
/**
* 懒加载 DRSC。失败（未装 / Node < 22.5 缺 node:sqlite）归 `drs-missing`，
* 且不缓存失败值——用户补装后无需重启宿主即可重试。
*/
async function loadDrs() {
	if (modulePromise === void 0) modulePromise = (async () => {
		try {
			const mod = await import(DRS_SPECIFIER);
			if (typeof mod.createQueryContext !== "function" || typeof mod.searchGrouped !== "function") throw new Error("导出面缺少 createQueryContext/searchGrouped");
			return mod;
		} catch (err) {
			modulePromise = void 0;
			throw new DrsUnavailableError("drs-missing", err instanceof Error ? err.message : String(err));
		}
	})();
	return modulePromise;
}
/** 连接级 busy timeout：DRSC 同步期间持有写锁时，只读查询最多等 3s 而不是立刻失败。 */
function applyBusyTimeout(db) {
	try {
		db.prepare("PRAGMA busy_timeout=3000").get();
	} catch {}
}
/**
* 只读打开投影库。只读失败（WAL 库 `-shm` 不可写的 SQLITE_READONLY 类错误）时
* 降级为普通连接——**本模块仍然只执行 SELECT**，不建目录、不跑 DDL、不写 meta。
*/
async function openReadOnly(dbPath, log) {
	const sqlite = await import("node:sqlite");
	try {
		const db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
		applyBusyTimeout(db);
		return db;
	} catch (err) {
		log(`[switch-search] DRS 只读连接失败(${err instanceof Error ? err.message : String(err)})，降级普通连接（仍只读查询）`);
		const db = new sqlite.DatabaseSync(dbPath);
		applyBusyTimeout(db);
		return db;
	}
}
/** 读 `meta.schema_version`（表不存在/半建库 → undefined）。 */
function readSchemaVersion(db) {
	try {
		const row = db.prepare("SELECT value FROM meta WHERE key='schema_version'").get();
		return typeof row?.value === "string" ? row.value : void 0;
	} catch {
		return;
	}
}
/** 会话行数（0 = 还没来得及投影）。 */
function countSessions(db) {
	try {
		const row = db.prepare("SELECT COUNT(*) AS c FROM sessions").get();
		return Number(row?.c ?? 0);
	} catch {
		return 0;
	}
}
/**
* 建一个进程内只读臂。
* @param options.dir - 库目录解析（缺省 env/默认；绝不跟随本地索引 `indexDir`）。
* @param options.log - `[switch-search]` 日志桥。
*/
function createDrsLocalArm(options = {}) {
	const log = options.log ?? (() => {});
	const resolveDir = () => options.dir?.() ?? resolveDrsDir();
	let opened;
	const closeOpened = () => {
		if (opened === void 0) return;
		try {
			opened.db.close();
		} catch {}
		opened = void 0;
	};
	/** 打开并过闸；失败一律 `DrsUnavailableError`（本地错误归 `drs-empty` 并带原始细节）。 */
	const acquire = async () => {
		const module = await loadDrs();
		const dir = resolveDir();
		if (opened !== void 0 && opened.dir === dir && opened.module === module) return opened;
		closeOpened();
		const dbPath = join(dir, "projection.db");
		if (!existsSync(dbPath)) throw new DrsUnavailableError("drs-empty", `未找到投影库：${dbPath}`);
		let db;
		try {
			db = await openReadOnly(dbPath, log);
		} catch (err) {
			throw new DrsUnavailableError("drs-empty", `投影库无法打开：${err instanceof Error ? err.message : String(err)}`);
		}
		const schemaVersion = readSchemaVersion(db);
		const expected = module.PROJECTION_SCHEMA_VERSION;
		if (typeof expected === "string" && schemaVersion !== void 0 && schemaVersion !== expected) {
			db.close();
			throw new DrsUnavailableError("drs-schema-mismatch", `db=${schemaVersion} pkg=${expected}`);
		}
		if (schemaVersion === void 0) {
			db.close();
			throw new DrsUnavailableError("drs-empty", "投影库缺少 meta.schema_version（尚未完成首轮同步）");
		}
		if (countSessions(db) === 0) {
			db.close();
			throw new DrsUnavailableError("drs-empty", "投影库内尚无会话行");
		}
		const ctx = module.createQueryContext({
			db,
			summaries: /* @__PURE__ */ new Map()
		});
		opened = {
			dir,
			db,
			ctx,
			module,
			schemaVersion
		};
		return opened;
	};
	return {
		async probe() {
			try {
				const store = await acquire();
				return {
					ok: true,
					schemaVersion: store.schemaVersion,
					expected: store.module.PROJECTION_SCHEMA_VERSION,
					sessions: countSessions(store.db),
					dir: store.dir
				};
			} catch (err) {
				const failure = err instanceof DrsUnavailableError ? err : classifyDrsFailure(err);
				return {
					ok: false,
					reason: failure.code,
					detail: failure.detail,
					dir: resolveDir()
				};
			}
		},
		async searchGrouped(request) {
			const store = await acquire();
			const wire = { query: request.query };
			if (request.kinds !== void 0 && request.kinds.length > 0) wire["kinds"] = [...request.kinds];
			if (request.archived !== void 0) wire["archived"] = request.archived;
			if (request.from !== void 0) wire["from"] = request.from;
			if (request.to !== void 0) wire["to"] = request.to;
			if (request.sortBy !== void 0) wire["sortBy"] = request.sortBy;
			if (request.limit !== void 0) wire["limit"] = request.limit;
			if (request.expand === true) wire["expand"] = true;
			let body;
			try {
				body = store.module.searchGrouped(store.ctx, wire);
			} catch (err) {
				throw new DrsUnavailableError("drs-empty", `本地查询失败：${err instanceof Error ? err.message : String(err)}`);
			}
			return (Array.isArray(body.hits) ? body.hits : []).map((row) => ({
				sessionId: String(row.session_id ?? ""),
				title: String(row.title ?? ""),
				seq: Number(row.seq ?? 0),
				type: String(row.type ?? ""),
				time: Number(row.time ?? 0),
				updatedAt: Number(row.updated_at ?? 0),
				snippet: String(row.snippet ?? "")
			}));
		},
		dispose() {
			closeOpened();
		}
	};
}
//#endregion
//#region src/config.ts
/** Defaults when nothing is configured. */
const DEFAULT_CONFIG = {
	enabled: true,
	defaultMode: "title",
	autoSync: true,
	syncIntervalMs: 3e4,
	archiveKeep: 2,
	indexDir: "",
	corpusSource: "drs",
	drsBaseUrl: "",
	contentTransport: "auto"
};
/** The settings namespace the host half registers (kept in lockstep with src/index.ts). */
const SWITCH_SEARCH_SETTINGS_NAMESPACE = "switch-search";
/** 别名：与 DEFAULT_CONFIG 同值（合并包时代的命名，拆回后保留调用面）。 */
const SWITCH_DEFAULT_CONFIG = DEFAULT_CONFIG;
//#endregion
//#region src/host/settings-bridge.ts
/**
* Legacy 设置桥（宿主半身，≤0.1.5 专用）：老宿主的服务端 settings 服务保留
* register/get/update 三件套 —— context-compression legacy 租约（六格实证
* POST 200 + 持久化）验证过的持久化写路径。0.1.7+ 宿主删掉 register，本桥在
* 那些线上解析为 undefined，describe/mutate 降级为「显式拒绝写」。
*
* 命名空间：`switch-search`（存储键稳定承诺）。schema 必须**纯 plain**
* （不 withVolatile）—— volatile 节点会被 legacy register 拒收。
*
* 同一 settings 服务上重复 apply（HMR / 双 loader 行）的防重：Symbol.for 键挂
* 在服务对象上，首见者注册，后来者直接共享。
*/
const SHARED_LEASE = Symbol.for("dsh-search-index/legacy-settings-bridge");
/** 搜索命名空间 schema（纯 plain，无 volatile —— 老线 register 拒收 volatile 节点）。 */
const SwitchNsSchema = z.object({
	enabled: z.boolean().default(true),
	defaultMode: z.union(["title", "content"]).default("title"),
	autoSync: z.boolean().default(true),
	syncIntervalMs: z.number().default(3e4),
	archiveKeep: z.number().default(2),
	indexDir: z.string().default(""),
	corpusSource: z.union(["native", "drs"]).default("drs"),
	drsBaseUrl: z.string().default("")
});
/** settings.get 返回值是否像一份文档（老宿主对未写过的 ns 可能回 undefined）。 */
function asDoc(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	return value;
}
/**
* 在老宿主上租约注册命名空间；返回**同步创建的可变 holder**，桥面在
* `ctx.inject(['settings'], …)` 回调里填入。
* @param ctx - 宿主插件上下文。
*/
function installLegacySettingsBridge(ctx) {
	const state = {
		bridge: void 0,
		revision: 0
	};
	const injectFn = ctx.inject;
	if (typeof injectFn !== "function") return state;
	try {
		injectFn.call(ctx, ["settings"], (sctx) => {
			try {
				const settings = sctx?.settings;
				if (settings === void 0 || typeof settings.register !== "function") return;
				const carrier = settings;
				if (carrier[SHARED_LEASE] !== true) {
					settings.register(SWITCH_SEARCH_SETTINGS_NAMESPACE, SwitchNsSchema);
					try {
						Object.defineProperty(carrier, SHARED_LEASE, {
							configurable: false,
							enumerable: false,
							writable: false,
							value: true
						});
					} catch {}
				}
				state.bridge = {
					get: (ns) => {
						try {
							return asDoc(settings.get?.(ns));
						} catch {
							return;
						}
					},
					update: async (ns, patch) => {
						await settings.update?.(ns, patch);
					}
				};
				console.log(`[switch-search] legacy settings bridge engaged (${SWITCH_SEARCH_SETTINGS_NAMESPACE})`);
			} catch (err) {
				console.log(`[switch-search] legacy settings bridge FAILED (cards degrade to read-only): ${String(err instanceof Error ? err.message : err)}`);
			}
		});
	} catch {}
	return state;
}
function asBoolean(v) {
	return typeof v === "boolean" ? {
		ok: true,
		value: v
	} : {
		ok: false,
		error: "期望布尔值"
	};
}
/** 命名空间允许写入的字段与校验（未列出的字段一律拒绝——桥不是任意写缝）。 */
const FIELD_VALIDATORS = { [SWITCH_SEARCH_SETTINGS_NAMESPACE]: {
	enabled: asBoolean,
	defaultMode: (v) => v === "title" || v === "content" ? {
		ok: true,
		value: v
	} : {
		ok: false,
		error: "defaultMode 只接受 title|content"
	},
	autoSync: asBoolean,
	syncIntervalMs: (v) => {
		if (typeof v !== "number" || !Number.isFinite(v)) return {
			ok: false,
			error: "syncIntervalMs 必须是有限数字"
		};
		return {
			ok: true,
			value: Math.min(36e5, Math.max(5e3, Math.round(v)))
		};
	},
	archiveKeep: (v) => {
		if (typeof v !== "number" || !Number.isInteger(v)) return {
			ok: false,
			error: "archiveKeep 必须是整数"
		};
		return {
			ok: true,
			value: Math.min(20, Math.max(0, v))
		};
	},
	indexDir: (v) => {
		if (typeof v !== "string") return {
			ok: false,
			error: "indexDir 必须是字符串"
		};
		const trimmed = v.trim();
		if (trimmed.length > 500) return {
			ok: false,
			error: "indexDir 过长（>500 字符）"
		};
		return {
			ok: true,
			value: trimmed
		};
	},
	corpusSource: (v) => v === "native" || v === "drs" ? {
		ok: true,
		value: v
	} : {
		ok: false,
		error: "corpusSource 只接受 native|drs"
	},
	drsBaseUrl: (v) => {
		if (typeof v !== "string") return {
			ok: false,
			error: "drsBaseUrl 必须是字符串"
		};
		const trimmed = v.trim();
		if (trimmed.length > 500) return {
			ok: false,
			error: "drsBaseUrl 过长（>500 字符）"
		};
		return {
			ok: true,
			value: trimmed
		};
	}
} };
/** 汇总命名空间文档：legacy 读盘上文档合并缺省；modern 返回空投影（writable=false）。 */
function describeNamespaces(state) {
	const { bridge } = state;
	if (bridge !== void 0) return { [SWITCH_SEARCH_SETTINGS_NAMESPACE]: {
		...SWITCH_DEFAULT_CONFIG,
		...bridge.get("switch-search") ?? {}
	} };
	return { [SWITCH_SEARCH_SETTINGS_NAMESPACE]: {} };
}
function bridgeOverlay(state) {
	const { bridge } = state;
	if (bridge === void 0) return { search: {} };
	return { search: bridge.get("switch-search") ?? {} };
}
/** describe 响应。 */
function settingsDescribe(state) {
	return {
		ok: true,
		namespaces: describeNamespaces(state),
		writable: state.bridge !== void 0,
		revision: state.revision
	};
}
/** 合并写命名空间；任何校验/宿主拒绝都显式失败，成功回权威文档。 */
async function settingsMutate(state, payload) {
	if (state.bridge === void 0) return {
		ok: false,
		error: "本宿主无 legacy settings 服务（0.1.7+ 走 configForms 原生句柄），桥不可写"
	};
	const request = payload ?? {};
	if (typeof request.ns !== "string" || !(request.ns in FIELD_VALIDATORS)) return {
		ok: false,
		error: `未知设置命名空间：${String(request.ns)}`
	};
	if (request.fields === null || typeof request.fields !== "object" || Array.isArray(request.fields)) return {
		ok: false,
		error: "fields 必须是对象"
	};
	const validators = FIELD_VALIDATORS[request.ns];
	const clean = {};
	for (const [field, value] of Object.entries(request.fields)) {
		const validate = validators[field];
		if (validate === void 0) return {
			ok: false,
			error: `命名空间 ${request.ns} 不接受字段 "${field}"`
		};
		const verdict = validate(value);
		if (verdict.ok !== true) return {
			ok: false,
			error: `${field}: ${verdict.error}`
		};
		clean[field] = verdict.value;
	}
	if (Object.keys(clean).length === 0) return {
		ok: false,
		error: "fields 为空"
	};
	try {
		await state.bridge.update(request.ns, clean);
	} catch (err) {
		return {
			ok: false,
			error: `宿主拒绝写入：${String(err instanceof Error ? err.message : err)}`
		};
	}
	state.revision += 1;
	return {
		ok: true,
		namespaces: describeNamespaces(state),
		revision: state.revision
	};
}
//#endregion
//#region src/index.ts
/** Stable plugin name for the cordis row. */
const name = "dsh-search-index";
/** Services required before mounting: the web server routes and the trust list.
*  0.2.1-a.2 起 webRuntime 更名 webStartup；注入主名 webStartup，读取面走双名回退链。 */
const inject = ["webServer", "webStartup"];
/** Composition-entry schema: what a dsh profile may configure at assembly time.
*  0.1.7：volatile 字段即设置表单；`indexDir` 是部署路径，不走页面。 */
const Config = z.object({
	enabled: z.boolean().default(true).volatile(),
	defaultMode: z.union(["title", "content"]).default("title").volatile(),
	autoSync: z.boolean().default(true).volatile(),
	syncIntervalMs: z.number().default(3e4).volatile(),
	archiveKeep: z.number().default(2).volatile(),
	indexDir: z.string().default(""),
	corpusSource: z.union(["native", "drs"]).default("drs").volatile(),
	drsBaseUrl: z.string().default("").volatile(),
	contentTransport: z.union([
		"auto",
		"http",
		"in-process"
	]).default("auto").volatile()
});
/** Resolve one possibly-volatile field: a live ref on 0.1.7+, a plain value otherwise. */
function readVolatileValue(value) {
	if (value !== null && typeof value === "object" && typeof value.get === "function") return value.get();
	return value;
}
/** Body size bound of one JSON request (defense against unbounded reads). */
const MAX_BODY_BYTES = 16 << 20;
/** Default maximum sessions returned by one content search. */
const DEFAULT_LIMIT = 20;
/** Environment override for the independent index directory. */
const INDEX_DIR_ENV = "DSH_SWITCH_SEARCH_DIR";
/**
* The log-only event a rename (or an automatic title) lands as. It is appended
* to the session log, so it also bumps the session watermark — which is why the
* poll would already catch it, one interval later.
*/
const TITLE_EVENT_TYPE = "session/title";
/** Rename bursts coalesce into one title fold (an auto-title pass fires several). */
const TITLE_FLUSH_MS = 250;
/** Normalize a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
/** Whether a normalized URL hostname names the local loopback authority. */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether the request Host matches a trustedHosts entry (exact or port-less). */
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return (entryUrl.port === "" ? entryUrl.hostname : entryUrl.host) === hostUrl.host;
	});
}
/**
* Browser-trust fence, behaviorally identical to the /api gateway's fence:
* loopback Host header or a configured trusted authority; cross-site browser
* markers refuse. DNS-rebinding / cross-site defense, not authentication.
*/
function isTrustedApiRequest(req, trustedHosts) {
	const host = req.headers.host;
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	const fetchSite = req.headers["sec-fetch-site"];
	if (typeof fetchSite === "string" && fetchSite === "cross-site") return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** Read the raw request body (bounded; malformed handled by callers). */
async function readRawBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		total += buffer.length;
		if (total > MAX_BODY_BYTES) throw new Error("request body too large");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
/** Read and parse the JSON request body (bounded; malformed → null). */
async function readJsonBody(req) {
	const text = await readRawBody(req);
	if (text.trim() === "") return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new Error("malformed JSON body");
	}
}
/** Write a JSON response with the given status. */
function writeJson(res, status, body) {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-cache"
	});
	res.end(text);
}
/** Write a raw text response with the given status and content type. */
function writeRaw(res, status, contentType, body) {
	res.writeHead(status, {
		"content-type": contentType,
		"cache-control": "no-cache"
	});
	res.end(body);
}
/** Fold titles for a set of sessions into a sessionId → title map. */
async function titleMap(sessionQuery, sessionIds) {
	if (sessionIds.length === 0) return /* @__PURE__ */ new Map();
	const observations = await sessionQuery.readTitleSnapshots([...new Set(sessionIds)]);
	const map = /* @__PURE__ */ new Map();
	for (const observation of observations) {
		if (observation.status !== "fulfilled" || observation.value === void 0) continue;
		const title = observation.value.title?.title;
		if (typeof title === "string" && title.trim().length > 0) map.set(observation.value.session.id, title);
	}
	return map;
}
/** list-sessions: the title-search corpus (index-served, live fallback). */
async function listSessions(runtime) {
	const index = runtime.index;
	const sessionQuery = runtime.sessionQuery;
	if (index.engine.isOpen && index.engine.countSessions() > 0) {
		if (sessionQuery !== void 0 && index.sync.snapshot().state !== "syncing") index.sync.poll().catch(() => {});
		return {
			ok: true,
			items: index.engine.listIndexedSessions().map((session) => ({
				sessionId: session.sessionId,
				title: session.title,
				cwd: session.cwd,
				updatedAt: session.updatedAt
			}))
		};
	}
	if (sessionQuery === void 0) return {
		ok: false,
		error: "sessionQuery 服务不可用，且独立索引尚未建立"
	};
	try {
		const records = await sessionQuery.listSessions();
		const titles = await titleMap(sessionQuery, records.map((record) => record.header.id));
		return {
			ok: true,
			items: records.map((record) => ({
				sessionId: record.header.id,
				title: titles.get(record.header.id) ?? "",
				cwd: record.header.cwd ?? "",
				updatedAt: record.header.createdAt
			}))
		};
	} catch (err) {
		return {
			ok: false,
			error: String(err instanceof Error ? err.message : err)
		};
	}
}
/** 本地日界：'YYYY-MM-DD' → 当日 00:00（nextDay=true 时为次日 00:00，含结束日）。 */
function dayBoundaryMs(value, nextDay = false) {
	if (typeof value !== "string" || value.trim() === "") return void 0;
	const parsed = /* @__PURE__ */ new Date(`${value.trim()}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) return void 0;
	const ms = parsed.getTime();
	return nextDay ? ms + 864e5 : ms;
}
/**
* content-search: session-grouped hits from DRS (hard dependency).
* 检索语义（会话分组/类型加权/表面与归档日期过滤/锚定节选）全部在
* dsh-reference-session-collector 投影库侧完成；DRS 不可达 → 显式报错，
* **不回退本地索引**（本地引擎只剩会话头元数据面）。
*/
async function contentSearch(runtime, payload, requestHost = "") {
	const record = payload;
	const query = typeof record?.query === "string" ? record.query.trim() : "";
	if (query === "") return {
		ok: false,
		error: "缺少 query"
	};
	const archived = record?.archived === "active" ? "active" : record?.archived === "archived" ? "archived" : "all";
	const fromMs = dayBoundaryMs(record?.from);
	const toMs = record?.to === void 0 ? void 0 : dayBoundaryMs(record?.to, true);
	const requestedLimit = typeof record?.limit === "number" && Number.isSafeInteger(record.limit) ? record.limit : DEFAULT_LIMIT;
	const limit = Math.min(Math.max(1, requestedLimit), 100);
	const sortBy = record?.sortBy === "time" ? "time" : "relevance";
	let types;
	if (Array.isArray(record?.types) && record.types.length > 0) types = record.types.filter((entry) => entry === "all" || entry === "user" || entry === "reply" || entry === "tool");
	else types = ["user", "reply"];
	const kinds = resolveTypes(types);
	try {
		return {
			ok: true,
			items: await runtime.drsSource.searchGrouped({
				query,
				kinds,
				archived,
				sortBy,
				limit,
				...record?.expand === true ? { expand: true } : {},
				...requestHost === "" ? {} : { atHost: requestHost },
				...fromMs === void 0 ? {} : { from: fromMs },
				...toMs === void 0 ? {} : { to: toMs }
			})
		};
	} catch (err) {
		const failure = classifyDrsFailure(err);
		runtime.log(`[switch-search] content-search failed: ${failure.code} ${failure.detail}`);
		return {
			ok: false,
			code: failure.code,
			error: messageForDrsFailure(failure.code)
		};
	}
}
/** search-status: 可用性由通道探针裁决（HTTP 或进程内任一可用）；附当前 mode 与库明细。 */
async function searchStatus(runtime, requestHost = "") {
	const index = runtime.index;
	const sync = index.sync.snapshot();
	const probe = await runtime.drsSource.probeDetail(requestHost);
	return {
		ok: true,
		available: probe.ok,
		reason: probe.reason,
		detail: probe.detail,
		/** 当前实际可用通道：http / in-process / none。 */
		mode: probe.mode,
		/** DRSC 路由 404（插件未激活，投影库不会自动更新）；旧客户端忽略此字段。 */
		notActivated: probe.notActivated === true,
		/** 配置面选择的通道：auto / http / in-process。 */
		transport: runtime.config().contentTransport ?? "auto",
		/** 进程内只读廂明细（库版本/会话数/目录）。 */
		local: {
			schemaVersion: probe.schemaVersion,
			expected: probe.expected,
			sessions: probe.sessions,
			dir: probe.dir
		},
		indexing: sync.state === "syncing",
		archivedSessions: index.engine.isOpen ? index.engine.countArchived() : 0,
		archive: index.archiveReader.diagnostics(),
		sync,
		rebuild: index.rebuild,
		deepSync: index.deepSync
	};
}
/** index-status: full lifecycle surface for the settings row. */
async function indexStatus(runtime) {
	const index = runtime.index;
	const sync = index.sync.snapshot();
	let indexed = sync.indexed;
	if (index.engine.isOpen) indexed = index.engine.countSessions();
	return {
		ok: true,
		available: index.engine.isOpen && indexed > 0,
		archivedSessions: index.engine.isOpen ? index.engine.countArchived() : 0,
		steward: detectSteward(),
		driver: index.engine.driverLabel,
		archive: index.archiveReader.diagnostics(),
		dir: index.layout.dir,
		archives: await listArchives(index.layout).catch(() => []),
		sync: {
			...sync,
			indexed
		},
		rebuild: index.rebuild,
		deepSync: index.deepSync
	};
}
/**
* index-rebuild: start the non-destructive 整理 (shadow build → atomic swap →
* archives). Responds immediately; progress rides index-status.
*/
async function indexRebuild(runtime) {
	const index = runtime.index;
	if (index.rebuild.state === "building" || index.rebuild.state === "swapping") return {
		ok: false,
		error: "整理已在进行中"
	};
	const sessionQuery = runtime.sessionQuery;
	if (sessionQuery === void 0 || sessionQuery.readSession === void 0) return {
		ok: false,
		error: "sessionQuery 服务不可用，无法读取会话日志"
	};
	const config = runtime.config();
	const keepArchives = Math.max(0, config.archiveKeep ?? DEFAULT_CONFIG.archiveKeep);
	rebuildIndex(index.engine, index.layout, {
		listSessions: () => sessionQuery.listSessions(),
		readSession: async (sessionId) => {
			const snapshot = await sessionQuery.readSession(sessionId);
			return {
				session: snapshot.session,
				events: snapshot.events
			};
		}
	}, keepArchives, void 0, runtime.registry, {
		log: runtime.log,
		onState: (live) => {
			index.rebuild = live;
		}
	}).then((state) => {
		index.rebuild = state;
	}).catch((err) => {
		index.rebuild = {
			state: "error",
			done: 0,
			total: 0,
			startedAt: Date.now(),
			finishedAt: 0,
			failures: [],
			error: String(err instanceof Error ? err.message : err)
		};
	});
	index.rebuild = {
		state: "building",
		done: 0,
		total: 0,
		startedAt: Date.now(),
		finishedAt: 0,
		failures: []
	};
	return {
		ok: true,
		started: true
	};
}
/**
* index-deep-sync：**深度同步**按钮的后端。
* 1) 触发 DRS 后台慢速同步（POST `?op=sync`），轮询 op=status 直到 DRS 落定：
*    新 DRS 看 `syncing`（真实在跑旗标）；旧 DRS 无该字段时退回 `last_sync.busy`；
* 2) 再跑本地索引的非破坏性重建（整理），让标题/头部面跟上最新语料。
* 全程后台执行，进度经 index-status 的 deepSync 面暴露；并发调用直接拒绝。
* @param runtime - 运行时依赖。
* @param requestHost - 调用方 Host（同源直连 DRS，端口动态分配）。
*/
async function indexDeepSync(runtime, requestHost = "") {
	const index = runtime.index;
	if (index.deepSync.state === "drs-syncing" || index.deepSync.state === "rebuilding") return {
		ok: false,
		error: "深度同步已在进行中"
	};
	const sleepMs = (ms) => new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
	index.deepSync = {
		state: "drs-syncing",
		startedAt: Date.now()
	};
	(async () => {
		try {
			const trigger = await runtime.drsSource.triggerSync(requestHost);
			if (!trigger.ok) throw new Error(`触发 DRS 同步失败：${trigger.error ?? "unknown"}`);
			const deadline = Date.now() + 18e4;
			let settled = false;
			while (Date.now() < deadline) {
				await sleepMs(2e3);
				const detail = await runtime.drsSource.statusDetail(requestHost);
				const syncing = detail?.["syncing"];
				if (typeof syncing === "boolean") settled = !syncing;
				else {
					const lastSync = detail?.["last_sync"];
					settled = lastSync !== void 0 && lastSync.busy === false;
				}
				if (settled) break;
			}
			index.deepSync = {
				state: "rebuilding",
				startedAt: index.deepSync.startedAt
			};
			const started = await indexRebuild(runtime);
			if (!started.ok) throw new Error(started.error ?? "本地索引重建未能启动");
			while (index.rebuild.state === "building" || index.rebuild.state === "swapping") await sleepMs(1500);
			index.deepSync = {
				state: "done",
				startedAt: index.deepSync.startedAt,
				finishedAt: Date.now(),
				drsSettled: settled
			};
		} catch (err) {
			index.deepSync = {
				state: "failed",
				startedAt: index.deepSync.startedAt,
				finishedAt: Date.now(),
				error: String(err instanceof Error ? err.message : err)
			};
		}
	})();
	return {
		ok: true,
		started: true
	};
}
/**
* Tombs for the two methods this package used to own.
*
* `list-archived` / `archive-prune` moved to dsh-session-steward along with the
* whole session-history face. A stale client bundle (browser refresh does not
* reload the host half) must fail LOUDLY and be told where the feature went —
* a silent 404 would read as "archiving is broken".
*/
const MOVED_TO_STEWARD = {
	"list-archived": "session-history-list",
	"archive-prune": "session-history-prune"
};
/** Build the explicit "moved" error body for a tombstoned method. */
function movedToSteward(method) {
	return {
		ok: false,
		error: `"${method}" 已迁至会话管家 dsh-session-steward：请改用 POST /session-steward/api/${MOVED_TO_STEWARD[method]}`
	};
}
/** index-export: dump the active index as JSON Lines. */
async function indexExport(runtime, res) {
	const index = runtime.index;
	if (index.engine.isOpen === false) {
		writeJson(res, 200, {
			ok: false,
			error: "独立索引未就绪"
		});
		return;
	}
	writeRaw(res, 200, "application/x-ndjson; charset=utf-8", exportSnapshot(index.engine));
}
/** index-import: parse a JSON Lines snapshot and swap it in as the active index. */
async function indexImport(runtime, text) {
	const index = runtime.index;
	if (index.rebuild.state === "building" || index.rebuild.state === "swapping") return {
		ok: false,
		error: "整理/导入已在进行中"
	};
	if (text.includes("\"snapshot\"")) try {
		const envelope = JSON.parse(text);
		if (typeof envelope.snapshot === "string") text = envelope.snapshot;
	} catch {}
	const parsed = parseSnapshot(text);
	if (parsed.records.length === 0) return {
		ok: false,
		error: `快照无可导入会话（跳过 ${parsed.skipped} 行）`
	};
	const config = runtime.config();
	const keepArchives = Math.max(0, config.archiveKeep ?? DEFAULT_CONFIG.archiveKeep);
	importIntoIndex(index.engine, index.layout, parsed.records, keepArchives).then((state) => {
		index.rebuild = state;
	}).catch((err) => {
		index.rebuild = {
			state: "error",
			done: 0,
			total: parsed.records.length,
			startedAt: Date.now(),
			finishedAt: 0,
			failures: [],
			error: String(err instanceof Error ? err.message : err)
		};
	});
	index.rebuild = {
		state: "building",
		done: 0,
		total: parsed.records.length,
		startedAt: Date.now(),
		finishedAt: 0,
		failures: []
	};
	return {
		ok: true,
		started: true,
		sessions: parsed.records.length,
		skipped: parsed.skipped
	};
}
/**
* Plugin body: mount the fenced /switch-search/api route and own the independent
* index lifecycle.
* @param ctx - host plugin context (webServer, webStartup/webRuntime, optional sessionQuery).
* @param entry - composition entry (0.1.7: `.volatile()` fields arrive as live refs).
*/
function apply(ctx, entry = {}) {
	const current = () => {
		const { search } = bridgeOverlay(settingsBridge);
		const bool = (key, v) => typeof search[key] === "boolean" ? search[key] : v;
		const num = (key, v) => typeof search[key] === "number" && Number.isFinite(search[key]) ? search[key] : v;
		const str = (key, v) => typeof search[key] === "string" ? search[key] : v;
		const mode = (v) => search["defaultMode"] === "title" || search["defaultMode"] === "content" ? search["defaultMode"] : v;
		const corpus = (v) => search["corpusSource"] === "native" || search["corpusSource"] === "drs" ? search["corpusSource"] : v;
		const transport = (v) => {
			const value = search["contentTransport"];
			return value === "http" || value === "in-process" || value === "auto" ? value : v;
		};
		return {
			enabled: bool("enabled", readVolatileValue(entry.enabled) ?? DEFAULT_CONFIG.enabled),
			defaultMode: mode(readVolatileValue(entry.defaultMode) ?? DEFAULT_CONFIG.defaultMode),
			autoSync: bool("autoSync", readVolatileValue(entry.autoSync) ?? DEFAULT_CONFIG.autoSync),
			syncIntervalMs: num("syncIntervalMs", readVolatileValue(entry.syncIntervalMs) ?? DEFAULT_CONFIG.syncIntervalMs),
			archiveKeep: num("archiveKeep", readVolatileValue(entry.archiveKeep) ?? DEFAULT_CONFIG.archiveKeep),
			indexDir: str("indexDir", readVolatileValue(entry.indexDir) ?? DEFAULT_CONFIG.indexDir),
			corpusSource: corpus(readVolatileValue(entry.corpusSource) ?? DEFAULT_CONFIG.corpusSource),
			drsBaseUrl: str("drsBaseUrl", readVolatileValue(entry.drsBaseUrl) ?? DEFAULT_CONFIG.drsBaseUrl),
			contentTransport: transport(readVolatileValue(entry.contentTransport) ?? DEFAULT_CONFIG.contentTransport)
		};
	};
	const settingsBridge = installLegacySettingsBridge(ctx);
	const config = current();
	const layout = {
		...DEFAULT_INDEX_LAYOUT,
		dir: resolveIndexDir(config.indexDir || process.env[INDEX_DIR_ENV])
	};
	const engine = new SwitchIndexEngine({ path: `${layout.dir}/${layout.active}` });
	const sessionQuery = ctx.get("sessionQuery");
	const log = (msg) => {
		try {
			ctx.logger?.info?.(`[switch-search] ${msg}`);
		} catch {}
	};
	const archiveReader = createArchiveSource(() => ctx.get("workspaceRegistry"));
	const readProjectionTitle = (sessionId) => {
		try {
			const path = join(process.env["DSH_HOME"] ?? join(homedir(), ".dsh"), "storages", "session_projcache", "sessions", `${sessionId}.json`);
			if (!existsSync(path)) return "";
			const value = JSON.parse(readFileSync(path, "utf8")).record?.rows?.title?.val;
			return typeof value === "string" ? value : "";
		} catch {
			return "";
		}
	};
	const trustedRuntime = ctx.webStartup ?? ctx.webRuntime;
	const trustedHosts = trustedRuntime.trustedHosts;
	const localArm = createDrsLocalArm({
		dir: () => resolveDrsDir(),
		log
	});
	const drsSource = new DrsCorpusSource({
		baseUrl: resolveDrsBaseUrl(config.drsBaseUrl, trustedHosts),
		hostHeader: trustedHosts !== void 0 && trustedHosts.length > 0 ? trustedHosts[0] : void 0,
		log,
		transport: () => current().contentTransport ?? "auto",
		inProcess: () => localArm
	});
	const state = {
		engine,
		archiveReader,
		sync: new SwitchWatermarkSync(engine, {
			listSessions: () => sessionQuery?.listSessions() ?? Promise.resolve([]),
			readSession: async (sessionId) => {
				if (sessionQuery?.readSession === void 0) throw new Error("sessionQuery.readSession 不可用");
				return sessionQuery.readSession(sessionId);
			},
			readTitleSnapshots: sessionQuery === void 0 ? void 0 : (ids) => sessionQuery.readTitleSnapshots(ids)
		}, () => ({ archivedSessionIds: archiveReader.read().ids }), log, void 0, readProjectionTitle, config.corpusSource === "native" ? void 0 : drsSource),
		layout,
		rebuild: {
			state: "idle",
			done: 0,
			total: 0,
			startedAt: 0,
			finishedAt: 0,
			failures: []
		},
		deepSync: { state: "idle" }
	};
	const runtime = {
		sessionQuery,
		index: state,
		drsSource,
		config: () => current(),
		registry: () => ({ archivedSessionIds: archiveReader.read().ids }),
		log
	};
	let syncTimer;
	const scheduleSync = (intervalMs) => {
		if (syncTimer !== void 0) clearInterval(syncTimer);
		if (intervalMs <= 0) return;
		syncTimer = setInterval(() => {
			if (current().autoSync === false) return;
			state.sync.poll().catch(() => {});
		}, Math.max(5e3, intervalMs));
	};
	let pendingTitleIds = /* @__PURE__ */ new Set();
	let titleTimer;
	const flushPendingTitles = () => {
		titleTimer = void 0;
		const ids = [...pendingTitleIds];
		pendingTitleIds = /* @__PURE__ */ new Set();
		if (ids.length === 0) return;
		state.sync.refreshTitles(ids).catch(() => {});
	};
	ctx.effect(() => {
		const bus = ctx;
		if (typeof bus.on !== "function") return () => {};
		try {
			return bus.on("session/event", (session, event) => {
				if (event?.type !== TITLE_EVENT_TYPE) return;
				if (current().autoSync === false) return;
				const id = session?.id;
				if (typeof id !== "string" || id === "") return;
				pendingTitleIds.add(id);
				if (titleTimer !== void 0) return;
				titleTimer = setTimeout(flushPendingTitles, TITLE_FLUSH_MS);
			});
		} catch {
			return () => {};
		}
	}, "dsh-search-index: realtime titles");
	const initialConfig = current();
	(async () => {
		try {
			const recovered = await recoverIndex(layout, log);
			if (recovered.length > 0) log(`index recovery applied ${recovered.length} fix(es)`);
		} catch (err) {
			log(`index recovery failed: ${String(err instanceof Error ? err.message : err)}`);
		}
		await engine.open().catch(() => {});
		log(`index open: driver=${engine.driverLabel} dir=${layout.dir}`);
		if (engine.driverLabel === "node:sqlite") log("tip: optional speedup not active — approve the better-sqlite3 build (add \"better-sqlite3@*: true\" under allowBuilds in the profile pnpm-workspace.yaml, then reinstall) to speed up index rebuilds; everything works without it");
		if (initialConfig.autoSync !== false) await state.sync.poll().catch(() => {});
		scheduleSync(initialConfig.syncIntervalMs ?? DEFAULT_CONFIG.syncIntervalMs);
	})();
	ctx.effect(() => () => {
		if (syncTimer !== void 0) clearInterval(syncTimer);
		if (titleTimer !== void 0) clearTimeout(titleTimer);
		localArm.dispose();
		engine.close();
	}, "dsh-search-index: index lifecycle");
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/switch-search/api",
		handler: async (req, res) => {
			if (!isTrustedApiRequest(req, trustedRuntime.trustedHosts)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
			const method = pathname.startsWith("/switch-search/api/") ? pathname.slice(19) : void 0;
			if (method === void 0 || method.includes("/")) {
				writeJson(res, 404, {
					ok: false,
					error: "unknown switch-search API method"
				});
				return;
			}
			try {
				if (method === "settings-describe") {
					if (settingsBridge.bridge !== void 0) {
						writeJson(res, 200, settingsDescribe(settingsBridge));
						return;
					}
					writeJson(res, 200, {
						ok: true,
						namespaces: { "switch-search": { ...current() } },
						writable: false,
						revision: settingsBridge.revision
					});
					return;
				}
				if (method === "settings-mutate") {
					const payload = await readJsonBody(req);
					writeJson(res, 200, await settingsMutate(settingsBridge, payload));
					return;
				}
				if (current().enabled === false) {
					writeJson(res, 200, {
						ok: false,
						error: `子域已关闭（enabled=false）：${method} 未注册`
					});
					return;
				}
				if (method === "index-export") {
					await indexExport(runtime, res);
					return;
				}
				if (method === "index-import") {
					const text = await readRawBody(req);
					writeJson(res, 200, await indexImport(runtime, text));
					return;
				}
				const payload = await readJsonBody(req);
				if (method === "list-sessions") {
					writeJson(res, 200, await listSessions(runtime));
					return;
				}
				if (method === "content-search") {
					writeJson(res, 200, await contentSearch(runtime, payload, String(req.headers.host ?? "")));
					return;
				}
				if (method === "search-status" || method === "index-status") {
					const host = String(req.headers.host ?? "");
					writeJson(res, 200, method === "search-status" ? await searchStatus(runtime, host) : await indexStatus(runtime));
					return;
				}
				if (method === "index-rebuild") {
					writeJson(res, 200, await indexRebuild(runtime));
					return;
				}
				if (method === "index-deep-sync") {
					writeJson(res, 200, await indexDeepSync(runtime, String(req.headers.host ?? "")));
					return;
				}
				if (method === "list-archived" || method === "archive-prune") {
					writeJson(res, 410, movedToSteward(method));
					return;
				}
				writeJson(res, 404, {
					ok: false,
					error: `unknown switch-search API method "${method}"`
				});
			} catch (err) {
				writeJson(res, 400, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}), "dsh-search-index: /switch-search/api route");
}
//#endregion
export { Config, DEFAULT_CONFIG, DEFAULT_INDEX_LAYOUT, SWITCH_SEARCH_SETTINGS_NAMESPACE, SwitchIndexEngine, SwitchWatermarkSync, apply, createArchiveSource, exportSnapshot, importIntoIndex, inject, name, parseSnapshot, rebuildIndex, recoverIndex };

//# sourceMappingURL=index.mjs.map