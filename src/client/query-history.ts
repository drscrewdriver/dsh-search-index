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
export const QUERY_HISTORY_KEY = 'dsh-search-index.queryHistory'

/**
 * 快照存活时长。
 *
 * 没有 TTL 时，用户隔三天打开面板看到上次的关键词，第一反应是「搜索坏了」
 * 而不是「它记住了」——这比丢失更糟。12h 覆盖「一次排查跨几小时」的典型场景，
 * 又不至于让陈旧现场常驻。
 */
export const QUERY_HISTORY_TTL_MS = 12 * 60 * 60 * 1000

/** 快照结构版本。字段变更即递增，旧版本一律丢弃而不是尽力兼容。 */
export const QUERY_HISTORY_VERSION = 1

/** 面板模式（与 panel.tsx 的 `PanelMode` 同值域，此处不 import 以避免循环依赖）。 */
export type QuerySnapshotMode = 'title' | 'content'

/** 一次搜索现场。 */
export interface QuerySnapshot {
  v: typeof QUERY_HISTORY_VERSION
  /** 写入时刻（epoch ms），TTL 判定用。 */
  at: number
  mode: QuerySnapshotMode
  query: string
  contentType: string
  archivedFilter: string
  dateFrom: string
  dateTo: string
  /** 列表滚动位置（px）。 */
  scrollTop: number
}

/**
 * 存储面的结构子集。
 *
 * 只声明本模块真正用到的两个方法，这样单测能注入替身，不必伪造整个 `Storage`。
 */
export interface QueryStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * 取默认存储。
 *
 * 隐私模式 / SSR / 沙箱 iframe 下 `window` 或 `localStorage` 可能不存在，
 * 或访问即抛——这里全部收敛成 `undefined`，让调用方退化为「不记忆」而不是崩掉面板。
 */
function defaultStorage(): QueryStorage | undefined {
  try {
    const candidate = (globalThis as { localStorage?: QueryStorage }).localStorage
    if (candidate === undefined || candidate === null) return undefined
    if (typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') return undefined
    return candidate
  } catch {
    return undefined
  }
}

/** 快照里的字符串字段：非字符串一律当空串（中性值），不抛错。 */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * 清除快照。
 *
 * 开关关闭、快照过期、快照损坏三条路径都要调它——留着陈旧数据的后果是：
 * 用户关掉开关又打开，会恢复一个「关开关之前」的旧现场，语义错乱。
 *
 * @param storage - 注入的存储面；缺省取 `localStorage`。
 */
export function clearSnapshot(storage?: QueryStorage): void {
  const target = storage ?? defaultStorage()
  if (target === undefined) return
  try {
    target.removeItem(QUERY_HISTORY_KEY)
  } catch {
    // 存储不可写（隐私模式配额/冻结对象）：没有快照可清，静默即可
  }
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
export function readSnapshot(now?: number, storage?: QueryStorage): QuerySnapshot | null {
  const target = storage ?? defaultStorage()
  if (target === undefined) return null

  let raw: string | null = null
  try {
    raw = target.getItem(QUERY_HISTORY_KEY)
  } catch {
    return null
  }
  if (raw === null || raw === '') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    clearSnapshot(target)
    return null
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    clearSnapshot(target)
    return null
  }
  const doc = parsed as Record<string, unknown>
  if (doc['v'] !== QUERY_HISTORY_VERSION) {
    clearSnapshot(target)
    return null
  }

  const at = typeof doc['at'] === 'number' && Number.isFinite(doc['at']) ? doc['at'] : 0
  const clock = now ?? Date.now()
  if (at <= 0 || clock - at > QUERY_HISTORY_TTL_MS) {
    clearSnapshot(target)
    return null
  }

  const mode: QuerySnapshotMode = doc['mode'] === 'content' ? 'content' : 'title'
  const scrollRaw = doc['scrollTop']
  const scrollTop = typeof scrollRaw === 'number' && Number.isFinite(scrollRaw) && scrollRaw > 0 ? scrollRaw : 0

  return {
    v: QUERY_HISTORY_VERSION,
    at,
    mode,
    query: asText(doc['query']),
    contentType: asText(doc['contentType']),
    archivedFilter: asText(doc['archivedFilter']),
    dateFrom: asText(doc['dateFrom']),
    dateTo: asText(doc['dateTo']),
    scrollTop,
  }
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
export function writeSnapshot(snapshot: Omit<QuerySnapshot, 'v' | 'at'>, storage?: QueryStorage): void {
  const target = storage ?? defaultStorage()
  if (target === undefined) return
  const doc: QuerySnapshot = {
    ...snapshot,
    v: QUERY_HISTORY_VERSION,
    at: Date.now(),
  }
  try {
    target.setItem(QUERY_HISTORY_KEY, JSON.stringify(doc))
  } catch {
    // 配额满 / 隐私模式：本窗口仍能正常搜索，只是不记忆
  }
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
export function clampScroll(top: number, scrollHeight: number, clientHeight: number): number {
  if (!Number.isFinite(top) || top <= 0) return 0
  const max = scrollHeight - clientHeight
  if (!Number.isFinite(max) || max <= 0) return 0
  return Math.min(top, max)
}
