#!/usr/bin/env bun
/**
 * AI 智能版本升级脚本
 * 自动升级版本并使用 DashScope AI 生成变更描述
 * 直接操作本地版本文件，不依赖服务
 */

import { existsSync } from "fs";
import { join } from "path";

interface UpgradeOptions {
  description?: string;
  force?: boolean;
}

interface DashScopeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface VersionInfo {
  version: string;
  majorVersion: number;
  date: string;
  sequence: number;
  timestamp: string;
  description?: string;
}

/**
 * 从环境变量读取 DashScope 配置
 */
function getDashScopeConfig(): DashScopeConfig {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl =
    process.env.DASHSCOPE_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.DASHSCOPE_MODEL || "deepseek-v3";

  if (!apiKey) {
    throw new Error("未配置 DASHSCOPE_API_KEY 环境变量");
  }

  return { apiKey, baseUrl, model };
}

/**
 * 获取版本文件路径
 */
function getVersionFilePath(): string {
  return join(process.cwd(), "services/agent-platform/version.json");
}

/**
 * 获取版本历史文件路径
 */
function getVersionHistoryPath(): string {
  return join(process.cwd(), "services/agent-platform/version-history.json");
}

/**
 * 获取版本备份目录
 */
function getVersionBackupDir(): string {
  return join(process.cwd(), "services/agent-platform/version-backups");
}

/**
 * 读取当前版本信息
 */
async function readCurrentVersion(): Promise<VersionInfo> {
  const versionFile = getVersionFilePath();

  if (!existsSync(versionFile)) {
    throw new Error("版本文件不存在");
  }

  const content = await Bun.file(versionFile).text();
  return JSON.parse(content);
}

/**
 * 生成新版本号
 */
function generateNewVersion(currentVersion: string): {
  version: string;
  date: string;
  sequence: number;
} {
  // 解析当前版本: 主版本.日期.序号
  const parts = currentVersion.split(".");
  if (parts.length !== 3) {
    throw new Error(`版本格式错误: ${currentVersion}`);
  }

  const majorVersion = parts[0];
  const dateStr = parts[1];
  const currentSeq = parseInt(parts[2]);

  // 获取今天的日期字符串 YYYYMMDD
  const today = new Date();
  const year = today.getFullYear().toString().slice(2); // YY
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayStr = `${year}${month}${day}`;

  // 如果是同一天，序号递增；否则序号重置为 1
  let newSeq: number;
  if (dateStr === todayStr) {
    newSeq = currentSeq + 1;
    if (newSeq > 999) {
      throw new Error("当日版本序号已达上限 (999)");
    }
  } else {
    newSeq = 1;
  }

  const newVersion = `${majorVersion}.${todayStr}.${String(newSeq).padStart(3, "0")}`;
  return { version: newVersion, date: todayStr, sequence: newSeq };
}

/**
 * 保存版本信息
 */
