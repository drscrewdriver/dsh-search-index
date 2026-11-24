/**
 * dsh-search-index 的首次使用引导文案（3 步；结构与 word 走 guide-kit 的统一契约）。
 *
 * 为什么单独一个文件：`guide.tsx` 是 `_tools/guide-kit/` 的**生成副本**（会被同步覆盖），
 * 与本插件相关的文案不能放在里面，否则下一次 sync 就没了。
 */
import type { GuideLocale, GuideStep } from './guide.tsx';
export declare const SEARCH_GUIDE_STEPS: Partial<Record<GuideLocale, readonly GuideStep[]>>;
//# sourceMappingURL=guide-steps.d.ts.map