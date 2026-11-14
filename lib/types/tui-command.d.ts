/**
 * tui-command.ts — `/sfind`：会话检索的 dsh-tui 终端面（宿主斜杠命令）。
 *
 * 背景：dsh-tui 不加载插件 client 半边，宿主 ≥0.1.7 上 dsh-search-index 的入口是
 * 「主栏整页」—— 在终端里没有入口。命令面复用同一套取数：
 *   标题模式 = listSessions()（索引缓存的会话头）
 *   内容模式 = contentSearch()（DRS 分组命中，语义全在投影库侧）
 * 不新增查询逻辑，避免与面板口径漂移。
 *
 * 契约（.agents/plans/dsh-tui-faces/spec.md §3）：单行 <=100、总行 <=40、无 ANSI、--json 单行。
 */
import type { Context } from 'cordis';
export type CommandKind = 'success' | 'error';
export interface CommandResult {
    kind: CommandKind;
    text: string;
}
export interface SessionHead {
    sessionId: string;
    title?: string;
    cwd?: string;
    updatedAt?: number;
}
export interface ContentHit {
    sessionId?: string;
    title?: string;
    snippet?: string;
    excerpt?: string;
    hits?: Array<{
        snippet?: string;
        excerpt?: string;
        text?: string;
    }>;
    [key: string]: unknown;
}
export interface SfindCommandDeps {
    status(): Promise<unknown>;
    titles(): Promise<{
        ok: boolean;
        items?: unknown[];
        error?: string;
    }>;
    content(query: string, limit: number): Promise<{
        ok: boolean;
        items?: unknown[];
        error?: string;
        code?: string;
    }>;
}
export declare function clip(text: string, width?: number): string;
export declare function renderLines(lines: string[], limit?: number): string;
/** 纯函数入口。 */
export declare function runSfindCommand(rawInput: string, deps: SfindCommandDeps): Promise<CommandResult>;
/** 注册 `/sfind`：无 commands 服务时静默跳过（老线安全）。 */
export declare function registerSfindCommand(ctx: Context, deps: SfindCommandDeps): void;
//# sourceMappingURL=tui-command.d.ts.map