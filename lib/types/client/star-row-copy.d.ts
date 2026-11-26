/**
 * star-row 真源（面板 star 快车道行，v1）——纯 DOM 实现，零依赖。
 *
 * 副本约束：生成文件名 star-row-copy.ts，头部须保留 /** 块注释，单行 ≤140
 * 字宽（sidebar-fold 仓 lint 门禁：max-line + file-header）。
 *
 * 契约（对齐 panel-star-row spec）：
 *  - 渲染一行 <a>：GitHub 单色 SVG + `owner/name`；variant A 追加一句工程话术；
 *  - 整行即链接（A/L 档），新标签页打开；不做弹窗、不做按钮交互；
 *  - 文案内嵌 10 语，按 `document.documentElement.lang` 前缀自选
 *    （同 sidebar-fold `pickDictionary` 口径），不依赖宿主 locale 服务，
 *    避免逐仓动字典文件；
 *  - 样式一次性注入 <style data-dsh-star-row>，色随 currentColor，深浅主题自适应；
 *  - 副本由 _tools/star-row/sync.mjs 生成到各仓 `src/client/star-row-copy.ts`
 *    （文件名含 copy，locale 守卫豁免规则命中），改副本无效，改真源后重跑 sync。
 *
 * 每仓生成时在文件头部烘焙 REPO_URL / STAR_NS / STAR_VARIANT 三个常量。
 */
/** 在目标文档上建出快车道行（一次性注入样式）。纯 DOM，React 仓经 ref 回调挂载。 */
export declare function mountStarRow(doc?: Document): HTMLElement;
//# sourceMappingURL=star-row-copy.d.ts.map