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
export const DRS_API_PATH = '/api/dsh-reference-session-collector'

/** 语料列表分页大小(百会话级一轮 1-2 页;DRS 侧 offset/limit 透传)。 */
export const DRS_CORPUS_PAGE = 500

/** 一个 DRS 会话头(watermark 代理 + 检索排序字段)。 */
export interface DrsCorpusHead {
  sessionId: string
  version: number
  title: string
  cwd: string
  updatedAt: number
  archived: boolean
}

/** 一个 DRS 检索臂文档(surface 已折算成引擎列的字符串域)。 */
export interface DrsCorpusDoc {
  seq: number
  type: string
  surface: 'current' | 'shadowed'
  time: number
  text: string
}

/** 一个 DRS 会话的完整语料(头 + docs)。 */
export interface DrsCorpusSession {
  head: DrsCorpusHead
  docs: DrsCorpusDoc[]
}

export interface DrsCorpusSourceOptions {
  /** DRS API 基址(http://host[:port];解析序见 resolveDrsBaseUrl)。 */
  baseUrl: string
  /** 注入面(单测);缺省全局 fetch。 */
  fetchImpl?: typeof fetch
  /** 显式 Host 头(trustedHosts 首条回显;缺省不覆盖)。 */
  hostHeader?: string
  log?: (message: string) => void
}

/**
 * 基址解析:显式配置 > 首个 trustedHosts 条目(补 http:// 前缀)>
 * `http://127.0.0.1:8080`(宿主默认口;trustedHosts 缺席的老线 DRS 门本就放行)。
 */
export function resolveDrsBaseUrl(explicit: string | undefined, trustedHosts?: readonly string[]): string {
  const trimmed = explicit?.trim() ?? ''
  const pick = trimmed !== '' ? trimmed : trustedHosts?.find(entry => entry.trim() !== '')?.trim()
  if (pick === undefined || pick === '') return 'http://127.0.0.1:8080'
  return /^https?:\/\//u.test(pick) ? pick : `http://${pick}`
}

