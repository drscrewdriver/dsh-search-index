/**
 * dsh-search-index 的首次使用引导文案（3 步；结构与 word 走 guide-kit 的统一契约）。
 *
 * 为什么单独一个文件：`guide.tsx` 是 `_tools/guide-kit/` 的**生成副本**（会被同步覆盖），
 * 与本插件相关的文案不能放在里面，否则下一次 sync 就没了。
 */
import type { GuideLocale, GuideStep } from './guide.tsx'

export const SEARCH_GUIDE_STEPS: Partial<Record<GuideLocale, readonly GuideStep[]>> = {
  zh: [
    {
      title: '先建索引，再搜索',
      body: '搜索走本地索引，索引没建过就是空的。打开设置卡里的「索引」块点一次同步，之后新增内容会自动增量补。',
    },
    {
      title: '两个入口',
      body: '侧栏放大镜打开整页搜索面板；输入框旁的按钮是当前会话内的快速定位。两者读同一份索引。',
    },
    {
      title: '搜不到先看状态',
      body: '面板顶部的状态条会说话：未建立 / 重建中 / 直接报错。冷数据（很久以前、从未打开的会话）需要先回溯加载才进索引。',
    },
  ],
  en: [
    {
      title: 'Index first, then search',
      body: 'Search reads a local index; with no index the results are simply empty. Open the settings card, hit sync once in the Index block — later content is picked up incrementally.',
    },
    {
      title: 'Two entry points',
      body: 'The sidebar magnifier opens the full-page search panel; the button near the composer does a quick locate inside the current session. Both read the same index.',
    },
    {
      title: 'Nothing found? Check the status',
      body: 'The status strip at the top says it plainly: not built / rebuilding / error. Cold sessions (old, never opened) must be backfilled before they enter the index.',
    },
  ],
}
