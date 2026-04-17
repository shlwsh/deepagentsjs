#!/usr/bin/env bun

/**
 * 简单直接地增强技能路由日志
 */

import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..");
const skillsRoutePath = path.join(
  projectRoot,
  "packages/agent-service/src/routes/skills.ts",
);

console.log("🔧 开始增强技能路由日志...\n");
console.log("文件路径:", skillsRoutePath);

// 读取原文件
let content = fs.readFileSync(skillsRoutePath, "utf-8");
const originalContent = content;
let changeCount = 0;

// 备份原文件
const backupPath = skillsRoutePath + ".backup." + Date.now();
fs.writeFileSync(backupPath, originalContent, "utf-8");
console.log("✅ 原文件已备份到:", backupPath, "\n");

// 修改 1: POST /skills - 验证必需字段失败
if (
  content.includes("// 1. 验证必需字段") &&
  !content.includes("logger.warn('创建技能失败：缺少必需字段'")
) {
  content = content.replace(
    "// 1. 验证必需字段\n    if (!skillId || !name || !description) {\n      return c.json(",
    "// 1. 验证必需字段\n    if (!skillId || !name || !description) {\n      logger.warn('创建技能失败：缺少必需字段', { skillId, name, description });\n      return c.json(",
  );
  changeCount++;
  console.log("✅ 1. 添加验证必需字段失败日志");
}

// 修改 2: POST /skills - 验证 ID 格式
if (
  content.includes("// 2. 验证 ID 格式（kebab-case）") &&
  !content.includes("logger.debug('验证技能 ID 格式'")
) {
  content = content.replace(
    "// 2. 验证 ID 格式（kebab-case）\n    const kebabCaseRegex",
    "// 2. 验证 ID 格式（kebab-case）\n    logger.debug('验证技能 ID 格式', { skillId });\n    const kebabCaseRegex",
  );
  changeCount++;
  console.log("✅ 2. 添加验证 ID 格式日志");
}

// 修改 3: POST /skills - ID 格式不正确
if (!content.includes("logger.warn('创建技能失败：ID 格式不正确'")) {
  content = content.replace(
    "if (!kebabCaseRegex.test(skillId)) {\n      return c.json(",
    "if (!kebabCaseRegex.test(skillId)) {\n      logger.warn('创建技能失败：ID 格式不正确', { skillId });\n      return c.json(",
  );
  changeCount++;
  console.log("✅ 3. 添加 ID 格式不正确日志");
}

// 修改 4: POST /skills - 检查 ID 唯一性
if (
  content.includes("// 3. 检查 ID 唯一性") &&
  !content.includes("logger.debug('检查技能 ID 唯一性'")
) {
  content = content.replace(
    "// 3. 检查 ID 唯一性\n    const existingSkills = await loadSkillsMetadata();",
    "// 3. 检查 ID 唯一性\n    logger.debug('检查技能 ID 唯一性', { skillId });\n    const existingSkills = await loadSkillsMetadata();",
  );
  changeCount++;
  console.log("✅ 4. 添加检查 ID 唯一性日志");
}

// 修改 5: POST /skills - ID 已存在
if (!content.includes("logger.warn('创建技能失败：ID 已存在'")) {
  content = content.replace(
    "if (existingSkills.some((s) => s.id === skillId)) {\n      return c.json(",
    "if (existingSkills.some((s) => s.id === skillId)) {\n      logger.warn('创建技能失败：ID 已存在', { skillId });\n      return c.json(",
  );
  changeCount++;
  console.log("✅ 5. 添加 ID 已存在日志");
}

// 修改 6: POST /skills - 准备创建目录
if (!content.includes("logger.debug('准备创建技能目录'")) {
  content = content.replace(
    "const skillPath = path.join(skillsDir, skillId);\n\n    // 5. 创建目录结构",
    "const skillPath = path.join(skillsDir, skillId);\n    logger.debug('准备创建技能目录', { skillsDir, skillPath });\n\n    // 5. 创建目录结构",
  );
  changeCount++;
  console.log("✅ 6. 添加准备创建目录日志");
}

// 修改 7: POST /skills - 目录已存在
if (!content.includes("logger.warn('创建技能失败：目录已存在'")) {
  content = content.replace(
    "// 5. 创建目录结构\n    if (fs.existsSync(skillPath)) {\n      return c.json(",
    "// 5. 创建目录结构\n    if (fs.existsSync(skillPath)) {\n      logger.warn('创建技能失败：目录已存在', { skillPath });\n      return c.json(",
  );
  changeCount++;
  console.log("✅ 7. 添加目录已存在日志");
}

// 修改 8: POST /skills - 目录创建成功
if (!content.includes("logger.debug('技能目录结构创建成功'")) {
  content = content.replace(
    'fs.mkdirSync(path.join(skillPath, "examples"), { recursive: true });\n\n    // 6. 生成 SKILL.md 内容',
    "fs.mkdirSync(path.join(skillPath, \"examples\"), { recursive: true });\n    logger.debug('技能目录结构创建成功', { skillPath });\n\n    // 6. 生成 SKILL.md 内容",
  );
  changeCount++;
  console.log("✅ 8. 添加目录创建成功日志");
}

// 修改 9: POST /skills - 开始写入文件
if (!content.includes("logger.debug('开始写入技能文件'")) {
  content = content.replace(
    '// 8. 写入文件\n    try {\n      fs.writeFileSync(\n        path.join(skillPath, "SKILL.md"),',
    '// 8. 写入文件\n    logger.debug(\'开始写入技能文件\', { skillPath });\n    const skillMdPath = path.join(skillPath, "SKILL.md");\n    const scriptFilePath = path.join(skillPath, "scripts", "process.ts");\n    \n    try {\n      fs.writeFileSync(\n        skillMdPath,',
  );
  changeCount++;
  console.log("✅ 9. 添加开始写入文件日志");
}

