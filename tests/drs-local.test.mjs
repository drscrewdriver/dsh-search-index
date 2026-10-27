#!/usr/bin/env node
/**
 * 进程内只读臂（`drs-local.ts`）契约：
 * - 目录解析与 DRSC `resolveIndexDir` 同口径（显式 > env > ~/.dsh-reference-session-collector）；
 * - 只读纪律：打开后 meta 版本与各表行数不变，库目录不存在时不创建；
 * - schema 闸门：版本不符只报 `drs-schema-mismatch`，**不清库**；
 * - 命中形状与 HTTP 臂逐字同形（sessionId/title/seq/type/time/updatedAt/snippet）。
 *
 * 夹具用 DRSC 自己的写面（openProjectionStore）建最小 v5 库——写面只出现在测试里，
 * 生产代码（src/host/index/drs-local.ts）禁止调用它。
 *
 * Usage: node --import tsx tests/drs-local.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { createDrsLocalArm, resolveDrsDir, DRS_DIR_ENV } = await import('../src/host/index/drs-local.ts')
const { DrsUnavailableError } = await import('../src/host/index/drs-contract.ts')
const drs = await import('dsh-reference-session-collector')

const silentLog = () => {}

/** 造一个最小可检索库：1 会话 / 1 检索臂 / 1 字块。 */
function seed(dir) {
  const store = drs.openProjectionStore(dir)
  store.db.prepare('INSERT INTO blocks(hash, body, bytes) VALUES(?,?,?)')
    .run('h1', 'we discussed pineapple pricing', 30)
  store.db.prepare(`INSERT INTO sessions(session_id, dir_id, title, cwd, event_count, max_seq, last_time_ms, archived)
                    VALUES(?,?,?,?,?,?,?,?)`)
    .run('s1', 'd1', 'Pineapple talk', 'E:/w', 10, 3, 1_700_000_000_000, 0)
  store.db.prepare(`INSERT INTO segments(session_id, seq, kind, time, search_text_hash, on_surface)
                    VALUES(?,?,?,?,?,?)`)
    .run('s1', 3, 'user/message', 1_699_999_000_000, 'h1', 1)
  store.db.prepare('INSERT INTO segments_fts(index_text, session_id, seq, kind) VALUES(?,?,?,?)')
    .run('pineapple pricing', 's1', 3, 'user/message')
  store.db.prepare("INSERT INTO meta(key, value) VALUES('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(drs.PROJECTION_SCHEMA_VERSION)
  store.close()
}

/** 用独立连接读取库现状（测试侧观测，非被测代码）。 */
function snapshot(dir) {
  const db = new DatabaseSync(join(dir, 'projection.db'), { readOnly: true })
  const one = (sql) => db.prepare(sql).get()
  const state = {
    version: one("SELECT value FROM meta WHERE key='schema_version'").value,
    sessions: one('SELECT COUNT(*) AS c FROM sessions').c,
    segments: one('SELECT COUNT(*) AS c FROM segments').c,
    blocks: one('SELECT COUNT(*) AS c FROM blocks').c,
  }
  db.close()
  return state
}

test('resolveDrsDir: 显式 > env > 默认目录', () => {
  const before = process.env[DRS_DIR_ENV]
  try {
    delete process.env[DRS_DIR_ENV]
    assert.match(resolveDrsDir(), /\.dsh-reference-session-collector$/u)
    process.env[DRS_DIR_ENV] = 'E:/tmp/drs-env'
    assert.equal(resolveDrsDir(), 'E:/tmp/drs-env')
    assert.equal(resolveDrsDir('E:/tmp/explicit'), 'E:/tmp/explicit')
  } finally {
    if (before === undefined) delete process.env[DRS_DIR_ENV]
    else process.env[DRS_DIR_ENV] = before
  }
})

test('probe + searchGrouped: 只读打开、命中形状与 HTTP 臂同形、库不变', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drs-local-'))
  try {
    seed(dir)
    const before = snapshot(dir)
    const arm = createDrsLocalArm({ dir: () => dir, log: silentLog })
    const probe = await arm.probe()
    assert.equal(probe.ok, true)
    assert.equal(probe.schemaVersion, drs.PROJECTION_SCHEMA_VERSION)
    assert.equal(probe.sessions, 1)

    const hits = await arm.searchGrouped({ query: 'pineapple', archived: 'all', limit: 5 })
    assert.equal(hits.length, 1)
    // 命中核心形状与 HTTP 臂逐字同形；turn/turnGap/onSurface 为回合富化新增可选字段，
    // 解构排除后只校 7 个基础字段（新字段存在性另测）。
    const { turn: hitTurn, turnGap: hitGap, onSurface: hitSurface, ...core } = hits[0]
    assert.deepEqual(core, {
      sessionId: 's1',
      title: 'Pineapple talk',
      seq: 3,
      type: 'user/message',
      time: 1_699_999_000_000,
      updatedAt: 1_700_000_000_000,
      snippet: hits[0].snippet,
    })
    assert.match(hits[0].snippet, /pineapple/u)
    // 富化生效：seed 的 segments 带 turn/on_surface 列，命中应回填数值。
    assert.equal(typeof hitTurn, 'number')
    assert.equal(typeof hitGap, 'number')
    assert.ok(hitGap >= 0)

    const after = snapshot(dir)
    assert.deepEqual(after, before, '只读臂不得改动库内容（版本/行数一律不变）')
    arm.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('schema 闸门: 版本不符 → drs-schema-mismatch，且库未被清空', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drs-local-'))
  try {
    seed(dir)
    const writer = new DatabaseSync(join(dir, 'projection.db'))
    writer.prepare("UPDATE meta SET value='4' WHERE key='schema_version'").run()
    writer.close()
    const before = snapshot(dir)
    assert.equal(before.version, '4')
    assert.equal(before.segments, 1)

    const arm = createDrsLocalArm({ dir: () => dir, log: silentLog })
    const probe = await arm.probe()
    assert.equal(probe.ok, false)
    assert.equal(probe.reason, 'drs-schema-mismatch')
    await assert.rejects(
      () => arm.searchGrouped({ query: 'pineapple' }),
      (err) => err instanceof DrsUnavailableError && err.code === 'drs-schema-mismatch',
    )
    const after = snapshot(dir)
    assert.deepEqual(after, before, '版本不符只报错，绝不允许 DROP/VACUUM/回写版本')
    arm.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('库目录不存在 → drs-empty，且不创建目录', async () => {
  const root = mkdtempSync(join(tmpdir(), 'drs-local-'))
  const missing = join(root, 'no-such-dir')
  try {
    const arm = createDrsLocalArm({ dir: () => missing, log: silentLog })
    const probe = await arm.probe()
    assert.equal(probe.ok, false)
    assert.equal(probe.reason, 'drs-empty')
    assert.equal(existsSync(missing), false, '只读臂不得创建库目录')
    arm.dispose()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('空库（0 会话）→ drs-empty', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drs-local-'))
  try {
    const store = drs.openProjectionStore(dir)
    store.close()
    const arm = createDrsLocalArm({ dir: () => dir, log: silentLog })
    const probe = await arm.probe()
    assert.equal(probe.ok, false)
    assert.equal(probe.reason, 'drs-empty')
    arm.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

console.log('drs-local: ok (5 contract cases)')
