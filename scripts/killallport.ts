#!/usr/bin/env bun

/**
 * 跨平台端口清理脚本
 * 作用: 自动查找并关闭占用项目所有端口的进程
 * 支持: macOS, Linux, Windows
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// 默认端口配置
const DEFAULT_PORTS = {
  API_PORT: 8910,
  WEB_PORT: 8911,
  KNOWLEDGE_PORT: 8912,
  MCP_PERSONNEL_PORT: 8913,
  FILE_SERVICE_PORT: 8914,
  VECTOR_STORE_PORT: 8915,
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 从 .env 文件读取端口配置
 */
function loadPortsFromEnv(): Record<string, number> {
  const envPath = join(process.cwd(), '.env');
  const ports = { ...DEFAULT_PORTS };

  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        const match = line.match(/^(API_PORT|WEB_PORT|KNOWLEDGE_PORT|MCP_PERSONNEL_PORT|FILE_SERVICE_PORT|VECTOR_STORE_PORT)=(\d+)/);
        if (match) {
          const [, key, value] = match;
          ports[key as keyof typeof DEFAULT_PORTS] = parseInt(value, 10);
        }
      }
    } catch (error) {
      log('⚠️  读取 .env 文件失败，使用默认端口配置', 'yellow');
    }
  } else {
    log('⚠️  未找到 .env 文件，使用默认端口配置', 'yellow');
  }

  return ports;
}

/**
 * 获取占用指定端口的进程 ID (macOS/Linux)
 */
function getPidUnix(port: number): string[] {
  try {
    const output = execSync(`lsof -t -i:${port}`, { encoding: 'utf-8' }).trim();
    return output ? output.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * 获取占用指定端口的进程 ID (Windows)
 */
function getPidWindows(port: number): string[] {
  try {
    const output = execSync(`netstat -ano | findstr ":${port} " | findstr "LISTENING"`, {
      encoding: 'utf-8',
      shell: 'cmd.exe',
    }).trim();

    if (!output) return [];

    const pids = new Set<string>();
    const lines = output.split('\n');

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') {
        pids.add(pid);
      }
    }

    return Array.from(pids);
  } catch {
    return [];
  }
}

/**
 * 终止进程 (macOS/Linux)
 */
function killProcessUnix(pid: string): boolean {
  try {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 终止进程 (Windows)
 */
function killProcessWindows(pid: string): boolean {
  try {
    // 首先尝试 taskkill
    execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore', shell: 'cmd.exe' });
    return true;
  } catch {
    try {
      // 如果失败，尝试 wmic
      execSync(`wmic process where "ProcessId=${pid}" delete`, { stdio: 'ignore', shell: 'cmd.exe' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 检测操作系统
 */
function getOS(): 'windows' | 'unix' {
  return process.platform === 'win32' ? 'windows' : 'unix';
}

/**
 * 清理指定端口（带重试验证机制）
 */
async function cleanupPort(port: number, os: 'windows' | 'unix'): Promise<void> {
  let maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    const pids = os === 'windows' ? getPidWindows(port) : getPidUnix(port);

    if (pids.length === 0) {
      if (retryCount === 0) {
        log(`稳定: 端口 ${port} 已经空闲`, 'green');
      } else {
        log(`✅ 验证通过: 端口 ${port} 已完全释放`, 'green');
      }
      return;
    }

    for (const pid of pids) {
      log(`[尝试 ${retryCount + 1}/${maxRetries}] 发现进程 ${pid} 占用端口 ${port}. 正在清理...`, 'yellow');

      const success = os === 'windows' ? killProcessWindows(pid) : killProcessUnix(pid);

      if (success) {
        log(`⏳ 已发送关闭信号给 PID: ${pid}，等待释放...`, 'cyan');
      } else {
        log(`❌ 发送关闭信号给 PID: ${pid} 失败`, 'red');
      }
    }

    // 等待 1.5 秒让操作系统回收资源
    await new Promise(resolve => setTimeout(resolve, 1500));
    retryCount++;
  }

  // 最终验证
  const finalPids = os === 'windows' ? getPidWindows(port) : getPidUnix(port);
  if (finalPids.length > 0) {
    log(`⚠️ 警告: 尝试了 ${maxRetries} 次后，端口 ${port} 仍被占用 (PID: ${finalPids.join(', ')})`, 'red');
    log(`   请考虑执行: taskkill /F /IM bun.exe /T 等强制措施，或重启系统`, 'red');
    throw new Error(`端口 ${port} 强制清理失败`);
  } else {
    log(`✅ 验证通过: 端口 ${port} 已完全释放`, 'green');
  }
}

/**
 * 主函数
 */
async function main() {
  log('🔍 正在检查端口占用情况...', 'cyan');
  log('', 'reset');

  const os = getOS();
  log(`检测到操作系统: ${os === 'windows' ? 'Windows' : 'Unix (macOS/Linux)'}`, 'cyan');

  const ports = loadPortsFromEnv();
  const portList = Object.entries(ports).map(([name, port]) => ({ name, port }));

  log(`需要清理的端口: ${portList.map(p => `${p.name}=${p.port}`).join(', ')}`, 'cyan');
  log('', 'reset');

  for (const { name, port } of portList) {
    log(`检查 ${name} (端口 ${port})...`, 'cyan');
    await cleanupPort(port, os);
    log('', 'reset');
  }

  log('✨ 所有清理操作已完成', 'magenta');
}

// 执行主函数
main().catch((error) => {
  log(`❌ 执行失败: ${error.message}`, 'red');
  process.exit(1);
});
