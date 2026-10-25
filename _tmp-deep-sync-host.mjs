import { readFileSync, writeFileSync } from 'node:fs'

// ── 1. drs-source：POST {op:'sync'} 触发 + statusDetail ───────────────────
let drs = readFileSync('src/host/index/drs-source.ts', 'utf8')
const DNL = drs.includes('\r\n') ? '\r\n' : '\n'
if (!drs.includes('triggerSync')) {
  const anchor = '  /** 可性探针（op=status）：硬依赖预检/降级提示用；失败返回 false。 */'
  if (!drs.includes(anchor)) throw new Error('drs probe anchor missing')
  const add = [
    '  /**',
    '   * 触发 DRS 后台同步（POST {op:\'sync\'}）：慢速全扫，用于修复投影库自身的滞后。',
    '   * 与 op=status 的 last_sync.busy 配合轮询。',
    '   * @param atHost - 同源 Host 覆盖。',
    '   */',
    '  async triggerSync(atHost?: string): Promise<{ ok: boolean; error?: string }> {',
    '    const source = atHost !== undefined && atHost !== \'\' ? `http://${atHost}` : this.options.baseUrl',
    '    const url = `${source.replace(/\\/+$/u, \'\')}${DRS_API_PATH}`',
    '    let response: Awaited<ReturnType<typeof this.fetchImpl>>',
    '    try {',
    '      response = await this.fetchImpl(url, {',
    '        method: \'POST\',',
    '        headers: {',
    '          \'content-type\': \'application/json\',',
    '          accept: \'application/json\',',
    '          ...(this.options.hostHeader === undefined ? {} : { host: this.options.hostHeader }),',
    '        },',
    '        body: JSON.stringify({ op: \'sync\' }),',
    '      })',
    '    } catch (err) {',
    '      return { ok: false, error: String(err instanceof Error ? err.message : err) }',
    '    }',
    '    if (!response.ok) return { ok: false, error: `HTTP ${String(response.status)}` }',
    '    try {',
    '      const body = await response.json() as Record<string, unknown>',
    '      return body[\'ok\'] === true ? { ok: true } : { ok: false, error: String(body[\'error\'] ?? \'ok=false\') }',
    '    } catch {',
    '      return { ok: true }',
    '    }',
    '  }',
    '',
    '  /** DRS 状态明细（op=status 原始体；失败返回 undefined）。 */',
    '  async statusDetail(atHost?: string): Promise<Record<string, unknown> | undefined> {',
    '    try {',
    '      return await this.getJson(\'?op=status\', atHost)',
    '    } catch {',
    '      return undefined',
    '    }',
    '  }',
    '',
  ].join(DNL)
  drs = drs.replace(anchor, add + anchor)
  writeFileSync('src/host/index/drs-source.ts', drs, 'utf8')
  console.log('drs-source: triggerSync/statusDetail added')
}

// ── 2. index.ts：deepSync 状态 + index-deep-sync 方法 + 路由 ─────────────
let idx = readFileSync('src/index.ts', 'utf8')
const INL = idx.includes('\r\n') ? '\r\n' : '\n'
const line = (s) => s.split('\n').join(INL)

// 2a) 状态字段
const stateAnchor = line('  /** Official archive-set reader (registry first, storage-hub file fallback). */\n  archiveReader: ReturnType<typeof createArchiveSource>\n}')
if (!idx.includes(stateAnchor)) throw new Error('index state anchor missing')
idx = idx.replace(stateAnchor, line([
  '  /** Official archive-set reader (registry first, storage-hub file fallback). */',
  '  archiveReader: ReturnType<typeof createArchiveSource>',
  '  /** 深度同步（DRS 慢速重建 → 本地索引重建）的可见状态。 */',
  "  deepSync: { state: 'idle' | 'drs-syncing' | 'rebuilding' | 'done' | 'failed'; startedAt?: number; finishedAt?: number; error?: string }",
  '}',
].join('\n')))

// 2b) apply 初始化
const initAnchor = line("    rebuild: { state: 'idle', done: 0, total: 0, startedAt: 0, finishedAt: 0, failures: [] },\n  }")
if (!idx.includes(initAnchor)) throw new Error('index state init anchor missing')
idx = idx.replace(initAnchor, line([
  "    rebuild: { state: 'idle', done: 0, total: 0, startedAt: 0, finishedAt: 0, failures: [] },",
  "    deepSync: { state: 'idle' },",
  '  }',
].join('\n')))

