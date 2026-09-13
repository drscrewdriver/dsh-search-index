/**
 * Session-search settings card — the `settings.plugin.item` face of the
 * plugin, following the dsh-thinking-levels card pattern.
 *
 * The card binds the `switch-search` settings namespace through the
 * `settingsScope` cordis service and renders its fields as one editable card:
 * the enable switch, the default panel mode, the independent-index sync
 * knobs, and the index-lifecycle block (status, the non-destructive 整理
 * button, and the JSON snapshot export/import seam). Every change commits
 * immediately through the scope (no staged form).
 *
 * Kept dependency-free beyond react: the scope is subscribed with
 * `useSyncExternalStore`, and the controls are plain HTML reusing the
 * stylesheet the client half injects.
 */
import { useEffect, useState, useSyncExternalStore, type JSX } from 'react'
import { createElement } from 'react'
import type { SwitchSearchConfig } from '../config.ts'
import {
  callHostAny,
  downloadSnapshot,
  type HostIndexStatus,
} from './host-api.ts'
import { translate, type LocaleKey } from './locales.ts'

/**
 * Structural mirror of the settings scope (the plugin must not value- or
 * type-import a single release of the official settings packages).
 */
export interface SwitchCardScope {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable'
    value: SwitchSearchConfig | undefined
    revision: number | undefined
    writable: boolean
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/** Injected face the settings slot factory hands the card. */
export interface SearchSettingsCardInjected {
  scope: SwitchCardScope
  /** Optional host dictionary lookup (present when the locale service exists). */
  t?: (key: LocaleKey, params?: Record<string, unknown>) => string
}

/** Full card props. */
export type SearchSettingsCardProps = SearchSettingsCardInjected

/** Row shared by every field of the card. */
function Row(props: { title: string; desc?: string; control: JSX.Element }): JSX.Element {
  return createElement('div', { className: 'dsws_setRow' }, [
    createElement('div', { key: 'text', className: 'dsws_setText' }, [
      createElement('span', { key: 't', className: 'dsws_setTitle' }, props.title),
      props.desc !== undefined
        && createElement('span', { key: 'd', className: 'dsws_setDesc' }, props.desc),
    ]),
    createElement('div', { key: 'ctl' }, props.control),
  ])
}

/** A boolean switch editing one namespace field. */
function Toggle(props: { checked: boolean; writable: boolean; onChange: (checked: boolean) => void }): JSX.Element {
  return createElement('label', { className: 'dsws_switch' }, [
    createElement('input', {
      type: 'checkbox',
      checked: props.checked,
      disabled: !props.writable,
      onChange: (e: { target: { checked: boolean } }) => props.onChange(e.target.checked),
    }),
    createElement('span', { key: 'track', className: 'dsws_switchTrack' }, createElement('span', { className: 'dsws_switchThumb' })),
  ])
}

/** The independent-index lifecycle block (status + 整理 + snapshot seam). */
function IndexBlock(props: { t?: SearchSettingsCardProps['t'] }): JSX.Element {
  const [status, setStatus] = useState<HostIndexStatus | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const refresh = (): void => {
      void callHostAny<HostIndexStatus>('index-status', {}).then((res) => {
        if (cancelled) return
        if (res.ok) setStatus(res as HostIndexStatus)
        const rebuilding = res.rebuild?.state === 'building' || res.rebuild?.state === 'swapping'
        if (rebuilding) timer = window.setTimeout(refresh, 2000)
        else setBusy(false)
      })
    }
    refresh()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [])

  const t = props.t
  const rebuilding = status?.rebuild?.state === 'building' || status?.rebuild?.state === 'swapping'
  const rebuildError = status?.rebuild?.state === 'error' ? status.rebuild.error : undefined
  const syncFailures = status?.sync?.failures?.length ?? 0
  const blocking = busy || rebuilding

  const onRebuild = (): void => {
    setBusy(true)
    setNote(null)
    void callHostAny<HostIndexStatus>('index-rebuild', {}).then((res) => {
      if (!res.ok) {
        setNote(translate(t, 'card.action.failed', { error: res.error ?? '?' }))
        setBusy(false)
      }
    })
  }

  const onExport = (): void => {
    setBusy(true)
    setNote(null)
    void downloadSnapshot()
      .then(() => setNote(translate(t, 'card.index.exported')))
      .catch((err: unknown) => setNote(translate(t, 'card.action.failed', { error: String(err instanceof Error ? err.message : err) })))
      .finally(() => setBusy(false))
  }

