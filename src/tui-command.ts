/**
 * tui-command.ts — `/sfind`：会话检索的 dsh-tui 终端面（宿主斜杠命令）。
 *
 * 背景：dsh-tui 不加载插件 client 半边，宿主 ≥0.1.7 上 dsh-search-index 的入口是
 * 「主栏整页」—— 在终端里没有入口。命令面复用同一套取数：
 *   标题模式 = listSessions()（索引缓存的会话头）
 *   内容模式 = contentSearch()（DRS 分组命中，语义全在投影库侧）
 * 不新增查询逻辑，避免与面板口径漂移。
 *
 * 契约（.agents/plans/dsh-tui-faces/spec.md §3）：单行 <=100、总行 <=40、无 ANSI、--json 单行。
 */

import type { Context } from 'cordis'

export type CommandKind = 'success' | 'error'
export interface CommandResult { kind: CommandKind; text: string }

export interface SessionHead {
  sessionId: string
  title?: string
  cwd?: string
  updatedAt?: number
}

export interface ContentHit {
  sessionId?: string
  title?: string
  snippet?: string
  excerpt?: string
  hits?: Array<{ snippet?: string; excerpt?: string; text?: string }>
  [key: string]: unknown
}

export interface SfindCommandDeps {
  status(): Promise<unknown>
  titles(): Promise<{ ok: boolean; items?: unknown[]; error?: string }>
  content(query: string, limit: number): Promise<{ ok: boolean; items?: unknown[]; error?: string; code?: string }>
}

const MAX_LINES = 40
const MAX_WIDTH = 100

export function clip(text: string, width = MAX_WIDTH): string {
  const value = String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+$/, '')
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}

export function renderLines(lines: string[], limit = MAX_LINES): string {
  const clipped = lines.map((line) => clip(line))
  if (clipped.length <= limit) return clipped.join('\n')
  const kept = clipped.slice(0, limit - 1)
  return [...kept, `… 还有 ${clipped.length - kept.length} 行，加 --all 查看`].join('\n')
}

const ok = (lines: string[]): CommandResult => ({ kind: 'success', text: renderLines(lines) })
const fail = (reason: string, next?: string): CommandResult =>
  ({ kind: 'error', text: renderLines([reason, ...(next ? [`  ${next}`] : [])]) })

function parse(rawInput: string): { words: string[]; json: boolean; content: boolean; all: boolean } {
  const words: string[] = []
  let json = false
  let content = false
  let all = false
  for (const token of String(rawInput ?? '').trim().split(/\s+/).filter(Boolean)) {
    if (token === '--json') json = true
    else if (token === '--content') content = true
    else if (token === '--title') { /* 标题模式是默认，显式接受该 flag */ }
    else if (token === '--all') all = true
    else if (!token.startsWith('--')) words.push(token)
  }
  return { words, json, content, all }
}

const HELP = [
  'sfind — 会话检索（标题 / 内容双模式）',
  '  /sfind               检索通道状态（DRS 可用性、会话数、是否在索引）',
  '  /sfind <q>           标题模式：按标题包含匹配',
  '  /sfind <q> --content 内容模式：FTS 命中（依 DRS 投影库）',
  '  flags                --json 单行 JSON；--all 取消行数截断',
]

function asHead(item: unknown): SessionHead | undefined {
  if (item === null || typeof item !== 'object') return undefined
  const row = item as Record<string, unknown>
  if (typeof row.sessionId !== 'string') return undefined
  return {
    sessionId: row.sessionId,
    title: typeof row.title === 'string' ? row.title : '',
    cwd: typeof row.cwd === 'string' ? row.cwd : '',
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : undefined,
  }
}

function hitText(item: unknown): { id: string; snippet: string } {
  const row = (item ?? {}) as ContentHit
  const id = typeof row.sessionId === 'string' ? row.sessionId : '(unknown)'
  const direct = typeof row.snippet === 'string' ? row.snippet : typeof row.excerpt === 'string' ? row.excerpt : ''
  const nested = Array.isArray(row.hits)
    ? row.hits.map((hit) => hit?.snippet ?? hit?.excerpt ?? hit?.text ?? '').filter(Boolean).join(' / ')
    : ''
  return { id, snippet: direct || nested }
}

function day(ms?: number): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—'
  return new Date(ms).toISOString().slice(0, 10)
}

