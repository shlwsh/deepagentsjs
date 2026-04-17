#!/usr/bin/env bun

/**
 * 测试技能创建完整流程
 * 验证前端可视化工作流创建技能的功能
 */

import * as fs from "fs";
import * as path from "path";

const API_BASE = "http://localhost:8910/api";

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

/**
 * 记录测试结果
 */
function logResult(
  step: string,
  success: boolean,
  message: string,
  data?: any,
) {
  results.push({ step, success, message, data });
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log("   数据:", JSON.stringify(data, null, 2));
  }
}

/**
 * 测试1: 创建技能（模拟前端调用）
 */
async function testCreateSkill() {
  console.log("\n📋 测试1: 创建技能");

  const skillData = {
    id: "test-workflow-skill-" + Date.now(),
    name: "测试工作流技能",
    description: "通过前端可视化工作流创建的测试技能",
    template: "basic",
  };

  try {
    const response = await fetch(`${API_BASE}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skillData),
    });

    const result = await response.json();

    if (result.status === "success") {
      logResult("创建技能", true, "技能创建成功", {
        id: skillData.id,
        path: result.data.path,
      });
      return skillData.id;
    } else {
      logResult("创建技能", false, result.message || result.error);
      return null;
    }
  } catch (error: any) {
    logResult("创建技能", false, `请求失败: ${error.message}`);
    return null;
  }
}

/**
 * 测试2: 获取技能详情
 */
async function testGetSkillDetail(skillId: string) {
  console.log("\n📋 测试2: 获取技能详情");

  try {
    const response = await fetch(`${API_BASE}/skills/${skillId}`);
    const result = await response.json();

    if (result.status === "success") {
      const skill = result.data;
      logResult("获取技能详情", true, "成功获取技能详情", {
        id: skill.id,
        name: skill.metadata.name,
        hasScript: !!skill.script,
        scriptFilesCount: skill.scriptFiles?.length || 0,
        exampleFilesCount: skill.exampleFiles?.length || 0,
      });
      return skill;
    } else {
      logResult("获取技能详情", false, result.message || result.error);
      return null;
    }
  } catch (error: any) {
    logResult("获取技能详情", false, `请求失败: ${error.message}`);
    return null;
  }
}

/**
 * 测试3: 验证文件系统
 */
async function testFileSystem(skillId: string) {
  console.log("\n📋 测试3: 验证文件系统");

  const skillsDir = path.resolve(process.cwd(), "skills");
  const skillPath = path.join(skillsDir, skillId);

  try {
    // 检查技能目录
    if (!fs.existsSync(skillPath)) {
      logResult("文件系统验证", false, "技能目录不存在");
      return false;
    }

    // 检查 SKILL.md
    const skillMdPath = path.join(skillPath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      logResult("文件系统验证", false, "SKILL.md 文件不存在");
      return false;
    }

    // 检查 scripts/process.ts
    const scriptPath = path.join(skillPath, "scripts", "process.ts");
    if (!fs.existsSync(scriptPath)) {
      logResult("文件系统验证", false, "scripts/process.ts 文件不存在");
      return false;
    }

    // 检查 examples 目录
    const examplesDir = path.join(skillPath, "examples");
    if (!fs.existsSync(examplesDir)) {
      logResult("文件系统验证", false, "examples 目录不存在");
      return false;
    }

    logResult("文件系统验证", true, "所有必需文件和目录都存在", {
      skillPath,
      files: ["SKILL.md", "scripts/process.ts", "examples/"],
    });
    return true;
  } catch (error: any) {
    logResult("文件系统验证", false, `验证失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试4: 更新技能
 */
async function testUpdateSkill(skillId: string) {
  console.log("\n📋 测试4: 更新技能");

  const updateData = {
    metadata: `name: 测试工作流技能（已更新）
description: 通过前端可视化工作流创建和更新的测试技能
version: 1.0.1
author: Test System`,
    content: `# 测试工作流技能

这是一个测试技能，用于验证前端可视化工作流的创建和更新功能。

## 更新内容

- 添加了版本号
- 更新了描述信息`,
    script: `/**
 * 测试工作流技能
 * 通过前端可视化工作流创建和更新
 */

export interface Params {
  action?: string;
  input?: any;
}

export async function execute(params: Params): Promise<any> {
  console.log('[test-workflow-skill] 执行操作', params);
  
  return {
    success: true,
    message: '执行成功',
    timestamp: new Date().toISOString(),
  };
}
`,
  };

  try {
    const response = await fetch(`${API_BASE}/skills/${skillId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    const result = await response.json();

    if (result.status === "success") {
      logResult("更新技能", true, "技能更新成功");
      return true;
    } else {
      logResult("更新技能", false, result.message || result.error);
      return false;
    }
  } catch (error: any) {
    logResult("更新技能", false, `请求失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试5: 测试技能执行
 */
async function testSkillExecution(skillId: string) {
  console.log("\n📋 测试5: 测试技能执行");

  try {
    const response = await fetch(`${API_BASE}/skills/${skillId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        params: {
          action: "test",
          input: "测试数据",
        },
      }),
    });

    const result = await response.json();

    if (result.status === "success" && result.data.success) {
      logResult("技能执行", true, "技能执行成功", {
        output: result.data.output,
        duration: result.data.duration,
      });
      return true;
    } else {
      logResult(
        "技能执行",
        false,
        result.data?.error || result.message || "执行失败",
      );
      return false;
    }
  } catch (error: any) {
    logResult("技能执行", false, `请求失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试6: 删除技能（清理）
 */
async function testDeleteSkill(skillId: string) {
  console.log("\n📋 测试6: 删除技能（清理）");

  try {
    const response = await fetch(`${API_BASE}/skills/${skillId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.status === "success") {
      logResult("删除技能", true, "技能删除成功（已移至回收站）", {
        trashPath: result.data.trashPath,
      });
      return true;
    } else {
      logResult("删除技能", false, result.message || result.error);
      return false;
    }
  } catch (error: any) {
    logResult("删除技能", false, `请求失败: ${error.message}`);
    return false;
  }
}

/**
 * 主测试流程
 */
async function main() {
  console.log("🧪 开始测试技能创建完整流程...\n");
  console.log("📍 API 地址:", API_BASE);
  console.log("⏰ 测试时间:", new Date().toLocaleString("zh-CN"));
  console.log("");

  let skillId: string | null = null;

  try {
    // 测试1: 创建技能
    skillId = await testCreateSkill();
    if (!skillId) {
      console.log("\n❌ 创建技能失败，终止测试");
      return;
    }

    // 等待文件系统同步
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 测试2: 获取技能详情
    const skill = await testGetSkillDetail(skillId);
    if (!skill) {
      console.log("\n❌ 获取技能详情失败，终止测试");
      return;
    }

    // 测试3: 验证文件系统
    const fsValid = await testFileSystem(skillId);
    if (!fsValid) {
      console.log("\n❌ 文件系统验证失败");
    }

    // 测试4: 更新技能
    await testUpdateSkill(skillId);

    // 等待更新完成
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 测试5: 测试技能执行
    await testSkillExecution(skillId);

    // 测试6: 删除技能（清理）
    await testDeleteSkill(skillId);
  } catch (error: any) {
    console.error("\n❌ 测试过程中发生错误:", error.message);
  }

  // 输出测试总结
  console.log("\n" + "=".repeat(60));
  console.log("📊 测试总结");
  console.log("=".repeat(60));

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;
  const successRate = ((successCount / totalCount) * 100).toFixed(1);

  console.log(`\n总测试数: ${totalCount}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${totalCount - successCount}`);
  console.log(`成功率: ${successRate}%`);

  if (successCount === totalCount) {
    console.log("\n✅ 所有测试通过！前端可视化工作流创建技能功能正常。");
  } else {
    console.log("\n❌ 部分测试失败，请检查失败的测试项。");
    console.log("\n失败的测试:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.step}: ${r.message}`);
      });
  }

  console.log("");
}

// 执行测试
main().catch(console.error);
