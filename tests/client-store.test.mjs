#!/usr/bin/env node
/**
 * The plugin settings card seat, proven against the built client bundle.
 *
 * What it proves (and what it does NOT):
 * - `lib/client.js` materializes without any release-specific specifier and
 *   registers exactly one `settings.plugin.item` entry (the thinking-levels
 *   pattern: dual `id`+`key`, no `settings.general.item` row, no store seat).
 * - The card's inject factory binds the `switch-search` settings namespace
 *   through the settingsScope service; when that service is absent the card
 *   degrades to a read-only DEFAULT_CONFIG scope instead of crashing.
 * - It does NOT render React, and it does NOT prove GUI behaviour.
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
const PLUGIN_ID = 'dsh-session-search-toggle'
const NAMESPACE = 'switch-search'

/** Module table the web shell seeds in both target releases (react family only here). */
const TABLE = {
  'react': {
    createElement: () => ({}), Fragment: {},
    useState: (v) => [v, () => {}], useEffect: () => {}, useMemo: (f) => f(),
    useRef: (v) => ({ current: v }), useSyncExternalStore: (sub, get) => get(),
  },
  'react-dom': { createPortal: () => ({}) },
}

/** Minimal DOM so the stylesheet effect can run headless. */
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
  }
}

/** Materialize the bundle and return its exports. */
function loadBundle() {
  const captured = []
  const sandbox = {
    window: { __ModuleLoader__: { load: (reg) => captured.push(reg) } },
    document: documentStub(),
    MutationObserver: class { observe() {} disconnect() {} },
    queueMicrotask: (fn) => fn(),
    setTimeout, clearTimeout, console,
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

/** Client context that records slot registrations and namespace bindings. */
function clientCtx(ledger, bindings, { withScope = true } = {}) {
  const disposer = () => {}
  let snapshot = {
    status: 'ready',
    value: { enabled: false, defaultMode: 'title' },
    base: undefined,
    user: undefined,
    revision: 1,
    writable: false,
    mode: 'host',
  }
  const scope = {
    getSnapshot: () => snapshot,
    subscribe: () => disposer,
    set: async () => {},
    unset: async () => {},
  }
  const slots = {
    inject: (name, fn) => { fn(); return disposer },
    register: (options) => { ledger.push(options); return disposer },
  }
  return {
    ctx: {
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : disposer },
      on: () => disposer,
      get: (name) => {
        if (name === 'settingsScope') {
          if (!withScope) return undefined
          return { bind: (spec) => { bindings.push(spec.namespace); return scope } }
        }
        if (name === 'slots') return slots
        return undefined
      },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      slots,
    },
    setSnapshot: (next) => { snapshot = next },
  }
}

let failures = 0
const line = (s) => process.stdout.write(`${s}\n`)
const check = (name, fn) => {
  try { fn(); line(`  PASS  ${name}`) } catch (err) { failures++; line(`  FAIL  ${name} — ${err?.message ?? err}`) }
}

line('=== dsh-session-search-toggle plugin settings card ===')

const { exports, seen } = loadBundle()
check('bundle materializes with only baseline specifiers', () => {
  for (const spec of seen) assert.ok(!/dsh-client-(runtime|store|ui-settings-general)/.test(spec), `release-specific require "${spec}"`)
  assert.equal(typeof exports.apply, 'function', 'client half exports no apply()')
})

check('registers one settings.plugin.item card bound to the namespace', () => {
  const ledger = []
  const bindings = []
  const { ctx } = clientCtx(ledger, bindings)
  exports.apply(ctx)
  assert.equal(ledger.length, 1, `expected 1 registration, got ${ledger.length}`)
  const options = ledger[0]
  assert.equal(options.name, 'settings.plugin.item')
  assert.equal(options.id, NAMESPACE, 'the card must key on the settings namespace (list-kind slots)')
  assert.equal(options.key, NAMESPACE, 'the card must key on the settings namespace (keyed-kind slots)')
  assert.equal(options.store, undefined, 'the card uses scope injection, not a store seat')
  assert.equal(typeof options.inject, 'function')
  const injected = options.inject()
  assert.ok(injected.scope, 'inject must return the bound scope')
  assert.deepEqual(bindings, [NAMESPACE], 'the card must bind exactly the switch-search namespace')
})

check('card degrades to a read-only default scope without settingsScope', () => {
  const ledger = []
  const bindings = []
  const { ctx } = clientCtx(ledger, bindings, { withScope: false })
  exports.apply(ctx)
  assert.equal(ledger.length, 1, `expected 1 registration, got ${ledger.length}`)
  const injected = ledger[0].inject()
  const snap = injected.scope.getSnapshot()
  assert.equal(snap.status, 'ready')
  assert.equal(snap.value.enabled, true, 'degraded scope must surface DEFAULT_CONFIG.enabled')
  assert.equal(snap.value.defaultMode, 'title', 'degraded scope must surface DEFAULT_CONFIG.defaultMode')
  assert.equal(snap.writable, false)
  assert.doesNotThrow(() => injected.scope.subscribe(() => {}))
})

line(`\n${failures === 0 ? 'TEST PASS' : `TEST FAIL (${failures})`}`)
process.exitCode = failures === 0 ? 0 : 1