// 修改 10: POST /skills - SKILL.md 写入成功
if (!content.includes("logger.debug('SKILL.md 写入成功'")) {
  content = content.replace(
    'skillMdContent,\n        "utf-8",\n      );\n      fs.writeFileSync(\n        path.join(skillPath, "scripts", "process.ts"),',
    "skillMdContent,\n        \"utf-8\",\n      );\n      logger.debug('SKILL.md 写入成功', { path: skillMdPath });\n      \n      fs.writeFileSync(\n        scriptFilePath,",
  );
  changeCount++;
  console.log("✅ 10. 添加 SKILL.md 写入成功日志");
}

// 修改 11: POST /skills - process.ts 写入成功
if (!content.includes("logger.debug('process.ts 写入成功'")) {
  content = content.replace(
    'scriptContent,\n        "utf-8",\n      );\n\n      logger.info("技能文件创建成功", { skillPath });',
    'scriptContent,\n        "utf-8",\n      );\n      logger.debug(\'process.ts 写入成功\', { path: scriptFilePath });\n\n      logger.info("技能文件创建成功", { skillPath });',
  );
  changeCount++;
  console.log("✅ 11. 添加 process.ts 写入成功日志");
}

// 修改 12: POST /skills - 写入失败清理
if (!content.includes("logger.error('写入文件失败，开始清理'")) {
  content = content.replace(
    "} catch (error: any) {\n      // 创建失败，清理目录\n      if (fs.existsSync(skillPath)) {",
    "} catch (error: any) {\n      logger.error('写入文件失败，开始清理', { error: error.message, skillPath });\n      // 创建失败，清理目录\n      if (fs.existsSync(skillPath)) {",
  );
  changeCount++;
  console.log("✅ 12. 添加写入失败清理日志");
}

// 修改 13: POST /skills - 清理完成
if (!content.includes("logger.debug('已清理失败的技能目录'")) {
  content = content.replace(
    "fs.rmSync(skillPath, { recursive: true, force: true });\n      }",
    "fs.rmSync(skillPath, { recursive: true, force: true });\n        logger.debug('已清理失败的技能目录', { skillPath });\n      }",
  );
  changeCount++;
  console.log("✅ 13. 添加清理完成日志");
}

// 修改 14: POST /skills - 开始更新缓存
if (!content.includes("logger.debug('开始更新技能缓存', { skillId })")) {
  content = content.replace(
    "// 9. 更新缓存\n    await skillCache.updateSkill({",
    "// 9. 更新缓存\n    logger.debug('开始更新技能缓存', { skillId });\n    try {\n      await skillCache.updateSkill({",
  );
  changeCount++;
  console.log("✅ 14. 添加开始更新缓存日志");
}

// 修改 15: POST /skills - 缓存更新成功
if (!content.includes("logger.debug('技能缓存更新成功', { skillId })")) {
  content = content.replace(
    'metadata: extraMetadata,\n    });\n\n    logger.info("技能创建成功", { skillId });',
    "metadata: extraMetadata,\n      });\n      logger.debug('技能缓存更新成功', { skillId });\n    } catch (cacheError: any) {\n      logger.error('更新技能缓存失败', { skillId, error: cacheError.message });\n      // 缓存更新失败不影响技能创建\n    }\n\n    logger.info('技能创建完成', { \n      skillId, \n      name,\n      path: skillPath,\n      hasScript: !!script,\n      template \n    });",
  );
  changeCount++;
  console.log("✅ 15. 添加缓存更新成功日志");
}

// 修改 16: POST /skills - 创建失败错误
if (
  !content.includes("stack: error.stack") &&
  content.includes('logger.error("创建技能失败", { error: error.message });')
) {
  content = content.replace(
    'logger.error("创建技能失败", { error: error.message });',
    "logger.error('创建技能失败', { \n      error: error.message,\n      stack: error.stack\n    });",
  );
  changeCount++;
  console.log("✅ 16. 增强创建失败错误日志");
}

// 修改 17: GET /skills/:id - 开始获取详情
if (
  content.includes('logger.info("获取技能详情", { skillId });') &&
  !content.includes("logger.info('开始获取技能详情'")
) {
  content = content.replace(
    'logger.info("获取技能详情", { skillId });\n\n    // 加载完整的 Skill 数据\n    const skill = await loadFullSkill(skillId);',
    "logger.info('开始获取技能详情', { skillId });\n\n    // 加载完整的 Skill 数据\n    logger.debug('从文件系统加载技能', { skillId });\n    const skill = await loadFullSkill(skillId);",
  );
  changeCount++;
  console.log("✅ 17. 添加开始获取详情日志");
}

// 修改 18: GET /skills/:id - 技能不存在
if (
  !content.includes("logger.warn('技能不存在', { skillId });") &&
  content.includes(
    'if (!skill) {\n      return c.json(\n        {\n          status: "error",\n          message: "技能不存在",',
  )
) {
  content = content.replace(
    'if (!skill) {\n      return c.json(\n        {\n          status: "error",\n          message: "技能不存在",',
    'if (!skill) {\n      logger.warn(\'技能不存在\', { skillId });\n      return c.json(\n        {\n          status: "error",\n          message: "技能不存在",',
  );
  changeCount++;
  console.log("✅ 18. 添加技能不存在日志");
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
