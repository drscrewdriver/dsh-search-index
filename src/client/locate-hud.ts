/**
 * 深加载回溯进度浮窗（命令式单例）。
 *
 * 为什么不用 React 组件承载：确认跳转会调 `open(sessionId)`，而 SwitchFooter 的
 * open 回调先 `setOpenPanel(false)` 关掉搜索面板——面板一 unmount，其内部 React
 * 进度状态随之消失，深加载期间无处显示「回溯中 n/pages」。HUD 挂 document.body 的
 * 独立 DOM 节点，生命周期与面板解耦。
 *
 * 落定不自动消失（真机反馈）：回溯成功后视图可能已被后续渲染冲走，用户要自己决定
 * 何时「跳转」或「取消」；失败也只给「关闭」。showLocateHud 的 buttons 数组即全部
 * 动作面——进行态传 [取消]，落定态传 [取消, 跳转]，本模块不关心语义。
 *
 * 主题色走宿主真实令牌（与面板 .dsws_trigger 同源）：底色 --dsw-specific-tip、
 * 描边 --dsw-alias-border-l1、文字 --dsw-alias-label-*。回退值取中性半透明，
 * 绝不写死深色（浅色主题下曾整块发黑，即本轮修复的 bug）。
 */

export interface HudButton {
  label: string
  onClick: () => void
  /** 主按钮强调（跳转等正向动作），缺省为描边次按钮。 */
  primary?: boolean
}

let host: HTMLDivElement | null = null
let labelEl: HTMLSpanElement | null = null
let actionsEl: HTMLDivElement | null = null

/** 重建按钮组：每次 show 都按最新 buttons 渲染（本地化与回调保持新鲜）。 */
function renderButtons(buttons: HudButton[]): void {
  if (actionsEl === null) return
  while (actionsEl.firstChild !== null) actionsEl.removeChild(actionsEl.firstChild)
  for (const b of buttons) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = b.label
    btn.style.cssText = [
      'flex:none', 'font:inherit', 'font-size:12px', 'cursor:pointer',
      'border-radius:7px', 'padding:3px 10px',
      'color:var(--dsw-alias-label-primary, inherit)',
      b.primary === true
        ? 'border:1px solid transparent;background:var(--dsw-alias-state-business-primary, rgba(76,110,245,.9))'
        : 'border:1px solid var(--dsw-alias-border-l2, currentColor);background:transparent',
    ].join(';')
    btn.addEventListener('click', () => { b.onClick() })
    actionsEl.appendChild(btn)
  }
}

/** 显示（或更新）浮窗。buttons 即当前全部动作，重复 show 只替换不重建。 */
export function showLocateHud(text: string, buttons: HudButton[]): void {
  if (typeof document === 'undefined') return
  if (host !== null && document.body.contains(host)) {
    if (labelEl !== null) labelEl.textContent = text
    renderButtons(buttons)
    return
  }
  host = document.createElement('div')
  host.setAttribute('role', 'status')
  host.setAttribute('aria-live', 'polite')
  host.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%)',
    'z-index:2147483000', 'display:flex', 'align-items:center', 'gap:10px',
    'padding:8px 12px', 'border-radius:10px',
    'border:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35))',
    'background:var(--dsw-specific-tip, rgba(127,127,127,.12))',
    'backdrop-filter:blur(8px)',
    'color:var(--dsw-alias-label-primary, inherit)',
    'font-size:13px', 'line-height:18px', 'max-width:80vw',
    'box-shadow:var(--dsw-shadow-lv3, 0 6px 24px rgba(0,0,0,.16))',
  ].join(';')
  labelEl = document.createElement('span')
  labelEl.textContent = text
  actionsEl = document.createElement('div')
  actionsEl.style.cssText = ['display:flex', 'align-items:center', 'gap:6px', 'flex:none'].join(';')
  host.appendChild(labelEl)
  host.appendChild(actionsEl)
  document.body.appendChild(host)
  renderButtons(buttons)
}

/** 仅更新文案（浮窗不在则忽略——落定后迟到的 onProgress 不该把它唤回）。 */
export function updateLocateHud(text: string): void {
  if (host !== null && document.body.contains(host) && labelEl !== null) labelEl.textContent = text
}

/** 移除浮窗。幂等。只由用户动作（取消/跳转/关闭）或新一次 show 之前的清理触发。 */
export function hideLocateHud(): void {
  if (host !== null && host.parentNode !== null) host.parentNode.removeChild(host)
  host = null
  labelEl = null
  actionsEl = null
}
