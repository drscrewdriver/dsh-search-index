/**
 * 命中定位臂（B 路线 v3，T7.4）：内容搜索点击打开会话后，把宿主会话视图 DOM
 * 里对应的那一行滚进视口并瞬时高亮。
 *
 * 前提实证（0.2.1 宿主前端包扫描）：会话列表**无虚拟化**（无 virtuoso/
 * react-window 指纹，IntersectionObserver 仅做 sticky 标题与入视口激活），
 * 打开会话后历史行全量在 DOM。宿主导航接口面无消息锚点
 * （uiWorkspace.openSession(SessionTarget) 全签名），DOM 文本匹配是唯一通路；
 * 一切失败静默退化为「仅打开」（绝不抛、绝不遮主流程）。
 *
 * v2 教训（真机「还停在底部」）：一次性 scrollIntoView 会被宿主会话打开后
 * 的贴底/滚动恢复覆盖——v3 改「巡逻-驻留」模型：每 TICK 重定位+补滚，
 * 目标行稳定驻留视口 STICK_MS 后才打高亮；用户手动滚动立即让位。
 *
 * v4 根因修正（宿主接口面实锤）：dsh-client-ui-conversation 的 IConversation
 * 暴露 loadOlder()（"Pull one older history page"）——历史是**分页**的，
 * 首轮视口外找不到的真实原因是目标行根本没挂载。巡逻循环每 N tick 调
 * 一次 loadOlder 往回翻页，直到目标 turn 的行进入 DOM 再驻留跳转；
 * 翻页能力经 configureLocator 由 client apply 注入（本模块不持 ctx）。
 *
 * 数据面：同源 GET /api/dsh-reference-session-collector?op=session&session=<id>
 * ——行含 seq/text/search_text/surface_text/on_surface/compressed：
 * - on_surface=0（被替换原文行）：GUI 不渲染该文本 → 放弃定位（不是失败）；
 * - compressed=1：GUI 渲染的是链解析后的 surface_text（替身文本）；
 * - 其余行优先 search_text（已剥宿主注入样板段=用户可见文本），退化 text。
 */
import type { HostContentHit } from './host-api.ts'

/** DRS fenced 路由（同源相对路径，与 dsh-reference-session-collector DRS_API_PATH 字面一致）。 */
const DRS_ROUTE = '/api/dsh-reference-session-collector'

/** 定位总超时（打开会话后 DOM 渲染窗口）。 */
const LOCATE_TIMEOUT_MS = 8_000

/** 高亮驻留时长后自动摘除。 */
const FLASH_MS = 6_000

/** needle 下限——短于此值的行（"好的"）歧义面太大，不值得定位。 */
const MIN_NEEDLE_CHARS = 12

/** needle 上限——取前缀足够唯一，过长整串匹配反而更易被渲染差异打断。 */
const MAX_NEEDLE_CHARS = 80

/** 驻留确认窗口：目标行在视口内稳定停留这么久才算跳转成功。 */
const STICK_MS = 900

/** 翻页上限：24 页 × 宿主页宽足够任何真机会话；防无限拉页。 */
const MAX_OLDER_PAGES = 24

/** 硬封顶：带翻页的定位窗口上限。 */
const HARD_DEADLINE_MS = 30_000

/** 热/冷分界：消息轨（tidy-display RailView）只索引最新往回这么多回合。 */
export const RAIL_INDEX_TURNS = 40

/** 安全回溯护栏：超出这么多回合不自动翻页（过冷），仅打开会话。 */
export const MAX_BACKTRACK_TURNS = 200

/** 深加载硬封顶（冷数据确认后的定位窗口上限）。 */
const DEEP_HARD_DEADLINE_MS = 60_000

/** 深加载页数上限（页宽无法静态得知时的安全上界；命中即停，实际很少跑满）。
 * 导出供 panel 失败重试推导追加预算后的硬顶。 */
export const DEEP_MAX_PAGES = 40

/** 巡逻间隔：会话重渲染会换 DOM 节点，每轮重新定位。 */
const TICK_MS = 350

/** 定位行在视口内的判定余量（顶部允许略出屏，代码块开头行高度不定）。 */
const VISIBILITY_SLACK = 40

/** 归一化/取 needle 用的一个 DRS 段行（wire 蛇形，只声明消费字段）。 */
export interface LocateRowFace {
  seq: number
  /** 行归属 turn（阅读模式 [data-reader-turn] 直接寻址键）。 */
  turn?: number
  text?: string
  search_text?: string
  on_surface?: number
  compressed?: number
  surface_text?: string | null
}

