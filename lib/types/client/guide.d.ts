import type { CSSProperties, JSX } from 'react';
export interface GuideStep {
    title: string;
    body: string;
}
export interface GuideLabels {
    title: string;
    skip: string;
    next: string;
    prev: string;
    done: string;
    restart: string;
    stepOf: (_current: number, _total: number) => string;
}
/** 生态通用的十个语言码（与各插件 `locale/*.json`、README 的十语镜像同口径）。 */
export declare const GUIDE_LOCALES: readonly ["zh", "en", "ja", "ko", "fr", "de", "it", "ru", "es", "pt"];
export type GuideLocale = (typeof GUIDE_LOCALES)[number];
/**
 * 引导外壳词表（10 语）。
 *
 * 为什么不塞进各插件 locales：这七个词是**跨插件同一套**，塞进九个字典要重复翻译
 * 9×10 次，且一旦措辞调整就得动九个仓。外壳留在本文件，正文留各插件。
 */
export declare const GUIDE_COPY: Record<GuideLocale, GuideLabels>;
/** 语言标签 → 语言码：只认主标签，认不出的落 null（由调用方回退 en）。 */
export declare function normalizeGuideLocale(tag: string): GuideLocale | null;
/**
 * 当前引导语言：以宿主 `<html lang>` 为准（语言切换会改写这个属性）。
 *
 * 认不出 → en：引导是「帮助」面，宁可给英文也不能给空白或中文硬串。
 */
export declare function currentGuideLocale(): GuideLocale;
/** 兼容旧调用（1.x 版本只区分 zh/en）：需要细分语种请用 `currentGuideLocale()`。 */
export declare function guideLang(): GuideLocale;
/** 引导外壳取词。 */
export declare function guideLabels(locale?: GuideLocale): GuideLabels;
/**
 * 步骤正文取词：本语 → en → zh → 表里第一个可用。
 *
 * 为什么需要回退链：九插件分批补语种，某个插件可能只有 zh/en 而宿主是 ru；
 * 这时给英文是可用的，给空白等于「引导坏了」。`undefined` 步骤表按空表处理。
 */
export declare function guideSteps(map: Partial<Record<GuideLocale, readonly GuideStep[]>> | undefined): readonly GuideStep[];
/** 是否已跳过（存储不可用时按「未跳过」处理：宁可多教一次，不要静默不教）。 */
export declare function isGuideSkipped(ns: string): boolean;
/** 记下跳过；写失败不抛（隐私模式 / 存储禁用）。 */
export declare function skipGuide(ns: string): void;
/** 清标记 = 允许重新教学。 */
export declare function resetGuide(ns: string): void;
/**
 * 引导主体：3 步以内的小教学 + 恒定可见的 Skip。
 *
 * `onClose` 由宿主卡面传：Skip/Done 都会调用它（Skip 同时写标记）。
 */
export declare function GuidePanel(props: {
    ns: string;
    steps: readonly GuideStep[];
    onClose: () => void;
}): JSX.Element | null;
/**
 * 重启入口：清标记 + 就地重开引导。
 *
 * 统一件，避免九插件各写一份（措辞/样式/清标记时机容易走样）。跳过之后
 * 用户想再看一次，不需要去清浏览器存储。
 */
export declare function GuideRestartButton(props: {
    ns: string;
    onOpen: () => void;
    style?: CSSProperties;
}): JSX.Element;
//# sourceMappingURL=guide.d.ts.map