  const onImportFile = (file: File): void => {
    setBusy(true)
    setNote(null)
    void file.text().then((text) => callHostAny<HostIndexStatus>('index-import', text, 30_000)).then((res) => {
      if (res.ok) setNote(translate(t, 'card.index.import.started'))
      else setNote(res.error ?? translate(t, 'card.index.importParse'))
    }).catch((err: unknown) => setNote(translate(t, 'card.action.failed', { error: String(err instanceof Error ? err.message : err) })))
      .finally(() => setBusy(false))
  }

  const statusLine = status === null
    ? translate(t, 'card.index.reading')
    : rebuilding
      ? translate(t, 'card.index.rebuilding', { done: status.rebuild?.done ?? 0, total: status.rebuild?.total || '?' })
      : status.available === true
        ? `${translate(t, 'card.index.desc', { indexed: status.sync?.indexed ?? '?' })}${(status.archives?.length ?? 0) > 0 ? translate(t, 'card.index.archives', { archives: status.archives?.length }) : ''}`
        : translate(t, 'card.index.empty')

  return createElement('div', { className: 'dsws_setRow' }, [
    createElement('div', { key: 'text', className: 'dsws_setText' }, [
      createElement('span', { key: 't', className: 'dsws_setTitle' }, translate(t, 'card.index')),
      createElement('span', { key: 'd', className: 'dsws_setDesc' }, statusLine),
      rebuildError !== null && rebuildError !== undefined
        && createElement('span', { key: 'err', className: 'dsws_setDesc' }, translate(t, 'card.index.rebuildError', { error: rebuildError })),
      syncFailures > 0 && createElement('span', { key: 'warn', className: 'dsws_setDesc' }, translate(t, 'card.index.failures', { count: syncFailures })),
      note !== null && createElement('span', { key: 'note', className: 'dsws_setDesc' }, note),
      createElement('span', { key: 'hint', className: 'dsws_setDesc' }, translate(t, 'card.index.rebuild.hint')),
    ]),
    createElement('div', { key: 'btns', className: 'dsws_btnRow' }, [
      createElement('button', {
        key: 'rebuild',
        type: 'button',
        className: 'dsws_actBtn',
        disabled: blocking,
        onClick: onRebuild,
      }, rebuilding ? translate(t, 'card.index.rebuilding.btn') : translate(t, 'card.index.rebuild')),
      createElement('button', {
        key: 'export',
        type: 'button',
        className: 'dsws_actBtn',
        disabled: blocking || status?.available !== true,
        onClick: onExport,
      }, translate(t, 'card.index.export')),
      createElement('label', { key: 'import', className: 'dsws_actBtn' }, [
        translate(t, 'card.index.import'),
        createElement('input', {
          key: 'file',
          type: 'file',
          accept: '.jsonl,.json,text/plain,application/json',
          style: { display: 'none' },
          onChange: (e: { target: { files: { [index: number]: File | null } | null; value: string } }) => {
            const file = e.target.files?.[0] ?? undefined
            e.target.value = ''
            if (file !== undefined && file !== null) onImportFile(file)
          },
        }),
      ]),
    ]),
  ])
}

/**
 * The settings card body: a collapsed drawer shell (title + description +
 * chevron, thinking-levels pattern) expanding into the namespace fields and
 * the index-lifecycle block.
 * @param props - locale seat (optional) and the bound namespace scope.
 */
export function SearchSettingsCard(props: SearchSettingsCardProps): JSX.Element {
  const { scope } = props
  const t = props.t
  const [open, setOpen] = useState(false)
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )

  const body = createCardBody({ t, snapshot, scope })

  return createElement('div', {
    style: {
      border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
      background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))',
      borderRadius: '12px',
      transition: 'border-color 0.16s, background 0.16s',
    },
  }, [
    createElement('button', {
      key: 'head',
      type: 'button',
      'aria-expanded': open,
      style: {
        appearance: 'none',
        width: '100%',
        font: 'inherit',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        background: 'none',
        border: 0,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
      },
      onClick: () => { setOpen(current => !current) },
    }, [
      createElement('span', { key: 'text', style: { flex: '1 1 0%', minWidth: 0 } }, [
        createElement('div', {
          key: 'title',
          style: { fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
        }, translate(t, 'card.title')),
        createElement('div', {
          key: 'desc',
          style: { color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', fontSize: '13px', lineHeight: 1.5 },
        }, translate(t, 'card.description')),
      ]),
      createElement('svg', {
        key: 'chev',
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        'aria-hidden': true,
        style: {
          color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
          flex: '0 0 auto',
          transition: 'transform 0.16s',
          transform: open ? 'rotate(180deg)' : 'none',
        },
      }, createElement('path', {
        d: 'M4 6l4 4 4-4',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      })),
    ]),
    open && createElement('div', { key: 'body', style: { padding: '12px 16px' } }, body),
  ])
}

