---
description: 通过工作流模式创建一个新的技能（Skill）
---

# 创建技能工作流

此工作流用于快速创建一个新的技能（Skill），包括目录结构、配置文件和实现脚本。

## 使用方法

### 方式1: 工作流命令（推荐）

```bash
/createskill
```

### 方式2: 直接运行脚本

```bash
bun run createskill
```

或

```bash
bun run scripts/create-skill.ts
```

## 执行步骤

### 1. 收集技能信息

询问用户以下信息：

- **技能名称**（中文）：例如 "数据分析工具"
- **技能ID**（英文目录名）：例如 "data-analyzer"
- **技能描述**：简短描述技能的功能
- **版本号**：默认 "1.0.0"
- **作者**：默认 "Agent System"

### 2. 创建技能目录结构

在 `skills/` 目录下创建以下结构：

```
skills/<skill-id>/
├── SKILL.md          # 技能配置和说明文档
├── scripts/          # 脚本目录
│   └── process.ts    # 主执行脚本
└── examples/         # 示例目录（可选）
    └── example.json  # 使用示例
```

### 3. 生成 SKILL.md 配置文件

创建包含以下内容的 SKILL.md：

```markdown
---
name: "<技能名称>"
description: "<技能描述>"
version: "<版本号>"
author: "<作者>"
---

## 功能说明

<详细功能说明>

## 使用场景

- "场景示例1"
- "场景示例2"

## 参数说明

- `action`: 操作类型（必填）
  - `<action1>`: 操作1说明
  - `<action2>`: 操作2说明
- `<param1>`: 参数1说明
- `<param2>`: 参数2说明

## 使用示例

### 示例 1：基础操作

\`\`\`json
{
"action": "example",
"param1": "value1"
}
\`\`\`

## 返回值

返回 JSON 格式的操作结果：

\`\`\`json
{
"success": true,
"data": "结果数据"
}
\`\`\`

或错误情况：

\`\`\`json
{
"success": false,
"error": "错误信息"
}
\`\`\`

## 注意事项

- 注意事项1
- 注意事项2

## 技术实现

- 实现细节说明
```

### 4. 生成 process.ts 执行脚本

创建包含以下模板的 process.ts：

```typescript
/**
 * <技能名称>
 * <技能描述>
 */

export interface SkillParams {
  action?: string;
  input?: any; // 兼容技能系统的通用输入
  // 添加其他参数定义
}

export interface SkillResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 执行技能
 */
export async function execute(
  params: SkillParams,
): Promise<SkillResult> {
  try {
    // 解析 input 参数（兼容技能系统）
    if (params.input && typeof params.input === 'object') {
      params = { ...params, ...params.input };
    }

    const action = params.action || 'default';
    console.log(\`[<skill-id>] 执行操作: \${action}\`, params);

    // 根据操作类型执行相应逻辑
    switch (action) {
      case 'example':
        // 实现示例操作
        return {
          success: true,
          data: '操作成功',
        };

      default:
        throw new Error(\`不支持的操作类型: \${action}\`);
    }
  } catch (error: any) {
    console.error('[<skill-id>] 执行失败:', error);
    return {
      success: false,
      error: \`执行失败: \${error.message}\`,
    };
  }
}
```

### 5. 创建示例文件（可选）

在 `examples/` 目录下创建 `example.json`：

```json
{
  "action": "example",
  "description": "这是一个使用示例"
}
```

### 6. 验证技能创建

执行以下检查：

- 确认目录结构正确
- 确认 SKILL.md 格式正确
- 确认 process.ts 语法正确
- 提示用户技能创建成功

### 7. 提供后续指导

告知用户：

1. 技能已创建在 `skills/<skill-id>/` 目录
2. 需要在 `process.ts` 中实现具体的业务逻辑
3. 可以通过 Agent 自然语言调用此技能
4. 建议添加详细的日志记录和错误处理

## 输出示例

```
🎯 开始创建技能...

📝 收集技能信息:
   - 技能名称: 数据分析工具
   - 技能ID: data-analyzer
   - 描述: 用于分析和处理数据的工具集
   - 版本: 1.0.0

📁 创建目录结构...
   ✅ skills/data-analyzer/
   ✅ skills/data-analyzer/scripts/
   ✅ skills/data-analyzer/examples/

📄 生成配置文件...
   ✅ SKILL.md
   ✅ scripts/process.ts
   ✅ examples/example.json

✅ 技能创建成功！

📍 技能位置: skills/data-analyzer/
🔧 下一步: 在 scripts/process.ts 中实现业务逻辑
💡 提示: 可以参考 skills/db-departments/ 或 skills/file-manager/ 的实现
```

## 注意事项

1. **技能ID命名规范**：使用小写字母和连字符，例如 `my-skill`
2. **参数兼容性**：确保支持 `input` 参数以兼容技能系统
3. **错误处理**：所有操作都应有完善的 try-catch 错误处理
4. **日志记录**：使用 console.log 记录关键操作，便于调试
5. **返回格式**：统一使用 `{ success, data, error }` 格式

## 相关命令

- 查看现有技能：`ls skills/`
- 测试技能：通过 Agent 自然语言调用
- 删除技能：`rm -rf skills/<skill-id>/`

## 工作流脚本

此工作流会自动执行以下操作：

1. 交互式收集技能信息
2. 创建完整的目录结构
3. 生成配置文件和模板代码
4. 验证创建结果
5. 提供后续开发指导

所有步骤都会有清晰的日志输出，方便追踪执行过程。
