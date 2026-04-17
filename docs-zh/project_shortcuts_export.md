# 项目自定义快捷命令与工作流导出

本文档汇总了本项目（deepagentsjs）中所有的自定义快捷命令及工作流配置。您可以将这些配置直接导入到其他基于相同 AI Agent 开发环境的项目中使用。

## 导入说明
1. 这些工作流命令主要基于项目的 `.agents/workflows/` 目录和 `scripts/` 目录中的 TypeScript 脚本实现。
2. 要在另一项目中完全使用，您需要：
   - 将工作流配置文件放入目标项目的 `.agents/workflows/` 目录下。
   - 确保目标项目中有对应的执行脚本（如 `scripts/git-auto-commit.ts` 等）。
   - 确保目标项目的 `package.json` 或 `bunfig.toml` 配置了对应的快捷执行命令（如 `bun run xyz`）。

---

## 1. 自动提交代码 (mygit)

**功能**：自动拉取所有 Git 变更，通过 LLM 生成标准的 Git Commit 信息并自动提交推送到远程。
**调用方式**：`/mygit` 或 `bun run mygit`

**工作流配置 (`.agents/workflows/mygit.md`)**：
```markdown
---
description: 自动总结代码变更并提交到远程仓库
---

# Git 自动提交工作流

这个工作流会自动完成以下操作:
1. 检测 Git 仓库的所有变更
2. 使用 AI 分析代码变更并生成提交信息
3. 提交代码到本地仓库
4. 推送到远程仓库

## 使用方法

` \`\`\`bash `
bun run mygit
` \`\`\` `

## 工作流程

1. **检查 Git 仓库** - 确认当前目录是 Git 仓库
2. **检测变更** - 获取所有修改、新增、删除的文件
3. **添加到暂存区** - 执行 `git add .`
4. **生成提交信息** - 使用 LLM 分析代码差异,生成规范的提交信息
5. **提交代码** - 执行 `git commit`
6. **推送到远程** - 执行 `git push`
```

---

## 2. 智能合并冲突 (mymerge)

**功能**：自动拉取远端更新（rebase），在遇到冲突时交由 LLM 智能阅读分析多方修改边界并自动整合代码。
**调用方式**：`/mymerge` 或 `bun run mymerge`

**工作流配置 (`.agents/workflows/mymerge.md`)**：
```markdown
---
description: 自动拉取远程代码并使用 LLM 智能合并解决冲突
---

# Git 智能合并工作流

## 使用方法

` \`\`\`bash `
bun run mymerge
` \`\`\` `

## 工作流程

1. **检查 Git 缓存与暂存** - 若直接存在 uncommitted 变化，防丢本地记录
2. **拉取动作** - 以远端分支覆盖进行 `pull --rebase`
3. **冲突切入 (LLM)** - 对每一个报出 `UU`/双重修改等标识的文件进行 `conflict-resolver.ts` 模型唤醒
4. **输出验证** - 获取干净的代码片段直接写入项目文件
5. **继续流程** - 解决全部矛盾以后放行 Git 工具自行完成后续组装。
```

---

## 3. 项目更新总结与升版 (updateproject)

**功能**：检查当前代码变动，通过 AI 总结变动情况，自动产生描述并调用升版脚本，保持迭代节奏清晰。
**调用方式**：`/updateproject`

**工作流配置 (`.agents/workflows/updateproject.md`)**：
```markdown
---
description: 项目更新工作流 - 总结改造内容并升级版本
---

# 项目更新工作流

## 使用方法

` \`\`\`bash `
/updateproject
` \`\`\` `

## 执行步骤

1. 检查代码变更
2. 生成变更总结
3. 调用版本升级接口 (`bun run scripts/upgrade-version.ts --description "<变更总结>"`)
4. 确认升级结果
```

---

## 4. 自动创建新技能 (createskill)

**功能**：通过命令行交互快速初始化全新的能力/技能插件（包括文档、入口脚本、测试等模板）。
**调用方式**：`/createskill` 或 `bun run createskill`

**工作流配置 (`.agents/workflows/createskill.md`)**：
```markdown
---
description: 通过工作流模式创建一个新的技能（Skill）
---

# 创建技能工作流

## 使用方法

` \`\`\`bash `
/createskill
` \`\`\` `

## 执行步骤

1. 收集技能信息（名称、ID、描述等）
2. 创建技能目录结构 (`skills/<skill-id>/`)
3. 生成 `SKILL.md` 配置文件
4. 生成 `process.ts` 执行脚本
5. 提供后续逻辑对接指导
```

---

## 5. 保存当前会话 (savesession)

**功能**：通过 API 获取当前会话信息，由 AI 自动生成本阶段会话总结，与 JSON 源数据一并脱机归档到工作区 `sessions/`。
**调用方式**：`/savesession`

**工作流配置 (`.agents/workflows/savesession.md`)**：
```markdown
---
description: 将当前会话总结并保存到 sessions 目录中
---

# 保存会话工作流

## 使用方法

` \`\`\`bash `
/savesession
` \`\`\` `

## 工作流程

// turbo
1. **执行保存脚本** - 执行 `bun run savesession`
```

---

## 6. 加载已保存会话 (loadsession)

**功能**：重新激活并导入被归档的上一次会话，继续上下文聊天或推进工作进程。
**调用方式**：`/loadsession`

**工作流配置 (`.agents/workflows/loadsession.md`)**：
```markdown
---
description: 自动加载最近一次的会话内容到本次会话中
---

# 恢复会话工作流

## 使用方法

` \`\`\`bash `
/loadsession
` \`\`\` `

## 工作流程

// turbo
1. **执行加载脚本** - 执行 `bun run loadsession`
```

---

## 附录：需要的关联脚本清单
为了使工作流在别的项目顺利点亮，请确保将本项目 `scripts/` 目录下的以下关联逻辑文件一并带走：
- `git-auto-commit.ts`
- `git-auto-merge.ts`
- `conflict-resolver.ts`
- `update-project.ts`
- `create-skill.ts`
- `session-tool.ts` (供 save/load 使用)
- `upgrade-version.ts` 
