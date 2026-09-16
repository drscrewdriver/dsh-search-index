/**
 * dsh-search-index client half.
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
import { createElement, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { Context } from 'cordis'
import { DEFAULT_CONFIG, SWITCH_SEARCH_SETTINGS_NAMESPACE, type SwitchSearchConfig } from '../config.ts'
import { callHost, callHostAny, type HostContentHit, type HostIndexStatus, type HostSessionItem, type HostSortMode } from './host-api.ts'
import { SearchSettingsCard, type SwitchCardScope } from './card.tsx'
import { NS, en, translate, zh, type LocaleKey } from './locales.ts'
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

/** The client sessions service face: open a session from a search result. */
interface SwitchSessionsService {
  open(id: string): void
}

/** The client settings-scope service face (structural subset). */
interface SwitchSettingsScope<T> {
  bind<T>(spec: { namespace: string }): SwitchScopeLike<T>
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
  register(ns: string, dicts: Partial<Record<string, Record<string, string>>>): () => void
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

/** The coarse filter chips rendered above content results. */
const CONTENT_TYPE_CHIPS: readonly { id: ContentType; labelKey: LocaleKey }[] = [
  { id: 'all', labelKey: 'filter.all' },
  { id: 'user', labelKey: 'filter.user' },
  { id: 'reply', labelKey: 'filter.reply' },
  { id: 'tool', labelKey: 'filter.tool' },
]

/** Result-ordering chips rendered at the right of the same filter row. */
const SORT_CHIPS: readonly { id: HostSortMode; labelKey: LocaleKey }[] = [
  { id: 'relevance', labelKey: 'sort.relevance' },
  { id: 'time', labelKey: 'sort.time' },
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
 * @returns an opaque key, stable for equal inputs.
 */
function contentRequestKey(normalized: string, contentType: ContentType, sortBy: HostSortMode): string {
  return `${normalized}\u0000${contentType}\u0000${sortBy}`
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
let lastPanelMode: 'title' | 'content' = 'title'

declare module 'cordis' {
  interface Context {
    slots: SwitchSlotsService
    sessions?: SwitchSessionsService
    settingsScope?: SwitchSettingsScope<SwitchSearchConfig>
    locale?: SwitchLocaleService
  }
}

/** ------------------------------------------------------------------ styles */

const CSS = `
.dsws_root{box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;flex:none;width:100%}
.dsws_button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
.dsws_button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_button svg{flex:none}
.dsws_trigger{position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;max-width:calc(100vw - 24px);max-height:min(72vh,640px);box-sizing:border-box;background:var(--dsw-specific-tip);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 8px 28px rgba(0,0,0,.16));overflow:hidden;display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family)}
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
.dsws_kbd{flex:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:18px;width:auto;height:18px;padding:0 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
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
function injectStyles(): () => void {
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
function SwitchPanel({
  t,
  onClose,
  open,
}: {
  t?: CardLocale
  onClose: () => void
  open: (sessionId: string) => void
}): ReactElement {
  // Mode memory: the panel reopens in the mode last used in this web session
  // (first open falls back to 'title'). Session-scoped on purpose — no
  // persistence, the settings card's defaultMode stays the durable preference.
  const [mode, setModeState] = useState<'title' | 'content'>(lastPanelMode)
  const setMode = (next: 'title' | 'content'): void => {
    lastPanelMode = next
    setModeState(next)
  }
  const [query, setQuery] = useState('')
  const [contentType, setContentType] = useState<ContentType>('all')
  const [sortBy, setSortByState] = useState<HostSortMode>(readStoredSort)
  const setSortBy = (next: HostSortMode): void => {
    writeStoredSort(next)
    setSortByState(next)
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
  }>({ available: null, rebuilding: false, done: 0, total: 0 })
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
          setSearchStatus({ available: false, reason: 'unreachable', rebuilding: false, done: 0, total: 0 })
          return
        }
        const status = res as HostIndexStatus
        const rebuilding = status.rebuild?.state === 'building' || status.rebuild?.state === 'swapping'
        setSearchStatus({
          available: status.available ?? false,
          reason: status.reason,
          rebuilding,
          done: status.rebuild?.done ?? 0,
          total: status.rebuild?.total ?? 0,
        })
        if (rebuilding) timer = window.setTimeout(probe, 1500)
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
    const requestKey = contentRequestKey(normalized, requestType, sortBy)
    setContent(prev => ({ query: requestKey, status: 'loading', items: prev.query === requestKey ? prev.items : [] }))
    const timer = window.setTimeout(() => {
      callHost<HostContentHit>('content-search', {
        query: normalized,
        limit: 50,
        types: requestType === 'all' ? undefined : [requestType],
        sortBy,
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
  }, [mode, normalized, contentType, sortBy])

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

  // Title-mode rows: local substring filter over the corpus.
  const titleRows = useMemo<HostSessionItem[]>(() => {
    if (sessions === null) return []
    if (normalized === '') return sessions
    return sessions.filter(item =>
      item.title.toLowerCase().includes(normalized)
      || item.cwd.toLowerCase().includes(normalized))
  }, [sessions, normalized])

  const children: ReactElement[] = []
  if (sessionsError !== null) {
    children.push(createElement('div', { key: 'err', className: 'dsws_error' }, translate(t, 'panel.sessionsError', { error: sessionsError })))
  }
  const activeRequestKey = contentRequestKey(normalized, contentType, sortBy)
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
      }, titleRows.slice(0, 200).map(item => createElement('li', { key: item.sessionId, role: 'option' }, createElement('button', {
        type: 'button',
        className: 'dsws_row',
        onClick: () => { open(item.sessionId) },
      }, [
        createElement('span', { key: 't', className: 'dsws_rowTitle' }, [
          createElement('span', { key: 'x', className: 'dsws_titleText' }, item.title || translate(t, 'panel.untitled')),
          createElement('span', { key: 'tag', className: 'dsws_tag' }, fmtTime(item.updatedAt)),
        ]),
        item.cwd !== '' && createElement('span', { key: 'c', className: 'dsws_meta' }, item.cwd),
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
      }, activeContent.items.slice(0, 200).map(item => createElement('li', { key: item.sessionId, role: 'option' }, createElement('button', {
        type: 'button',
        className: 'dsws_row',
        onClick: () => { open(item.sessionId) },
      }, [
        createElement('span', { key: 't', className: 'dsws_rowTitle' }, [
          createElement('span', { key: 'x', className: 'dsws_titleText' }, item.title || translate(t, 'panel.untitled')),
          createElement('span', { key: 'tag', className: 'dsws_tag' }, typeLabel(t, item.type)),
          // The session clock — the very field the 「时间」 ordering sorts by and
          // the one the title rows already show. Ordering rows by a time the
          // rows never display is illegible: you cannot tell what the sort did.
          createElement('span', { key: 'time', className: 'dsws_tag' }, fmtTime(item.updatedAt)),
        ]),
        createElement('span', { key: 's', className: 'dsws_snippet' }, item.snippet || translate(t, 'panel.noText')),
      ])))))
    }
  }

  return createPortal(createElement('div', { key: 'switch-root' }, [
    createElement('div', { key: 'backdrop', className: 'dsws_backdrop', onClick: onClose }),
    createElement('div', { key: 'panel', className: 'dsws_trigger', role: 'dialog', 'aria-label': translate(t, 'card.title') }, [
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
      mode === 'content' && createElement('div', { key: 'chips', className: 'dsws_chips', role: 'group', 'aria-label': translate(t, 'filter.all') }, [
        ...CONTENT_TYPE_CHIPS.map(chip => createElement('button', {
          key: chip.id,
          type: 'button',
          className: `dsws_chip${contentType === chip.id ? ' dsws_chipActive' : ''}`,
          'aria-pressed': contentType === chip.id,
          onClick: () => { setContentType(chip.id) },
        }, translate(t, chip.labelKey))),
        // Ordering sits on the same row, pushed right: it filters the same
        // result set the type chips do, so it is not a separate toolbar.
        createElement('span', { key: 'gap', className: 'dsws_chipGap' }),
        createElement('span', { key: 'sort', className: 'dsws_sortGroup', role: 'group', 'aria-label': translate(t, 'sort.label') },
          SORT_CHIPS.map(chip => createElement('button', {
            key: chip.id,
            type: 'button',
            className: `dsws_chip${sortBy === chip.id ? ' dsws_chipActive' : ''}`,
            'aria-pressed': sortBy === chip.id,
            title: chip.id === 'time' ? translate(t, 'sort.time.hint') : translate(t, 'sort.relevance.hint'),
            onClick: () => { setSortBy(chip.id) },
          }, translate(t, chip.labelKey)))),
      ]),
      children,
      // The key bar. It advertises only chords that are actually bound: the
      // invoke chord (see `SwitchFooter`) and Escape (see the effect above).
      // A key cap for a key nothing listens to is a lie the user has to
      // discover by pressing it.
      createElement('div', { key: 'foot', className: 'dsws_panelFoot' }, [
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
    ]),
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
function SwitchFooter({
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

  return createElement('div', { className: 'dsws_root' }, [
    createElement('button', {
      key: 'btn',
      type: 'button',
      className: 'dsws_button',
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

/** ------------------------------------------------------------------ plugin */

/** The child settings seat **under 「插件配置」** — the only settings seat we occupy. */
export const SETTINGS_CARD_SEAT = 'settings.plugin.item'
/**
 * Sibling-tab seat (`settings.plugins.tab`). **Deliberately NOT registered.**
 *
 * Kept as a named constant because it is the seat this plugin used to also
 * occupy — registering both is what made the card appear twice (once next to
 * 「插件配置」 and once under it). If a future host line drops the child seat, the
 * right move is to re-derive the target seat from that host's source, not to
 * register both.
 */
export const SETTINGS_SIBLING_SEAT = 'settings.plugins.tab'
/** How long to let the host declare the child seat before warning (ms). */
const SEAT_PROBE_MS = 3000

/** Services required before mounting: the slot registry (others optional). */
export const inject = ['slots']

/**
 * Client plugin body: dictionaries, the plugin settings card, and the
 * (disabled upstream) footer search panel entry.
 * @param ctx - client plugin context (slots, optional locale/settingsScope/sessions).
 */
export function apply(ctx: Context): void {
  ctx.effect(() => injectStyles(), 'dsh-search-index: stylesheet')

  // Register the dictionaries when the locale service exists (optional across
  // target releases); the card falls back to the bundled zh dictionary.
  const locale = ctx.get('locale') as SwitchLocaleService | undefined
  if (locale !== undefined && typeof locale.register === 'function') {
    ctx.effect(() => locale.register(NS, { zh, en } as never), 'dsh-search-index: dictionaries')
  }

  const slots = ctx.get('slots') as SwitchSlotsService | undefined
  if (slots === undefined) return
  // Session opening resolves lazily at click time: this plugin applies before
  // the session-controller client module in the load order, so an eager
  // ctx.get('sessions') captured undefined and every result click silently
  // no-op'd. The service is a root-context singleton; by the time a user
  // clicks a hit it is always mounted.
  const open = (sessionId: string): void => {
    const sessions = ctx.get('sessions') as SwitchSessionsService | undefined
    if (sessions !== undefined && typeof sessions.open === 'function') sessions.open(sessionId)
  }

  // Resolved before the footer entry because that entry is the thing the
  // `enabled` switch controls: the switch and the entry have to read the same
  // binding, or the switch silently goes back to controlling nothing.
  const settingsScope = ctx.get('settingsScope') as SwitchSettingsScope<SwitchSearchConfig> | undefined
  const entryScope: SwitchCardScope | undefined = settingsScope?.bind<SwitchSearchConfig>({
    namespace: SWITCH_SEARCH_SETTINGS_NAMESPACE,
  })

  // The sidebar footer entry: the search panel (title/content toggle), one
  // bottom-bar button beside the official settings trigger. The archived-
  // sessions viewer moved to dsh-session-steward (养老院) — this package no
  // longer owns any session-history UI.
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-search-index', order: 10 },
    (props: SwitchFooterProps) => createElement(SwitchFooter, { ...props, open, scope: entryScope }),
  ), 'dsh-search-index: sidebar footer entry')

  // The plugin settings card — registered on the **child seat under 「插件配置」**,
  // and nowhere else.
  //
  // ⚠️ This used to register on two seats, on the assumption that
  // 「`slots.inject` only fires once the seat is DECLARED ⇒ the two are mutually
  // exclusive at runtime」. **Measured false**: the 0.1.2 host declares all three
  // settings seats at once, so both fired and the card showed up twice — once as
  // a sibling tab of 「插件配置」 and once as the card under it.
  //
  // Host source (0.1.2, not inference):
  //   `settings.section`      dsh-client-ui-settings-general:650   top-level nav page (sibling of 插件)
  //   `settings.plugins.tab`  dsh-client-ui-settings-plugins:1781  a tab page **sibling to 插件配置**
  //   `settings.plugin.item`  same package :1793, declared at runtime by its
  //                           `configurable` contribution — the **card under 插件配置**
  //
  // So only the last one is registered. Both `id` and `key` are supplied: CLI dsh
  // declares that seat `keyed` (needs `key`) while DSH Desktop's bundled version
  // declares it `list` (needs `id`) — the slots service validates only its kind's
  // field, so the pair keeps the card working in both environments.
  //
  // 0.1.5's seat set cannot be verified without a 0.1.5 host. If that line does
  // not declare the child seat, the card disappears **silently** — which is how
  // this went unnoticed. So we warn; we do **not** fall back to another seat,
  // because registering a second seat is exactly what caused the duplicate.
  const tabTitle = typeof locale?.bind === 'function' ? locale.bind(NS) : undefined
  const cardInject = (): { scope: SwitchCardScope; openSession: (id: string) => void } => ({
    scope: entryScope ?? {
      getSnapshot: () => ({
        status: 'ready' as const,
        value: DEFAULT_CONFIG,
        revision: undefined,
        writable: false,
      }),
      subscribe: () => () => {},
      set: async () => {},
    },
    openSession: open,
  })

  const registerCard = (slotName: string): void => {
    // 只有平级标签页座位需要 `order`/`label`；子级卡片座位由卡片自身渲染标题。
    const isTab = slotName === SETTINGS_SIBLING_SEAT
    try {
      slots.inject(slotName, () => {
        try {
          return slots.register({
            name: slotName,
            id: SWITCH_SEARCH_SETTINGS_NAMESPACE,
            key: SWITCH_SEARCH_SETTINGS_NAMESPACE,
            order: isTab ? 100 : undefined,
            locale: locale !== undefined ? NS : undefined,
            // Only the tab seat renders a label; the item seat derives its
            // title from the card itself, so passing one there is a no-op.
            label: isTab ? () => (tabTitle !== undefined ? tabTitle('card.title') : zh['card.title']) : undefined,
            inject: cardInject,
          }, SearchSettingsCard)
        } catch (err) {
          console.warn(`[dsh-search-index] ${slotName} 注册失败:`, err)
          return () => {}
        }
      }, `dsh-search-index: plugin settings card (${slotName})`)
    } catch (err) {
      console.warn(`[dsh-search-index] ${slotName} 槽位未声明:`, err)
    }
  }

  // `inject` fires only once the seat is declared, so this flag tells us whether
  // the child seat actually took.
  let cardSeatLive = false
  try {
    slots.inject(SETTINGS_CARD_SEAT, () => {
      cardSeatLive = true
      return () => {}
    })
  } catch (err) {
    console.warn(`[dsh-search-index] ${SETTINGS_CARD_SEAT} 探测失败:`, err)
  }
  registerCard(SETTINGS_CARD_SEAT)

  // 响亮诊断：座位若始终没被声明（宿主改名/移除），卡片会**静默消失** ——
  // 正是这个问题长期没被发现的原因，所以必须在 Console 说出来。
  // 刻意**不回退**到别的座位：各插件只留一个位置，回退就会重新引入"同一份面板
  // 出现在两处"的可能（见上方说明）。
  setTimeout(() => {
    if (cardSeatLive) return
    console.warn(
      `[dsh-search-index] 宿主未声明 ${SETTINGS_CARD_SEAT}：设置里的「搜索索引」卡片不会出现。` +
        '（0.1.5 的座位集合本机未验证，请在真机上确认。）',
    )
  }, SEAT_PROBE_MS)
}

// Re-exported dictionary faces for consumers that compose the card directly.
export { NS as SWITCH_SEARCH_LOCALE_NAMESPACE, translate }
