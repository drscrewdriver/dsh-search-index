/**
 * The archived-sessions viewer — a centered dialog over the official archive
 * set as mirrored by the independent index, plus a batch cleanup mode:
 * multi-select rows, JS-confirm, and prune the ids from the canonical
 * storage hub's archivedSessionIds array.
 *
 * Rows never navigate: archived sessions are gone from the user's active
 * system, so there is nothing to open. Pruning edits the storage file
 * (backup + atomic replace) and needs a DSH restart for the host's
 * in-memory registry to reload it. Shared by the search panel's footer
 * entry and the settings card.
 */
import { createElement, useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { callHost, callHostAny } from './host-api.ts'
import { translate, type LocaleKey } from './locales.ts'

/** The locale face handed to the panel (same seat as the card). */
export type ArchiveLocale = (key: LocaleKey, params?: Record<string, unknown>) => string

/** One archived-session row from the host. */
interface ArchiveRow {
  sessionId: string
  title: string
  cwd: string
  updatedAt: number
}

/**
 * The archived-sessions viewer with batch cleanup.
 * @param props.t - optional host dictionary lookup.
 * @param props.onClose - close the dialog.
 */
export function ArchivePanel({
  t,
  onClose,
}: {
  t?: ArchiveLocale
  onClose: () => void
}): ReactElement {
  const [items, setItems] = useState<ArchiveRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [pruning, setPruning] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    callHost<ArchiveRow>('list-archived', {}).then((res) => {
      if (cancelled) return
      if (res.ok) setItems(res.items)
      else setError(res.error ?? '读取归档列表失败')
    })
    return () => { cancelled = true }
  }, [attempt])

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const toggleRow = (sessionId: string): void => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  const toggleAll = (): void => {
    setSelected(prev => (prev.size === (items?.length ?? 0)
      ? new Set<string>()
      : new Set((items ?? []).map(item => item.sessionId))))
  }

  /** JS-confirm gate, then prune the selected ids on the host. */
  const pruneSelected = (): void => {
    const ids = [...selected]
    if (ids.length === 0) return
    const summary = ids.length <= 5
      ? ids.map(id => `${id.slice(0, 22)}…`).join('\n')
      : `${ids.slice(0, 4).map(id => `${id.slice(0, 22)}…`).join('\n')}\n… 共 ${ids.length} 个`
    const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(`确认从归档数组中移除 ${ids.length} 个会话 id？\n\n${summary}\n\n将写入存储文件（自动备份），需要重启 DSH 后官方侧生效。此操作不可撤销。`)
      : false
    if (!confirmed) return
    setPruning(true)
    setNote(null)
    void callHostAny<{ removed?: number; remaining?: number }>('archive-prune', { sessionIds: ids }, 60_000).then((res) => {
      if (res.ok) {
        setNote(`已从归档数组移除 ${res.removed ?? ids.length} 个 id（剩余 ${res.remaining ?? '?'}）。请重启 DSH 使官方侧生效。`)
        setSelected(new Set())
        setAttempt(n => n + 1)
      } else {
        setNote(res.error ?? '清理失败')
      }
    }).catch((err: unknown) => setNote(`清理失败：${String(err instanceof Error ? err.message : err)}`))
      .finally(() => setPruning(false))
  }

  const children: ReactElement[] = []
  if (error !== null) {
    children.push(createElement('div', { key: 'err', className: 'dsws_error' }, [
      createElement('div', { key: 'msg' }, error === '请求超时'
        ? '读取归档列表超时：Host 可能正忙（如正在整理索引），稍后重试。'
        : error),
      createElement('button', {
        key: 'retry',
        type: 'button',
        className: 'dsws_actBtn',
        style: { marginTop: '6px' },
        onClick: () => { setAttempt(n => n + 1) },
      }, '重试'),
    ]))
  } else if (items === null) {
    children.push(createElement('div', { key: 'loading', className: 'dsws_status' }, translate(t, 'panel.archived.loading')))
  } else if (items.length === 0) {
    children.push(createElement('div', { key: 'empty', className: 'dsws_empty' }, translate(t, 'panel.archived.empty')))
  } else {
    const allSelected = selected.size === items.length
    children.push(createElement('div', { key: 'manage', className: 'dsws_btnRow', style: { padding: '4px 10px 0' } }, [
      createElement('button', {
        key: 'all',
        type: 'button',
        className: 'dsws_actBtn',
        onClick: toggleAll,
      }, allSelected ? '取消全选' : '全选'),
      createElement('button', {
        key: 'prune',
        type: 'button',
        className: 'dsws_actBtn',
        disabled: pruning || selected.size === 0,
        onClick: pruneSelected,
      }, pruning ? '清理中…' : `清理选中 (${selected.size})`),
      createElement('span', { key: 'hint', className: 'dsws_indexLine' }, '清理 = 从官方归档数组移除，需重启 DSH 生效'),
    ]))
    children.push(createElement('ul', {
      key: 'list',
      className: 'dsws_list',
      role: 'list',
      'aria-label': translate(t, 'panel.archived'),
    }, items.map(item => createElement('li', { key: item.sessionId, className: 'dsws_row dsws_archRow' }, [
      createElement('label', { key: 'sel', className: 'dsws_archCheck' }, [
        createElement('input', {
          type: 'checkbox',
          checked: selected.has(item.sessionId),
          onChange: () => { toggleRow(item.sessionId) },
        }),
      ]),
      createElement('span', { key: 't', className: 'dsws_rowTitle' }, [
        createElement('span', { key: 'x', className: 'dsws_titleText' }, item.title || translate(t, 'panel.untitled')),
        createElement('span', { key: 'tag', className: 'dsws_tag' }, fmtTime(item.updatedAt)),
      ]),
      item.cwd !== '' && createElement('span', { key: 'c', className: 'dsws_meta' }, item.cwd),
      createElement('span', { key: 'id', className: 'dsws_meta dsws_uuid' }, item.sessionId),
    ]))))
  }

  return createPortal(createElement('div', { key: 'archive-root' }, [
    createElement('div', { key: 'backdrop', className: 'dsws_backdrop', onClick: onClose }),
    createElement('div', {
      key: 'panel',
      className: 'dsws_trigger',
      role: 'dialog',
      'aria-label': translate(t, 'panel.archived'),
    }, [
      createElement('div', { key: 'head', className: 'dsws_dialogHead' }, [
        createElement('span', { key: 'title', className: 'dsws_dialogTitle' }, translate(t, 'panel.archived')),
        createElement('button', {
          key: 'close',
          type: 'button',
          className: 'dsws_actBtn',
          onClick: onClose,
        }, translate(t, 'panel.archived.close')),
      ]),
      note !== null && createElement('div', { key: 'note', className: 'dsws_status' }, note),
      children,
    ]),
  ]), document.body)
}

/** Format an epoch-ms timestamp (mirror of the search panel's helper). */
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
