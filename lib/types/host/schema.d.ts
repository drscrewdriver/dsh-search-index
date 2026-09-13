/**
 * SQLite schema for the independent switch-search full-text index.
 *
 * Fully separate from the official session-query derived index: a different
 * application id, a different schema version lineage, and a plugin-owned file
 * path. The official file (application id 0x44534851) is never opened here.
 */
import type { DatabaseSync } from 'node:sqlite';
/** Current switch-search index schema version. Incompatible versions reset in place. */
export declare const SWITCH_SEARCH_SCHEMA_VERSION = 4;
/** Application id marking files owned by this plugin's index (ASCII "SWIS"). */
export declare const SWITCH_SEARCH_APPLICATION_ID = 1398229332;
/** The official derived-index application id this plugin must never touch. */
export declare const OFFICIAL_SESSION_QUERY_APPLICATION_ID = 1146308689;
/**
 * Open, validate, and initialize one switch-search index file.
 * Missing directories and files are created; a file that belongs to another
 * application (including the official session-query index) is refused.
 * @param path - absolute path to the index file.
 * @returns initialized database handle owned by the caller.
 */
export declare function openIndexDatabase(path: string): Promise<DatabaseSync>;
//# sourceMappingURL=schema.d.ts.map