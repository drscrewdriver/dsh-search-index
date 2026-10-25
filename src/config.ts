/**
 * Pure shared config surface for dsh-search-index.
 *
 * Kept schemastery-free so the browser bundle can import it directly (the
 * host half owns the schemastery schema in src/index.ts). The settings
 * namespace reuses the same shape, so a value admitted at one surface is
 * admitted at the other — same pattern as dsh-thinking-levels' thinking-level.ts.
 */

/** Default mode of the sidebar search panel when it opens. */
export type SwitchSearchDefaultMode = 'title' | 'content'

/** Runtime-adjustable plugin configuration (settings namespace + composition entry). */
export interface SwitchSearchConfig {
  /** Whether the search plugin is active at all. */
  enabled: boolean
  /** Which search mode the panel opens in by default. */
  defaultMode: SwitchSearchDefaultMode
  /** Whether the independent index auto-syncs from the corpus in the background. */
  autoSync?: boolean
  /** Incremental sync interval in ms (watermark polling). */
  syncIntervalMs?: number
  /** How many archived index files a rebuild keeps. */
  archiveKeep?: number
  /** Optional absolute directory for the independent index files. */
  indexDir?: string
  /**
   * 语料源(T7.1)：'drs'(缺省)=dsh-reference-session-collector 投影库(docs 直插；
   * 内容搜索硬依赖，DRS 不可达 → 显式报错，不回退本地索引)；
   * 'native'=sessionQuery + 转录文件兜底（仅标题/头部元数据面可用）。
   */
  corpusSource?: 'native' | 'drs'
  /** DRS 投影库 API 基址；空=自动（首个 trustedHosts 条目，再退 http://127.0.0.1:8080）。 */
  drsBaseUrl?: string
}

/** Defaults when nothing is configured. */
export const DEFAULT_CONFIG: Required<SwitchSearchConfig> = {
  enabled: true,
  defaultMode: 'title',
  autoSync: true,
  syncIntervalMs: 30_000,
  archiveKeep: 2,
  indexDir: '',
  corpusSource: 'drs',
  drsBaseUrl: '',
}

/** The settings namespace the host half registers (kept in lockstep with src/index.ts). */
export const SWITCH_SEARCH_SETTINGS_NAMESPACE = 'switch-search'

/** 别名：与 DEFAULT_CONFIG 同值（合并包时代的命名，拆回后保留调用面）。 */
export const SWITCH_DEFAULT_CONFIG = DEFAULT_CONFIG
