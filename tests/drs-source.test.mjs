#!/usr/bin/env node
/**
 * DRS 直连臂（硬依赖）契约：wire 映射 / 失败显式抛出 / probe 只回布尔 /
 * 深度同步的 POST `?op=sync` 契约（op 走 query，body 仅兼容）。
 *
 * 这三条决定「DRS 不可达时是显式报错而不是静默空列表」——拆回 search-index 后
 * 内容检索的唯一来源就是它。
 *
 * Usage: node --import tsx tests/drs-source.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DrsCorpusSource, resolveDrsBaseUrl } from '../src/host/index/drs-source.ts'

const silentLog = () => {}

test('resolveDrsBaseUrl: 显式配置 > 首个 trustedHosts > 8080 缺省', () => {
  assert.equal(resolveDrsBaseUrl(undefined, undefined), 'http://127.0.0.1:8080')
  assert.equal(resolveDrsBaseUrl('', ['dsh.local:9000']), 'http://dsh.local:9000')
  assert.equal(resolveDrsBaseUrl('http://drs.local:7000', ['dsh.local:9000']), 'http://drs.local:7000')
  assert.equal(resolveDrsBaseUrl('http://already.local', undefined), 'http://already.local')
})

test('searchGrouped: wire → 引擎命中形状（snake_case 映射）', async () => {
  const seen = []
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: async (url) => {
      seen.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          hits: [
            { session_id: 's1', title: '标题一', seq: 7, type: 'user/message', time: 111, updated_at: 222, snippet: '节选…' },
          ],
        }),
      }
    },
  })
  const hits = await source.searchGrouped({ query: '火龙果', archived: 'active', sortBy: 'time', limit: 5, expand: true })
  assert.equal(hits.length, 1)
  assert.deepEqual(hits[0], {
    sessionId: 's1', title: '标题一', seq: 7, type: 'user/message', time: 111, updatedAt: 222, snippet: '节选…',
  })
  const url = seen[0]
  assert.ok(url.includes('op=search') && url.includes('group=session'), 'wire 必须带 op/group')
  assert.ok(url.includes('q=%E7%81%AB%E9%BE%99%E6%9E%9C') || url.includes('q='), 'query 必须进 wire')
  assert.ok(url.includes('archived=active'))
  assert.ok(url.includes('sort=time'))
  assert.ok(url.includes('expand=1'))
})

test('searchGrouped: 非 2xx 直抛（硬依赖语义，绝不静默空列表）', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  })
  await assert.rejects(() => source.searchGrouped({ query: 'x' }), /503|DRS|失败|不可用/)
})

test('probe: DRS up → true；down/异常 → false（不抛）', async () => {
  const up = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
  })
  assert.equal(await up.probe(), true)
  const down = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: async () => { throw new Error('ECONNREFUSED') },
  })
  assert.equal(await down.probe(), false)
})

test('triggerSync: POST 必须把 op 放 query（DRS 只读 searchParams，落 body 会 400）', async () => {
  const seen = []
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: async (url, init) => {
      seen.push({ url: String(url), method: init?.method, body: String(init?.body ?? '') })
      return { ok: true, status: 200, json: async () => ({ ok: true, accepted: true }) }
    },
  })
  assert.deepEqual(await source.triggerSync(), { ok: true })
  assert.equal(seen.length, 1)
  assert.ok(seen[0].url.endsWith('/api/dsh-reference-session-collector?op=sync'), `wire 必须带 ?op=sync，实际 ${seen[0].url}`)
  assert.equal(seen[0].method, 'POST')
  assert.equal(seen[0].body, JSON.stringify({ op: 'sync' }), 'body 仍保留 op（兼容旧只读体版本）')
})

test('triggerSync: 400 → {ok:false,error}（不抛，由深度同步状态面显式失败）', async () => {
  const source = new DrsCorpusSource({
    baseUrl: 'http://127.0.0.1:8080',
    log: silentLog,
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ ok: false, error: 'unknown POST op: (missing)' }) }),
  })
  const r = await source.triggerSync()
  assert.equal(r.ok, false)
  assert.match(r.error, /400/)
})

console.log('drs-source: ok (6 contract cases)')
