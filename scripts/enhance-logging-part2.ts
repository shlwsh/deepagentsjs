#!/usr/bin/env bun

/**
 * 继续增强技能路由日志 - 第二部分
 * 主要针对 GET /skills/:id 和 PUT /skills/:id
 */

import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..");
const skillsRoutePath = path.join(
  projectRoot,
  "packages/agent-service/src/routes/skills.ts",
);

console.log("🔧 继续增强技能路由日志（第二部分）...\n");
console.log("文件路径:", skillsRoutePath);

// 读取原文件
let content = fs.readFileSync(skillsRoutePath, "utf-8");
const originalContent = content;
let changeCount = 0;

// 备份原文件
const backupPath = skillsRoutePath + ".backup." + Date.now();
fs.writeFileSync(backupPath, originalContent, "utf-8");
console.log("✅ 原文件已备份到:", backupPath, "\n");

// 修改 1: GET /skills/:id - 技能加载成功
if (!content.includes("logger.debug('技能加载成功'")) {
  content = content.replace(
    "if (!skill) {\n      logger.warn('技能不存在', { skillId });\n      return c.json(",
    "if (!skill) {\n      logger.warn('技能不存在', { skillId });\n      return c.json(",
  );

  // 在 if (!skill) 之前添加日志
  content = content.replace(
    "const skill = await loadFullSkill(skillId);\n\n    if (!skill) {",
    "const skill = await loadFullSkill(skillId);\n\n    if (!skill) {",
  );

  // 在 if (!skill) 之后添加成功日志
  content = content.replace(
    "404,\n      );\n    }\n\n    // 读取脚本内容",
    "404,\n      );\n    }\n\n    logger.debug('技能加载成功', { \n      skillId, \n      name: skill.metadata.name,\n      hasScript: !!skill.scriptPath \n    });\n\n    // 读取脚本内容",
  );
  changeCount++;
  console.log("✅ 1. 添加技能加载成功日志");
}

// 修改 2: GET /skills/:id - 读取脚本文件
if (!content.includes("logger.debug('读取脚本文件'")) {
  content = content.replace(
    '// 读取脚本内容\n    let scriptContent: string | undefined;\n    if (skill.scriptPath && fs.existsSync(skill.scriptPath)) {\n      scriptContent = fs.readFileSync(skill.scriptPath, "utf-8");',
    "// 读取脚本内容\n    let scriptContent: string | undefined;\n    if (skill.scriptPath && fs.existsSync(skill.scriptPath)) {\n      logger.debug('读取脚本文件', { scriptPath: skill.scriptPath });\n      scriptContent = fs.readFileSync(skill.scriptPath, \"utf-8\");\n      logger.debug('脚本文件读取成功', { size: scriptContent.length });",
  );
  changeCount++;
  console.log("✅ 2. 添加读取脚本文件日志");
}

// 修改 3: GET /skills/:id - 脚本文件不存在
if (!content.includes("logger.debug('脚本文件不存在'")) {
  content = content.replace(
    "logger.debug('脚本文件读取成功', { size: scriptContent.length });\n    }",
    "logger.debug('脚本文件读取成功', { size: scriptContent.length });\n    } else if (skill.scriptPath) {\n      logger.debug('脚本文件不存在', { scriptPath: skill.scriptPath });\n    }",
  );
  changeCount++;
  console.log("✅ 3. 添加脚本文件不存在日志");
}

// 修改 4: GET /skills/:id - 找到示例文件
if (!content.includes("logger.debug('找到示例文件'")) {
  content = content.replace(
    'if (fs.existsSync(examplesDir)) {\n      const files = fs.readdirSync(examplesDir);\n      examples = files.filter((f) => !f.startsWith("."));\n    }',
    "if (fs.existsSync(examplesDir)) {\n      const files = fs.readdirSync(examplesDir);\n      examples = files.filter((f) => !f.startsWith(\".\"));\n      logger.debug('找到示例文件', { count: examples.length, examples });\n    }",
  );
  changeCount++;
  console.log("✅ 4. 添加找到示例文件日志");
}

// 修改 5: GET /skills/:id - 详情获取成功
if (!content.includes("logger.info('技能详情获取成功'")) {
  content = content.replace(
    'return c.json({\n      status: "success",\n      data: {\n        id: skill.id,\n        metadata: skill.metadata,\n        content: skill.content,\n        script: scriptContent,\n        scriptPath: skill.scriptPath,\n        examples,\n        hasExamples: examples.length > 0,\n      },\n    });',
    "logger.info('技能详情获取成功', { \n      skillId,\n      name: skill.metadata.name,\n      hasScript: !!scriptContent,\n      examplesCount: examples.length\n    });\n\n    return c.json({\n      status: \"success\",\n      data: {\n        id: skill.id,\n        metadata: skill.metadata,\n        content: skill.content,\n        script: scriptContent,\n        scriptPath: skill.scriptPath,\n        examples,\n        hasExamples: examples.length > 0,\n      },\n    });",
  );
  changeCount++;
  console.log("✅ 5. 添加详情获取成功日志");
}