/** The card's expandable content: namespace fields plus the index block. */
function createCardBody(props: {
  t?: SearchSettingsCardProps['t']
  snapshot: ReturnType<SwitchCardScope['getSnapshot']>
  scope: SwitchCardScope
}): JSX.Element[] {
  const t = props.t
  const snapshot = props.snapshot
  const scope = props.scope

  if (snapshot.status === 'unavailable') {
    return [
      createElement('div', { className: 'dsws_setRow', key: 'unavailable' },
        createElement('span', { className: 'dsws_setTitle' }, translate(t, 'card.unavailable'))),
    ]
  }

  const value: Partial<SwitchSearchConfig> = snapshot.value ?? {}
  const writable = snapshot.writable
  const syncIntervalSeconds = Math.round((value.syncIntervalMs ?? 30_000) / 1000)
  const archiveKeep = value.archiveKeep ?? 2

  const children: JSX.Element[] = [
    createElement(Row, {
      key: 'enable',
      title: translate(t, 'card.enabled'),
      desc: translate(t, 'card.enabled.desc'),
      control: createElement(Toggle, {
        checked: value.enabled ?? true,
        writable,
        onChange: (checked) => { void scope.set('enabled', checked) },
      }),
    }),
    createElement(Row, {
      key: 'mode',
      title: translate(t, 'card.defaultMode'),
      desc: translate(t, 'card.defaultMode.desc'),
      control: createElement('div', { className: 'dsws_seg', role: 'group' },
        (['title', 'content'] as const).map(mode => createElement('button', {
          key: mode,
          type: 'button',
          className: `dsws_segBtn${(value.defaultMode ?? 'title') === mode ? ' dsws_segBtnActive' : ''}`,
          'aria-pressed': (value.defaultMode ?? 'title') === mode,
          disabled: !writable,
          onClick: () => { void scope.set('defaultMode', mode) },
        }, mode === 'title' ? translate(t, 'card.mode.title') : translate(t, 'card.mode.content')))),
    }),
    createElement(Row, {
      key: 'autoSync',
      title: translate(t, 'card.autoSync'),
      desc: translate(t, 'card.autoSync.desc'),
      control: createElement(Toggle, {
        checked: value.autoSync ?? true,
        writable,
        onChange: (checked) => { void scope.set('autoSync', checked) },
      }),
    }),
    createElement(Row, {
      key: 'interval',
      title: translate(t, 'card.syncInterval'),
      desc: translate(t, 'card.syncInterval.desc'),
      control: createElement('input', {
        type: 'number',
        min: 5,
        max: 3600,
        disabled: !writable,
        value: syncIntervalSeconds,
        style: { width: '72px', boxSizing: 'border-box' },
        className: 'dsws_search',
        onChange: (e: { target: { value: string } }) => {
          const seconds = Number(e.target.value)
          if (Number.isFinite(seconds) && seconds >= 5) void scope.set('syncIntervalMs', Math.round(seconds * 1000))
        },
      }),
    }),
    createElement(Row, {
      key: 'archiveKeep',
      title: translate(t, 'card.archiveKeep'),
      desc: translate(t, 'card.archiveKeep.desc'),
      control: createElement('input', {
        type: 'number',
        min: 0,
        max: 20,
        disabled: !writable,
        value: archiveKeep,
        style: { width: '72px', boxSizing: 'border-box' },
        className: 'dsws_search',
        onChange: (e: { target: { value: string } }) => {
          const count = Number(e.target.value)
          if (Number.isFinite(count) && count >= 0) void scope.set('archiveKeep', Math.round(count))
        },
      }),
    }),
  ]

  const indexBlock = IndexBlock({ t })
  children.push(indexBlock)

  if (!writable) {
    children.push(createElement('div', { key: 'ro', className: 'dsws_setDesc' }, translate(t, 'card.readonly')))
  }
  return children
}
