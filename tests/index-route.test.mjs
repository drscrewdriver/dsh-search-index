#!/usr/bin/env node
/**
 * 端到端（插件半 + 真实路由 + 真实 DRSC 投影库）契约：
 * 用一个最小 fake host 装载 `apply()`，直接调 `/switch-search/api/*` 处理函数，
 * 断言桌面版现场（宿主对非 renderer 请求回 403）下：
 * - `content-search` 自动降级进程内只读臂并返回命中（issue #1 的核心修复）；
 * - `search-status` 如实报 `mode: 'in-process'` / `transport: 'auto'`；
 * - `contentTransport: 'http'` 仍可复现旧行为（code=browser-access-denied）；
 * - `contentTransport: 'in-process'` 一次 HTTP 都不发。
 *
 * fake host 只实现 apply() 真正用到的那几个面（webServer/webStartup/get/effect/logger），
 * 其余插件代码路径与线上一致——这是"路由层"而非"臂层"的证据。
 *
 * Usage: node --import tsx tests/index-route.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const searchIndex = await import('../src/index.ts')
const drs = await import('dsh-reference-session-collector')
const { DRS_DIR_ENV } = await import('../src/host/index/drs-local.ts')

/** 与线上 profile 同构的 sessionQuery 极简桩（本组用例只走内容检索面）。 */
const sessionQueryStub = {
  listSessions: async () => [],
  readSession: async () => { throw new Error('not needed') },
  readTitleSnapshots: async () => new Map(),
}

/** 装一个最小 host：捕获路由与 effect 释放器。 */
function bootHost(entry) {
  const routes = []
  const disposers = []
  const ctx = {
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    webStartup: { trustedHosts: ['127.0.0.1:9999'] },
    get(name) {
      return name === 'sessionQuery' ? sessionQueryStub : undefined
    },
    effect(fn) {
      const disposer = fn()
      disposers.push(typeof disposer === 'function' ? disposer : () => {})
      return () => {}
    },
    logger: { info: () => {} },
  }
  searchIndex.apply(ctx, entry)
  return {
    route: routes[0],
    close() {
      for (const dispose of disposers) {
        try { dispose() } catch { /* 清理失败不影响断言 */ }
      }
    },
  }
}

/** POST 一条 fenced 方法（含 body 流与假 res）。 */
function callRoute(route, method, body, host = '127.0.0.1:9999') {
  return new Promise((resolve, reject) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))])
    req.method = 'POST'
    req.url = `/switch-search/api/${method}`
    req.headers = { host, 'content-type': 'application/json' }
    const res = {
      statusCode: 0,
      writeHead(code) { this.statusCode = code },
      end(text) { resolve({ status: this.statusCode, body: JSON.parse(text) }) },
    }
    Promise.resolve(route.handler(req, res)).catch(reject)
  })
}

/** 造一个可检索的 v5 投影库（写面仅测试使用）。 */
function seedDrs(dir) {
  const store = drs.openProjectionStore(dir)
  store.db.prepare('INSERT INTO blocks(hash, body, bytes) VALUES(?,?,?)')
    .run('h1', 'we discussed pineapple pricing', 30)
  store.db.prepare(`INSERT INTO sessions(session_id, dir_id, title, cwd, event_count, max_seq, last_time_ms, archived)
                    VALUES(?,?,?,?,?,?,?,?)`)
    .run('s1', 'd1', 'Pineapple talk', 'E:/w', 10, 3, 1_700_000_000_000, 0)
  store.db.prepare(`INSERT INTO segments(session_id, seq, kind, time, search_text_hash, on_surface)
                    VALUES(?,?,?,?,?,?)`)
    .run('s1', 3, 'user/message', 1_699_999_000_000, 'h1', 1)
  store.db.prepare('INSERT INTO segments_fts(index_text, session_id, seq, kind) VALUES(?,?,?,?)')
    .run('pineapple pricing', 's1', 3, 'user/message')
  store.db.prepare("INSERT INTO meta(key, value) VALUES('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(drs.PROJECTION_SCHEMA_VERSION)
  store.close()
}

/** 桌面版现场：宿主 web 层对非 renderer 请求一律 403。 */
function installDesktopFetch() {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return { ok: false, status: 403, json: async () => ({}) }
  }
  return {
    get calls() { return calls },
    restore() { globalThis.fetch = original },
  }
}

/** DRSC 插件未激活现场：路由没挂 → 404（包随 search-index 落地但不跑）。 */
function installNotFoundFetch() {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return { ok: false, status: 404, json: async () => ({}) }
  }
  return {
    get calls() { return calls },
    restore() { globalThis.fetch = original },
  }
}

async function withTempDrs(run) {
  const root = mkdtempSync(join(tmpdir(), 'switch-route-'))
  const drsDir = join(root, 'drs')
  const indexDir = join(root, 'index')
  seedDrs(drsDir)
  const before = process.env[DRS_DIR_ENV]
  process.env[DRS_DIR_ENV] = drsDir
  try {
    // 必须 await：`return run(...)` 会让 finally 在 promise 落定前就恢复 env，
    // 导致臂拿到宿主机真实库（实测踩过：sessions=93 而非夹具的 1）。
    return await run({ drsDir, indexDir })
  } finally {
    if (before === undefined) delete process.env[DRS_DIR_ENV]
    else process.env[DRS_DIR_ENV] = before
    rmSync(root, { recursive: true, force: true })
  }
}

