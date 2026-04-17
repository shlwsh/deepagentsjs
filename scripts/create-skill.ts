#!/usr/bin/env bun

/**
 * 技能创建脚本
 * 通过交互式命令行创建新的技能
 */

import * as fs from "fs";
import * as path from "path";

interface SkillConfig {
  name: string;
  id: string;
  description: string;
  version: string;
  author: string;
}

/**
 * 询问用户输入
 */
async function prompt(
  question: string,
  defaultValue?: string,
): Promise<string> {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const promptText = defaultValue
      ? `${question} (默认: ${defaultValue}): `
      : `${question}: `;

    rl.question(promptText, (answer: string) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

/**
 * 收集技能信息
 */
async function collectSkillInfo(): Promise<SkillConfig> {
  console.log("\n🎯 开始创建技能...\n");
  console.log("📝 请提供以下信息:\n");

  const name = await prompt("技能名称（中文）", "示例技能");
  const id = await prompt(
    "技能ID（英文目录名，使用小写和连字符）",
    "example-skill",
  );
  const description = await prompt("技能描述", "这是一个示例技能");
  const version = await prompt("版本号", "1.0.0");
  const author = await prompt("作者", "Agent System");

  return { name, id, description, version, author };
}

/**
 * 创建目录结构
 */
function createDirectories(skillId: string): string {
  const skillPath = path.join(process.cwd(), "skills", skillId);

  if (fs.existsSync(skillPath)) {
    throw new Error(`技能目录已存在: ${skillPath}`);
  }

  console.log("\n📁 创建目录结构...");

  fs.mkdirSync(skillPath, { recursive: true });
  console.log(`   ✅ skills/${skillId}/`);

  fs.mkdirSync(path.join(skillPath, "scripts"), { recursive: true });
  console.log(`   ✅ skills/${skillId}/scripts/`);

  fs.mkdirSync(path.join(skillPath, "examples"), { recursive: true });
  console.log(`   ✅ skills/${skillId}/examples/`);

  return skillPath;
}

/**
 * 生成 SKILL.md 文件
 */
function generateSkillMd(skillPath: string, config: SkillConfig): void {
  const content = `---
name: "${config.name}"
description: "${config.description}"
version: "${config.version}"
author: "${config.author}"
---

## 功能说明

${config.description}

## 使用场景

- "使用${config.name}处理数据"
- "执行${config.name}操作"

## 参数说明

- \`action\`: 操作类型（必填）
  - \`example\`: 示例操作
  - \`process\`: 处理操作
- \`input\`: 输入数据（可选）

## 使用示例

### 示例 1：基础操作

\`\`\`json
{
  "action": "example",
  "input": "测试数据"
}
\`\`\`

### 示例 2：处理操作

\`\`\`json
{
  "action": "process",
  "input": {
    "data": "需要处理的数据"
  }
}
\`\`\`

## 返回值

返回 JSON 格式的操作结果：

\`\`\`json
{
  "success": true,
  "data": "处理结果"
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

- 确保提供正确的操作类型
- 输入数据格式需符合要求
- 所有操作都会记录日志

## 技术实现

- 使用 TypeScript 实现
- 支持异步操作
- 完善的错误处理和日志记录
`;

  fs.writeFileSync(path.join(skillPath, "SKILL.md"), content, "utf-8");
  console.log("   ✅ SKILL.md");
}

/**
 * 生成 process.ts 文件
 */
function generateProcessTs(skillPath: string, config: SkillConfig): void {
  const content = `/**
 * ${config.name}
 * ${config.description}
 */

export interface SkillParams {
  action?: string;
  input?: any; // 兼容技能系统的通用输入
  // 在此添加其他参数定义
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
    console.log(\`[${config.id}] 执行操作: \${action}\`, params);

    // 根据操作类型执行相应逻辑
    switch (action) {
      case 'example':
        // 实现示例操作
        console.log(\`[${config.id}] 执行示例操作\`);
        return {
          success: true,
          data: \`示例操作成功，输入: \${JSON.stringify(params.input)}\`,
        };

      case 'process':
        // 实现处理操作
        console.log(\`[${config.id}] 执行处理操作\`);
        return {
          success: true,
          data: \`处理操作成功，输入: \${JSON.stringify(params.input)}\`,
        };

      default:
        throw new Error(\`不支持的操作类型: \${action}\`);
    }
  } catch (error: any) {
    console.error('[${config.id}] 执行失败:', error);
    return {
      success: false,
      error: \`执行失败: \${error.message}\`,
    };
  }
}
`;

  fs.writeFileSync(
    path.join(skillPath, "scripts", "process.ts"),
    content,
    "utf-8",
  );
  console.log("   ✅ scripts/process.ts");
}

/**
 * 生成示例文件
 */
function generateExamples(skillPath: string, config: SkillConfig): void {
  const exampleContent = {
    description: `${config.name}使用示例`,
    examples: [
      {
        name: "示例操作",
        params: {
          action: "example",
          input: "测试数据",
        },
      },
      {
        name: "处理操作",
        params: {
          action: "process",
          input: {
            data: "需要处理的数据",
          },
        },
      },
    ],
  };

  fs.writeFileSync(
    path.join(skillPath, "examples", "example.json"),
    JSON.stringify(exampleContent, null, 2),
    "utf-8",
  );
  console.log("   ✅ examples/example.json");
}

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 收集技能信息
    const config = await collectSkillInfo();

    console.log("\n📋 技能信息确认:");
    console.log(`   - 技能名称: ${config.name}`);
    console.log(`   - 技能ID: ${config.id}`);
    console.log(`   - 描述: ${config.description}`);
    console.log(`   - 版本: ${config.version}`);
    console.log(`   - 作者: ${config.author}\n`);

    // 2. 创建目录结构
    const skillPath = createDirectories(config.id);

    // 3. 生成文件
    console.log("\n📄 生成配置文件...");
    generateSkillMd(skillPath, config);
    generateProcessTs(skillPath, config);
    generateExamples(skillPath, config);

    // 4. 成功提示
    console.log("\n✅ 技能创建成功！\n");
    console.log(`📍 技能位置: skills/${config.id}/`);
    console.log(`🔧 下一步: 在 scripts/process.ts 中实现业务逻辑`);
    console.log(
      `💡 提示: 可以参考 skills/db-departments/ 或 skills/file-manager/ 的实现\n`,
    );
    console.log(`🧪 测试技能: 通过 Agent 自然语言调用 "${config.name}"\n`);
  } catch (error: any) {
    console.error("\n❌ 创建失败:", error.message);
    process.exit(1);
  }
}

// 执行主函数
main();
