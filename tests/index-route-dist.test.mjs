#!/usr/bin/env node
/**
 * 出厂产物（`lib/index.mjs`）路由级契约：与 `tests/index-route.test.mjs` 同场景，
 * 但装载的是**构建产物**而不是 TS 源码，用来证明：
 * - `apply()` 在打包后的 ESM 里仍能注册 `/switch-search/api` 路由；
 * - 动态 `import(DRS_SPECIFIER)` 在产物里仍指向 profile 依赖（没有被内联）；
 * - 桌面 403 → 内容检索降级命中、`search-status` 报 `mode:'in-process'`。
 *
 * Usage: node tests/index-route-dist.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dist = await import('../lib/index.mjs')
const drs = await import('dsh-reference-session-collector')

const DRS_DIR_ENV = 'DSH_REFERENCE_SESSION_COLLECTOR_DIR'

function seedDrs(dir) {
  const store = drs.openProjectionStore(dir)
  store.db.prepare('INSERT INTO blocks(hash, body, bytes) VALUES(?,?,?)')
    .run('h1', 'dist apple pie notes', 20)
  store.db.prepare(`INSERT INTO sessions(session_id, dir_id, title, cwd, event_count, max_seq, last_time_ms, archived)
                    VALUES(?,?,?,?,?,?,?,?)`)
    .run('d1', 'dd', 'Dist session', 'E:/w', 4, 2, 1_700_000_000_000, 0)
  store.db.prepare(`INSERT INTO segments(session_id, seq, kind, time, search_text_hash, on_surface)
                    VALUES(?,?,?,?,?,?)`)
    .run('d1', 2, 'assistant/message', 1_699_999_000_000, 'h1', 1)
  store.db.prepare('INSERT INTO segments_fts(index_text, session_id, seq, kind) VALUES(?,?,?,?)')
    .run('dist apple pie notes', 'd1', 2, 'assistant/message')
  store.db.prepare("INSERT INTO meta(key, value) VALUES('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(drs.PROJECTION_SCHEMA_VERSION)
  store.close()
}

function bootHost(entry) {
  const routes = []
  const disposers = []
  const ctx = {
    webServer: { register(route) { routes.push(route); return () => {} } },
    webStartup: { trustedHosts: ['127.0.0.1:9999'] },
    get: (name) => (name === 'sessionQuery'
      ? { listSessions: async () => [], readSession: async () => { throw new Error('x') }, readTitleSnapshots: async () => new Map() }
      : undefined),
    effect(fn) {
      const disposer = fn()
      disposers.push(typeof disposer === 'function' ? disposer : () => {})
      return () => {}
    },
    logger: { info: () => {} },
  }
  dist.apply(ctx, entry)
  return { route: routes[0], close() { for (const d of disposers) { try { d() } catch { /* noop */ } } } }
}

function callRoute(route, method, body) {
  return new Promise((resolve, reject) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))])
    req.method = 'POST'
    req.url = `/switch-search/api/${method}`
    req.headers = { host: '127.0.0.1:9999', 'content-type': 'application/json' }
    const res = { writeHead(code) { this.statusCode = code }, end(text) { resolve({ status: this.statusCode, body: JSON.parse(text) }) } }
    Promise.resolve(route.handler(req, res)).catch(reject)
  })
}

test('lib/index.mjs：桌面 403 下内容检索降级命中 + search-status 报 in-process', async () => {
  const root = mkdtempSync(join(tmpdir(), 'switch-dist-'))
  const drsDir = join(root, 'drs')
  seedDrs(drsDir)
  const before = process.env[DRS_DIR_ENV]
  process.env[DRS_DIR_ENV] = drsDir
  const originalFetch = globalThis.fetch
  let httpCalls = 0
  globalThis.fetch = async () => { httpCalls += 1; return { ok: false, status: 403, json: async () => ({}) } }
  const host = bootHost({ indexDir: join(root, 'index'), autoSync: false, syncIntervalMs: 0, enabled: true })
  try {
    assert.ok(host.route, 'lib/index.mjs 的 apply() 必须注册路由')
    const status = await callRoute(host.route, 'search-status', {})
    assert.equal(status.body.mode, 'in-process')
    assert.equal(status.body.transport, 'auto')
    const search = await callRoute(host.route, 'content-search', { query: 'apple' })
    assert.equal(search.body.ok, true, JSON.stringify(search.body))
    assert.equal(search.body.items.length, 1)
    assert.equal(search.body.items[0].sessionId, 'd1')
    assert.match(search.body.items[0].snippet, /apple/u)
    assert.ok(httpCalls >= 2, '应各尝试一次 HTTP（status + search）后才降级')
  } finally {
    globalThis.fetch = originalFetch
    host.close()
    if (before === undefined) delete process.env[DRS_DIR_ENV]
    else process.env[DRS_DIR_ENV] = before
    rmSync(root, { recursive: true, force: true })
  }
})

console.log('index-route-dist: ok (1 dist case)')