async function saveVersion(versionInfo: VersionInfo): Promise<void> {
  const versionFile = getVersionFilePath();
  const historyFile = getVersionHistoryPath();
  const backupDir = getVersionBackupDir();

  // 1. 备份当前版本
  const backupFile = join(
    backupDir,
    `version-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );

  if (!existsSync(backupDir)) {
    // 使用 Bun.spawn 创建目录
    await Bun.spawn(["mkdir", "-p", backupDir], {
      stdout: "ignore",
      stderr: "ignore",
    }).exited;
  }

  const currentContent = await Bun.file(versionFile).text();
  await Bun.write(backupFile, currentContent);

  // 2. 写入新版本
  await Bun.write(versionFile, JSON.stringify(versionInfo, null, 2) + "\n");

  // 3. 更新版本历史
  let historyData: { versions: VersionInfo[] } = { versions: [] };
  if (existsSync(historyFile)) {
    const historyContent = await Bun.file(historyFile).text();
    const parsed = JSON.parse(historyContent);
    // 兼容两种格式：直接数组或 {versions: []} 对象
    if (Array.isArray(parsed)) {
      historyData.versions = parsed;
    } else if (parsed.versions && Array.isArray(parsed.versions)) {
      historyData.versions = parsed.versions;
    }
  }

  // 添加新版本到历史记录
  historyData.versions.unshift(versionInfo);

  // 只保留最近 100 条记录
  if (historyData.versions.length > 100) {
    historyData.versions = historyData.versions.slice(0, 100);
  }

  // 更新元数据
  const historyOutput = {
    versions: historyData.versions,
    currentVersion: versionInfo.version,
    lastUpdated: versionInfo.timestamp,
    totalCount: historyData.versions.length,
  };

  await Bun.write(historyFile, JSON.stringify(historyOutput, null, 2) + "\n");
}

/**
 * 获取 Git 变更内容
 */
async function getGitChanges(): Promise<string> {
  try {
    // 获取未提交的变更
    const statusProc = Bun.spawn(["git", "status", "--short"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const status = await new Response(statusProc.stdout).text();

    // 获取最近的提交日志（最多 5 条）
    const logProc = Bun.spawn(["git", "log", "--oneline", "-5"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const log = await new Response(logProc.stdout).text();

    // 获取变更的文件差异（简化版）
    let diff = "";
    try {
      const diffProc = Bun.spawn(["git", "diff", "--stat"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      diff = await new Response(diffProc.stdout).text();
    } catch {
      // 如果没有差异，忽略错误
    }

    return `
## Git 状态
${status || "无未提交的变更"}

## 最近提交
${log}

## 变更统计
${diff || "无变更"}
`.trim();
  } catch (error: any) {
    console.warn(`⚠️  获取 Git 变更失败: ${error.message}`);
    return "无法获取 Git 变更信息";
  }
}

/**
 * 使用 DashScope AI 生成版本变更描述
 */
async function generateChangeDescription(
  changes: string,
  config: DashScopeConfig,
): Promise<string> {
  console.log("🤖 使用 DashScope AI 生成变更描述...");
  console.log(`   模型: ${config.model}`);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: `你是一个专业的版本管理助手。根据提供的 Git 变更信息，生成简洁的版本变更描述。

要求：
1. 使用中文
2. 一句话概括主要变更（不超过 50 字）
3. 突出重点功能或修复
4. 使用专业术语
5. 格式：类型: 简短描述（例如：新增: Markdown 编辑器预览功能）

类型包括：新增、修复、优化、重构、文档、样式、测试、配置等。`,
          },
          {
            role: "user",
            content: `请根据以下 Git 变更信息生成版本变更描述：

${changes}

只返回一句话的变更描述，不要其他内容。`,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DashScope API 请求失败: ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();

    if (!result.choices?.[0]?.message?.content) {
      throw new Error("DashScope API 响应格式错误");
    }

    const description = result.choices[0].message.content.trim();
    console.log(`   生成描述: ${description}`);

    return description;
  } catch (error: any) {
    console.warn(`⚠️  AI 生成失败: ${error.message}`);
    console.warn(`   使用默认描述`);
    return "版本更新";
  }
}

/**
 * 升级版本
 */
async function upgradeVersion(options: UpgradeOptions = {}) {
  const { description: userDescription, force = false } = options;

  console.log("🚀 开始智能版本升级...\n");

  try {
    // 1. 读取当前版本
    console.log("📋 读取当前版本信息...");
    const currentVersionInfo = await readCurrentVersion();
    console.log(`   当前版本: ${currentVersionInfo.version}`);

    // 2. 生成新版本号
    const {
      version: newVersion,
      date,
      sequence,
    } = generateNewVersion(currentVersionInfo.version);

    // 检查是否需要升级
    if (!force && newVersion === currentVersionInfo.version) {
      console.log("\nℹ️  版本未发生变化");
      console.log(`   当前版本: ${currentVersionInfo.version}`);
      return {
        upgraded: false,
        version: currentVersionInfo.version,
        description: currentVersionInfo.description || "",
      };
    }

    // 3. 获取变更描述
    let description = userDescription;

    if (!description) {
      // 获取 DashScope 配置
      const dashScopeConfig = getDashScopeConfig();

      // 获取 Git 变更
      console.log("\n📋 分析代码变更...");
      const changes = await getGitChanges();

      // 使用 AI 生成描述
      description = await generateChangeDescription(changes, dashScopeConfig);
    }

    // 4. 保存新版本
    console.log("\n⬆️  保存新版本...");
    const newVersionInfo: VersionInfo = {
      version: newVersion,
      majorVersion: parseInt(newVersion.split(".")[0]),
      date,
      sequence,
      timestamp: new Date().toISOString(),
      description,
    };

    await saveVersion(newVersionInfo);

    // 5. 升级成功
    console.log("\n🎉 版本升级成功！");
    console.log(`   旧版本: ${currentVersionInfo.version}`);
    console.log(`   新版本: ${newVersion}`);
    console.log(`   变更描述: ${description}`);
    console.log(
      `   升级时间: ${new Date(newVersionInfo.timestamp).toLocaleString("zh-CN")}`,
    );

    return {
      upgraded: true,
      oldVersion: currentVersionInfo.version,
      newVersion,
      description,
      timestamp: newVersionInfo.timestamp,
    };
  } catch (error: any) {
    console.error(`\n❌ 版本升级失败: ${error.message}`);
    throw error;
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
📖 AI 智能版本升级脚本使用说明

用法:
  bun run update [选项]

选项:
  --help, -h              显示帮助信息
  --description, -d TEXT  版本升级描述（不指定则使用 AI 生成）
  --force, -f             强制升级

示例:
  # 基本升级（AI 自动生成描述）
  bun run update

  # 手动指定描述
  bun run update --description "新增: 用户管理功能"

  # 强制升级
  bun run update --force

功能说明:
  1. 自动分析 Git 变更内容
  2. 使用 DashScope AI 生成简洁的变更描述
  3. 直接操作本地版本文件（不依赖服务）
  4. 自动备份版本历史

AI 配置:
  - 从 .env 文件读取 DASHSCOPE_API_KEY
  - 从 .env 文件读取 DASHSCOPE_MODEL (默认: deepseek-v3)
  - 从 .env 文件读取 DASHSCOPE_BASE_URL

版本文件位置:
  - 版本文件: services/agent-platform/version.json
  - 历史记录: services/agent-platform/version-history.json
  - 备份目录: services/agent-platform/version-backups/

版本升级规则:
  - 同日升级: 序号递增 (10.20260126.001 → 10.20260126.002)
  - 跨日升级: 序号重置 (10.20260126.005 → 10.20260127.001)
  - 最大序号: 999
`);
}

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): UpgradeOptions & { help?: boolean } {
  const options: UpgradeOptions & { help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;

      case "--description":
      case "-d":
        if (i + 1 < args.length) {
          options.description = args[++i];
        }
        break;

      case "--force":
      case "-f":
        options.force = true;
        break;

      default:
        // 忽略未知参数
        break;
    }
  }

  return options;
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help || args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  const result = await upgradeVersion(options);

  // 导出结果供其他脚本使用
  if (typeof module !== "undefined" && module.exports) {
    module.exports = result;
  }

  return result;
}

// 如果直接运行，执行主程序
if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

// 导出函数供其他脚本使用
export { upgradeVersion, getGitChanges, generateChangeDescription };
