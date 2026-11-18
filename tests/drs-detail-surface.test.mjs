#!/usr/bin/env node
/**
 * 内容搜索失败时，`detail` 必须随 error 一起回到界面（issue #4）。
 *
 * 缺陷形状：宿主半边抓到了可诊断的原始细节（`未找到投影库：<完整路径>`、
 * `投影库无法打开：<原因>`、`缺少 meta.schema_version`、`尚无会话行`），
 * 但它**只进了宿主日志**：`messageForDrsFailure(failure.code)` 没传 detail，
 * 客户端拿到的是一句没有细节的档位文案。日志在宿主进程里，报 issue 的人拿不到，
 * 于是只能写「装了这个插件还是失败」。
 *
 * 断言四件事：
 * 1. `contentSearch` 的 catch 把 `failure.detail` 传给 `messageForDrsFailure`；
 * 2. `drs-empty` / `drs-not-activated` / `drs-missing` 三档的文案带 detail 后缀
 *    （此前这三档**完全吞掉** detail，而它们正是最常见的一档）；
 * 3. 客户端九语文案都带 `{error}` 占位，否则 translate 无处可插；
 * 4. `drs-empty` 的四种成因各自的 detail 都真的被构造出来（不是空串）。
 *
 * Usage: node --import tsx tests/drs-detail-surface.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const HOST = readFileSync(join(ROOT, 'src', 'index.ts'), 'utf8')
const LOCAL = readFileSync(join(ROOT, 'src', 'host', 'index', 'drs-local.ts'), 'utf8')

const { messageForDrsFailure } = await import('../src/host/index/drs-contract.ts')

test('issue #4：contentSearch 的 catch 把 detail 传下去', () => {
  assert.match(
    HOST,
    /messageForDrsFailure\(failure\.code,\s*failure\.detail\)/,
    '必须传 detail —— 不传就等于把唯一的分诊依据留在宿主日志里',
  )
})

test('issue #4：drs-empty / drs-not-activated / drs-missing 三档都带 detail 后缀', () => {
  // 这三档此前把 detail 整段吞掉。逐个断言 detail 会出现在文案里。
  for (const code of ['drs-empty', 'drs-not-activated', 'drs-missing']) {
    const msg = messageForDrsFailure(code, 'PROBE-DETAIL-XYZ')
    assert.ok(
      msg.includes('PROBE-DETAIL-XYZ'),
      `${code} 的文案必须包含 detail（实际：${msg}）`,
    )
  }
})

test('issue #4：drs-empty 的四种成因都真的构造了 detail', () => {
  // 空 detail 会让「带 detail 后缀」形同虚设，所以钉的是构造点本身。
  const markers = [
    '未找到投影库：',
    '投影库无法打开：',
    '投影库缺少 meta.schema_version',
    '投影库内尚无会话行',
  ]
  for (const marker of markers) {
    assert.ok(LOCAL.includes(marker), `drs-empty 的成因 detail 缺失：${marker}`)
  }
})

test('issue #4：客户端九语文案都带 {error} 占位', () => {
  const LOCALES = readFileSync(join(ROOT, 'src', 'client', 'locales.ts'), 'utf8')
  const codes = [
    'browser-access-denied', 'drs-http-unreachable', 'drs-http-error',
    'drs-not-activated', 'drs-missing', 'drs-empty', 'drs-schema-mismatch',
  ]
  /**
   * 逐行解析而不是正则取引号内容：法语/意大利语的 `L\'hôte` 带转义单引号，
   * `'([^']*)'` 会在那里截断，把「有 {error}」误判成「没有」。
   */
  const missing = []
  let seen = 0
  for (const line of LOCALES.split('\n')) {
    const m = /^\s*'panel\.contentErr\.([\w-]+)':\s*'(.*)',\s*$/.exec(line)
    if (m === null || !codes.includes(m[1])) continue
    seen += 1
    if (!m[2].includes('{error}')) missing.push(`${m[1]}: ${m[2].slice(0, 40)}`)
  }
  assert.equal(seen, codes.length * 9, `应扫到 ${codes.length * 9} 条 contentErr 文案，实际 ${seen}`)
  assert.deepEqual(missing, [], '这些 contentErr 文案缺 {error} 占位，detail 会无处可插')
})

test('issue #4：detail 为空时不留下空的括号', () => {
  const msg = messageForDrsFailure('drs-empty')
  assert.ok(!msg.includes('（）'), '无 detail 时不得出现空括号')
  assert.ok(!msg.includes('()'), '无 detail 时不得出现空括号')
})
