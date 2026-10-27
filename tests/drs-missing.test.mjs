#!/usr/bin/env node
/**
 * 缺包现场（`drs-missing`）端到端契约。
 *
 * 做法：把**构建产物** `lib/index.mjs` 复制到一个仓库外的临时目录，那里只有
 * `@deepseek-ai/schemastery`（宿主注入的 peer）而**没有** `dsh-reference-session-collector`。
 * 动态 `import(DRS_SPECIFIER)` 于是必然失败 —— 正好复现"用户装了插件但依赖没落地 /
 * Node 缺 node:sqlite"的那一档，断言：
 * - 进程不崩、`search-status` 仍返回 `available:false` + `reason:'drs-missing'`；
 * - `content-search` 回 `code:'drs-missing'`，文案指向"重装本插件"，**不是**"请安装 DRS"。
 *
 * Usage: node tests/drs-missing.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const repo = dirname(here)

const HARNESS = String.raw`
import { Readable } from 'node:stream'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dist = await import('./dist/index.mjs')
const routes = []
const ctx = {
  webServer: { register(route) { routes.push(route); return () => {} } },
  webStartup: { trustedHosts: ['127.0.0.1:9999'] },
  get: () => undefined,
  effect(fn) { const d = fn(); return () => { try { d?.() } catch {} } },
  logger: { info: () => {} },
}
globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) })
dist.apply(ctx, { indexDir: join(mkdtempSync(join(tmpdir(), 'nods-idx-')), 'idx'), autoSync: false, syncIntervalMs: 0, enabled: true })

const call = (method, body) => new Promise((resolve, reject) => {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'POST'
  req.url = '/switch-search/api/' + method
  req.headers = { host: '127.0.0.1:9999' }
  const res = { writeHead(c) { this.c = c }, end(t) { resolve({ status: this.c, body: JSON.parse(t) }) } }
  Promise.resolve(routes[0].handler(req, res)).catch(reject)
})

const out = { status: await call('search-status', {}), search: await call('content-search', { query: 'anything' }) }
console.log(JSON.stringify(out))
`

test('缺包：drs-missing 档位（不崩、不打成"请安装 DRS"）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'switch-nods-'))
  try {
    mkdirSync(join(root, 'node_modules', '@deepseek-ai'), { recursive: true })
    // junction 不需要管理员权限；schemastery 是 lib 唯一的非内置静态依赖。
    symlinkSync(join(repo, 'node_modules', '@deepseek-ai', 'schemastery'), join(root, 'node_modules', '@deepseek-ai', 'schemastery'), 'junction')
    mkdirSync(join(root, 'dist'))
    cpSync(join(repo, 'lib', 'index.mjs'), join(root, 'dist', 'index.mjs'))
    const harnessPath = join(root, 'harness.mjs')
    cpSync(join(root, 'dist', 'index.mjs'), harnessPath) // 占位，下面覆盖
    const { writeFileSync } = await import('node:fs')
    writeFileSync(harnessPath, HARNESS, 'utf8')

    const { stdout } = await run(process.execPath, [harnessPath], { cwd: root, timeout: 60_000 })
    const out = JSON.parse(stdout.trim().split('\n').pop())

    assert.equal(out.status.status, 200, '缺包不得把路由打成 5xx/4xx')
    assert.equal(out.status.body.available, false)
    assert.equal(out.status.body.mode, 'none')
    assert.equal(out.status.body.reason, 'drs-missing')

    assert.equal(out.search.status, 200)
    assert.equal(out.search.body.ok, false)
    assert.equal(out.search.body.code, 'drs-missing')
    assert.match(out.search.body.error, /重装本插件/u)
    assert.doesNotMatch(out.search.body.error, /请安装/u, '缺包文案不能把用户推去单独安装依赖')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

console.log('drs-missing: ok (1 case)')
