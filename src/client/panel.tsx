/**
 * 搜索子域 client 组件（原 dsh-search-index client 半身的面板部分）。
 *
 * 注册职责（侧栏入口 / 家族 tab / 插件页配置卡）在合并包的 client/index.ts；
 * 本文件只持有：样式表、悬浮搜索面板（标题/内容双模式）、侧栏 footer 按钮、
 * 唤出和弦绑定。
 *
 * The `locale` and config services are consumed structurally: when
 * the host release lacks them the footer falls back to the bundled zh
 * dictionary and the host-composition config layer.
 */
import { createElement, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { SwitchSearchConfig } from '../config.ts'
// 0.1.7：插件族共用设置节（dsh-thinking-levels 持有并声明 `dsh-family.tab`
// 子席位；本仓不依赖 ui-slots 类型包，席位键以运行时 children 表为准）。
import { locateSearchHit } from './locate.ts'
import { callHost, callHostAny, callSteward, deepSyncIndex, type HostContentHit, type HostIndexStatus, type HostSessionItem, type HostSortMode, type SwitchSessionsService, type SwitchUiWorkspaceService } from './host-api.ts'
import type { SwitchCardScope } from './card.tsx'
import { translate, type LocaleKey } from './locales.ts'
import { LABELS, isInvokeChord } from './platform.ts'

/** ------------------------------------------------------------------ types */

/** The client slots service face (structural subset used here). */
interface SwitchSlotsService {
  inject(key: string, callback: () => () => void, label?: string): () => void
  register(options: {
    name: string
    id?: string
    key?: string
    order?: number
    store?: unknown
    locale?: string
    label?: string | (() => string)
    inject?: (actions: unknown) => unknown
  }, component: unknown): () => void
}

/**
 * The client sessions service face: open a session from a search result.
 * Defined in `host-api.ts` (shared with `openSessionThrough`); re-imported as
 * a type here for the cordis Context augmentation below.
 */

/** The client settings-scope service face (structural subset). */
interface SwitchSettingsScope<C> {
  bind(spec: { namespace: string }): SwitchScopeLike<C>
}
/** configForms 服务面（0.1.7：以 profile entry id 取句柄）。 */
interface SwitchConfigForms<T> {
  get(entryId: string): SwitchScopeLike<T>
}
interface SwitchScopeLike<T> {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable'
    value: T | undefined
    revision: number | undefined
    writable: boolean
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/**
 * The client locale service face (structural mirror; the plugin must not
 * value- or type-import a single release of the official locale package).
 */
interface SwitchLocaleService {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
  register(ns: string, localeId: string, dicts: Record<string, string>): () => void
  /**
   * Read-time translator bound to a namespace (host `dsh-client-locale`).
   * Needed for slot `label` thunks, which the owner re-reads per render so the
   * tab text follows locale switches without re-registration. Optional: older
   * hosts may expose `register` only, hence the guarded call site.
   */
  bind?(ns: string): (key: string, params?: Record<string, unknown>) => string
}

/** The locale dictionary face the renderer may hand the card as `t`. */
type CardLocale = (key: LocaleKey, params?: Record<string, unknown>) => string

/** Coarse content-type filter carried to the host content-search. */
type ContentType = 'all' | 'user' | 'reply' | 'tool'

/** 检索域（R1：归档正文入索引后的 chip 维度）。 */
type ArchivedDomain = 'all' | 'active' | 'archived'

/** 面板模式：标题 / 内容（管理台归管家面板,见 search/manage.tsx）。 */
type PanelMode = 'title' | 'content'

/** The coarse filter chips rendered above content results. */
const CONTENT_TYPE_CHIPS: readonly { id: ContentType; labelKey: LocaleKey }[] = [
  { id: 'all', labelKey: 'filter.all' },
  { id: 'user', labelKey: 'filter.user' },
  { id: 'reply', labelKey: 'filter.reply' },
  { id: 'tool', labelKey: 'filter.tool' },
]

/** 检索域 chips（标题/内容两模式共用）。 */
const ARCHIVED_CHIPS: readonly { id: ArchivedDomain; labelKey: LocaleKey }[] = [
  { id: 'all', labelKey: 'domain.all' },
  { id: 'active', labelKey: 'domain.active' },
  { id: 'archived', labelKey: 'domain.archived' },
]

/** Result-ordering chips rendered at the right of the same filter row. */
const SORT_CHIPS: readonly { id: HostSortMode; labelKey: LocaleKey }[] = [
  { id: 'relevance', labelKey: 'sort.relevance' },
  { id: 'time', labelKey: 'sort.time' },
]

/** 命中粒度：merge=会话分组取最强（既有行为），expand=同会话多命中分行显示。 */
type GroupMode = 'merge' | 'expand'

/** 命中粒度 chips（仅内容模式）。 */
const GROUP_CHIPS: readonly { id: GroupMode; labelKey: LocaleKey }[] = [
  { id: 'merge', labelKey: 'group.merge' },
  { id: 'expand', labelKey: 'group.expand' },
]

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
 * @param archivedFilter - the retrieval-domain chip (all/active/archived).
 * @returns an opaque key, stable for equal inputs.
 */
function contentRequestKey(normalized: string, contentType: ContentType, sortBy: HostSortMode, archivedFilter: ArchivedDomain, dateRange: { from: string; to: string }, groupMode: GroupMode): string {
  return `${normalized}\u0000${contentType}\u0000${sortBy}\u0000${archivedFilter}\u0000${dateRange.from}\u0000${dateRange.to}\u0000${groupMode}`
}

/**
 * Persisted ordering preference. Unlike `lastPanelMode` this one survives a
 * page reload — an ordering is a durable preference, not a session mood.
 */
const SORT_STORE_KEY = 'dsh-search-index.sortBy'

/** Read the persisted ordering; private mode or a bad value degrades to relevance. */
function readStoredSort(): HostSortMode {
  try {
    return window.localStorage.getItem(SORT_STORE_KEY) === 'time' ? 'time' : 'relevance'
  } catch {
    return 'relevance'
  }
}

/** Persist the ordering; a storage failure still leaves this session working. */
function writeStoredSort(next: HostSortMode): void {
  try {
    window.localStorage.setItem(SORT_STORE_KEY, next)
  } catch {
    // ignore: the choice applies for the rest of this session regardless
  }
}

/** 命中粒度持久化（与排序同款：耐久偏好，不是会话情绪）。 */
const GROUP_STORE_KEY = 'dsh-search-index.groupMode'

function readStoredGroup(): GroupMode {
  try {
    return window.localStorage.getItem(GROUP_STORE_KEY) === 'expand' ? 'expand' : 'merge'
  } catch {
    return 'merge'
  }
}

function writeStoredGroup(next: GroupMode): void {
  try {
    window.localStorage.setItem(GROUP_STORE_KEY, next)
  } catch {
    // ignore: the choice applies for the rest of this session regardless
  }
}

/**
 * Local re-sort so the page honours the chosen ordering even against an older
 * host half that ignores `sortBy` and therefore omits `updatedAt` entirely —
 * in that case the host order is left untouched rather than scrambled to NaN.
 */
function sortHits(items: readonly HostContentHit[], sortBy: HostSortMode): HostContentHit[] {
  if (sortBy !== 'time') return [...items]
  if (!items.every(item => typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt))) return [...items]
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** The footer-action owner share (structural subset). */
interface SwitchFooterProps {
  wide: boolean
}

/** Last panel mode used this web session (mode memory, not persisted). */
let lastPanelMode: PanelMode = 'title'

declare module 'cordis' {
  interface Context {
    slots: SwitchSlotsService
    sessions?: SwitchSessionsService
    uiWorkspace?: SwitchUiWorkspaceService
    settingsScope?: SwitchSettingsScope<SwitchSearchConfig>
    locale?: SwitchLocaleService
  }
}

/** ------------------------------------------------------------------ styles */

const CSS = `
/* 侧栏 footer 槽位公约（2026-09-26；2026-10-01 收紧行距并强制居中）：一行多
   入口（第三方 dsh-context 等）会互相挤占 —— 宿主 .footerActions 是 nowrap
   flex 行。这里允许容器换行，并把本插件入口钉成独占一整行（flex-basis:100%）；
   其余入口（含第三方）自然落到后续行。justify-content:center 让行内所有入口
   （含不占满行的）统一居中；row-gap:0 配合入口自身 32px 高度压缩纵向占位。
   类名用 [class*=] 中段匹配：宿主是 CSS Module 哈希类名（实测形如
   hHd-Xa_footerActions —— <hash>_<name>，哈希在前），中段跨版本稳定。 */
[class*="footerActions"]{flex-wrap:wrap;justify-content:center;row-gap:0;height:auto;min-height:0}
/* —— 第三方矫正：dsh-context「上下文洞察」入口（2026-10-01）——
   .lc-ov-entry 按"独占整行"设计（width:calc(100% + 4px)、无 justify-content、
   42px 高、不对称 padding），与本槽位公约（每个入口独占一行、行内居中、32px）
   冲突，表现为文字靠左、纵向松散。这里按公约强制矫正；:not() 排除收起轨道的
   36px 圆钮形态。lc-ov-* 是 dsh-context 源码硬编码类名（非构建哈希），跨版本
   稳定（实测 0.56.1 / 0.60.0 规则一致）。 */
.lc-ov-entry:not(.lc-ov-entry-rail){width:auto!important;flex:0 0 100%!important;min-width:0!important;justify-content:center!important;height:32px!important;margin:0!important;padding:0 10px!important}
.lc-ov-entry-label{flex:0 1 auto!important}
.dsws_root{box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 100%;width:100%;min-width:0;container-type:inline-size}
/* 收起轨道：回落自然宽度（根类的 100% 基准只属于宽栏形态），放弃收缩。 */
.dsws_rootRail{flex:none;width:auto;container-type:normal}
/* 高度 32px（内容 22px 行高 + 上下各 5px）：宿主默认 42px 的上下裕度在
   多行堆叠后过于松散；左右内边距对称（10px/10px），否则整行居中时按钮内容
   会因不对称 padding 向左偏 1px。 */
.dsws_button{box-sizing:border-box;display:inline-flex;align-items:center;flex:0 0 auto;min-width:0;gap:8px;height:32px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
.dsws_buttonRail{flex:none;width:28px;height:28px;padding:0;gap:0;justify-content:center;border-radius:50%}
.dsws_button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_button svg{flex:none}
.dsws_trigger.dsws_triggerPage{position:relative;left:auto;top:auto;transform:none;z-index:auto;width:auto;max-width:none;height:100%;max-height:none;border:none;border-radius:0;box-shadow:none;background:transparent}
.dsws_trigger{position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);width:860px;max-width:calc(100vw - 32px);max-height:min(84vh,880px);box-sizing:border-box;background:var(--dsw-specific-tip);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 8px 28px rgba(0,0,0,.16));overflow:hidden;display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family)}
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
.dsws_rowLine{display:flex;align-items:stretch;gap:4px}
.dsws_rowLine>.dsws_row{flex:1 1 auto;width:auto;min-width:0}
.dsws_delBtn{flex:none;align-self:center;height:24px;box-sizing:border-box;border:1px solid var(--dsw-alias-state-error-primary);background:transparent;color:var(--dsw-alias-state-error-primary);border-radius:999px;padding:0 10px;font-size:12px;line-height:22px;cursor:pointer;white-space:nowrap}
.dsws_delBtn:hover{background:var(--dsw-alias-state-error-primary);color:#fff}
.dsws_delBtnArm{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:#fff;font-weight:600}
.dsws_delBtn:disabled{opacity:.5;cursor:default}
.dsws_rowTitle{display:flex;align-items:center;gap:8px;min-width:0}
.dsws_titleText{flex:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:18px}
.dsws_tag{flex:none;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsws_snippet{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.dsws_meta{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsws_status{color:var(--dsw-alias-label-tertiary);padding:10px 8px 8px;font-size:12px;line-height:18px}
.dsws_error{color:var(--dsw-alias-state-error-primary);padding:8px;font-size:12px;line-height:18px}
.dsws_empty{color:var(--dsw-alias-label-tertiary);padding:10px 8px 8px;font-size:12px;line-height:18px}
.dsws_backdrop{position:fixed;inset:0;z-index:2147482999;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.24));backdrop-filter:blur(var(--dsw-mask-blur,4px))}
.dsws_setRow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsws_setRow:last-child{border-bottom:none}
.dsws_setText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsws_setTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.dsws_setDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsws_seg{display:inline-flex;align-items:center;gap:2px;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px;flex:none}
.dsws_segBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 10px;font-size:12px;font-weight:500;line-height:20px}
.dsws_segBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_segBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_segBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_actBtn{height:26px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:0 10px;font-size:12px;line-height:24px;white-space:nowrap}
.dsws_actBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsws_actBtn:disabled{cursor:not-allowed;opacity:.5}
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
.dsws_kbd{flex:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:18px;width:auto;height:18px;padding:0 4px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
/*
 * The row shares its width with the session-steward entry (order 12), so at
 * narrow sidebar widths the shortcut chip, not the label, is what yields: the
 * chip is a hint repeated by the entry tooltip and the panel footer, while the
 * label is the entry's identity. Measured in Chrome: the pair needs 230px for
 * both labels plus the chip; below that the chip's 43px is what makes the
 * difference. The query is scoped to the wide form: container-type also
 * applies inline-size containment, which zeroes a flex:none rail root.
 */
@container (max-width: 132px){.dsws_kbd{display:none}}
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
`

/** Inject the plugin stylesheet once per activation (removed on disposal). */
export function injectStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.querySelector('style[data-plugin-css="dsw-session-search-toggle/styles"]') !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-search-index'
  tag.dataset.pluginCss = 'dsw-session-search-toggle/styles'
  tag.textContent = CSS
  document.head.appendChild(tag)
  return () => {
    if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
  }
}

/** ------------------------------------------------------------------ view */

/** The floating search panel. */
export function SwitchPanel({
  t,
  onClose,
  open,
  variant = 'dialog',
}: {
  t?: CardLocale
  onClose: () => void
  open: (sessionId: string) => void
  /** `dialog` = 遮罩上的浮动面板（017-）；`page` = 填满主栏的整页（017+）。 */
  variant?: 'dialog' | 'page'
}): ReactElement {
  // Mode memory: the panel reopens in the mode last used in this web session
  // (first open falls back to 'title'). Session-scoped on purpose — no
  // persistence, the settings card's defaultMode stays the durable preference.
  const [mode, setModeState] = useState<PanelMode>(lastPanelMode)
  const setMode = (next: PanelMode): void => {
    lastPanelMode = next
    setModeState(next)
  }
  const [query, setQuery] = useState('')
  const [contentType, setContentType] = useState<ContentType>('all')
  // 检索域 chip：标题/内容两模式共用（R1——归档正文已入索引）。
  const [archivedFilter, setArchivedFilter] = useState<ArchivedDomain>('all')
  // 日期范围（R6）:YYYY-MM-DD,空串 = 不限;结束日含当天（宿主半排他上界 +1d）。
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // 定位诊断徽标（T7.4 v3）：点过命中行的定位态 ⏳/✓/✗——「停在底部」不再靠猜。
  const [locateStatus, setLocateStatus] = useState<Record<string, 'pending' | 'ok' | 'fail'>>({})
  // 直接删除入口（功能①）：开关由 index-status 探针下发（管家
  // session-steward.directDelete，缺省关）；armed=待二次确认的会话 id。
  const [directDelete, setDirectDelete] = useState(false)
  const [armedDelete, setArmedDelete] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteNote, setDeleteNote] = useState<{ text: string; failed: boolean } | null>(null)
  const [sortBy, setSortByState] = useState<HostSortMode>(readStoredSort)
  const setSortBy = (next: HostSortMode): void => {
    writeStoredSort(next)
    setSortByState(next)
  }
  // 命中粒度（分开显示开关）：expand=同会话多命中各自成行（DRS expand=1 臂）。
  const [groupMode, setGroupModeState] = useState<GroupMode>(readStoredGroup)
  const setGroupMode = (next: GroupMode): void => {
    writeStoredGroup(next)
    setGroupModeState(next)
  }
  const [sessions, setSessions] = useState<HostSessionItem[] | null>(null)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [content, setContent] = useState<{ query: string; status: 'idle' | 'loading' | 'ready' | 'error'; items: HostContentHit[]; error?: string }>({
    query: '',
    status: 'idle',
    items: [],
  })
  // Independent-index availability probe + rebuild progress.
  const [searchStatus, setSearchStatus] = useState<{
    available: boolean | null
    reason?: string
    rebuilding: boolean
    done: number
    total: number
    count: number
    deepSync?: 'idle' | 'drs-syncing' | 'rebuilding' | 'done' | 'failed'
  }>({ available: null, rebuilding: false, done: 0, total: 0, count: 0 })
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  const normalized = query.trim().toLowerCase()

  // Probe the independent index status on open, and keep polling while a
  // rebuild ("整理") is in flight so the panel flips to ready on completion.
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const probe = (): void => {
      callHostAny<HostIndexStatus>('index-status', {}).then((res) => {
        if (cancelled) return
        if (!res.ok) {
          // Old host half without this route (browser refresh keeps the old
          // process): show an actionable state instead of a blank panel.
          setSearchStatus({ available: false, reason: 'unreachable', rebuilding: false, done: 0, total: 0, count: 0 })
          return
        }
        const status = res as HostIndexStatus
        const rebuilding = status.rebuild?.state === 'building' || status.rebuild?.state === 'swapping'
        setDirectDelete(status.directDelete === true)
        const deepState = status.deepSync?.state
        setSearchStatus({
          available: status.available ?? false,
          reason: status.reason,
          rebuilding,
          done: status.rebuild?.done ?? 0,
          total: status.rebuild?.total ?? 0,
          count: status.sync?.indexed ?? 0,
          deepSync: deepState,
        })
        // 深度同步（DRS 慢扫 → 本地重建）也在跑：继续轮询到它落定。
        if (rebuilding || deepState === 'drs-syncing' || deepState === 'rebuilding') timer = window.setTimeout(probe, 1500)
      })
    }
    probe()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [])

  const startIndexBuild = (): void => {
    setSearchStatus(prev => ({ ...prev, rebuilding: true }))
    void callHostAny<HostIndexStatus>('index-rebuild', {})
  }

