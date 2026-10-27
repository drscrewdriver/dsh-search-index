import { type DrsSearchHit } from './drs-contract.ts';
/** 投影库目录环境变量（与 DRSC `resolveIndexDir` 同字面；不跨包 import）。 */
export declare const DRS_DIR_ENV = "DSH_REFERENCE_SESSION_COLLECTOR_DIR";
/** 进程内可用性探针结果。 */
export interface DrsLocalProbe {
    ok: boolean;
    /** 失败档位（`drs-missing` / `drs-empty` / `drs-schema-mismatch`）。 */
    reason?: string;
    /** 库内 `meta.schema_version`。 */
    schemaVersion?: string;
    /** 包侧 `PROJECTION_SCHEMA_VERSION`。 */
    expected?: string;
    sessions?: number;
    dir?: string;
    detail?: string;
}
/** 进程内检索请求（与 HTTP 臂同名参数；`atHost` 无意义）。 */
export interface DrsLocalSearchRequest {
    query: string;
    kinds?: readonly string[];
    archived?: 'active' | 'archived' | 'all';
    from?: number;
    to?: number;
    sortBy?: 'relevance' | 'time';
    limit?: number;
    expand?: boolean;
}
export interface DrsLocalArm {
    probe(): Promise<DrsLocalProbe>;
    searchGrouped(request: DrsLocalSearchRequest): Promise<DrsSearchHit[]>;
    dispose(): void;
}
/** 库目录解析：显式入参 > 环境变量 > `~/.dsh-reference-session-collector`。 */
export declare function resolveDrsDir(explicit?: string): string;
/**
 * 建一个进程内只读臂。
 * @param options.dir - 库目录解析（缺省 env/默认；绝不跟随本地索引 `indexDir`）。
 * @param options.log - `[switch-search]` 日志桥。
 */
export declare function createDrsLocalArm(options?: {
    dir?: () => string;
    log?: (message: string) => void;
}): DrsLocalArm;
//# sourceMappingURL=drs-local.d.ts.map