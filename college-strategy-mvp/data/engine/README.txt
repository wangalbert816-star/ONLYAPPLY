OnlyApply Decision Engine — 人话版
===============================

两层逻辑（自动切换）：

1. **顾问 benchmark（v1）** — 画像相似且符合用户预算/地理偏好 → 直接用审过的 9 校
2. **偏好优先算分（v2）** — 先按预算/地理/底线/专业从校表筛选 → 凑不齐时 **AI 按相同约束补校**

偏好（硬约束）：
- 地理：选了具体地区（非 any）→ 校表只选该地区；不够则 AI 补，仍须符合地区
- 预算：need_aid / budget_cap → 排除高价私立，偏公立
- 底线/禁校：dealbreakers 与 forbiddenSchools 传入 AI；禁校硬剔除

文件：
- 审报告 → 改对 9 校 → 提交审阅（写入 benchmark，覆盖相似学生）
- 新类型学生：v2 先用；审完后 benchmark 会逐步接管

文件：
- benchmarks-draft.json / benchmarks-live.json  顾问标准
- school-major-catalog.json  校×专业表（可扩校、扩 major）
- publish-log.json  上线记录

环境变量：
- DECISION_ENGINE_ENABLED=1
- DECISION_ENGINE_V2_ENABLED=1
- DECISION_ENGINE_AI_FILL=1  （校表不够时 AI 补校）
- DECISION_ENGINE_USE_DRAFT=1
