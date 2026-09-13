/**
 * The archived-sessions viewer — a read-only centered dialog over the
 * official archive set as mirrored by the independent index.
 *
 * The official backend has no unarchive endpoint (workspace-controller ships
 * only archiveSession), so the panel browses and opens; it never mutates.
 * Shared by the search panel's footer entry and the settings card.
 */
import { createElement, useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { callHost, type HostSessionItem } from './host-api.ts'
import { translate, type LocaleKey } from './locales.ts'

/** The locale face handed to the panel (same seat as the card). */
export type ArchiveLocale = (key: LocaleKey, params?: Record<string, unknown>) => string

/**
 * The archived-sessions viewer.
 * @param props.t - optional host dictionary lookup.
 * @param props.onClose - close the dialog.
 * @param props.open - open a session by id (lazy sessions-service resolution).
 */
export function ArchivePanel({
  t,
  onClose,
  open,
}: {
  t?: ArchiveLocale
  onClose: () => void
  open: (sessionId: string) => void
}): ReactElement {
  const [items, setItems] = useState<HostSessionItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    callHost<HostSessionItem>('list-archived', {}).then((res) => {
      if (cancelled) return
      if (res.ok) setItems(res.items)
      else setError(res.error ?? '读取归档列表失败')
    })
    return () => { cancelled = true }
  }, [])

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const children: ReactElement[] = []
  if (error !== null) {
    children.push(createElement('div', { key: 'err', className: 'dsws_error' }, error))
  } else if (items === null) {
    children.push(createElement('div', { key: 'loading', className: 'dsws_status' }, translate(t, 'panel.archived.loading')))
  } else if (items.length === 0) {
    children.push(createElement('div', { key: 'empty', className: 'dsws_empty' }, translate(t, 'panel.archived.empty')))
  } else {
    children.push(createElement('ul', {
      key: 'list',
      className: 'dsws_list',
      role: 'listbox',
      'aria-label': translate(t, 'panel.archived'),
    }, items.map(item => createElement('li', { key: item.sessionId, role: 'option' }, createElement('button', {
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