// 修改 6: GET /skills/:id - 错误处理增强
if (
  !content.includes("skillId: c.req.param('id')") &&
  content.includes(
    'logger.error("获取技能详情失败", { error: error.message });',
  )
) {
  content = content.replace(
    'logger.error("获取技能详情失败", { error: error.message });',
    "logger.error('获取技能详情失败', { \n      skillId: c.req.param('id'),\n      error: error.message,\n      stack: error.stack\n    });",
  );
  changeCount++;
  console.log("✅ 6. 增强获取详情错误日志");
}

// 修改 7: PUT /skills/:id - 开始更新
if (
  content.includes('logger.info("更新技能信息", { skillId });') &&
  !content.includes("logger.info('开始更新技能信息'")
) {
  content = content.replace(
    'logger.info("更新技能信息", { skillId });',
    "logger.info('开始更新技能信息', { \n      skillId,\n      hasMetadata: !!metadataStr,\n      hasContent: !!content,\n      hasScript: !!script\n    });",
  );
  changeCount++;
  console.log("✅ 7. 增强开始更新日志");
}

// 修改 8: PUT /skills/:id - 检查技能是否存在
if (
  !content.includes("logger.debug('检查技能是否存在', { skillId });") &&
  content.includes(
    "// 1. 验证技能是否存在\n    const existingSkills = await loadSkillsMetadata();",
  )
) {
  content = content.replace(
    "// 1. 验证技能是否存在\n    const existingSkills = await loadSkillsMetadata();",
    "// 1. 验证技能是否存在\n    logger.debug('检查技能是否存在', { skillId });\n    const existingSkills = await loadSkillsMetadata();",
  );
  changeCount++;
  console.log("✅ 8. 添加检查技能存在日志");
}

// 修改 9: PUT /skills/:id - 技能存在继续更新
if (!content.includes("logger.debug('技能存在，继续更新'")) {
  content = content.replace(
    "404,\n      );\n    }\n\n    // 2. 获取技能路径",
    "404,\n      );\n    }\n\n    logger.debug('技能存在，继续更新', { skillId, name: existingSkill.name });\n\n    // 2. 获取技能路径",
  );
  changeCount++;
  console.log("✅ 9. 添加技能存在继续更新日志");
}

// 修改 10: PUT /skills/:id - 更新 SKILL.md
if (!content.includes("logger.debug('开始更新 SKILL.md'")) {
  content = content.replace(
    "// 4. 写入文件系统\n      if (metadataStr !== undefined && content !== undefined) {\n        const newSkillMd = `---\\n${metadataStr}\\n---\\n\\n${content}`;",
    "// 4. 写入文件系统\n      if (metadataStr !== undefined && content !== undefined) {\n        logger.debug('开始更新 SKILL.md', { skillMdPath });\n        const newSkillMd = `---\\n${metadataStr}\\n---\\n\\n${content}`;",
  );
  changeCount++;
  console.log("✅ 10. 添加开始更新 SKILL.md 日志");
}

// 修改 11: PUT /skills/:id - SKILL.md 更新成功
if (
  content.includes('logger.debug("SKILL.md 更新成功");') &&
  !content.includes("logger.info('SKILL.md 更新成功'")
) {
  content = content.replace(
    'fs.writeFileSync(skillMdPath, newSkillMd, "utf-8");\n        logger.debug("SKILL.md 更新成功");',
    "fs.writeFileSync(skillMdPath, newSkillMd, \"utf-8\");\n        logger.info('SKILL.md 更新成功', { skillId, size: newSkillMd.length });",
  );
  changeCount++;
  console.log("✅ 11. 增强 SKILL.md 更新成功日志");
}

// 修改 12: PUT /skills/:id - 更新 process.ts
if (!content.includes("logger.debug('开始更新 process.ts'")) {
  content = content.replace(
    'if (script !== undefined) {\n        fs.writeFileSync(scriptPath, script, "utf-8");',
    "if (script !== undefined) {\n        logger.debug('开始更新 process.ts', { scriptPath });\n        fs.writeFileSync(scriptPath, script, \"utf-8\");",
  );
  changeCount++;
  console.log("✅ 12. 添加开始更新 process.ts 日志");
}

// 修改 13: PUT /skills/:id - process.ts 更新成功
if (
  content.includes('logger.debug("process.ts 更新成功");') &&
  !content.includes("logger.info('process.ts 更新成功'")
) {
  content = content.replace(
    'fs.writeFileSync(scriptPath, script, "utf-8");\n        logger.debug("process.ts 更新成功");',
    "fs.writeFileSync(scriptPath, script, \"utf-8\");\n        logger.info('process.ts 更新成功', { skillId, size: script.length });",
  );
  changeCount++;
  console.log("✅ 13. 增强 process.ts 更新成功日志");
}