/** 纯函数入口。 */
export async function runSfindCommand(rawInput: string, deps: SfindCommandDeps): Promise<CommandResult> {
  const { words, json, content, all } = parse(rawInput)
  const query = words.join(' ').trim()
  const limit = all ? 40 : 10

  const wrap = (result: CommandResult, data: unknown): CommandResult => {
    if (!json) return result
    const body = result.kind === 'error'
      ? { ok: false, cmd: 'sfind', error: { message: result.text.split('\n')[0] ?? result.text } }
      : { ok: true, cmd: 'sfind', data }
    return { kind: result.kind, text: JSON.stringify(body) }
  }

  if (query === '') {
    const status = await deps.status() as Record<string, unknown>
    const local = (status?.local ?? {}) as Record<string, unknown>
    return wrap(ok([
      `sfind — 通道 ${status?.available === true ? '可用' : '不可用'} (${String(status?.mode ?? 'none')})`,
      `  transport  ${String(status?.transport ?? 'auto')}`,
      `  sessions   ${String(local.sessions ?? '—')}  archived ${String(status?.archivedSessions ?? 0)}`,
      `  indexing   ${status?.indexing === true ? 'yes' : 'no'}`,
      `  reason     ${clip(String(status?.reason ?? '—'), 70)}`,
      '  use        /sfind <关键词>   或   /sfind <关键词> --content',
    ]), status)
  }

  if (query === 'help' || query === '?') return wrap(ok(HELP), { help: true })

  if (!content) {
    const listed = await deps.titles()
    if (!listed.ok) return wrap(fail(`sfind: 读取会话头失败：${listed.error ?? '未知原因'}`, 'next: /sfind 查看通道状态'), listed)
    const heads = (listed.items ?? []).map(asHead).filter((head): head is SessionHead => head !== undefined)
    const needle = query.toLowerCase()
    const matched = heads.filter((head) => (head.title ?? '').toLowerCase().includes(needle))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    if (matched.length === 0) {
      return wrap(ok([`sfind — 标题无命中："${query}"`, '  next 试 /sfind ' + query + ' --content']), { query, matched: 0 })
    }
    const lines = [`sfind — 标题命中 ${matched.length} 个（显示前 ${Math.min(limit, matched.length)}）`]
    for (const head of matched.slice(0, limit)) {
      lines.push(`  ${head.sessionId.slice(-8)}  ${day(head.updatedAt)}  ${clip(head.title || '(untitled)', 60)}`)
    }
    if (matched.length > limit) lines.push(`  … 还有 ${matched.length - limit} 个，加 --all 查看`)
    return wrap(ok(lines), { query, matched: matched.length, items: matched.slice(0, limit) })
  }

  const found = await deps.content(query, limit)
  if (!found.ok) {
    return wrap(fail(`sfind: 内容检索失败：${found.error ?? '未知原因'}`, `next: /sfind 检查 DRS 通道（code=${found.code ?? 'n/a'}）`), found)
  }
  const hits = (found.items ?? []).map(hitText)
  if (hits.length === 0) return wrap(ok([`sfind — 内容无命中："${query}"`]), { query, hits: 0 })
  const lines = [`sfind — 内容命中 ${hits.length} 个会话（显示前 ${Math.min(limit, hits.length)}）`]
  for (const hit of hits.slice(0, limit)) {
    lines.push(`  ${hit.id.slice(-8)}  ${clip(hit.snippet || '(无节选)', 66)}`)
  }
  if (hits.length > limit) lines.push(`  … 还有 ${hits.length - limit} 个，加 --all 查看`)
  return wrap(ok(lines), { query, hits: hits.length, items: hits.slice(0, limit) })
}

/** 注册 `/sfind`：无 commands 服务时静默跳过（老线安全）。 */
export function registerSfindCommand(ctx: Context, deps: SfindCommandDeps): void {
  const registry = (ctx as unknown as { commands?: { register(definition: unknown): unknown } }).commands
  if (!registry || typeof registry.register !== 'function') return
  registry.register({
    definitionId: 'dsh-search-index',
    name: 'sfind',
    description: 'Session search console: title mode (substring) / content mode (FTS via DRS)',
    input: { hint: '[<query>] [--title|--content] [--all] [--json]' },
    handler: (invocation: { rawInput?: string }) => runSfindCommand(invocation?.rawInput ?? '', deps),
  })
}
