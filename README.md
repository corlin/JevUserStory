# ResolveOps

ResolveOps 是一个可操作的 Jev 决策运营与评测工作台：它把客服案件、结构化判断、确定性策略、人工复核、客户回复、以及 **Decision Lab 批量评测与策略模拟器** 放在同一个系统中。它不是聊天机器人演示，而是用于观察“模型概率判断如何进入商业流程、在哪里必须停下来让人确认、如何零成本微调策略阈值”的完整样例。

## 你可以体验什么

### 1. 案件工作台 (Case Workspace)
- 浏览 30 个中英文模拟客服案件，并按语言与特征切片筛选；
- 通过 Vercel AI Gateway 调用 `typesafe-ai/jev`，一次返回 Boolean、Choice、Score 三类共九个判断；
- 查看每个概率分布、Choice 的最高概率与前两名差距，以及 Score 的完整 rubric；
- 用当前生效的策略版本把结果路由到自动处理、确认、人工审核或阻止；
- 记录幂等的模拟人工决定，不会调用真实支付服务；
- 用 `openai/gpt-5-nano` 生成受批准事实约束的客户回复，再用 Jev 检查越权承诺、政策冲突和内部信息泄露。

### 2. 决策实验室 (Decision Lab)
- **开箱即用基准与实时实测双轨机制**：开箱即带 30 案基准运行数据（`Source: Benchmark Baseline`），零等待查看全盘指标；同时支持显式触发调用真实 AI Gateway（`Source: Live Measured`）；
- **多维动态切片下钻 (Slicing)**：支持按语言（中/英）、提示注入安全对抗、多意图歧义等维度动态切片，观察模型在不同场景下的局部校准与脆弱点（Jaggedness）；
- **零依赖原生 SVG 图表系统**：
  - **ECE 校准图**：10 分箱可靠性图（Reliability Diagram）与对角线基线对比；
  - **混淆矩阵**：分类 Top-1 准确率与 Macro-F1；
  - **覆盖与风险折线**：自动化处理、人工复核、安全阻断分段比例与误退款风险分布；
  - **系统经济学卡片**：P50/P95/P99 延迟分位数、Token 消耗量与预估批次成本。
- **60fps 零 Token 成本策略模拟器**：
  - 浏览器端同构复用纯函数 `evaluatePolicy`；
  - 拖动自动退款门槛、提示注入拦截线、政策支持门限及最低证据分滑块时，毫秒级即时重算 30 案业务动作；
  - 满意后可一键另存为新策略版本入库。

### 3. 策略库治理 (Policy Repository)
- 浏览所有已归档的不可变策略版本快照；
- 支持一键切换主干生效策略（`Active Policy`），无缝驱动案件工作台。

> **安全边界：** 仓库内的客户、订单、付款、物流、审核和退款全部是模拟数据。界面中的退款动作只写入本地 SQLite 审计记录，不会执行真实付款或退款。

## 本地运行

要求 Node.js 24+ 和 npm。

```bash
npm install
```

在项目根目录创建 `.env.local`，然后只在本机编辑器中填写 `AI_GATEWAY_API_KEY`（如需运行实时 Gateway 调用）。不要把密钥粘贴到聊天、终端输出、日志、截图或提交中。`.env.local` 已被 Git 忽略。

启动应用：

```bash
npm run dev
```

打开浏览器访问：
- **案件工作台**：[http://localhost:3000/cases](http://localhost:3000/cases)
- **决策实验室 (Decision Lab)**：[http://localhost:3000/decision-lab](http://localhost:3000/decision-lab)
- **策略治理库 (Policies)**：[http://localhost:3000/policies](http://localhost:3000/policies)

## 验证命令

```bash
npm run check          # 类型检查、87个单元/组件测试、生产构建、密钥泄漏门禁
npm run test:e2e       # Chromium 桌面与移动端 12 个端到端用户旅程测试
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
| `resolveops-policy-*` | 依据显式阈值和业务事实做确定性路由；支持离线秒级模拟 | 不把概率包装成“模型置信度” |
| 人工审核 | 确认、修改、升级或拒绝模拟动作 | 不触发外部支付系统 |

## 数据与指标说明

案件标签、ground truth 和 E2E 响应是为了可重复验收而设计的演示基准，不是生产准确率。界面显示的实时概率、token 使用量和延迟来自对应运行记录；只有在实际执行 Gateway 调用后，才能视为真实测量。Decision Lab 明确通过徽标（`Live Measured` vs `Pre-evaluated Baseline`）区分固定基准结果与真实实测结果。

SQLite 文件写入 `data/`，运行记录与策略版本不可变，人工决定使用幂等键避免重复。密钥、授权头、数据库文件、测试报告和构建输出都不应进入 Git。

> **部署边界：** 当前 SQLite 存储面向单机演示。不要直接把它当作 Vercel Serverless 上的持久化数据库；无持久卷的运行环境无法保证 `data/` 中的写入跨实例、重启或重新部署保留。若要多人或线上使用，应先将 repository 层切换到托管 PostgreSQL 等持久存储，并补充身份认证、租户隔离、备份与恢复。

## English summary

ResolveOps is an end-to-end decision-operations and evaluation workspace for typed Jev models. It combines simulated commerce data, deterministic policy gates, idempotent human review, GPT-5 Nano reply generation, and the **Decision Lab** for batch evaluation, slice-based error analysis (ECE, Macro-F1, MAE), and zero-cost policy simulation. No real payment or refund integration exists. Configure the Gateway credential only in the Git-ignored `.env.local`, then use the commands above to run and verify the application.
