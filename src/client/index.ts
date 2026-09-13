/**
 * dsh-session-search-toggle client half.
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
import { createElement, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { Context } from 'cordis'
import { DEFAULT_CONFIG, SWITCH_SEARCH_SETTINGS_NAMESPACE, type SwitchSearchConfig } from '../config.ts'
import { callHost, callHostAny, type HostContentHit, type HostIndexStatus, type HostSessionItem } from './host-api.ts'
import { SearchSettingsCard, type SwitchCardScope } from './card.tsx'
import { ArchivePanel } from './archive-panel.tsx'
import { NS, en, translate, zh, type LocaleKey } from './locales.ts'

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
.dsws_trigger{position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;max-width:calc(100vw - 24px);max-height:min(72vh,640px);box-sizing:border-box;background:var(--dsw-specific-tip);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.16);overflow:hidden;display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family)}
.dsws_toolrow{display:flex;align-items:center;gap:8px;padding:10px 10px 0}
.dsws_mode{display:inline-flex;align-items:center;gap:2px;flex:none;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px}
.dsws_modeBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 8px;font-size:12px;font-weight:500;line-height:20px}
.dsws_modeBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_modeBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_search{flex:auto;min-width:0;height:30px;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;outline:none;padding:0 10px;font:inherit;font-size:13px;line-height:20px}
.dsws_search:focus{border-color:var(--dsw-alias-state-business-primary)}
.dsws_search::placeholder{color:var(--dsw-alias-label-caption)}
.dsws_chips{display:flex;align-items:center;gap:6px;padding:8px 10px 0;flex:none}
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
.dsws_setRoot{display:flex;flex-direction:column;width:100%}
.dsws_setRow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsws_setRow:last-child{border-bottom:none}
.dsws_setText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsws_setTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.dsws_setDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsws_switch{position:relative;width:40px;height:22px;flex:none}
.dsws_switch>input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:pointer}
.dsws_switch>input:disabled{cursor:not-allowed}
.dsws_switchTrack{position:absolute;inset:0;background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:11px;transition:background .15s ease,border-color .15s ease;pointer-events:none}
.dsws_switch>input:checked+.dsws_switchTrack{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.dsws_switchThumb{position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .15s ease}
.dsws_switch>input:checked+.dsws_switchTrack>.dsws_switchThumb{transform:translateX(18px)}
.dsws_seg{display:inline-flex;align-items:center;gap:2px;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:2px;flex:none}
.dsws_segBtn{height:24px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 10px;font-size:12px;font-weight:500;line-height:20px}
.dsws_segBtn:hover{color:var(--dsw-alias-label-primary)}
.dsws_segBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_segBtnActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsws_actBtn{height:26px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:0 10px;font-size:12px;line-height:24px;white-space:nowrap}
.dsws_actBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsws_actBtn:disabled{cursor:not-allowed;opacity:.5}
.dsws_indexLine{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsws_btnRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsws_progressWrap{display:flex;flex-direction:column;gap:4px;padding:8px 10px 0}
.dsws_progress{height:6px;border-radius:3px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}
.dsws_progressFill{height:100%;border-radius:3px;background:var(--dsw-alias-state-business-primary);transition:width .4s ease}
.dsws_progressLabel{color:var(--dsw-alias-state-business-primary);font-size:12px;line-height:18px;font-weight:600;font-variant-numeric:tabular-nums}
.dsws_panelFoot{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px 10px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsws_linkBtn{height:26px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:0 8px;font:inherit;font-size:12px;line-height:18px}
.dsws_linkBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsws_dialogHead{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 0}
.dsws_dialogTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:22px}
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
  tag.dataset.plugin = 'dsh-session-search-toggle'
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
  onOpenArchive,
  open,
}: {
  t?: CardLocale
  onClose: () => void
  onOpenArchive: () => void
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
        if (!res.ok) return
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
    const requestKey = `${normalized}\u0000${requestType}`
    setContent(prev => ({ query: requestKey, status: 'loading', items: prev.query === requestKey ? prev.items : [] }))
    const timer = window.setTimeout(() => {
      callHost<HostContentHit>('content-search', { query: normalized, limit: 50, types: requestType === 'all' ? undefined : [requestType] }).then((res) => {
        if (cancelled) return
        setContent({ query: requestKey, status: res.ok ? 'ready' : 'error', items: res.ok ? res.items : [], error: res.ok ? undefined : (res.error ?? '搜索失败') })
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, normalized, contentType])

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
  const contentRequestKey = `${normalized}\u0000${contentType}`
  const activeContent = content.query === contentRequestKey ? content : { query: contentRequestKey, status: 'loading' as const, items: [] }
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
          searchStatus.reason === 'unavailable'
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
      mode === 'content' && createElement('div', { key: 'chips', className: 'dsws_chips', role: 'group', 'aria-label': translate(t, 'filter.all') },
        CONTENT_TYPE_CHIPS.map(chip => createElement('button', {
          key: chip.id,
          type: 'button',
          className: `dsws_chip${contentType === chip.id ? ' dsws_chipActive' : ''}`,
          'aria-pressed': contentType === chip.id,
          onClick: () => { setContentType(chip.id) },
        }, translate(t, chip.labelKey)))),
      children,
      createElement('div', { key: 'foot', className: 'dsws_panelFoot' }, [
        createElement('button', {
          key: 'archive',
          type: 'button',
          className: 'dsws_linkBtn',
          onClick: onOpenArchive,
        }, translate(t, 'panel.archived.entry')),
      ]),
    ]),
  ]), document.body)
}

/** The footer entry: one icon button that opens the search panel. */
function SwitchFooter({
  t,
  wide,
  open,
}: SwitchFooterProps & { t?: CardLocale; open: (sessionId: string) => void }): ReactElement {
  const [openPanel, setOpenPanel] = useState(false)
  const [openArchive, setOpenArchive] = useState(false)
  const closeAll = (): void => { setOpenPanel(false); setOpenArchive(false) }

  return createElement('div', { className: 'dsws_root' }, [
    createElement('button', {
      key: 'btn',
      type: 'button',
      className: 'dsws_button',
      title: translate(t, 'card.title'),
      'aria-label': `${translate(t, 'card.title')}（${translate(t, 'panel.titleSearch')} / ${translate(t, 'panel.contentSearch')}）`,
      'aria-expanded': openPanel,
      onClick: () => { setOpenPanel(true) },
    }, [searchIcon(), wide && createElement('span', { key: 'label' }, translate(t, 'panel.entry'))]),
    openPanel && createElement(SwitchPanel, {
      key: 'panel',
      t,
      onClose: closeAll,
      onOpenArchive: () => { setOpenPanel(false); setOpenArchive(true) },
      open: (sessionId: string) => {
        closeAll()
        open(sessionId)
      },
    }),
    openArchive && createElement(ArchivePanel, {
      key: 'archive',
      t,
      onClose: closeAll,
      open: (sessionId: string) => {
        closeAll()
        open(sessionId)
      },
    }),
  ])
}

