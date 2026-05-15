【专家咨询模块 · 后台查看留资】

一、用 Excel 看（推荐）
  文件路径（相对项目根 college-strategy-mvp）：
    data/expert-consult-leads.csv

  绝对路径示例（本机）：
    /Users/albert/Desktop/ONLYLOVE/college-strategy-mvp/data/expert-consult-leads.csv

  说明：
  - 首次有客户成功提交后自动创建。
  - 已带 UTF-8 BOM，Excel 双击打开中文表头不乱码。
  - 列：邮箱、微信、提交时间(UTC)
  - 每提交一次追加一行。

二、原始 JSON 行（给程序或脚本用）
    data/expert-consult-leads.jsonl
  每行一条 JSON。

三、自定义 .jsonl 路径时
  若 .env 里设置了 CONSULT_LEADS_FILE=xxx.jsonl，
  则 CSV 会自动写在同目录、同名后缀改为 .csv（例如 my.jsonl → my.csv）。

四、隐私
  上述文件已 .gitignore，请勿把含真实客户信息的文件推到公开仓库。
