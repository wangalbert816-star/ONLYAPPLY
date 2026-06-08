OnlyApply 训练大脑 — 使用说明（非程序员版）
========================================

这个文件夹是 OnlyApply 的「大脑档案柜」。
你每审完一个 case 并点「提交」，系统会自动把认可的结果存进来。

文件说明
--------
gold-cases.jsonl  — 金牌案例（一行一个 JSON，不要手改）

你怎么做（每周 routine）
------------------------
1. 打开后台 → 评测 harness
2. 跑一批报告 → 你审校名单 → 改到满意 → 点「提交」
3. 看页面上的「大脑档案：已收录 N 条」数字是否在涨
4. 继续审，目标先到 20 条，再到 50 条

系统会怎么用这些案例
--------------------
- 立刻：下次生成相似学生的报告时，会自动参考 2 个最像的金牌案例
- 以后：案例够多后，可导出训练包，给 OnlyApplyMial 做真微调

给 Cursor / 程序员
------------------
- 一键从 harness 同步：POST /api/admin/crm/training-corpus/sync-from-eval
- 查看档案：GET /api/admin/crm/training-corpus
- 导出 LoRA 训练包：GET /api/admin/crm/training-corpus/export/sft-jsonl
- 本地重种历史案例：node scripts/seed-training-corpus.mjs
- 环境变量：
  TRAINING_CORPUS_ENABLED=1   （默认开）
  TRAINING_CORPUS_FEWSHOT=2   （参考几个案例）
