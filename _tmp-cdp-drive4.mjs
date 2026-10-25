// 第三轮：0.7.2 装机后完整验证（面板行 / 整页 / 标题检索 / 内容检索 DRS 报错 / 设置卡 DRS 行 / 快捷）
import { writeFileSync } from 'node:fs'

const OUT = 'e:/test/rewrite-agently/_backup'
const PORT = 9334
const report = {}

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const target = list.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:'))
if (!target) throw new Error('page target not found')
const ws = new WebSocket(target.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
const send = (method, params = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res) => pending.set(id, res))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500))
  return r.result?.result?.value
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}`, Buffer.from(r.result.data, 'base64'))
  return `${OUT}/${name}`
}

await send('Page.enable')
await send('Runtime.enable')
for (let i = 0; i < 40; i++) {
  if (await evalJs("!!document.querySelector('nav')")) break
  await sleep(500)
}
await sleep(2500)
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(600)

report.sidebarRows = await evalJs(`(() => [...document.querySelectorAll('nav button')].map((b) => (b.innerText || '').trim()).filter(Boolean))()`)
report.shotSidebar = await shot('v072-01-sidebar.png')

report.api = await evalJs(`(async () => {
  const post = async (m, b) => (await fetch('/switch-search/api/' + m, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json()
  const status = await post('search-status', {})
  const desc = await post('settings-describe', {})
  return { available: status.available, reason: status.reason, indexed: status.sync?.indexed, ns: Object.keys(desc.namespaces || {}), corpus: desc.namespaces?.['switch-search']?.corpusSource, drsBaseUrl: desc.namespaces?.['switch-search']?.drsBaseUrl }
})()`)

report.open = await evalJs(`(() => {
  const hit = [...document.querySelectorAll('nav button')].find((b) => (b.innerText || '').trim() === '搜索索引')
  if (!hit) return { found: false }
  hit.click(); return { found: true }
})()`)
await sleep(1800)
report.pageShape = await evalJs(`(() => ({
  pageSurface: !!document.querySelector('.dsws_triggerPage'),
  backdrop: !!document.querySelector('.dsws_backdrop'),
  activeRow: [...document.querySelectorAll('nav button')].filter((b) => b.getAttribute('aria-current') === 'page').map((b) => (b.innerText || '').trim()),
}))()`)
report.shotPage = await shot('v072-02-page.png')

report.typedTitle = await evalJs(`(() => {
  const input = [...document.querySelectorAll('.dsws_trigger input[type="text"]')].find((i) => (i.placeholder || '').includes('搜索会话标题'))
  if (!input) return { ok: false }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'dsh'); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus()
  return { ok: true }
})()`)
await sleep(2200)
report.titleResults = await evalJs(`(() => {
  const panel = document.querySelector('.dsws_triggerPage')
  const rows = [...panel.querySelectorAll('li')].map((li) => (li.innerText || '').trim().split('\\n')[0]).filter(Boolean)
  return { count: rows.length, first: rows.slice(0, 4), foot: (panel.querySelector('.dsws_panelFoot')?.innerText || '').replace(/\\n/g, ' | ') }
})()`)
report.shotTitle = await shot('v072-03-title.png')

report.content = await evalJs(`(() => {
  const btn = [...document.querySelectorAll('.dsws_triggerPage button')].find((b) => (b.innerText || '').trim() === '内容')
  if (!btn) return { ok: false }
  btn.click(); return { ok: true }
})()`)
await sleep(600)
report.typedContent = await evalJs(`(() => {
  const input = [...document.querySelectorAll('.dsws_triggerPage input[type="text"]')].find((i) => (i.placeholder || '').includes('搜索会话内容'))
  if (!input) return { ok: false, phs: [...document.querySelectorAll('.dsws_triggerPage input')].map((i) => i.placeholder) }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'dsh'); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus()
  return { ok: true }
})()`)
await sleep(3000)
report.contentResults = await evalJs(`(() => {
  const panel = document.querySelector('.dsws_triggerPage')
  const lines = (panel.innerText || '').split('\\n').map((s) => s.trim()).filter(Boolean)
  return {
    drsError: lines.find((l) => l.includes('dsh-reference-session-collector')) || null,
    rows: [...panel.querySelectorAll('li')].length,
  }
})()`)
report.shotContent = await shot('v072-04-content.png')

// 关闭 → 插件页看设置卡 DRS 行
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(900)
report.openPlugins = await evalJs(`(() => {
  const hit = [...document.querySelectorAll('nav button')].find((b) => (b.innerText || '').trim() === '插件')
  if (!hit) return { found: false }
  hit.click(); return { found: true }
})()`)
await sleep(2500)
report.settingsCard = await evalJs(`(() => {
  const body = document.body.innerText || ''
  const lines = body.split('\\n').map((s) => s.trim()).filter(Boolean)
  const drsIdx = lines.findIndex((l) => l.includes('DRS'))
  return {
    hasCorpusRow: lines.some((l) => l.includes('语料源')),
    hasDrsBaseRow: lines.some((l) => l.includes('DRS 基址')),
    drsLines: drsIdx >= 0 ? lines.slice(drsIdx - 2, drsIdx + 3) : null,
    tail: lines.slice(-16),
  }
})()`)
report.shotPlugins = await shot('v072-05-plugins-card.png')

// 回会话 → Ctrl+K 打开 → Esc 关闭
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(600)
await evalJs(`(() => {
  const hit = [...document.querySelectorAll('nav button')].find((b) => (b.innerText || '').trim() === '会话')
  if (hit) hit.click()
  return true
})()`)
await sleep(900)
report.chord = await evalJs(`(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', keyCode: 75, bubbles: true, cancelable: true, ctrlKey: true }))
  return true
})()`)
await sleep(1500)
report.afterChord = await evalJs(`(() => ({ pageSurface: !!document.querySelector('.dsws_triggerPage'), backdrop: !!document.querySelector('.dsws_backdrop') }))()`)
report.shotChord = await shot('v072-06-chord.png')
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(700)
report.afterEsc = await evalJs(`(() => ({ pageGone: !document.querySelector('.dsws_triggerPage') }))()`)

writeFileSync(`${OUT}/cdp-report3.json`, JSON.stringify(report, null, 2), 'utf8')
console.log('report3 written')
ws.close()