// 2c) index-status 暴露 deepSync
idx = idx.replace(line('    rebuild: index.rebuild,\n  }\n}'), line([
  '    rebuild: index.rebuild,',
  '    deepSync: index.deepSync,',
  '  }',
  '}',
].join('\n')))

// 2d) 新方法：indexDeepSync（放在 indexRebuild 之后）
const deepFn = line([
  '/**',
  " * index-deep-sync：**深度同步**按钮的后端。",
  " * 1) 触发 DRS 后台慢速同步（POST {op:'sync'}），轮询 op=status 直到 last_sync.busy=false；",
  ' * 2) 再跑本地索引的非破坏性重建（整理），让标题/头部面跟上最新语料。',
  ' * 全程后台执行，进度经 index-status 的 deepSync 面暴露；并发调用直接拒绝。',
  ' * @param runtime - 运行时依赖。',
  ' * @param requestHost - 调用方 Host（同源直连 DRS，端口动态分配）。',
  ' */',
  'async function indexDeepSync(',
  '  runtime: SwitchRuntime,',
  "  requestHost = '',",
  '): Promise<{ ok: boolean; started?: boolean; error?: string }> {',
  '  const index = runtime.index',
  "  if (index.deepSync.state === 'drs-syncing' || index.deepSync.state === 'rebuilding') {",
  "    return { ok: false, error: '深度同步已在进行中' }",
  '  }',
  '  const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms) })',
  "  index.deepSync = { state: 'drs-syncing', startedAt: Date.now() }",
  '  void (async () => {',
  '    try {',
  '      const trigger = await runtime.drsSource.triggerSync(requestHost)',
  "      if (!trigger.ok) throw new Error(`触发 DRS 同步失败：${trigger.error ?? 'unknown'}`)",
  '      const deadline = Date.now() + 180_000',
  '      while (Date.now() < deadline) {',
  '        await sleepMs(2000)',
  '        const detail = await runtime.drsSource.statusDetail(requestHost)',
  '        const lastSync = detail?.[\'last_sync\'] as { busy?: unknown } | undefined',
  '        if (lastSync !== undefined && lastSync.busy === false) break',
  '      }',
  "      index.deepSync = { state: 'rebuilding', startedAt: index.deepSync.startedAt }",
  '      const started = await indexRebuild(runtime)',
  "      if (!started.ok) throw new Error(started.error ?? '本地索引重建未能启动')",
  "      while (index.rebuild.state === 'building' || index.rebuild.state === 'swapping') await sleepMs(1500)",
  "      index.deepSync = { state: 'done', startedAt: index.deepSync.startedAt, finishedAt: Date.now() }",
  '    } catch (err) {',
  '      index.deepSync = {',
  "        state: 'failed',",
  '        startedAt: index.deepSync.startedAt,',
  '        finishedAt: Date.now(),',
  '        error: String(err instanceof Error ? err.message : err),',
  '      }',
  '    }',
  '  })()',
  '  return { ok: true, started: true }',
  '}',
  '',
].join('\n'))
const rebuildEndAnchor = line("  return { ok: true, started: true }\n}\n")
const firstAt = idx.indexOf(rebuildEndAnchor)
if (firstAt < 0) throw new Error('indexRebuild tail anchor missing')
idx = idx.slice(0, firstAt + rebuildEndAnchor.length) + INL + deepFn + idx.slice(firstAt + rebuildEndAnchor.length)

// 2e) 路由
const routeAnchor = line("        if (method === 'index-rebuild') {\n          writeJson(res, 200, await indexRebuild(runtime))\n          return\n        }")
if (!idx.includes(routeAnchor)) throw new Error('route rebuild anchor missing')
idx = idx.replace(routeAnchor, line([
  "        if (method === 'index-rebuild') {",
  '          writeJson(res, 200, await indexRebuild(runtime))',
  '          return',
  '        }',
  "        if (method === 'index-deep-sync') {",
  "          // 深度同步：先让 DRS 慢扫修好自己的投影库，再把本地索引整理一遍（同源 Host 透传）。",
  "          writeJson(res, 200, await indexDeepSync(runtime, String(req.headers.host ?? '')))",
  '          return',
  '        }',
].join('\n')))

writeFileSync('src/index.ts', idx, 'utf8')
console.log('index.ts: deepSync state + index-deep-sync + route added')
