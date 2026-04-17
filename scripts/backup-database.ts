#!/usr/bin/env bun

/**
 * 跨平台数据库备份工具
 * 支持 Windows、Linux、macOS
 */
import { spawn } from "child_process";
import { existsSync, readdirSync, statSync, unlinkSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// 配置
const config = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "5432",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "personnel_db",
};

// 获取基础备份目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseBackupDir = join(__dirname, "..", "database");
let backupDir = baseBackupDir;

// 生成本地时间戳
const now = new Date();
const timestamp =
  [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("") +
  "_" +
  [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

const backupPrefix = "personnel_db_backup";

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
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
 * 检查数据库连接
 */
async function checkConnection(): Promise<boolean> {
  log("检查数据库连接...", "yellow");

  const result = await execCommand(
    "psql",
    [
      "-h",
      config.host,
      "-p",
      config.port,
      "-U",
      config.user,
      "-d",
      config.database,
      "-c",
      "SELECT 1",
    ],
    { PGPASSWORD: config.password },
  );

  if (result.code !== 0) {
    log("错误: 无法连接到数据库", "red");
    log(result.stderr, "red");
    return false;
  }

  log("✓ 数据库连接成功", "green");
  return true;
}

/**
 * 获取数据库版本并创建版本相关目录
 */
async function setupVersionedDirectory(): Promise<void> {
  log("\n获取数据库版本...", "yellow");
  
  const result = await execCommand(
    "psql",
    [
      "-h", config.host,
      "-p", config.port,
      "-U", config.user,
      "-d", config.database,
      "-c", '"SHOW server_version;"'
    ],
    { PGPASSWORD: config.password }
  );

  if (result.code !== 0) {
    log(`警告: 无法获取数据库版本，使用默认备份目录。错误信息: ${result.stderr}`, "yellow");
    return;
  }

  let versionString = "";
  // 提取如 14.2 这样的数字
  const match = result.stdout.match(/\b(\d+\.\d+(\.\d+)?)\b/);
  if (match) {
    versionString = match[1];
  }

  if (versionString) {
    const versionFolderName = `pg_${versionString}`;
    backupDir = join(baseBackupDir, versionFolderName);
    log(`✓ 数据库版本: ${versionString}`, "green");
  }

  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
    log(`创建版本特定备份目录: ${backupDir}`, "green");
  }
}

/**
 * 创建二进制备份
 */
async function createDumpBackup(): Promise<string | null> {
  log("\n创建二进制备份（.dump）...", "yellow");

  const dumpFile = join(backupDir, `${backupPrefix}_${timestamp}.dump`);

  const result = await execCommand(
    "pg_dump",
    [
      "-h",
      config.host,
      "-p",
      config.port,
      "-U",
      config.user,
      "-d",
      config.database,
      "-F",
      "c",
      "-b",
      "-v",
      "-f",
      dumpFile,
    ],
    { PGPASSWORD: config.password },
  );

  if (result.code !== 0) {
    log("错误: 二进制备份失败", "red");
    log(result.stderr, "red");
    return null;
  }

  const size = statSync(dumpFile).size;
  const sizeStr = formatSize(size);
  log(`✓ 二进制备份完成: ${dumpFile} (${sizeStr})`, "green");

  return dumpFile;
}

/**
 * 创建 SQL 备份
 */
async function createSqlBackup(): Promise<string | null> {
  log("\n创建 SQL 备份（.sql）...", "yellow");

  const sqlFile = join(backupDir, `${backupPrefix}_${timestamp}.sql`);

  const result = await execCommand(
    "pg_dump",
    [
      "-h",
      config.host,
      "-p",
      config.port,
      "-U",
      config.user,
      "-d",
      config.database,
      "-F",
      "p",
      "-f",
      sqlFile,
    ],
    { PGPASSWORD: config.password },
  );

  if (result.code !== 0) {
    log("错误: SQL 备份失败", "red");
    log(result.stderr, "red");
    return null;
  }

  const size = statSync(sqlFile).size;
  const sizeStr = formatSize(size);
  log(`✓ SQL 备份完成: ${sqlFile} (${sizeStr})`, "green");

  return sqlFile;
}

/**
 * 验证备份
 */
async function verifyBackup(dumpFile: string): Promise<number> {
  log("\n验证备份文件...", "yellow");

  const result = await execCommand("pg_restore", ["-l", dumpFile], {
    PGPASSWORD: config.password,
  });

  if (result.code !== 0) {
    log("警告: 无法验证备份文件", "yellow");
    return 0;
  }

  const tableCount = (result.stdout.match(/TABLE DATA/g) || []).length;
  log(`✓ 备份包含 ${tableCount} 个表`, "green");

  return tableCount;
}

/**
 * 清理所有旧备份（保持目录只有最新备份）
 */
async function cleanupAllOldBackups(): Promise<void> {
  log("\n清理旧备份...", "yellow");

  let deletedCount = 0;

  const files = readdirSync(backupDir);
  for (const file of files) {
    if (
      file.startsWith(backupPrefix) &&
      (file.endsWith(".dump") || file.endsWith(".sql"))
    ) {
      const filePath = join(backupDir, file);
      try {
        unlinkSync(filePath);
        deletedCount++;
        log(`  删除: ${file}`, "yellow");
      } catch (error: any) {
        log(`  警告: 无法删除 ${file}: ${error.message}`, "yellow");
      }
    }
  }

  if (deletedCount > 0) {
    log(`✓ 已删除 ${deletedCount} 个旧备份文件`, "green");
  } else {
    log("✓ 没有旧备份需要清理", "green");
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 主函数
 */
async function main() {
  log("=== PostgreSQL 数据库备份工具 ===", "green");
  log("");
  log("配置信息:");
  log(`  主机: ${config.host}`);
  log(`  端口: ${config.port}`);
  log(`  用户: ${config.user}`);
  log(`  数据库: ${config.database}`);
  log(`  备份目录: ${backupDir}`);
  log(`  时间戳: ${timestamp}`);
  log("");

  // 检查基础备份目录
  if (!existsSync(baseBackupDir)) {
    log(`基础备份目录不存在，正在创建: ${baseBackupDir}`, "yellow");
    mkdirSync(baseBackupDir, { recursive: true });
  }

  // 检查数据库连接
  const connected = await checkConnection();
  if (!connected) {
    process.exit(1);
  }

  // 获取数据库版本并创建独立目录
  await setupVersionedDirectory();

  // 先清理所有旧备份 (在版本特定的目录中)
  await cleanupAllOldBackups();

  // 创建备份
  const dumpFile = await createDumpBackup();
  const sqlFile = await createSqlBackup();

  if (!dumpFile || !sqlFile) {
    log("\n备份失败！", "red");
    process.exit(1);
  }

  // 验证备份
  await verifyBackup(dumpFile);

  // 显示备份统计
  const dumpSize = formatSize(statSync(dumpFile).size);
  const sqlSize = formatSize(statSync(sqlFile).size);

  log("\n=== 备份完成 ===", "green");
  log("");
  log("备份文件:");
  log(`  二进制: ${dumpFile} (${dumpSize})`);
  log(`  SQL:    ${sqlFile} (${sqlSize})`);
  log("");
  log("恢复命令:");
  log(
    `  pg_restore -h ${config.host} -U ${config.user} -d ${config.database} "${dumpFile}"`,
  );
  log("  或");
  log(
    `  psql -h ${config.host} -U ${config.user} -d ${config.database} -f "${sqlFile}"`,
  );
  log("");

  log("\n备份任务完成！", "green");
}

// 运行
main().catch((error) => {
  log(`\n错误: ${error.message}`, "red");
  process.exit(1);
});
