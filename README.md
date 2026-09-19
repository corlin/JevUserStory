# ResolveOps

ResolveOps 是一个可操作的 Jev 决策演示：它把客服案件、结构化判断、确定性策略、人工复核和客户回复放在同一个工作台中。它不是聊天机器人演示，而是用于观察“模型判断如何进入商业流程、在哪里必须停下来让人确认”的完整样例。

## 你可以体验什么

- 浏览 30 个中英文模拟客服案件，并按语言筛选；
- 通过 Vercel AI Gateway 调用 `typesafe-ai/jev`，一次返回 Boolean、Choice、Score 三类共九个判断；
- 查看每个概率分布、Choice 的最高概率与前两名差距，以及 Score 的完整 rubric；
- 用版本化规则把结果路由到自动处理、确认、人工审核或阻止；
- 记录幂等的模拟人工决定，不会调用支付服务；
- 用 `openai/gpt-5-nano` 生成受批准事实约束的客户回复，再用 Jev 检查越权承诺、政策冲突和内部信息泄露。

> **安全边界：** 仓库内的客户、订单、付款、物流、审核和退款全部是模拟数据。界面中的退款动作只写入本地 SQLite 审计记录，不会执行真实付款或退款。

## 本地运行

要求 Node.js 24+ 和 npm。

```bash
npm install
```

在项目根目录创建 `.env.local`，然后只在本机编辑器中填写 `AI_GATEWAY_API_KEY`。不要把密钥粘贴到聊天、终端输出、日志、截图或提交中。`.env.local` 已被 Git 忽略。

启动应用：

```bash
npm run dev
```

打开 [http://localhost:3000/cases](http://localhost:3000/cases)。

## 验证命令

```bash
npm run check          # 类型、单元测试、生产构建、密钥泄漏门禁
npm run test:e2e       # Chromium 桌面与移动端完整模拟流程
npm run live:smoke     # 真实九问 Jev + GPT-5 Nano + Jev 回复复核
npm run example:evaluate
npm run example:text
```

首次运行浏览器测试时，如本机还没有 Playwright Chromium，请执行 `npx playwright install chromium`。

## 模型与规则的职责

| 组件 | 职责 | 不负责什么 |
| --- | --- | --- |
| `typesafe-ai/jev` | 对共享案件 state 回答九个类型化问题；复核生成回复 | 不直接决定或执行退款 |
| `openai/gpt-5-nano` | 根据已批准动作生成简短客户回复 | 不新增金额、日期或承诺 |
| `resolveops-policy-v1` | 依据显式阈值和业务事实做确定性路由 | 不把概率包装成“模型置信度” |
| 人工审核 | 确认、修改、升级或拒绝模拟动作 | 不触发外部支付系统 |

## 数据与指标说明

案件标签、ground truth 和 E2E 响应是为了可重复验收而设计的演示基准，不是生产准确率。界面显示的实时概率、token 使用量和延迟来自对应运行记录；只有在实际执行 Gateway 调用后，才能视为真实测量。未来 Decision Lab 中的批量准确率、校准、稳定性与成本指标也必须明确区分固定 fixture 结果和真实运行结果。

SQLite 文件写入 `data/`，运行记录不可变，人工决定使用幂等键避免重复。密钥、授权头、数据库文件、测试报告和构建输出都不应进入 Git。

## English summary

ResolveOps is an end-to-end decision-operations demo for typed Jev evaluations. It uses entirely simulated commerce data, deterministic policy gates, idempotent human review, GPT-5 Nano reply generation, and a second Jev safety check. No real payment or refund integration exists. Configure the Gateway credential only in the Git-ignored `.env.local`, then use the commands above to run and verify the application.
