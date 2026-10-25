#!/usr/bin/env node
/**
 * dsh-search-index 客户端半身注册面（proven against the built bundle）。
 *
 * 覆盖契约（017 双形态，互斥）：
 * - 017+（`sidebar.workspaces.session.menu.item` + `main` 席位在场）：
 *   `sidebar.panellist` 一行（id/order = dsh-search-index/5）+ `main` 一页（key 同名），
 *   **不**注册底栏入口；
 * - 017-（无 017 席位）：只注册 `sidebar.footer.action` 一行（order 5），
 *   **不**注册 panellist/main；
 * - 设置卡双挂：`dsh-family.tab`（order 30）+ `plugins.bundle.config`（key = 包名）；
 * - 不占用 `settings.*` 席位；scope 以 configForms entry id 取句柄。
 *
 * Usage: node tests/client-store.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = join(HERE, '..', 'lib', 'client.js')
const PLUGIN_ID = 'dsh-search-index'
const NS = 'switch-search'
const SEAT_017 = 'sidebar.workspaces.session.menu.item'

const TABLE = {
  react: {
    createElement: () => ({}), Fragment: {},
    useState: (v) => [v, () => {}], useEffect: () => {}, useMemo: (f) => f(),
    useRef: (v) => ({ current: v }), useSyncExternalStore: (sub, get) => get(),
  },
  'react-dom': { createPortal: () => ({}) },
}

function documentStub() {
  const el = () => ({
    dataset: {}, style: {}, textContent: '', attributes: {},
    setAttribute() {}, removeAttribute() {}, remove() {}, appendChild() {},
    querySelectorAll: () => [], closest: () => null,
  })
  return {
    head: { appendChild: () => {} },
    documentElement: {},
    createElement: () => el(),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  }
}

function loadBundle() {
  const captured = []
  const sandbox = {
    window: { __ModuleLoader__: { load: (reg) => captured.push(reg) } },
    document: documentStub(),
    MutationObserver: class { observe() {} disconnect() {} },
    queueMicrotask: (fn) => fn(),
    setTimeout, clearTimeout, clearInterval, setInterval, console,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ ok: false }), text: async () => '' }),
  }
  sandbox.globalThis = sandbox
  runInNewContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'lib/client.js' })
  assert.equal(captured.length, 1, 'bundle must register exactly one factory')
  const reg = captured[0]
  assert.equal(reg.id, PLUGIN_ID, `factory id "${reg.id}" !== "${PLUGIN_ID}"`)
  const seen = new Set()
  const exports = reg.factory((spec) => {
    seen.add(spec)
    assert.ok(spec in TABLE, `non-baseline require "${spec}"`)
    return TABLE[spec]
  })
  return { exports, seen }
}

const BASE_SEATS = [
  'sidebar.footer.action',
  'dsh-family.tab',
  'plugins.bundle.config',
  'settings.section',
]

function clientCtx(ledger, bindings, { declaredSlots = BASE_SEATS, snapshot } = {}) {
  const disposer = () => {}
  const declared = new Set(declaredSlots)
  let value = snapshot ?? { enabled: true, defaultMode: 'title' }
  const scope = {
    getSnapshot: () => ({ status: 'ready', value, revision: 1, writable: false }),
    subscribe: () => disposer,
    set: async () => {},
  }
  const slots = {
    inject: (name, fn) => { if (declared.has(name)) fn(); return disposer },
    register: (options) => {
      ledger.push(options)
      return () => { const i = ledger.indexOf(options); if (i >= 0) ledger.splice(i, 1) }
    },
    entries: (name) => (name === 'settings.section' ? [] : []),
    getVersion: () => 0,
    subscribe: () => disposer,
  }
  return {
    ctx: {
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : disposer },
      on: () => disposer,
      get: (name) => {
        if (name === 'configForms') return { get: (entryId) => { bindings.push(entryId); return scope } }
        if (name === 'slots') return slots
        if (name === 'locale') return { register: () => disposer }
        return undefined
      },
      logger: { info() {}, warn() {}, error() {} },
      slots,
    },
    setValue: (next) => { value = next },
  }
}

let failures = 0
const line = (s) => process.stdout.write(`${s}\n`)
const checks = []
const check = (name, fn) => { checks.push([name, fn]) }

line('=== dsh-search-index client registrations ===')

const { exports, seen } = loadBundle()
check('bundle materializes with only baseline specifiers', () => {
  for (const spec of seen) assert.ok(!/dsh-client-(runtime|store)/.test(spec), `release-specific require "${spec}"`)
  assert.equal(typeof exports.apply, 'function', 'client half exports no apply()')
})

check('017- (no gen seat): exactly one footer entry, no panellist/main', () => {
  const ledger = []
  const { ctx } = clientCtx(ledger, [])
  exports.apply(ctx)
  const footer = ledger.filter((o) => o.name === 'sidebar.footer.action')
  assert.equal(footer.length, 1, `expected one footer entry, got ${JSON.stringify(ledger.map((o) => o.name))}`)
  assert.deepEqual(footer.map((o) => o.id), [PLUGIN_ID])
  assert.deepEqual(footer.map((o) => o.order), [5])
  assert.equal(ledger.filter((o) => o.name === 'sidebar.panellist').length, 0, 'no panel row on 017-')
  assert.equal(ledger.filter((o) => o.name === 'main').length, 0, 'no main page on 017-')
})

check('017+ (gen seat + main): one panel row + one main page, no footer entry', () => {
  const ledger = []
  const { ctx } = clientCtx(ledger, [], { declaredSlots: [...BASE_SEATS, SEAT_017, 'main', 'sidebar.panellist'] })
  exports.apply(ctx)
  const rows = ledger.filter((o) => o.name === 'sidebar.panellist')
  assert.equal(rows.length, 1, `expected one panel row, got ${JSON.stringify(ledger.map((o) => o.name))}`)
  assert.deepEqual(rows.map((o) => o.id), [PLUGIN_ID])
  assert.deepEqual(rows.map((o) => o.order), [5], 'row must sit between plugins(0) and manage-sessions(6)')
  const pages = ledger.filter((o) => o.name === 'main')
  assert.equal(pages.length, 1, 'expected one main page')
  assert.deepEqual(pages.map((o) => o.key), [PLUGIN_ID], 'page key must equal the panel row id')
  assert.equal(ledger.filter((o) => o.name === 'sidebar.footer.action').length, 0, 'footer entry must yield to the page form')
})

check('half-declared (gen seat only): falls back to the footer entry', () => {
  const ledger = []
  const { ctx } = clientCtx(ledger, [], { declaredSlots: [...BASE_SEATS, SEAT_017, 'sidebar.panellist'] })
  exports.apply(ctx)
  assert.equal(ledger.filter((o) => o.name === 'sidebar.panellist').length, 0, 'a half-declared page form must not be used')
  assert.equal(ledger.filter((o) => o.name === 'sidebar.footer.action').length, 1, 'footer fallback must stay')
})

check('settings cards: one family tab + one plugins page card, no settings.* seat', () => {
  const ledger = []
  const { ctx } = clientCtx(ledger, [])
  exports.apply(ctx)
  const family = ledger.filter((o) => o.name === 'dsh-family.tab')
  assert.equal(family.length, 1, `expected one family tab, got ${family.length}`)
  assert.deepEqual(family.map((o) => o.id), [PLUGIN_ID])
  assert.deepEqual(family.map((o) => o.locale), [NS])
  const plugins = ledger.filter((o) => o.name === 'plugins.bundle.config')
  assert.equal(plugins.length, 1, 'plugins page card must be registered once')
  assert.equal(plugins[0].key, PLUGIN_ID, 'plugins.bundle.config key must equal the package name')
  assert.deepEqual(ledger.filter((o) => String(o.name).startsWith('settings.')).map((o) => o.name), [])
})

check('scope prefers configForms (entry id)', () => {
  const ledger = []
  const bindings = []
  const { ctx } = clientCtx(ledger, bindings)
  exports.apply(ctx)
  assert.deepEqual([...new Set(bindings)], [PLUGIN_ID], 'configForms must be keyed by the profile entry id')
})

for (const [name, fn] of checks) {
  try {
    await fn()
    line(`  PASS  ${name}`)
  } catch (err) {
    failures++
    line(`  FAIL  ${name} — ${err?.message ?? err}`)
  }
}

line(`\n${failures === 0 ? 'TEST PASS' : `TEST FAIL (${failures})`}`)
process.exitCode = failures === 0 ? 0 : 1
