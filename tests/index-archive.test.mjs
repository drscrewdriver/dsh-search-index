#!/usr/bin/env node
/**
 * 归档语义（新引擎 = 合并包引擎）：归档不软删，而是**打标 + 头行化**。
 *
 * 契约（与 dsh-manage-session 的归档集合只读互操作）：
 * - `setArchivedOne(id, true)` → `search()` 不再命中该会话，`listArchived()` 收录；
 * - `listIndexedSessions()` 仍会列出它（archived=true），供设置卡/管理台对齐；
 * - `setArchivedOne(id, false)` → 重新可搜（水位轮次会重灌正文）；
 * - `upsertArchivedHeader` → 只留头行的归档会话（正文不进 FTS）。
 *
 * Usage: node tests/index-archive.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { SwitchIndexEngine } from '../src/host/index/engine.ts'

function userMessage(seq, text) {
  return { seq, type: 'user/message', time: 1000 + seq, surfaceOp: 'append', data: { content: [{ type: 'text', text }] } }
}

const cleanups = []
test.afterEach?.(() => {})
function makeEngine() {
  const dir = mkdtempSync(join(tmpdir(), 'idx-archive-'))
  cleanups.push(dir)
  return { dir, engine: new SwitchIndexEngine({ path: join(dir, 'index.sqlite') }) }
}
process.on('exit', () => { for (const dir of cleanups) rmSync(dir, { recursive: true, force: true }) })

test('archive: search hides it, listArchived keeps it, header stays', async () => {
  const { engine } = makeEngine()
  await engine.open()
  engine.upsertSession({
    sessionId: 's1', version: 1, updatedAt: 1000, title: '归档测试', cwd: '/w',
    events: [userMessage(0, '火龙果关键词')],
  })
  assert.equal(engine.search({ query: '火龙果' }).length, 1, 'active session must be searchable')

  engine.setArchivedOne('s1', true)
  assert.equal(engine.search({ query: '火龙果', archived: 'active' }).length, 0, 'archived session must leave the active domain')
  assert.equal(engine.search({ query: '火龙果', archived: 'archived' }).length, 1, 'archived domain must still find it')
  assert.equal(engine.listArchived().length, 1, 'archived list must carry it')
  assert.equal(engine.countArchived(), 1)
  const row = engine.listIndexedSessions().find((s) => s.sessionId === 's1')
  assert.ok(row !== undefined, 'header row must stay in the catalog')
  assert.equal(row.archived, true)
  assert.equal(row.title, '归档测试', 'title survives archiving')

  engine.setArchivedOne('s1', false)
  assert.equal(engine.search({ query: '火龙果', archived: 'active' }).length, 1, 'un-archive makes it active again')
  engine.close()
})

test('archive: upsertArchivedHeader keeps header, drops body', async () => {
  const { engine } = makeEngine()
  await engine.open()
  engine.upsertArchivedHeader({
    sessionId: 's2', version: 2, updatedAt: 2000, title: '头行归档', cwd: '/w2',
  })
  assert.equal(engine.search({ query: '任意' }).length, 0, 'header-only row has no searchable body')
  assert.equal(engine.countArchived(), 1)
  assert.equal(engine.listIndexedSessions()[0].title, '头行归档')
  engine.close()
})

test('purge: removeSession drops the row entirely', async () => {
  const { engine } = makeEngine()
  await engine.open()
  engine.upsertSession({
    sessionId: 's3', version: 1, updatedAt: 3000, title: '待删', cwd: '/w3',
    events: [userMessage(0, '杨桃关键词')],
  })
  engine.setArchivedOne('s3', true)
  engine.removeSession('s3')
  assert.equal(engine.listIndexedSessions().length, 0, 'purged row must vanish from the catalog')
  assert.equal(engine.countArchived(), 0)
  engine.close()
})

console.log('index-archive: ok (3 contract cases)')
