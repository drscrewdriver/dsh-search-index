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
		if (applicationId === 1398229332 && version !== 4) resetSchema(db);
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
	db.exec(`PRAGMA user_version = 4`);
}
//#endregion
//#region src/host/extract.ts
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
//#region src/host/engine.ts
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
		this.withWriteTx(() => {
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
        VALUES (?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at,
          archived = 0
      `).run(input.sessionId, input.version, input.title ?? "", input.cwd ?? "", input.updatedAt ?? 0, Date.now());
		});
	}
	/**
	* Write an archived session's header row without any document content:
	* the official archive never removes logs, and the index mirrors that with
	* a flag while skipping the content copy on rebuilds.
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
	* Apply the official archive set: mark archived ids, unmark the rest.
	* Clearing the flag forces the next watermark pass to re-ingest the
	* session's full content (version = -1).
	*/
	setArchived(archivedIds) {
		const db = this.requireDb();
		this.withWriteTx(() => {
			const rows = db.prepare("SELECT session_id, archived FROM sessions").all();
			for (const row of rows) {
				const shouldBe = archivedIds.has(row.session_id) ? 1 : 0;
				if (row.archived === shouldBe) continue;
				if (shouldBe === 1) {
					this.deleteSessionFts(db, row.session_id);
					db.prepare("DELETE FROM docs WHERE session_id = ?").run(row.session_id);
					db.prepare("UPDATE sessions SET archived = 1 WHERE session_id = ?").run(row.session_id);
				} else db.prepare("UPDATE sessions SET archived = 0, version = -1 WHERE session_id = ?").run(row.session_id);
			}
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
        INSERT INTO sessions (session_id, version, title, updated_at, indexed_at)
        VALUES (?, ?, ?, 0, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = excluded.title,
          indexed_at = excluded.indexed_at
      `).run(input.sessionId, input.version, input.title ?? "", Date.now());
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
	/** Active (non-archived) indexed sessions, newest first. */
	listIndexedSessions() {
		return this.requireDb().prepare("SELECT * FROM sessions WHERE archived = 0 ORDER BY updated_at DESC").all().map(rowToSession);
	}
	/** Archived (soft-deleted) sessions, newest first — the archive viewer face. */
	listArchived() {
		return this.requireDb().prepare("SELECT * FROM sessions WHERE archived = 1 ORDER BY updated_at DESC").all().map(rowToSession);
	}
	/** Number of active (non-archived) indexed sessions. */
	countSessions() {
		const row = this.requireDb().prepare("SELECT COUNT(*) AS n FROM sessions WHERE archived = 0").get();
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
		const docs = db.prepare(`
      SELECT d.doc_id AS docId, d.session_id AS sessionId, d.seq, d.type, d.time, d.text,
             s.title, s.updated_at AS updatedAt, f.rank AS ftsRank
      FROM (
        SELECT rowid, rank FROM docs_fts WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?
      ) f
      JOIN docs d ON d.doc_id = f.rowid
      JOIN sessions s ON s.session_id = d.session_id
      WHERE d.type IN (${placeholders}) AND d.surface = 'current' AND s.archived = 0
    `).all(match, MATCH_SCAN_LIMIT, ...types);
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
//#region src/host/sync.ts
/**
* One watermark syncer bound to one open engine. `poll()` is re-entrant-safe:
* overlapping calls collapse into the running pass.
*/
var SwitchWatermarkSync = class {
	engine;
	sessionQuery;
	readArchiveSource;
	log;
	running;
	state = {
		state: "idle",
		lastSyncAt: 0,
		indexed: 0,
		total: 0,
		updated: 0,
		failures: []
	};
	constructor(engine, sessionQuery, readArchiveSource, log) {
		this.engine = engine;
		this.sessionQuery = sessionQuery;
		this.readArchiveSource = readArchiveSource;
		this.log = log;
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
			const records = await this.sessionQuery.listSessions();
			this.state.total = records.length;
			const archiveSource = this.readArchiveSource?.();
			const archivedSet = new Set(archiveSource?.archivedSessionIds ?? []);
			this.engine.setArchived(archivedSet);
			const archivedSetSize = archivedSet.size;
			const failures = [];
			let updated = 0;
			const changedIds = [];
			for (const record of records) {
				const header = record.header;
				const existing = this.engine.getSession(header.id);
				if (archivedSet.has(header.id)) {
					if (existing !== void 0 && existing.archived && existing.version === header.version) continue;
					this.engine.upsertArchivedHeader({
						sessionId: header.id,
						version: header.version,
						cwd: header.cwd ?? "",
						updatedAt: header.createdAt ?? 0,
						title: existing?.title ?? ""
					});
					updated += 1;
					continue;
				}
				if (existing !== void 0 && existing.version === header.version) continue;
				changedIds.push(header.id);
				try {
					const log = await this.sessionQuery.readSession(header.id);
					this.engine.upsertSession({
						sessionId: header.id,
						version: log.session.version,
						cwd: log.session.cwd ?? "",
						updatedAt: log.session.createdAt ?? 0,
						events: log.events
					});
					updated += 1;
				} catch (err) {
					failures.push({
						sessionId: header.id,
						error: String(err instanceof Error ? err.message : err)
					});
				}
			}
			const corpusIds = new Set(records.map((record) => record.header.id));
			for (const indexed of this.engine.listIndexedSessions()) if (!corpusIds.has(indexed.sessionId)) this.engine.removeSession(indexed.sessionId);
			await this.backfillTitles(changedIds);
			await this.backfillArchivedTitles();
			this.state.updated = updated;
			this.state.failures = failures;
			this.state.indexed = this.engine.countSessions();
			this.state.lastSyncAt = Date.now();
			this.state.state = "idle";
			this.state.error = void 0;
			this.log?.(`sync pass: scanned=${this.state.total} updated=${updated} skipped-archived=${String(archivedSetSize)} failures=${failures.length} indexed=${this.state.indexed} duration=${Date.now() - passStart}ms driver=${this.engine.driverLabel}`);
		} catch (err) {
			this.state.state = "error";
			this.state.error = String(err instanceof Error ? err.message : err);
			this.log?.(`sync pass FAILED: ${this.state.error}`);
		}
		return this.snapshot();
	}
	/**
	* Fold titles for archived header-only rows that never got one (archived
	* before first indexing). Bounded: only rows with an empty title, and the
	* title fold reads the log without ingesting content.
	*/
	async backfillArchivedTitles() {
		const readTitles = this.sessionQuery.readTitleSnapshots;
		if (readTitles === void 0) return;
		const missing = this.engine.listArchived().filter((session) => session.title.trim() === "");
		if (missing.length === 0) return;
		try {
			const observations = await readTitles(missing.map((session) => session.sessionId));
			for (const observation of observations) {
				if (observation.status !== "fulfilled" || observation.value === void 0) continue;
				const title = observation.value.title?.title;
				if (typeof title === "string" && title.trim().length > 0) this.engine.updateSessionHeader({
					sessionId: observation.value.session.id,
					title
				});
			}
			this.log?.(`archived title backfill: ${missing.length} rows processed`);
		} catch (err) {
			this.log?.(`archived title backfill failed: ${String(err instanceof Error ? err.message : err)}`);
		}
	}
	/** Fold latest titles for changed sessions into the index header rows. */
	async backfillTitles(sessionIds) {
		const readTitles = this.sessionQuery.readTitleSnapshots;
		if (readTitles === void 0 || sessionIds.length === 0) return;
		try {
			const observations = await readTitles([...new Set(sessionIds)]);
			for (const observation of observations) {
				if (observation.status !== "fulfilled" || observation.value === void 0) continue;
				const title = observation.value.title?.title;
				if (this.engine.getSession(observation.value.session.id)?.archived === true) continue;
				if (typeof title === "string" && title.trim().length > 0) this.engine.updateSessionHeader({
					sessionId: observation.value.session.id,
					title
				});
			}
		} catch {}
	}
};
//#endregion
//#region src/host/archive-source.ts
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
//#region src/host/peers.ts
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
//#region src/host/rebuild.ts
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
			hooks?.log?.(`rebuild corpus listed: ${state.total} sessions; archived copy skips content`);
			emit();
			const archivedSet = new Set(archiveSource?.()?.archivedSessionIds ?? []);
			const readLog = async (header) => {
				const log = await sessionQuery.readSession(header.id);
				return {
					sessionId: header.id,
					version: log.session.version,
					cwd: log.session.cwd ?? "",
					updatedAt: log.session.createdAt ?? 0,
					events: log.events
				};
			};
			for (let i = 0; i < records.length; i += REBUILD_CHUNK) {
				const chunk = records.slice(i, i + REBUILD_CHUNK);
				const chunkStart = Date.now();
				const reads = [];
				for (const record of chunk) {
					const header = record.header;
					if (archivedSet.has(header.id)) continue;
					try {
						reads.push(await readLog(header));
					} catch (err) {
						state.failures.push({
							sessionId: header.id,
							error: String(err instanceof Error ? err.message : err)
						});
					}
				}
				try {
					shadow.runBatched(() => {
						for (const item of reads) {
							shadow.upsertSession(item);
							docsWritten += item.events.length;
						}
						for (const record of chunk) {
							const header = record.header;
							if (archivedSet.has(header.id)) shadow.upsertArchivedHeader({
								sessionId: header.id,
								version: header.version,
								cwd: header.cwd ?? "",
								updatedAt: header.createdAt ?? 0
							});
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
					for (const record of chunk) {
						const header = record.header;
						if (archivedSet.has(header.id)) try {
							shadow.upsertArchivedHeader({
								sessionId: header.id,
								version: header.version,
								cwd: header.cwd ?? "",
								updatedAt: header.createdAt ?? 0
							});
						} catch {}
					}
				}
				state.done = Math.min(state.total, i + chunk.length);
				onProgress?.(state.done, state.total);
				emit();
				hooks?.log?.(`rebuild ${state.done}/${state.total} (${Math.round(state.done / Math.max(1, state.total) * 100)}%) ${rate()} elapsed ${Math.round((Date.now() - startedMs) / 1e3)}s eta ${eta()} chunk ${Date.now() - chunkStart}ms`);
			}
			shadow.close();
		} catch (error) {
			shadow.close();
			await unlink(buildingPath).catch(() => {});
			throw error;
		}
		state.state = "swapping";
		emit();
		hooks?.log?.(`rebuild shadow complete: ${state.done} sessions, ~${docsWritten} docs, ${state.failures.length} failures; swapping`);
		const activePath = join(layout.dir, layout.active);
		if (existsSync(activePath)) {
			activeEngine.close();
			await rename(activePath, join(layout.dir, `${layout.archivePrefix}${Date.now()}.sqlite`));
		}
		await rename(buildingPath, activePath);
		await activeEngine.open();
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
/** Import doc-level records into the shadow file and swap it in (same swap path). */
async function importIntoIndex(activeEngine, layout, records, keepArchives) {
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
					shadow.importSessionDocs({
						sessionId: record.sessionId,
						version: record.version,
						title: record.title ?? "",
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
		const activePath = join(layout.dir, layout.active);
		if (existsSync(activePath)) {
			activeEngine.close();
			await rename(activePath, join(layout.dir, `${layout.archivePrefix}${Date.now()}.sqlite`));
		}
		await rename(buildingPath, activePath);
		await activeEngine.open();
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
/** Remove the oldest archives beyond the retention bound. */
async function pruneArchives(layout, keep) {
	const archives = await listArchives(layout);
	const excess = archives.length - Math.max(0, keep);
	for (let i = 0; i < excess; i += 1) await unlink(join(layout.dir, archives[i])).catch(() => {});
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
//#region src/host/snapshot.ts
/** Render the snapshot header line. */
function snapshotHeader() {
	return JSON.stringify({
		v: 1,
		kind: "dsh-switch-search-snapshot",
		exportedAt: Date.now()
	});
}
/**
* Export the whole active index as a JSON Lines string.
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
			docs
		});
	}
	return {
		records,
		skipped
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
	indexDir: ""
};
/** The settings namespace the host half registers (kept in lockstep with src/index.ts). */
const SWITCH_SEARCH_SETTINGS_NAMESPACE = "switch-search";
//#endregion
//#region src/index.ts
/** Stable plugin name for the cordis row. */
const name = "dsh-search-index";
/** Services required before mounting: the web server routes and the trust list. */
const inject = ["webServer", "webRuntime"];
/** Composition-entry schema: what a dsh profile may configure at assembly time.
*  0.1.7：volatile 字段即设置表单；`indexDir` 是部署路径，不走页面。 */
const Config = z.object({
	enabled: z.boolean().default(true).volatile(),
	defaultMode: z.union(["title", "content"]).default("title").volatile(),
	autoSync: z.boolean().default(true).volatile(),
	syncIntervalMs: z.number().default(3e4).volatile(),
	archiveKeep: z.number().default(2).volatile(),
	indexDir: z.string().default("")
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
/**
* content-search: session-grouped hits from the independent index.
* `sortBy: 'time'` orders by session recency (`updatedAt`), anything else by
* relevance; the host orders before truncating so the page is honest.
*/
async function contentSearch(runtime, payload) {
	const record = payload;
	const query = typeof record?.query === "string" ? record.query.trim() : "";
	if (query === "") return {
		ok: false,
		error: "缺少 query"
	};
	const requestedLimit = typeof record?.limit === "number" && Number.isSafeInteger(record.limit) ? record.limit : DEFAULT_LIMIT;
	const limit = Math.min(Math.max(1, requestedLimit), 100);
	const sortBy = record?.sortBy === "time" ? "time" : "relevance";
	let types;
	if (Array.isArray(record?.types) && record.types.length > 0) types = record.types.filter((entry) => entry === "all" || entry === "user" || entry === "reply" || entry === "tool");
	else types = ["user", "reply"];
	const index = runtime.index;
	if (index.engine.isOpen === false) return {
		ok: false,
		error: "独立索引未就绪：请在面板或设置中先建立索引（整理索引）"
	};
	try {
		return {
			ok: true,
			items: index.engine.search({
				query,
				types,
				limit,
				sortBy
			})
		};
	} catch (err) {
		return {
			ok: false,
			error: String(err instanceof Error ? err.message : err)
		};
	}
}
/** search-status: probe the independent index readiness and progress. */
async function searchStatus(runtime) {
	const index = runtime.index;
	const sync = index.sync.snapshot();
	return {
		ok: true,
		available: index.engine.isOpen && index.engine.countSessions() > 0,
		reason: index.engine.isOpen ? void 0 : "not-open",
		indexing: sync.state === "syncing",
		archivedSessions: index.engine.countArchived(),
		archive: index.archiveReader.diagnostics(),
		sync,
		rebuild: index.rebuild
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
		rebuild: index.rebuild
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
* @param ctx - host plugin context (webServer, webRuntime, optional sessionQuery).
* @param entry - composition entry (0.1.7: `.volatile()` fields arrive as live refs).
*/
function apply(ctx, entry = {}) {
	const current = () => ({
		enabled: readVolatileValue(entry.enabled) ?? DEFAULT_CONFIG.enabled,
		defaultMode: readVolatileValue(entry.defaultMode) ?? DEFAULT_CONFIG.defaultMode,
		autoSync: readVolatileValue(entry.autoSync) ?? DEFAULT_CONFIG.autoSync,
		syncIntervalMs: readVolatileValue(entry.syncIntervalMs) ?? DEFAULT_CONFIG.syncIntervalMs,
		archiveKeep: readVolatileValue(entry.archiveKeep) ?? DEFAULT_CONFIG.archiveKeep,
		indexDir: readVolatileValue(entry.indexDir) ?? DEFAULT_CONFIG.indexDir
	});
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
		}, () => ({ archivedSessionIds: archiveReader.read().ids }), log),
		layout,
		rebuild: {
			state: "idle",
			done: 0,
			total: 0,
			startedAt: 0,
			finishedAt: 0,
			failures: []
		}
	};
	const runtime = {
		sessionQuery,
		index: state,
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
		engine.close();
	}, "dsh-search-index: index lifecycle");
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/switch-search/api",
		handler: async (req, res) => {
			if (!isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)) {
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
					writeJson(res, 200, await contentSearch(runtime, payload));
					return;
				}
				if (method === "search-status" || method === "index-status") {
					writeJson(res, 200, method === "search-status" ? await searchStatus(runtime) : await indexStatus(runtime));
					return;
				}
				if (method === "index-rebuild") {
					writeJson(res, 200, await indexRebuild(runtime));
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