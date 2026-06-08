OnlyApply 专属 Ollama 模型
======================

模型名：wangalbert816/OnlyApplyMial

这是什么
--------
- 现在是「OnlyApply 品牌包装」：固定底座 + 岗位说明（Modelfile）
- 还不是 LoRA 微调权重；大脑档案会在运行时注入参考案例
- 以后训练完可 push 新版本 tag，只改 ONLYAPPLY_LLM_MODEL

生产环境变量（Vercel → Settings → Environment Variables）
-------------------------------------------------------
ONLYAPPLY_LLM_MODEL=wangalbert816/OnlyApplyMial
US_OPENAI_API_KEY=（你的 Ollama 云 key）
US_OPENAI_BASE_URL=https://ollama.com/v1
US_OPENAI_MODEL=gpt-oss:120b          ← 专模失败时的回退

更新 Modelfile 后重新 push
--------------------------
cd college-strategy-mvp/ollama
ollama create wangalbert816/OnlyApplyMial -f Modelfile
ollama push wangalbert816/OnlyApplyMial

验证
----
生成报告后看响应头 X-LLM-Provider=ollama，服务端日志 model=wangalbert816/OnlyApplyMial
