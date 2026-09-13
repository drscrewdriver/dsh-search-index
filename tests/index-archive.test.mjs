#!/usr/bin/env node
/**
 * Archive soft-delete semantics of the independent index (schema v4+).
 *
 * What it proves:
 * - setArchived flips the soft-delete flag: archived sessions drop out of
 *   search and the active list but keep their header (title cache) and show
 *   up in listArchived().
 * - Un-archiving forces a version reset so the next watermark pass re-ingests
 *   the full content and the session becomes searchable again.
 * - A rebuild copies archived sessions as header-only rows (no docs/FTS).
 * - Snapshots export active sessions only; importing cannot resurrect
 *   archived content.
 *
 * Usage: node tests/index-archive.test.mjs  (after npm run build)
 */
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const { SwitchIndexEngine, rebuildIndex, exportSnapshot, parseSnapshot, DEFAULT_INDEX_LAYOUT } = await import('../lib/index.mjs')

function tempDir(label) {
  return mkdtempSync(join(tmpdir(), `switch-archive-${label}-`))
}

function userMessage(seq, text) {
  return { seq, type: 'user/message', time: 1000 + seq, surfaceOp: 'append', data: { content: [{ type: 'text', text }] } }
}

function ingestOne(engine, sessionId, text, version = 1) {
  engine.upsertSession({
    sessionId, version, title: `t-${sessionId}`, cwd: '/w', updatedAt: 10,
    events: [userMessage(0, text)],
  })
}

test('archive: soft delete hides from search/list, header stays, viewer sees it', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('soft'), 'index.sqlite') })
  await engine.open()
  ingestOne(engine, 'a', '琥珀色的内容一')
  ingestOne(engine, 'b', '琥珀色的内容二')
  assert.equal(engine.countSessions(), 2)

  engine.setArchived(new Set(['a']))
  assert.equal(engine.countSessions(), 1, 'archived leaves the active count')
  assert.equal(engine.countArchived(), 1)
  assert.equal(engine.search({ query: '琥珀' }).length, 1, 'only the active session is searchable')
  assert.equal(engine.listIndexedSessions().map(s => s.sessionId).join(), 'b')

  const archived = engine.listArchived()
  assert.deepEqual(archived.map(s => s.sessionId), ['a'])
  assert.equal(archived[0].title, 't-a', 'header/title cache survives the soft delete')
  assert.equal(archived[0].archived, true)
  engine.close()
})

test('archive: un-archive resets the version so the next sync re-ingests', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('un'), 'index.sqlite') })
  await engine.open()
  ingestOne(engine, 'a', '琥珀内容')
  engine.setArchived(new Set(['a']))
  engine.setArchived(new Set())
  const row = engine.getSession('a')
  assert.equal(row.archived, false)
  assert.equal(row.version, -1, 'version reset forces re-ingest on the next pass')

  // The next watermark pass (simulated) re-reads because -1 !== 1.
  ingestOne(engine, 'a', '琥珀内容', 1)
  assert.equal(engine.search({ query: '琥珀' }).length, 1, 'searchable again after re-ingest')
  engine.close()
})

test('archive: archived sessions re-ingest as header-only via upsertArchivedHeader', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('hdr'), 'index.sqlite') })
  await engine.open()
  engine.upsertArchivedHeader({ sessionId: 'x', version: 3, title: '缓存标题', cwd: '/w', updatedAt: 7 })
  const row = engine.getSession('x')
  assert.equal(row.archived, true)
  assert.equal(row.version, 3)
  assert.deepEqual(engine.exportSessionDocs('x'), [], 'no docs for archived headers')
  assert.equal(engine.search({ query: '缓存' }).length, 0, 'header rows are not searchable')
  assert.equal(engine.listArchived().length, 1)
  engine.close()
})

test('archive: rebuild copies archived sessions as header-only', async () => {
  const dir = tempDir('rebuild')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  const engine = new SwitchIndexEngine({ path: join(layout.dir, layout.active) })
  await engine.open()
  const sessionQuery = {
    listSessions: async () => [
      { header: { id: 'live', version: 1, createdAt: 1, cwd: '/w' } },
      { header: { id: 'gone', version: 2, createdAt: 2, cwd: '/w' } },
    ],
    readSession: async (id) => {
      if (id === 'gone') throw new Error('must not read archived content')
      return { session: { id, version: 1, createdAt: 1, cwd: '/w' }, events: [userMessage(0, '活跃内容')] }
    },
  }
  const state = await rebuildIndex(
    engine, layout, sessionQuery, 2, undefined,
    () => ({ archivedSessionIds: ['gone'] }),
  )
  assert.equal(state.state, 'idle')
  assert.equal(engine.search({ query: '活跃' }).length, 1)
  assert.equal(engine.listArchived().map(s => s.sessionId).join(), 'gone')
  assert.deepEqual(engine.exportSessionDocs('gone'), [], 'rebuild copied no docs for the archived session')
  engine.close()
})

test('archive: snapshots carry active sessions only', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('snap'), 'index.sqlite') })
  await engine.open()
  ingestOne(engine, 'a', '琥珀一')
  ingestOne(engine, 'b', '琥珀二')
  engine.setArchived(new Set(['a']))
  const text = exportSnapshot(engine)
  const parsed = parseSnapshot(text)
  assert.deepEqual(parsed.records.map(r => r.sessionId), ['b'], 'export skips archived sessions')
  engine.close()
})