/** The bottom-bar archive entry: opens the archived-sessions viewer. */
function SwitchArchiveFooter({
  t,
  wide,
  open,
}: SwitchFooterProps & { t?: CardLocale; open: (sessionId: string) => void }): ReactElement {
  const [openArchive, setOpenArchive] = useState(false)
  return createElement('div', { className: 'dsws_root' }, [
    createElement('button', {
      key: 'btn',
      type: 'button',
      className: 'dsws_button',
      title: translate(t, 'panel.archived'),
      'aria-label': translate(t, 'panel.archived'),
      'aria-haspopup': 'dialog',
      'aria-expanded': openArchive,
      onClick: () => { setOpenArchive(true) },
    }, [archiveIcon(), wide && createElement('span', { key: 'label' }, translate(t, 'panel.archived'))]),
    openArchive && createElement(ArchivePanel, {
      key: 'archive',
      t,
      onClose: () => { setOpenArchive(false) },
      open: (sessionId: string) => {
        setOpenArchive(false)
        open(sessionId)
      },
    }),
  ])
}

/** Inline archive-box icon (same 16px grid as the official settings gear). */
function archiveIcon(): ReactElement {
  return createElement('svg', {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': true,
  }, [
    createElement('path', {
      key: 'lid',
      d: 'M2 3.5h12v2.2H2z',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinejoin: 'round',
    }),
    createElement('path', {
      key: 'box',
      d: 'M3.2 5.7h9.6v6.1a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1z',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinejoin: 'round',
    }),
    createElement('path', {
      key: 'slot',
      d: 'M6.4 8.2h3.2',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
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

/** Services required before mounting: the slot registry (others optional). */
export const inject = ['slots']

/**
 * Client plugin body: dictionaries, the plugin settings card, and the
 * (disabled upstream) footer search panel entry.
 * @param ctx - client plugin context (slots, optional locale/settingsScope/sessions).
 */
export function apply(ctx: Context): void {
  ctx.effect(() => injectStyles(), 'dsh-session-search-toggle: stylesheet')

  // Register the dictionaries when the locale service exists (optional across
  // target releases); the card falls back to the bundled zh dictionary.
  const locale = ctx.get('locale') as SwitchLocaleService | undefined
  if (locale !== undefined && typeof locale.register === 'function') {
    ctx.effect(() => locale.register(NS, { zh, en } as never), 'dsh-session-search-toggle: dictionaries')
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

  // The sidebar footer entries: the search panel (title/content toggle) and
  // the archive viewer — two bottom-bar buttons beside the official
  // settings trigger, both opening the centered dialog.
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-session-search-toggle', order: 10 },
    (props: SwitchFooterProps) => createElement(SwitchFooter, { ...props, open }),
  ), 'dsh-session-search-toggle: sidebar footer entry')
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-session-search-toggle-archive', order: 11 },
    (props: SwitchFooterProps) => createElement(SwitchArchiveFooter, { ...props, open }),
  ), 'dsh-session-search-toggle: sidebar archive entry')

  // The plugin settings card (settings.plugin.item) replaces the old
  // settings.general.item row + local store seat. Both `id` and `key` are
  // supplied: CLI dsh declares this slot `keyed`, DSH Desktop's bundled
  // version declares it `list` (thinking-levels pattern).
  const settingsScope = ctx.get('settingsScope') as SwitchSettingsScope<SwitchSearchConfig> | undefined
  slots.inject('settings.plugin.item', () => slots.register({
    name: 'settings.plugin.item',
    id: SWITCH_SEARCH_SETTINGS_NAMESPACE,
    key: SWITCH_SEARCH_SETTINGS_NAMESPACE,
    locale: locale !== undefined ? NS : undefined,
    inject: () => {
      const scope: SwitchCardScope | undefined = settingsScope?.bind<SwitchSearchConfig>({
        namespace: SWITCH_SEARCH_SETTINGS_NAMESPACE,
      })
      return {
        scope: scope ?? {
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
      }
    },
  }, SearchSettingsCard), 'dsh-session-search-toggle: plugin settings card')
}

// Re-exported dictionary faces for consumers that compose the card directly.
export { NS as SWITCH_SEARCH_LOCALE_NAMESPACE, translate }