/** markdown 结构符与空白——DOM 渲染后不含这些，两侧同抹才能对上。 */
const MATCH_NOISE_RE = /[\s`*_~#>|[\]()!，。：；、"'\\{}-]+/gu

/** 归一化比对文本：去空白与 markdown 噪声字符。 */
export function normalizeForMatch(text: string): string {
  return text.replace(MATCH_NOISE_RE, '')
}

/**
 * 从段行选一条可定位 needle（按纯函数导出，供单测）。
 * @returns 归一化 needle；null=该行不可定位（被替换原文/无有效文本/过短歧义）。
 */
export function resolveNeedle(row: LocateRowFace | undefined): string | null {
  if (row === undefined) return null
  if (Number(row.on_surface ?? 1) === 0) return null
  const sources: (string | null | undefined)[] = Number(row.compressed ?? 0) === 1
    ? [row.surface_text, row.search_text, row.text]
    : [row.search_text, row.text]
  for (const source of sources) {
    if (typeof source !== 'string' || source === '') continue
    // 行首段优先：渲染可能截断长行/拆段，首行完整命中概率最高。
    const firstLine = source.split('\n').find(line => line.trim() !== '') ?? source
    const needle = normalizeForMatch(firstLine).slice(0, MAX_NEEDLE_CHARS)
    if (needle.length >= MIN_NEEDLE_CHARS) return needle
    // 首行太短（"好的"）时退整段拼接再试一次，仍短则换下一来源。
    const whole = normalizeForMatch(source).slice(0, MAX_NEEDLE_CHARS)
    if (whole.length >= MIN_NEEDLE_CHARS) return whole
  }
  return null
}

/** 命中的可达性档位。 */
export type HitClass = 'hot' | 'cold' | 'too-cold' | 'unknown'

/**
 * 按 turn_gap 分档：≤40 热（直接跳）、41..200 冷（确认+深加载）、>200 过冷
 * （不自动回溯）、undefined 未知（富化失败/老库，按热处理）。
 */
export function classifyHit(hit: { turnGap?: number }): HitClass {
  const g = hit.turnGap
  if (typeof g !== 'number' || !Number.isFinite(g)) return 'unknown'
  if (g <= RAIL_INDEX_TURNS) return 'hot'
  if (g > MAX_BACKTRACK_TURNS) return 'too-cold'
  return 'cold'
}

/** 正文候选标签：只取消息渲染会用的块级/内联代码标签——不含 div/span，
 * 否则搜索面板自己的结果行（dsws_snippet 的 span，文本就含 needle 前缀）会抢先命中。 */
const MESSAGE_TAGS = 'p, li, pre, blockquote, h1, h2, h3, h4, td, code'

/** 阅读线偏移（dsh-tidy-display conversation-scroll.ts READING_LINE_OFFSET_PX 同值）。 */
const READING_LINE_OFFSET_PX = 24

/** 有布局才叫可见：未挂载页签（display:none）的 rect 全 0，旧视口判定会误判驻留。 */
function hasLayout(el: Element): boolean {
  return (el as HTMLElement).offsetHeight > 0 || (el as HTMLElement).offsetWidth > 0
}

/** 祖先滚动盒（tidy-display 官方选择子）；缺席时退化窗口滚动。 */
function scrollerOf(el: Element): HTMLElement | null {
  return el.closest('[data-conversation-scroll]')
}

/** 在滚动窗口坐标系里把行着陆到顶部偏读线位——**绝不 scrollIntoView**
 * （dsh-tidy-display 实锤：它会爬祖先 scroller 把 sticky composer 抬离底部，
 * 随后宿主回贴 = 「还停在底部」）；与阅读模式 landTurn 同款 scrollTop 数学。 */
function landRow(el: Element, offsetPx = READING_LINE_OFFSET_PX): void {
  const html = el as HTMLElement
  const port = scrollerOf(html) ?? (el.ownerDocument.scrollingElement as HTMLElement | null) ?? html
  if (port === html) {
    html.scrollIntoView({ block: 'start', behavior: 'auto' })
    return
  }
  port.scrollTop += html.getBoundingClientRect().top - port.getBoundingClientRect().top - offsetPx
}

/** 行在**其滚动窗口**内是否已就位（驻留判定也用窗口系，不用视口系）。 */
function landedInPort(el: Element): boolean {
  const html = el as HTMLElement
  if (!hasLayout(html)) return false
  const port = scrollerOf(html)
  if (port === null) {
    const rect = html.getBoundingClientRect()
    const vh = html.ownerDocument.defaultView?.innerHeight ?? 0
    return rect.top >= -VISIBILITY_SLACK && rect.bottom <= vh + VISIBILITY_SLACK
  }
  const flow = html.getBoundingClientRect().top - port.getBoundingClientRect().top
  return flow >= -VISIBILITY_SLACK && flow <= port.clientHeight + VISIBILITY_SLACK
}

/**
 * 找正文行：以宿主官方消息轨锚点 `[data-chat-anchor-key]` 为主——0.1.2+ 原生会话行
 * 都带此属性（tidy-display 的 RailView 也正是镜像它），其 textContent 含整轮正文，
 * needle 命中即取该锚点；多义时取最深者。官方锚点缺席（老宿主）才回退块级正文标签
 * 文本匹配。两条路都不依赖 tidy-display 的 [data-reader-turn]，也不按哈希类名匹配。
 * 回退路径额外排除插件自家子树（dsws_ / role=dialog），绝不停到面板自己身上。
 */
function findMessageElement(root: ParentNode, needle: string): Element | null {
  const deepestMatch = (nodes: Element[], excludePanel: boolean): Element | null => {
    let best: Element | null = null
    let bestDepth = -1
    for (const el of nodes) {
      if (!hasLayout(el)) continue // 未激活页签里的隐藏行不参与（防驻留误判/跳错页签）
      const text = el.textContent
      if (text === null) continue
      if (excludePanel && el.closest('[class*="dsws_"], [role="dialog"]') !== null) continue
      if (!normalizeForMatch(text).includes(needle)) continue
      let depth = 0
      for (let n: Node | null = el.parentElement; n !== null; n = n.parentElement) depth += 1
      if (depth > bestDepth) { best = el; bestDepth = depth }
    }
    return best
  }
  // 官方消息轨锚点优先：宿主原生属性，跨构建稳定。
  const byAnchor = deepestMatch(Array.from(root.querySelectorAll('[data-chat-anchor-key]')), false)
  if (byAnchor !== null) return byAnchor
  // 老宿主无 data-chat-anchor-key → 回退块级正文标签文本匹配。
  return deepestMatch(Array.from(root.querySelectorAll(MESSAGE_TAGS)), true)
}

/** 瞬时高亮：类切换（不写 inline 样式——真机教训：prepend 历史后 React 复用
 * 节点，定时器迟到把旧样式写在不相干元素上）。首次使用时惰性注入样式表。 */
const FLASH_CLASS = 'dss-located-flash'
let flashCssReady = false

function ensureFlashCss(doc: Document): void {
  if (flashCssReady) return
  flashCssReady = true
  const style = doc.createElement('style')
  style.textContent = `.${FLASH_CLASS}{outline:2px solid var(--dsw-alias-accent,#4a9eff);outline-offset:2px;transition:outline 120ms ease}`
  doc.head.appendChild(style)
}

function flashElement(el: Element): void {
  if (el.ownerDocument !== null) ensureFlashCss(el.ownerDocument)
  el.setAttribute('data-dss-located', '1')
  el.classList.add(FLASH_CLASS)
  setTimeout(() => {
    el.classList.remove(FLASH_CLASS)
    el.removeAttribute('data-dss-located')
  }, FLASH_MS)
}

/** 定位执行面（测试可注入假环境；缺省走真浏览器）。 */
export interface LocateEnv {
  fetchImpl?: typeof fetch
  doc?: Document
  win?: Window
  timeoutMs?: number
  log?: (message: string) => void
  /** 覆盖注入的翻页供给（测试用）；缺省走 configureLocator 的全局注入。 */
  loadOlder?: () => Promise<boolean>
  /** 深加载模式：冷数据确认后由 panel 置 true，放宽封顶并测页宽收紧预算。 */
  deep?: boolean
  /** 显式页数预算（测试用）；缺省由 deep 标志与运行时页宽推导。 */
  pageBudget?: number
  /** 翻页进度回调（已翻页数, 当前预算）。 */
  onProgress?: (pulled: number, budget: number) => void
  /** 取消令牌：外部置 cancelled=true 时巡逻立即收手。 */
  cancel?: { cancelled: boolean }
  /** 强制着陆：跳过 STICK 驻留窗判定（HUD「跳转」按钮二次调用用——目标已在 DOM，
   * 但要立即补滚+高亮，不等驻留期满）。 */
  forceLand?: boolean
}

/** 外部能力注入面：client apply 期接线宿主会话服务，模块自身零 ctx 依赖。 */
export interface LocatorDeps {
  /** 拉一页更早历史；true=已发起（行数可能增），false=服务缺席/报错。 */
  loadOlder?: () => Promise<boolean>
}

let injectedDeps: LocatorDeps = {}

/** 接线点：client apply 调一次；未接线时定位退化为 v3 纯 DOM 巡逻。 */
export function configureLocator(deps: LocatorDeps): void {
  injectedDeps = deps
}

/** 已加载回合数（官方消息轨锚点 [data-chat-anchor-key] 计数，不依赖 tidy-display）。 */
function countLoadedTurns(root: ParentNode): number {
  try {
    return root.querySelectorAll('[data-chat-anchor-key]').length
  } catch {
    return 0
  }
}

/**
 * 点击豁免探测：拉 DRS 行→选 needle→单次 findMessageElement 判目标行是否已在 DOM。
 * 不滚动、不翻页；命中=true（用户已翻到过，算激活，可直接跳）。任何异常返回 false。
 */
export async function probeHitInDom(hit: HostContentHit, env: LocateEnv = {}): Promise<boolean> {
  const fetchImpl = env.fetchImpl ?? globalThis.fetch
  const doc = env.doc ?? (typeof document === 'undefined' ? undefined : document)
  if (doc === undefined) return false
  try {
    const response = await fetchImpl(`${DRS_ROUTE}?op=session&session=${encodeURIComponent(hit.sessionId)}`)
    if (!response.ok) return false
    const body = await response.json() as { ok?: boolean; rows?: LocateRowFace[] }
    if (body.ok !== true || !Array.isArray(body.rows)) return false
    const row = body.rows.find(r => Number(r.seq) === Number(hit.seq))
    const needle = resolveNeedle(row)
    if (needle === null) return false
    return findMessageElement(doc.body ?? doc, needle) !== null
  } catch {
    return false
  }
}

/** 目标行是否基本完整落在**其滚动窗口**内由 landedInPort 判定；旧视口函数已废弃。 */

/**
 * 主管线：拉 DRS 段行 → 选 needle → 巡逻宿主 DOM 补滚 → 驻留后高亮。
 * fire-and-forget 语义：任何一步不满足都 resolve(false)，从不抛。
 */
export async function locateSearchHit(hit: HostContentHit, env: LocateEnv = {}): Promise<boolean> {
  const fetchImpl = env.fetchImpl ?? globalThis.fetch
  const doc = env.doc ?? (typeof document === 'undefined' ? undefined : document)
  if (doc === undefined) return false
  const win = env.win ?? doc.defaultView ?? (typeof window === 'undefined' ? undefined : window)
  if (win === undefined) return false
  const log = env.log ?? ((message: string): void => { console.debug(`[dsh-session-steward] ${message}`) })
  try {
    const response = await fetchImpl(`${DRS_ROUTE}?op=session&session=${encodeURIComponent(hit.sessionId)}`)
    if (!response.ok) { log(`locate: drs http ${String(response.status)}`); return false }
    const body = await response.json() as { ok?: boolean; rows?: LocateRowFace[] }
    if (body.ok !== true || !Array.isArray(body.rows)) { log('locate: drs envelope shape'); return false }
    const row = body.rows.find(r => Number(r.seq) === Number(hit.seq))
    const needle = resolveNeedle(row)
    if (needle === null) { log(`locate: skip row seq=${String(hit.seq)} (shadowed/短文本/无行)`); return false }

    const startedAt = Date.now()
    const deep = env.deep === true
    // 页数预算：显式覆盖 > 深加载 DEEP_MAX_PAGES > 普通 MAX_OLDER_PAGES；
    // 首次翻页测到真实页宽 P 后按 turn_gap 收紧（命中即停，预算只是 never-found 上界）。
    let budget = env.pageBudget ?? (deep ? DEEP_MAX_PAGES : MAX_OLDER_PAGES)
    let deadline = startedAt + (env.timeoutMs ?? LOCATE_TIMEOUT_MS)
    const hardDeadline = startedAt + (deep ? DEEP_HARD_DEADLINE_MS : HARD_DEADLINE_MS)
    let lastScrollAt = 0
    let userTookOver = false
    // 翻页供给：client apply 注入（IConversation.loadOlder 包装），env 可覆盖供测试。
    const pullOlder = env.loadOlder ?? injectedDeps.loadOlder
    let pagesPulled = 0
    let pullInFlight = false
    let lastPullAt = 0
    // 运行时测页宽：首次翻页前后各测一次已加载回合数，delta=真实页宽 P。
    let turnsBeforePull: number | undefined
    let pageSizeMeasured = false
    // pointerdown 必收：真机教训——巡逻窗口内用户点「加载更早记录」等页内按钮，
    // 不收手则我们的补滚与宿主 prepend 后的滚动锚定对打，画面错乱。
    const USER_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    const onUser = (): void => { userTookOver = true }

    return await new Promise<boolean>((resolve) => {
      const finish = (ok: boolean, why: string): void => {
        clearInterval(ticker)
        for (const ev of USER_EVENTS) win.removeEventListener(ev, onUser)
        log(`${why}: seq=${String(hit.seq)} ${hit.sessionId.slice(0, 12)} +${String(Date.now() - startedAt)}ms`)
        resolve(ok)
      }
      for (const ev of USER_EVENTS) win.addEventListener(ev, onUser, { passive: true, once: true })
      const ticker = setInterval(() => {
        if (env.cancel?.cancelled === true) { finish(false, 'cancelled'); return }
        if (userTookOver) { finish(false, 'yield user'); return }
        if (Date.now() >= deadline) { finish(false, `locate timeout (pages=${String(pagesPulled)})`); return }
        const el = findMessageElement(doc.body ?? doc, needle)
        if (el === null) {
          // 目标行不在 DOM：历史分页面（IConversation.loadOlder）——没找到就
          // 往回拉页，每拉一页给 2s 渲染窗口；拉满/拉尽则维持原超时。
          if (pullOlder !== undefined && !pullInFlight && pagesPulled < budget
            && deadline < hardDeadline && Date.now() - lastPullAt >= TICK_MS * 2) {
            pullInFlight = true
            lastPullAt = Date.now()
            if (turnsBeforePull === undefined) turnsBeforePull = countLoadedTurns(doc)
            void Promise.resolve().then(() => pullOlder()).then((pulled) => {
              if (pulled) {
                pagesPulled += 1
                env.onProgress?.(pagesPulled, budget)
                // 首次成功翻页后测页宽 P，按 turn_gap 收紧预算（绝不超过初始上限）。
                // 显式 pageBudget（失败重试的追加预算）豁免收紧——那是调用方
                // 刻意给出的上界，压回去会让重试形同虚设。
                if (!pageSizeMeasured && env.pageBudget === undefined
                  && typeof hit.turnGap === 'number' && hit.turnGap > 0
                  && turnsBeforePull !== undefined) {
                  pageSizeMeasured = true
                  const delta = countLoadedTurns(doc) - turnsBeforePull
                  if (delta > 0) budget = Math.min(budget, Math.ceil(hit.turnGap / delta) + 1)
                }
                deadline = Math.min(hardDeadline, Date.now() + 2_000 + (env.timeoutMs ?? LOCATE_TIMEOUT_MS) / 2)
              } else {
                deadline = Math.min(deadline, Date.now()) // 服务缺席：不再等待
              }
            }).catch(() => {}).finally(() => { pullInFlight = false })
          }
          return // DOM 未就绪/会话还在切换：下一轮再找
        }
        if (landedInPort(el)) {
          // 从未滚过且本来就可见（同会话当前视口）=直达；否则须驻留过 STICK 窗。
          // forceLand（HUD 跳转按钮）豁免驻留窗——用户主动要求立刻落位。
          if (env.forceLand === true || lastScrollAt === 0 || Date.now() - lastScrollAt >= STICK_MS) {
            landRow(el)
            flashElement(el)
            finish(true, 'located')
          }
          return
        }
        // 目标不在滚动窗口内：若距上次补滚超一个 tick，重新着陆（landRow 只写
        // scroller.scrollTop，绝不 scrollIntoView——后者会抬走 sticky composer
        // 并触发宿主回贴底部，tidy-display 实锤）。会话重渲染换节点也走这条。
        if (Date.now() - lastScrollAt >= TICK_MS) {
          landRow(el)
          lastScrollAt = Date.now()
        }
      }, TICK_MS)
    })
  } catch (err) {
    log(`locate error(silent): ${String(err instanceof Error ? err.message : err)}`)
    return false
  }
}
