#!/usr/bin/env node
/**
 * The session-open dispatch has exactly one owner and one precedence.
 *
 * Why this test exists
 * --------------------
 * Host 0.1.7 dropped `open` from the client `sessions` contract ("navigation
 * belongs to view owners") and moved it to `uiWorkspace.openSession`. The
 * jump kept calling `sessions.open` behind a `typeof === 'function'` guard,
 * which turned the missing method into a silent no-op: on every 0.1.7/0.2.0
 * host, clicking a search hit closed the panel and nothing happened, with no
 * console signal. The React render path is not exercised by this suite (see
 * the note in `client-panel-key.test.mjs`), so the dispatch itself is a pure
 * function (`openSessionThrough`) and this suite pins its whole face.
 *
 * What it proves: `uiWorkspace.openSession` wins when offered; `sessions.open`
 * is the legacy fallback; neither (or method-less faces) → silent no-op.
 * What it does NOT prove: that the panel wires `open` to result clicks — that
 * stays a GUI check.
 *
 * Usage: node --import tsx tests/client-open-session.test.mjs
 */
import assert from 'node:assert/strict'
import { openSessionThrough } from '../src/client/host-api.ts'

// 0.1.7+ hosts: uiWorkspace wins, sessions is never touched.
{
  const calls = []
  openSessionThrough((name) => (name === 'uiWorkspace'
    ? { openSession: (id) => { calls.push(['uiWorkspace', id]) } }
    : { open: (id) => { calls.push(['sessions', id]) } }), 's1')
  assert.deepEqual(calls, [['uiWorkspace', 's1']])
}

// Pre-0.1.7 hosts: sessions.open is the legacy fallback.
{
  const calls = []
  openSessionThrough((name) => (name === 'sessions'
    ? { open: (id) => { calls.push(['sessions', id]) } }
    : undefined), 's2')
  assert.deepEqual(calls, [['sessions', 's2']])
}

// Neither face, or faces without the method: silent no-op, never a throw —
// the exact property that used to hide the breakage.
{
  openSessionThrough(() => undefined, 's3')
  openSessionThrough(() => ({}), 's4')
  // A method-less uiWorkspace must not stop the fallback chain: an unknown
  // future host shape still reaches sessions.open.
  const calls = []
  openSessionThrough((name) => (name === 'uiWorkspace'
    ? {}
    : { open: (id) => { calls.push(['sessions', id]) } }), 's5')
  assert.deepEqual(calls, [['sessions', 's5']])
}

console.log('client-open-session: dispatch precedence + silent-degradation ok')
