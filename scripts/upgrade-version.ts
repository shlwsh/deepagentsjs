#!/usr/bin/env bun
/**
 * 版本升级脚本
 * 通过API接口升级项目版本
 */

interface UpgradeOptions {
  description?: string;
  force?: boolean;
  apiUrl?: string;
}

/**
 * 升级版本
 * @param options 升级选项
 */
async function upgradeVersion(options: UpgradeOptions = {}) {
  const {
    description,
    force = false,
    apiUrl = 'http://localhost:8910'
  } = options;

  console.log('🚀 开始升级版本...');

  try {
    // 获取当前版本
    console.log('📋 获取当前版本信息...');
    const currentResponse = await fetch(`${apiUrl}/api/version`);

    if (!currentResponse.ok) {
      throw new Error(`获取当前版本失败: ${currentResponse.statusText}`);
    }

    const currentResult = await currentResponse.json();
    if (currentResult.status !== 'success') {
      throw new Error(`获取当前版本失败: ${currentResult.message}`);
    }

    const currentVersion = currentResult.data.version;
    console.log(`   当前版本: ${currentVersion}`);

    // 执行版本升级
    console.log('⬆️  执行版本升级...');
    const upgradeResponse = await fetch(`${apiUrl}/api/version/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description,
        force
      })
    });

    if (!upgradeResponse.ok) {
      throw new Error(`版本升级请求失败: ${upgradeResponse.statusText}`);
    }

    const upgradeResult = await upgradeResponse.json();

    if (upgradeResult.status !== 'success') {
      throw new Error(`版本升级失败: ${upgradeResult.message}`);
    }

    const upgradeData = upgradeResult.data;

    if (!upgradeData.upgraded) {
      console.log('ℹ️  版本未发生变化');
      console.log(`   当前版本: ${upgradeData.oldVersion}`);
      console.log(`   原因: ${upgradeResult.message || '版本已是最新'}`);
      return;
    }

    // 升级成功
    console.log('🎉 版本升级成功！');
    console.log(`   旧版本: ${upgradeData.oldVersion}`);
    console.log(`   新版本: ${upgradeData.newVersion}`);
    console.log(`   升级时间: ${new Date(upgradeData.timestamp).toLocaleString('zh-CN')}`);

    if (upgradeData.versionInfo?.description) {
      console.log(`   描述: ${upgradeData.versionInfo.description}`);
    }

  } catch (error: any) {
    console.error(`❌ 版本升级失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
📖 版本升级脚本使用说明

用法:
  bun run scripts/upgrade-version.ts [选项]

选项:
  --help, -h              显示帮助信息
  --description, -d TEXT  版本升级描述
  --force, -f             强制升级
  --api-url URL           Agent服务地址 (默认: http://localhost:8910)

示例:
  # 基本升级
  bun run scripts/upgrade-version.ts

  # 带描述的升级
  bun run scripts/upgrade-version.ts --description "新功能发布"

  # 强制升级
  bun run scripts/upgrade-version.ts --force --description "紧急修复"

  # 指定API地址
  bun run scripts/upgrade-version.ts --api-url "http://localhost:8080"

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
      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--description':
      case '-d':
        if (i + 1 < args.length) {
          options.description = args[++i];
        }
        break;

      case '--force':
      case '-f':
        options.force = true;
        break;

      case '--api-url':
        if (i + 1 < args.length) {
          options.apiUrl = args[++i];
        }
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

  if (options.help || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  await upgradeVersion(options);
}

// 运行主程序
main().catch(console.error);