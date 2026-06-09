OnlyApply Decision Engine — 人话版
===============================

两层逻辑（自动切换）：

1. **顾问 benchmark（v1）** — 审过且画像很相似 → 直接用那 9 校
2. **算分引擎（v2）** — 没有完全一致 case 时：
   - 问卷 → 五维分数（学术/标化/活动/rigor/策略）
   - 校×专业表 → 每校 major fit + 录取者参考分
   - 档位规则 → 冲/稳/保各 3 校

你怎么做：
- 审报告 → 改对 9 校 → 提交审阅（写入 benchmark，覆盖相似学生）
- 新类型学生：v2 先用；审完后 benchmark 会逐步接管

文件：
- benchmarks-draft.json / benchmarks-live.json  顾问标准
- school-major-catalog.json  校×专业表（可扩校、扩 major）
- publish-log.json  上线记录

环境变量：
- DECISION_ENGINE_ENABLED=1
- DECISION_ENGINE_V2_ENABLED=1  （算分+规则，默认开）
- DECISION_ENGINE_USE_DRAFT=1