const entryFor = (indexDir, extra = {}) => ({
  indexDir,
  autoSync: false,
  syncIntervalMs: 0,
  enabled: true,
  ...extra,
})

test('桌面 403 → content-search 路由降级进程内并返回命中（issue #1 复现场景）', async () => {
  await withTempDrs(async ({ indexDir }) => {
    const fetchStub = installDesktopFetch()
    const host = bootHost(entryFor(indexDir))
    try {
      const res = await callRoute(host.route, 'content-search', { query: 'pineapple', limit: 5 })
      assert.equal(res.status, 200)
      assert.equal(res.body.ok, true, `期望命中，实际：${JSON.stringify(res.body)}`)
      assert.equal(res.body.items.length, 1)
      assert.equal(res.body.items[0].sessionId, 's1')
      assert.match(res.body.items[0].snippet, /pineapple/u)
      assert.ok(fetchStub.calls >= 1, '应至少尝试一次 HTTP 才会降级')
    } finally {
      fetchStub.restore()
      host.close()
    }
  })
})

test('search-status 如实报 mode=in-process / transport=auto / 库明细', async () => {
  await withTempDrs(async ({ indexDir, drsDir }) => {
    const fetchStub = installDesktopFetch()
    const host = bootHost(entryFor(indexDir))
    try {
      const res = await callRoute(host.route, 'search-status', {})
      assert.equal(res.body.available, true)
      assert.equal(res.body.mode, 'in-process')
      assert.equal(res.body.transport, 'auto')
      assert.equal(res.body.local.sessions, 1)
      assert.equal(res.body.local.dir, drsDir)
      assert.equal(res.body.local.schemaVersion, drs.PROJECTION_SCHEMA_VERSION)
    } finally {
      fetchStub.restore()
      host.close()
    }
  })
})

test('contentTransport=http：仍复现旧行为（code=browser-access-denied，提示不含"安装"）', async () => {
  await withTempDrs(async ({ indexDir }) => {
    const fetchStub = installDesktopFetch()
    const host = bootHost(entryFor(indexDir, { contentTransport: 'http' }))
    try {
      const res = await callRoute(host.route, 'content-search', { query: 'pineapple' })
      assert.equal(res.body.ok, false)
      assert.equal(res.body.code, 'browser-access-denied')
      assert.equal(res.body.items, undefined)
      assert.doesNotMatch(res.body.error, /安装|reinstall/u, '403 不得被说成"没装依赖"')
    } finally {
      fetchStub.restore()
      host.close()
    }
  })
})

test('contentTransport=in-process：路由层零 HTTP 调用', async () => {
  await withTempDrs(async ({ indexDir }) => {
    const fetchStub = installDesktopFetch()
    const host = bootHost(entryFor(indexDir, { contentTransport: 'in-process' }))
    try {
      const status = await callRoute(host.route, 'search-status', {})
      assert.equal(status.body.mode, 'in-process')
      assert.equal(status.body.transport, 'in-process')
      const res = await callRoute(host.route, 'content-search', { query: 'pineapple' })
      assert.equal(res.body.ok, true)
      assert.equal(fetchStub.calls, 0, 'in-process 档不得发起 HTTP')
    } finally {
      fetchStub.restore()
      host.close()
    }
  })
})

test('DRSC 未激活（路由 404）：search-status 报 notActivated=true，content-search 仍可用', async () => {
  await withTempDrs(async ({ indexDir }) => {
    const fetchStub = installNotFoundFetch()
    const host = bootHost(entryFor(indexDir))
    try {
      const status = await callRoute(host.route, 'search-status', {})
      assert.equal(status.body.available, true)
      assert.equal(status.body.mode, 'in-process')
      assert.equal(status.body.notActivated, true, '接穗成功也要如实标记未激活')
      const res = await callRoute(host.route, 'content-search', { query: 'pineapple', limit: 5 })
      assert.equal(res.body.ok, true)
      assert.equal(res.body.items.length, 1)
      assert.ok(fetchStub.calls >= 1, '应先尝试 HTTP 拿 404 再降级')
    } finally {
      fetchStub.restore()
      host.close()
    }
  })
})

test('DRSC 未激活（404）+ 进程内不可用：search-status 标 notActivated，content-search 报库缺失档位', async () => {
  const root = mkdtempSync(join(tmpdir(), 'switch-404-'))
  const indexDir = join(root, 'index')
  const before = process.env[DRS_DIR_ENV]
  // 指向空目录 → 进程内臂 drs-empty；HTTP 臂 404 → 合并后 reason 取进程内档位。
  process.env[DRS_DIR_ENV] = join(root, 'nope')
  const fetchStub = installNotFoundFetch()
  const host = bootHost(entryFor(indexDir))
  try {
    const status = await callRoute(host.route, 'search-status', {})
    assert.equal(status.body.available, false)
    assert.equal(status.body.mode, 'none')
    assert.equal(status.body.notActivated, true)
    const res = await callRoute(host.route, 'content-search', { query: 'pineapple' })
    assert.equal(res.body.ok, false)
    assert.equal(res.body.code, 'drs-empty')
  } finally {
    fetchStub.restore()
    host.close()
    if (before === undefined) delete process.env[DRS_DIR_ENV]
    else process.env[DRS_DIR_ENV] = before
    rmSync(root, { recursive: true, force: true })
  }
})

console.log('index-route: ok (6 route-level cases)')
