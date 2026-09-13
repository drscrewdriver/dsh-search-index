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
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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

test('archive: prune removes ids from the storage hub with backup + atomic write', async () => {
  const { pruneArchiveFile } = await import('../lib/index.mjs')
  const { writeFileSync, readFileSync, existsSync, readdirSync } = await import('node:fs')
  const dir = tempDir('prune')
  const file = join(dir, 'workspace.json')
  writeFileSync(file, JSON.stringify({
    unit: { name: 'workspace', version: 1 },
    global: { archivedSessionIds: ['s-keep-1', 's-drop-1', 's-keep-2', 's-drop-2'] },
    tables: {},
  }, null, 2) + '\n')

  const result = pruneArchiveFile(['s-drop-1', 's-drop-2', 's-unknown'], undefined, [file])
  assert.equal(result.removed, 2)
  assert.equal(result.remaining, 2)
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  assert.deepEqual(doc.global.archivedSessionIds, ['s-keep-1', 's-keep-2'])
  // backup + no temp residue
  assert.ok(existsSync(join(dir, readdirSync(dir).find(n => n.startsWith('workspace.json.bak-')))), 'backup exists')
  assert.ok(!readdirSync(dir).some(n => n.includes('.prune-tmp') || (n.startsWith('.') && n.endsWith('.tmp'))), 'no temp residue')

  // unknown ids only: no write, no backup churn
  const second = pruneArchiveFile(['s-unknown'], undefined, [file])
  assert.equal(second.removed, 0)
  assert.equal(second.remaining, 2)
})

test('recovery: stale shadow is discarded when the active index survives', async () => {
  const { recoverIndex } = await import('../lib/index.mjs')
  const dir = tempDir('recover-stale')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  writeFileSync(join(dir, layout.active), 'active')
  writeFileSync(join(dir, layout.building), 'half-built')
  writeFileSync(`${join(dir, layout.building)}-wal`, 'wal')

  const actions = await recoverIndex(layout)
  assert.equal(actions.length, 1)
  assert.match(actions[0], /stale shadow/)
  assert.ok(existsSync(join(dir, layout.active)), 'active untouched')
  assert.ok(!existsSync(join(dir, layout.building)), 'shadow discarded')
  assert.ok(!existsSync(`${join(dir, layout.building)}-wal`), 'shadow wal discarded')
})

test('recovery: crash during the swap window rolls back to the newest archive', async () => {
  const { recoverIndex } = await import('../lib/index.mjs')
  const dir = tempDir('recover-swap')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  // Active already renamed away; newest archive holds the pre-rebuild index.
  writeFileSync(join(dir, `${layout.archivePrefix}111.sqlite`), 'old')
  writeFileSync(join(dir, `${layout.archivePrefix}222.sqlite`), 'newest')
  writeFileSync(join(dir, layout.building), 'half-built')

  const actions = await recoverIndex(layout)
  assert.equal(actions.length, 1)
  assert.match(actions[0], /restored/)
  assert.ok(existsSync(join(dir, layout.active)), 'archive promoted to active')
  assert.equal(readFileSync(join(dir, layout.active), 'utf8'), 'newest', 'newest archive wins')
  assert.ok(!existsSync(join(dir, layout.building)), 'shadow discarded')
})