export class DrsCorpusSource {
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: DrsCorpusSourceOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  /** 一个 GET 的 JSON 包络(ok!==true 或非 2xx 一律抛,由调用方回退 native)。 */
  private async getJson(query: string, atHost?: string): Promise<Record<string, unknown>> {
    // atHost=同源转发臂（调用方请求的 Host 头）：宿主端口动态分配时
    // 配置缺省口(8080)猜不中——同源直连以请求 Host 优先。
    const source = atHost !== undefined && atHost !== '' ? `http://${atHost}` : this.options.baseUrl
    const base = source.replace(/\/+$/u, '')
    const url = `${base}${DRS_API_PATH}${query}`
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: {
          accept: 'application/json',
          ...(this.options.hostHeader === undefined ? {} : { host: this.options.hostHeader }),
        },
      })
    } catch (err) {
      throw new Error(`DRS ${query}: ${String(err instanceof Error ? err.message : err)}`)
    }
    if (!response.ok) throw new Error(`DRS ${query} → HTTP ${String(response.status)}`)
    const body = await response.json() as unknown
    if (typeof body !== 'object' || body === null) throw new Error(`DRS ${query}: 响应非 JSON 对象`)
    const record = body as Record<string, unknown>
    if (record['ok'] !== true) {
      throw new Error(`DRS ${query}: ok=false(${String(record['error'] ?? 'unknown')})`)
    }
    return record
  }

  private static headOf(row: Record<string, unknown>, fallbackId: string): DrsCorpusHead {
    return {
      sessionId: String(row['session_id'] ?? fallbackId),
      version: Number(row['artifact_mtime_ms'] ?? 0),
      title: String(row['title'] ?? ''),
      cwd: String(row['cwd'] ?? ''),
      updatedAt: Number(row['last_time_ms'] ?? 0),
      archived: Number(row['archived'] ?? 0) === 1,
    }
  }

  /** 全量语料头(内部翻页;rows 空或凑满 total 即止)。 */
  async listSessions(): Promise<DrsCorpusHead[]> {
    const heads: DrsCorpusHead[] = []
    let offset = 0
    for (;;) {
      const page = await this.getJson(`?op=sessions&offset=${String(offset)}&limit=${String(DRS_CORPUS_PAGE)}`)
      const rows = Array.isArray(page['rows']) ? page['rows'] as Record<string, unknown>[] : []
      for (const row of rows) {
        const head = DrsCorpusSource.headOf(row, '')
        if (head.sessionId !== '') heads.push(head)
      }
      offset += rows.length
      const total = Number(page['total'] ?? heads.length)
      if (rows.length === 0 || offset >= total) break
    }
    return heads
  }

  /** 一个会话的检索臂 docs；DRS 无此会话（session:null）返回 undefined。 */
  async readSession(sessionId: string): Promise<DrsCorpusSession | undefined> {
    const body = await this.getJson(`?op=session&session=${encodeURIComponent(sessionId)}&fields=search`)
    if (body['session'] === null || body['session'] === undefined) return undefined
    const head = DrsCorpusSource.headOf(body['session'] as Record<string, unknown>, sessionId)
    const docs = (Array.isArray(body['rows']) ? body['rows'] as Record<string, unknown>[] : []).map(row => ({
      seq: Number(row['seq'] ?? 0),
      type: String(row['kind'] ?? ''),
      surface: Number(row['on_surface'] ?? 1) === 1 ? 'current' as const : 'shadowed' as const,
      time: Number(row['time'] ?? 0),
      text: String(row['search_text'] ?? ''),
    }))
    return { head, docs }
  }

  /**
   * 分组内容搜索直连臂（op=search&group=session，DRS surface.searchGrouped 同构）：
   * 会话分组/加权/过滤/锚定节选全部在 DRS 侧完成，本方法只搬 wire →
   * 引擎命中形状（SwitchSearchHit 字段同名）。失败（网络/非 2xx/包络）直抛，
   * 调用侧按硬依赖语义显式报错——**不回退本地索引**。
   */
  async searchGrouped(request: {
    query: string
    /** 原事件 type 列表（调用方展开粗类）；空=DRS 缺省 user+assistant。 */
    kinds?: readonly string[]
    archived?: 'active' | 'archived' | 'all'
    from?: number
    to?: number
    sortBy?: 'relevance' | 'time'
    limit?: number
    /** 命中展开（wire `expand=1`）：同会话多命中各自成行；缺省聚合。 */
    expand?: boolean
    /** 同源 Host 覆盖（转发调用方请求头；优先于装配 baseUrl）。 */
    atHost?: string
  }): Promise<{
    sessionId: string
    title: string
    seq: number
    type: string
    time: number
    updatedAt: number
    snippet: string
  }[]> {
    const params = new URLSearchParams()
    params.set('op', 'search')
    params.set('group', 'session')
    params.set('q', request.query)
    if (request.kinds !== undefined && request.kinds.length > 0) params.set('kinds', request.kinds.join(','))
    if (request.archived !== undefined) params.set('archived', request.archived)
    if (request.from !== undefined) params.set('from', String(request.from))
    if (request.to !== undefined) params.set('to', String(request.to))
    if (request.sortBy === 'time') params.set('sort', 'time')
    if (request.limit !== undefined) params.set('limit', String(request.limit))
    if (request.expand === true) params.set('expand', '1')
    const body = await this.getJson(`?${params.toString()}`, request.atHost)
    const hits = Array.isArray(body['hits']) ? body['hits'] as Record<string, unknown>[] : []
    return hits.map(row => ({
      sessionId: String(row['session_id'] ?? ''),
      title: String(row['title'] ?? ''),
      seq: Number(row['seq'] ?? 0),
      type: String(row['type'] ?? ''),
      time: Number(row['time'] ?? 0),
      updatedAt: Number(row['updated_at'] ?? 0),
      snippet: String(row['snippet'] ?? ''),
    }))
  }

  /**
   * 触发 DRS 后台同步（`POST ?op=sync`）：慢速全扫，用于修复投影库自身的滞后。
   * **op 走 query**：DRS 的 POST 分发只读 `url.searchParams.get('op')`，落进 body 会
   * 400 `unknown POST op: (missing)`；body 仍为 `{op:'sync'}` 兼容早期只读体版本。
   * 与 op=status 的 `syncing`（新）/ `last_sync.busy`（旧）配合轮询。
   * @param atHost - 同源 Host 覆盖。
   */
  async triggerSync(atHost?: string): Promise<{ ok: boolean; error?: string }> {
    const source = atHost !== undefined && atHost !== '' ? `http://${atHost}` : this.options.baseUrl
    const url = `${source.replace(/\/+$/u, '')}${DRS_API_PATH}?op=sync`
    let response: Awaited<ReturnType<typeof this.fetchImpl>>
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(this.options.hostHeader === undefined ? {} : { host: this.options.hostHeader }),
        },
        body: JSON.stringify({ op: 'sync' }),
      })
    } catch (err) {
      return { ok: false, error: String(err instanceof Error ? err.message : err) }
    }
    if (!response.ok) return { ok: false, error: `HTTP ${String(response.status)}` }
    try {
      const body = await response.json() as Record<string, unknown>
      return body['ok'] === true ? { ok: true } : { ok: false, error: String(body['error'] ?? 'ok=false') }
    } catch {
      return { ok: true }
    }
  }

  /** DRS 状态明细（op=status 原始体；失败返回 undefined）。 */
  async statusDetail(atHost?: string): Promise<Record<string, unknown> | undefined> {
    try {
      return await this.getJson('?op=status', atHost)
    } catch {
      return undefined
    }
  }
  /** 可性探针（op=status）：硬依赖预检/降级提示用；失败返回 false。 */
  async probe(atHost?: string): Promise<boolean> {
    try {
      await this.getJson('?op=status', atHost)
      return true
    } catch {
      return false
    }
  }
}
