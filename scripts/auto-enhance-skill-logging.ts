#!/usr/bin/env bun

/**
 * 自动增强技能路由日志
 */

import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..");
const skillsRoutePath = path.join(
  projectRoot,
  "packages/agent-service/src/routes/skills.ts",
);

console.log("🔧 开始自动增强技能路由日志...\n");

// 读取原文件
let content = fs.readFileSync(skillsRoutePath, "utf-8");
const originalContent = content;

// 1. 增强 POST /skills - 创建技能的日志
console.log("1️⃣  增强创建技能日志...");

// 1.1 验证必需字段失败
content = content.replace(
  /\/\/ 1\. 验证必需字段\s+if \(!skillId \|\| !name \|\| !description\) \{\s+return c\.json\(/,
  `// 1. 验证必需字段
    if (!skillId || !name || !description) {
      logger.warn('创建技能失败：缺少必需字段', { skillId, name, description });
      return c.json(`,
);

// 1.2 验证 ID 格式失败
content = content.replace(
  /\/\/ 2\. 验证 ID 格式（kebab-case）\s+const kebabCaseRegex = \/\^/,
  `// 2. 验证 ID 格式（kebab-case）
    logger.debug('验证技能 ID 格式', { skillId });
    const kebabCaseRegex = /^`,
);

content = content.replace(
  /if \(!kebabCaseRegex\.test\(skillId\)\) \{\s+return c\.json\(/,
  `if (!kebabCaseRegex.test(skillId)) {
      logger.warn('创建技能失败：ID 格式不正确', { skillId });
      return c.json(`,
);

// 1.3 检查 ID 唯一性
content = content.replace(
  /\/\/ 3\. 检查 ID 唯一性\s+const existingSkills = await loadSkillsMetadata\(\);/,
  `// 3. 检查 ID 唯一性
    logger.debug('检查技能 ID 唯一性', { skillId });
    const existingSkills = await loadSkillsMetadata();`,
);

content = content.replace(
  /if \(existingSkills\.some\(\(s\) => s\.id === skillId\)\) \{\s+return c\.json\(/,
  `if (existingSkills.some((s) => s.id === skillId)) {
      logger.warn('创建技能失败：ID 已存在', { skillId });
      return c.json(`,
);

// 1.4 创建目录结构
content = content.replace(
  /\/\/ 4\. 获取 skills 目录\s+const skillsDir =/,
  `// 4. 获取 skills 目录
    const skillsDir =`,
);

content = content.replace(
  /const skillPath = path\.join\(skillsDir, skillId\);\s+\/\/ 5\. 创建目录结构/,
  `const skillPath = path.join(skillsDir, skillId);
    
    logger.debug('准备创建技能目录', { skillsDir, skillPath });

    // 5. 创建目录结构`,
);

content = content.replace(
  /\/\/ 5\. 创建目录结构\s+if \(fs\.existsSync\(skillPath\)\) \{\s+return c\.json\(/,
  `// 5. 创建目录结构
    if (fs.existsSync(skillPath)) {
      logger.warn('创建技能失败：目录已存在', { skillPath });
      return c.json(`,
);

content = content.replace(
  /fs\.mkdirSync\(path\.join\(skillPath, "examples"\), \{ recursive: true \}\);\s+\/\/ 6\. 生成 SKILL\.md 内容/,
  `fs.mkdirSync(path.join(skillPath, "examples"), { recursive: true });
    logger.debug('技能目录结构创建成功', { skillPath });

    // 6. 生成 SKILL.md 内容`,
);

// 1.5 写入文件
content = content.replace(
  /\/\/ 8\. 写入文件\s+try \{\s+fs\.writeFileSync\(/,
  `// 8. 写入文件
    logger.debug('开始写入技能文件', { skillPath });
    const skillMdPath = path.join(skillPath, "SKILL.md");
    const scriptFilePath = path.join(skillPath, "scripts", "process.ts");
    
    try {
      fs.writeFileSync(
        skillMdPath,
        skillMdContent,
        "utf-8",
      );
      logger.debug('SKILL.md 写入成功', { path: skillMdPath });
      
      fs.writeFileSync(
        scriptFilePath,
        scriptContent,
        "utf-8",
      );
      logger.debug('process.ts 写入成功', { path: scriptFilePath });

      logger.info('技能文件创建成功', { skillPath });
    } catch (error: any) {
      logger.error('写入文件失败，开始清理', { error: error.message, skillPath });
      // 创建失败，清理目录
      if (fs.existsSync(skillPath)) {
        fs.rmSync(skillPath, { recursive: true, force: true });
        logger.debug('已清理失败的技能目录', { skillPath });
      }
      throw new Error(\`写入文件失败: \${error.message}\`);
    }

    // 9. 更新缓存
    logger.debug('开始更新技能缓存', { skillId });
    try {
      await skillCache.updateSkill({
        id: skillId,
        name,
        description,
        scriptPath: path.join(skillPath, "scripts", "process.ts"),
        metadata: extraMetadata,
      });
      logger.debug('技能缓存更新成功', { skillId });
    } catch (cacheError: any) {
      logger.error('更新技能缓存失败', { skillId, error: cacheError.message });
      // 缓存更新失败不影响技能创建
    }

    logger.info('技能创建完成', { 
      skillId, 
      name,
      path: skillPath,
      hasScript: !!script,
      template 
    });

    return c.json(
      {
        status: "success",
        message: "技能创建成功",
        data: {
          id: skillId,
          name,
          description,
          path: skillPath,
        },
      },
      201,
    );
  } catch (error: any) {
    logger.error('创建技能失败', { 
      error: error.message,
      stack: error.stack
    });
    return c.json(
      {
        status: "error",
        message: "创建技能失败",
        error: error.message,
      },
      500,
    );
  }
});

/**
 * POST /skills/refresh - 刷新技能缓存
 */
skills.post("/refresh", async (c) => {`,
);

// 移除旧的写入文件代码（已经在上面替换了）
content = content.replace(
  /fs\.writeFileSync\(\s+path\.join\(skillPath, "SKILL\.md"\),\s+skillMdContent,\s+"utf-8",\s+\);\s+fs\.writeFileSync\(\s+path\.join\(skillPath, "scripts", "process\.ts"\),\s+scriptContent,\s+"utf-8",\s+\);\s+logger\.info\("技能文件创建成功", \{ skillPath \}\);\s+\} catch \(error: any\) \{\s+\/\/ 创建失败，清理目录\s+if \(fs\.existsSync\(skillPath\)\) \{\s+fs\.rmSync\(skillPath, \{ recursive: true, force: true \}\);\s+\}\s+throw new Error\(`写入文件失败: \$\{error\.message\}`\);\s+\}\s+\/\/ 9\. 更新缓存\s+await skillCache\.updateSkill\(\{\s+id: skillId,\s+name,\s+description,\s+scriptPath: path\.join\(skillPath, "scripts", "process\.ts"\),\s+metadata: extraMetadata,\s+\}\);\s+logger\.info\("技能创建成功", \{ skillId \}\);\s+return c\.json\(\s+\{\s+status: "success",\s+message: "技能创建成功",\s+data: \{\s+id: skillId,\s+name,\s+description,\s+path: skillPath,\s+\},\s+\},\s+201,\s+\);\s+\} catch \(error: any\) \{\s+logger\.error\("创建技能失败", \{ error: error\.message \}\);\s+return c\.json\(\s+\{\s+status: "error",\s+message: "创建技能失败",\s+error: error\.message,\s+\},\s+500,\s+\);\s+\}\s+\}\);\s+\/\*\*\s+\* POST \/skills\/refresh/,
  "",
);

// 2. 增强 GET /skills/:id - 获取技能详情的日志
console.log("2️⃣  增强获取技能详情日志...");

content = content.replace(
  /const skillId = c\.req\.param\("id"\);\s+logger\.info\("获取技能详情", \{ skillId \}\);\s+\/\/ 加载完整的 Skill 数据/,
  `const skillId = c.req.param("id");
    logger.info('开始获取技能详情', { skillId });

    // 加载完整的 Skill 数据
    logger.debug('从文件系统加载技能', { skillId });`,
);

content = content.replace(
  /const skill = await loadFullSkill\(skillId\);\s+if \(!skill\) \{\s+return c\.json\(/,
  `const skill = await loadFullSkill(skillId);

    if (!skill) {
      logger.warn('技能不存在', { skillId });
      return c.json(`,
);

content = content.replace(
  /if \(!skill\) \{\s+logger\.warn\('技能不存在', \{ skillId \}\);\s+return c\.json\(\s+\{\s+status: "error",\s+message: "技能不存在",\s+\},\s+404,\s+\);\s+\}\s+\/\/ 读取脚本内容/,
  `if (!skill) {
      logger.warn('技能不存在', { skillId });
      return c.json(
        {
          status: "error",
          message: "技能不存在",
        },
        404,
      );
    }

    logger.debug('技能加载成功', { 
      skillId, 
      name: skill.metadata.name,
      hasScript: !!skill.scriptPath 
    });

    // 读取脚本内容`,
);

content = content.replace(
  /\/\/ 读取脚本内容\s+let scriptContent: string \| undefined;\s+if \(skill\.scriptPath && fs\.existsSync\(skill\.scriptPath\)\) \{\s+scriptContent = fs\.readFileSync\(skill\.scriptPath, "utf-8"\);\s+\}/,
  `// 读取脚本内容
    let scriptContent: string | undefined;
    if (skill.scriptPath && fs.existsSync(skill.scriptPath)) {
      logger.debug('读取脚本文件', { scriptPath: skill.scriptPath });
      scriptContent = fs.readFileSync(skill.scriptPath, "utf-8");
      logger.debug('脚本文件读取成功', { size: scriptContent.length });
    } else if (skill.scriptPath) {
      logger.debug('脚本文件不存在', { scriptPath: skill.scriptPath });
    }`,
);

content = content.replace(
  /\/\/ 检查示例文件\s+const examplesDir = path\.join\(skill\.path, "examples"\);\s+let examples: string\[\] = \[\];\s+if \(fs\.existsSync\(examplesDir\)\) \{\s+const files = fs\.readdirSync\(examplesDir\);\s+examples = files\.filter\(\(f\) => !f\.startsWith\("\."\)\);\s+\}/,
  `// 检查示例文件
    const examplesDir = path.join(skill.path, "examples");
    let examples: string[] = [];
    if (fs.existsSync(examplesDir)) {
      const files = fs.readdirSync(examplesDir);
      examples = files.filter((f) => !f.startsWith("."));
      logger.debug('找到示例文件', { count: examples.length, examples });
    }`,
);

content = content.replace(
  /return c\.json\(\{\s+status: "success",\s+data: \{\s+id: skill\.id,\s+metadata: skill\.metadata,\s+content: skill\.content,\s+script: scriptContent,\s+scriptPath: skill\.scriptPath,\s+examples,\s+hasExamples: examples\.length > 0,\s+\},\s+\}\);\s+\} catch \(error: any\) \{\s+logger\.error\("获取技能详情失败", \{ error: error\.message \}\);/,
  `logger.info('技能详情获取成功', { 
      skillId,
      name: skill.metadata.name,
      hasScript: !!scriptContent,
      examplesCount: examples.length
    });

    return c.json({
      status: "success",
      data: {
        id: skill.id,
        metadata: skill.metadata,
        content: skill.content,
        script: scriptContent,
        scriptPath: skill.scriptPath,
        examples,
        hasExamples: examples.length > 0,
      },
    });
  } catch (error: any) {
    logger.error('获取技能详情失败', { 
      skillId: c.req.param('id'),
      error: error.message,
      stack: error.stack
    });`,
);

// 3. 增强 PUT /skills/:id - 更新技能的日志
console.log("3️⃣  增强更新技能日志...");

content = content.replace(
  /const \{ metadata: metadataStr, content, script \} = body;\s+logger\.info\("更新技能信息", \{ skillId \}\);\s+\/\/ 1\. 验证技能是否存在/,
  `const { metadata: metadataStr, content, script } = body;

    logger.info('开始更新技能信息', { 
      skillId,
      hasMetadata: !!metadataStr,
      hasContent: !!content,
      hasScript: !!script
    });

    // 1. 验证技能是否存在
    logger.debug('检查技能是否存在', { skillId });`,
);

content = content.replace(
  /const existingSkill = existingSkills\.find\(\(s\) => s\.id === skillId\);\s+if \(!existingSkill\) \{\s+return c\.json\(/,
  `const existingSkill = existingSkills.find((s) => s.id === skillId);

    if (!existingSkill) {
      logger.warn('更新失败：技能不存在', { skillId });
      return c.json(`,
);

content = content.replace(
  /if \(!existingSkill\) \{\s+logger\.warn\('更新失败：技能不存在', \{ skillId \}\);\s+return c\.json\(\s+\{\s+status: "error",\s+message: "技能不存在",\s+\},\s+404,\s+\);\s+\}\s+\/\/ 2\. 获取技能路径/,
  `if (!existingSkill) {
      logger.warn('更新失败：技能不存在', { skillId });
      return c.json(
        {
          status: "error",
          message: "技能不存在",
        },
        404,
      );
    }

    logger.debug('技能存在，继续更新', { skillId, name: existingSkill.name });

    // 2. 获取技能路径`,
);

content = content.replace(
  /\/\/ 4\. 写入文件系统\s+if \(metadataStr !== undefined && content !== undefined\) \{\s+const newSkillMd = `---\\n\$\{metadataStr\}\\n---\\n\\n\$\{content\}`;\s+fs\.writeFileSync\(skillMdPath, newSkillMd, "utf-8"\);\s+logger\.debug\("SKILL\.md 更新成功"\);\s+\}\s+if \(script !== undefined\) \{\s+fs\.writeFileSync\(scriptPath, script, "utf-8"\);\s+logger\.debug\("process\.ts 更新成功"\);\s+\}/,
  `// 4. 写入文件系统
      if (metadataStr !== undefined && content !== undefined) {
        logger.debug('开始更新 SKILL.md', { skillMdPath });
        const newSkillMd = \`---\\n\${metadataStr}\\n---\\n\\n\${content}\`;
        fs.writeFileSync(skillMdPath, newSkillMd, "utf-8");
        logger.info('SKILL.md 更新成功', { skillId, size: newSkillMd.length });
      }

      if (script !== undefined) {
        logger.debug('开始更新 process.ts', { scriptPath });
        fs.writeFileSync(scriptPath, script, "utf-8");
        logger.info('process.ts 更新成功', { skillId, size: script.length });
      }`,
);

content = content.replace(
  /\/\/ 6\. 更新数据库缓存\s+await skillCache\.updateSkill\(\{/,
  `// 6. 更新数据库缓存
      logger.debug('开始更新数据库缓存', { skillId });
      await skillCache.updateSkill({`,
);

content = content.replace(
  /metadata: parsedMetadata,\s+\}\);\s+logger\.info\("技能更新成功", \{ skillId \}\);/,
  `metadata: parsedMetadata,
      });
      logger.debug('数据库缓存更新成功', { skillId });

      logger.info('技能更新完成', { 
        skillId,
        name: parsedMetadata.name || existingSkill.name,
        updatedMetadata: !!metadataStr,
        updatedScript: !!script
      });`,
);

content = content.replace(
  /\/\/ 7\. 回滚文件系统\s+logger\.error\("更新失败，开始回滚", \{ error: error\.message \}\);/,
  `// 7. 回滚文件系统
      logger.error('更新失败，开始回滚', { 
        skillId,
        error: error.message,
        stack: error.stack
      });`,
);

content = content.replace(
  /if \(skillMdBackup !== null\) \{\s+fs\.writeFileSync\(skillMdPath, skillMdBackup, "utf-8"\);\s+\}\s+if \(scriptBackup !== null\) \{\s+fs\.writeFileSync\(scriptPath, scriptBackup, "utf-8"\);\s+\}\s+logger\.info\("文件回滚成功"\);/,
  `if (skillMdBackup !== null) {
          fs.writeFileSync(skillMdPath, skillMdBackup, "utf-8");
          logger.debug('SKILL.md 回滚成功');
        }
        if (scriptBackup !== null) {
          fs.writeFileSync(scriptPath, scriptBackup, "utf-8");
          logger.debug('process.ts 回滚成功');
        }
        logger.info('文件回滚成功', { skillId });`,
);

content = content.replace(
  /\} catch \(rollbackError: any\) \{\s+logger\.error\("文件回滚失败", \{ error: rollbackError\.message \}\);/,
  `} catch (rollbackError: any) {
        logger.error('文件回滚失败', { 
          skillId,
          error: rollbackError.message 
        });`,
);

content = content.replace(
  /\} catch \(error: any\) \{\s+logger\.error\("更新技能失败", \{ error: error\.message \}\);\s+return c\.json\(\s+\{\s+status: "error",\s+message: "更新技能失败",\s+error: error\.message,\s+\},\s+500,\s+\);\s+\}\s+\}\);/,
  `} catch (error: any) {
    logger.error('更新技能失败', { 
      skillId: c.req.param('id'),
      error: error.message,
      stack: error.stack
    });
    return c.json(
      {
        status: "error",
        message: "更新技能失败",
        error: error.message,
      },
      500,
    );
  }
});`,
);

// 检查是否有修改
if (content === originalContent) {
  console.log("\n❌ 没有进行任何修改，可能是匹配模式有问题");
  console.log("请检查文件格式是否与预期一致");
  process.exit(1);
}

// 备份原文件
const backupPath = skillsRoutePath + ".backup";
fs.writeFileSync(backupPath, originalContent, "utf-8");
console.log(`\n📦 原文件已备份到: ${backupPath}`);

// 写入修改后的文件
fs.writeFileSync(skillsRoutePath, content, "utf-8");
console.log(`✅ 文件已更新: ${skillsRoutePath}`);

console.log("\n✨ 日志增强完成！");
console.log("\n📋 增强内容:");
console.log("   - POST /skills - 创建技能的详细日志");
console.log("   - GET /skills/:id - 获取详情的详细日志");
console.log("   - PUT /skills/:id - 更新技能的详细日志");
console.log("\n💡 建议:");
console.log("   1. 检查修改后的文件是否正确");
console.log("   2. 运行测试: bun run scripts/test-skill-creation.ts");
console.log(
  "   3. 如有问题，可从备份恢复: cp " + backupPath + " " + skillsRoutePath,
);
