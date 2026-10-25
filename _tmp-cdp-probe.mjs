// 通过宿主 Inspector 的 CDP 读取 DOM 文本（零依赖，Node 22 自带 WebSocket）
const list = await (await fetch('http://127.0.0.1:9231/json/list')).json()
const target = list.find((t) => t.webSocketDebuggerUrl)
if (!target) throw new Error('no CDP target')
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve)
  ws.addEventListener('error', reject)
})
function send(method, params = {}) {
  const mid = ++id
  ws.send(JSON.stringify({ id: mid, method, params }))
  return new Promise((resolve) => pending.set(mid, resolve))
}
await send('Runtime.enable')
const expr = `(() => {
  const t = document.body ? document.body.innerText : ''
  const rows = [...document.querySelectorAll('button, [role="button"], nav *')]
    .map((el) => (el.innerText || '').trim())
    .filter((s) => s !== '' && s.length < 24)
  return JSON.stringify({ title: document.title, url: location.href, text: t.slice(0, 3000), labels: [...new Set(rows)].slice(0, 80) })
})()`
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
console.log(JSON.stringify(res.result?.result ?? res, null, 2).slice(0, 6000))
ws.close()
