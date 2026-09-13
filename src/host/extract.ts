/**
 * First-party semantic text extraction for the independent switch-search index.
 *
 * Semantics mirror the official session-query `extractSessionEventText` and the
 * core-session surface fold, mirrored structurally: the plugin must not
 * value-import official packages, so the event data is inspected as plain
 * records. Structural boundaries, embedded raw streams, request envelopes, and
 * unknown declaration-merged events contribute no text.
 */

/** One raw session event the plugin reads through sessionQuery.readSession. */
export interface SwitchRawEvent {
  seq: number
  type: string
  time?: number
  ignorable?: boolean
  surfaceOp?: unknown
  data: unknown
}

/** Surface membership of one indexed document. */
export type SwitchSurface = 'current' | 'shadowed'

/** One searchable document projected from one raw event. */
export interface SwitchIndexDoc {
  sessionId: string
  seq: number
  type: string
  time: number
  surface: SwitchSurface
  text: string
}

/**
 * ICU word segmenter shared by index and query paths (Node >= 16 / all evergreen
 * browsers, zero dependency). 'zh' sensitivity keeps CJK word granularity.
 */
const SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh', { granularity: 'word' })
  : undefined

/**
 * Space-separate word boundaries so the FTS5 unicode61 tokenizer indexes
 * words instead of whole CJK runs: the index and query sides must apply the
 * exact same segmentation for a token to meet its match.
 * @param text - raw extracted text (or a query term).
 * @returns text with a single space at every word boundary.
 */
export function segmentForIndex(text: string): string {
  if (SEGMENTER === undefined) return text
  const parts: string[] = []
  for (const { segment } of SEGMENTER.segment(text)) {
    const piece = segment.trim()
    if (piece !== '') parts.push(piece)
  }
  return parts.join(' ')
}

/**
 * Segment one whitespace-delimited query term into FTS5 phrase tokens.
 * @returns word-like segments, or the raw term when segmentation is unavailable.
 */
export function segmentQueryTerm(term: string): string[] {
  if (SEGMENTER === undefined) return [term]
  const words: string[] = []
  for (const { segment, isWordLike } of SEGMENTER.segment(term)) {
    const piece = segment.trim()
    if (piece !== '' && isWordLike === true) words.push(piece)
  }
  return words.length > 0 ? words : [term]
}

/** Whether a runtime value is a plain record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Trimmed text of one string-or-undefined part list, joined by newlines. */
function joinText(parts: readonly (string | undefined)[]): string {
  return parts.map(part => (typeof part === 'string' ? part.trim() : '')).filter(Boolean).join('\n')
}

/** Extracted text of one content block; unknown blocks contribute nothing. */
function blockText(block: unknown): string[] {
  if (!isRecord(block)) return []
  switch (block['type']) {
    case 'text':
      return typeof block['text'] === 'string' ? [block['text']] : []
    case 'reasoning':
      return []
    case 'tool-call':
      return [block['name'], block['arguments']].filter((v): v is string => typeof v === 'string')
    case 'tool-result': {
      const content = block['content']
      return Array.isArray(content) ? content.flatMap(blockText) : []
    }
    default:
      return []
  }
}

/** Text of one message content (array of blocks, or a plain string). */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return joinText(content.flatMap(blockText))
}

/** Turn-end reason text; completed turns contribute nothing. */
function turnEndText(data: Record<string, unknown>): string {
  const reason = data['reason']
  if (!isRecord(reason)) return ''
  switch (reason['kind']) {
    case 'error': {
      const error = reason['error']
      const message = isRecord(error) && typeof error['message'] === 'string' ? error['message'] : ''
      return joinText(['error', message])
    }
    case 'aborted':
      return 'aborted'
    case 'max-tokens':
    case 'interrupted':
      return String(reason['kind'])
    case 'completed':
      return ''
    // Unknown outcomes stay out until their owner defines search semantics.
    default:
      return ''
  }
}

/**
 * Extract searchable semantic text from one raw session event.
 * @param event - event to inspect.
 * @returns newline-joined semantic text, or an empty string when non-searchable.
 */
