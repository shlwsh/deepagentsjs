#!/usr/bin/env bun
/**
 * 版本调整脚本
 * 用于手动调整项目版本号
 */

import * as fs from 'fs';
import * as path from 'path';

interface VersionInfo {
  version: string;
  majorVersion: number;
  date: string;
  sequence: number;
  timestamp: string;
  description?: string;
}

interface VersionHistory {
  versions: VersionInfo[];
  currentVersion: string;
  lastUpdated: string;
  totalCount: number;
}

/**
 * 调整版本号
 * @param targetVersion 目标版本号 (格式: 10.20260126.001)
 * @param description 版本描述
 */
async function adjustVersion(targetVersion: string, description?: string) {
  console.log(`🔧 开始调整版本到: ${targetVersion}`);

  // 验证版本号格式
  const versionRegex = /^(\d+)\.(\d{8})\.(\d{3})$/;
  const match = targetVersion.match(versionRegex);

  if (!match) {
    console.error('❌ 版本号格式错误，应为: 主版本.日期.序号 (例: 10.20260126.001)');
    process.exit(1);
  }

  const [, majorVersionStr, dateStr, sequenceStr] = match;
  const majorVersion = parseInt(majorVersionStr, 10);
  const sequence = parseInt(sequenceStr, 10);

  // 创建新版本信息
  const newVersionInfo: VersionInfo = {
    version: targetVersion,
    majorVersion,
    date: dateStr,
    sequence,
    timestamp: new Date().toISOString(),
    description: description || `手动调整版本到 ${targetVersion}`
  };

  try {
    // 读取现有历史记录
    let history: VersionHistory;
    const historyPath = path.join(process.cwd(), 'version-history.json');

    if (fs.existsSync(historyPath)) {
      const historyContent = fs.readFileSync(historyPath, 'utf-8');
      history = JSON.parse(historyContent);
    } else {
      history = {
        versions: [],
        currentVersion: '',
        lastUpdated: '',
        totalCount: 0
      };
    }

    // 更新当前版本文件
    const versionPath = path.join(process.cwd(), 'version.json');
    fs.writeFileSync(versionPath, JSON.stringify(newVersionInfo, null, 2));
    console.log(`✅ 已更新版本文件: ${versionPath}`);

    // 添加到历史记录
    history.versions.unshift(newVersionInfo);
    history.currentVersion = targetVersion;
    history.lastUpdated = newVersionInfo.timestamp;
    history.totalCount = history.versions.length;

    // 限制历史记录数量
    if (history.versions.length > 100) {
      history.versions = history.versions.slice(0, 100);
      history.totalCount = 100;
    }

    // 保存历史记录
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    console.log(`✅ 已更新历史记录: ${historyPath}`);

    console.log(`🎉 版本调整完成！`);
    console.log(`   当前版本: ${targetVersion}`);
    console.log(`   描述: ${newVersionInfo.description}`);
    console.log(`   时间: ${new Date(newVersionInfo.timestamp).toLocaleString('zh-CN')}`);

  } catch (error: any) {
    console.error(`❌ 版本调整失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 显示当前版本信息
 */
function showCurrentVersion() {
  const versionPath = path.join(process.cwd(), 'version.json');

  if (!fs.existsSync(versionPath)) {
    console.log('📋 当前没有版本文件');
    return;
  }

  try {
    const versionContent = fs.readFileSync(versionPath, 'utf-8');
    const versionInfo: VersionInfo = JSON.parse(versionContent);

    console.log('📋 当前版本信息:');
    console.log(`   版本号: ${versionInfo.version}`);
    console.log(`   主版本: ${versionInfo.majorVersion}`);
    console.log(`   日期: ${versionInfo.date}`);
    console.log(`   序号: ${versionInfo.sequence}`);
    console.log(`   时间: ${new Date(versionInfo.timestamp).toLocaleString('zh-CN')}`);
    if (versionInfo.description) {
      console.log(`   描述: ${versionInfo.description}`);
    }
  } catch (error: any) {
    console.error(`❌ 读取版本信息失败: ${error.message}`);
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
📖 版本调整脚本使用说明

用法:
  bun run scripts/adjust-version.ts [选项] [版本号] [描述]

选项:
  --help, -h          显示帮助信息
  --current, -c       显示当前版本信息
  --next, -n          生成下一个版本号
  --reset             重置版本系统

示例:
  # 显示当前版本
  bun run scripts/adjust-version.ts --current

  # 调整到指定版本
  bun run scripts/adjust-version.ts 10.20260126.005 "手动调整版本"

  # 生成下一个版本号
  bun run scripts/adjust-version.ts --next

  # 重置版本系统
  bun run scripts/adjust-version.ts --reset

版本号格式: 主版本.日期.序号 (例: 10.20260126.001)
  - 主版本: 固定为 10
  - 日期: YYYYMMDD 格式
  - 序号: 001-999，3位数字
`);
}

/**
 * 生成下一个版本号
 */
function generateNextVersion() {
  const versionPath = path.join(process.cwd(), 'version.json');

  if (!fs.existsSync(versionPath)) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const nextVersion = `10.${today}.001`;
    console.log(`📋 建议的初始版本号: ${nextVersion}`);
    return;
  }

  try {
    const versionContent = fs.readFileSync(versionPath, 'utf-8');
    const currentVersion: VersionInfo = JSON.parse(versionContent);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let nextSequence = 1;

    // 如果是同一天，序号递增
    if (currentVersion.date === today) {
      nextSequence = currentVersion.sequence + 1;
    }

    const nextVersion = `10.${today}.${nextSequence.toString().padStart(3, '0')}`;
    console.log(`📋 建议的下一个版本号: ${nextVersion}`);
    console.log(`   当前版本: ${currentVersion.version}`);
    console.log(`   升级类型: ${currentVersion.date === today ? '同日升级' : '跨日升级'}`);

  } catch (error: any) {
    console.error(`❌ 生成下一个版本号失败: ${error.message}`);
  }
}

/**
 * 重置版本系统
 */
function resetVersionSystem() {
  console.log('🔄 重置版本系统...');

  const versionPath = path.join(process.cwd(), 'version.json');
  const historyPath = path.join(process.cwd(), 'version-history.json');

  // 备份现有文件
  const backupDir = path.join(process.cwd(), 'version-backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (fs.existsSync(versionPath)) {
    const backupVersionPath = path.join(backupDir, `version-${timestamp}.json`);
    fs.copyFileSync(versionPath, backupVersionPath);
    fs.unlinkSync(versionPath);
    console.log(`✅ 已备份并删除版本文件: ${backupVersionPath}`);
  }

  if (fs.existsSync(historyPath)) {
    const backupHistoryPath = path.join(backupDir, `version-history-${timestamp}.json`);
    fs.copyFileSync(historyPath, backupHistoryPath);
    fs.unlinkSync(historyPath);
    console.log(`✅ 已备份并删除历史文件: ${backupHistoryPath}`);
  }

  console.log('🎉 版本系统重置完成！重启Agent服务后将自动初始化新版本。');
}

// 主程序
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--current') || args.includes('-c')) {
    showCurrentVersion();
    return;
  }

  if (args.includes('--next') || args.includes('-n')) {
    generateNextVersion();
    return;
  }

  if (args.includes('--reset')) {
    resetVersionSystem();
    return;
  }

  // 调整版本
  const targetVersion = args[0];
  const description = args[1];

  if (!targetVersion) {
    console.error('❌ 请提供目标版本号');
    showHelp();
    process.exit(1);
  }

  await adjustVersion(targetVersion, description);
}

// 运行主程序
main().catch(console.error);