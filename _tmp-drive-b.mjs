// 0.7.4 验证：点击命中必须跳转（页面退回会话 + 目标行高亮），并复查 DRS 内容检索
import { writeFileSync } from 'node:fs'

const OUT = 'e:/test/rewrite-agently/_backup'
const URL = process.argv[2]
const PORT = 9333
const result = {}
const list = await (await fetch(process.env.CDP_BASE || `http://127.0.0.1:${PORT}/json/list`)).json()
const target = list.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:'))
if (!target) throw new Error('page target not found')
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
const send = (method, params = {}) => { const mid = ++id; ws.send(JSON.stringify({ id: mid, method, params })); return new Promise((r) => pending.set(mid, r)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
  return r.result?.result?.value
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}`, Buffer.from(r.result.data, 'base64'))
  return `${OUT}/${name}`
}

await send('Page.enable')
await send('Runtime.enable')
for (let i = 0; i < 40; i++) { if (await js("!!document.querySelector('nav')")) break; await sleep(500) }
await sleep(2500)
await js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await sleep(600)

// 打开搜索页
await js(`(() => { const b=[...document.querySelectorAll('nav button')].find(x=>(x.innerText||'').trim()==='搜索索引'); if(b) b.click(); return true })()`)
await sleep(1800)

// 切到内容模式并搜索
await js(`(() => { const b=[...document.querySelectorAll('.dsws_triggerPage button')].find(x=>(x.innerText||'').trim()==='内容'); if(b) b.click(); return true })()`)
await sleep(500)
await js(`(() => {
  const input=[...document.querySelectorAll('.dsws_triggerPage input[type="text"]')].find(i=>(i.placeholder||'').includes('搜索会话内容'))
  if(!input) return false
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
  setter.call(input,'dsh'); input.dispatchEvent(new Event('input',{bubbles:true})); return true
})()`)
await sleep(3000)
result.before = await js(`(() => {
  const panel=document.querySelector('.dsws_triggerPage')
  const rows=[...panel.querySelectorAll('li')]
  return { rows: rows.length, firstText: rows[0]? (rows[0].innerText||'').split('\\n').slice(0,2): null }
})()`)
result.shotList = await shot('v074-01-content-list.png')

// 点第一条结果
result.click = await js(`(() => {
  const li=document.querySelector('.dsws_triggerPage li')
  if(!li) return { ok:false }
  const row=li.querySelector('[role="option"], .dsws_row') || li
  row.click()
  return { ok:true }
})()`)
await sleep(1200)
result.afterClick = await js(`(() => ({
  pageGone: !document.querySelector('.dsws_triggerPage'),
  conversation: !!document.querySelector('[contenteditable="true"], textarea'),
  hash: location.hash,
}))()`)
// 等巡逻完成（8s 超时 + 900ms 稳定窗）
await sleep(6000)
result.locate = await js(`(() => {
  const flash = document.querySelector('.dss-located-flash')
  const turns = document.querySelectorAll('[data-reader-turn]').length
  const msgs = document.querySelectorAll('[data-message-id], [data-dsh-message], article').length
  return {
    flash: !!flash,
    flashText: flash ? (flash.innerText || '').slice(0, 60) : null,
    readerTurns: turns,
    messages: msgs,
  }
})()`)
result.shotAfter = await shot('v074-02-after-click.png')

// 再开一次，验证标题模式点击也跳转
await js(`(() => { const b=[...document.querySelectorAll('nav button')].find(x=>(x.innerText||'').trim()==='搜索索引'); if(b) b.click(); return true })()`)
await sleep(1500)
await js(`(() => { const b=[...document.querySelectorAll('.dsws_triggerPage button')].find(x=>(x.innerText||'').trim()==='标题'); if(b) b.click(); return true })()`)
await sleep(400)
await js(`(() => {
  const input=[...document.querySelectorAll('.dsws_triggerPage input[type="text"]')].find(i=>(i.placeholder||'').includes('搜索会话标题'))
  if(!input) return false
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
  setter.call(input,'tidy'); input.dispatchEvent(new Event('input',{bubbles:true})); return true
})()`)
await sleep(2000)
result.titleRows = await js(`(() => document.querySelectorAll('.dsws_triggerPage li').length)()`)
result.titleClick = await js(`(() => { const li=document.querySelector('.dsws_triggerPage li'); if(!li) return {ok:false}; (li.querySelector('[role="option"], .dsws_row')||li).click(); return {ok:true} })()`)
await sleep(3000)
result.titleAfter = await js(`(() => ({ pageGone: !document.querySelector('.dsws_triggerPage'), flash: !!document.querySelector('.dss-located-flash') }))()`)
result.shotTitleAfter = await shot('v074-03-title-click.png')

writeFileSync(`${OUT}/cdp-report4.json`, JSON.stringify(result, null, 2), 'utf8')
console.log('report4 written')
ws.close()
