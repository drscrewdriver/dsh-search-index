// 用 Edge CDP 驱动 DSH Web 客户端：验证搜索入口形态与整页交互（只读）
import { writeFileSync } from 'node:fs'

const OUT = 'e:/test/rewrite-agently/_backup'
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
  if (!data) throw new Error('screenshot failed: ' + JSON.stringify(r).slice(0, 200))
  writeFileSync(`${OUT}/${name}`, Buffer.from(data, 'base64'))
  return `${OUT}/${name}`
}

await send('Page.enable')
await send('Runtime.enable')

// 等首屏渲染
for (let i = 0; i < 40; i++) {
  const ready = await evalJs("!!document.querySelector('nav, [role=\"navigation\"], aside')")
  if (ready) break
  await sleep(500)
}
await sleep(2500)

const labels = await evalJs(`(() => {
  const els = [...document.querySelectorAll('button, [role="button"], [role="treeitem"], nav *')]
  const rows = els.map((el) => (el.innerText || '').trim()).filter((s) => s && s.length <= 24)
  return [...new Set(rows)].slice(0, 120)
})()`)
console.log('LABELS:', JSON.stringify(labels))

const before = await shot('cdp-01-sidebar.png')
console.log('SHOT1:', before)

// 找「搜索」入口（顶栏面板行或底栏入口）
const clickInfo = await evalJs(`(() => {
  const all = [...document.querySelectorAll('button, [role="button"], a, div[tabindex]')]
  const hit = all.find((el) => (el.innerText || '').trim() === '搜索')
  if (!hit) return { found: false }
  hit.scrollIntoView({ block: 'center' })
  hit.click()
  return { found: true, tag: hit.tagName, cls: String(hit.className).slice(0, 120), parent: String(hit.parentElement?.className || '').slice(0, 120) }
})()`)
console.log('CLICK:', JSON.stringify(clickInfo))
await sleep(2000)
const afterClick = await shot('cdp-02-search-open.png')
console.log('SHOT2:', afterClick)

const pageProbe = await evalJs(`(() => {
  const text = document.body.innerText || ''
  return {
    hasTitleMode: text.includes('标题'),
    hasContentMode: text.includes('内容'),
    hasBackdrop: !!document.querySelector('.dsws_backdrop'),
    hasPageSurface: !!document.querySelector('.dsws_triggerPage'),
    hasTrigger: !!document.querySelector('.dsws_trigger'),
    inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type })).slice(0, 6),
    closeBtn: [...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === '关闭'),
  }
})()`)
console.log('PAGE:', JSON.stringify(pageProbe, null, 2))

// 输入查询并回车
const typed = await evalJs(`(() => {
  const input = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('搜索'))
  if (!input) return { ok: false, placeholders: [...document.querySelectorAll('input')].map((i) => i.placeholder) }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'dsh')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
  return { ok: true, placeholder: input.placeholder }
})()`)
console.log('TYPED:', JSON.stringify(typed))
await sleep(3000)
const results = await evalJs(`(() => {
  const text = document.body.innerText || ''
  const lines = text.split('\\n').map((s) => s.trim()).filter(Boolean)
  return { lines: lines.slice(0, 25), hasEmpty: text.includes('没有匹配'), hasError: text.includes('不可用') || text.includes('失败') }
})()`)
console.log('RESULTS:', JSON.stringify(results, null, 2))
const afterSearch = await shot('cdp-03-search-results.png')
console.log('SHOT3:', afterSearch)

// 关闭（页内「关闭」或 Esc）
const closed = await evalJs(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '关闭')
  if (btn) { btn.click(); return { via: 'button' } }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return { via: 'escape' }
})()`)
console.log('CLOSE:', JSON.stringify(closed))
await sleep(1500)
const finalText = await evalJs(`(() => ({
  stillPage: !!document.querySelector('.dsws_triggerPage'),
  stillTrigger: !!document.querySelector('.dsws_trigger'),
}))()`)
console.log('AFTER CLOSE:', JSON.stringify(finalText))
const afterClose = await shot('cdp-04-closed.png')
console.log('SHOT4:', afterClose)

ws.close()
