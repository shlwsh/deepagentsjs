# DeepAgentsJS 项目结构与开发指南

## 1. 项目简介

本仓库 (`deepagentsjs-monorepo`) 是由 LangChain 团队开发的用于构建可控 AI Agent 的核心库，基于 LangGraph 构建。它提供了一套“开箱即用”的 Agent 框架，内置了计划（Planning）、文件系统读写（Filesystem）、子代理委托（Sub-agents）以及智能默认提示词和上下文管理。开发者可以快速启动一个具有较强能力的 Agent，或者根据需要自定义工具、大语言模型和系统提示词。

项目采用 Monorepo（单体仓库）结构。

## 2. 目录结构说明

### 根目录核心文件

- `package.json`: 根目录的配置，包含全局的 lint, build, test 等命令，使用 Bun 管理工作区。
- `pnpm-workspace.yaml`: （本项目虽然包含历史的 pnpm 工作流，但在基于最新项目规范下，统一使用 `bun` 运行）。
- `oxlintrc.jsonc` & `oxfmtrc.jsonc`: 使用高效的 Oxlint / Oxfmt 工具链进行代码静态检查与格式化。

### 核心目录分析

#### `/libs` (核心库)
核心库所在的文件夹：
- **`deepagents`**: 最核心的主体包。提供了 `createDeepAgent` 接口，支持内置基础能力工具（`read_file`, `write_todos`, `task` 子任务委派等）。
- **`providers`**: 工具和沙盒环境提供商（Providers）的扩展库，包含 `daytona`, `deno`, `modal`, `node-vfs`, `quickjs`，为 Agent 提供安全的运行时、沙盒与底层系统API。
- **`acp`**: 提供特定的上下文或通信协议封装。
- **`standard-tests`**: 提供在不同环境与提供商下的标准合规性测试。

#### `/examples` (示例代码)
包含了各类典型场景下的 Agent 运行实例：
- `research`: 调研 Agent 示例。
- `hierarchical`: 层级 Agent（多 Agent 协作）示例。
- `memory`: 带记忆的 Agent 示例。
- `sandbox`: 沙盒操作示例。
- `streaming`: 数据流传输 Agent 示例。
- `skills`: 提供特定技能设定的 Agent。

#### `/evals` (评测与基准)
自动化测试与能力评测套件，用于评估模型与 Agent 在各种环境下的表现：
- 包含 `memory-agent-bench`, `oolong`, `tool-selection` 等专业 benchmark。
- 通过 Vitest 驱动执行各项测评。

#### `/internal` (内部工具)
目前包含 `eval-harness` 测评标定工具，负责管理和集成在 CI 环境下的各类评估标准。

## 3. 开发环境配置与上手

> **注意：遵循本项目的全局开发规范，所有开发环境操作必需使用 `bun` 作为运行时和包管理工具。**

### 3.1 前置要求
确保本地已安装 [Bun](https://bun.sh/) 最新版本。

### 3.2 依赖安装
在项目根目录下执行：
```bash
# 统一依赖安装
bun install
```

### 3.3 常用命令

以下为核心的开发脚本：

- **构建所有包（Build）：**
  ```bash
  bun run build
  ```
  该命令会自动编译 `./libs/*` 以及 `./libs/providers/*`。

- **代码格式化与检查（Lint & Check）：**
  ```bash
  bun run typecheck
  bun run format:check
  bun run lint
  ```
  如需自动修复：`bun run lint:fix`

- **运行测试（Test）：**
  ```bash
  # 运行基础库和工作区的单元与集成测试
  bun run test
  
  # 或者运行更具体的测试：
  bun run test:unit
  bun run test:int
  ```

## 4. 如何开始开发或修改？

### 修改核心机制
如果你想要调整深度 Agent 的基础逻辑（提示词模板、工具分配规则等），请直接在 `/libs/deepagents` 目录下开发。修改后，可通过 `bun run dev` (针对具体的 lib 包) 进行实时编译，并在 `/examples` 目录中选择相应的示例进行测试验证。

### 新增 Provider 或沙盒能力
如果你希望 Agent 能连接到新的能力提供商（如新的远程执行环境），需要在 `/libs/providers` 目录下新建对应包，同时参考现有的 `deno` 或 `daytona` 包，暴露出符合 `standard-tests` 所规定的能力接口。然后在 `/examples/sandbox` 中加入相关的验证用例。

### 测试用例增补
对于任何重要功能的新增（尤其是底层工具和逻辑决策），需要在对应的 `/evals` 目录下添加用例。运行 `bunx vitest` 来保障代码通过率。

## 5. 项目架构与扩展规范
- **包模块隔离**：不要跨包引用未导出的内部模块，所有的能力依赖须在 workspace 中清晰声明。
- **测试覆盖率**：根据代码调整，补充相应的 Playwright 集成测试和 Vitest 单元测试，保证所有逻辑流能稳定运行且快速失败（Fast-fail）。
- **完善的日志系统**：在开发阶段和线上环境添加足够的日志锚点（尤其在工具调用和网络交互边界）。
