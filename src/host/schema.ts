/**
 * SQLite schema for the independent switch-search full-text index.
 *
 * Fully separate from the official session-query derived index: a different
 * application id, a different schema version lineage, and a plugin-owned file
 * path. The official file (application id 0x44534851) is never opened here.
 */
import type { DatabaseSync } from 'node:sqlite'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/** Current switch-search index schema version. Incompatible versions reset in place. */
export const SWITCH_SEARCH_SCHEMA_VERSION = 2

/** Application id marking files owned by this plugin's index (ASCII "SWIS"). */
export const SWITCH_SEARCH_APPLICATION_ID = 0x53574954

/** The official derived-index application id this plugin must never touch. */
export const OFFICIAL_SESSION_QUERY_APPLICATION_ID = 0x44534851

/**
 * Open, validate, and initialize one switch-search index file.
 * Missing directories and files are created; a file that belongs to another
 * application (including the official session-query index) is refused.
 * @param path - absolute path to the index file.
 * @returns initialized database handle owned by the caller.
 */
export async function openIndexDatabase(path: string): Promise<DatabaseSync> {
  const actual = resolve(path)
  await mkdir(dirname(actual), { recursive: true })
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(actual)
  try {
    const { application_id: applicationId } = db.prepare('PRAGMA application_id').get() as { application_id: number }
    const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
    if (applicationId === OFFICIAL_SESSION_QUERY_APPLICATION_ID) {
      throw new Error(`switch-search: "${actual}" is the official session-query index, refusing to open it`)
    }
    if (applicationId !== 0 && applicationId !== SWITCH_SEARCH_APPLICATION_ID) {
      throw new Error(`switch-search: database at "${actual}" belongs to another application`)
    }
    if (applicationId === SWITCH_SEARCH_APPLICATION_ID && version !== SWITCH_SEARCH_SCHEMA_VERSION) {
      resetSchema(db)
    }
    db.exec(`PRAGMA journal_mode = wal`)
    ensureSchema(db)
    return db
  } catch (error: unknown) {
    db.close()
    throw error
  }
}

/** Reset an incompatible database in place, preserving the owning application id. */
function resetSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA writable_schema = OFF;
    PRAGMA journal_mode = delete;
  `)
  for (const row of db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[]) {
    db.exec(`DROP TABLE IF EXISTS "${row.name.replace(/"/g, '""')}"`)
  }
  db.exec(`PRAGMA user_version = 0`)
}

/** Create the persistent schema when absent. */
function ensureSchema(db: DatabaseSync): void {
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
      indexed_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS docs (
      doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      surface TEXT NOT NULL,
      time INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS docs_session_seq ON docs(session_id, seq);
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(text, doc_id UNINDEXED, tokenize = 'trigram');
  `)
  db.exec(`PRAGMA application_id = ${SWITCH_SEARCH_APPLICATION_ID}`)
  db.exec(`PRAGMA user_version = ${SWITCH_SEARCH_SCHEMA_VERSION}`)
}