export function extractSessionEventText(event: SwitchRawEvent): string {
  const data = isRecord(event.data) ? event.data : {}
  switch (event.type) {
    case 'user/message':
      return contentText(data['content'])
    case 'assistant/message': {
      const message = isRecord(data['message']) ? data['message'] : {}
      return contentText(message['content'])
    }
    case 'tool/call':
      return joinText([data['name'], data['arguments']].filter((v): v is string => typeof v === 'string'))
    case 'tool/result': {
      const message = isRecord(data['message']) ? data['message'] : {}
      const error = isRecord(data['error']) ? data['error'] : {}
      return joinText([
        contentText(message['content']),
        typeof error['name'] === 'string' ? error['name'] : '',
        typeof error['code'] === 'string' ? error['code'] : '',
      ])
    }
    case 'todo/write': {
      const todos = Array.isArray(data['todos']) ? data['todos'] : []
      return joinText(todos.flatMap((todo) => {
        if (!isRecord(todo)) return []
        return [todo['status'], todo['content']].filter((v): v is string => typeof v === 'string')
      }))
    }
    case 'turn/end':
      return turnEndText(data)
    case 'turn/start':
    case 'step/start':
    case 'step/end':
    case 'assistant/attempt':
    case 'request/header':
      return ''
    default:
      return ''
  }
}

/** Event types whose ops participate in the surface fold. */
const SURFACE_ELIGIBLE_TYPES: ReadonlySet<string> = new Set([
  'user/message',
  'assistant/message',
  'tool/call',
  'tool/result',
])

/**
 * Classify raw-log events into current vs shadowed surface membership.
 *
 * Simplified fold of the official `foldSurface`: append events join the
 * surface, and a `replace` op shadows the declared inclusive seq range plus
 * removes it from the surface. Validation is intentionally lax — a broken op
 * degrades to append rather than failing the whole index build.
 * @param events - complete contiguous raw event log.
 * @returns seq → surface map; entries absent from the map are log-only.
 */
export function classifySurface(events: readonly SwitchRawEvent[]): Map<number, SwitchSurface> {
  const surface = new Map<number, SwitchSurface>()
  const nodes: number[] = []
  for (const event of events) {
    if (!SURFACE_ELIGIBLE_TYPES.has(event.type)) continue
    const op = event.surfaceOp
    if (op === 'append' || op === undefined) {
      nodes.push(event.seq)
      surface.set(event.seq, 'current')
      continue
    }
    if (isRecord(op) && op['op'] === 'replace'
      && typeof op['startSeq'] === 'number' && typeof op['endSeq'] === 'number') {
      const shadowed = new Set<number>()
      for (const seq of nodes) {
        if (seq >= (op['startSeq'] as number) && seq <= (op['endSeq'] as number)) shadowed.add(seq)
      }
      const kept = nodes.filter(seq => !shadowed.has(seq))
      nodes.length = 0
      nodes.push(...kept, event.seq)
      for (const seq of shadowed) surface.set(seq, 'shadowed')
      surface.set(event.seq, 'current')
      continue
    }
    // Unknown op shape: degrade to append.
    nodes.push(event.seq)
    surface.set(event.seq, 'current')
  }
  return surface
}

/**
 * Project one complete raw log into searchable documents.
 * @param sessionId - session that owns the log.
 * @param events - complete contiguous raw event log.
 * @returns documents in ascending seq order; structural events are omitted.
 */
export function buildIndexDocuments(sessionId: string, events: readonly SwitchRawEvent[]): SwitchIndexDoc[] {
  const surfaceBySeq = classifySurface(events)
  const documents: SwitchIndexDoc[] = []
  for (const event of events) {
    const text = extractSessionEventText(event)
    if (text.length === 0) continue
    documents.push({
      sessionId,
      seq: event.seq,
      type: event.type,
      time: typeof event.time === 'number' ? event.time : 0,
      surface: surfaceBySeq.get(event.seq) ?? 'shadowed',
      text,
    })
  }
  return documents
}