// 修改 14: PUT /skills/:id - 更新数据库缓存
if (!content.includes("logger.debug('开始更新数据库缓存', { skillId });")) {
  content = content.replace(
    "// 6. 更新数据库缓存\n      await skillCache.updateSkill({",
    "// 6. 更新数据库缓存\n      logger.debug('开始更新数据库缓存', { skillId });\n      await skillCache.updateSkill({",
  );
  changeCount++;
  console.log("✅ 14. 添加开始更新数据库缓存日志");
}

// 修改 15: PUT /skills/:id - 数据库缓存更新成功
if (!content.includes("logger.debug('数据库缓存更新成功'")) {
  content = content.replace(
    'metadata: parsedMetadata,\n      });\n\n      logger.info("技能更新成功", { skillId });',
    "metadata: parsedMetadata,\n      });\n      logger.debug('数据库缓存更新成功', { skillId });\n\n      logger.info('技能更新完成', { \n        skillId,\n        name: parsedMetadata.name || existingSkill.name,\n        updatedMetadata: !!metadataStr,\n        updatedScript: !!script\n      });",
  );
  changeCount++;
  console.log("✅ 15. 添加数据库缓存更新成功日志");
}

// 修改 16: PUT /skills/:id - 回滚日志增强
if (
  content.includes(
    'logger.error("更新失败，开始回滚", { error: error.message });',
  ) &&
  !content.includes("stack: error.stack")
) {
  content = content.replace(
    'logger.error("更新失败，开始回滚", { error: error.message });',
    "logger.error('更新失败，开始回滚', { \n        skillId,\n        error: error.message,\n        stack: error.stack\n      });",
  );
  changeCount++;
  console.log("✅ 16. 增强回滚日志");
}

// 修改 17: PUT /skills/:id - 回滚成功详细日志
if (!content.includes("logger.debug('SKILL.md 回滚成功')")) {
  content = content.replace(
    'if (skillMdBackup !== null) {\n          fs.writeFileSync(skillMdPath, skillMdBackup, "utf-8");\n        }',
    "if (skillMdBackup !== null) {\n          fs.writeFileSync(skillMdPath, skillMdBackup, \"utf-8\");\n          logger.debug('SKILL.md 回滚成功');\n        }",
  );
  changeCount++;
  console.log("✅ 17. 添加 SKILL.md 回滚成功日志");
}

// 修改 18: PUT /skills/:id - process.ts 回滚成功
if (!content.includes("logger.debug('process.ts 回滚成功')")) {
  content = content.replace(
    'if (scriptBackup !== null) {\n          fs.writeFileSync(scriptPath, scriptBackup, "utf-8");\n        }',
    "if (scriptBackup !== null) {\n          fs.writeFileSync(scriptPath, scriptBackup, \"utf-8\");\n          logger.debug('process.ts 回滚成功');\n        }",
  );
  changeCount++;
  console.log("✅ 18. 添加 process.ts 回滚成功日志");
}

// 修改 19: PUT /skills/:id - 文件回滚成功
if (
  content.includes('logger.info("文件回滚成功");') &&
  !content.includes("logger.info('文件回滚成功', { skillId })")
) {
  content = content.replace(
    'logger.info("文件回滚成功");',
    "logger.info('文件回滚成功', { skillId });",
  );
  changeCount++;
  console.log("✅ 19. 增强文件回滚成功日志");
}

// 修改 20: PUT /skills/:id - 回滚失败日志
if (
  content.includes(
    'logger.error("文件回滚失败", { error: rollbackError.message });',
  ) &&
  !content.includes("skillId,")
) {
  content = content.replace(
    'logger.error("文件回滚失败", { error: rollbackError.message });',
    "logger.error('文件回滚失败', { \n          skillId,\n          error: rollbackError.message \n        });",
  );
  changeCount++;
  console.log("✅ 20. 增强回滚失败日志");
}

// 修改 21: PUT /skills/:id - 更新失败错误日志
if (
  content.includes('logger.error("更新技能失败", { error: error.message });') &&
  !content.includes("skillId: c.req.param('id')")
) {
  content = content.replace(
    'logger.error("更新技能失败", { error: error.message });',
    "logger.error('更新技能失败', { \n      skillId: c.req.param('id'),\n      error: error.message,\n      stack: error.stack\n    });",
  );
  changeCount++;
  console.log("✅ 21. 增强更新失败错误日志");
}

// 写入修改后的文件
if (changeCount > 0) {
  fs.writeFileSync(skillsRoutePath, content, "utf-8");
  console.log(`\n✨ 完成！共进行了 ${changeCount} 处修改`);
  console.log(`✅ 文件已更新: ${skillsRoutePath}`);
  console.log(`\n💡 如有问题，可从备份恢复:`);
  console.log(`   cp "${backupPath}" "${skillsRoutePath}"`);
} else {
  console.log("\n⚠️  没有进行任何修改（可能已经修改过了）");
}
