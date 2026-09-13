/** `switch-search` client dictionaries (zh / en), thinking-levels pattern. */
/** Dictionary namespace owned by this plugin (the host settings namespace). */
export declare const NS = "switch-search";
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    readonly 'card.title': "会话搜索";
    readonly 'card.description': "侧边栏会话搜索增强：标题搜索与内容搜索一键切换。内容搜索使用插件自建索引，不依赖 DSH 官方全文索引。";
    readonly 'card.unavailable': "设置命名空间不可用：请确认插件已装配进 profile。";
    readonly 'card.readonly': "只读";
    readonly 'card.enabled': "启用会话搜索";
    readonly 'card.enabled.desc': "在侧边栏底部显示\"搜索\"入口。";
    readonly 'card.defaultMode': "默认搜索模式";
    readonly 'card.defaultMode.desc': "面板打开时默认进入标题搜索还是内容搜索。";
    readonly 'card.mode.title': "标题";
    readonly 'card.mode.content': "内容";
    readonly 'card.autoSync': "自动同步索引";
    readonly 'card.autoSync.desc': "后台按水位增量同步会话日志到独立索引。";
    readonly 'card.syncInterval': "同步间隔（秒）";
    readonly 'card.syncInterval.desc': "两次增量同步之间的最小间隔。";
    readonly 'card.archiveKeep': "归档保留份数";
    readonly 'card.archiveKeep.desc': "每次整理索引后保留的历史索引文件数量。";
    readonly 'card.index': "内容搜索索引";
    readonly 'card.index.desc': "索引正常：已收录 {indexed} 个会话。";
    readonly 'card.index.archives': "，归档 {archives} 份。";
    readonly 'card.index.empty': "独立索引尚未建立。点击\"整理索引\"从会话日志全量建立。";
    readonly 'card.index.reading': "正在读取索引状态…";
    readonly 'card.index.rebuilding': "正在整理索引… {done}/{total}（整理期间旧索引仍可搜索）";
    readonly 'card.index.syncing': "正在同步索引…";
    readonly 'card.index.failures': "{count} 个会话同步失败（详见 Host 日志）。";
    readonly 'card.index.rebuildError': "整理失败：{error}";
    readonly 'card.index.rebuild': "整理索引";
    readonly 'card.index.rebuilding.btn': "整理中…";
    readonly 'card.index.rebuild.hint': "非破坏性：构建期间旧索引继续可搜索，完成后原子切换并归档旧索引。";
    readonly 'card.index.viewArchived': "查看归档";
    readonly 'card.index.export': "导出快照";
    readonly 'card.index.import': "导入快照";
    readonly 'card.index.exported': "快照已导出为下载文件。";
    readonly 'card.index.import.started': "快照导入已开始：正在后台重建索引，完成后自动切换。";
    readonly 'card.index.importParse': "快照解析失败或无有效会话。";
    readonly 'card.action.failed': "操作失败：{error}";
    readonly 'panel.titleSearch': "标题";
    readonly 'panel.contentSearch': "内容";
    readonly 'panel.searchTitle': "搜索会话标题…";
    readonly 'panel.searchContent': "搜索会话内容…";
    readonly 'panel.buildIndex': "建立索引";
    readonly 'panel.archived': "归档会话";
    readonly 'panel.archived.loading': "正在读取归档列表…";
    readonly 'panel.archived.empty': "暂无归档会话。";
    readonly 'panel.archived.close': "关闭";
    readonly 'panel.archived.entry': "归档会话";
    readonly 'panel.rebuilding': "正在整理索引… {done}/{total}（整理期间旧索引仍可搜索）";
    readonly 'panel.unavailable': "独立索引服务不可用：Host 未完成初始化。";
    readonly 'panel.notBuilt': "独立索引尚未建立：先建立索引即可启用内容搜索（不依赖 DSH 官方全文索引）。";
    readonly 'panel.loadingSessions': "正在读取会话列表…";
    readonly 'panel.sessionsError': "读取会话列表失败：{error}";
    readonly 'panel.noSessions': "暂无会话";
    readonly 'panel.noMatch': "没有匹配的会话。";
    readonly 'panel.loadingContent': "正在搜索会话内容…";
    readonly 'panel.contentError': "内容搜索失败：{error}";
    readonly 'panel.noContent': "没有匹配的内容。";
    readonly 'panel.contentHint': "输入内容关键词开始搜索。";
    readonly 'panel.noText': "(无文本)";
    readonly 'panel.untitled': "(未命名)";
    readonly 'panel.openSession': "打开会话";
    readonly 'filter.all': "全部";
    readonly 'filter.user': "用户";
    readonly 'filter.reply': "回复";
    readonly 'filter.tool': "工具";
    readonly 'type.user/message': "用户";
    readonly 'type.assistant/message': "回复";
    readonly 'type.tool/call': "工具调用";
    readonly 'type.tool/result': "工具结果";
};
export type LocaleKey = keyof typeof zh;
export type Dict = Record<LocaleKey, string>;
/** English dictionary; missing keys fall back to zh. */
export declare const en: Partial<Record<LocaleKey, string>>;
/** All shipped dictionaries by locale id (only built-in ids take the map overload). */
export declare const dictionaries: Readonly<Record<string, Partial<Dict>>>;
/** Translate with {param} interpolation; falls back to zh, then the key itself. */
export declare function translate(locale: ((key: LocaleKey, params?: Record<string, unknown>) => string) | undefined, key: LocaleKey, params?: Record<string, unknown>): string;
//# sourceMappingURL=locales.d.ts.map