/**
 * 深度同步：先让 DRS 慢速重扫修好自己的投影库，再把本地索引整理一遍。
 * 用于「有些命中定位不到 / 新会话迟迟搜不到」的自我修复。
 */
  const startDeepSync = (): void => {
    setSearchStatus(prev => ({ ...prev, deepSync: 'drs-syncing' }))
    void deepSyncIndex()
  }

  /**
   * 真删一个会话（功能①）：走管理端同款 session-history-purge 链路（内存
   * 全痕删除优先，宿主成功后落墓碑台账）；成功只把该会话从两侧结果面
   * 摸掉——不刷语料、不关面板（失败要能原地重试）。
   */
  const purgeSession = (sessionId: string): void => {
    setArmedDelete(null)
    setDeleteBusy(true)
    setDeleteNote(null)
    void callSteward<{ purged?: number }>('session-history-purge', { sessionIds: [sessionId] })
      .then((res) => {
        if (res.ok) {
          setSessions(prev => (prev === null ? prev : prev.filter(it => it.sessionId !== sessionId)))
          setContent(prev => ({ ...prev, items: prev.items.filter(it => it.sessionId !== sessionId) }))
          setDeleteNote({ text: translate(t, 'panel.delete.done', { n: res.purged ?? 1 }), failed: false })
        } else {
          setDeleteNote({ text: translate(t, 'panel.delete.failed', { error: res.error ?? '?' }), failed: true })
        }
      })
      .finally(() => { setDeleteBusy(false) })
  }

  /** 行内删除按钮（仅 directDelete 开启时参与渲染）：两步确认，第一击上弦。 */
  const deleteBtn = (sessionId: string): ReactElement => createElement('button', {
    key: 'del',
    type: 'button',
    className: `dsws_delBtn${armedDelete === sessionId ? ' dsws_delBtnArm' : ''}`,
    title: translate(t, 'panel.delete.hint'),
    disabled: deleteBusy,
    onClick: () => {
      if (armedDelete === sessionId) purgeSession(sessionId)
      else setArmedDelete(sessionId)
    },
  }, armedDelete === sessionId ? translate(t, 'panel.delete.confirm') : translate(t, 'panel.delete'))

  // Load the title-search corpus once on open.
  useEffect(() => {
    if (sessions !== null) return
    let cancelled = false
    callHost<HostSessionItem>('list-sessions', {}).then((res) => {
      if (cancelled) return
      if (res.ok) { setSessions(res.items); setSessionsError(null) }
      else setSessionsError(res.error ?? '读取会话列表失败')
    })
    return () => { cancelled = true }
  }, [sessions])

  // Content search debounces against the host route.
  useEffect(() => {
    if (mode !== 'content' || normalized === '') {
      if (mode !== 'content') setContent({ query: normalized, status: 'idle', items: [] })
      return
    }
    let cancelled = false
    const requestType: ContentType = contentType
    const requestKey = contentRequestKey(normalized, requestType, sortBy, archivedFilter, { from: dateFrom, to: dateTo }, groupMode)
    setContent(prev => ({ query: requestKey, status: 'loading', items: prev.query === requestKey ? prev.items : [] }))
    const timer = window.setTimeout(() => {
      callHost<HostContentHit>('content-search', {
        query: normalized,
        limit: 50,
        types: requestType === 'all' ? undefined : [requestType],
        sortBy,
        archived: archivedFilter,
        expand: groupMode === 'expand' || undefined,
        from: dateFrom === '' ? undefined : dateFrom,
        to: dateTo === '' ? undefined : dateTo,
      }).then((res) => {
        if (cancelled) return
        setContent({
          query: requestKey,
          status: res.ok ? 'ready' : 'error',
          items: res.ok ? sortHits(res.items, sortBy) : [],
          error: res.ok ? undefined : (res.error ?? '搜索失败'),
        })
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, normalized, contentType, sortBy, archivedFilter, dateFrom, dateTo, groupMode])

  // Focus the input on open; reset mode on every open.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  // Title-mode rows: local substring filter over the corpus + domain chip.
  // 标题模式的日期过滤走本地（语料行自带 updatedAt;结束日含当天）。
  const dateRangeMs = useMemo<{ from?: number; to?: number }>(() => {
    const parse = (value: string, nextDay: boolean): number | undefined => {
      if (value === '') return undefined
      const [year, month, day] = value.split('-').map(Number)
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined
      const date = new Date(year, month - 1, day)
      if (nextDay) date.setDate(date.getDate() + 1)
      return date.getTime()
    }
    const from = parse(dateFrom, false)
    const to = parse(dateTo, true)
    return { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) }
  }, [dateFrom, dateTo])

  const titleRows = useMemo<HostSessionItem[]>(() => {
    if (sessions === null) return []
    const byDomain = sessions.filter(item =>
      archivedFilter === 'active' ? item.archived !== true
      : archivedFilter === 'archived' ? item.archived === true
      : true)
    const byDate = byDomain.filter(item =>
      (dateRangeMs.from === undefined || item.updatedAt >= dateRangeMs.from)
      && (dateRangeMs.to === undefined || item.updatedAt < dateRangeMs.to))
    if (normalized === '') return byDate
    return byDomain.filter(item =>
      item.title.toLowerCase().includes(normalized)
      || item.cwd.toLowerCase().includes(normalized))
  }, [sessions, normalized, archivedFilter, dateRangeMs])

  const children: ReactElement[] = []
  if (deleteNote !== null) {
    children.push(createElement('div', { key: 'delnote', className: deleteNote.failed ? 'dsws_error' : 'dsws_status' }, deleteNote.text))
  }
  if (sessionsError !== null) {
    children.push(createElement('div', { key: 'err', className: 'dsws_error' }, translate(t, 'panel.sessionsError', { error: sessionsError })))
  }
  const activeRequestKey = contentRequestKey(normalized, contentType, sortBy, archivedFilter, { from: dateFrom, to: dateTo }, groupMode)
  const activeContent = content.query === activeRequestKey ? content : { query: activeRequestKey, status: 'loading' as const, items: [] }
  if (mode === 'title') {
    if (sessions === null) {
      children.push(createElement('div', { key: 'loading', className: 'dsws_status' }, translate(t, 'panel.loadingSessions')))
    } else if (titleRows.length === 0) {
      children.push(createElement('div', { key: 'empty', className: 'dsws_empty' }, normalized === '' ? translate(t, 'panel.noSessions') : translate(t, 'panel.noMatch')))
    } else {
      children.push(createElement('ul', {
        key: 'list',
        ref: listRef,
        className: 'dsws_list',
        role: 'listbox',
        'aria-label': translate(t, 'panel.titleSearch'),
      }, titleRows.slice(0, 200).map(item => createElement('li', { key: item.sessionId, role: 'option' }, createElement('div', { className: 'dsws_rowLine' }, [
        createElement('button', {
          key: 'row',
          type: 'button',
          className: 'dsws_row',
          onClick: () => { setArmedDelete(null); open(item.sessionId) },
        }, [
          createElement('span', { key: 't', className: 'dsws_rowTitle' }, [
            createElement('span', { key: 'x', className: 'dsws_titleText' }, item.title || translate(t, 'panel.untitled')),
            item.archived === true && createElement('span', { key: 'arch', className: 'dsws_tagArch' }, translate(t, 'tag.archived')),
            createElement('span', { key: 'tag', className: 'dsws_tag' }, fmtTime(item.updatedAt)),
          ]),
          item.cwd !== '' && createElement('span', { key: 'c', className: 'dsws_meta' }, item.cwd),
        ]),
        directDelete && deleteBtn(item.sessionId),
      ])))))
    }
  } else {
    if (searchStatus.rebuilding) {
      const pct = searchStatus.total > 0
        ? Math.min(100, Math.round((searchStatus.done / searchStatus.total) * 100))
        : undefined
      children.push(createElement('div', { key: 'rebuilding', className: 'dsws_progressWrap' }, [
        createElement('div', { key: 'bar', className: 'dsws_progress' },
          createElement('div', {
            className: 'dsws_progressFill',
            style: pct === undefined ? { width: '30%', opacity: 0.6 } : { width: `${pct}%` },
          })),
        createElement('span', { key: 'label', className: 'dsws_progressLabel' },
          translate(t, 'panel.rebuilding', { done: searchStatus.done, total: searchStatus.total || '?' })),
      ]))
    } else if (searchStatus.available === false) {
      children.push(createElement('div', { key: 'unavailable', className: 'dsws_error' }, [
        createElement('div', { key: 'msg' },
          searchStatus.reason === 'unreachable'
            ? '索引状态不可达：Host 半可能是旧进程。请完全重启 dsh web（浏览器刷新不重载 Host）后重试。'
            : searchStatus.reason === 'unavailable'
              ? translate(t, 'panel.unavailable')
              : translate(t, 'panel.notBuilt')),
        createElement('button', {
          key: 'build',
          type: 'button',
          className: 'dsws_actBtn',
          style: { marginTop: '6px' },
          onClick: startIndexBuild,
        }, translate(t, 'panel.buildIndex')),
      ]))
    } else if (activeContent.status === 'loading') {
      children.push(createElement('div', { key: 'loading', className: 'dsws_status' }, translate(t, 'panel.loadingContent')))
    } else if (activeContent.status === 'error') {
      children.push(createElement('div', { key: 'error', className: 'dsws_error' }, translate(t, 'panel.contentError', { error: activeContent.error ?? '未知错误' })))
    } else if (activeContent.items.length === 0) {
      children.push(createElement('div', { key: 'empty', className: 'dsws_empty' }, normalized === '' ? translate(t, 'panel.contentHint') : translate(t, 'panel.noContent')))
    } else {
      children.push(createElement('ul', {
        key: 'list',
        ref: listRef,
        className: 'dsws_list',
        role: 'listbox',
        'aria-label': translate(t, 'panel.contentSearch'),
      }, activeContent.items.slice(0, 200).map(item => createElement('li', { key: `${item.sessionId}:${item.seq}`, role: 'option' }, createElement('div', { className: 'dsws_rowLine' }, [
        createElement('button', {
          key: 'row',
          type: 'button',
          className: 'dsws_row',
          // B 路线定位臂（T7.4）：先开会话，再异步把命中行滚进视口高亮；
          // 定位失败静默——行为与接臂前逐行一致（仅打开）。展开态下同会话
          // 多行各自成行，行键/定位态键都降到 (sessionId,seq) 粒度。
          onClick: () => {
            const hitKey = `${item.sessionId}:${item.seq}`
            setArmedDelete(null)
            open(item.sessionId)
            setLocateStatus(s => ({ ...s, [hitKey]: 'pending' }))
            void locateSearchHit(item).then(ok => {
              setLocateStatus(s => ({ ...s, [hitKey]: ok ? 'ok' : 'fail' }))
            })
          },
        }, [
          createElement('span', { key: 't', className: 'dsws_rowTitle' }, [
            createElement('span', { key: 'x', className: 'dsws_titleText' }, item.title || translate(t, 'panel.untitled')),
            createElement('span', { key: 'tag', className: 'dsws_tag' }, typeLabel(t, item.type)),
            // The session clock — the very field the 「时间」 ordering sorts by and
            // the one the title rows already show. Ordering rows by a time the
            // rows never display is illegible: you cannot tell what the sort did.
            // 展开态例外：同会话各行 updatedAt 相同，改显命中行自己的 time。
            createElement('span', { key: 'time', className: 'dsws_tag' }, fmtTime(groupMode === 'expand' ? item.time : item.updatedAt)),
            ...(locateStatus[`${item.sessionId}:${item.seq}`] === undefined ? [] : [createElement('span', {
              key: 'loc', className: 'dsws_tag',
              title: locateStatus[`${item.sessionId}:${item.seq}`] === 'pending' ? '定位巡逻中'
                : locateStatus[`${item.sessionId}:${item.seq}`] === 'ok' ? '已跳转到命中行'
                  : '未能定位（行未渲染/文本被拆分/超时）',
            }, locateStatus[`${item.sessionId}:${item.seq}`] === 'pending' ? '⏳' : locateStatus[`${item.sessionId}:${item.seq}`] === 'ok' ? '✓' : '✗')]),
          ]),
          createElement('span', { key: 's', className: 'dsws_snippet' }, item.snippet || translate(t, 'panel.noText')),
        ]),
        directDelete && deleteBtn(item.sessionId),
      ])))))
    }
  }

  const panelEl = createElement('div', {
    key: 'panel',
    className: variant === 'page' ? 'dsws_trigger dsws_triggerPage' : 'dsws_trigger',
    role: variant === 'page' ? 'region' : 'dialog',
    'aria-label': translate(t, 'card.title'),
  }, [
      createElement('div', { key: 'tools', className: 'dsws_toolrow' }, [
        createElement('div', { key: 'mode', className: 'dsws_mode', role: 'group', 'aria-label': translate(t, 'card.defaultMode') }, [
          createElement('button', {
            key: 'title',
            type: 'button',
            className: `dsws_modeBtn${mode === 'title' ? ' dsws_modeBtnActive' : ''}`,
            onClick: () => { setMode('title') },
          }, translate(t, 'panel.titleSearch')),
          createElement('button', {
            key: 'content',
            type: 'button',
            className: `dsws_modeBtn${mode === 'content' ? ' dsws_modeBtnActive' : ''}`,
            onClick: () => { setMode('content') },
          }, translate(t, 'panel.contentSearch')),
        ]),
        createElement('input', {
          key: 'search',
          ref: inputRef,
          className: 'dsws_search',
          type: 'text',
          placeholder: mode === 'title' ? translate(t, 'panel.searchTitle') : translate(t, 'panel.searchContent'),
          value: query,
          onChange: (e: { target: { value: string } }) => setQuery(e.target.value),
        }),
      ]),
      createElement('div', { key: 'chips', className: 'dsws_chips', role: 'group', 'aria-label': translate(t, 'domain.all') }, [
        // 检索域 chips（全部/活跃/归档）在前——标题与内容两模式共用。
        ...ARCHIVED_CHIPS.map(chip => createElement('button', {
          key: chip.id,
          type: 'button',
          className: `dsws_chip${archivedFilter === chip.id ? ' dsws_chipActive' : ''}`,
          'aria-pressed': archivedFilter === chip.id,
          onClick: () => { setArchivedFilter(chip.id) },
        }, translate(t, chip.labelKey))),
        // 日期范围（R6）:两个 date 输入,标题/内容共用;空 = 不限。
        createElement('input', {
          key: 'from', type: 'date', className: 'dsws_search', style: { flex: 'none', width: '128px', height: '24px', padding: '0 6px', fontSize: '12px' },
          value: dateFrom, title: translate(t, 'date.from'),
          onChange: (e: { target: { value: string } }) => { setDateFrom(e.target.value) },
        }),
        createElement('input', {
          key: 'to', type: 'date', className: 'dsws_search', style: { flex: 'none', width: '128px', height: '24px', padding: '0 6px', fontSize: '12px' },
          value: dateTo, title: translate(t, 'date.to'),
          onChange: (e: { target: { value: string } }) => { setDateTo(e.target.value) },
        }),
        // 类型筛选与排序只属于内容模式。
        ...(mode === 'content' ? CONTENT_TYPE_CHIPS.map(chip => createElement('button', {
          key: chip.id,
          type: 'button',
          className: `dsws_chip${contentType === chip.id ? ' dsws_chipActive' : ''}`,
          'aria-pressed': contentType === chip.id,
          onClick: () => { setContentType(chip.id) },
        }, translate(t, chip.labelKey))) : []),
        // 命中粒度开关（仅内容模式）：分开显示=同会话多命中各自成行
        // （DRS expand=1 臂）；合并=每会话只显最强命中（既有行为）。
        ...(mode === 'content' ? GROUP_CHIPS.map(chip => createElement('button', {
          key: `g-${chip.id}`,
          type: 'button',
          className: `dsws_chip${groupMode === chip.id ? ' dsws_chipActive' : ''}`,
          'aria-pressed': groupMode === chip.id,
          title: translate(t, chip.id === 'expand' ? 'group.expand.hint' : 'group.merge.hint'),
          onClick: () => { setGroupMode(chip.id) },
        }, translate(t, chip.labelKey))) : []),
        // Ordering sits on the same row, pushed right: it filters the same
        // result set the type chips do, so it is not a separate toolbar.
        createElement('span', { key: 'gap', className: 'dsws_chipGap' }),
        ...(mode === 'content' ? [createElement('span', { key: 'sort', className: 'dsws_sortGroup', role: 'group', 'aria-label': translate(t, 'sort.label') },
          SORT_CHIPS.map(chip => createElement('button', {
            key: chip.id,
            type: 'button',
            className: `dsws_chip${sortBy === chip.id ? ' dsws_chipActive' : ''}`,
            'aria-pressed': sortBy === chip.id,
            title: chip.id === 'time' ? translate(t, 'sort.time.hint') : translate(t, 'sort.relevance.hint'),
            onClick: () => { setSortBy(chip.id) },
          }, translate(t, chip.labelKey))))] : []),
      ]),
      children,
      // The key bar. It advertises only chords that are actually bound: the
      // invoke chord (see `SwitchFooter`) and Escape (see the effect above).
      // A key cap for a key nothing listens to is a lie the user has to
      // discover by pressing it.
      createElement('div', { key: 'foot', className: 'dsws_panelFoot' }, [
        createElement('span', { key: 'index', className: 'dsws_footItem' }, [
          createElement('span', { key: 'label' }, searchStatus.rebuilding
            ? translate(t, 'panel.index.rebuilding', { done: searchStatus.done, total: searchStatus.total || '?' })
            : searchStatus.available === false
              ? translate(t, 'panel.index.none')
              : translate(t, 'panel.index.count', { n: searchStatus.count })),
          createElement('button', {
            key: 'rebuild',
            type: 'button',
            className: 'dsws_actBtn',
            style: { height: '20px', padding: '0 8px', fontSize: '11px', lineHeight: '18px' },
            disabled: searchStatus.rebuilding,
            title: translate(t, 'card.index.rebuild.hint'),
            onClick: startIndexBuild,
          }, searchStatus.rebuilding ? translate(t, 'card.index.rebuilding.btn') : translate(t, 'card.index.rebuild')),
          createElement('button', {
            key: 'deepSync',
            type: 'button',
            className: 'dsws_actBtn',
            style: { height: '20px', padding: '0 8px', fontSize: '11px', lineHeight: '18px' },
            disabled: searchStatus.deepSync === 'drs-syncing' || searchStatus.deepSync === 'rebuilding',
            title: translate(t, 'panel.deepSync.hint'),
            onClick: startDeepSync,
          }, searchStatus.deepSync === 'drs-syncing'
            ? translate(t, 'panel.deepSync.drs')
            : searchStatus.deepSync === 'rebuilding'
              ? translate(t, 'panel.deepSync.rebuild')
              : searchStatus.deepSync === 'done'
                ? translate(t, 'panel.deepSync.done')
                : searchStatus.deepSync === 'failed'
                  ? translate(t, 'panel.deepSync.failed')
                  : translate(t, 'panel.deepSync')),
        ]),
        createElement('span', { key: 'invoke', className: 'dsws_footItem' }, [
          createElement('kbd', { key: 'k', className: 'dsws_kbd' }, LABELS.invokeLabel),
          translate(t, 'panel.footer.invoke'),
        ]),
        createElement('span', { key: 'gap', className: 'dsws_footGap' }),
        createElement('span', { key: 'close', className: 'dsws_footItem' }, [
          createElement('kbd', { key: 'k', className: 'dsws_kbd' }, LABELS.escLabel),
          translate(t, 'panel.footer.close'),
        ]),
      ]),
    ])

  // 整页形态直接占用主栏（宿主已给页容器，不再叠遮罩 / 传送门）。
  if (variant === 'page') return panelEl
  return createPortal(createElement('div', { key: 'switch-root' }, [
    createElement('div', { key: 'backdrop', className: 'dsws_backdrop', onClick: onClose }),
    panelEl,
  ]), document.body)
}

/**
 * Whether the user has the sidebar entry switched on.
 *
 * The `enabled` field has existed since the card shipped, but nothing read it:
 * the switch promised "show the search entry at the bottom of the sidebar" and
 * controlled nothing at all. Reading it here is the whole fix.
 *
 * An absent or unreadable scope keeps the entry visible — a settings service we
 * cannot read is not a user asking for the feature off, and hiding the entry
 * would also hide the only way back to the panel.
 *
 * @param scope - the bound `switch-search` namespace scope, when available.
 * @returns `false` only when a readable scope says the entry is switched off.
 */
function useEntryEnabled(scope: SwitchCardScope | undefined): boolean {
  const snapshot = useSyncExternalStore(
    (listener) => scope?.subscribe(listener) ?? (() => {}),
    () => scope?.getSnapshot(),
  )
  return snapshot?.value?.enabled !== false
}

/** The footer entry: one icon button that opens the search panel. */
export function SwitchFooter({
  t,
  wide,
  open,
  scope,
}: SwitchFooterProps & { t?: CardLocale; open: (sessionId: string) => void; scope?: SwitchCardScope }): ReactElement | null {
  const [openPanel, setOpenPanel] = useState(false)
  const enabled = useEntryEnabled(scope)

  // The invoke chord. Bound here, next to the entry, so the shortcut exists
  // exactly while the entry does: a sidebar button that the `enabled` switch
  // hid, but a chord that still opened a panel out of nowhere, would be two
  // answers to "is this plugin on". The match itself lives in `platform.ts`
  // so the chord and the `⌘K`/`Ctrl K` chip cannot disagree.
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (!isInvokeChord(event, LABELS.isMac)) return
      event.preventDefault()
      setOpenPanel(true)
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [enabled])

  // Hook order is fixed above; the early return sits after every hook.
  if (!enabled) return null

  return createElement('div', { className: wide ? 'dsws_root' : 'dsws_root dsws_rootRail' }, [
    createElement('button', {
      key: 'btn',
      type: 'button',
      className: wide ? 'dsws_button' : 'dsws_button dsws_buttonRail',
      title: `${translate(t, 'panel.entry')}（${LABELS.invokeLabel}）`,
      'aria-label': `${translate(t, 'panel.entry')}（${translate(t, 'panel.titleSearch')} / ${translate(t, 'panel.contentSearch')}，${LABELS.invokeLabel}）`,
      'aria-expanded': openPanel,
      onClick: () => { setOpenPanel(true) },
    }, [
      searchIcon(),
      // The label and the key chip carry the same `wide` condition: a chip
      // beside an icon-only entry would be the only thing in the collapsed
      // rail, and `.dsws_button` clips rather than wraps.
      wide && createElement('span', { key: 'label', className: 'dsws_buttonLabel' }, translate(t, 'panel.entry')),
      wide && createElement('kbd', { key: 'key', className: 'dsws_kbd' }, LABELS.invokeLabel),
    ]),
    openPanel && createElement(SwitchPanel, {
      key: 'panel',
      t,
      onClose: () => { setOpenPanel(false) },
      open: (sessionId: string) => {
        setOpenPanel(false)
        open(sessionId)
      },
    }),
  ])
}

/** ------------------------------------------------------------------ helpers */

/** Format an epoch-ms timestamp: today → HH:mm, else YYYY-MM-DD HH:mm. */
function fmtTime(ms: number): string {
  if (!ms || typeof ms !== 'number') return ''
  try {
    const d = new Date(ms)
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const sameDay = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate()
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    if (sameDay) return time
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`
  } catch {
    return ''
  }
}

/** Short label for a content-hit event type. */
function typeLabel(t: CardLocale | undefined, type: string): string {
  if (type === 'user/message' || type === 'assistant/message'
    || type === 'tool/call' || type === 'tool/result') {
    return translate(t, `type.${type}` as LocaleKey)
  }
  return type
}

/** Inline search icon (stroke aligned with the product's 1.75 hairline). */
function searchIcon(): ReactElement {
  return createElement('svg', {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': true,
  }, createElement('circle', {
    cx: 7,
    cy: 7,
    r: 4.5,
    stroke: 'currentColor',
    strokeWidth: 1.75,
    fill: 'none',
  }), createElement('path', {
    d: 'M10.5 10.5 L14 14',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
  }))
}
