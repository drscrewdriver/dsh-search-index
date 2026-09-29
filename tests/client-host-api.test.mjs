#!/usr/bin/env node
/**
 * The client→host bridge never turns a transport failure into a hang or a
 * lying success.
 *
 * What it proves (fetch is stubbed, no server involved):
 * - A well-formed `{ ok: true, items }` record resolves with the items.
 * - An HTTP error status and a malformed record both resolve as
 *   `{ ok: false }` with an error string — they never throw, never resolve
 *   as ok with garbage items.
 * - A timeout abort resolves as `{ ok: false }` with the timeout message,
 *   and the timer does not leak (the fetch rejection is swallowed).
 * - The request goes to the fenced `/switch-search/api` route with a JSON
 *   body; `callHostAny` can ship a raw string body untouched.
 *
 * Usage: node --import tsx tests/client-host-api.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { callHost, callHostAny } = await import('../src/client/host-api.ts')

/** Install a fetch stub; returns the calls it saw. */
function stubFetch(impl) {
  const calls = []
  globalThis.fetch = (...args) => { calls.push(args); return impl(...args) }
  return calls
}

test('ok record resolves with items', async () => {
  stubFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, items: [1, 2, 3] }) }))
  const res = await callHost('list', { q: 'x' })
  assert.deepEqual(res, { ok: true, items: [1, 2, 3] })
})

test('the request hits the fenced route with a JSON body', async () => {
  const calls = stubFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, items: [] }) }))
  await callHost('search', { q: '标题' })
  assert.equal(calls.length, 1)
  const [url, init] = calls[0]
  assert.equal(url, '/switch-search/api/search')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(init.body), { q: '标题' })
})

test('HTTP error status → ok:false, never throws', async () => {
  stubFetch(() => Promise.resolve({ ok: false, status: 500 }))
  const res = await callHost('list', {})
  assert.equal(res.ok, false)
  assert.equal(res.items.length, 0)
  assert.match(res.error, /HTTP 500/)
})

test('malformed record → ok:false with the server error when present', async () => {
  stubFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false, error: '索引损坏' }) }))
  const res = await callHost('list', {})
  assert.deepEqual(res, { ok: false, items: [], error: '索引损坏' })
  // A record without ok/items shape at all must not pass as success either.
  stubFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ hello: 'world' }) }))
  const res2 = await callHost('list', {})
  assert.equal(res2.ok, false)
  assert.deepEqual(res2.items, [])
})

test('network rejection → ok:false with the message', async () => {
  stubFetch(() => Promise.reject(new Error('ECONNREFUSED')))
  const res = await callHost('list', {})
  assert.equal(res.ok, false)
  assert.match(res.error, /ECONNREFUSED/)
})

test('callHostAny timeout aborts and reports the timeout message', async () => {
  stubFetch((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const e = new DOMException('aborted', 'AbortError')
      reject(e)
    })
  }))
  const res = await callHostAny('import', { big: true }, 5)
  assert.equal(res.ok, false)
  assert.equal(res.error, '请求超时')
})

test('callHostAny passes a raw string body through untouched', async () => {
  const calls = stubFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }))
  await callHostAny('raw', '"[1,2]"')
  assert.equal(calls[0][1].body, '"[1,2]"')
})
