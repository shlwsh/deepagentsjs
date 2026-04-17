#!/usr/bin/env bun

/**
 * 跨平台数据库恢复工具
 * 对标 backup-database.ts
 */
import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { config as dotenvConfig } from "dotenv";

// 加载环境变量
dotenvConfig({ path: join(process.cwd(), "services", "agent-platform", ".env") });

// 解析连接字符串
const parseConnectionString = (connectionString?: string) => {
  if (!connectionString) return {};
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    };
  } catch {
    return {};
  }
};

const connInfo = parseConnectionString(process.env.PG_CONNECTION_STRING);

// 配置
const config = {
  host: connInfo.host || process.env.DB_HOST || "localhost",
  port: connInfo.port || process.env.DB_PORT || "5432",
  user: connInfo.user || process.env.DB_USER || "postgres",
  password: connInfo.password || process.env.DB_PASSWORD || "postgres",
  database: connInfo.database || process.env.DB_NAME || "agentdb",
};

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 执行命令
 */
function execCommand(
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code: number | null) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const targetFile = args[0];

  if (!targetFile) {
    log("========================================", "cyan");
    log("PostgreSQL 数据库恢复工具", "green");
    log("========================================", "cyan");
    log("用法: bun run restore [备份文件路径]");
    log("");
    log("示例: bun run restore database/pg_17.9/backup.sql");
    log("      bun run restore database/pg_17.9/backup.dump");
    log("========================================", "cyan");
    process.exit(1);
  }

  if (!existsSync(targetFile)) {
    log(`❌ 错误: 文件不存在 -> ${targetFile}`, "red");
    process.exit(1);
  }

  log("=== PostgreSQL 数据库恢复工具 ===", "green");
  log("");
  log("目标配置:");
  log(`  主机: ${config.host}`);
  log(`  端口: ${config.port}`);
  log(`  用户: ${config.user}`);
  log(`  数据库: ${config.database}`);
  log(`  恢复文件: ${targetFile}`);
  log("");

  // 1. 删除并重新创建数据库
  log("⏳ 正在重建数据库...", "yellow");
  
  // 删除现有数据库
  await execCommand("dropdb", [
    "-h", config.host,
    "-p", config.port,
    "-U", config.user,
    "--if-exists",
    config.database
  ], { PGPASSWORD: config.password });

  // 创建新数据库
  const createResult = await execCommand("createdb", [
    "-h", config.host,
    "-p", config.port,
    "-U", config.user,
    config.database
  ], { PGPASSWORD: config.password });

  if (createResult.code !== 0) {
    log("❌ 错误: 创建数据库失败", "red");
    log(createResult.stderr, "red");
    process.exit(1);
  }

  // 2. 导入数据
  log("⏳ 正在导入数据...", "yellow");
  
  let restoreResult;
  if (targetFile.endsWith(".dump")) {
    restoreResult = await execCommand("pg_restore", [
      "-h", config.host,
      "-p", config.port,
      "-U", config.user,
      "-d", config.database,
      "-v",
      targetFile
    ], { PGPASSWORD: config.password });
  } else {
    restoreResult = await execCommand("psql", [
      "-h", config.host,
      "-p", config.port,
      "-U", config.user,
      "-d", config.database,
      "-f", `"${targetFile}"`
    ], { PGPASSWORD: config.password });
  }

  if (restoreResult.code !== 0) {
    log("❌ 错误: 导入数据失败", "red");
    log(restoreResult.stderr, "red");
    process.exit(1);
  }

  log("\n✅ 数据库恢复成功！", "green");
}

main().catch((error) => {
  log(`\n错误: ${error.message}`, "red");
  process.exit(1);
});
