# ResolveOps 阶段二（Decision Lab 决策实验室）实施计划

ResolveOps 阶段一已成功交付可操作的单案工作台与安全闭环。本计划旨在推进**阶段二（Phase 2：Decision Lab 决策实验室与策略治理）**的完整落地。

Decision Lab 为业务运营与安全分析师提供完整的评测大盘与策略调优工作台：支持不可变版本管理、多维度切片分析（语言/注入攻击/复杂度）、基于已有概率数据的 60fps 零 Token 成本交互式策略模拟、以及高精度的模型校准度（ECE）与业务漏判率度量。

---

## 核心架构决策基线

1. **批量运行执行**：本地 SQLite + 服务端并发受限（Concurrency=2）异步批处理 + 前端轮询机制。
2. **版本化治理**：代码预置基准（v1）+ SQLite 派生快照（只读不可变模式，严禁原地覆盖）。
3. **策略模拟器**：客户端利用同构纯函数 `evaluatePolicy` 进行 60fps 响应式即时重算，满意后显式提交发布为新策略版本。
4. **评测数据与切片**：以 30 案标准基准为核心，支持语言（中/英）、提示注入（安全对抗）、客户层级与案件复杂度多维动态切片。
5. **信息架构与路由**：新增 `/decision-lab`（实验/指标/模拟一体化）与 `/policies`（策略库治理）两个协同主路由，激活全局导航。
6. **数据冷启动**：初始化即播种基准评估快照（零冷启动等待），同时支持真实调用 Jev，并在 UI 上用强视觉徽标（`Live Measured` vs `Pre-evaluated Baseline`）明确隔离数据来源。
7. **可视化组件技术栈**：采用原生 SVG + 语义化 HTML/CSS 自研轻量图表，零额外 npm 依赖，100% 兼容 React 19。

---

## 阶段二任务拆解 (Tasks)

### Task 1: 数据层与存储模块 (Database & Persistence)
- [ ] **Step 1: 编写实验仓储与策略仓储失败测试** (`tests/db/experiment-repository.test.ts`, `tests/db/policy-repository.test.ts`)
- [ ] **Step 2: 扩展 SQLite Schema** (`src/db/schema.ts` 增加 experiments, experiment_case_results, question_set_versions, policy_versions 表及索引)
- [ ] **Step 3: 实现实验与策略仓储** (`src/db/experiment-repository.ts`, `src/db/policy-repository.ts`)
- [ ] **Step 4: 验证仓储单元测试通过**

### Task 2: 纯函数指标引擎 (Metrics Engine)
- [ ] **Step 1: 编写指标引擎边界单测** (`tests/metrics/metrics-engine.test.ts` 覆盖 Accuracy, Macro-F1, Score MAE, 10-bin ECE 校准度, 商业漏判率, 切片聚合)
- [ ] **Step 2: 实现数学计算纯函数** (`src/metrics/metrics-engine.ts`)
- [ ] **Step 3: 验证指标计算测试全部通过**

### Task 3: 批量评测编排服务 (Batch Experiment Service)
- [ ] **Step 1: 编写批量执行与基准播种单测** (`tests/services/experiment-service.test.ts`)
- [ ] **Step 2: 实现服务编排器** (`src/services/experiment-service.ts` 支持并发控制、异常保护与基准生成)
- [ ] **Step 3: 验证服务单测通过**

### Task 4: 实验与策略 API 端点 (API Routes)
- [ ] **Step 1: 编写 API 路由测试** (`tests/api/experiments.test.ts`, `tests/api/policies.test.ts`)
- [ ] **Step 2: 实现路由处理器**
  - `app/api/experiments/route.ts`
  - `app/api/experiments/[id]/route.ts`
  - `app/api/policies/route.ts`
  - `app/api/policies/active/route.ts`
- [ ] **Step 3: 验证路由 API 测试全部通过**

### Task 5: 原生 SVG 图表组件系统 (Zero-Dependency Visualizations)
- [ ] **Step 1: 编写组件测试与 ARIA 无障碍断言** (`tests/components/metrics-charts.test.tsx`)
- [ ] **Step 2: 实现图表组件**
  - `components/metrics/calibration-chart.tsx` (10-bin ECE SVG 图)
  - `components/metrics/confusion-matrix.tsx` (混淆矩阵网格)
  - `components/metrics/coverage-risk-chart.tsx` (Coverage vs Risk 曲线)
  - `components/metrics/performance-summary.tsx` (延迟分布与 Token 成本)
- [ ] **Step 3: 验证图表组件测试通过**

### Task 6: 交互式策略模拟器组件 (Policy Simulator)
- [ ] **Step 1: 编写模拟器联动与重算单测** (`tests/components/policy-simulator.test.tsx`)
- [ ] **Step 2: 实现客户端响应式模拟器** (`components/decision-lab/policy-simulator.tsx`)
- [ ] **Step 3: 验证模拟器单测通过**

### Task 7: 页面集成与全局导航 (App Router Pages)
- [ ] **Step 1: 编写页面渲染测试** (`tests/smoke/decision-lab-page.test.tsx`)
- [ ] **Step 2: 实现 `/decision-lab` 完整大盘页面** (`app/decision-lab/page.tsx`)
- [ ] **Step 3: 实现 `/policies` 策略版本库页面** (`app/policies/page.tsx`)
- [ ] **Step 4: 激活全局导航与路由联动** (`components/app-shell.tsx`)

### Task 8: 全量端到端验收与安全门禁 (E2E & Security Gate)
- [ ] **Step 1: 编写 Playwright 端到端用户旅程测试** (`e2e/decision-lab.spec.ts`)
- [ ] **Step 2: 运行端到端测试与全量门禁检验** (`npm run check`, `npm run test:e2e`)
