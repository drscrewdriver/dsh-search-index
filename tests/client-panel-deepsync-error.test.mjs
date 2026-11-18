#!/usr/bin/env node
/**
 * 深度同步的失败原因必须**在界面上可见**（issue #4）。
 *
 * 背景：宿主半边一直把失败原因存进 `deepSync.error`（`index.ts` 的 catch 分支），
 * 但面板此前只画「同步失败」四个字 —— 用户看得见失败、看不见为什么，只能报
 * 「装了这个插件还是失败」，报者与维护者都无从下手。这个缺陷的形状是
 * **数据在、渲染缺**，所以钉的是「渲染路径」而不是「数据是否被捕获」。
 *
 * 断言三件事：
 * 1. 状态里带 `deepSyncError`，且只在 failed 时取值（避免上一轮残值）；
 * 2. 列表区有可见的失败块（`panel.deepSync.failedReason` + 重试按钮），
 *    不是只挂在 `title` 上 —— title 悬停才出现，用户报 issue 时贴不出来；
 * 3. 失败原因用 `{error}` 插值渲染原文，不做裁剪。
 *
 * Usage: node --import tsx tests/client-panel-deepsync-error.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const PANEL = readFileSync(join(ROOT, 'src', 'client', 'panel.tsx'), 'utf8')

test('issue #4：状态里带 deepSyncError，且只在 failed 时取值', () => {
  assert.match(PANEL, /deepSyncError\?: string/, '状态类型必须声明 deepSyncError')
  // 只在 failed 分支取 error：其余状态宿主不写它，带过去会是上一轮残值。
  assert.match(
    PANEL,
    /deepSyncError:\s*deepState === 'failed' \? status\.deepSync\?\.error : undefined/,
    'deepSyncError 必须只在 failed 时从 status.deepSync.error 取值',
  )
})

test('issue #4：失败原因在列表区可见，不只是 title', () => {
  // 可见块：dsws_error 容器 + failedReason 文案 + 重试按钮
  const block = /deepsync-failed[\s\S]{0,1200}?panel\.deepSync\.retry/.exec(PANEL)
  assert.ok(block, '列表区必须有 deepsync-failed 可见块（含重试按钮）')
  assert.match(block[0], /className: 'dsws_error'/, '失败块必须用错误样式（可见，不是 tooltip）')
  assert.match(
    block[0],
    /panel\.deepSync\.failedReason/,
    '失败块必须渲染 failedReason 文案',
  )
})

test('issue #4：失败原因原样插值，不裁剪', () => {
  // 宿主抓到的通常是 `HTTP 404` / `fetch failed` 这类短句，裁剪反而丢掉关键码。
  assert.match(
    PANEL,
    /panel\.deepSync\.failedReason',\s*\{\s*error:\s*searchStatus\.deepSyncError\s*\}/,
    'failedReason 必须原样传入 deepSyncError',
  )
})

test('issue #4：重试按钮复用 startDeepSync（不新开一条启动路径）', () => {
  const block = /deepsync-failed[\s\S]{0,1200}?panel\.deepSync\.retry/.exec(PANEL)
  assert.ok(block, '失败块存在')
  assert.match(block[0], /onClick:\s*startDeepSync/, '重试必须走既有的 startDeepSync')
})
