// 第二轮：精确验证面板输入检索、DRS 状态、Ctrl+K 与关闭
import { writeFileSync } from 'node:fs'

const OUT = 'e:/test/rewrite-agently/_backup'
const report = {}

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const target = list.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:13118'))
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

// 状态：先回会话
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(900)

// 1) DRS/索引状态（同源 API 直查）
report.api = await evalJs(`(async () => {
  const post = async (method, body) => {
    const r = await fetch('/switch-search/api/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return await r.json()
  }
  const status = await post('search-status', {})
  const settings = await post('settings-describe', {})
  return { status, settingsWritable: settings.writable, settingsNs: Object.keys(settings.namespaces || {}) }
})()`)

// 2) 点击面板行进入整页
report.open = await evalJs(`(() => {
  const hit = [...document.querySelectorAll('button.wtg9ga_panelRow, button')].find((el) => (el.innerText || '').trim() === '搜索索引')
  if (!hit) return { found: false }
  hit.click()
  return { found: true }
})()`)
await sleep(1800)
report.pageShape = await evalJs(`(() => ({
  pageSurface: !!document.querySelector('.dsws_triggerPage'),
  backdrop: !!document.querySelector('.dsws_backdrop'),
  inPanelList: [...document.querySelectorAll('nav button')].some((b) => b.getAttribute('aria-current') === 'page' && (b.innerText || '').includes('搜索索引')),
}))()`)
report.shotPage = await shot('cdp-06-page-open.png')

// 3) 面板内输入（标题模式）+ 触发检索
report.typed = await evalJs(`(() => {
  const input = [...document.querySelectorAll('.dsws_trigger input[type="text"]')].find((i) => (i.placeholder || '').includes('搜索会话标题'))
  if (!input) return { ok: false, phs: [...document.querySelectorAll('.dsws_trigger input')].map((i) => i.placeholder) }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'dsh')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.focus()
  return { ok: true, placeholder: input.placeholder }
})()`)
await sleep(2500)
report.titleResults = await evalJs(`(() => {
  const panel = document.querySelector('.dsws_triggerPage')
  const rows = [...panel.querySelectorAll('li')].map((li) => (li.innerText || '').trim().split('\\n')[0]).filter(Boolean)
  return { rowCount: rows.length, first: rows.slice(0, 5), footer: (panel.querySelector('.dsws_panelFoot')?.innerText || '').replace(/\\n/g, ' | ') }
})()`)
report.shotTitle = await shot('cdp-07-title-search.png')

// 4) 内容模式 + 内容检索（DRS 硬依赖）
report.contentMode = await evalJs(`(() => {
  const btn = [...document.querySelectorAll('.dsws_trigger button')].find((b) => (b.innerText || '').trim() === '内容')
  if (!btn) return { ok: false }
  btn.click()
  return { ok: true }
})()`)
await sleep(700)
report.typedContent = await evalJs(`(() => {
  const input = [...document.querySelectorAll('.dsws_trigger input[type="text"]')].find((i) => (i.placeholder || '').includes('搜索内容'))
  if (!input) return { ok: false, phs: [...document.querySelectorAll('.dsws_trigger input')].map((i) => i.placeholder) }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'dsh')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.focus()
  return { ok: true, placeholder: input.placeholder }
})()`)
await sleep(3000)
report.contentResults = await evalJs(`(() => {
  const panel = document.querySelector('.dsws_triggerPage')
  const lines = (panel.innerText || '').split('\\n').map((s) => s.trim()).filter(Boolean)
  const rows = [...panel.querySelectorAll('li')].length
  return { rowCount: rows, hasDrsError: lines.some((l) => l.includes('dsh-reference-session-collector') || l.includes('不可用')), excerpt: lines.slice(0, 14) }
})()`)
report.shotContent = await shot('cdp-08-content-search.png')

// 5) Esc 关闭 → 回会话；再用 Ctrl+K 打开
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(1200)
report.closed = await evalJs(`(() => ({ pageGone: !document.querySelector('.dsws_triggerPage') }))()`)

report.chord = await evalJs(`(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', keyCode: 75, bubbles: true, cancelable: true, ctrlKey: true }))
  return true
})()`)
await sleep(1500)
report.afterChord = await evalJs(`(() => ({
  pageSurface: !!document.querySelector('.dsws_triggerPage'),
  backdrop: !!document.querySelector('.dsws_backdrop'),
}))()`)
report.shotChord = await shot('cdp-09-chord-open.png')

// 收尾回会话
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(800)

writeFileSync(`${OUT}/cdp-report2.json`, JSON.stringify(report, null, 2), 'utf8')
console.log('report2 written')
ws.close()
