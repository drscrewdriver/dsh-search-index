#!/usr/bin/env node
/**
 * 通道分派契约（`drs-source.ts`）：
 * - `auto`（缺省）= HTTP 优先，失败（403 / 不可达 / DRS 报错）降级进程内只读臂；
 * - `http` = 强制 HTTP，失败直抛（老行为，便于排查）；
 * - `in-process` = 不发任何 HTTP，直接走进程内臂；
 * - 未装配进程内臂时保持旧语义（403 直抛，不静默空列表）。
 *
 * 这一组断言的用途：桌面版 DSH NEXT 的 403 必须变成"换通道继续可用"，
 * 而不是"报错让用户去重装依赖"。
 *
 * Usage: node --import tsx tests/drs-transport.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { DrsCorpusSource } = await import('../src/host/index/drs-source.ts')
const { DrsUnavailableError } = await import('../src/host/index/drs-contract.ts')

const silentLog = () => {}

const HITS_HTTP = [{
  sessionId: 'http-s1', title: 'HTTP', seq: 1, type: 'user/message', time: 10, updatedAt: 20, snippet: 'h',
}]
const HITS_LOCAL = [{
  sessionId: 'local-s1', title: 'LOCAL', seq: 2, type: 'user/message', time: 11, updatedAt: 21, snippet: 'l',
}]

/** 桌面版 403 现场（`Browser access is disabled`）。 */
const deniedFetch = async () => ({ ok: false, status: 403, json: async () => ({}) })
/** DRSC 插件未激活现场：包随本插件落地但路由没挂 → 404。 */
const notFoundFetch = async () => ({ ok: false, status: 404, json: async () => ({}) })
const okFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, hits: HITS_HTTP.map(row => ({
    session_id: row.sessionId, title: row.title, seq: row.seq, type: row.type,
    time: row.time, updated_at: row.updatedAt, snippet: row.snippet,
  })) }),
})

function localArm(overrides = {}) {
  return {
    probe: async () => ({ ok: true, schemaVersion: '5', expected: '5', sessions: 3, dir: 'E:/drs' }),
    searchGrouped: async () => HITS_LOCAL,
    dispose: () => {},
    ...overrides,
  }
}

test('auto: HTTP 403 → 降级进程内臂（桌面版现场）', async () => {
  const logs = []
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: (m) => logs.push(m),
    fetchImpl: deniedFetch,
    transport: () => 'auto',
    inProcess: () => localArm(),
  })
  assert.deepEqual(await source.searchGrouped({ query: 'x' }), HITS_LOCAL)
  assert.ok(logs.some(line => line.includes('browser-access-denied')), `降级必须留痕，实际：${logs.join(' | ')}`)
})

test('http: 强制 HTTP，403 直抛且 code=browser-access-denied', async () => {
  let localCalls = 0
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: deniedFetch,
    transport: () => 'http',
    inProcess: () => localArm({ searchGrouped: async () => { localCalls += 1; return HITS_LOCAL } }),
  })
  await assert.rejects(
    () => source.searchGrouped({ query: 'x' }),
    (err) => err instanceof DrsUnavailableError && err.code === 'browser-access-denied',
  )
  assert.equal(localCalls, 0, 'http 档不得偷偷降级')
})

test('未装配进程内臂：保持旧语义（403 直抛，不静默空列表）', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: deniedFetch,
  })
  await assert.rejects(
    () => source.searchGrouped({ query: 'x' }),
    (err) => err instanceof DrsUnavailableError && err.code === 'browser-access-denied',
  )
})

test('auto: HTTP 成功时不碰进程内臂', async () => {
  let localCalls = 0
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: okFetch,
    transport: () => 'auto',
    inProcess: () => localArm({ searchGrouped: async () => { localCalls += 1; return HITS_LOCAL } }),
  })
  const hits = await source.searchGrouped({ query: 'x' })
  assert.deepEqual(hits, HITS_HTTP)
  assert.equal(localCalls, 0)
})

