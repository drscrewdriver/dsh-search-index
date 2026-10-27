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
    label: string;
    onClick: () => void;
    /** 主按钮强调（跳转等正向动作），缺省为描边次按钮。 */
    primary?: boolean;
}
/** 显示（或更新）浮窗。buttons 即当前全部动作，重复 show 只替换不重建。 */
export declare function showLocateHud(text: string, buttons: HudButton[]): void;
/** 仅更新文案（浮窗不在则忽略——落定后迟到的 onProgress 不该把它唤回）。 */
export declare function updateLocateHud(text: string): void;
/** 移除浮窗。幂等。只由用户动作（取消/跳转/关闭）或新一次 show 之前的清理触发。 */
export declare function hideLocateHud(): void;
//# sourceMappingURL=locate-hud.d.ts.map