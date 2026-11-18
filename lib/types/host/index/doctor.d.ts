/**
 * 异常台账 + 排查编排（issue #4 的后续）。
 *
 * 为什么单独一个模块：`content-search` 失败的原因分散在三层（宿主路由 / DRS
 * HTTP 臂 / 进程内只读臂），而用户能提供的只有一句「搜不出来」。0.7.22 把
 * detail 显示出来了，但那只是**当下一次**的失败；用户连续踩坑时，真正有用的是
 * 「这一段时间里失败了几次、每次是哪一档、最早的第一次是什么」。
 *
 * 三段职责，刻意分开：
 *   1. 记账（{@link FailureLedger}）—— 纯内存环形缓冲，不写盘、不占内存无上限；
 *   2. 分诊（{@link diagnose}）—— 纯函数，把探针结果 + 台账合成一份「问题清单」；
 *   3. 编排（{@link renderDoctorReport}）—— 纯函数，把清单排成可粘贴的报告，
 *      每步带**可执行命令**（不是「请检查配置」这种无法执行的措辞）。
 *
 * 三层都是纯的：没有时间变量、没有 IO、没有全局状态（台账由调用方持有）。
 */
/** 一条失败记录。字段刻意少而稳：能归因即可，不追求全量。 */
export interface FailureRecord {
    /** 失败档位（`DrsFailureCode` 或本地索引侧的自造码）。 */
    code: string;
    /** 原始细节（路径 / HTTP 码 / 模块名）。可能为空。 */
    detail?: string;
    /** 哪个操作失败的：`content-search` / `index-rebuild` / `index-deep-sync`。 */
    op: string;
    /** 发生时刻（ms）。台账不排序，靠它给「最近一次 / 最早一次」。 */
    at: number;
}
/** 台账容量。够覆盖「用户从发现坏了到决定报 issue」这段，又不至于无限涨。 */
export declare const LEDGER_CAPACITY = 50;
/**
 * 失败台账：固定容量的环形缓冲，同档位同 detail 连续重复时只累加计数。
 *
 * 为什么合并重复：一次搜索会打多次请求，同一个「投影库未建立」可能在几秒内
 * 出现十几次。逐条记会让台账被同一件事塞满，看不出「先后踩了不同的坑」。
 */
export declare class FailureLedger {
    private readonly records;
    /** `code|detail|op` → 出现次数。与 records 同步维护。 */
    private readonly counts;
    /** 记一条。返回是否真的写入了（容量满且是重复项时为 false）。 */
    record(entry: FailureRecord): boolean;
    /** 快照（按发生时刻倒序：最近的在前）。 */
    snapshot(): Array<FailureRecord & {
        count: number;
    }>;
    /** 某档位累计出现次数（跨 detail）。 */
    countOf(code: string): number;
    /** 清空（用户手动清 / 测试用）。 */
    clear(): void;
    /** 台账里出现过的档位（去重，按首次出现顺序）。 */
    codes(): string[];
}
/** 一步排查动作。`command` 必须可执行 —— 这是本模块的存在理由。 */
export interface DoctorStep {
    /** 这一条在查什么（一句话，用户读得懂）。 */
    check: string;
    /** 结论：`ok` / `warn` / `fail` / `unknown`。 */
    verdict: 'ok' | 'warn' | 'fail' | 'unknown';
    /** 观测到的值（原样，不美化）。 */
    observed: string;
    /** 下一步可执行的命令；`undefined` 表示这条无需操作。 */
    command?: string;
    /** 为什么这条重要（短，一句话）。 */
    why?: string;
}
/** 诊断输入：全是已经读好的数据，本函数不做任何探测。 */
export interface DoctorInput {
    /** 当前实际可用通道：http / in-process / none。 */
    mode: string;
    /** 通道探针档位（`ok` 时无）。 */
    reason?: string;
    /** 探针细节。 */
    detail?: string;
    /** DRSC 路由 404（装了但没激活）。 */
    notActivated: boolean;
    /** 配置面选择的通道。 */
    transport: string;
    /** 进程内库明细。 */
    local: {
        schemaVersion?: string;
        expected?: string;
        sessions?: number;
        dir?: string;
    };
    /** 本地索引条数。 */
    indexed: number;
    /** 失败台账快照。 */
    failures: Array<FailureRecord & {
        count: number;
    }>;
    /** 宿主版本串（用户报 issue 时要贴）。 */
    hostVersion?: string;
}
/**
 * 把探针结果 + 台账编排成一份排查清单。
 *
 * 顺序是**由因到果**，不是由严重到轻：先确认依赖在不在，再看库建没建，
 * 再看通道通不通，最后才看历史失败。用户从上往下做，做完一条就少一种可能。
 *
 * @param input - 已经读好的观测数据。
 * @param platform - 决定命令的平台形态（注入以便测试）。
 * @returns 有序的排查步骤。
 */
export declare function diagnose(input: DoctorInput, platform?: NodeJS.Platform): DoctorStep[];
/**
 * 把诊断清单排成一份**可直接粘贴**的 Markdown 报告。
 *
 * 报 issue 的人拿不到宿主日志，所以报告必须自带：环境、结论、每一步的观测值、
 * 以及下一步要跑什么。格式刻意用 Markdown —— 粘进 GitHub issue 就是可读的。
 *
 * @param input - 与 {@link diagnose} 相同。
 * @param platform - 决定命令形态。
 * @returns Markdown 文本。
 */
export declare function renderDoctorReport(input: DoctorInput, platform?: NodeJS.Platform): string;
//# sourceMappingURL=doctor.d.ts.map