import { describe, it, expect } from 'vitest'
import { runSfindCommand, type SfindCommandDeps } from '../src/tui-command.ts'

function deps(overrides: Partial<SfindCommandDeps> = {}): SfindCommandDeps {
  return {
    status: async () => ({
      ok: true,
      available: true,
      mode: 'in-process',
      transport: 'auto',
      local: { sessions: 42 },
      archivedSessions: 3,
      indexing: false,
      reason: 'ok',
    }),
    titles: async () => ({
      ok: true,
      items: [
        { sessionId: 'session-aaaa1111', title: 'CDP 改造', cwd: 'E:/w', updatedAt: Date.UTC(2026, 10, 1) },
        { sessionId: 'session-bbbb2222', title: '无关会话', cwd: 'E:/w', updatedAt: Date.UTC(2026, 9, 1) },
      ],
    }),
    content: async () => ({
      ok: true,
      items: [{ sessionId: 'session-aaaa1111', hits: [{ snippet: '…dsh-tui 的 notice…' }] }],
    }),
    ...overrides,
  }
}

describe('/sfind command', () => {
  it('空参数给通道状态', async () => {
    const result = await runSfindCommand('', deps())
    expect(result.text).toContain('sfind — 通道 可用')
    expect(result.text).toContain('sessions   42')
  })

  it('标题模式按包含匹配并给出短 id', async () => {
    const result = await runSfindCommand('CDP', deps())
    expect(result.text).toContain('标题命中 1 个')
    expect(result.text).toContain('aa1111')
  })

  it('标题无命中时提示转内容模式', async () => {
    const result = await runSfindCommand('zzz', deps())
    expect(result.text).toContain('标题无命中')
    expect(result.text).toContain('--content')
  })

  it('内容模式渲染节选', async () => {
    const result = await runSfindCommand('notice --content', deps())
    expect(result.text).toContain('内容命中 1 个')
    expect(result.text).toContain('notice')
  })

  it('内容模式失败时带 DRS code', async () => {
    const broken = deps({ content: async () => ({ ok: false, error: 'DRS 不可达', code: 'drs-unreachable' }) })
    const result = await runSfindCommand('x --content', broken)
    expect(result.kind).toBe('error')
    expect(result.text).toContain('drs-unreachable')
  })

  it('--json 单行', async () => {
    const result = await runSfindCommand('CDP --json', deps())
    expect(result.text.includes('\n')).toBe(false)
    expect(JSON.parse(result.text).data.matched).toBe(1)
  })
})