test('in-process: 完全不发 HTTP', async () => {
  let fetches = 0
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: async () => { fetches += 1; return okFetch() },
    transport: () => 'in-process',
    inProcess: () => localArm(),
  })
  assert.deepEqual(await source.searchGrouped({ query: 'x' }), HITS_LOCAL)
  assert.equal(fetches, 0)
})

test('auto: 进程内也失败 → 抛出其档位码（不被吞掉）', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: deniedFetch,
    transport: () => 'auto',
    inProcess: () => localArm({
      searchGrouped: async () => { throw new DrsUnavailableError('drs-schema-mismatch', 'db=4 pkg=5') },
    }),
  })
  await assert.rejects(
    () => source.searchGrouped({ query: 'x' }),
    (err) => err instanceof DrsUnavailableError && err.code === 'drs-schema-mismatch',
  )
})

test('probeDetail: 403 + 进程内可用 → ok:true / mode:in-process', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: deniedFetch,
    transport: () => 'auto',
    inProcess: () => localArm(),
  })
  const probe = await source.probeDetail()
  assert.equal(probe.ok, true)
  assert.equal(probe.mode, 'in-process')
  assert.equal(probe.schemaVersion, '5')
  assert.equal(await source.probe(), true, '布尔探针保持向后兼容')
})

test('probeDetail: HTTP 通 → mode:http；两臂皆失败 → mode:none + 原因', async () => {
  const up = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: okFetch,
    transport: () => 'auto',
    inProcess: () => localArm(),
  })
  assert.equal((await up.probeDetail()).mode, 'http')

  const down = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: deniedFetch,
    transport: () => 'auto',
    inProcess: () => localArm({ probe: async () => ({ ok: false, reason: 'drs-empty', detail: '未找到投影库' }) }),
  })
  const probe = await down.probeDetail()
  assert.equal(probe.ok, false)
  assert.equal(probe.mode, 'none')
  assert.equal(probe.reason, 'drs-empty')
})

test('probeDetail: 404 + 进程内可用 → ok:true / mode:in-process / notActivated:true', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: notFoundFetch,
    transport: () => 'auto',
    inProcess: () => localArm(),
  })
  const probe = await source.probeDetail()
  assert.equal(probe.ok, true)
  assert.equal(probe.mode, 'in-process')
  assert.equal(probe.notActivated, true, '接穗成功也要如实标记未激活（投影库不会自动更新）')
})

test('probeDetail: 404 + 进程内不可用 → mode:none，reason 用进程内档位且仍标 notActivated', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: notFoundFetch,
    transport: () => 'auto',
    inProcess: () => localArm({ probe: async () => ({ ok: false, reason: 'drs-empty', detail: '未找到投影库' }) }),
  })
  const probe = await source.probeDetail()
  assert.equal(probe.ok, false)
  assert.equal(probe.mode, 'none')
  // 进程内探针自己的档位（drs-empty）优先；notActivated 作为附加标记仍要透出。
  assert.equal(probe.reason, 'drs-empty')
  assert.equal(probe.notActivated, true)
})

test('auto: 404 → 降级进程内命中，档位码为 drs-not-activated', async () => {
  const logs = []
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: (m) => logs.push(m),
    fetchImpl: notFoundFetch,
    transport: () => 'auto',
    inProcess: () => localArm(),
  })
  assert.deepEqual(await source.searchGrouped({ query: 'x' }), HITS_LOCAL)
  assert.ok(logs.some(line => line.includes('drs-not-activated')), `降级留痕需带未激活码，实际：${logs.join(' | ')}`)
})

test('http 档：404 直抛 drs-not-activated（不静默）', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: notFoundFetch,
    transport: () => 'http',
    inProcess: () => localArm(),
  })
  await assert.rejects(
    () => source.searchGrouped({ query: 'x' }),
    (err) => err instanceof DrsUnavailableError && err.code === 'drs-not-activated',
  )
})

console.log('drs-transport: ok (12 dispatch cases)')
