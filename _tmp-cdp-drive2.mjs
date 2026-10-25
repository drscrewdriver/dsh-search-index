// 用 Edge CDP 驱动 DSH Web 客户端：验证搜索入口形态与整页交互（只读）
import { writeFileSync } from 'node:fs'

const OUT = 'e:/test/rewrite-agently/_backup'
const report = {}
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const target = list.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:13118'))
if (!target) throw new Error('DSH page target not found')
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
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
  return r.result?.result?.value
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const data = r.result?.data
  if (!data) throw new Error('screenshot failed')
  writeFileSync(`${OUT}/${name}`, Buffer.from(data, 'base64'))
  return `${OUT}/${name}`
}

await send('Page.enable')
await send('Runtime.enable')

// 回到干净的会话视图（上一次脚本已 Esc 关闭；保险再按一次）
await evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(800)

const sidebar = await evalJs(`(() => {
  const nav = document.querySelector('nav[aria-label], nav')
  const host = nav || document.querySelector('aside') || document.body
  const rows = [...host.querySelectorAll('button, [role="button"], [role="treeitem"]')]
    .map((el, i) => ({ i, text: (el.innerText || '').trim(), cls: String(el.className).slice(0, 80) }))
    .filter((r) => r.text && r.text.length <= 24)
  return { rows: rows.slice(0, 40) }
})()`)
report.sidebar = sidebar
report.shotSidebar = await shot('cdp-01-sidebar.png')

// 点「搜索索引」面板行
report.click = await evalJs(`(() => {
  const all = [...document.querySelectorAll('button, [role="button"], a, div[tabindex]')]
  const hit = all.find((el) => (el.innerText || '').trim() === '搜索索引')
  if (!hit) return { found: false, seen: [...new Set(all.map((e) => (e.innerText || '').trim()).filter(Boolean))].filter((s) => s.includes('搜')) }
  hit.scrollIntoView({ block: 'center' })
  hit.click()
  return { found: true, cls: String(hit.className).slice(0, 100), parentCls: String(hit.parentElement?.className || '').slice(0, 100) }
})()`)
await sleep(2200)
report.shotOpen = await shot('cdp-02-search-page.png')

report.page = await evalJs(`(() => {
  const text = document.body.innerText || ''
  return {
    hasTitleMode: text.includes('标题'),
    hasContentMode: text.includes('内容'),
    hasBackdrop: !!document.querySelector('.dsws_backdrop'),
    hasPageSurface: !!document.querySelector('.dsws_triggerPage'),
    hasDialogSurface: !!document.querySelector('.dsws_trigger') && !document.querySelector('.dsws_triggerPage'),
    closeBtn: [...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === '关闭'),
    inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type })).slice(0, 6),
    bodyLines: text.split('\\n').map((s) => s.trim()).filter(Boolean).slice(0, 18),
  }
})()`)

// 在面板搜索框输入并回车
report.typed = await evalJs(`(() => {
  const inputs = [...document.querySelectorAll('input[type="text"]')]
  const input = inputs.find((i) => (i.placeholder || '').includes('搜索标题')) || inputs.find((i) => (i.placeholder || '').includes('搜索'))
  if (!input) return { ok: false, placeholders: inputs.map((i) => i.placeholder) }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'dsh session')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
  return { ok: true, placeholder: input.placeholder }
})()`)
await sleep(3500)
report.results = await evalJs(`(() => {
  const panel = document.querySelector('.dsws_triggerPage') || document.querySelector('.dsws_trigger')
  const text = panel ? panel.innerText : (document.body.innerText || '')
  return {
    panelFound: !!panel,
    lines: text.split('\\n').map((s) => s.trim()).filter(Boolean).slice(0, 22),
    indexStatus: (() => { const m = text.match(/(已收录[^\\n]*|索引尚未[^\\n]*|DRS[^\\n]*)/); return m ? m[0] : null })(),
  }
})()`)
report.shotResults = await shot('cdp-03-search-results.png')

// 关闭 → 回会话
report.close = await evalJs(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '关闭')
  if (btn) { btn.click(); return { via: 'button' } }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return { via: 'escape' }
})()`)
await sleep(1600)
report.afterClose = await evalJs(`(() => ({
  pageGone: !document.querySelector('.dsws_triggerPage'),
  dialogGone: !document.querySelector('.dsws_trigger'),
  conversationVisible: !!document.querySelector('[contenteditable="true"], textarea'),
}))()`)
report.shotClosed = await shot('cdp-04-closed.png')

// Ctrl+K 快捷回到搜索页
report.chord = await evalJs(`(() => {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'k', code: 'KeyK', keyCode: 75, which: 75, bubbles: true, cancelable: true,
    ctrlKey: !isMac, metaKey: isMac,
  }))
  return { isMac }
})()`)
await sleep(1500)
report.afterChord = await evalJs(`(() => ({
  pageSurface: !!document.querySelector('.dsws_triggerPage'),
  dialogSurface: !!document.querySelector('.dsws_trigger'),
}))()`)
report.shotChord = await shot('cdp-05-chord.png')

writeFileSync(`${OUT}/cdp-report.json`, JSON.stringify(report, null, 2), 'utf8')
console.log('report written: ' + `${OUT}/cdp-report.json`)
ws.close()
