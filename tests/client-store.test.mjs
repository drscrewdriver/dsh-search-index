#!/usr/bin/env node
/**
 * The plugin settings card seat, proven against the built client bundle.
 *
 * What it proves (and what it does NOT):
 * - `lib/client.js` materializes without any release-specific specifier and
 *   registers exactly one sidebar entry plus one settings card (dual `id`+`key`,
 *   no `settings.general.item` row, no store seat).
 * - The card lands on WHICHEVER settings seat the host declares: `settings.plugin.item`
 *   on the ≤0.1.2 line, `settings.plugins.tab` on the 0.1.5 line — and only one
 *   of the two ever fires, because `slots.inject` runs its callback only once
 *   the named seat is DECLARED. The fake below models that rule; a fake that
 *   fires every `inject` models a host that declares everything, which no real
 *   host does, and would hide exactly the regression this covers.
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
const PLUGIN_ID = 'dsh-search-index'
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

/**
 * The settings seat each host LINE declares. The two lines are mutually
 * exclusive: 0.1.5 renamed the seat, it did not add a second one.
 */
const HOST_012_SEATS = ['sidebar.footer.action', 'settings.plugin.item']
const HOST_015_SEATS = ['sidebar.footer.action', 'settings.plugins.tab']

/** Client context that records slot registrations and namespace bindings. */
function clientCtx(ledger, bindings, { withScope = true, declaredSlots = HOST_012_SEATS } = {}) {
  const disposer = () => {}
  const declared = new Set(declaredSlots)
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
    // Real semantics: the callback fires only once the named seat is DECLARED.
    // The bundle relies on this for its two-seat (0.1.2 / 0.1.5) registration.
    inject: (name, fn) => { if (declared.has(name)) fn(); return disposer },
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

line('=== dsh-search-index plugin settings card ===')

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
  // The archived-sessions viewer moved to dsh-session-steward: this package
  // registers exactly one sidebar entry (search) plus the settings card.
  assert.equal(ledger.length, 2, `expected search entry + plugin card, got ${ledger.length}`)
  assert.equal(ledger[0].name, 'sidebar.footer.action', 'the sidebar footer search entry must be registered')
  assert.equal(ledger[0].id, PLUGIN_ID)
  const options = ledger[1]
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
  assert.equal(ledger.length, 2, `expected search entry + plugin card, got ${ledger.length}`)
  const injected = ledger[1].inject()
  const snap = injected.scope.getSnapshot()
  assert.equal(snap.status, 'ready')
  assert.equal(snap.value.enabled, true, 'degraded scope must surface DEFAULT_CONFIG.enabled')
  assert.equal(snap.value.defaultMode, 'title', 'degraded scope must surface DEFAULT_CONFIG.defaultMode')
  assert.equal(snap.writable, false)
  assert.doesNotThrow(() => injected.scope.subscribe(() => {}))
})

// ── The 0.1.5 line ────────────────────────────────────────────────────────────
// 0.1.5 renamed the Plugins settings seat. A bundle that only knows the old
// name registers nothing there and the card silently disappears — no error the
// user can see, because an undeclared-seat throw happens inside the inject
// factory during activation, where an outer try/catch cannot reach it.

check('registers the settings.plugins.tab seat on the 0.1.5 host line', () => {
  const ledger = []
  const bindings = []
  const { ctx } = clientCtx(ledger, bindings, { declaredSlots: HOST_015_SEATS })
  exports.apply(ctx)
  assert.equal(ledger.length, 2, `expected search entry + tab card, got ${ledger.length}`)
  assert.equal(ledger[0].name, 'sidebar.footer.action', 'the sidebar footer search entry must be registered')
  const options = ledger[1]
  assert.equal(options.name, 'settings.plugins.tab', 'the card must land on the seat the 0.1.5 host declares')
  assert.equal(options.id, NAMESPACE, 'the tab key must be the settings namespace')
  assert.equal(typeof options.order, 'number', 'the tab seat must carry a numeric order')
  assert.equal(typeof options.label, 'function', 'the tab seat must carry a label THUNK, not a static string')
  assert.equal(options.label(), '搜索索引', 'the label thunk must resolve the card title from the bundled zh dictionary')
  assert.equal(typeof options.inject, 'function')
  assert.ok(options.inject().scope, 'inject must return the bound scope on the tab seat too')
  assert.deepEqual(bindings, [NAMESPACE], 'the card must bind exactly the switch-search namespace')
})

check('the two seats are mutually exclusive — the old name does NOT also fire on 0.1.5', () => {
  const ledger = []
  const { ctx } = clientCtx(ledger, [], { declaredSlots: HOST_015_SEATS })
  exports.apply(ctx)
  const names = ledger.map((o) => o.name)
  assert.ok(names.includes('settings.plugins.tab'), 'the declared tab seat must be occupied')
  assert.ok(
    !names.includes('settings.plugin.item'),
    `the undeclared legacy seat must NOT be registered; got ${JSON.stringify(names)}`,
  )
})

line(`\n${failures === 0 ? 'TEST PASS' : `TEST FAIL (${failures})`}`)
process.exitCode = failures === 0 ? 0 : 1
